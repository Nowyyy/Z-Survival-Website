# CLAUDE.md — règles du projet Z-Survival-site

Site vitrine du jeu **Z-Survival** (jeu web de survie zombies en Three.js, vue de dessus,
publié sur https://nowyyy.github.io/Z-Survival/).

## Fonctionnement par lots
- Le travail avance par **lots** numérotés (lot-0, lot-1, …). Chaque lot a sa consigne.
- Une branche par lot : `lot-N`, créée depuis `main` à jour.
- **Un commit par partie** du lot (`lot-N A: …`, `lot-N B: …`, …).
- En fin de lot : un bilan dans `Docs/lots/lot-N.md`, puis le tag `lot-N` et le push de
  la branche et du tag.
- **L'agent ouvre la Pull Request vers `main` et la fusionne lui-même, sans demander**
  (décision du propriétaire), une fois les vérifications passées. Il vérifie ensuite le
  déploiement GitHub Pages.

## Interdits
- **Aucun contenu de HoYoverse** (Zenless Zone Zero ou autre) : ni image, ni logo, ni police,
  ni vidéo, ni son, ni code. On s'inspire seulement de la mise en page et des effets.
- Le dépôt **Nowyyy/Z-Survival** est une référence **en lecture seule** : on peut le cloner
  dans un dossier temporaire **hors de ce dépôt** pour le lire, jamais le modifier ni y pousser.
  **Toujours lire sa branche `dev`, jamais `main`** (en retard).

## Règles techniques
- HTML, CSS et JavaScript en modules ES, sans étape de build (tant qu'un lot n'en décide pas autrement).
- **Téléphone d'abord** : le rendu en portrait (375 px de large) est la référence, puis l'ordinateur.
- **`prefers-reduced-motion`** respecté partout : animations réduites ou coupées.
- Textes regroupés dans `js/textes.js` (français et anglais : toute nouvelle clé s'écrit dans les deux langues),
  jamais éparpillés dans le HTML. Intitulés de section traduits : Accueil / Actualités / Personnages / Armes /
  À propos en français, Home / News / Characters / Weapons / About us en anglais (identifiants #news, #characters,
  #weapons, #about inchangés).
- Le site est servi sous un sous-dossier GitHub Pages : **aucun chemin ne commence par « / »**
  (chemins relatifs uniquement).
- Les contenus provisoires sont clairement marqués comme tels à l'écran.
- **Direction artistique = celle du jeu** (`Docs/ref/direction-artistique.md`) : couleurs en jetons
  dans `css/base.css` (mêmes noms que `css/tokens.css` du jeu), logo au Z incliné (`js/logo.js`),
  polices du jeu dans `fonts/` (licences OFL à garder à côté). Pas de couleur en dur hors jetons
  quand un jeton existe.

## Organisation
- `index.html` : **page unique**. Accueil plein écran (image animée à venir, logo du studio, globe
  Français / English, « En savoir plus » + flèche qui descend vers News), puis les sections plein écran
  News / Characters / Weapons / About us. Navigation : 01 Accueil à 05 About us. Personnages et Armes :
  contenu provisoire atténué et inerte sous un encart « Prochainement » (« Coming soon » en anglais). Globe de langue aussi
  dans l'en-tête ; « Bientôt disponible », bouton de son et globe en haut à droite de l'accueil comme dans l'en-tête (About us : logo animé du studio rejoué à chaque arrivée,
  puis pied de page). En-tête et navigation cachés sur l'accueil.
- `main.html` : ancienne page principale, simple redirection vers `./#news` (garde l'ancre).
- `css/`, `js/` : styles et scripts ; `js/site.js` : script de la page ; `js/textes.js` : tous les textes
  (blocs `fr` et `en`, mêmes clés) ; `js/i18n.js` : langue (priorité : `?lang=`, puis choix gardé du globe, puis langue du navigateur :
  français pour les visiteurs francophones, anglais pour les autres ; aucune géolocalisation) ;
  `js/logo.js` : logo du jeu ;
  `js/musique.js` : musique M2 et boutons de son à côté de chaque globe (règles : `Docs/ref/musique.md`, volume : constante `VOLUME`).
- `musique/` : propositions de musique (MP3 en boucle, points de boucle dans `boucles.json` ; **M2 retenue**, règles
  d'intégration dans `Docs/ref/musique.md`) et planche d'écoute
  `planche.html` (noindex, non reliée au site) ; `outils/musique/` : script qui génère la musique (`Docs/ref/musique.md`).
- `fonts/` : polices du jeu (+ licences) ; `img/` : icônes et logos du studio (`no-way-studio.svg` fixe, `no-way-studio-anime.svg` animé).
- `scene/` (lot 1) : atelier de la scène 3D de l'accueil, hors du site (noindex, aucun lien depuis l'accueil) :
  `scene/index.html` (la scène, `?cadrage=A|B|C&format=paysage|portrait|plein`, **B retenu**), `scene/planche.html` (planche),
  `scene/apercu.html` (la scène sous la vraie page d'accueil, pour juger le rendu),
  `scene/jeu/` (copie figée du jeu, jamais retouchée), `scene/js/` (scène, poses, enrichissements), `scene/outils/`
  (copie, captures, vérification de la boucle ; Node + Playwright, non publiés).
- `Docs/ref/` : documents de référence ; `Docs/lots/` : bilans de lot.
- `.github/workflows/pages.yml` : déploiement GitHub Pages à chaque push sur `main`.
