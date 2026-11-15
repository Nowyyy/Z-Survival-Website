// Accueil : entrée en scène (idée « catchy » n° 2, après le lot 1). Une seule fois, à l'ouverture de la page sur l'accueil :
// grain VHS qui se dissipe sur l'image animée, chute du Z du logo (comme l'écran de chargement du jeu), coulures, puis l'accroche et le
// bouton. Tout est en CSS (css/accueil.css, « Entrée en scène ») : ce module pose la classe est-entree, puis la retire à la fin.
// Mouvement réduit, ou arrivée directe sur une autre section (#news…) : rien.
import { mouvementReduit } from './i18n.js';

export const DUREE_ENTREE_MS = 4000; // fin de la dernière animation (goutte : 3,35 s + 0,55 s), avec une marge

export function lancerEntree(section) {
  if (!section || mouvementReduit()) return;
  section.classList.add('est-entree');
  setTimeout(() => section.classList.remove('est-entree'), DUREE_ENTREE_MS);
}
