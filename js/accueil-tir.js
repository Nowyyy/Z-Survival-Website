// Accueil : le cadre rouge flashe au moment du coup de feu de l'image animée (idée « catchy » n° 1, après le lot 1).
// L'image animée (la vidéo du lot 2, ou l'aperçu de la scène 3D : scene/apercu.html) envoie l'événement « zs:tir » sur document
// à chaque coup de feu (à 5,2 s de la boucle de 8 s) ; le cadre et son halo s'illuminent puis reviennent, en 0,5 s environ.
// Mouvement réduit : aucun flash. Sans image animée (aujourd'hui sur le site), rien ne l'envoie : aucun effet.
import { mouvementReduit } from './i18n.js';

export const EVENEMENT_TIR = 'zs:tir';

export function installerFlashTir(section) {
  if (!section) return;
  document.addEventListener(EVENEMENT_TIR, () => {
    if (mouvementReduit()) return;
    // Relance l'animation même si le flash précédent n'est pas fini (classe retirée, recalcul, classe remise).
    section.classList.remove('est-tir');
    void section.offsetWidth;
    section.classList.add('est-tir');
  });
  section.addEventListener('animationend', (e) => {
    if (e.animationName === 'cadre-tir') section.classList.remove('est-tir');
  });
}
