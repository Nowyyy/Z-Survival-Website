// Cadrages de la planche (lot 1) : position de la caméra, point visé et champ vertical, dans le repère de la scène (stage : +z vers la
// caméra, +x à droite de l'image, unités du jeu). Un réglage par format : paysage 16:9 (ordinateur), portrait 9:16 (téléphone).
export const CADRAGES = {
  A: {
    nom: 'Plan large de face',
    paysage: { cam: [4, 44, 225], vise: [10, 40, -50], fov: 36 },
    portrait: { cam: [-12, 40, 182], vise: [-6, 40, -30], fov: 50 },
  },
  B: {
    nom: 'Contre-plongée rapprochée',
    paysage: { cam: [-46, 8, 122], vise: [4, 50, -30], fov: 44 },
    portrait: { cam: [-34, 8, 118], vise: [0, 50, -20], fov: 62 },
  },
  C: {
    nom: 'Trois quarts',
    paysage: { cam: [150, 40, 160], vise: [6, 42, -40], fov: 38 },
    portrait: { cam: [96, 34, 158], vise: [-14, 40, -6], fov: 54 },
  },
};
export const FORMATS = { paysage: 16 / 9, portrait: 9 / 16 };
