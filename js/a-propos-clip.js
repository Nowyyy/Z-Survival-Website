// À propos, bloc du jeu (lot 4b) : clip du jeu en boucle (8 s, img/a-propos/jeu-clip.mp4, fabriqué par outils/clip-jeu/fabriquer.mjs),
// posé sur son affiche (img/a-propos/jeu-clip.webp).
// - Rien n'est téléchargé avant que le bloc soit à l'écran : la source de la vidéo n'est posée qu'à la première apparition.
// - Lecture quand le bloc est visible, pause quand il sort de l'écran ou que l'onglet est caché.
// - La vidéo reste invisible tant qu'elle ne joue pas vraiment (lecture automatique bloquée : seule l'affiche se voit).
// - Mouvement réduit : jamais de vidéo, seulement l'affiche.
import { mouvementReduit } from './i18n.js';

export const SOURCE_CLIP = 'img/a-propos/jeu-clip.mp4';

export function installerClipJeu({ racine = document.getElementById('sections') } = {}) {
  const video = document.querySelector('.about-jeu-clip');
  if (!video || mouvementReduit() || typeof IntersectionObserver !== 'function') return;
  let visible = false;
  const jouer = () => {
    if (!visible || document.hidden) return;
    if (!video.getAttribute('src')) video.src = SOURCE_CLIP;
    video.play()?.catch(() => { /* lecture automatique refusée : l'affiche reste */ });
  };
  video.addEventListener('playing', () => video.classList.add('est-lue'));
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && e.intersectionRatio >= 0.25;
    if (visible) jouer(); else video.pause();
  }, { root: racine, threshold: [0, 0.25, 0.6] }).observe(video.closest('.about-jeu-media') ?? video);
  document.addEventListener('visibilitychange', () => (document.hidden ? video.pause() : jouer()));
}
