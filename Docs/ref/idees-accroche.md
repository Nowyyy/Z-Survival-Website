# Idées pour rendre l'accueil plus « catchy »

Proposées après le lot 1. L'objectif est de donner à l'accueil le côté vivant des sites de jeux (celui de ZZZ sert de repère) sans rien
reprendre de HoYoverse, dans la DA du jeu. Elles sont réalisées **une par une** pour voir les évolutions (choix du propriétaire).
Toutes respectent « réduire les animations » et restent légères (HTML, CSS, JS sans build).

| N° | Idée | État |
|---|---|---|
| 1 | **Le cadre rouge réagit au tir** : au coup de feu de l'image animée (5,2 s de la boucle), le cadre et son halo flashent. | **Fait** |
| 2 | Entrée en scène : chute du Z (écran de chargement du jeu), puis grain VHS qui se dissipe sur la scène. | À faire |
| 3 | Parallaxe : l'image animée bouge légèrement avec la souris ou l'inclinaison du téléphone. | À faire |
| 4 | Accroche « radio de survie » qui s'écrit avec un grésillement, ou horloge de nuit jusqu'à l'aube. | À faire |
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
