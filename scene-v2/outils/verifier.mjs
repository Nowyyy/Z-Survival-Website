// Vérification légère de la scène v2 (lot 5a) et de l'accueil public inchangé. Usage : node scene-v2/outils/verifier.mjs [--sous-dossier]
// Sert la copie exacte de ce que publie le workflow (outils/copie-publiee.mjs), à la racine (ou sous /Z-Survival-Website/ avec --sous-dossier).
//  1. scene-v2/index.html (B paysage et portrait), apercu.html, planche.html (375 et 1280 px) : aucune erreur console, aucun fichier manquant,
//     aucune requête hors du site, noindex ; planche sans défilement horizontal ;
//  2. scène v2 : armes (Kar98k, Colt), boucle (image à 8 s = image à 0 s, jonction comme une image voisine), éclairs aux instants des tirs
//     (TEMPS_TIRS de js/accueil-boucle.js), verrou du Kar98k manœuvré après le tir et revenu avant la fin de la boucle ;
//  3. accueil public : aucune requête vers scene-v2/ (ni scene/), fichiers du site identiques à origin/main (img/accueil/ compris, empreintes
//     de img/accueil/fabrication.json), robots.txt interdit /scene-v2/, copie du jeu non retouchée (copier-jeu.mjs --verifier).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servirCopiePubliee, simulerActualites } from '../../outils/copie-publiee.mjs';
import { DUREE_BOUCLE, IMAGES_PAR_SECONDE, TEMPS_TIR, TEMPS_TIRS } from '../../js/accueil-boucle.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let ok = 0;
const echecs = [];
const verifier = (nom, cond, detail = '') => {
  if (cond) ok += 1;
  else echecs.push(`${nom}${detail ? ` (${detail})` : ''}`);
  console.log(`${cond ? 'OK   ' : 'ÉCHEC'} ${nom}${detail ? ` — ${detail}` : ''}`);
};

const serveur = await servirCopiePubliee();
const navigateur = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const origine = new URL(serveur.base).origin;
async function ouvrir(chemin, { viewport = { width: 960, height: 540 }, scale = 1 } = {}) {
  const ctx = await navigateur.newContext({ viewport, deviceScaleFactor: scale, locale: 'fr-FR' });
  await simulerActualites(ctx);
  const page = await ctx.newPage();
  const erreurs = [];
  const requetes = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) erreurs.push(`${r.status()} ${r.url()}`); });
  page.on('request', (r) => requetes.push(r.url()));
  await page.goto(`${serveur.base}${chemin}`);
  return { ctx, page, erreurs, requetes };
}
const dehors = (requetes) => requetes.filter((u) => !u.startsWith(origine) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.includes('z-survival-serveur'));

