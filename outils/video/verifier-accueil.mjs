// Vérification de l'accueil du lot 2b (Playwright, Chromium) : node outils/video/verifier-accueil.mjs [--en-ligne] [--captures=DOSSIER]
// Sur une copie exacte de ce que publie .github/workflows/pages.yml, servie sous /Z-Survival-Website/ (ou, avec --en-ligne, sur
// https://nowyyy.github.io/Z-Survival-Website/) : téléphone 375 × 667 et 320 × 568, téléphone en paysage 667 × 375, ordinateur 1440 × 900,
// chacun avec et sans prefers-reduced-motion.
// - la bonne vidéo selon la forme de l'écran, et le changement quand on tourne l'écran ; mouvement réduit : aucune requête vidéo ni son,
//   affiche visible ; ni Three.js ni rien de scene/ ;
// - tir à 5,2 s (tolérance 0,1 s) : flash du cadre (220 ms) ; retour au début repéré ; aucun double ;
// - coup de feu : jamais sans le son activé, présent avec le son activé, absent onglet caché ;
// - entrée : première visite de la session seulement, 1,5 s au plus, passable d'un clic, forcée par ?intro=1 ;
// - encart « Disponible sur navigateur » en bas à gauche, traduit, sans chevauchement ; HUD du lot 2b retiré ; logo du studio agrandi ;
//   bouton vivant (survol, toucher, coulure de temps en temps) ;
// - raccord de la boucle (dernière image → première, sur les vidéos décodées par ffmpeg) ; aucune erreur console, aucun fichier manquant.
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servirCopiePubliee } from '../copie-publiee.mjs';
import { DUREE_BOUCLE, IMAGES_PAR_SECONDE, TEMPS_AFFICHE, TEMPS_TIR } from '../../js/accueil-boucle.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const CAPTURES = args.captures || join(tmpdir(), 'accueil-captures');
mkdirSync(CAPTURES, { recursive: true });

let echecs = 0;
let reussites = 0;
const verifier = (ok, texte) => {
  if (ok) reussites += 1; else echecs += 1;
  console.log(`${ok ? '  ok ' : 'ÉCHEC'} ${texte}`);
};

let base = 'https://nowyyy.github.io/Z-Survival-Website/';
let copie = null;
if (!args['en-ligne']) {
  copie = await servirCopiePubliee();
  base = copie.base;
  console.log(`Copie publiée (${copie.commande}) servie sous ${base}`);
}
const navigateur = await chromium.launch();

// Journal posé avant tout script de la page : entrée (classe entree-accueil posée / retirée), première lecture de la vidéo, et chaque
// « zs:tir » / « zs:tour » (lu après les écouteurs du site : instant de l'image, flash du cadre).
const SCRIPT_JOURNAL = () => {
  window.__entree = { posee: null, retiree: null };
  window.__releve = [];
  window.__premiereLecture = null;
  const voir = () => {
    const html = document.documentElement;
    if (!html) return;
    const a = html.classList.contains('entree-accueil');
    if (a && window.__entree.posee === null) window.__entree.posee = performance.now();
    if (!a && window.__entree.posee !== null && window.__entree.retiree === null) window.__entree.retiree = performance.now();
  };
  new MutationObserver(voir).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  document.addEventListener('playing', (e) => { if (window.__premiereLecture === null) window.__premiereLecture = e.target.currentTime; }, true);
  const noter = (nom) => (e) => queueMicrotask(() => {
    const section = document.getElementById('accueil');
    const cadre = section.querySelector('.accueil-scene');
    window.__releve.push({
      nom,
      temps: e.detail?.temps ?? null,
      flash: section.classList.contains('est-tir'),
      dureeFlash: getComputedStyle(cadre, '::after').animationDuration,
      animFlash: getComputedStyle(cadre, '::after').animationName,
    });
  });
  document.addEventListener('zs:tir', noter('tir'));
  document.addEventListener('zs:tour', noter('tour'));
};

