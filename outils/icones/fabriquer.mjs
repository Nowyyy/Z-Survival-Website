// Icônes du site (lot 4a), tirées du logo du jeu (js/logo.js) : Z rouge incliné de 13°, contour sombre, coulures de sang sous la lettre,
// sur le fond noir du jeu. Usage (une fois : npm ci dans ce dossier) : node outils/icones/fabriquer.mjs
// Écrit :
//   img/icones/icone.svg            favicon vectoriel (navigateurs récents) ;
//   favicon.ico                     favicon de secours, 16, 32 et 48 px (à la racine : certains navigateurs le demandent là d'office) ;
//   img/icones/icone-180.png        icône Apple (écran d'accueil de l'iPhone) ;
//   img/icones/icone-192.png, -512.png         icônes du manifeste ;
//   img/icones/icone-masquable-512.png         icône « maskable » d'Android (Z dans la zone sûre, 80 % centraux) ;
//   img/no-way-studio.png           logo du studio en PNG (600 px de large) pour les données structurées (Organization.logo).
// Méthode : le contour du Z vient de la police du logo (fonts/rubik-wet-paint-latin-400-normal.woff2, lue par opentype.js après
// décompression par wawoff2) ; les coulures, de js/logo.js (GOUTTES, gouttePath) ; les couleurs, des jetons de css/base.css.
// Un seul dessin SVG, rendu par Chromium sans écran (Playwright) à chaque taille : toutes les icônes sont identiques.
// En dessous de 32 px, les coulures sont retirées (illisibles) : il reste le Z et son contour. Reproductible : mêmes entrées → mêmes
// fichiers (empreintes dans outils/icones/fabrication.json).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOUTTES, gouttePath } from '../../js/logo.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const opentype = require('opentype.js');
const wawoff2 = require('wawoff2');
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const lire = (f) => readFileSync(join(RACINE, f));

