// Fabrication des vidéos de l'accueil (lot 2b) : la scène 3D (scene/index.html, cadrage B retenu au lot 1) est rendue IMAGE PAR IMAGE,
// avec un pas de temps fixe (1 / IMAGES_PAR_SECONDE), dans Chromium sans écran (Playwright, rendu logiciel SwiftShader), puis encodée
// par ffmpeg en MP4 H.264 sans piste son, « faststart ». Tout est une fonction du temps de la boucle : une nouvelle exécution redonne
// les mêmes images, donc les mêmes vidéos (empreintes SHA-256 notées dans img/accueil/fabrication.json).
//
// Usage : node outils/video/fabriquer.mjs [--formats=ordinateur,telephone] [--sans-rendu] [--nettoyer]
//   --sans-rendu : réutilise les images déjà rendues (outils/video/rendu/, non suivi par git) pour refaire seulement l'encodage ;
//   --nettoyer   : efface les images rendues à la fin (environ 1 Go).
// Prérequis : Node 18+, Playwright (Chromium) et ffmpeg (avec libx264 et libwebp). Voir outils/video/LISEZMOI.md.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servirCopiePubliee } from '../copie-publiee.mjs';
import { DUREE_BOUCLE, IMAGES_PAR_SECONDE, TEMPS_AFFICHE, TEMPS_TIR, TEMPS_TIRS } from '../../js/accueil-boucle.js';

const require = createRequire(import.meta.url);
const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..', '..');
const SORTIE = join(RACINE, 'img', 'accueil');
const RENDU = join(ICI, 'rendu');

// Les deux versions de la boucle (cadrages validés au lot 1 : B paysage pour l'ordinateur, B portrait pour le téléphone).
export const FORMATS = {
  ordinateur: { scene: 'paysage', largeur: 1920, hauteur: 1080, fichier: 'accueil-16x9' },
  telephone: { scene: 'portrait', largeur: 1080, hauteur: 1920, fichier: 'accueil-9x16' },
};

// Encodage : H.264 High 4.0 (lisible partout, iPhone compris), 4:2:0, deux passes à débit visé (environ 3 Mo pour 8 s), une image clé
// toutes les 2 s (rotation de l'écran : reprise rapide au même instant), sans piste son, métadonnées retirées, sortie bit à bit stable.
const DEBIT = '2600k';
const DEBIT_MAX = '4200k';
const TAMPON = '5200k';
const QUALITE_AFFICHE = 78; // WebP (0 à 100)

