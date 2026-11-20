// Contrôle Playwright de la musique du site (lot 2a) : node outils/musique/verifier-site.mjs [--captures=DOSSIER] [--en-ligne]
// Sur une copie exacte de ce que publie .github/workflows/pages.yml, servie à la racine (--sous-dossier : sous /Z-Survival-Website/) ou, avec --en-ligne, sur
// https://zsurvival-game.com/, au téléphone (375 × 667) et à l'ordinateur (1440 × 900), avec et sans
// prefers-reduced-motion. Règles vérifiées : Docs/ref/musique.md (partie 2).
// - aucune requête vers musique/ (M2.mp3, boucles.json) avant le premier clic ; au chargement : coupée, icône barrée, aucun contexte audio ;
// - clic : état « chargement » (téléchargement ralenti exprès), puis lecture (contexte en marche, gain qui monte jusqu'au volume) ;
// - second clic : descente puis contexte suspendu ; nouveau clic : reprise sans nouveau téléchargement ;
// - boutons de l'accueil et de l'en-tête synchronisés, intitulés en français et en anglais ; zone de clic ≥ 44 × 44 px ;
// - choix gardé dans le navigateur, mais rechargement = toujours coupée, aucun téléchargement ;
// - onglet caché puis revenu : pause puis reprise si elle jouait, rien si elle était coupée ;
// - animation des ondes coupée en mouvement réduit ; en-tête et haut de l'accueil (« Bientôt disponible », son, globe) sans
//   chevauchement (320 à 1440 px) ;
// - boucle : lecture Web Audio rendue hors ligne autour du point de boucle, sans blanc ni saut (méthode du lot 1b) ;
// - aucune erreur console, aucun fichier manquant ; reste du site : navigation, clavier, langues, défilement par sections.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { servirCopiePubliee, simulerActualites } from '../copie-publiee.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const CAPTURES = args.captures || join(tmpdir(), 'musique-site-captures');
mkdirSync(CAPTURES, { recursive: true });

let echecs = 0;
let reussites = 0;
const verifier = (ok, texte) => {
  if (ok) reussites += 1; else echecs += 1;
  console.log(`${ok ? '  ok ' : 'ÉCHEC'} ${texte}`);
};

let base = 'https://zsurvival-game.com/';
let copie = null;
if (!args['en-ligne']) {
  copie = await servirCopiePubliee();
  base = copie.base;
  console.log(`Copie publiée (${copie.commande}) servie sous ${base}`);
}

const navigateur = await chromium.launch();
const attente = (ms) => new Promise((ok) => { setTimeout(ok, ms); });

