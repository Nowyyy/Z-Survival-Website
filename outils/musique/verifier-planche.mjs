// Contrôle Playwright de la planche d'écoute (lot 1b) : node outils/musique/verifier-planche.mjs [--captures=DOSSIER] [--en-ligne]
// - Prépare une copie exacte de ce que publie .github/workflows/pages.yml (même commande cp) dans un dossier temporaire et la sert
//   à la racine (--sous-dossier : sous /Z-Survival-Website/) ; avec --en-ligne, contrôle https://zsurvival-game.com/ à la place.
// - Planche (téléphone 375 × 667, puis ordinateur 1440 × 900, puis mouvement réduit) : aucune erreur console, aucun fichier manquant,
//   noindex, trois morceaux ; Lecture, Pause et reprise ; un seul morceau à la fois ; « Écouter le raccord » (départ 5 s avant la fin,
//   retour au début, arrêt seul 5 s après).
// - Raccord dans Chromium : chaque MP3 décodé par decodeAudioData, puis la lecture en boucle (AudioBufferSourceNode, loopStart /
//   loopEnd de boucles.json) rendue hors ligne autour du raccord et comparée à la suite naturelle du fichier ; saut et blanc mesurés.
// - Site : l'accueil charge sans erreur et ne pointe pas vers musique/.
// Playwright : celui installé sur la machine (require('playwright')).
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { servirCopiePubliee, simulerActualites } from '../copie-publiee.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const CAPTURES = args.captures || join(tmpdir(), 'planche-captures');
mkdirSync(CAPTURES, { recursive: true });

let echecs = 0;
let reussites = 0;
const verifier = (ok, texte) => {
  if (ok) reussites += 1; else echecs += 1;
  console.log(`${ok ? '  ok ' : 'ÉCHEC'} ${texte}`);
};

// ---------- Copie publiée et serveur ----------
let base;
let serveur;
if (args['en-ligne']) {
  base = 'https://zsurvival-game.com/';
} else {
  const copie = await servirCopiePubliee();
  console.log(`Copie publiée (${copie.commande}) servie depuis ${copie.dossier}`);
  base = copie.base;
  serveur = { close: copie.fermer };
}
const PLANCHE = `${base}musique/planche.html`;

const navigateur = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });

async function ouvrir(url, options = {}) {
  const contexte = await navigateur.newContext(options);
  const page = await contexte.newPage();
  const erreurs = [];
  const manquants = [];
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('requestfailed', (r) => manquants.push(`${r.url()} (${r.failure()?.errorText})`));
  page.on('response', (r) => { if (r.status() >= 400) manquants.push(`${r.url()} (${r.status()})`); });
  // Lot 4a : la page du site appelle le serveur des actualités (lot 3b) ; en local, réponse simulée (outils/copie-publiee.mjs).
  if (!args['en-ligne']) await simulerActualites(page);
  await page.goto(url, { waitUntil: 'networkidle' });
  return { contexte, page, erreurs, manquants };
}
const etat = (page) => page.evaluate(() => window.__planche.etat());
async function attendre(page, condition, delai = 15000) {
  const fin = Date.now() + delai;
  for (;;) {
    const e = await etat(page);
    if (condition(e)) return e;
    if (Date.now() > fin) return e;
    await page.waitForTimeout(100);
  }
}

