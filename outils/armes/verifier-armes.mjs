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
        const { ctx, page, erreurs } = await ouvrir({ w, h, tactile, reduit, lang, requete: allume ? '' : 'apercu=armes', allume });
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
        verifier(`${nom} : ${ARMES.length} armes et leurs miniatures`, etat.miniatures === ARMES.length && etat.imagesMini === ARMES.length, JSON.stringify(etat));
        verifier(`${nom} : stats sans aucun chiffre, « ${etat.tampon} »`, etat.chiffresStats === 0 && etat.tampon === (lang === 'fr' ? 'Prochainement' : 'Coming soon'));
        verifier(`${nom} : textes traduits`, etat.categorie === (lang === 'fr' ? 'Pistolet' : 'Pistol') && etat.nom === 'Colt M1911', `${etat.categorie} / ${etat.nom}`);
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
        const ids = ARMES.map((a) => a.id);
        verifier(`${nom} : changement d'arme (${tactile ? 'toucher' : 'clic'}, flèche, clavier)`, apresMini === ids[3] && apresFleche === ids[4] && apresDroite === ids[5] && apresGauche === ids[3], `${apresMini} ${apresFleche} ${apresDroite} ${apresGauche}`);
        const section = await page.evaluate(() => document.body.dataset.section);
        verifier(`${nom} : les flèches ← → restent dans la section`, section === 'weapons', section);
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