// Jetons de css/base.css (aucune couleur en dur).
const base = lire('css/base.css').toString();
const jeton = (nom) => new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6})`).exec(base)?.[1] ?? (() => { throw new Error(`jeton --${nom} introuvable`); })();
const C = {
  fond: jeton('color-bg'), z: jeton('color-action'), contour: jeton('menu-z-contour'),
  coulure: jeton('menu-rouge'), ombre: jeton('menu-coulure-sombre'), reflet: jeton('menu-coulure-reflet'),
};

const r2 = (n) => Math.round(n * 100) / 100;
const INCLINAISON = 13; // degrés, comme .logo-z

// Contour du Z, à la taille 1000 (1 em = 1000 unités), ligne de base à y = 0.
const police = opentype.parse(new Uint8Array(await wawoff2.decompress(lire('fonts/rubik-wet-paint-latin-400-normal.woff2'))).buffer);
const EM = 1000;
const glyphe = police.getPath('Z', 0, 0, EM);
const boite = glyphe.getBoundingBox();
const cheminZ = glyphe.toPathData(2);

// Géométrie de css/base.css (« Logo »), en unités de la police (1 em = 1000) : .logo-z est une boîte en ligne de 0,95 em de haut
// (line-height), large comme l'avance du Z ; elle tourne de 13° autour du point à 88 % / 96 % de la boîte. Les coulures
// (.logo-coulures) : boîte de 0,72 em × 0,84 em, à 0,04 em du bord gauche et à 70 % de la hauteur, qui suit le Z pour son point
// d'attache (haut, milieu) mais pend droite (contre-rotation de -13° autour de ce point).
const asc = police.tables.hhea.ascender * (EM / police.unitsPerEm);
const desc = police.tables.hhea.descender * (EM / police.unitsPerEm);
const hautLigne = 0.95 * EM;
const haut = -(asc + (hautLigne - (asc - desc)) / 2); // y du haut de la boîte (ligne de base à 0, y vers le bas)
const avance = police.charToGlyph('Z').advanceWidth * (EM / police.unitsPerEm);
const centre = { x: 0.88 * avance, y: haut + 0.96 * hautLigne };
const tourner = (p, deg, o) => {
  const a = (deg * Math.PI) / 180;
  return { x: o.x + (p.x - o.x) * Math.cos(a) - (p.y - o.y) * Math.sin(a), y: o.y + (p.x - o.x) * Math.sin(a) + (p.y - o.y) * Math.cos(a) };
};
const L = 0.72 * EM;
const H = 0.84 * EM;
const attache = tourner({ x: 0.04 * EM + L / 2, y: haut + 0.7 * hautLigne }, INCLINAISON, centre);
const echelle = L / 60;

function coulures() {
  const x0 = attache.x - L / 2;
  const y0 = attache.y;
  const groupes = GOUTTES.map((g) => `<path d="${gouttePath(g)}" fill="${C.coulure}"/>`
    + `<path d="M${r2(g.cx + g.w * 0.42)} 0L${r2(g.cx + g.w * 0.4)} ${r2(g.l * 0.45)}C${r2(g.cx + g.w * 0.3)} ${r2(g.l * 0.7)} ${r2(g.cx + g.b * 0.95)} ${r2(g.l - g.b)} ${r2(g.cx + g.b * 0.8)} ${r2(g.l + g.b * 0.4)}" fill="none" stroke="${C.ombre}" stroke-width="1.1" stroke-linecap="round"/>`
    + `<path d="M${r2(g.cx - g.w * 0.18)} 2L${r2(g.cx - g.w * 0.16)} ${r2(g.l * 0.5)}" fill="none" stroke="${C.reflet}" stroke-width="0.7" stroke-linecap="round" opacity="0.8"/>`).join('');
  // Le haut des gouttes (au-dessus de y = 0, sous le Z) est coupé comme dans le logo (overflow: hidden de la vue 60 × 60).
  return `<clipPath id="c"><rect x="0" y="0" width="60" height="60"/></clipPath>`
    + `<g transform="translate(${r2(x0)} ${r2(y0)}) scale(${r2(echelle)} ${r2((H / 60))})" clip-path="url(#c)">${groupes}</g>`;
}

// Boîte englobante du dessin (Z incliné + coulures), pour le centrer dans le carré de l'icône.
function englobante(avecCoulures) {
  const coins = [[boite.x1, boite.y1], [boite.x2, boite.y1], [boite.x1, boite.y2], [boite.x2, boite.y2]].map(([x, y]) => tourner({ x, y }, INCLINAISON, centre));
  const xs = coins.map((p) => p.x);
  const ys = coins.map((p) => p.y);
  if (avecCoulures) {
    const bas = Math.max(...GOUTTES.map((g) => g.l + g.b)) * (H / 60);
    ys.push(attache.y + bas);
  }
  return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
}

/**
 * Icône SVG carrée (vue 512 × 512).
 * @param {object} o  coulures : avec les coulures ; part : part du carré occupée par le dessin (plus grande dimension) ;
 *                    arrondi : rayon des coins du fond (0 : carré plein, pour l'icône Apple et les icônes masquables).
 */
export function svgIcone({ coulures: avecCoulures = true, part = 0.78, arrondi = 0 } = {}) {
  const b = englobante(avecCoulures);
  const taille = Math.max(b.x2 - b.x1, b.y2 - b.y1);
  const k = (512 * part) / taille;
  const tx = 256 - k * (b.x1 + b.x2) / 2;
  const ty = 256 - k * (b.y1 + b.y2) / 2;
  const fond = arrondi ? `<rect width="512" height="512" rx="${arrondi}" fill="${C.fond}"/>` : `<rect width="512" height="512" fill="${C.fond}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${fond}`
    + `<g transform="translate(${r2(tx)} ${r2(ty)}) scale(${r2(k * 1000) / 1000})">`
    + (avecCoulures ? coulures() : '')
    + `<path d="${cheminZ}" transform="rotate(${INCLINAISON} ${r2(centre.x)} ${r2(centre.y)})" fill="${C.z}" stroke="${C.contour}" stroke-width="${0.035 * EM}" stroke-linejoin="round" paint-order="stroke fill"/>`
    + `</g></svg>\n`;
}