async function ouvrir(contexte, adresse = base) {
  const page = await contexte.newPage();
  const journal = { erreurs: [], manquants: [], requetes: [] };
  page.on('console', (m) => { if (m.type() === 'error') journal.erreurs.push(m.text()); });
  page.on('pageerror', (e) => journal.erreurs.push(String(e)));
  page.on('requestfailed', (r) => { if (!/net::ERR_ABORTED/.test(r.failure()?.errorText ?? '')) journal.manquants.push(`${r.url()} (${r.failure()?.errorText})`); });
  page.on('response', (r) => { if (r.status() >= 400) journal.manquants.push(`${r.url()} (${r.status()})`); });
  page.on('request', (r) => journal.requetes.push(r.url()));
  await page.addInitScript(SCRIPT_JOURNAL);
  await page.goto(adresse, { waitUntil: 'load' });
  await page.waitForSelector('body.est-pret');
  return { page, journal };
}
const accueil = (page) => page.evaluate(() => window.__zsAccueil.etat());
const musique = (page) => page.evaluate(() => window.__zsMusique.etat());
const video = (page) => page.evaluate(() => {
  const v = document.querySelector('.accueil-video');
  return { src: v.currentSrc || v.getAttribute('src') || '', forme: v.dataset.forme ?? null, lue: v.classList.contains('est-lue'), pause: v.paused, temps: v.currentTime, poster: v.getAttribute('poster') };
});
async function attendre(page, lire, condition, delai = 15000) {
  const fin = Date.now() + delai;
  for (;;) {
    const e = await lire(page);
    if (condition(e) || Date.now() > fin) return e;
    await page.waitForTimeout(40);
  }
}
async function cacherOnglet(page, cache) {
  await page.evaluate((c) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => c });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (c ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, cache);
}
const releve = (page) => page.evaluate(() => window.__releve);

// Encart « Disponible sur navigateur » : en bas à gauche, dans le cadre, sans recouper les logos, les réglages, le titre, l'accroche, le
// bouton ni la flèche ; textes et taille du logo du studio relevés au passage.
function encart(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.accueil-plateforme');
    const r = el.getBoundingClientRect();
    const W = document.documentElement.clientWidth; const H = document.documentElement.clientHeight;
    const coupe = (a, b) => a.right > b.left + 0.5 && b.right > a.left + 0.5 && a.bottom > b.top + 0.5 && b.bottom > a.top + 0.5;
    const fautes = [];
    if (r.left < 8 || r.bottom > H - 8 || r.right > W - 8 || r.width === 0) fautes.push('hors du cadre');
    if (r.left > W / 2 || r.top < H / 2) fautes.push('pas en bas à gauche');
    for (const sel of ['.accueil-studio', '.accueil-reglages', '.accueil-titre', '.accueil-sous-titre', '.accueil-entrer', '.accueil-fleche']) {
      if (coupe(r, document.querySelector(sel).getBoundingClientRect())) fautes.push(`sur ${sel}`);
    }
    return {
      fautes,
      texte: el.textContent.replace(/\s+/g, ' ').trim(),
      taille: `${Math.round(r.width)} × ${Math.round(r.height)}`,
      logo: Math.round(document.querySelector('.accueil-studio').getBoundingClientRect().width),
      hud: document.querySelectorAll('.accueil-hud, [data-hud]').length,
    };
  });
}