const args = new Map(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const choisis = String(args.get('formats') ?? Object.keys(FORMATS).join(',')).split(',').filter((f) => FORMATS[f]);
const IMAGES = Math.round(DUREE_BOUCLE * IMAGES_PAR_SECONDE); // exactement un tour : t = 0 … DUREE − 1 image (la dernière n'est pas la première)
const nom = (k) => `${String(k).padStart(4, '0')}.png`;

async function rendre(base, format) {
  const { chromium } = require('playwright');
  const f = FORMATS[format];
  const dossier = join(RENDU, format);
  rmSync(dossier, { recursive: true, force: true });
  mkdirSync(dossier, { recursive: true });
  const navigateur = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await navigateur.newPage({ viewport: { width: 1280, height: 720 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) erreurs.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${base}scene/index.html?cadrage=B&format=${f.scene}&capture=1&w=${f.largeur}&h=${f.hauteur}&t=0`);
  await page.waitForFunction(() => window.__scene?.ready || window.__sceneError, null, { timeout: 300000 });
  const info = await page.evaluate(() => (window.__sceneError ? { erreur: window.__sceneError } : window.__scene.info()));
  if (info.erreur) throw new Error(`scène : ${info.erreur}`);
  if (info.duree !== DUREE_BOUCLE) throw new Error(`durée de la scène ${info.duree} s ≠ ${DUREE_BOUCLE} s`);
  if (info.taille[0] !== f.largeur || info.taille[1] !== f.hauteur) throw new Error(`taille ${info.taille} ≠ ${f.largeur}×${f.hauteur}`);
  const debut = Date.now();
  for (let k = 0; k < IMAGES; k += 1) {
    // Pas de temps fixe : l'image k montre l'instant k / IMAGES_PAR_SECONDE, quel que soit le temps de calcul.
    const png = await page.evaluate((t) => { window.__scene.rendre(t); return document.getElementById('toile').toDataURL('image/png'); }, k / IMAGES_PAR_SECONDE);
    writeFileSync(join(dossier, nom(k)), Buffer.from(png.slice(png.indexOf(',') + 1), 'base64'));
    if (k % 30 === 29) console.log(`${format} : ${k + 1}/${IMAGES} images (${((Date.now() - debut) / 1000).toFixed(0)} s)`);
  }
  await navigateur.close();
  if (erreurs.length) throw new Error(`${format} : ${erreurs.join(' | ')}`);
}

function encoder(format) {
  const f = FORMATS[format];
  const dossier = join(RENDU, format);
  const n = readdirSync(dossier).filter((x) => x.endsWith('.png')).length;
  if (n !== IMAGES) throw new Error(`${format} : ${n} images rendues, ${IMAGES} attendues (relancer sans --sans-rendu)`);
  mkdirSync(SORTIE, { recursive: true });
  const mp4 = join(SORTIE, `${f.fichier}.mp4`);
  const journal = join(RENDU, `${format}-passe`);
  const commun = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-framerate', String(IMAGES_PAR_SECONDE), '-i', join(dossier, '%04d.png'),
    '-an', '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'film', '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
    '-b:v', DEBIT, '-maxrate', DEBIT_MAX, '-bufsize', TAMPON,
    '-g', String(IMAGES_PAR_SECONDE * 2), '-keyint_min', String(IMAGES_PAR_SECONDE * 2), '-sc_threshold', '0',
    '-threads', '1', '-x264-params', 'deterministic=1',
    '-passlogfile', journal, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact',
  ];
  execFileSync('ffmpeg', [...commun, '-pass', '1', '-f', 'mp4', '/dev/null']);
  execFileSync('ffmpeg', [...commun, '-pass', '2', '-movflags', '+faststart', mp4]);
  // Affiche : l'image de TEMPS_AFFICHE (scène lisible, bras du zombie tendu, loin de l'éclair du tir).
  const k = Math.round(TEMPS_AFFICHE * IMAGES_PAR_SECONDE);
  const webp = join(SORTIE, `${f.fichier}.webp`);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', join(dossier, nom(k)), '-c:v', 'libwebp', '-quality', String(QUALITE_AFFICHE),
    '-compression_level', '6', '-preset', 'picture', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact', webp]);
  return [mp4, webp];
}

const empreinte = (fichier) => createHash('sha256').update(readFileSync(fichier)).digest('hex');

if (TEMPS_TIRS.some((t) => Math.abs(TEMPS_AFFICHE - t) < 0.6)) throw new Error('TEMPS_AFFICHE trop près d\'un tir');
if (!args.get('sans-rendu')) {
  const serveur = await servirCopiePubliee();
  try {
    await Promise.all(choisis.map((format) => rendre(serveur.base, format))); // les deux formats en même temps (un Chromium chacun)
  } finally {
    serveur.fermer();
  }
}
const fichiers = choisis.flatMap(encoder);
const manifeste = join(SORTIE, 'fabrication.json');
const ancien = existsSync(manifeste) ? JSON.parse(readFileSync(manifeste, 'utf8')) : { fichiers: {} };
const fiche = {
  _note: 'Écrit par outils/video/fabriquer.mjs (lot 2b). Une nouvelle exécution doit redonner les mêmes empreintes.',
  boucle: { duree: DUREE_BOUCLE, imagesParSeconde: IMAGES_PAR_SECONDE, images: IMAGES, tempsTir: TEMPS_TIR, tempsTirs: TEMPS_TIRS, tempsAffiche: TEMPS_AFFICHE },
  encodage: { codec: 'H.264 High 4.0, yuv420p, deux passes', debit: DEBIT, debitMax: DEBIT_MAX, imageCle: `${2} s`, son: 'aucun', faststart: true, afficheWebp: QUALITE_AFFICHE },
  formats: FORMATS,
  fichiers: { ...ancien.fichiers },
};
for (const f of fichiers) {
  fiche.fichiers[relative(SORTIE, f)] = { octets: statSync(f).size, sha256: empreinte(f) };
  console.log(`${relative(RACINE, f)} : ${(statSync(f).size / 1024 / 1024).toFixed(2)} Mo`);
}
writeFileSync(manifeste, `${JSON.stringify(fiche, null, 2)}\n`);
if (args.get('nettoyer')) rmSync(RENDU, { recursive: true, force: true });
