// Planche (retours du lot 1) : cadrage retenu B seulement.
//  - B-paysage.webp (1600 × 900) et B-portrait.webp (900 × 1600) : la scène seule, depuis scene/index.html, exportée par le canvas ;
//  - B-tir.webp : l'instant du coup de feu du personnage 1 (paysage) ;
//  - apercu-ordinateur.jpg (1600 × 900) et apercu-telephone.jpg (390 × 844, écran ×2) : la scène sous la vraie page d'accueil du site
//    (scene/apercu.html), capture d'écran de la page.
// Usage : node scene/outils/planche.mjs [adresse du dossier scene/ servi] [instant t en secondes]
// (le site doit être servi, par exemple : python3 -m http.server depuis le dossier parent du dépôt).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../planche');
const base = (process.argv[2] ?? 'http://localhost:8765/Z-Survival-Website/scene/').replace(/index\.html$/, '');
const t = Number(process.argv[3] ?? 0);
const QUALITE = 0.9;
const TIR = 5.24; // un peu après le départ du coup (js/tir.js : TIR = 5,2 s), l'éclair est encore là

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fautes = 0;
const watch = (page, errors) => {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
};
const report = (file, extra, errors) => {
  fautes += errors.length;
  console.log(`${path.basename(file)} ${extra} ${(fs.statSync(file).size / 1024).toFixed(0)} Kio${errors.length ? ` ERREURS : ${errors.join(' | ')}` : ''}`);
};

// La scène seule.
for (const [nom, format, [w, h], tt] of [['B-paysage', 'paysage', [1600, 900], t], ['B-portrait', 'portrait', [900, 1600], t], ['B-tir', 'paysage', [1600, 900], TIR]]) {
  const page = await browser.newPage({ viewport: { width: Math.min(w, 1280), height: Math.min(h, 1280) } });
  const errors = [];
  watch(page, errors);
  await page.goto(`${base}index.html?cadrage=B&format=${format}&capture=1&w=${w}&h=${h}&t=${tt}`);
  await page.waitForFunction(() => window.__scene?.ready || window.__sceneError, null, { timeout: 180000 });
  const url = await page.evaluate(({ x, qq }) => window.__scene.image(x, 'image/webp', qq), { x: tt, qq: QUALITE });
  const file = path.join(out, `${nom}.webp`);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  report(file, `${w}×${h}`, errors);
  await page.close();
}

// La scène sous l'accueil du site (en français).
for (const [nom, viewport, scale] of [['apercu-ordinateur', { width: 1600, height: 900 }, 1], ['apercu-telephone', { width: 390, height: 844 }, 2]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  watch(page, errors);
  await page.goto(`${base}apercu.html?t=${t}&lang=fr&capture=1`);
  await page.waitForFunction(() => window.__apercu?.pret(), null, { timeout: 180000 });
  await page.waitForTimeout(4500); // entrée en scène de l'accueil finie (js/accueil-entree.js : 4 s)
  const file = path.join(out, `${nom}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 86 });
  report(file, `${viewport.width}×${viewport.height} ×${scale}`, errors);
  await ctx.close();
}
await browser.close();
process.exit(fautes ? 1 : 0);
