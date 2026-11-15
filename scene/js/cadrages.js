// Cadrages de la planche (lot 1) : position de la caméra, point visé et champ vertical, dans le repère de la scène (stage : +z vers la
// caméra, +x à droite de l'image, unités du jeu). Un réglage par format : paysage 16:9 (ordinateur), portrait 9:16 (téléphone).
// placement (facultatif) : position du personnage 1 et du zombie pour ce format (le personnage 2 suit le zombie), à la place de
// PLACEMENT (js/poses.js).
export const CADRAGES = {
  A: {
    nom: 'Plan large de face',
    paysage: { cam: [4, 44, 225], vise: [10, 40, -50], fov: 36 },
    portrait: { cam: [-12, 40, 182], vise: [-6, 40, -30], fov: 50 },
  },
  B: {
    nom: 'Contre-plongée rapprochée',
    // Angle d'origine du cadrage B ; sur ordinateur, les personnages s'écartent (placement) : le titre centré de l'accueil ne cache plus rien.
    // Déplacements dans le repère de la caméra : personnage 1 (à genou) de 30 vers la gauche de l'image et 8 vers le fond (le pistolet reste dans le
    // cadre pendant le tir) ; zombie (et personnage 2) de 36 vers la droite et 8 vers le fond.
    paysage: { cam: [-46, 8, 122], vise: [4, 50, -30], fov: 44, placement: { p1: { x: -56, z: 17 }, zombie: { x: 58.7, z: -14.4 } } },
    portrait: { cam: [-40, 8, 126], vise: [-8, 31, -20], fov: 62 },
  },
  C: {
    nom: 'Trois quarts',
    paysage: { cam: [150, 40, 160], vise: [6, 42, -40], fov: 38 },
    portrait: { cam: [96, 34, 158], vise: [-14, 40, -6], fov: 54 },
  },
};
export const FORMATS = { paysage: 16 / 9, portrait: 9 / 16 };
