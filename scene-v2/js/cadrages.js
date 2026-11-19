// Cadrages de la planche (lot 1 ; scène v2 : même caméras, lot 5a) : position de la caméra, point visé et champ vertical, dans le repère de la scène (stage : +z vers la
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
    // Angle d'origine du cadrage B. Sur ordinateur, le zombie (et le personnage 2 qui le suit) est décalé de 54 vers la droite de l'image et
    // 8 vers le fond : le titre centré de l'accueil ne le cache plus, même tourné vers le personnage 1 (sa tête passe alors plus à gauche). Le personnage 1, à genou, garde sa place d'origine, au centre.
    // v2 (lot 5a) : point visé par le personnage 1 au Kar98k (p1Vise), propre au format : à gauche de la caméra, assez bas pour que la bouche
    // du fusil et l'éclair du tir restent dans l'image (js/poses.js, PLACEMENT.p1Vise).
    paysage: { cam: [-46, 8, 122], vise: [4, 42, -30], fov: 44, placement: { zombie: { x: 75.8, z: -8.8 }, p1Vise: [-800, 0, 700] } },
    portrait: { cam: [-40, 8, 126], vise: [-8, 31, -20], fov: 62, placement: { p1Vise: [-300, 0, 900] } },
  },
  C: {
    nom: 'Trois quarts',
    paysage: { cam: [150, 40, 160], vise: [6, 42, -40], fov: 38 },
    portrait: { cam: [96, 34, 158], vise: [-14, 40, -6], fov: 54 },
  },
};
export const FORMATS = { paysage: 16 / 9, portrait: 9 / 16 };
