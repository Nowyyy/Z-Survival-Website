// Lot 6a — Vérification légère de la section Armes, sur une copie exacte de ce que publie le workflow (servie à la racine) :
//   node outils/armes/verifier-armes.mjs
// Tailles : téléphone 375 × 667 et 320 × 568, paysage 667 × 375, ordinateur 1440 × 900 ; avec et sans mouvement réduit ; français et anglais.
// 1. Interrupteur éteint, sans paramètre : section « Prochainement » d'avant, aucune requête vers les fichiers de la nouvelle section.
// 2. ?apercu=armes : toutes les armes, changement d'arme au toucher / au clic / au clavier, stats sans aucun chiffre, aucun chevauchement,
//    textes traduits.
// 3. Interrupteur allumé (simulé : js/donnees.js réécrit à la volée, le fichier n'est pas modifié) : même rendu que l'aperçu.
// Partout : aucune erreur console, aucun fichier manquant. Actualités simulées (aucun article) : leurs contrôles sont dans outils/admin/.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { servirCopiePubliee, simulerActualites } from '../copie-publiee.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ARMES = JSON.parse(readFileSync(new URL('../../contenus/armes.json', import.meta.url), 'utf8')).armes;
const NOUVEAUX = /img\/armes\/|contenus\/armes\.json|section-armes\.(js|css)/;
const TAILLES = [[375, 667, true], [320, 568, true], [667, 375, true], [1440, 900, false]];

// Part des pixels qui diffèrent nettement entre deux captures PNG de même taille (ffmpeg les décode ; l'encodage PNG varie d'une capture à
// l'autre même à l'image identique, d'où la comparaison des pixels).
function ecartPixels(a, b) {
  const brut = (png) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', '-', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { input: png, maxBuffer: 1 << 26 });
  const [x, y] = [brut(a), brut(b)];
  if (x.length !== y.length) return 1;
  let n = 0;
  for (let i = 0; i < x.length; i += 3) if (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) > 24) n += 1;
  return n / (x.length / 3);
}

const site = await servirCopiePubliee({ sousDossier: false });
const navigateur = await chromium.launch();
const resultats = [];
const verifier = (nom, ok, detail = '') => { resultats.push({ nom, ok, detail }); if (!ok) console.log(`ÉCHEC  ${nom} ${detail}`); };