const CAS = [
  { nom: 'téléphone 375 × 667', court: 'tel-375', vp: { width: 375, height: 667 }, mobile: true, forme: 'portrait', complet: true },
  { nom: 'téléphone 320 × 568', court: 'tel-320', vp: { width: 320, height: 568 }, mobile: true, forme: 'portrait' },
  { nom: 'téléphone en paysage 667 × 375', court: 'tel-paysage', vp: { width: 667, height: 375 }, mobile: true, forme: 'paysage' },
  { nom: 'ordinateur 1440 × 900', court: 'ordi', vp: { width: 1440, height: 900 }, mobile: false, forme: 'paysage', complet: true },
];
const FICHIER = { portrait: 'accueil-9x16', paysage: 'accueil-16x9' };
const options = (cas, reduit) => ({
  viewport: cas.vp, locale: 'fr-FR', reducedMotion: reduit ? 'reduce' : 'no-preference',
  ...(cas.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
});
const SANS_ATELIER = (requetes) => requetes.filter((u) => /\/scene\/|three/i.test(u));

for (const cas of CAS) {
  for (const reduit of [false, true]) {
    console.log(`\n${cas.nom}${reduit ? ', mouvement réduit' : ''}`);
    const contexte = await navigateur.newContext(options(cas, reduit));
    const { page, journal } = await ouvrir(contexte);
    const mp4 = () => journal.requetes.filter((u) => u.endsWith('.mp4'));
    const sons = () => journal.requetes.filter((u) => u.includes('/sons/'));

    if (!reduit) {
      // Entrée en scène : première visite de la session, 1,5 s au plus.
      await page.waitForFunction(() => window.__entree.retiree !== null, null, { timeout: 4000 }).catch(() => {});
      const en = await page.evaluate(() => window.__entree);
      const duree = en.retiree !== null && en.posee !== null ? en.retiree - en.posee : null;
      verifier(en.posee !== null && duree !== null && duree <= 1600, `entrée jouée à la première visite, finie en ${duree === null ? '?' : Math.round(duree)} ms (≤ 1 500 ms + marge)`);

      // Vidéo : la bonne version, qui joue, à partir de l'instant de l'affiche.
      const v = await attendre(page, video, (x) => x.lue && !x.pause);
      verifier(v.lue && !v.pause, `vidéo en lecture, visible (est-lue) — ${v.src.split('/').pop()}`);
      verifier(v.src.endsWith(`${FICHIER[cas.forme]}.mp4`) && v.forme === cas.forme, `version ${cas.forme} chargée (${FICHIER[cas.forme]}.mp4)`);
      verifier(v.poster?.endsWith(`${FICHIER[cas.forme]}.webp`), `affiche en poster : ${v.poster}`);
      verifier(mp4().every((u) => u.endsWith(`${FICHIER[cas.forme]}.mp4`)), `aucune autre vidéo téléchargée (${[...new Set(mp4().map((u) => u.split('/').pop()))].join(', ')})`);
      const depart = await page.evaluate(() => window.__premiereLecture);
      verifier(Math.abs(depart - TEMPS_AFFICHE) < 0.1, `lecture partie de l'instant de l'affiche (${TEMPS_AFFICHE} s) : ${depart?.toFixed(2)} s`);

      // Premier tir.
      let r = await attendre(page, releve, (x) => x.some((e) => e.nom === 'tir'), 9000);
      const tir1 = r.find((e) => e.nom === 'tir');
      verifier(Boolean(tir1) && Math.abs(tir1.temps - TEMPS_TIR) <= 0.1, `tir à ${tir1 ? tir1.temps.toFixed(3) : '?'} s (attendu ${TEMPS_TIR} s ± 0,1)`);
      verifier(tir1?.flash && tir1.animFlash === 'cadre-tir' && tir1.dureeFlash === '0.22s', `flash du cadre au tir (animation ${tir1?.animFlash}, ${tir1?.dureeFlash})`);
      await page.screenshot({ path: join(CAPTURES, `${cas.court}-tir.png`) });
      const m0 = await musique(page);
      verifier(m0.tirsJoues === 0 && sons().length === 0, `son coupé : aucun coup de feu joué, aucun fichier son téléchargé (${m0.tirsJoues}, ${sons().length})`);

      if (cas.complet) {
        // Tour suivant (retour au début repéré) ; second tir, aucun double.
        r = await attendre(page, releve, (x) => x.filter((e) => e.nom === 'tir').length >= 2, 10000);
        const tour = r.find((e) => e.nom === 'tour');
        verifier(Boolean(tour) && tour.temps < 0.5, `retour au début de la boucle repéré (${tour?.temps?.toFixed(3)} s)`);
        const ordre = r.map((e) => e.nom).join(' → ');
        verifier(ordre === 'tir → tour → tir', `un seul tir par tour : ${ordre}`);
        const tir2 = r.filter((e) => e.nom === 'tir')[1];
        verifier(Boolean(tir2) && Math.abs(tir2.temps - TEMPS_TIR) <= 0.1 && tir2.flash, `second tir à ${tir2?.temps.toFixed(3)} s, avec flash`);
        const a = await accueil(page);
        verifier(a.tirs === 2 && a.tours === 1, `compteurs : ${a.tirs} tirs, ${a.tours} tour (suivi : ${a.suivi})`);

        // Son activé : coup de feu au tir suivant (fichier chargé à l'activation seulement).
        await page.click('.accueil-reglages [data-son]');
        let m = await attendre(page, musique, (x) => x.etat === 'lecture' && x.tirCharge, 8000);
        verifier(m.etat === 'lecture' && m.tirCharge && sons().length === 1, `son activé : coup de feu chargé une fois (${sons().map((u) => u.split('/').pop()).join(', ')})`);
        const avant = m.tirsJoues;
        m = await attendre(page, musique, (x) => x.tirsJoues > avant, 10000);
        verifier(m.tirsJoues === avant + 1, `coup de feu joué au tir (${m.tirsJoues - avant}), volume ${m.volumeTir}`);

        // Onglet caché : vidéo en pause, aucun coup de feu (ni par la vidéo, ni par un tir reçu malgré tout).
        await cacherOnglet(page, true);
        await page.waitForTimeout(300);
        const vc = await video(page);
        verifier(vc.pause, 'onglet caché : vidéo en pause');
        await page.evaluate(() => document.dispatchEvent(new CustomEvent('zs:tir', { detail: { temps: 5.2 } })));
        await page.waitForTimeout(200);
        const mc = await musique(page);
        verifier(mc.tirsJoues === m.tirsJoues, `onglet caché : aucun coup de feu (${mc.tirsJoues - m.tirsJoues})`);
        await cacherOnglet(page, false);
        const vr = await attendre(page, video, (x) => !x.pause, 4000);
        verifier(!vr.pause, 'onglet revenu : la vidéo reprend');
        await page.click('.accueil-reglages [data-son]'); // son coupé
        await page.waitForTimeout(700);
      }

      if (cas.court === 'tel-375') {
        // Rotation : 375 × 667 → 667 × 375, version 16:9, même instant de la boucle, tir suivant toujours unique.
        const t0 = (await video(page)).temps;
        const tirsAvant = (await accueil(page)).tirs;
        await page.setViewportSize({ width: 667, height: 375 });
        const vt = await attendre(page, video, (x) => x.forme === 'paysage' && x.lue && !x.pause, 10000);
        verifier(vt.src.endsWith('accueil-16x9.mp4') && vt.lue, `écran tourné : version 16:9 chargée et lue (${vt.src.split('/').pop()})`);
        const ecart = ((vt.temps - t0) % DUREE_BOUCLE + DUREE_BOUCLE) % DUREE_BOUCLE;
        verifier(ecart < 2, `reprise au même instant de la boucle (${t0.toFixed(2)} s → ${vt.temps.toFixed(2)} s)`);
        await attendre(page, accueil, (x) => x.tirs > tirsAvant, 10000);
        await page.waitForTimeout(400);
        const ar = await accueil(page);
        verifier(ar.tirs === tirsAvant + 1, `après la rotation : un seul tir de plus (${ar.tirs - tirsAvant})`);
        const er = await encart(page);
        verifier(er.fautes.length === 0, `encart après rotation : en bas à gauche, aucun chevauchement${er.fautes.length ? ` (${er.fautes.join(', ')})` : ''}`);
        await page.setViewportSize(cas.vp);
        await page.waitForTimeout(500);
      }

      // Bouton vivant : coulure de temps en temps ; survol (ordinateur) ou toucher (téléphone).
      const repos = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('.entrer-coulure')); return `${c.animationName} ${c.animationDuration}`; });
      verifier(repos === 'coulure-repos 7s', `petite coulure toutes les 7 s (${repos})`);
      if (cas.mobile) {
        const b = await page.$('.accueil-entrer');
        const bb = await b.boundingBox();
        const promesse = page.evaluate(() => new Promise((ok) => {
          const el = document.querySelector('.accueil-entrer');
          el.addEventListener('pointerdown', () => requestAnimationFrame(() => ok({ classe: el.classList.contains('est-touche'), anim: getComputedStyle(el.querySelector('.entrer-coulure')).animationName, pinceau: getComputedStyle(el.querySelector('.entrer-pinceau')).clipPath })), { once: true });
          setTimeout(() => ok(null), 3000);
        }));
        await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
        const t = await promesse;
        verifier(t?.classe && t.anim === 'coulure-vive', `toucher du bouton : coup de pinceau et coulure (${t?.anim})`);
        await page.waitForFunction(() => document.body.dataset.section === 'news', null, { timeout: 5000 }).catch(() => {});
        verifier(await page.evaluate(() => document.body.dataset.section) === 'news', 'le toucher descend vers News');
        await page.waitForTimeout(800);
        verifier((await video(page)).pause, 'accueil quitté : vidéo en pause');
      } else {
        await page.hover('.accueil-entrer');
        await page.waitForTimeout(450);
        const h = await page.evaluate(() => ({ anim: getComputedStyle(document.querySelector('.entrer-coulure')).animationName, pinceau: getComputedStyle(document.querySelector('.entrer-pinceau')).clipPath }));
        verifier(h.anim === 'coulure-vive' && h.pinceau.includes('-10%'), `survol du bouton : coup de pinceau (${h.pinceau}) et coulure (${h.anim})`);
        await page.screenshot({ path: join(CAPTURES, `${cas.court}-survol.png`) });
        await page.mouse.move(5, 5);
      }

      // Même onglet (sessionStorage : la session est celle de l'onglet), nouvelle ouverture : pas d'entrée ; ?intro=1 la force ; un clic
      // la passe.
      await page.goto(base, { waitUntil: 'load' });
      await page.waitForSelector('body.est-pret');
      verifier(await page.evaluate(() => window.__entree.posee === null), 'nouvelle ouverture dans la même session (même onglet) : pas d’entrée');
      await page.goto(`${base}?intro=1`, { waitUntil: 'load' });
      await page.waitForSelector('body.est-pret');
      const forcee = await page.evaluate(() => window.__entree.posee !== null && document.documentElement.classList.contains('entree-accueil'));
      await page.mouse.click(Math.round(cas.vp.width / 2), 60);
      await page.waitForTimeout(60);
      const passee = await page.evaluate(() => ({ classe: document.documentElement.classList.contains('entree-accueil'), etat: document.documentElement.dataset.entree, apres: window.__entree.retiree - window.__entree.posee }));
      verifier(forcee && !passee.classe && passee.etat === 'passee' && passee.apres < 1400, `?intro=1 force l'entrée ; un clic la passe (après ${Math.round(passee.apres)} ms)`);
      const autre = await ouvrir(contexte);
      verifier(await autre.page.evaluate(() => window.__entree.posee !== null), 'nouvel onglet (nouvelle session) : entrée jouée');
      await autre.page.close();
    } else {
      // Mouvement réduit : affiche seule, aucune vidéo ni son téléchargés, aucun tir, pas d'entrée.
      await page.waitForTimeout(TEMPS_TIR * 1000 - TEMPS_AFFICHE * 1000 + 1500);
      const aff = await page.evaluate(() => {
        const img = document.querySelector('.accueil-affiche img');
        const r = img.getBoundingClientRect();
        return { charge: img.complete && img.naturalWidth > 0, src: img.currentSrc, visible: r.width > 0 && r.height > 0 && getComputedStyle(img).visibility !== 'hidden', videoAffichee: getComputedStyle(document.querySelector('.accueil-video')).display };
      });
      verifier(aff.charge && aff.visible && aff.src.endsWith(`${FICHIER[cas.forme]}.webp`), `affiche visible : ${aff.src.split('/').pop()}`);
      verifier(aff.videoAffichee === 'none' && (await video(page)).src === '', 'vidéo sans source et masquée');
      await page.click('.accueil-reglages [data-son]'); // musique activée : la musique se charge, jamais le coup de feu
      await page.waitForTimeout(1500);
      verifier(mp4().length === 0 && sons().length === 0, `aucune requête vidéo ni son de tir (${mp4().length + sons().length}), même son activé`);
      const a = await accueil(page);
      verifier(a.tirs === 0, `aucun tir (${a.tirs})`);
      verifier(await page.evaluate(() => window.__entree.posee === null), 'aucune entrée en scène');
      const coulure = await page.evaluate(() => getComputedStyle(document.querySelector('.entrer-coulure')).display);
      verifier(coulure === 'none', 'bouton : pas de coulure');
      await page.click('.accueil-reglages [data-son]');
    }

    // Pour tous : encart en bas à gauche, en français puis en anglais, sans chevauchement ; HUD retiré ; logo du studio agrandi ;
    // ni Three.js ni scene/, aucune erreur.
    const LOGO = cas.vp.width >= 900 ? 112 : 76;
    for (const [l, attendu] of [['fr', 'Disponible sur Navigateur'], ['en', 'Available on the Web']]) {
      const pe = await ouvrir(contexte, `${base}?lang=${l}`);
      await pe.page.waitForTimeout(1800);
      const e = await encart(pe.page);
      verifier(e.fautes.length === 0 && e.texte === attendu, `encart (${l}) « ${e.texte} », ${e.taille} px, en bas à gauche, aucun chevauchement${e.fautes.length ? ` (${e.fautes.join(', ')})` : ''}`);
      if (l === 'fr') {
        verifier(e.hud === 0, 'HUD (manche, heure, balles) retiré');
        verifier(e.logo === LOGO, `logo du studio : ${e.logo} px de large (attendu ${LOGO})`);
        await pe.page.screenshot({ path: join(CAPTURES, `${cas.court}${reduit ? '-reduit' : ''}.png`) });
      }
      journal.erreurs.push(...pe.journal.erreurs); journal.manquants.push(...pe.journal.manquants); journal.requetes.push(...pe.journal.requetes);
      await pe.page.close();
    }
    verifier(SANS_ATELIER(journal.requetes).length === 0, `ni Three.js ni scene/ chargés${SANS_ATELIER(journal.requetes).length ? ` (${SANS_ATELIER(journal.requetes).join(', ')})` : ''}`);
    verifier(journal.erreurs.length === 0, `aucune erreur console${journal.erreurs.length ? ` (${journal.erreurs.join(' | ')})` : ''}`);
    verifier(journal.manquants.length === 0, `aucun fichier manquant${journal.manquants.length ? ` (${journal.manquants.join(' | ')})` : ''}`);
    await contexte.close();
  }
}
await navigateur.close();
copie?.fermer();