try {
  // 1-2. La scène v2.
  for (const format of ['paysage', 'portrait']) {
    const [w, h] = format === 'paysage' ? [480, 270] : [270, 480];
    const { ctx, page, erreurs, requetes } = await ouvrir(`scene-v2/index.html?cadrage=B&format=${format}&capture=1&w=${w}&h=${h}&t=0`);
    await page.waitForFunction(() => window.__scene?.ready || window.__sceneError, null, { timeout: 300000 });
    const r = await page.evaluate(({ duree, fps, tirs, tirP1 }) => {
      const s = window.__scene;
      if (!s) return { erreur: window.__sceneError };
      const toile = document.getElementById('toile');
      const c = document.createElement('canvas');
      c.width = toile.width;
      c.height = toile.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      const image = (t) => { s.rendre(t); g.drawImage(toile, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
      const ecart = (a, b) => { let x = 0; for (let i = 0; i < a.length; i += 4) x += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return x / ((a.length / 4) * 3); };
      const i0 = image(0);
      const fin = ecart(image(duree), i0);
      const jonction = ecart(image(duree - 1 / fps), i0);
      // Écarts entre images voisines, hors tirs, à quelques instants de la boucle.
      const voisins = [0.5, 1.4, 3.3, 4.2, 6.9, 7.4].map((t) => ecart(image(t), image(t + 1 / fps)));
      const eclairs = {};
      for (const t of [...tirs.map((x) => x + 0.01), ...tirs.map((x) => x - 0.05), ...tirs.map((x) => x + 0.09)]) { s.rendre(t); eclairs[t.toFixed(2)] = s.eclairs(); }
      const m = s.atelier.manoeuvreAt;
      const kar = s.atelier.kar;
      return {
        armes: s.armes, decor: s.decor, fin,
        // Volet de tôle de l'aile : jamais dans le sol (point le plus bas sur toute la boucle) ; parachute retiré.
        toleBas: (() => { const T = s.atelier.THREE; let pan = null; s.atelier.p1.root.parent.traverse((o) => { if (o.name === 'tole-au-vent') pan = o.children[0]; }); if (!pan) return null;
          const v = new T.Vector3(); let m = Infinity; for (let i = 0; i < 96; i += 1) { s.rendre((i * duree) / 96); pan.updateMatrixWorld(true); const P = pan.geometry.attributes.position; for (let j = 0; j < P.count; j += 1) m = Math.min(m, v.fromBufferAttribute(P, j).applyMatrix4(pan.matrixWorld).y); } return m; })(),
        parachute: Boolean(s.atelier.p1.root.parent.getObjectByName('parachute-scene')), jonction, voisins, eclairs,
        // Coup d'œil du personnage 1 : jamais pendant la manœuvre du verrou (main droite sur le levier).
        regardPendantVerrou: Array.from({ length: 160 }, (_, i) => i * duree / 160).some((t) => m(t, kar).main > 0 && s.atelier.regardP1(t) > 0),
        regardApres: s.atelier.regardP1(7.6),
        // Glissière du Colt : en place avant le tir du personnage 2, en arrière juste après, revenue ensuite.
        glissiere: [-0.05, 0.06, 0.4].map((d) => { s.rendre(tirs[0] + d); const g = s.atelier.colt.glissiere; return g ? -g.mesh.position.z / g.course : null; }),
        verrou: { avant: m(tirP1 - 0.2, kar), ouvert: Math.max(...[0.7, 0.8, 0.9].map((d) => m(tirP1 + d, kar).back)), apres: m(7.0, kar), main: Math.max(...[0.5, 0.7, 0.9].map((d) => m(tirP1 + d, kar).main)) },
        noindex: document.querySelector('meta[name=robots]')?.content,
      };
    }, { duree: DUREE_BOUCLE, fps: IMAGES_PAR_SECONDE, tirs: TEMPS_TIRS, tirP1: TEMPS_TIR });
    const n = `scène v2 ${format}`;
    verifier(`${n} : chargée sans erreur ni fichier manquant`, !r.erreur && erreurs.length === 0, [r.erreur, ...erreurs].filter(Boolean).join(' | '));
    verifier(`${n} : aucune requête hors du site`, dehors(requetes).length === 0, dehors(requetes).join(' '));
    verifier(`${n} : noindex`, r.noindex === 'noindex, nofollow');
    verifier(`${n} : armes Kar98k (personnage 1) et Colt (personnage 2)`, r.armes?.p1?.id === 'kar98k' && r.armes?.p2?.id === 'm1911', JSON.stringify(r.armes));
    verifier(`${n} : décor d'époque du jeu, avion écrasé à la place de l'hélicoptère`, r.decor?.avion === true, JSON.stringify(r.decor));
    verifier(`${n} : volet de tôle de l'aile jamais dans le sol, parachute retiré`, r.toleBas !== null && r.toleBas > 0 && !r.parachute, JSON.stringify({ toleBas: r.toleBas, parachute: r.parachute }));
    verifier(`${n} : image à ${DUREE_BOUCLE} s identique à l'image à 0 s`, r.fin === 0, `écart ${r.fin}`);
    const maxV = Math.max(...r.voisins);
    verifier(`${n} : boucle sans saut (jonction comme une image voisine)`, r.jonction <= Math.max(1.5 * maxV, 0.5), `jonction ${r.jonction.toFixed(3)}, voisines ${r.voisins.map((x) => x.toFixed(3)).join(' ')}`);
    for (const [i, t] of TEMPS_TIRS.entries()) {
      const qui = t === TEMPS_TIR ? 0 : 1;
      const juste = r.eclairs[(t + 0.01).toFixed(2)];
      const avant = r.eclairs[(t - 0.05).toFixed(2)];
      const apres = r.eclairs[(t + 0.09).toFixed(2)];
      verifier(`${n} : tir ${i + 1} à ${t} s (éclair du personnage ${qui + 1} juste après, pas avant, fini en 2 images)`, juste?.[qui] && !avant?.[qui] && !apres?.[qui], JSON.stringify({ avant, juste, apres }));
    }
    verifier(`${n} : coup d'œil du personnage 1 après la manœuvre du verrou, jamais pendant`, !r.regardPendantVerrou && r.regardApres > 0.5, JSON.stringify({ pendant: r.regardPendantVerrou, a7_6: r.regardApres }));
    verifier(`${n} : glissière du Colt qui recule au tir puis revient`, r.glissiere[0] === 0 && r.glissiere[1] > 0.9 && r.glissiere[2] === 0, JSON.stringify(r.glissiere));
    verifier(`${n} : verrou du Kar98k manœuvré après le tir, revenu avant la fin de la boucle`, r.verrou.ouvert > 0.99 && r.verrou.main > 0.99 && r.verrou.avant.back === 0 && r.verrou.apres.main === 0 && r.verrou.apres.lift === 0 && r.verrou.apres.back === 0, JSON.stringify(r.verrou));
    await ctx.close();
  }

  // Aperçu sous l'accueil.
  for (const [viewport, scale] of [[{ width: 390, height: 844 }, 2], [{ width: 1440, height: 900 }, 1]]) {
    const { ctx, page, erreurs, requetes } = await ouvrir('scene-v2/apercu.html?capture=1&lang=fr', { viewport, scale });
    await page.waitForFunction(() => window.__apercu?.pret(), null, { timeout: 300000 });
    const r = await page.evaluate(() => {
      const site = document.getElementById('site');
      const d = site?.contentDocument;
      return { noindex: document.querySelector('meta[name=robots]')?.content, titre: Boolean(d?.querySelector('.accueil-titre, h1')), sceneV2: document.getElementById('scene').src.includes('index.html'), transparent: Boolean(d?.getElementById('apercu-transparent')), video: d?.querySelector('video')?.currentSrc ?? '' };
    });
    const n = `aperçu ${viewport.width}×${viewport.height}`;
    verifier(`${n} : sans erreur ni fichier manquant`, erreurs.length === 0, erreurs.join(' | '));
    verifier(`${n} : aucune requête hors du site`, dehors(requetes).length === 0, dehors(requetes).join(' '));
    verifier(`${n} : noindex, accueil du site par-dessus (fond transparent), sans vidéo`, r.noindex === 'noindex, nofollow' && r.titre && r.transparent && r.video === '', JSON.stringify(r));
    verifier(`${n} : la scène chargée est la v2`, requetes.some((u) => u.includes('/scene-v2/js/armes.js')) && !requetes.some((u) => /\/scene\/(js|jeu)\//.test(u)));
    await ctx.close();
  }

  // Planche.
  for (const largeur of [375, 1280]) {
    const { ctx, page, erreurs, requetes } = await ouvrir('scene-v2/planche.html', { viewport: { width: largeur, height: 800 } });
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((ok2) => { setTimeout(ok2, 30); }); } });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 }).catch(() => {});
    const r = await page.evaluate(() => ({ noindex: document.querySelector('meta[name=robots]')?.content, large: document.documentElement.scrollWidth, images: [...document.images].map((i) => i.naturalWidth > 0), historique: document.querySelectorAll('.historique > li').length }));
    const n = `planche ${largeur} px`;
    verifier(`${n} : sans erreur ni fichier manquant, images chargées`, erreurs.length === 0 && r.images.every(Boolean), [...erreurs, `${r.images.filter(Boolean).length}/${r.images.length} images`].join(' | '));
    verifier(`${n} : noindex, aucun défilement horizontal, historique présent`, r.noindex === 'noindex, nofollow' && r.large <= largeur && r.historique >= 1, JSON.stringify({ large: r.large, historique: r.historique }));
    verifier(`${n} : aucune requête hors du site`, dehors(requetes).length === 0, dehors(requetes).join(' '));
    await ctx.close();
  }

  // 3. Accueil public : rien de scene-v2/ (ni de scene/).
  for (const viewport of [{ width: 375, height: 667 }, { width: 1440, height: 900 }]) {
    const { ctx, page, erreurs, requetes } = await ouvrir('', { viewport });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    const liens = await page.evaluate(() => [...document.querySelectorAll('a[href], link[href], script[src], img[src], source[src], video[src]')].map((e) => e.getAttribute('href') ?? e.getAttribute('src')).filter((x) => /scene/.test(x)));
    const n = `accueil ${viewport.width}×${viewport.height}`;
    verifier(`${n} : aucune requête vers scene-v2/ ni scene/`, !requetes.some((u) => /\/scene(-v2)?\//.test(u)), requetes.filter((u) => /scene/.test(u)).join(' '));
    verifier(`${n} : aucun lien vers la scène`, liens.length === 0, liens.join(' '));
    verifier(`${n} : vidéo de l'accueil = fichier v1 de img/accueil/`, requetes.some((u) => /img\/accueil\/accueil-(16x9|9x16)\.(mp4|webp)/.test(u)));
    verifier(`${n} : sans erreur`, erreurs.length === 0, erreurs.join(' | '));
    await ctx.close();
  }
} finally {
  await navigateur.close();
  serveur.fermer();
}

// Fichiers.
const git = (...a) => execFileSync('git', ['-C', RACINE, ...a], { encoding: 'utf8' }).trim();
const diffSite = git('diff', '--name-only', 'origin/main', '--', 'index.html', 'main.html', 'css', 'js', 'img', 'fonts', 'sons', 'musique', 'contenus', 'admin', 'favicon.ico', 'site.webmanifest', 'sitemap.xml', 'scene');
verifier('fichiers du site et de la v1 (scene/) identiques à origin/main', diffSite === '', diffSite.replace(/\n/g, ' '));
const fab = JSON.parse(readFileSync(join(RACINE, 'img/accueil/fabrication.json'), 'utf8'));
const sha = (f) => createHash('sha256').update(readFileSync(join(RACINE, 'img/accueil', f))).digest('hex');
const listes = Object.entries(fab.fichiers);
verifier('img/accueil/ : empreintes égales à fabrication.json', listes.length === 4 && listes.every(([f, v]) => sha(f) === v.sha256), listes.map(([f]) => f).join(' '));
verifier('img/accueil/ : aucun fichier en plus', readdirSync(join(RACINE, 'img/accueil')).length === 5);
const robots = readFileSync(join(RACINE, 'robots.txt'), 'utf8');
verifier('robots.txt interdit /scene-v2/', /^Disallow: \/scene-v2\/$/m.test(robots));
let copieOk = true;
try { execFileSync('node', [join(RACINE, 'outils/scene/copier-jeu.mjs'), '--verifier'], { stdio: 'pipe' }); } catch { copieOk = false; }
verifier('scene-v2/jeu/ conforme à ORIGINE.json (aucun fichier du jeu retouché)', copieOk);
const pages = ['scene-v2/index.html', 'scene-v2/apercu.html', 'scene-v2/planche.html'];
verifier('pages de scene-v2/ en noindex', pages.every((p) => readFileSync(join(RACINE, p), 'utf8').includes('<meta name="robots" content="noindex, nofollow">')));
const grep = (...a) => { try { return git('grep', ...a); } catch { return ''; } }; // git grep sort en erreur quand rien ne correspond
const absolus = grep('-nE', `(src|href)="/|url\\(['"]?/|from '/|fetch\\('/`, '--', 'scene-v2/*.html', 'scene-v2/js', 'scene-v2/css').split('\n').filter(Boolean);
verifier('aucun chemin qui commence par « / » dans scene-v2/', absolus.length === 0, absolus.join(' '));

console.log(`\n${ok} vérifications réussies, ${echecs.length} en échec${echecs.length ? ` :\n  ${echecs.join('\n  ')}` : ''}`);
process.exit(echecs.length ? 1 : 0);
