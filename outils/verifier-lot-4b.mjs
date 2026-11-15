// Vérification du lot 4b (clip du jeu dans À propos) : node outils/verifier-lot-4b.mjs [--en-ligne] [--sous-dossier]
// - fichiers : img/a-propos/jeu-clip.mp4 (H.264, 800 × 450, 30 im/s, 8 s, sans son, index en tête, moins de 1 Mio) et son affiche WebP ;
//   raccord de la boucle (dernière image → première) du même ordre que les plus grands passages d'image naturels du clip ;
// - site (copie exacte de ce que publie pages.yml, servie à la racine ; ou https://zsurvival-game.com/ avec --en-ligne), 375 × 667 et
//   1440 × 900 : rien de la vidéo n'est téléchargé avant l'arrivée sur À propos ; elle joue quand le bloc est visible, sur son affiche,
//   dans le cadre rouge ; elle se met en pause quand on quitte la section ; mouvement réduit : affiche seule, aucune requête vidéo ;
//   aucune erreur console, aucun fichier manquant.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servirCopiePubliee, simulerActualites } from './copie-publiee.mjs';
import { TEXTES } from '../js/textes.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const EN_LIGNE = process.argv.includes('--en-ligne');
let reussites = 0;
let echecs = 0;
const verifier = (ok, message) => { if (ok) reussites += 1; else echecs += 1; console.log(`${ok ? '  ok ' : '  ÉCHEC'} ${message}`); };

// ---------- Fichiers ----------
console.log('Fichiers');
const MP4 = join(RACINE, 'img/a-propos/jeu-clip.mp4');
const WEBP = join(RACINE, 'img/a-propos/jeu-clip.webp');
const sonde = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', MP4]).toString());
const flux = sonde.streams;
const v = flux.find((s) => s.codec_type === 'video');
verifier(flux.length === 1 && v.codec_name === 'h264' && v.profile === 'High' && v.pix_fmt === 'yuv420p', `une seule piste, vidéo H.264 High yuv420p (${flux.map((s) => s.codec_type).join(', ')})`);
verifier(v.width === 800 && v.height === 450 && v.r_frame_rate === '30/1' && Number(v.nb_frames) === 240 && Math.abs(Number(sonde.format.duration) - 8) < 0.01,
  `800 × 450, 30 im/s, 240 images, ${Number(sonde.format.duration).toFixed(2)} s`);
const octets = readFileSync(MP4);
verifier(octets.indexOf('moov') > 0 && octets.indexOf('moov') < octets.indexOf('mdat'), 'index en tête de fichier (faststart) : la lecture démarre avant la fin du téléchargement');
verifier(statSync(MP4).size < 1024 * 1024, `moins de 1 Mio (${(statSync(MP4).size / 1024).toFixed(0)} Kio)`);
const affiche = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', WEBP]).toString()).streams[0];
verifier(affiche.codec_name === 'webp' && affiche.width === 800 && affiche.height === 450, `affiche WebP 800 × 450 (${(statSync(WEBP).size / 1024).toFixed(0)} Kio)`);
{
  // Écart moyen entre images voisines (luminance, 0 à 255), sur la vidéo décodée ; le raccord 239 → 0 comparé à la médiane.
  const brut = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', MP4, '-vf', 'scale=200:112,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 64 * 1024 * 1024 });
  const taille = 200 * 112;
  const image = (i) => brut.subarray(i * taille, (i + 1) * taille);
  const ecart = (a, b) => { let s = 0; for (let i = 0; i < taille; i += 1) s += Math.abs(a[i] - b[i]); return s / taille; };
  const voisins = Array.from({ length: 239 }, (_, i) => ecart(image(i), image(i + 1))).sort((a, b) => a - b);
  const mediane = voisins[119];
  const raccord = ecart(image(239), image(0));
  // Le raccord est un vrai passage d'image du jeu (fondu de 0,5 s avant lui). Sur les images avant encodage, il n'est pas plus marqué que le
  // plus grand passage naturel du clip (un tir, un zombie qui tombe, un pivot de la visée). Dans la vidéo, la compression ajoute un peu de
  // bruit au raccord : entre images voisines ses erreurs se ressemblent et s'annulent, entre la dernière et la première elles s'ajoutent
  // (moins d'un niveau de gris en moyenne, invisible). Tolérance : 1,3 fois le plus grand passage naturel.
  const plusGrand = voisins.at(-1);
  verifier(raccord <= plusGrand * 1.3, `raccord de la boucle : ${raccord.toFixed(2)}, du même ordre que les passages d’image du clip (médiane ${mediane.toFixed(2)}, plus grand ${plusGrand.toFixed(2)})`);
}

