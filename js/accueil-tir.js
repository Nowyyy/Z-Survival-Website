// Accueil : tir synchronisé avec la vidéo (lot 2b ; flash du cadre : idée « catchy » n° 1, après le lot 1). UN seul module suit le temps
// de la vidéo et déclenche, une fois par tour de boucle, à TEMPS_TIR (js/accueil-boucle.js, 5,2 s) :
//  1. le flash du cadre rouge (css/accueil.css, « est-tir » : environ 200 ms, éclat rouge, jamais blanc ; un par tour de 8 s) ;
//  2. le HUD de jeu : munitions 30 → 29 avec un petit sursaut ;
//  3. le coup de feu du jeu (js/musique.js, jouerCoupDeFeu) : seulement si le son du site est activé, l'onglet visible et la vidéo en lecture.
// Il repère aussi le retour au début de la boucle : munitions remises à 30, heure de nuit + 1 minute.
// Temps suivi : requestVideoFrameCallback (instant exact de l'image affichée) quand il existe, sinon une boucle sur currentTime.
// Un saut dans le temps (rotation de l'écran, reprise après une pause, recherche) recale le suivi sans effet : jamais d'effet en double
// ni à contretemps. Les effets passent par les événements « zs:tir » et « zs:tour » sur document : l'aperçu de l'atelier
// (scene/apercu.html, scène 3D en direct, site ouvert avec ?video=0) les envoie lui-même.
// Mouvement réduit : pas de vidéo, donc aucun effet ; HUD affiché, fixe (manche 01, 23:47, 30 munitions).
// État pour les tests : window.__zsAccueil.etat().
import { DUREE_BOUCLE, IMAGES_PAR_SECONDE, TEMPS_TIR } from './accueil-boucle.js';
import { mouvementReduit } from './i18n.js';
import { jouerCoupDeFeu } from './musique.js';

export const EVENEMENT_TIR = 'zs:tir';
export const EVENEMENT_TOUR = 'zs:tour';
export const MUNITIONS = 30;
export const HEURE_DEPART = 23 * 60 + 47; // 23:47, en minutes
const SAUT_MAX = 1; // s : un écart plus grand entre deux images suivies n'est pas une lecture continue
const TOLERANCE = 0.5 / IMAGES_PAR_SECONDE; // une demi-image : l'image du tir compte même si son instant est arrondi

const etat = { tours: 0, tirs: 0, sons: 0, munitions: MUNITIONS, minutes: HEURE_DEPART, suivi: null, journal: [] };
const deuxChiffres = (n) => String(n).padStart(2, '0');
const heureTexte = (m) => `${deuxChiffres(Math.floor(m / 60) % 24)}:${deuxChiffres(m % 60)}`;

// Suivi du temps de la vidéo : appelle EVENEMENT_TIR au passage de TEMPS_TIR, EVENEMENT_TOUR au retour au début de la boucle.
export function suivreVideo(video) {
  let avant = null;
  let tirFait = false;
  const envoyer = (nom, t) => {
    etat.journal.push({ evenement: nom, temps: Number(t.toFixed(3)) });
    if (etat.journal.length > 40) etat.journal.shift();
    document.dispatchEvent(new CustomEvent(nom, { detail: { temps: t, video } }));
  };
  const tirer = (t, saut) => { tirFait = true; if (!saut) envoyer(EVENEMENT_TIR, t); };
  function voir(t) {
    if (!Number.isFinite(t)) return;
    if (avant === null) { avant = t; tirFait = t >= TEMPS_TIR - TOLERANCE; return; }
    if (t === avant) return;
    const tour = t < avant - DUREE_BOUCLE / 2; // retour au début de la boucle
    const pas = tour ? t + DUREE_BOUCLE - avant : t - avant;
    const saut = pas < 0 || pas > SAUT_MAX;
    const atteint = (x) => x >= TEMPS_TIR - TOLERANCE;
    if (tour) {
      if (!tirFait && !atteint(avant)) tirer(t, saut); // tir de l'ancien tour sauté par la boucle (lecture très saccadée)
      tirFait = false;
      envoyer(EVENEMENT_TOUR, t);
      if (atteint(t)) tirer(t, saut);
    } else if (t > avant && !tirFait && atteint(t)) {
      tirer(t, saut);
    }
    avant = t;
  }
  if (typeof video.requestVideoFrameCallback === 'function') {
    etat.suivi = 'requestVideoFrameCallback';
    const image = (_maintenant, meta) => { voir(meta.mediaTime); video.requestVideoFrameCallback(image); };
    video.requestVideoFrameCallback(image);
  } else {
    etat.suivi = 'currentTime';
    const boucle = () => { if (!video.paused) voir(video.currentTime); requestAnimationFrame(boucle); };
    requestAnimationFrame(boucle);
  }
}

// HUD de jeu et effets. section : la section d'accueil (cadre rouge, HUD).
export function installerTir(section) {
  if (!section) return;
  const munitions = section.querySelector('[data-hud="munitions"]');
  const heure = section.querySelector('[data-hud="heure"]');
  const bloc = munitions?.closest('.hud-bloc');
  const afficher = () => {
    if (munitions) munitions.textContent = String(etat.munitions);
    if (heure) { heure.textContent = heureTexte(etat.minutes); heure.setAttribute('datetime', heureTexte(etat.minutes)); }
  };
  const relancer = (el, classe) => {
    if (!el) return;
    el.classList.remove(classe);
    void el.offsetWidth; // recalcul : l'animation repart même si la précédente n'est pas finie
    el.classList.add(classe);
  };
  document.addEventListener(EVENEMENT_TIR, () => {
    if (mouvementReduit()) return;
    etat.tirs += 1;
    relancer(section, 'est-tir');
    etat.munitions = Math.max(0, etat.munitions - 1);
    afficher();
    relancer(bloc, 'est-sursaut');
    if (!document.hidden && jouerCoupDeFeu()) etat.sons += 1;
  });
  document.addEventListener(EVENEMENT_TOUR, () => {
    if (mouvementReduit()) return;
    etat.tours += 1;
    etat.munitions = MUNITIONS;
    etat.minutes = (etat.minutes + 1) % (24 * 60);
    afficher();
  });
  section.addEventListener('animationend', (e) => {
    if (e.animationName === 'cadre-tir') section.classList.remove('est-tir');
    if (e.animationName === 'hud-sursaut') bloc?.classList.remove('est-sursaut');
  });
  afficher();
}

window.__zsAccueil = {
  etat: () => ({ ...etat, heure: heureTexte(etat.minutes), journal: [...etat.journal] }),
};
