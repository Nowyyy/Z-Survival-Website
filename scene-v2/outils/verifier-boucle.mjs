// Vérifie que la boucle de la scène ne saute pas (lot 1 ; copie pour la scène v2, lot 5a) : rend un cycle complet image par image (25 images/s) et compare chaque image à
// la suivante (écart moyen des pixels, 0 à 255). La dernière image du cycle est comparée à la première : son écart doit rester du même
// ordre que celui de deux images voisines. L'image à t = DUREE doit être identique à l'image à t = 0.
// Usage : node scene-v2/outils/verifier-boucle.mjs [adresse de scene/index.html] [cadrage] [format] [paramètres en plus, ex. details=1]
// (le site doit être servi, par exemple : python3 -m http.server depuis le dossier parent du dépôt).
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://localhost:8765/scene-v2/index.html';
const cadrage = process.argv[3] ?? 'B';
const format = process.argv[4] ?? 'paysage';
const extra = process.argv[5] ? `&${process.argv[5]}` : ''; // paramètres en plus de la scène (ex. details=1)
const FPS = 25;
const [w, h] = format === 'portrait' ? [270, 480] : [480, 270];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${base}?cadrage=${cadrage}&format=${format}&capture=1&w=${w}&h=${h}&t=0${extra}`);
await page.waitForFunction(() => window.__scene?.ready || window.__sceneError, null, { timeout: 180000 });
const result = await page.evaluate(async ({ fps }) => {
  const s = window.__scene;
  const n = Math.round(s.duree * fps);
  const toile = document.getElementById('toile');
  const c = document.createElement('canvas');
  c.width = toile.width;
  c.height = toile.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  const grab = (t) => {
    s.rendre(t);
    g.drawImage(toile, 0, 0);
    return g.getImageData(0, 0, c.width, c.height).data;
  };
  const diff = (a, b) => {
    let sum = 0;
    for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    return sum / ((a.length / 4) * 3);
  };
  const first = grab(0);
  let prev = first;
  const steps = [];
  for (let k = 1; k < n; k += 1) {
    const cur = grab(k / fps);
    steps.push(diff(prev, cur));
    prev = cur;
  }
  const seam = diff(prev, first); // dernière image du cycle -> première
  const end = grab(s.duree);
  return { n, steps, seam, sameAtEnd: diff(end, first) };
}, { fps: FPS });
await browser.close();
const sorted = [...result.steps].sort((a, b) => a - b);
const mean = result.steps.reduce((a, b) => a + b, 0) / result.steps.length;
const p95 = sorted[Math.floor(sorted.length * 0.95)];
const max = sorted.at(-1);
const ok = result.sameAtEnd === 0 && result.seam <= Math.max(max, p95 * 1.5);
console.log(JSON.stringify({ cadrage, format, images: result.n, ecartMoyen: +mean.toFixed(3), ecart95: +p95.toFixed(3), ecartMax: +max.toFixed(3), ecartJonction: +result.seam.toFixed(3), finEgaleDebut: result.sameAtEnd === 0, erreurs: errors, ok }));
process.exit(ok && errors.length === 0 ? 0 : 1);