// ---------- Planche sur téléphone ----------
console.log(`\nPlanche (téléphone 375 × 667) : ${PLANCHE}`);
{
  const { contexte, page, erreurs, manquants } = await ouvrir(PLANCHE, { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await page.waitForSelector('html[data-pret="1"]');
  const boucles = await page.evaluate(() => fetch('boucles.json').then((r) => r.json()));
  const ids = Object.keys(boucles.morceaux);
  verifier(ids.join(',') === 'M1,M2,M3', `trois morceaux dans boucles.json (${ids.join(', ')})`);
  verifier(await page.locator('article.morceau').count() === 3, 'trois cartes affichées');
  verifier((await page.getAttribute('meta[name="robots"]', 'content')) === 'noindex, nofollow', 'page en noindex');
  const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
  verifier(largeur <= 375, `aucun défilement horizontal (largeur ${largeur} px)`);
  for (const id of ids) {
    const m = boucles.morceaux[id];
    verifier(m.octets <= 2 * 1024 * 1024 && m.dureeBoucle >= 60 && m.dureeBoucle <= 120, `${id} : ${(m.octets / 1048576).toFixed(2)} Mo, boucle de ${m.dureeBoucle} s`);
  }
  await page.screenshot({ path: join(CAPTURES, 'planche-telephone.png'), fullPage: true });

  // Lecture de M1.
  await page.click('#morceau-M1 [data-action="lecture"]');
  let e = await attendre(page, (x) => x.courant?.pret);
  verifier(e.contexte === 'running' && e.courant?.id === 'M1' && e.courant.mode === 'lecture', `M1 se lit (contexte ${e.contexte})`);
  const p0 = e.courant.pos;
  await page.waitForTimeout(1500);
  e = await etat(page);
  verifier(e.courant && e.courant.pos - p0 > 1, `M1 avance (${p0.toFixed(2)} s → ${e.courant?.pos.toFixed(2)} s)`);
  verifier(await page.getAttribute('#morceau-M1 [data-action="lecture"]', 'aria-pressed') === 'true', 'bouton de M1 en position Pause');
  await page.screenshot({ path: join(CAPTURES, 'planche-lecture.png') });

  // M2 : M1 s'arrête (un seul morceau à la fois).
  await page.click('#morceau-M2 [data-action="lecture"]');
  e = await attendre(page, (x) => x.courant?.id === 'M2' && x.courant.pret);
  verifier(e.courant?.id === 'M2', 'M2 se lit');
  verifier(await page.getAttribute('#morceau-M1', 'data-etat') === 'pause' && await page.getAttribute('#morceau-M2', 'data-etat') === 'lecture', 'M1 s’est arrêté : un seul morceau à la fois');
  await page.waitForTimeout(1200);
  // Pause et reprise de M2.
  await page.click('#morceau-M2 [data-action="lecture"]');
  e = await etat(page);
  verifier(e.courant === null && await page.getAttribute('#morceau-M2', 'data-etat') === 'pause', 'Pause : plus rien ne joue');
  const garde = await page.evaluate(() => document.querySelector('#morceau-M2 .morceau-temps').textContent);
  await page.click('#morceau-M2 [data-action="lecture"]');
  e = await attendre(page, (x) => x.courant?.id === 'M2' && x.courant.pret);
  verifier(e.courant && e.courant.pos > 2, `reprise à la position gardée (${garde}, reprise à ${e.courant?.pos.toFixed(2)} s du fichier)`);

  // Raccord de M3.
  await page.click('#morceau-M3 [data-action="raccord"]');
  const m3 = boucles.morceaux.M3;
  e = await attendre(page, (x) => x.courant?.id === 'M3' && x.courant.pret);
  verifier(e.courant?.mode === 'raccord' && Math.abs(e.courant.pos - (m3.finBoucle - 5)) < 0.5, `raccord : départ 5 s avant la fin (${e.courant?.pos.toFixed(2)} s, fin ${m3.finBoucle} s)`);
  verifier(await page.getAttribute('#morceau-M2', 'data-etat') === 'pause', 'M2 s’est arrêté');
  const avant = await page.textContent('#morceau-M3 .morceau-statut');
  e = await attendre(page, (x) => x.courant?.tours === 1, 8000);
  verifier(e.courant?.tours === 1 && e.courant.pos < m3.debutBoucle + 2, `retour au début de la boucle (position ${e.courant?.pos.toFixed(2)} s, tour ${(e.courant?.tours ?? 0) + 1})`);
  await page.waitForTimeout(400); // le message suit l'affichage (une image plus tard)
  const apres = await page.textContent('#morceau-M3 .morceau-statut');
  verifier(/retour au début dans/.test(avant) && /raccord passé/.test(apres), `messages du raccord (« ${avant} » puis « ${apres} »)`);
  await page.screenshot({ path: join(CAPTURES, 'planche-raccord.png') });
  e = await attendre(page, (x) => x.courant === null, 8000);
  verifier(e.courant === null && /Fin de l’essai/.test(await page.textContent('#morceau-M3 .morceau-statut')), 'arrêt seul 5 s après le raccord');

  // Onglet caché : pause.
  await page.click('#morceau-M1 [data-action="lecture"]');
  await attendre(page, (x) => x.courant?.pret);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  e = await etat(page);
  verifier(e.courant === null, 'onglet caché : pause');

  // Raccord mesuré dans Chromium (décodage du navigateur et lecture en boucle Web Audio rendue hors ligne).
  const mesures = await page.evaluate(async (morceaux) => {
    const SR = 44100;
    const res = {};
    for (const [id, m] of Object.entries(morceaux)) {
      const octets = await fetch(m.fichier).then((r) => r.arrayBuffer());
      const tampon = await new OfflineAudioContext(2, 1, SR).decodeAudioData(octets);
      // Lecture en boucle : départ 5 s avant la fin de la boucle, 10 s rendues.
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
        // Suite naturelle : x[P + N - n .. P + N + n[ (la marge d'après prolonge la boucle).
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
      res[id] = { longueur: tampon.length, attendue: Math.round(m.dureeFichier * SR), canaux: tampon.numberOfChannels, ecartSuite: 10 * Math.log10(e2 / s2), saut, sautP, blanc: 20 * Math.log10(mini / med) };
    }
    return res;
  }, boucles.morceaux);
  for (const [id, r] of Object.entries(mesures)) {
    verifier(Math.abs(r.longueur - r.attendue) < 3000 && r.canaux === 2, `${id} : décodé par Chromium, ${r.longueur} échantillons (attendus ${r.attendue}), stéréo`);
    verifier(r.ecartSuite < -15, `${id} : raccord joué en boucle = suite naturelle du fichier (${Number.isFinite(r.ecartSuite) ? `écart ${r.ecartSuite.toFixed(1)} dB` : 'échantillons identiques'})`);
    verifier(r.saut <= r.sautP * 1.5, `${id} : aucun saut au raccord (${r.saut.toFixed(4)} contre ${r.sautP.toFixed(4)} pour les sauts ordinaires)`);
    verifier(r.blanc > -30, `${id} : aucun blanc au raccord (fenêtre de 5 ms la plus faible : ${r.blanc.toFixed(1)} dB sous la médiane)`);
  }
  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
  verifier(manquants.length === 0, `aucun fichier manquant${manquants.length ? ` : ${manquants.join(' | ')}` : ''}`);
  await contexte.close();
}

// ---------- Planche sur ordinateur, et en mouvement réduit ----------
for (const [nom, options] of [['ordinateur 1440 × 900', { viewport: { width: 1440, height: 900 } }], ['mouvement réduit', { viewport: { width: 375, height: 667 }, reducedMotion: 'reduce' }]]) {
  console.log(`\nPlanche (${nom})`);
  const { contexte, page, erreurs, manquants } = await ouvrir(PLANCHE, options);
  await page.waitForSelector('html[data-pret="1"]');
  await page.click('#morceau-M3 [data-action="lecture"]');
  const e = await attendre(page, (x) => x.courant?.pret);
  verifier(e.courant?.id === 'M3', 'M3 se lit');
  if (nom.startsWith('ordinateur')) await page.screenshot({ path: join(CAPTURES, 'planche-ordinateur.png'), fullPage: true });
  verifier(erreurs.length === 0 && manquants.length === 0, `aucune erreur console ni fichier manquant${[...erreurs, ...manquants].length ? ` : ${[...erreurs, ...manquants].join(' | ')}` : ''}`);
  await contexte.close();
}

// ---------- Site existant ----------
console.log(`\nSite : ${base}`);
for (const [nom, options] of [['téléphone', { viewport: { width: 375, height: 667 } }], ['ordinateur', { viewport: { width: 1440, height: 900 } }]]) {
  const { contexte, page, erreurs, manquants } = await ouvrir(base, options);
  verifier(await page.locator('#news').count() === 1 && await page.locator('#about').count() === 1, `${nom} : accueil chargé (sections présentes)`);
  verifier(await page.locator('a[href*="musique/"], [src*="musique/"]').count() === 0, `${nom} : aucun lien vers musique/`);
  await page.screenshot({ path: join(CAPTURES, `site-${nom}.png`) });
  verifier(erreurs.length === 0 && manquants.length === 0, `${nom} : aucune erreur console ni fichier manquant${[...erreurs, ...manquants].length ? ` : ${[...erreurs, ...manquants].join(' | ')}` : ''}`);
  await contexte.close();
}

await navigateur.close();
serveur?.close();
console.log(`\n${reussites} vérifications réussies, ${echecs} en échec. Captures : ${CAPTURES}`);
process.exit(echecs ? 1 : 0);