// Favicon .ico : entrées PNG (format accepté par tous les navigateurs depuis Windows Vista / IE 9).
function ico(pngs) {
  const entete = Buffer.alloc(6 + 16 * pngs.length);
  entete.writeUInt16LE(0, 0);
  entete.writeUInt16LE(1, 2);
  entete.writeUInt16LE(pngs.length, 4);
  let decalage = entete.length;
  pngs.forEach(({ taille, png }, i) => {
    const o = 6 + 16 * i;
    entete.writeUInt8(taille >= 256 ? 0 : taille, o);
    entete.writeUInt8(taille >= 256 ? 0 : taille, o + 1);
    entete.writeUInt8(0, o + 2);
    entete.writeUInt8(0, o + 3);
    entete.writeUInt16LE(1, o + 4);
    entete.writeUInt16LE(32, o + 6);
    entete.writeUInt32LE(png.length, o + 8);
    entete.writeUInt32LE(decalage, o + 12);
    decalage += png.length;
  });
  return Buffer.concat([entete, ...pngs.map((p) => p.png)]);
}

async function rendre(navigateur, svg, largeur, hauteur = largeur, transparent = false) {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1 });
  const fond = transparent ? 'transparent' : C.fond;
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;width:${largeur}px;height:${hauteur}px;overflow:hidden;background:${fond}}
    img{display:block;width:${largeur}px;height:${hauteur}px}</style></head><body><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`);
  await page.evaluate(() => document.images[0].decode());
  const png = await page.screenshot({ type: 'png', omitBackground: transparent, clip: { x: 0, y: 0, width: largeur, height: hauteur } });
  await page.close();
  return png;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(join(RACINE, 'img/icones'), { recursive: true });
  const fichiers = {};
  const ecrire = (f, contenu) => { writeFileSync(join(RACINE, f), contenu); fichiers[f] = contenu; };
  // Favicon vectoriel : coins arrondis (onglet), coulures gardées (le navigateur l'affiche de 16 à 32 px : le Z reste lisible).
  const favicon = svgIcone({ coulures: true, part: 0.86, arrondi: 96 });
  ecrire('img/icones/icone.svg', favicon);
  const petit = svgIcone({ coulures: false, part: 0.9, arrondi: 96 });
  const navigateur = await chromium.launch();
  try {
    const pngIco = [];
    for (const taille of [16, 32, 48]) pngIco.push({ taille, png: await rendre(navigateur, taille < 32 ? petit : favicon, taille, taille, true) });
    ecrire('favicon.ico', ico(pngIco));
    const plein = svgIcone({ coulures: true, part: 0.74 });
    ecrire('img/icones/icone-180.png', await rendre(navigateur, plein, 180));
    ecrire('img/icones/icone-192.png', await rendre(navigateur, plein, 192));
    ecrire('img/icones/icone-512.png', await rendre(navigateur, plein, 512));
    // Masquable : Android peut rogner jusqu'à un cercle de 80 % ; le dessin tient dans 58 % du carré.
    ecrire('img/icones/icone-masquable-512.png', await rendre(navigateur, svgIcone({ coulures: true, part: 0.58 }), 512));
    // Logo du studio en PNG, fond transparent (vue 824 × 628 du SVG).
    const studio = lire('img/no-way-studio.svg').toString();
    ecrire('img/no-way-studio.png', await rendre(navigateur, studio, 600, Math.round((600 * 628) / 824), true));
  } finally {
    await navigateur.close();
  }
  const empreintes = Object.fromEntries(Object.entries(fichiers).map(([f, c]) => [f, { octets: Buffer.byteLength(c), sha256: createHash('sha256').update(c).digest('hex') }]));
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fabrication.json'), `${JSON.stringify(empreintes, null, 2)}\n`);
  for (const [f, e] of Object.entries(empreintes)) console.log(`${f} : ${(e.octets / 1024).toFixed(1)} Kio`);
}
