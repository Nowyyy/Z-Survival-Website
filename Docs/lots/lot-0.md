# Lot 0 — squelette du site vitrine

> **Bilan historique** : le site a beaucoup évolué depuis (page unique, DA du jeu, langues, About us…).
> État actuel et récapitulatif des PR #2 à #7 : `Docs/lots/lot-0-retours.md`.

Branche `lot-0`, tag `lot-0`. Aucune PR ouverte, rien fusionné dans `main` par l'agent
(seul le commit d'initialisation `init: README` a été poussé sur `main`, le dépôt étant vide).

## Ce qui a été fait
- **A — Documentation** : `CLAUDE.md` (règles), `README.md`, `Docs/ref/scene-accueil.md`
  (scène animée validée), `Docs/ref/pile-technique.md` (relevé de Z-Survival).
- **B — Pages et navigation**
  - `index.html` : accueil plein écran, emplacement de l'image animée (fond sombre, brume
    qui dérive, mention « Image animée — à venir »), titre « Z-Survival », bouton « Entrer ».
  - `main.html` : sections plein écran **News**, **Characters**, **Weapons** ; défilement qui
    s'arrête sur chaque section (`scroll-snap-type: y mandatory` + `scroll-snap-stop: always`) ;
    navigation qui indique la section affichée (`aria-current`) et permet d'y sauter
    (barre d'onglets en bas sur téléphone, colonne à droite sur ordinateur) ; apparition
    animée du contenu à l'entrée de chaque section ; bouton « Jouer » vers le jeu
    (nouvel onglet) ; clavier (↑ ↓, Page préc./suiv., Début, Fin) ; ancres partageables
    (`main.html#weapons`).
  - Contenus provisoires marqués en jaune pointillé : 3 cartes d'actualité fictives
    (carrousel à glisser sur téléphone, grille sur ordinateur) ; grand emplacement
    personnage + 4 miniatures cliquables ; emplacement d'arme + 3 armes et 4 barres de
    statistiques fictives.
  - Organisation : `css/` (base, accueil, principal), `js/` ; **tous les textes dans
    `js/textes.js`** (bloc `fr`, prêt pour un bloc `en`), appliqués par `js/i18n.js`
    via les attributs `data-t` ; valeurs fictives dans `js/donnees.js`.
- **C — Déploiement** : `.github/workflows/pages.yml` (configure-pages, upload-pages-artifact,
  deploy-pages ; à chaque push sur `main`, et lançable à la main), `.nojekyll`.
  Seuls `index.html`, `main.html`, `css/`, `js/` sont publiés (pas `Docs/`).

## Ce qui a été vérifié (Chromium + Playwright, en local)
Site servi sous un sous-dossier `/Z-Survival-Website/` (comme sur GitHub Pages), avec
exactement les fichiers que publie le workflow. 84 vérifications, toutes réussies, en
**téléphone 375 × 667** et **ordinateur 1440 × 900**, chacun avec et sans mouvement réduit :
- aucune erreur ni avertissement dans la console, aucune requête en échec (pas de 404) ;
- « Entrer » mène à `main.html` ; le logo ramène à l'accueil ; « Jouer » pointe vers
  https://nowyyy.github.io/Z-Survival/ ;
- un défilement partiel (70 % d'écran) se termine exactement sur la section suivante ;
- la navigation suit la section affichée (au défilement, au clic, au clavier, et à
  l'arrivée par une ancre) ;
- le contenu de chaque section apparaît ; miniatures et choix d'arme fonctionnent ;
- pas de défilement horizontal ; sur téléphone, le contenu ne passe pas sous la barre de
  navigation ;
- `prefers-reduced-motion: reduce` : brume de l'accueil arrêtée, transitions coupées,
  défilement de navigation instantané.
- Aucun chemin ne commence par « / » (vérifié par recherche dans HTML, CSS, JS).
- Le fichier du workflow est un YAML valide.

## Limites connues
- **Nom du dépôt** : la consigne parle de `Z-Survival-site`, mais le dépôt GitHub s'appelle
  **`Nowyyy/Z-Survival-Website`**. GitHub Pages publiera donc sur
  **https://nowyyy.github.io/Z-Survival-Website/**. Tous les chemins étant relatifs, le site
  fonctionnera aussi si le dépôt est renommé plus tard en `Z-Survival-site`.
- Branche et tag portent le même nom (`lot-0`) : certaines commandes git ambiguës
  (ex. `git push origin lot-0`, `git checkout lot-0`) peuvent avertir ; préciser
  `refs/heads/lot-0` ou `refs/tags/lot-0` au besoin.
- Téléphone **en paysage** (écran bas) : la section News dépasse un peu la hauteur de
  l'écran ; le reste se défile à l'intérieur de la section avant de passer à la suivante.
  Characters et Weapons tiennent.
- Polices système uniquement (le titre utilise une police épaisse si elle existe sur
  l'appareil, sinon la police système) : l'identité visuelle viendra plus tard.
- Pas d'anglais pour l'instant (structure prête : ajouter un bloc `en` dans `js/textes.js`).
- Vérifié dans Chromium seulement ; Safari iOS et Firefox non testés ici.
- Le déploiement n'a pas pu être testé réellement (il ne se lance qu'après fusion dans
  `main` et activation de Pages).
- Clone du dépôt de référence `Nowyyy/Z-Survival` : réussi (lecture seule, dossier
  temporaire hors du dépôt, rien modifié).

## À faire par le propriétaire
1. Tester : https://github.com/Nowyyy/Z-Survival-Website/tree/lot-0 (ou en local :
   `python3 -m http.server 8000` puis http://localhost:8000/).
2. Ouvrir la Pull Request `lot-0` → `main`, relire, fusionner.
3. **Activer Pages** : Settings → Pages → Build and deployment → Source : **GitHub Actions**.
4. Après la fusion (ou en relançant le workflow à la main : onglet Actions →
   « Déploiement GitHub Pages » → Run workflow), vérifier
   https://nowyyy.github.io/Z-Survival-Website/.
