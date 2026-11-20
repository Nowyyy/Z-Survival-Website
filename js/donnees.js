// Lot 6a — INTERRUPTEUR de la nouvelle section Armes (js/section-armes.js, Docs/ref/armes.md), seul endroit où il se règle.
// false : la section Armes reste l'encart « Prochainement » (contenu provisoire ci-dessous) et aucun fichier de la nouvelle section n'est
// téléchargé (ni js/section-armes.js, ni css/section-armes.css, ni contenus/armes.json, ni img/armes/).
// true : la nouvelle section est publiée pour tous les visiteurs.
// Aperçu pour le propriétaire, interrupteur éteint : ajouter ?apercu=armes à l'adresse (https://zsurvival-game.com/?apercu=armes#weapons).
export const SECTION_ARMES_ACTIVE = true; // publiée (demande du propriétaire, lot 6a) ; armes réglées depuis l'admin (Pages du site → Armes)

// Données provisoires (sans texte) : valeurs de 0 à 100 pour les barres de statistiques.
// Les noms des armes sont dans js/textes.js (weapons.armes.<id>).
export const ARMES = [
  { id: 'pistolet', stats: { degats: 35, cadence: 70, portee: 45, chargeur: 40 } },
  { id: 'fusil', stats: { degats: 90, cadence: 25, portee: 20, chargeur: 20 } },
  { id: 'carabine', stats: { degats: 65, cadence: 45, portee: 90, chargeur: 30 } },
];

// Lien du jeu, pour quand le bouton « Jouer » reviendra (remplacé par « Bientôt disponible »).
export const LIEN_JEU = 'https://nowyyy.github.io/Z-Survival/';