async function ouvrir(options) {
  const contexte = await navigateur.newContext(options);
  if (copie) await simulerActualites(contexte); // lot 3b : serveur des actualités simulé en local (aucun article)
  const page = await contexte.newPage();
  const journal = { erreurs: [], manquants: [], musique: [] };
  page.on('console', (m) => { if (m.type() === 'error') journal.erreurs.push(m.text()); });
  page.on('pageerror', (e) => journal.erreurs.push(String(e)));
  page.on('requestfailed', (r) => { if (!/net::ERR_ABORTED/.test(r.failure()?.errorText ?? '')) journal.manquants.push(`${r.url()} (${r.failure()?.errorText})`); });
  page.on('response', (r) => { if (r.status() >= 400) journal.manquants.push(`${r.url()} (${r.status()})`); });
  page.on('request', (r) => { if (r.url().includes('/musique/')) journal.musique.push(r.url().split('/musique/')[1]); });
  // Téléchargement du MP3 ralenti, pour voir l'état « chargement ».
  await page.route('**/musique/M2.mp3', async (route) => { await attente(800); await route.continue(); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('body.est-pret');
  return { contexte, page, journal };
}
const etat = (page) => page.evaluate(() => window.__zsMusique.etat());
async function attendre(page, condition, delai = 15000) {
  const fin = Date.now() + delai;
  for (;;) {
    const e = await etat(page);
    if (condition(e) || Date.now() > fin) return e;
    await page.waitForTimeout(50);
  }
}
const boutons = (page) => page.$$eval('[data-son]', (bs) => bs.map((b) => ({
  zone: b.closest('.entete') ? 'en-tête' : 'accueil', etat: b.dataset.etat, presse: b.getAttribute('aria-pressed'), intitule: b.getAttribute('aria-label'),
})));
async function synchro(page, etatAttendu, intitule) {
  const bs = await boutons(page);
  return bs.length === 2 && bs.every((b) => b.etat === etatAttendu && b.presse === String(etatAttendu !== 'coupee') && b.intitule === intitule);
}
const stockage = (page) => page.evaluate(() => { try { return localStorage.getItem('z-survival-site.musique'); } catch { return 'indisponible'; } });
async function cacherOnglet(page, cache) {
  await page.evaluate((c) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => c });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (c ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, cache);
}
// Zone de clic : les points à 21 px du centre (haut, bas, gauche, droite) touchent encore le bouton.
async function zoneDeClic(page, selecteur) {
  return page.evaluate((sel) => {
    const b = document.querySelector(sel);
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
    const points = [[cx - 21, cy], [cx + 21, cy], [cx, cy - 21], [cx, cy + 21]];
    return { ok: points.every(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-son]') === b), taille: `${Math.round(r.width)} × ${Math.round(r.height)}` };
  }, selecteur);
}
// Rangée du haut de l'accueil (logo du studio, « Bientôt disponible », son, globe ; la mention provisoire est retirée au lot 2b) : aucun rectangle ne se recoupe.
// Lien Discord (ajouté après le lot 3b) compris dans les rangées vérifiées.
const RANGEE_ACCUEIL = ['.accueil-studio', '.accueil-reglages .bouton-bientot', '.accueil-reglages .discord-lien', '.accueil-reglages [data-son]', '.langue-accueil .langue-bouton'];
function chevauchements(page, selecteurs) {
  return page.evaluate((sels) => {
    const r = sels.map((s) => document.querySelector(s).getBoundingClientRect());
    const largeur = document.documentElement.clientWidth;
    for (let i = 0; i < r.length; i += 1) {
      if (r[i].right > largeur + 0.5 || r[i].left < -0.5) return `${sels[i]} hors de l’écran`;
      for (let j = i + 1; j < r.length; j += 1) {
        if (r[i].right > r[j].left + 0.5 && r[j].right > r[i].left + 0.5 && r[i].bottom > r[j].top + 0.5 && r[j].bottom > r[i].top + 0.5) return `${sels[i]} et ${sels[j]}`;
      }
    }
    return '';
  }, selecteurs);
}
async function allerA(page, section) {
  // Sur l'accueil, la navigation est cachée : « En savoir plus » descend vers News.
  if (await page.evaluate(() => document.body.dataset.section) === 'accueil' && section === 'news') await page.click('.accueil-entrer');
  else await page.click(`.nav-sections a[data-section="${section}"]`);
  await page.waitForFunction((s) => document.body.dataset.section === s, section, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);
  return page.evaluate(() => document.body.dataset.section);
}
async function changerLangue(page, bloc, l) {
  await page.click(`${bloc} .langue-bouton`);
  await page.click(`${bloc} .langue-choix[data-langue="${l}"]`);
}

const CAS = [
  { nom: 'téléphone 375 × 667', options: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { nom: 'téléphone 375 × 667, mouvement réduit', options: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' } },
  { nom: 'ordinateur 1440 × 900', options: { viewport: { width: 1440, height: 900 } } },
  { nom: 'ordinateur 1440 × 900, mouvement réduit', options: { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' } },
];

for (const [k, cas] of CAS.entries()) {
  console.log(`\n${cas.nom}`);
  const reduit = cas.options.reducedMotion === 'reduce';
  const court = cas.nom.split(',')[0].split(' ')[0] + (reduit ? '-reduit' : '');
  const { contexte, page, journal } = await ouvrir({ ...cas.options, locale: 'fr-FR' });
  await page.waitForTimeout(1000);

  // Chargement : rien de téléchargé, coupée, aucun contexte audio.
  verifier(journal.musique.length === 0, `aucune requête vers musique/ au chargement${journal.musique.length ? ` (${journal.musique.join(', ')})` : ''}`);
  let e = await etat(page);
  verifier(e.etat === 'coupee' && e.contexte === null, `au chargement : coupée, aucun contexte audio (${e.etat}, ${e.contexte})`);
  verifier(await synchro(page, 'coupee', 'Activer la musique'), 'deux boutons : barrés, aria-pressed="false", « Activer la musique »');
  verifier(await page.textContent('.accueil-reglages .bouton-bientot') === 'Bientôt disponible', 'accueil : « Bientôt disponible » en haut à droite');
  const rangee = await chevauchements(page, RANGEE_ACCUEIL);
  verifier(rangee === '', `accueil : rangée du haut sans chevauchement${rangee ? ` : ${rangee}` : ''}`);
  const barre = await page.$eval('.accueil-reglages [data-son] .son-barre', (el) => getComputedStyle(el).display !== 'none');
  verifier(barre, 'icône barrée');
  const zoneAccueil = await zoneDeClic(page, '.accueil-reglages [data-son]');
  verifier(zoneAccueil.ok, `accueil : zone de clic ≥ 44 × 44 px (bouton ${zoneAccueil.taille})`);
  if (k === 0 || k === 2) await page.screenshot({ path: join(CAPTURES, `accueil-${court}-coupee.png`) });

  // Premier clic (bouton de l'accueil) : chargement, puis lecture et montée.
  await page.click('.accueil-reglages [data-son]');
  await page.waitForTimeout(100);
  e = await etat(page);
  verifier(e.etat === 'chargement' && await synchro(page, 'chargement', 'Couper la musique'), `clic : état « chargement » sur les deux boutons (${e.etat})`);
  verifier(await page.$eval('.accueil-reglages [data-son]', (b) => b.getAttribute('aria-busy')) === 'true', 'aria-busy pendant le chargement');
  if (k === 0) await page.screenshot({ path: join(CAPTURES, `accueil-${court}-chargement.png`), clip: { x: 200, y: 0, width: 175, height: 90 } });
  e = await attendre(page, (x) => x.etat === 'lecture');
  const t0 = Date.now();
  await page.waitForTimeout(400);
  const g1 = (await etat(page)).gain;
  await page.waitForTimeout(1500);
  e = await etat(page);
  verifier(e.contexte === 'running' && g1 > 0.02 && g1 < e.volume - 0.02 && Math.abs(e.gain - e.volume) < 0.01,
    `lecture : contexte ${e.contexte}, gain qui monte (${g1.toFixed(3)} à +${((400) / 1000).toFixed(1)} s, ${e.gain.toFixed(3)} ensuite ; volume ${e.volume})`);
  verifier(journal.musique.join(',') === 'boucles.json,M2.mp3', `téléchargés au premier clic : ${journal.musique.join(', ')}`);
  verifier(await synchro(page, 'lecture', 'Couper la musique'), 'deux boutons : en lecture, aria-pressed="true", « Couper la musique »');
  const anim = await page.$eval('.accueil-reglages [data-son] .son-onde-1', (el) => getComputedStyle(el).animationName);
  verifier(reduit ? anim === 'none' : anim === 'son-onde', `ondes ${reduit ? 'immobiles (mouvement réduit)' : 'animées'} (${anim})`);
  verifier(await stockage(page) === 'activee', 'choix gardé : « activee »');
  if (k === 0 || k === 2) await page.screenshot({ path: join(CAPTURES, `accueil-${court}-lecture.png`) });
  void t0;

  // Anglais (globe de l'accueil) : intitulés traduits, état gardé.
  await changerLangue(page, '.langue-accueil', 'en');
  verifier(await synchro(page, 'lecture', 'Turn music off') && (await etat(page)).etat === 'lecture', 'anglais : « Turn music off » sur les deux boutons, la musique continue');
  verifier(await page.textContent('.accueil-reglages .bouton-bientot') === 'Coming soon', 'anglais : « Coming soon » sur l’accueil');
  verifier((await page.$$eval('.a-venir-encart', (els) => els.map((e) => e.textContent))).every((x) => x === 'Coming soon'), 'anglais : encarts « Coming soon » (Personnages, Armes)');

  // En-tête (section News) : second clic → descente, puis contexte suspendu.
  verifier(await allerA(page, 'news') === 'news', 'passage à la section News');
  const zoneEntete = await zoneDeClic(page, '.entete [data-son]');
  verifier(zoneEntete.ok, `en-tête : zone de clic ≥ 44 × 44 px (bouton ${zoneEntete.taille})`);
  if (k === 0 || k === 2) await page.screenshot({ path: join(CAPTURES, `entete-${court}-lecture.png`), clip: { x: 0, y: 0, width: cas.options.viewport.width, height: 100 } });
  await page.click('.entete [data-son]');
  await page.waitForTimeout(200);
  const gDesc = (await etat(page)).gain;
  e = await attendre(page, (x) => x.contexte === 'suspended', 3000);
  verifier(gDesc > 0.02 && gDesc < e.volume - 0.02 && e.gain < 0.001 && e.contexte === 'suspended' && e.etat === 'coupee',
    `second clic : descente (${gDesc.toFixed(3)} à +0,2 s), puis gain ${e.gain.toFixed(3)}, contexte ${e.contexte}`);
  verifier(await synchro(page, 'coupee', 'Turn music on'), 'deux boutons : coupés, « Turn music on »');
  verifier(await stockage(page) === 'coupee', 'coupure gardée : « coupee »');

  // Onglet caché alors qu'elle est coupée : rien ne repart.
  await cacherOnglet(page, true);
  await cacherOnglet(page, false);
  await page.waitForTimeout(300);
  e = await etat(page);
  verifier(e.etat === 'coupee' && e.contexte === 'suspended', `onglet caché puis revenu, musique coupée : reste coupée (${e.contexte})`);

  // Nouveau clic : reprise sans nouveau téléchargement.
  await page.click('.entete [data-son]');
  e = await attendre(page, (x) => x.etat === 'lecture' && x.contexte === 'running' && x.gain > 0.1, 4000);
  verifier(e.etat === 'lecture' && e.contexte === 'running' && journal.musique.length === 2, `reprise sans nouveau téléchargement (${journal.musique.length} requêtes au total)`);
  await changerLangue(page, '.langue-entete', 'fr');
  verifier(await synchro(page, 'lecture', 'Couper la musique'), 'retour au français (globe de l’en-tête) : « Couper la musique »');

  // Onglet caché pendant la lecture : pause, puis reprise au retour.
  await page.waitForTimeout(1600);
  await cacherOnglet(page, true);
  e = await attendre(page, (x) => x.contexte === 'suspended', 3000);
  verifier(e.contexte === 'suspended' && e.gain < 0.001 && e.etat === 'lecture', `onglet caché : pause (gain ${e.gain.toFixed(3)}, contexte ${e.contexte})`);
  await cacherOnglet(page, false);
  e = await attendre(page, (x) => x.contexte === 'running' && x.gain > 0.05, 3000);
  verifier(e.contexte === 'running' && e.gain > 0.05, `onglet revenu : reprise (gain ${e.gain.toFixed(3)} et qui monte)`);

  // Reste du site : navigation, clavier, langues.
  verifier(await allerA(page, 'weapons') === 'weapons', 'navigation : clic sur « Armes »');
  await page.keyboard.press('End');
  await page.waitForTimeout(900);
  verifier(await page.evaluate(() => document.body.dataset.section) === 'about', 'clavier : Fin → À propos');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(900);
  verifier(await page.evaluate(() => document.body.dataset.section) === 'weapons', 'clavier : flèche haut → Armes');
  verifier(await page.textContent('#titre-news') === 'Actualités', 'titres de section en français');
  const encarts = await page.$$eval('.a-venir-encart', (els) => els.map((e) => e.textContent));
  // Lot 6a : la section Armes publiée (SECTION_ARMES_ACTIVE de js/donnees.js) n'a plus l'encart ; Personnages le garde.
  const { SECTION_ARMES_ACTIVE } = await import(new URL('../../js/donnees.js', import.meta.url).href);
  const attendus = SECTION_ARMES_ACTIVE ? 1 : 2;
  verifier(encarts.length === attendus && encarts.every((x) => x === 'Prochainement'), `${SECTION_ARMES_ACTIVE ? 'Personnages' : 'Personnages et Armes'} : encart « Prochainement » en français (${encarts.join(', ')})`);
  verifier((await etat(page)).etat === 'lecture', 'la musique continue pendant la navigation');

  // En-tête sans chevauchement.
  const chevauchement = await page.evaluate(() => {
    const els = ['.entete-logo', '.entete .bouton-bientot', '.entete .discord-lien', '.entete [data-son]', '.langue-entete .langue-bouton'].map((s) => document.querySelector(s).getBoundingClientRect());
    const largeur = document.documentElement.clientWidth;
    for (let i = 0; i < els.length; i += 1) {
      if (els[i].right > largeur + 0.5 || els[i].left < -0.5) return `élément ${i} hors de l’écran`;
      for (let j = i + 1; j < els.length; j += 1) if (els[i].right > els[j].left + 0.5 && els[j].right > els[i].left + 0.5) return `éléments ${i} et ${j}`;
    }
    return '';
  });
  verifier(chevauchement === '', `en-tête sans chevauchement${chevauchement ? ` : ${chevauchement}` : ''}`);

  // Rechargement alors qu'elle jouait : toujours coupée, rien de téléchargé.
  journal.musique.length = 0;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('body.est-pret');
  await page.waitForTimeout(800);
  e = await etat(page);
  verifier(e.etat === 'coupee' && e.contexte === null && journal.musique.length === 0 && await synchro(page, 'coupee', 'Activer la musique'),
    `rechargement : coupée, aucun contexte audio, aucune requête vers musique/ (choix gardé : « ${await stockage(page)} »)`);

  verifier(journal.erreurs.length === 0, `aucune erreur console${journal.erreurs.length ? ` : ${journal.erreurs.join(' | ')}` : ''}`);
  verifier(journal.manquants.length === 0, `aucun fichier manquant${journal.manquants.length ? ` : ${journal.manquants.join(' | ')}` : ''}`);

  // Boucle (une fois) : décodage par Chromium et lecture en boucle rendue hors ligne autour du point de boucle.
  if (k === 0) {
    const r = await page.evaluate(async () => {
      const SR = 44100;
      const { morceaux } = await fetch('musique/boucles.json').then((x) => x.json());
      const m = morceaux.M2;
      const tampon = await new OfflineAudioContext(2, 1, SR).decodeAudioData(await fetch(`musique/${m.fichier}`).then((x) => x.arrayBuffer()));
      const hl = new OfflineAudioContext(2, 10 * SR, SR);
      const s = hl.createBufferSource();
      s.buffer = tampon; s.loop = true; s.loopStart = m.debutBoucle; s.loopEnd = m.finBoucle;
      s.connect(hl.destination);
      s.start(0, m.finBoucle - 5);
      const rendu = await hl.startRendering();
      const T = 5 * SR; const n = Math.round(0.9 * SR); const w = Math.round(0.005 * SR);
      const P = Math.round(m.debutBoucle * SR); const N = Math.round(m.dureeBoucle * SR);
      let e2 = 0; let s2 = 0; let saut = 0; let sautP = 0; let mini = Infinity; let med = 0;
      for (let c = 0; c < 2; c += 1) {
        const y = rendu.getChannelData(c); const x = tampon.getChannelData(c);
        for (let i = -n; i < n; i += 1) { const d = y[T + i] - x[P + N + i]; e2 += d * d; s2 += x[P + N + i] ** 2; }
        saut = Math.max(saut, Math.abs(y[T] - y[T - 1]));
        const sauts = [];
        for (let i = P + 1; i < P + N; i += 7) sauts.push(Math.abs(x[i] - x[i - 1]));
        sauts.sort((a, b) => a - b);
        sautP = Math.max(sautP, sauts[Math.floor(sauts.length * 0.999)]);
        const rms = (a, i0) => { let q = 0; for (let i = i0; i < i0 + w; i += 1) q += a[i] * a[i]; return Math.sqrt(q / w); };
        for (let i = T - Math.round(0.25 * SR); i < T + Math.round(0.25 * SR); i += w) mini = Math.min(mini, rms(y, i));
        const tous = [];
        for (let i = P; i + w < P + N; i += w * 10) tous.push(rms(x, i));
        tous.sort((a, b) => a - b);
        med += tous[Math.floor(tous.length / 2)] / 2;
      }
      return { ecart: e2 > 0 ? 10 * Math.log10(e2 / s2) : null, saut, sautP, blanc: 20 * Math.log10(mini / med) };
    });
    verifier(r.ecart === null || r.ecart < -15, `boucle M2 : raccord = suite naturelle du fichier (${r.ecart === null ? 'échantillons identiques' : `écart ${r.ecart.toFixed(1)} dB`})`);
    verifier(r.saut <= r.sautP * 1.5, `boucle M2 : aucun saut (${r.saut.toFixed(4)} contre ${r.sautP.toFixed(4)} pour les sauts ordinaires)`);
    verifier(r.blanc > -30, `boucle M2 : aucun blanc (fenêtre de 5 ms la plus faible : ${r.blanc.toFixed(1)} dB sous la médiane)`);
  }
  await contexte.close();
}

// En-tête et haut de l'accueil des très petits téléphones (320 px), en français : sans chevauchement.
// Haut de l'accueil à d'autres largeurs (tablette, ordinateur étroit), en français.
for (const largeur of [414, 600, 900, 1024]) {
  const { contexte, page } = await ouvrir({ viewport: { width: largeur, height: 800 }, locale: 'fr-FR' });
  const rangee = await chevauchements(page, RANGEE_ACCUEIL);
  verifier(rangee === '', `accueil à ${largeur} px : rangée du haut sans chevauchement${rangee ? ` : ${rangee}` : ''}`);
  await contexte.close();
}
{
  console.log('\ntéléphone 320 × 568 (français, le libellé le plus long)');
  const { contexte, page, journal } = await ouvrir({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR' });
  await allerA(page, 'news');
  const r = await page.evaluate(() => {
    const els = ['.entete-logo', '.entete .bouton-bientot', '.entete .discord-lien', '.entete [data-son]', '.langue-entete .langue-bouton'].map((s) => document.querySelector(s).getBoundingClientRect());
    for (let i = 0; i < els.length; i += 1) {
      if (els[i].right > document.documentElement.clientWidth + 0.5) return `élément ${i} hors de l’écran`;
      for (let j = i + 1; j < els.length; j += 1) if (els[i].right > els[j].left + 0.5 && els[j].right > els[i].left + 0.5) return `éléments ${i} et ${j}`;
    }
    return '';
  });
  verifier(r === '', `en-tête sans chevauchement${r ? ` : ${r}` : ''}`);
  await page.screenshot({ path: join(CAPTURES, 'entete-320.png'), clip: { x: 0, y: 0, width: 320, height: 90 } });
  await page.keyboard.press('Home');
  await page.waitForTimeout(900);
  const rangee = await chevauchements(page, RANGEE_ACCUEIL);
  verifier(rangee === '', `accueil : rangée du haut sans chevauchement${rangee ? ` : ${rangee}` : ''}`);
  verifier(journal.erreurs.length === 0 && journal.manquants.length === 0, 'aucune erreur console ni fichier manquant');
  await contexte.close();
}

await navigateur.close();
copie?.fermer();
console.log(`\n${reussites} vérifications réussies, ${echecs} en échec. Captures : ${CAPTURES}`);
process.exit(echecs ? 1 : 0);