async function ouvrir({ w, h, tactile, reduit, lang, requete = '', allume = false }) {
  const ctx = await navigateur.newContext({ viewport: { width: w, height: h }, hasTouch: tactile, isMobile: tactile, reducedMotion: reduit ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const erreurs = [];
  const requetes = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('request', (r) => requetes.push(r.url()));
  page.on('response', (r) => { if (r.status() >= 400) erreurs.push(`${r.status()} ${r.url()}`); });
  await simulerActualites(page);
  if (allume) {
    await page.route('**/js/donnees.js', async (route) => {
      const r = await route.fetch();
      await route.fulfill({ response: r, body: (await r.text()).replace('SECTION_ARMES_ACTIVE = false', 'SECTION_ARMES_ACTIVE = true') });
    });
  }
  const params = new URLSearchParams(requete);
  params.set('lang', lang);
  params.set('intro', '0');
  await page.goto(`${site.base}?${params}#weapons`);
  await page.waitForFunction(() => document.body.classList.contains('est-pret'));
  await page.waitForTimeout(400);
  return { ctx, page, erreurs, requetes };
}

for (const [w, h, tactile] of TAILLES) {
  for (const reduit of [false, true]) {
    for (const lang of ['fr', 'en']) {
      const cas = `${w}×${h} ${reduit ? 'réduit' : 'animé'} ${lang}`;
      // 1. Interrupteur éteint.
      {
        const { ctx, page, erreurs, requetes } = await ouvrir({ w, h, tactile, reduit, lang });
        const etat = await page.evaluate(() => {
          const s = document.getElementById('weapons');
          return {
            aVenir: s.classList.contains('est-a-venir'), encart: s.querySelector('.a-venir-encart')?.textContent, provisoire: s.querySelectorAll('.arme-bouton').length,
            nouveau: Boolean(s.querySelector('.arsenal')),
          };
        });
        verifier(`${cas} éteint : encart d'avant`, etat.aVenir && etat.encart === (lang === 'fr' ? 'Prochainement' : 'Coming soon') && etat.provisoire === 3 && !etat.nouveau, JSON.stringify(etat));
        const vus = requetes.filter((u) => NOUVEAUX.test(u));
        verifier(`${cas} éteint : aucun fichier de la nouvelle section`, vus.length === 0, vus.join(' '));
        verifier(`${cas} éteint : console propre`, erreurs.length === 0, erreurs.join(' | '));
        await ctx.close();
      }
      // 2. Aperçu (et 3. interrupteur allumé, à une taille par appareil, avec capture comparée).
      for (const allume of reduit && lang === 'fr' ? [false, true] : [false]) {
        const nom = `${cas} ${allume ? 'allumé' : 'aperçu'}`;
        const { ctx, page, erreurs, requetes } = await ouvrir({ w, h, tactile, reduit, lang, requete: allume ? '' : 'apercu=armes', allume });
        await page.waitForSelector('.arsenal[data-etat="pret"]');
        await page.waitForFunction(() => { const i = document.querySelector('.arsenal-visuel'); return i.complete && i.naturalWidth > 0; });
        await page.evaluate(() => Promise.all([...document.querySelectorAll('.arsenal-miniature-image')].map((i) => { i.loading = 'eager'; return i.decode().catch(() => {}); })));
        const etat = await page.evaluate(() => {
          const r = (e) => e.getBoundingClientRect();
          const s = document.getElementById('weapons');
          const boites = ['.section-entete', '.arsenal-scene', '.arsenal-infos', '.arsenal-stats', '.arsenal-liste'].map((q) => [q, r(s.querySelector(q))]);
          const chevauchent = [];
          for (let i = 0; i < boites.length; i += 1) for (let j = i + 1; j < boites.length; j += 1) {
            const [a, b] = [boites[i][1], boites[j][1]];
            if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) chevauchent.push(`${boites[i][0]}/${boites[j][0]}`);
          }
          const nav = document.querySelector('.nav-sections');
          const basNav = getComputedStyle(nav).flexDirection !== 'column' && r(nav).top > innerHeight / 2 ? r(nav).top : innerHeight;
          const debordent = boites.filter(([, b]) => b.bottom > basNav + 1 || b.top < 0 || b.height < 1).map(([q]) => q);
          const desc = s.querySelector('.arsenal-description');
          return {
            miniatures: s.querySelectorAll('.arsenal-miniature').length,
            imagesMini: [...s.querySelectorAll('.arsenal-miniature-image')].filter((i) => i.naturalWidth > 0).length,
            chiffresStats: (s.querySelector('.arsenal-stats').textContent.match(/\d/g) ?? []).length,
            tampon: s.querySelector('.arsenal-stats-tampon').textContent,
            categorie: s.querySelector('.arsenal-categorie').textContent,
            nom: s.querySelector('.arsenal-nom').textContent,
            descriptionTronquee: desc.scrollHeight > desc.clientHeight + 1,
            chevauchent, debordent, sceneH: Math.round(boites[1][1].height),
          };
        });
        const nbVisibles = ARMES.filter((a) => !a.prochainement).length;
        verifier(`${nom} : ${ARMES.length} armes et leurs miniatures (${nbVisibles} images)`, etat.miniatures === ARMES.length && etat.imagesMini === nbVisibles, JSON.stringify(etat));
        verifier(`${nom} : stats sans aucun chiffre, « ${etat.tampon} »`, etat.chiffresStats === 0 && etat.tampon === (lang === 'fr' ? 'Prochainement' : 'Coming soon'));
        verifier(`${nom} : textes traduits`, etat.categorie === (lang === 'fr' ? 'Pistolet' : 'Pistol') && etat.nom === 'Colt M1911', `${etat.categorie} / ${etat.nom}`);
        // Retours du propriétaire : armes « prochainement », chapitres, noms jamais coupés au milieu d'un mot ni tronqués.
        const retours = await page.evaluate(() => {
          const s = document.getElementById('weapons');
          const mini = [...s.querySelectorAll('.arsenal-miniature')];
          const seulPoint = (b) => !b.querySelector('img') && !b.querySelector('.arsenal-miniature-nom') && b.textContent.trim() === '?';
          const motsCoupes = [...s.querySelectorAll('.arsenal-nom .arsenal-mot, .arsenal-miniature-nom .arsenal-mot')].filter((m) => m.getClientRects().length > 1).length;
          const tronques = mini.filter((b) => { const n = b.querySelector('.arsenal-miniature-nom'); if (!n) return false; const r = n.getBoundingClientRect(); const rb = b.getBoundingClientRect(); return n.scrollWidth > n.clientWidth + 1 || r.bottom > rb.bottom + 1 || r.left < rb.left - 1 || r.right > rb.right + 1; }).map((b) => b.dataset.arme);
          return {
            mysteres: mini.filter((b) => b.querySelector('.arsenal-miniature-mystere')).map((b) => b.dataset.arme).sort().join(','),
            seulPoint: mini.filter(seulPoint).map((b) => b.dataset.arme).sort().join(','),
            chapitres: [...s.querySelectorAll('.section-entete .arsenal-chapitre')].map((b) => `${b.textContent}:${b.getAttribute('aria-pressed')}`).join(','),
            motsCoupes, tronques,
          };
        });
        const attendues = ARMES.filter((a) => a.prochainement).map((a) => a.id).sort().join(',');
        verifier(`${nom} : armes à venir (${attendues}) : miniature réduite à un « ? » (ni image ni nom)`, retours.mysteres === attendues && retours.seulPoint === attendues, JSON.stringify(retours));
        // Filigrane : pour chaque arme, deux lignes au plus et rien hors du cadre.
        const filigranes = await page.evaluate(() => [...document.querySelectorAll('.arsenal-miniature')].map((b) => {
          b.click();
          document.querySelector('.arsenal').getAnimations({ subtree: true }).forEach((an) => { try { an.finish(); } catch { /* animation sans fin */ } }); // mesure à l'arrivée
          const f = document.querySelector('.arsenal-filigrane');
          const x = f.firstElementChild;
          const rf = f.getBoundingClientRect();
          const mots = [...x.children].map((m) => m.getBoundingClientRect());
          const lignes = new Set(mots.map((r) => Math.round(r.top))).size;
          // Largeur : chaque mot dans le cadre ; hauteur : le bloc de texte (les coulures de la police dépassent un peu de chaque ligne).
          const dehors = mots.some((r) => r.left < rf.left - 1 || r.right > rf.right + 1) || x.getBoundingClientRect().height > rf.height + 1;
          return lignes <= 2 && !dehors ? null : `${b.dataset.arme} (${lignes} lignes${dehors ? ', dépasse' : ''})`;
        }).filter(Boolean));
        await page.evaluate(() => document.querySelector('.arsenal-miniature').click());
        verifier(`${nom} : nom en filigrane sur deux lignes au plus, dans le cadre`, filigranes.length === 0, filigranes.join(' '));
        verifier(`${nom} : sélecteur « ${lang === 'fr' ? 'Chapitre' : 'Chapter'} 1 »`, retours.chapitres === `${lang === 'fr' ? 'Chapitre' : 'Chapter'} 1:true`, retours.chapitres);
        verifier(`${nom} : noms ni coupés au milieu d'un mot ni tronqués`, retours.motsCoupes === 0 && !retours.tronques.length, JSON.stringify(retours));
        verifier(`${nom} : aucun chevauchement, rien ne dépasse`, !etat.chevauchent.length && !etat.debordent.length && !etat.descriptionTronquee && etat.sceneH >= 60, JSON.stringify(etat));
        if (allume) {
          const { ctx: c2, page: p2 } = await ouvrir({ w, h, tactile, reduit, lang, requete: 'apercu=armes' });
          await p2.waitForSelector('.arsenal[data-etat="pret"]');
          await p2.waitForFunction(() => { const i = document.querySelector('.arsenal-visuel'); return i.complete && i.naturalWidth > 0; });
          await p2.evaluate(() => Promise.all([...document.querySelectorAll('.arsenal-miniature-image')].map((i) => { i.loading = 'eager'; return i.decode().catch(() => {}); })));
          // Polices, images et fin du calage sur la section : on laisse la page se poser avant de comparer.
          await Promise.all([page, p2].map((p) => p.evaluate(() => document.fonts.ready)));
          await page.waitForTimeout(1200);
          await p2.waitForTimeout(1200);
          const [a, b] = [await page.screenshot(), await p2.screenshot()];
          const ecart = ecartPixels(a, b);
          verifier(`${nom} : même rendu que l'aperçu (captures comparées pixel à pixel)`, ecart < 0.001, `${(ecart * 100).toFixed(3)} % de pixels différents`);
          await c2.close();
        }
        // Changement d'arme : toucher ou clic sur une miniature, flèche, clavier.
        const choisie = () => page.evaluate(() => document.querySelector('.arsenal-miniature[aria-pressed="true"]')?.dataset.arme);
        const m = page.locator('.arsenal-miniature').nth(3);
        if (tactile) await m.tap(); else await m.click();
        const apresMini = await choisie();
        await page.locator('.arsenal-fleche-suivante').click();
        const apresFleche = await choisie();
        await page.keyboard.press('ArrowRight');
        const apresDroite = await choisie();
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        const apresGauche = await choisie();
        const ids = await page.$$eval('.arsenal-miniature', (bs) => bs.map((x) => x.dataset.arme)); // ordre affiché (par famille, puis « ordre »)
        verifier(`${nom} : changement d'arme (${tactile ? 'toucher' : 'clic'}, flèche, clavier)`, apresMini === ids[3] && apresFleche === ids[4] && apresDroite === ids[5] && apresGauche === ids[3], `${apresMini} ${apresFleche} ${apresDroite} ${apresGauche}`);
        const section = await page.evaluate(() => document.body.dataset.section);
        verifier(`${nom} : les flèches ← → restent dans la section`, section === 'weapons', section);
        const prochaine = ARMES.find((a) => a.prochainement);
        if (prochaine) {
          // Clic par le DOM : un clic Playwright ferait d'abord défiler la page jusqu'à la miniature (le vrai clic est testé plus haut).
          await page.evaluate((id) => document.querySelector(`.arsenal-miniature[data-arme="${id}"]`).click(), prochaine.id);
          const vue = await page.evaluate(() => ({
            visuelCache: document.querySelector('.arsenal-visuel').hidden && !document.querySelector('.arsenal-visuel').getAttribute('src'),
            tampon: getComputedStyle(document.querySelector('.arsenal-scene-tampon')).display !== 'none' && document.querySelector('.arsenal-scene-tampon').textContent,
            nom: document.querySelector('.arsenal-nom').textContent,
            categorie: document.querySelector('.arsenal-categorie').textContent,
            filigrane: document.querySelector('.arsenal-filigrane').textContent,
            texte: document.querySelector('.arsenal-infos').textContent,
          }));
          const reconnu = ARMES.filter((a) => a.prochainement).some((a) => [a.nom, a.nomEn, a.description?.fr, a.description?.en].filter(Boolean).some((x) => vue.texte.includes(x)));
          verifier(`${nom} : ${prochaine.id} choisie = ni forme ni nom, « ? ? ? » et grand « Prochainement »`, vue.visuelCache && vue.tampon === (lang === 'fr' ? 'Prochainement' : 'Coming soon') && vue.nom === '? ? ?' && vue.filigrane === '?' && vue.categorie === (lang === 'fr' ? 'Arme à venir' : 'Upcoming weapon') && !reconnu, JSON.stringify(vue));
        }
        {
          const secretes = ARMES.filter((a) => a.prochainement).map((a) => a.id);
          const vues = requetes.filter((u) => secretes.some((id) => u.includes(`img/armes/${id}`)));
          verifier(`${nom} : images des armes à venir jamais téléchargées`, vues.length === 0, vues.join(' '));
        }
        verifier(`${nom} : console propre`, erreurs.length === 0, erreurs.join(' | '));
        await ctx.close();
      }
    }
  }
}

await navigateur.close();
site.fermer();
const echecs = resultats.filter((r) => !r.ok);
console.log(`\nSection Armes : ${resultats.length - echecs.length}/${resultats.length} contrôles réussis.`);
process.exitCode = echecs.length ? 1 : 0;
