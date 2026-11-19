// Images de la planche v1 / v2 (lot 5a) : scene-v2/planche/.
//  - v1-*.webp : la scène actuelle de l'accueil (scene/index.html, celle de la vidéo publique) ;
//  - v2-*.webp : la scène v2 (scene-v2/index.html), mêmes instants, même cadrage B ;
//    paysage 1280 × 720 et portrait 720 × 1280, à AVANT (avant le coup de feu du personnage 1) et PENDANT (l'éclair) ;
//  - apercu-ordinateur.jpg (1440 × 810) et apercu-telephone.jpg (390 × 844, écran ×2) : la v2 sous la vraie page d'accueil (scene-v2/apercu.html).
// Usage : node scene-v2/outils/planche.mjs   (sert lui-même la copie exacte de ce que publie le workflow : outils/copie-publiee.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { servirCopiePubliee, simulerActualites } from '../../outils/copie-publiee.mjs';
import { TEMPS_TIR } from '../../js/accueil-boucle.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ici = path.dirname(fileURLToPath(import.meta.url));
const sortie = path.resolve(ici, '../planche');
export const AVANT = 4.7; // avant le coup de feu du personnage 1 (bras du zombie au sol, personnage 2 qui le regarde)
export const PENDANT = Math.round((TEMPS_TIR + 0.04) * 100) / 100; // l'éclair du coup de feu est encore là (5,24 s)
const QUALITE = 0.86;

fs.mkdirSync(sortie, { recursive: true });
const serveur = await servirCopiePubliee();
const navigateur = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fautes = 0;
const surveiller = (page, erreurs) => {
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) erreurs.push(`${r.status()} ${r.url()}`); });
};
const bilan = (fichier, extra, erreurs) => {
  fautes += erreurs.length;
  console.log(`${path.basename(fichier)} ${extra} ${(fs.statSync(fichier).size / 1024).toFixed(0)} Kio${erreurs.length ? ` ERREURS : ${erreurs.join(' | ')}` : ''}`);
};

try {
  for (const [version, dossier] of [['v1', 'scene'], ['v2', 'scene-v2']]) {
    for (const [format, [w, h]] of [['paysage', [1280, 720]], ['portrait', [720, 1280]]]) {
      const page = await navigateur.newPage({ viewport: { width: Math.min(w, 1280), height: Math.min(h, 1280) } });
      const erreurs = [];
      surveiller(page, erreurs);
      await page.goto(`${serveur.base}${dossier}/index.html?cadrage=B&format=${format}&capture=1&w=${w}&h=${h}&t=0`);
      await page.waitForFunction(() => window.__scene?.ready || window.__sceneError, null, { timeout: 300000 });
      for (const [nom, t] of [['avant', AVANT], ['pendant', PENDANT]]) {
        const url = await page.evaluate(({ x, q }) => window.__scene.image(x, 'image/webp', q), { x: t, q: QUALITE });
        const fichier = path.join(sortie, `${version}-${format}-${nom}.webp`);
        fs.writeFileSync(fichier, Buffer.from(url.split(',')[1], 'base64'));
        bilan(fichier, `${w}×${h} t=${t}`, erreurs);
      }
      await page.close();
    }
  }
  // La v2 sous l'accueil du site (en français), au même instant « avant ».
  for (const [nom, viewport, echelle] of [['apercu-ordinateur', { width: 1440, height: 810 }, 1], ['apercu-telephone', { width: 390, height: 844 }, 2]]) {
    const ctx = await navigateur.newContext({ viewport, deviceScaleFactor: echelle, locale: 'fr-FR' });
    await simulerActualites(ctx); // le serveur des actualités n'est pas appelé (réponse vide, comme les autres contrôles locaux)
    const page = await ctx.newPage();
    const erreurs = [];
    surveiller(page, erreurs);
    await page.goto(`${serveur.base}scene-v2/apercu.html?t=${AVANT}&lang=fr&capture=1`);
    await page.waitForFunction(() => window.__apercu?.pret(), null, { timeout: 300000 });
    await page.waitForTimeout(4500); // entrée en scène de l'accueil finie
    const fichier = path.join(sortie, `${nom}.jpg`);
    await page.screenshot({ path: fichier, type: 'jpeg', quality: 84 });
    bilan(fichier, `${viewport.width}×${viewport.height} ×${echelle}`, erreurs);
    await ctx.close();
  }
} finally {
  await navigateur.close();
  serveur.fermer();
}
process.exit(fautes ? 1 : 0);
