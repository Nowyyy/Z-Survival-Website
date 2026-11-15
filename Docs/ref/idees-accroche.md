# Idées pour rendre l'accueil plus « catchy »

Proposées après le lot 1. L'objectif est de donner à l'accueil le côté vivant des sites de jeux (celui de ZZZ sert de repère) sans rien
reprendre de HoYoverse, dans la DA du jeu. Elles sont réalisées **une par une** pour voir les évolutions (choix du propriétaire).
Toutes respectent « réduire les animations » et restent légères (HTML, CSS, JS sans build).

| N° | Idée | État |
|---|---|---|
| 1 | **Le cadre rouge réagit au tir** : au coup de feu de l'image animée (5,2 s de la boucle), le cadre et son halo flashent. | **Fait** |
| 2 | **Entrée en scène** : grain VHS qui se dissipe sur l'image animée, chute du Z (écran de chargement du jeu), coulures. | **Fait** |
| 3 | Parallaxe : l'image animée bouge légèrement avec la souris ou l'inclinaison du téléphone. | Écartée (choix du propriétaire) |
| 4 | **Accroche « radio de survie »** : elle s'écrit lettre par lettre (lettre brouillée puis la vraie) et grésille de temps en temps. | **Fait** |
| 5 | Bandeau d'alerte qui défile en bas (flash d'urgence ; peut annoncer les actualités). | À faire |
| 6 | Bouton « En savoir plus » vivant au survol (coup de pinceau, coulure de sang). | À faire |
| 7 | Curseur viseur sur ordinateur, au-dessus de l'accueil. | À faire |

## 1 — Flash du cadre au tir
- **Site** :
  - `js/accueil-tir.js` écoute l'événement **`zs:tir`** sur `document` et ajoute la classe `est-tir` à la section de l'accueil.
  - `css/accueil.css` (animation `cadre-tir`, 0,52 s) : le cadre passe à `--color-action-hover`, son halo s'étend dehors et dedans,
    puis tout revient.
  - Mouvement réduit : aucun flash. Branché par `js/site.js`.
- **Qui envoie `zs:tir`** :
  - aujourd'hui, l'aperçu `scene/apercu.html`, qui suit le temps de la boucle de la scène 3D et signale chaque passage de l'instant
    du tir (`TIR` dans `scene/js/tir.js`) ; un saut de plus d'une seconde n'est pas compté ;
  - au lot 2, la vidéo de l'accueil enverra le même événement à 5,2 s de chaque boucle. Sans image animée, le site n'en reçoit
    aucun : aucun effet.

## 2 — Entrée en scène
- **Quand** : une seule fois, à l'ouverture de la page **sur l'accueil**. Rien si on arrive directement sur une autre section (`#news`…),
  rien en mouvement réduit.
- **Démarrage sans délai** (retour du propriétaire) : la classe `entree-accueil` est posée sur `<html>` par un petit script en tête
  d'`index.html`, dès le premier affichage. Avant, elle attendait le chargement des modules du site : léger délai. Le Z tombe dès que le
  logo est posé.
- **Code** : `js/accueil-entree.js` retire la classe après 4 s (ou tout de suite si la page ne s'ouvre pas sur l'accueil). Tout le reste est en CSS
  (`css/accueil.css`, « Entrée en scène ») ; un bloc `.accueil-vhs` est ajouté dans la zone de l'image animée (`index.html`).
- **Déroulé** :
  - **0 à 0,7 s** : grain VHS (neige qui saute, lignes, barre claire qui descend, dernier sursaut) qui se dissipe sur l'image animée
    (1,4 s au départ ; raccourci à la demande du propriétaire) ;
  - **0,45 s** : le Z tombe sur « -Survival », s'écrase, rebondit et bascule à 13° (même mouvement que l'écran de chargement du jeu,
    `css/menu.css` du jeu, animations `e7-*`, branche `dev`) ; **1,05 s** : impact, le titre tremble ;
  - **1,25 à 1,55 s** : l'accroche, le bouton et la flèche apparaissent ;
  - **2 à 3,9 s** : les trois coulures du Z s'allongent, puis une goutte se détache de la plus longue.

## 4 — Accroche « radio de survie »
- **Écriture** (`js/accueil-accroche.js`) : pendant l'entrée en scène, à 1,3 s (quand l'accroche apparaît), « Tenir jusqu'à l'aube. »
  s'écrit lettre par lettre. Chaque lettre passe d'abord par une lettre brouillée en rouge, puis la vraie (environ 0,09 s par lettre) ;
  un curseur rouge clignote derrière la dernière lettre puis s'efface.
  - Les lettres non écrites sont déjà à leur place (invisibles) : la ligne reste centrée, sans saut.
  - La phrase complète reste lue par les lecteurs d'écran (copie invisible).
  - Un changement de langue remet aussitôt le texte entier.
- **Grésillement** (`css/accueil.css`, animation `accroche-gresille`) : toutes les 7 s (à partir de 4 s), la ligne fait un court sursaut
  (décalage, inclinaison) avec un dédoublement rouge et bleu (jetons `--color-action`, `--color-focus`), comme une interférence radio.
- Mouvement réduit : texte fixe, ni écriture ni grésillement. Pas de son.
- Variante non retenue pour l'instant : horloge de nuit (« 23:47 — aube dans 5 h 13 »).

## Voir les effets sur la scène 3D
- `scene/apercu.html` ne charge le site qu'une fois la scène 3D affichée : l'entrée en scène (grain VHS, chute du Z, accroche qui
  s'écrit) se joue par-dessus la scène. Avant, le site arrivait en une fraction de seconde et son entrée se jouait sur fond noir, avant que la
  scène (plusieurs secondes de construction) soit visible.
- Pour revoir l'entrée : recharger la page de l'aperçu.
