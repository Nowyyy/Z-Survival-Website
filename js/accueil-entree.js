// Accueil : entrée en scène (idée « catchy » n° 2, après le lot 1). Une seule fois, à l'ouverture de la page sur l'accueil :
// grain VHS qui se dissipe sur l'image animée, chute du Z du logo (comme l'écran de chargement du jeu), coulures, puis l'accroche et le
// bouton. Tout est en CSS (css/accueil.css, « Entrée en scène »), déclenché par la classe entree-accueil sur <html>, posée dès le premier
// affichage par le script en tête d'index.html (sans attendre ce module : pas de délai). Ce module retire la classe à la fin.
// Mouvement réduit, ou arrivée directe sur une autre section (#news…) : la classe n'est jamais posée.
export const DUREE_ENTREE_MS = 4000; // fin de la dernière animation (goutte : 3,35 s + 0,55 s après la pose du logo), avec une marge

// enCours : l'entrée est-elle jouée (classe posée par la tête de page) ? surAccueil : la page s'est bien ouverte sur l'accueil.
export function lancerEntree(surAccueil) {
  const html = document.documentElement;
  if (!html.classList.contains('entree-accueil')) return false;
  if (!surAccueil) {
    html.classList.remove('entree-accueil');
    return false;
  }
  setTimeout(() => html.classList.remove('entree-accueil'), DUREE_ENTREE_MS);
  return true;
}
