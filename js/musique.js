// Musique du site (lot 2a) : M2 « Ambiante » (lot 1b), règles dans Docs/ref/musique.md (partie 2).
// - Toujours coupée au chargement ; ne part QUE par un clic sur une icône de son ([data-son], à côté de chaque globe de langue) ;
//   un nouveau clic la coupe. Tous les boutons partagent le même état.
// - Rien n'est téléchargé avant le premier clic (ni boucles.json ni le MP3) ; pendant le téléchargement et le décodage, les
//   boutons sont en état « chargement ».
// - Lecture Web Audio en boucle sans blanc (AudioBufferSourceNode, loopStart / loopEnd de musique/boucles.json, comme sur la
//   planche d'écoute) ; montée de 1,5 s, descente de 0,5 s ; à la coupure, le contexte audio est suspendu (la position est gardée).
// - Commutateur silencieux de l'iPhone ignoré : navigator.audioSession.type = 'playback' avant la lecture (Safari 17 et plus).
// - Onglet caché : pause ; reprise au retour seulement si la musique jouait.
// - Le choix (activée / coupée) est gardé dans le navigateur, mais ne relance jamais la musique au chargement.
// État pour les tests : window.__zsMusique.etat().
import { t } from './i18n.js';

// Volume de lecture (gain de 0 à 1). À régler à l'oreille.
export const VOLUME = 0.4;

const MORCEAU = 'M2';
const DOSSIER = 'musique/';
const MONTEE = 1.5;
const DESCENTE = 0.5;
const DESCENTE_ONGLET = 0.2;
const CLE_STOCKAGE = 'z-survival-site.musique';

const boutons = [...document.querySelectorAll('[data-son]')];
let etat = 'coupee'; // 'coupee' | 'chargement' | 'lecture'
let ctx = null;
let sortie = null; // gain général (fondus et volume)
let source = null;
let chargement = null; // Promise<{ tampon, boucle }>
let pauseOnglet = false;
let geste = 0; // numéro de la dernière demande (annule les suites d'une demande dépassée)
let suspension = 0;

function garderChoix(active) {
  try { window.localStorage.setItem(CLE_STOCKAGE, active ? 'activee' : 'coupee'); } catch { /* stockage indisponible */ }
}

function majBoutons() {
  const actif = etat !== 'coupee';
  for (const b of boutons) {
    b.dataset.etat = etat;
    b.setAttribute('aria-pressed', String(actif));
    if (etat === 'chargement') b.setAttribute('aria-busy', 'true');
    else b.removeAttribute('aria-busy');
    // data-t-aria : js/i18n.js remet l'intitulé dans la bonne langue à chaque changement de langue.
    b.dataset.tAria = actif ? 'musique.couper' : 'musique.activer';
    b.setAttribute('aria-label', t(b.dataset.tAria));
  }
}

// Contexte audio : créé et relancé dans le geste du visiteur (exigé par Safari iOS).
function contexte() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* sans effet */ }
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sortie = ctx.createGain();
    sortie.gain.value = 0;
    sortie.connect(ctx.destination);
  }
  return ctx;
}

function decoder(octets) {
  return new Promise((ok, ko) => {
    const p = ctx.decodeAudioData(octets, ok, ko); // forme à rappels : anciens Safari
    if (p && typeof p.then === 'function') p.then(ok, ko);
  });
}

function charger() {
  if (!chargement) {
    chargement = fetch(`${DOSSIER}boucles.json`)
      .then((r) => { if (!r.ok) throw new Error(`boucles.json : ${r.status}`); return r.json(); })
      .then(async ({ morceaux }) => {
        const boucle = morceaux[MORCEAU];
        const r = await fetch(DOSSIER + boucle.fichier);
        if (!r.ok) throw new Error(`${boucle.fichier} : ${r.status}`);
        return { boucle, tampon: await decoder(await r.arrayBuffer()) };
      });
    chargement.catch(() => { chargement = null; }); // on pourra réessayer au clic suivant
  }
  return chargement;
}

function rampe(cible, duree) {
  const now = ctx.currentTime;
  sortie.gain.cancelScheduledValues(now);
  sortie.gain.setValueAtTime(sortie.gain.value, now);
  sortie.gain.linearRampToValueAtTime(cible, now + duree);
}

// Descente puis suspension du contexte (la lecture reprend au même endroit).
function descendre(duree) {
  rampe(0, duree);
  const n = ++suspension;
  setTimeout(() => { if (n === suspension) ctx.suspend().catch(() => {}); }, duree * 1000 + 60); // annulée par monter()
}

function monter() {
  suspension += 1; // annule une suspension en attente
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  rampe(VOLUME, MONTEE);
}

async function activer() {
  const n = ++geste;
  if (!contexte()) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {}); // dans le geste
  garderChoix(true);
  if (source) { // déjà chargée : reprise
    etat = 'lecture';
    majBoutons();
    if (document.hidden) { pauseOnglet = true; return; }
    monter();
    return;
  }
  etat = 'chargement';
  majBoutons();
  let res;
  try {
    res = await charger();
  } catch {
    if (n === geste) { etat = 'coupee'; majBoutons(); }
    return;
  }
  if (n !== geste || source) return; // coupée (ou relancée) pendant le chargement
  const { boucle, tampon } = res;
  source = ctx.createBufferSource();
  source.buffer = tampon;
  source.loop = true;
  source.loopStart = boucle.debutBoucle;
  source.loopEnd = boucle.finBoucle;
  source.connect(sortie);
  sortie.gain.setValueAtTime(0, ctx.currentTime);
  source.start(ctx.currentTime + 0.05, boucle.debutBoucle);
  etat = 'lecture';
  majBoutons();
  if (document.hidden) { pauseOnglet = true; descendre(0.01); return; }
  monter();
}

function couper() {
  geste += 1;
  garderChoix(false);
  pauseOnglet = false;
  const jouait = etat === 'lecture';
  etat = 'coupee';
  majBoutons();
  if (jouait && ctx) descendre(DESCENTE);
}

for (const b of boutons) {
  b.addEventListener('click', () => { if (etat === 'coupee') activer(); else couper(); });
}

document.addEventListener('visibilitychange', () => {
  if (!ctx || !source) return;
  if (document.hidden) {
    if (etat === 'lecture') { pauseOnglet = true; descendre(DESCENTE_ONGLET); }
  } else if (pauseOnglet && etat === 'lecture') {
    pauseOnglet = false;
    monter();
  }
});

majBoutons();

window.__zsMusique = {
  etat: () => ({
    etat,
    contexte: ctx?.state ?? null,
    gain: sortie ? sortie.gain.value : null,
    volume: VOLUME,
    charge: Boolean(source),
    temps: ctx ? ctx.currentTime : null,
  }),
};
