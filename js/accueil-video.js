// Accueil : vidéo en boucle de la scène (lot 2b), fabriquée par outils/video/fabriquer.mjs depuis la scène 3D du lot 1 (la page ne
// charge pas Three.js). Deux versions : 16:9 (écran en paysage) et 9:16 (écran en portrait, tablette comprise), choisies selon la forme
// de l'écran et changées quand on le tourne (reprise au même instant de la boucle).
// - Sous la vidéo, l'affiche (image fixe WebP, <picture> d'index.html, même choix portrait / paysage) : visible au chargement, si la
//   lecture automatique est bloquée (mode économie d'énergie de l'iPhone…) et en mouvement réduit. La vidéo reste invisible tant qu'elle ne
//   joue pas vraiment : jamais de bouton de lecture du navigateur.
// - Mouvement réduit : AUCUNE vidéo téléchargée (l'élément n'a pas de source) ; affiche seule.
// - Le téléchargement ne commence qu'après les polices du titre (ou 1,5 s au plus) : la vidéo ne retarde ni le titre ni les boutons.
// - La lecture démarre à l'instant de l'affiche (TEMPS_AFFICHE) : le passage de l'image fixe à la vidéo ne se voit pas.
// - Accueil quitté (News…) ou onglet caché : la vidéo est mise en pause, elle reprend au retour ; page ouverte sur une autre section :
//   rien n'est téléchargé avant l'arrivée sur l'accueil.
// - ?video=0 (atelier : scene/apercu.html, où la scène 3D tourne dessous) : pas de vidéo.
import { TEMPS_AFFICHE } from './accueil-boucle.js';
import { mouvementReduit } from './i18n.js';

export const VIDEOS = {
  portrait: { mp4: 'img/accueil/accueil-9x16.mp4', affiche: 'img/accueil/accueil-9x16.webp' },
  paysage: { mp4: 'img/accueil/accueil-16x9.mp4', affiche: 'img/accueil/accueil-16x9.webp' },
};
const ATTENTE_POLICES_MS = 1500;

function videoDemandee() {
  try { return new URLSearchParams(window.location.search).get('video') !== '0'; } catch { return true; }
}

// video : l'élément <video> de l'accueil ; section : la section d'accueil. Retour : l'élément si une vidéo est chargée, sinon null.
export function installerVideo(video, section) {
  if (!video || !section || mouvementReduit() || !videoDemandee()) return null;
  const portrait = window.matchMedia('(orientation: portrait)');
  const forme = () => (portrait.matches ? 'portrait' : 'paysage');
  let actuelle = null; // forme de la source chargée
  let reprise = TEMPS_AFFICHE; // instant où reprendre après un changement de source
  let surAccueil = false; // mis à jour par l'observateur ci-dessous (premier appel tout de suite)
  let pret = false; // polices du titre chargées (ou délai écoulé)
  let bloquee = false; // lecture automatique refusée par le navigateur

  // La vidéo n'apparaît que lorsqu'une image est vraiment affichée en lecture.
  const montrer = () => { if (!video.paused) video.classList.add('est-lue'); };
  video.addEventListener('playing', () => {
    bloquee = false;
    if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(montrer);
    else montrer();
  });

  const doitJouer = () => surAccueil && !document.hidden;
  function jouer() {
    if (!actuelle || !doitJouer()) return;
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => { bloquee = true; video.classList.remove('est-lue'); }); // affiche seule, propre
    }
  }

  function charger() {
    const voulue = forme();
    if (voulue === actuelle) return;
    if (actuelle) reprise = video.currentTime; // rotation : même instant de la boucle dans l'autre version
    actuelle = voulue;
    video.classList.remove('est-lue'); // l'affiche de la nouvelle forme (<picture>) le temps du chargement
    video.poster = VIDEOS[voulue].affiche;
    video.src = VIDEOS[voulue].mp4;
    video.dataset.forme = voulue;
    const t = reprise;
    video.addEventListener('loadedmetadata', () => {
      try { video.currentTime = Math.min(t, Math.max(0, video.duration - 0.05)); } catch { /* sans effet */ }
      jouer();
    }, { once: true });
    video.load();
  }

  video.muted = true; // exigé pour la lecture automatique (attribut muted aussi présent dans le HTML)
  video.defaultMuted = true;
  portrait.addEventListener('change', () => { if (actuelle) charger(); });

  // Pause quand l'accueil n'est plus à l'écran, reprise au retour.
  const conteneur = section.closest('.sections');
  new IntersectionObserver(([e]) => {
    surAccueil = e.intersectionRatio > 0.05;
    if (!surAccueil) video.pause();
    else if (actuelle) jouer();
    else if (pret) charger(); // page ouverte sur une autre section (#news…) : la vidéo n'est chargée qu'à l'arrivée sur l'accueil
  }, { root: conteneur, threshold: [0, 0.05, 0.5] }).observe(section);
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); else jouer(); });
  // Lecture refusée (économie d'énergie) : un nouvel essai au premier toucher ou clic du visiteur, sans rien afficher d'autre.
  document.addEventListener('pointerdown', () => { if (bloquee) jouer(); }, { passive: true });

  const polices = document.fonts?.ready ?? Promise.resolve();
  Promise.race([polices, new Promise((ok) => { setTimeout(ok, ATTENTE_POLICES_MS); })])
    .then(() => new Promise((ok) => { requestAnimationFrame(() => ok()); }))
    .then(() => { pret = true; if (surAccueil) charger(); });
  return video;
}