// ---------- Site ----------
let base = 'https://zsurvival-game.com/';
let copie = null;
if (!EN_LIGNE) {
  copie = await servirCopiePubliee();
  base = copie.base;
}
const navigateur = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
for (const [l, h] of [[375, 667], [1440, 900]]) {
  for (const reduit of [false, true]) {
    console.log(`Site ${l} × ${h}${reduit ? ', mouvement réduit' : ''}`);
    const contexte = await navigateur.newContext({ viewport: { width: l, height: h }, reducedMotion: reduit ? 'reduce' : 'no-preference' });
    const page = await contexte.newPage();
    if (copie) await simulerActualites(page);
    const requetesClip = [];
    const erreurs = [];
    page.on('request', (r) => { if (/jeu-clip\.mp4/.test(r.url())) requetesClip.push(r.url()); });
    page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
    page.on('pageerror', (e) => erreurs.push(e.message));
    page.on('response', (r) => { if (r.status() >= 400) erreurs.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${base}?lang=fr`);
    await page.waitForTimeout(1500);
    verifier(requetesClip.length === 0, 'accueil : aucune requête vers le clip avant d’arriver sur À propos');
    await page.evaluate(() => { location.hash = '#about'; });
    await page.waitForTimeout(400);
    // La section À propos peut dépasser l'écran (téléphone) : on amène le bloc du jeu à l'écran.
    await page.evaluate(() => document.querySelector('.about-jeu-media').scrollIntoView({ block: 'center' }));
    const etat = async () => page.evaluate(() => {
      const vid = document.querySelector('.about-jeu-clip');
      const img = document.querySelector('.about-jeu-image');
      const cadre = document.querySelector('.about-jeu-media').getBoundingClientRect();
      const r = vid.getBoundingClientRect();
      return { src: vid.getAttribute('src'), lue: vid.classList.contains('est-lue'), enPause: vid.paused, temps: vid.currentTime, opacite: getComputedStyle(vid).opacity,
        afficheOk: img.complete && img.naturalWidth === 800, alt: img.alt, recouvre: Math.abs(r.width - cadre.width + 4) < 1.5 && Math.abs(r.left - cadre.left - 2) < 1.5,
        bordure: getComputedStyle(document.querySelector('.about-jeu-media')).borderTopColor };
    });
    if (!reduit) {
      await page.waitForFunction(() => document.querySelector('.about-jeu-clip').classList.contains('est-lue'), null, { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const e = await etat();
      verifier(e.src === 'img/a-propos/jeu-clip.mp4' && requetesClip.length >= 1, `À propos : source du clip posée à l’arrivée (${requetesClip.length} requête(s))`);
      verifier(e.lue && !e.enPause && e.temps > 0.3 && e.opacite === '1', `le clip joue, visible (temps ${e.temps.toFixed(2)} s)`);
      verifier(e.afficheOk && e.recouvre && e.bordure === 'rgb(216, 20, 20)', 'sur son affiche, dans le cadre rouge (même taille)');
      verifier(e.alt === TEXTES.fr.about.jeu.imageAlt, 'texte de remplacement de l’image (js/textes.js)');
      await page.evaluate(() => { location.hash = '#news'; });
      await page.waitForTimeout(1500);
      verifier((await etat()).enPause, 'section quittée : le clip se met en pause');
    } else {
      await page.waitForTimeout(1500);
      const e = await etat();
      verifier(!e.src && requetesClip.length === 0 && e.afficheOk && e.opacite === '0', 'mouvement réduit : affiche seule, aucune requête vidéo');
    }
    verifier(!erreurs.length, `aucune erreur console, aucun fichier manquant${erreurs.length ? ` — ${erreurs.slice(0, 4).join(' | ')}` : ''}`);
    await contexte.close();
  }
}
await navigateur.close();
copie?.fermer();
console.log(`\n${reussites} réussies, ${echecs} en échec.`);
process.exit(echecs ? 1 : 0);
