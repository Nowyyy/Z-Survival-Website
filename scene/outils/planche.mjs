// Planche de cadrages (lot 1) : capture les 6 images fixes (cadrages A, B, C × paysage 16:9, portrait 9:16) depuis scene/index.html,
// rendues à taille exacte et exportées en WebP par le canvas, dans scene/planche/.
// Usage : node scene/outils/planche.mjs [adresse de scene/index.html] [instant t en secondes]
// (le site doit être servi, par exemple : python3 -m http.server depuis le dossier parent du dépôt).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../planche');
const base = process.argv[2] ?? 'http://localhost:8765/Z-Survival-Website/scene/index.html';
const t = Number(process.argv[3] ?? 0);
const TAILLES = { paysage: [1600, 900], portrait: [900, 1600] };
const QUALITE = 0.9;

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fautes = 0;
for (const cadrage of ['A', 'B', 'C']) {
  for (const format of ['paysage', 'portrait']) {
    const [w, h] = TAILLES[format];
    const page = await browser.newPage({ viewport: { width: Math.min(w, 1280), height: Math.min(h, 1280) } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${base}?cadrage=${cadrage}&format=${format}&capture=1&w=${w}&h=${h}&t=${t}`);
    await page.waitForFunction(() => window.__scene?.ready || window.__sceneError, null, { timeout: 180000 });
    const url = await page.evaluate(({ tt, q }) => window.__scene.image(tt, 'image/webp', q), { tt: t, q: QUALITE });
    const file = path.join(out, `${cadrage}-${format}.webp`);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    fautes += errors.length;
    console.log(`${path.basename(file)} ${w}×${h} ${(fs.statSync(file).size / 1024).toFixed(0)} Kio${errors.length ? ` ERREURS : ${errors.join(' | ')}` : ''}`);
    await page.close();
  }
}
await browser.close();
process.exit(fautes ? 1 : 0);
