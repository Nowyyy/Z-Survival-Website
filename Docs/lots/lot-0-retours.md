# Lot 0 — retours du propriétaire (PR #2 à #7)

Suite du lot 0 (`Docs/lots/lot-0.md`), au fil des demandes du propriétaire, du 14 au 15/11/2026.
Chaque demande : une branche, une PR, **fusionnée par l'agent sans demander** (décision du propriétaire,
inscrite dans `CLAUDE.md`), puis vérification du site en ligne.

Site : https://nowyyy.github.io/Z-Survival-Website/

## Ce qui a été fait

| PR | Branche | Contenu |
|---|---|---|
| #2 | `lot-0-bientot-disponible` | Bouton « Jouer » remplacé par l'étiquette non cliquable **« Bientôt disponible »** (le lien du jeu reste dans `js/donnees.js`). Règle « l'agent fusionne » ajoutée à `CLAUDE.md`. |
| #3 | `direction-artistique` | **DA du jeu** (branche `dev` de Z-Survival, `3c25e3a`) : logo au **Z rouge incliné** avec coulures (`js/logo.js` copié du jeu), jetons de couleur « sang noir », polices Rubik Wet Paint / Rubik Dirt / Barlow (OFL, `fonts/`), icônes, coup de pinceau, cadre rouge. Règle « lire la branche `dev` du jeu, jamais `main` ». `Docs/ref/direction-artistique.md`. |
| #4 | `about-us` | Section **About us** (logo du studio, « Un jeu de No Way Studio », crédits « Création : Nowy », pied de page). **Logo de No Way Studio** (copie fixe du jeu) dans l'en-tête, le coin de l'accueil et le pied de page. |
| #5 | `accueil-une-page` | **Page unique** : l'accueil devient la 1re section de `index.html` ; **« En savoir plus »** + flèche animée descend vers les actualités, on peut remonter ; `main.html` redirige vers `./#news`. **Globe Français / English** sur l'accueil, traduction anglaise complète. Logo du studio plus grand dans l'en-tête. **Logo animé du studio** (sans son) dans About us, rejoué à chaque arrivée. |
| #6 | `accueil-nav-langue` | **01 Accueil** dans la navigation (sections renumérotées 02 à 05). **Intitulés traduits** (Actualités / Personnages / Armes / À propos ↔ News / Characters / Weapons / About us). **Second globe** dans l'en-tête, à côté de « Bientôt disponible ». |
| #7 | `langue-par-defaut` | **Langue par défaut selon le navigateur** : français si le visiteur est francophone, anglais sinon (`?lang=` puis choix du globe passent avant). Encarts **« Coming soon »** (en anglais) sur Personnages et Armes. |

## État actuel du site
- **Une seule page** (`index.html`) : Accueil (image animée à venir) → Actualités → Personnages → Armes → À propos.
  Défilement qui s'arrête sur chaque section ; en-tête et navigation cachés sur l'accueil.
- **En-tête** : logo du studio (à partir de 600 px de large), logo du jeu (remonte à l'accueil),
  « Bientôt disponible », globe de langue.
- **Navigation** : barre à 5 onglets en bas sur téléphone, colonne à droite avec coup de pinceau sur ordinateur ;
  clavier (flèches, Page préc./suiv., Début, Fin) ; adresses partageables (`#news`, `#characters`, `#weapons`, `#about`).
- **Langues** : français et anglais, mêmes clés dans `js/textes.js`. Priorité : `?lang=` → choix du globe
  (gardé dans le navigateur) → langue du navigateur.
- **Contenus provisoires** (marqués en jaune) : 3 actualités fictives ; Personnages et Armes sous un encart
  « Coming soon » ; texte de présentation d'About us.

## Vérifications
- Test Playwright de bout en bout (Chromium), lancé à chaque PR **en local sur la copie exacte de ce que publie
  le workflow** (servie sous `/Z-Survival-Website/`), puis **sur le site en ligne** après le déploiement :
  **194 vérifications**, téléphone 375 × 667 et ordinateur 1440 × 900, avec et sans `prefers-reduced-motion`,
  toutes réussies au dernier passage (PR #7, en local et en ligne). Couvre : accueil, menus de langue,
  traduction complète, « En savoir plus » et flèche, remontée vers l'accueil, défilement par section,
  navigation (clic, clavier, ancres), redirection de `main.html`, encarts « Coming soon », About us et logo
  animé rejoué, en-tête sans chevauchement, aucune erreur console ni fichier manquant.
- Test de la **langue par défaut** : 19 cas (fr-FR, fr-CA, fr-BE, fr-CH, fr-SN, en-US, en-GB, de-DE, es-ES,
  ja-JP, ar-MA, listes de langues combinées, priorité du globe et de `?lang=`), tous réussis en local et en ligne.
- Contrôles ponctuels : largeurs 320 et 360 px (en-tête, navigation à 5 onglets, titres, boutons d'arme),
  téléphone en paysage 667 × 375.
- Les scripts de test sont dans le dossier temporaire de la session (non versionnés).

## Limites connues
- Testé dans **Chromium seulement** (pas Safari iOS ni Firefox).
- **Langue par défaut** : basée sur la langue du navigateur, pas sur le pays (pas de géolocalisation).
  Un francophone dont le navigateur est en anglais verra l'anglais (le globe permet de changer).
- **Logo animé du studio** : l'allumage néon des lettres clignote ~5 fois par seconde pendant 0,7 s
  (au-delà des 3 par seconde recommandés) ; fichier repris tel quel du jeu ; logo fixe en mouvement réduit.
- Téléphone : logo du studio absent de l'en-tête sous 600 px (place) ; globe de l'en-tête sans « FR/EN » ;
  boutons de l'en-tête à 38 px de haut (sous les 44 px conseillés).
- Téléphone en paysage : la section Actualités dépasse un peu la hauteur de l'écran (défilement interne).
- Textes à fournir : présentation du studio (About us), vraies actualités ; « © 2026 No Way Studio » écrit par
  l'agent, à confirmer ; traduction anglaise écrite par l'agent, à relire.
- Tag `lot-0` : jamais poussé (refus 403 de l'environnement ; le propriétaire a dit de laisser).
- Non repris du jeu : son du logo, logo de Noven Studio.

## Prochaines étapes possibles
- Scène 3D de l'accueil puis vidéo en boucle (`Docs/ref/scene-accueil.md`, `Docs/ref/pile-technique.md`).
- Vrais contenus : actualités, personnages, armes, texte du studio.
- Remettre « Jouer » quand le jeu sera publié (`LIEN_JEU` dans `js/donnees.js`).
