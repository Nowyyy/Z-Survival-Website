# CLAUDE.md — règles du projet Z-Survival-site

Site vitrine du jeu **Z-Survival** (jeu web de survie zombies en Three.js, vue de dessus,
publié sur https://nowyyy.github.io/Z-Survival/).

## Fonctionnement par lots
- Le travail avance par **lots** numérotés (lot-0, lot-1, …). Chaque lot a sa consigne.
- Une branche par lot : `lot-N`, créée depuis `main` à jour.
- **Un commit par partie** du lot (`lot-N A: …`, `lot-N B: …`, …).
- En fin de lot : un bilan dans `Docs/lots/lot-N.md`, puis le tag `lot-N` et le push de
  la branche et du tag.
- **L'agent n'ouvre pas de Pull Request et ne fusionne rien dans `main`.** Le propriétaire
  teste, ouvre la PR et fusionne lui-même.

## Interdits
- **Aucun contenu de HoYoverse** (Zenless Zone Zero ou autre) : ni image, ni logo, ni police,
  ni vidéo, ni son, ni code. On s'inspire seulement de la mise en page et des effets.
- Le dépôt **Nowyyy/Z-Survival** est une référence **en lecture seule** : on peut le cloner
  dans un dossier temporaire **hors de ce dépôt** pour le lire, jamais le modifier ni y pousser.

## Règles techniques
- HTML, CSS et JavaScript en modules ES, sans étape de build (tant qu'un lot n'en décide pas autrement).
- **Téléphone d'abord** : le rendu en portrait (375 px de large) est la référence, puis l'ordinateur.
- **`prefers-reduced-motion`** respecté partout : animations réduites ou coupées.
- Textes regroupés dans `js/textes.js` (français aujourd'hui, prévu pour l'anglais),
  jamais éparpillés dans le HTML. Les intitulés de section restent « News », « Characters », « Weapons ».
- Le site est servi sous un sous-dossier GitHub Pages : **aucun chemin ne commence par « / »**
  (chemins relatifs uniquement).
- Les contenus provisoires sont clairement marqués comme tels à l'écran.

## Organisation
- `index.html` : accueil plein écran (image animée à venir) + bouton « Entrer ».
- `main.html` : page principale, sections plein écran News / Characters / Weapons.
- `css/`, `js/` : styles et scripts ; `js/textes.js` : tous les textes.
- `Docs/ref/` : documents de référence ; `Docs/lots/` : bilans de lot.
- `.github/workflows/pages.yml` : déploiement GitHub Pages à chaque push sur `main`.
