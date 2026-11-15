// Accueil : tir synchronisé avec la vidéo (lot 2b ; flash du cadre : idée « catchy » n° 1, après le lot 1). UN seul module suit le temps
// de la vidéo et déclenche, une fois par tour de boucle et par tir de TEMPS_TIRS (js/accueil-boucle.js : TEMPS_TIR, 5,2 s ; le tir du
// personnage 2 s'y ajoutera quand les vidéos le montreront) :
//  1. le flash du cadre rouge (css/accueil.css, « est-tir » : environ 200 ms, éclat rouge, jamais blanc ; un par tour de 8 s) ;
//  2. le coup de feu du jeu (js/musique.js, jouerCoupDeFeu) : seulement si le son du site est activé, l'onglet visible et la vidéo en lecture.
// Il repère aussi le retour au début de la boucle (« zs:tour », compté). Le HUD de jeu du lot 2b (manche, heure, munitions) est retiré
// (retour du propriétaire).
// Temps suivi : requestVideoFrameCallback (instant exact de l'image affichée) quand il existe, sinon une boucle sur currentTime.
// Un saut dans le temps (rotation de l'écran, reprise après une pause, recherche) recale le suivi sans effet : jamais d'effet en double
// ni à contretemps. Les effets passent par les événements « zs:tir » et « zs:tour » sur document : l'aperçu de l'atelier
// (scene/apercu.html, scène 3D en direct, site ouvert avec ?video=0) les envoie lui-même.
// Mouvement réduit : pas de vidéo, donc aucun effet.
// État pour les tests : window.__zsAccueil.etat().
import { DUREE_BOUCLE, IMAGES_PAR_SECONDE, TEMPS_TIRS } from './accueil-boucle.js';
import { mouvementReduit } from './i18n.js';
import { jouerCoupDeFeu } from './musique.js';

export const EVENEMENT_TIR = 'zs:tir';
export const EVENEMENT_TOUR = 'zs:tour';
const SAUT_MAX = 1; // s : un écart plus grand entre deux images suivies n'est pas une lecture continue
const TOLERANCE = 0.5 / IMAGES_PAR_SECONDE; // une demi-image : l'image du tir compte même si son instant est arrondi

const etat = { tours: 0, tirs: 0, sons: 0, suivi: null, journal: [] };

// Suivi du temps de la vidéo : appelle EVENEMENT_TIR au passage de chaque instant de TEMPS_TIRS, EVENEMENT_TOUR au retour au début.
export function suivreVideo(video, instants = TEMPS_TIRS) {
  let avant = null;
  let faits = instants.map(() => false); // tirs déjà passés dans ce tour
  const envoyer = (nom, t) => {
    etat.journal.push({ evenement: nom, temps: Number(t.toFixed(3)) });
    if (etat.journal.length > 40) etat.journal.shift();
    document.dispatchEvent(new CustomEvent(nom, { detail: { temps: t, video } }));
  };
  const atteint = (x, i) => x >= instants[i] - TOLERANCE;
  const tirer = (i, t, saut) => { faits[i] = true; if (!saut) envoyer(EVENEMENT_TIR, t); };
  function voir(t) {
    if (!Number.isFinite(t)) return;
    if (avant === null) { avant = t; faits = instants.map((_, i) => atteint(t, i)); return; }
    if (t === avant) return;
    const tour = t < avant - DUREE_BOUCLE / 2; // retour au début de la boucle
    const pas = tour ? t + DUREE_BOUCLE - avant : t - avant;
    const saut = pas < 0 || pas > SAUT_MAX;
    if (tour) {
      instants.forEach((_, i) => { if (!faits[i]) tirer(i, t, saut); }); // tir de l'ancien tour sauté par la boucle (lecture très saccadée)
      faits = instants.map(() => false);
      envoyer(EVENEMENT_TOUR, t);
      instants.forEach((_, i) => { if (atteint(t, i)) tirer(i, t, saut); });
    } else if (t > avant) {
      instants.forEach((_, i) => { if (!faits[i] && atteint(t, i)) tirer(i, t, saut); });
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

// Effets du tir. section : la section d'accueil (cadre rouge).
export function installerTir(section) {
  if (!section) return;
  document.addEventListener(EVENEMENT_TIR, () => {
    if (mouvementReduit()) return;
    etat.tirs += 1;
    // Relance l'animation même si la précédente n'est pas finie (classe retirée, recalcul, classe remise).
    section.classList.remove('est-tir');
    void section.offsetWidth;
    section.classList.add('est-tir');
    if (!document.hidden && jouerCoupDeFeu()) etat.sons += 1;
  });
  document.addEventListener(EVENEMENT_TOUR, () => { if (!mouvementReduit()) etat.tours += 1; });
  section.addEventListener('animationend', (e) => {
    if (e.animationName === 'cadre-tir') section.classList.remove('est-tir');
  });
}

window.__zsAccueil = {
  etat: () => ({ ...etat, journal: [...etat.journal] }),
};
