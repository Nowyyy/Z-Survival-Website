// Boucle de l'image animée de l'accueil (lot 2b) : SEULES valeurs de temps partagées par la fabrication de la vidéo
// (outils/video/fabriquer.mjs, la scène 3D scene/js/boucle.js et scene/js/tir.js) et par le site (js/accueil-video.js,
// js/accueil-tir.js). Module pur (aucun DOM) : il est aussi lu par Node. Voir Docs/ref/scene-accueil.md.
export const DUREE_BOUCLE = 8; // secondes : un tour de la scène, donc de la vidéo
export const TEMPS_TIR = 5.2; // secondes : coup de feu du personnage 1 dans chaque tour
export const IMAGES_PAR_SECONDE = 30; // cadence de la vidéo (240 images par tour)
export const TEMPS_AFFICHE = 2.4; // secondes : instant de l'image fixe (affiche), loin de l'éclair du tir