// Raccord de la boucle : sur chaque vidéo décodée (ffmpeg, 480 px de large), écart moyen entre la dernière et la première image, comparé
// aux écarts entre images voisines (tir exclu : il donne un pic attendu).
if (!args['en-ligne']) {
  console.log('\nRaccord de la boucle (vidéos décodées)');
  for (const [nom, l, h] of [['accueil-16x9', 480, 270], ['accueil-9x16', 270, 480]]) {
    const fichier = join(RACINE, 'img', 'accueil', `${nom}.mp4`);
    const brut = execFileSync('ffmpeg', ['-v', 'error', '-i', fichier, '-vf', `scale=${l}:${h}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
    const taille = l * h * 3;
    const n = brut.length / taille;
    const image = (k) => brut.subarray(k * taille, (k + 1) * taille);
    const ecart = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 1) s += Math.abs(a[i] - b[i]); return s / a.length; };
    const pas = [];
    const kTir = Math.round(TEMPS_TIR * IMAGES_PAR_SECONDE);
    for (let k = 1; k < n; k += 1) if (k < kTir - 1 || k > kTir + 4) pas.push(ecart(image(k - 1), image(k)));
    const jonction = ecart(image(n - 1), image(0));
    const tri = [...pas].sort((a, b) => a - b);
    const moyenne = pas.reduce((a, b) => a + b, 0) / pas.length;
    const max = tri.at(-1);
    const sonde = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=codec_name,profile,width,height,nb_read_frames,r_frame_rate,pix_fmt', '-show_entries', 'format=duration', '-of', 'json', fichier], { encoding: 'utf8' }));
    const flux = sonde.streams[0];
    const pistes = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', fichier], { encoding: 'utf8' }).trim().split('\n');
    const octets = statSync(fichier).size;
    verifier(n === DUREE_BOUCLE * IMAGES_PAR_SECONDE && Number(flux.nb_read_frames) === n, `${nom} : ${n} images (${flux.width} × ${flux.height}, ${flux.r_frame_rate} im/s, ${flux.codec_name} ${flux.profile}, ${flux.pix_fmt})`);
    verifier(pistes.length === 1 && pistes[0] === 'video', `${nom} : une seule piste, vidéo (aucun son)`);
    const tete = execFileSync('sh', ['-c', `head -c 4096 "${fichier}" | od -A n -c | tr -d ' \\n' | grep -o moov | head -1`], { encoding: 'utf8' }).trim();
    verifier(tete === 'moov', `${nom} : faststart (index moov en tête de fichier)`);
    verifier(jonction <= max && jonction <= moyenne * 2.5, `${nom} : raccord ${jonction.toFixed(2)} (images voisines : moyenne ${moyenne.toFixed(2)}, max ${max.toFixed(2)})`);
    console.log(`       ${nom}.mp4 : ${(octets / 1024 / 1024).toFixed(2)} Mo`);
  }
}

console.log(`\n${reussites} vérifications réussies, ${echecs} en échec. Captures : ${CAPTURES}`);
process.exit(echecs ? 1 : 0);
