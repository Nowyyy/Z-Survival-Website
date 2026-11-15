// Image de partage du site (lot 4a) : aperçu montré par Discord, WhatsApp et les réseaux sociaux (balises og:image et twitter:image
// d'index.html). Usage : node outils/partage/fabriquer.mjs   → img/partage.jpg (1200 × 630, JPEG, sans métadonnées).
// Méthode : la copie publiée du site (outils/copie-publiee.mjs) est servie en local ; une page de composition, servie à côté du
// site pour qu'elle utilise ses propres fichiers (css/base.css, polices, js/logo.js), pose l'affiche de l'accueil (cadrage B, 16:9,
// img/accueil/accueil-16x9.webp), la vignette et le cadre rouge de l'accueil, le logo Z-Survival (js/logo.js, poserLogo), l'accroche
// française (js/textes.js) et le logo du studio. Chromium sans écran (Playwright) en fait une capture JPEG à 1200 × 630.
// Reproductible : mêmes fichiers d'entrée et même Chromium → même image (empreinte SHA-256 affichée et gardée dans
// outils/partage/fabrication.json). Prérequis : Node 18 ou plus, Playwright et son Chromium.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servirCopiePubliee } from '../copie-publiee.mjs';
import { TEXTES } from '../../js/textes.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LARGEUR = 1200;
export const HAUTEUR = 630;
const QUALITE = 84;
const SORTIE = 'img/partage.jpg';

const echapper = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Couleurs : jetons de css/base.css uniquement (aucune couleur en dur hors jetons).
const PAGE = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<link rel="stylesheet" href="css/base.css">
<style>
  html, body { width: ${LARGEUR}px; height: ${HAUTEUR}px; overflow: hidden; background: var(--color-bg); }
  .scene { position: absolute; inset: 0; }
  .scene img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 42%; }
  .vignette {
    position: absolute; inset: 0;
    background:
      linear-gradient(to top, color-mix(in srgb, var(--color-bg) 94%, transparent) 0%, color-mix(in srgb, var(--color-bg) 70%, transparent) 26%,
        color-mix(in srgb, var(--color-bg) 22%, transparent) 50%, transparent 66%),
      linear-gradient(to bottom, color-mix(in srgb, var(--color-bg) 50%, transparent), transparent 22%);
  }
  .cadre {
    position: absolute; inset: 14px; border: 4px solid var(--color-action); border-radius: 28px;
    box-shadow: 0 0 26px var(--color-action-glow), inset 0 0 26px color-mix(in srgb, var(--color-action) 25%, transparent);
  }
  .studio { position: absolute; top: 40px; left: 44px; width: 120px; filter: drop-shadow(0 2px 8px rgb(0 0 0 / 60%)); }
  .contenu { position: absolute; left: 0; right: 0; bottom: 52px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .titre { font-size: 150px; padding-bottom: 0.3em; margin-bottom: -0.3em; filter: drop-shadow(0 4px 24px rgb(0 0 0 / 75%)); }
  .accroche { color: var(--color-text); font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.14em; font-size: 26px;
    text-shadow: 0 2px 10px var(--color-bg); }
</style></head>
<body>
  <div class="scene"><img src="img/accueil/accueil-16x9.webp" alt=""></div>
  <div class="vignette"></div>
  <div class="cadre"></div>
  <img class="studio" src="img/no-way-studio.svg" alt="">
  <div class="contenu">
    <h1 class="titre" id="titre">${echapper(TEXTES.fr.accueil.titre)}</h1>
    <p class="accroche">${echapper(TEXTES.fr.accueil.sousTitre)}</p>
  </div>
  <script type="module">
    import { poserLogo } from './js/logo.js';
    poserLogo(document.getElementById('titre'), ${JSON.stringify(TEXTES.fr.accueil.titre)});
    await document.fonts.load('150px "Rubik Wet Paint"');
    await document.fonts.load('26px "Rubik Dirt"');
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode()));
    document.body.dataset.pret = '1';
  </script>
</body></html>`;

export async function fabriquer() {
  const copie = await servirCopiePubliee({ sousDossier: false });
  const navigateur = await chromium.launch();
  try {
    const page = await navigateur.newPage({ viewport: { width: LARGEUR, height: HAUTEUR }, deviceScaleFactor: 1 });
    const adresse = `${copie.base}__partage.html`;
    await page.route(adresse, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE }));
    await page.goto(adresse);
    await page.waitForSelector('body[data-pret="1"]', { timeout: 15_000 });
    const image = await page.screenshot({ type: 'jpeg', quality: QUALITE, clip: { x: 0, y: 0, width: LARGEUR, height: HAUTEUR } });
    return image;
  } finally {
    await navigateur.close();
    copie.fermer();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const image = await fabriquer();
  writeFileSync(join(RACINE, SORTIE), image);
  const empreinte = createHash('sha256').update(image).digest('hex');
  const entrees = ['img/accueil/accueil-16x9.webp', 'img/no-way-studio.svg', 'js/logo.js', 'css/base.css']
    .map((f) => ({ fichier: f, sha256: createHash('sha256').update(readFileSync(join(RACINE, f))).digest('hex') }));
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fabrication.json'), `${JSON.stringify({
    sortie: SORTIE, largeur: LARGEUR, hauteur: HAUTEUR, format: 'jpeg', qualite: QUALITE, octets: image.length, sha256: empreinte,
    chromium: chromium.executablePath().split('/').filter((s) => s.includes('chrom')).join('/'), entrees,
  }, null, 2)}\n`);
  console.log(`${SORTIE} : ${LARGEUR} × ${HAUTEUR}, ${(image.length / 1024).toFixed(1)} Kio, sha256 ${empreinte}`);
}
