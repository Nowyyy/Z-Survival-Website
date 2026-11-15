// Accueil : entrée en scène (idée « catchy » n° 2 ; lot 2b : 1,5 s au plus, première visite de la session seulement).
// 1. La chute du Z de l'écran de chargement du jeu (copie figée : css/accueil-chute-z.css, depuis css/menu.css du jeu, branche dev) :
//    chute, écrasement, rebond, bascule à 13° ; le titre tremble à l'impact (0,6 s).
// 2. Puis un léger grain VHS, posé sur l'image animée dès le départ, se dissipe (fondu continu, sans clignotement) et laisse apparaître
//    la scène ; l'accroche, le bouton et la flèche arrivent après l'impact. Tout est fini à 1,5 s.
// Tout est en CSS (css/accueil.css, « Entrée en scène »), déclenché par la classe entree-accueil sur <html>, posée dès le premier
// affichage par le script en tête d'index.html (sans attendre ce module : pas de délai). Ce script de tête ne la pose qu'à la première
// visite de la session (sessionStorage, protégé par try/catch) ; ?intro=1 la force à chaque chargement (essais).
// Un toucher, un clic ou une touche la passe aussitôt (le site reste utilisable pendant l'entrée : rien ne bloque les clics).
// Mouvement réduit, ou arrivée directe sur une autre section (#news…) : la classe n'est jamais posée.
export const DUREE_ENTREE_MS = 1500;
export const CLE_SESSION = 'z-survival-site.entree';

let fin = null;

// surAccueil : la page s'est bien ouverte sur l'accueil ; auPasser : appelé si le visiteur passe l'entrée (accroche écrite d'un coup).
// Retour : vrai si l'entrée est jouée.
export function lancerEntree(surAccueil, auPasser = () => {}) {
  const html = document.documentElement;
  if (!html.classList.contains('entree-accueil')) return false;
  if (!surAccueil) {
    html.classList.remove('entree-accueil');
    return false;
  }
  const evenements = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  const terminer = (passee) => {
    if (!html.classList.contains('entree-accueil')) return;
    html.classList.remove('entree-accueil');
    clearTimeout(fin);
    evenements.forEach((e) => document.removeEventListener(e, passer, true));
    html.dataset.entree = passee ? 'passee' : 'finie';
    if (passee) auPasser();
  };
  function passer() { terminer(true); }
  evenements.forEach((e) => document.addEventListener(e, passer, { capture: true, passive: true }));
  // 1,5 s depuis la pose de la classe par la tête de page (les animations CSS sont parties à ce moment-là), pas depuis ce module.
  const debut = Number(html.dataset.entreeDebut);
  const ecoule = Number.isFinite(debut) ? performance.now() - debut : 0;
  fin = setTimeout(() => terminer(false), Math.max(0, DUREE_ENTREE_MS - ecoule));
  return true;
}
