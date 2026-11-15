// Cadrages de la planche (lot 1) : position de la caméra, point visé et champ vertical, dans le repère de la scène (stage : +z vers la
// caméra, +x à droite de l'image, unités du jeu). Un réglage par format : paysage 16:9 (ordinateur), portrait 9:16 (téléphone).
export const CADRAGES = {
  A: {
    nom: 'Plan large de face',
    paysage: { cam: [4, 44, 225], vise: [10, 40, -50], fov: 36 },
    portrait: { cam: [-6, 40, 250], vise: [2, 44, -30], fov: 52 },
  },
  B: {
    nom: 'Contre-plongée rapprochée',
    paysage: { cam: [-46, 8, 122], vise: [4, 50, -30], fov: 44 },
    portrait: { cam: [-40, 8, 150], vise: [-2, 52, -20], fov: 64 },
  },
  C: {
    nom: 'Trois quarts',
    paysage: { cam: [150, 40, 160], vise: [-6, 36, -30], fov: 38 },
    portrait: { cam: [140, 38, 175], vise: [-6, 42, -20], fov: 56 },
  },
};
export const FORMATS = { paysage: 16 / 9, portrait: 9 / 16 };
