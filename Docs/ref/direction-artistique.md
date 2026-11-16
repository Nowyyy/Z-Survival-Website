# Direction artistique — reprise du jeu Z-Survival

Source : dépôt `Nowyyy/Z-Survival`, **branche `dev`** (commit `3c25e3a` du 2026-11-14), lu en
lecture seule. Le site reprend la DA du jeu : thème « sang noir ».

## Logo
- `js/logo.js` : **copie telle quelle** du `js/logo.js` du jeu (lot 8a). `poserLogo(element, texte)`
  remplace le texte « Z-Survival » par le logo : **Z rouge incliné de 13°** à contour sombre, trois
  coulures de sang qui sortent de dessous la lettre (SVG généré en code), puis « -Survival » couleur os.
  Le texte reste le nom accessible.
- Styles du logo : `css/base.css` (section « Logo »), mêmes règles que `css/base.css` du jeu.
- Utilisé fixe (sans animation) sur l'accueil et dans l'en-tête (`index.html`).
  L'animation de chute du Z (écran de chargement du jeu, `css/menu.css`) n'est pas reprise.
- Icônes (lot 4a) : `favicon.ico` (16, 32, 48 px), `img/icones/icone.svg`, `icone-180.png` (Apple), `icone-192.png`, `icone-512.png`,
  `icone-masquable-512.png` (Android), fabriquées par `outils/icones/fabriquer.mjs` depuis le logo du site (Z de la police du logo,
  incliné de 13°, contour et coulures de `js/logo.js`, jetons de couleur). Remplacent les anciennes `img/icone-48.png` et
  `img/icone-180.png` (copiées de l'icône du jeu, `scripts/icone.mjs`). Manifeste : `site.webmanifest`.

## Logo du studio (No Way Studio)
- `img/no-way-studio.svg` : copie du **logo fixe** du jeu (`assets/studio/no-way-studio-logo-fixe.svg`,
  branche dev ; animations coupées, aucun script ni ressource externe). Le jeu signe « Un jeu de No Way Studio ».
- Emplacements, sur le modèle des sites de jeux (signature de l'éditeur en haut à gauche et en pied de page) :
  - en-tête, à gauche du logo du jeu, séparé par un trait (à partir de 600 px de large ; 44 px de haut,
    60 px sur ordinateur) ;
  - coin haut gauche de l'accueil, dans le cadre rouge ;
  - section **About us** : grand logo **animé**, signature ; pied de page (petit logo fixe, © et licences).
- `img/no-way-studio-anime.svg` : copie du logo animé du jeu (`assets/studio/no-way-studio-logo-anime.svg`,
  animations CSS, aucun script ni ressource externe), **sans son**. Joué quand About us occupe 30 % de l'écran,
  rejoué à chaque retour (adresse Blob neuve à chaque fois, sinon l'animation ne repart pas). Mouvement réduit :
  logo fixe. Note du jeu (lot 8g) : l'allumage néon des lettres clignote ~5 fois par seconde pendant 0,7 s.
- Non repris : le son du logo, le logo de Noven Studio (écran Crédits du jeu).

## Couleurs (`css/base.css`, mêmes noms que `css/tokens.css` du jeu)
| Jeton | Valeur | Rôle |
|---|---|---|
| `--color-bg` | `#050505` | fond, noir profond |
| `--color-surface` | `#131313` | cartes, panneaux |
| `--color-surface-raised` | `#222224` | éléments surélevés |
| `--color-border` | `#6a6a6e` | contours |
| `--color-text` | `#f4f1ec` | texte (os) |
| `--color-text-muted` | `#b8b4ae` | texte secondaire |
| `--color-action` | `#d81414` | rouge sang : boutons, cadre, titres |
| `--color-action-text` | `#ff4a3d` | rouge lisible en petit texte |
| `--color-action-hover` / `-active` / `-deep` | `#ef2a2a` / `#a80f0f` / `#7a0a0a` | variantes |
| `--color-action-glow` | `rgb(216 20 20 / 55%)` | halo rouge |
| `--color-warning` | `#f2c94c` | marques « provisoire » |
| `--color-focus` | `#9fd3ff` | anneau de focus |
| `--menu-rouge`, `--menu-coulure-sombre`, `--menu-coulure-reflet`, `--menu-z-contour` | `#a50f0d`, `#4a0505`, `#c42a22`, `#1a0303` | logo |

## Polices (`fonts/`, licence SIL OFL 1.1, licences à côté des fichiers)
- **Rubik Wet Paint** : logo et titres de section (lettres qui dégoulinent).
- **Rubik Dirt** : libellés (navigation, catégories, statistiques, boutons d'arme). Sous-ensemble
  en majuscules seulement : toujours avec `text-transform: uppercase`.
- **Barlow** 400 / 700 : texte courant et boutons.

## Motifs repris
- Bouton rouge plein, coins arrondis 8 px, texte os en majuscules (« Entrer »).
- Cadre rouge lumineux autour de l'écran (accueil).
- **Coup de pinceau** blanc derrière l'entrée choisie (filtre SVG `#brush`, texte qui passe au
  rouge) : navigation des sections sur ordinateur.
- Titres en rouge sang avec halo (`text-shadow` `--color-action-glow`).
