# Lot 4b — À propos : clip du vrai jeu à la place de l'image

Branche `lot-4b`, depuis `main` (`3accabe`). Demande du propriétaire : « pour l'image du jeu dans la partie À propos, enregistrer un petit clip
du jeu avec le perso qui tire sur des zombies, une petite boucle de 5-10 s pas plus ».

## Ce qui a été fait

### A — Fabrication du clip (`outils/clip-jeu/fabriquer.mjs`, mode d'emploi `outils/clip-jeu/LISEZMOI.md`)
- Le clip vient du **vrai jeu** : dépôt `Nowyyy/Z-Survival`, **branche `dev`** (commit noté dans `img/a-propos/fabrication.json`), copié
  en lecture seule dans un dossier temporaire **hors de ce dépôt**, jamais modifié.
- Le jeu est servi en local et ouvert dans Chromium sans écran, avec **son propre accès de test** (`jeu.html?test=1`) :
  - graine fixe, aucune vague automatique ;
  - sans effet VHS (plus net à petite taille, et plus léger) ;
  - zoom maximal du jeu ;
  - HUD masqué.
- **Horloge contrôlée** (Playwright) : chaque image avance le jeu d'exactement 1/30 s, quel que soit le temps de rendu (environ 1,5 s par
  image en rendu logiciel). L'animation est donc fluide.
- **Action** : quatre petits groupes de zombies arrivent de plusieurs côtés à des instants fixes. Le survivant pivote vers le plus proche,
  vite mais pas d'un coup (520° par seconde au plus). Le tir est celui du jeu : automatique quand un zombie est dans la ligne de visée, avec
  laser, éclair au canon, sang, zombies qui tombent. **10 zombies tués** en 8 s, sans que le survivant soit touché.
- **Cadrage** : 800 × 450 autour du joueur dans une fenêtre de 1600 × 900, soit des personnages deux fois plus grands qu'en plein écran,
  sans perte de netteté.
- **Boucle de 8 s** : 255 images rendues ; les 15 dernières sont fondues dans les 15 premières (0,5 s). La fin rejoint le début sans saut :
  les corps au sol s'effacent pendant ce fondu.
- **Fichiers** (`img/a-propos/`) :

| Fichier | Contenu | Poids |
|---|---|---|
| `jeu-clip.mp4` | 800 × 450, 30 im/s, 240 images (8 s), H.264 High 4.0, `yuv420p`, sans son, faststart, léger éclaircissement | **256 Kio** |
| `jeu-clip.webp` | affiche (image fixe du clip : le survivant qui tire) | 16 Kio |
| `fabrication.json` | commit du jeu, réglages, zombies tués, empreintes SHA-256 | — |

### B — Site (`index.html`, `css/principal.css`, `js/a-propos-clip.js`, `js/site.js`, `js/textes.js`)
- Dans le bloc « Le jeu » d'À propos, le clip remplace l'ancienne image (l'affiche de l'accueil), **dans le même cadre rouge**, à la même
  taille.
- Comme la vidéo de l'accueil :
  - l'**affiche** est dessous et la vidéo par-dessus ;
  - la vidéo reste invisible tant qu'elle ne joue pas vraiment : sans lecture automatique (mode économie d'énergie de l'iPhone), on voit
    l'affiche, sans bouton de lecture ;
  - **rien n'est téléchargé** avant que le bloc soit à l'écran (la source n'est posée qu'à ce moment-là) ;
  - lecture quand le bloc est visible, **pause** quand on quitte la section ou que l'onglet est caché ;
  - **mouvement réduit** : jamais de vidéo, seulement l'affiche.
- Texte de remplacement de l'image mis à jour (FR et EN) : « Z-Survival en jeu, vu de dessus : le survivant tire sur des zombies qui
  l'encerclent. »

## Vérifications
**`outils/verifier-lot-4b.mjs`** (nouveau), sur la copie exacte de ce que publie le workflow, servie à la racine : **26/26**.
- Fichier : une seule piste (vidéo), H.264 High `yuv420p`, 800 × 450, 30 im/s, 240 images, 8,00 s, index en tête, moins de 1 Mio ;
  affiche WebP 800 × 450.
- Raccord de la boucle (vidéo décodée) : du même ordre que les plus grands passages d'image naturels du clip (un tir, un zombie qui tombe).
  Sur les images avant encodage, il est plus faible que le plus grand passage naturel. Dans la vidéo, la compression y ajoute moins d'un
  niveau de gris en moyenne, ce qui est invisible.
- Site à 375 × 667 et 1440 × 900, avec et sans mouvement réduit :
  - aucune requête vers le clip avant l'arrivée sur À propos ;
  - à l'arrivée, le clip joue, visible, sur son affiche et dans le cadre rouge ;
  - pause en quittant la section ;
  - en mouvement réduit, affiche seule et aucune requête vidéo ;
  - aucune erreur console, aucun fichier manquant.
- **Pas reproductible au bit près** (vérifié : deux fabrications donnent des fichiers différents). La chorégraphie est la même (mêmes zombies
  aux mêmes instants, 10 tués), mais le jeu tourne un peu en temps réel pendant son chargement, avant que l'horloge soit prise en main :
  son temps de départ varie de quelques centièmes de seconde, et avec lui des détails (flammes, lumières, sang). La version retenue est
  décrite dans `fabrication.json`.
- `outils/verifier-lot-4a.mjs` (À propos, console, fichiers manquants) : **79/79**.

## Limites
- **Le clip n'est pas reproductible au bit près** (voir Vérifications) : le refaire donne la même scène, pas exactement les mêmes images.
- **Le clip est figé** : si le jeu change (personnages, salle de départ), il faut le refaire (`node outils/clip-jeu/fabriquer.mjs`, environ
  6 minutes). Si la salle de départ change beaucoup, ajuster les positions d'arrivée des zombies (`REGLAGES.vagues`).
- Image du jeu **sans l'effet VHS** du jeu : choisi pour la netteté à petite taille et le poids. Il peut être remis (`vhs=0` → `vhs=1` dans
  `REGLAGES.adresse`), mais le grain rend la vidéo plus lourde.
- Lecture testée dans Chromium seulement. Le format (H.264 High, `yuv420p`, faststart, `muted playsinline`) est celui de la vidéo de
  l'accueil, lue par Safari et Chrome sur téléphone.

## À tester toi-même
1. https://zsurvival-game.com/#about : le clip joue dans le bloc « Le jeu », en boucle, sans saut visible.
2. Sur téléphone : il démarre en arrivant sur À propos ; en mode économie d'énergie de l'iPhone, l'affiche fixe reste, sans bouton de lecture.
3. Réglages → Accessibilité → Réduire les animations : affiche fixe seulement.

## Retour du propriétaire (15/11/2026, branche `lot-4b-retours`) : le survivant se déplace, visée moins « automatique »
- **Déplacement** : le survivant marche sur un huit autour de son point de départ (allure de marche, environ 100 u/s au plus), commandé comme un
  joystick analogique. Le huit dure exactement 8 s : il revient à son point de départ au bout de la boucle, le raccord reste propre. La caméra
  du jeu le suit, le décor défile.
- **Visée humaine** :
  - après un zombie abattu, **temps de réaction** de 0,2 à 0,3 s avant de viser le suivant ;
  - **rotation amortie** : elle accélère, dépasse un peu la cible puis se reprend, au lieu de se verrouiller d'un coup ;
  - petit **tremblement** de la main ;
  - sans cible, le regard suit la direction de marche.
  Le tir reste celui du jeu ; en marchant, son cône s'élargit et des balles partent à côté. Résultat : 8 zombies tués en 8 s (10 avant), et le
  survivant se fait toucher une fois.
- **Images éteintes** : avec la caméra en mouvement, la carte d'ombres du soleil du jeu rate parfois une ou deux images (une bande d'ombre
  couvre la moitié de la scène, puis tout revient). Le jeu, mesuré dans sa propre image, ne montre pas cette baisse : c'est un défaut du rendu
  logiciel du navigateur sans écran. Le script repère ces images après le rendu (sous 85 % de la luminosité de leurs voisines) et les remplace
  par le mélange des images saines qui les entourent. Les images réparées sont notées dans `fabrication.json`.
- Vidéo plus lourde, parce que le décor défile : **410 Kio** (256 Kio avant), affiche de 16 Kio. Sept images réparées dans cette version
  (14, 49, 50, 132, 133, 170, 254 sur 255).
- Vérifications :
  - `outils/verifier-lot-4b.mjs` **26/26** (le site ne change pas, seul le clip est refait) ;
  - raccord de la boucle 5,76, contre 4,44 en médiane pour les passages d'image ordinaires (le décor bouge) ;
  - plus aucune image éteinte : la luminosité ne descend jamais sous 90 % de ses voisines (le creux restant est le vacillement normal de la
    lampe murale du jeu, progressif).

## Second retour (15/11/2026, branche `lot-4b-retours-2`) : visée et déplacement d'un vrai joueur
Retour : « la visée doit mimer des mouvements de souris : rapide mais pas toujours précise ; là, le personnage vise de manière aléatoire en se
déplaçant de manière aléatoire ». Le huit, le tremblement continu et le regard dans le sens de la marche sont retirés. Le survivant est
maintenant piloté comme par un joueur au clavier et à la souris :
- **Clavier (8 directions, pleine vitesse)** : appuis d'au moins 0,2 s. Il **recule** quand un zombie s'approche à moins de 120 unités et
  **reste immobile pour tirer** le reste du temps. Il ne sort pas de la zone dégagée autour de son point de départ (coincé, il esquive sur
  le côté) et **revient à son point de départ** dans les 2 dernières secondes, ce qui garde la boucle propre.
- **Souris** :
  - après chaque zombie abattu, **temps de réaction** de 0,13 à 0,23 s, souris immobile ;
  - puis un **geste rapide**, balistique (0,13 à 0,23 s, vitesse en cloche), qui **dépasse le plus souvent la cible** (6 à 18 % de l'angle
    parcouru), ou s'arrête un peu avant (3 fois sur 10), avec une petite erreur ;
  - une **courte correction**, puis un **suivi** du zombie avec un léger retard, et un nouveau geste s'il décroche ;
  - sans cible, la souris ne bouge pas.
  Exemple mesuré : visée à 39°, puis 86°, 126°, 148° et 153° (le geste dépasse le zombie), puis retour à 147°, 131° et 125°.
- Résultat : **9 zombies tués** en 8 s, survivant indemne ; clip de **333 Kio**, affiche de 13 Kio ; aucune image éteinte à réparer cette fois
  (la caméra bouge moins souvent).
- Vérifications : `outils/verifier-lot-4b.mjs` **26/26** ; raccord de la boucle 1,86, plus doux qu'un passage d'image ordinaire du clip
  (médiane 3,25), parce que le survivant est revenu à son point de départ.

## Troisième retour (15/11/2026, branche `lot-4b-retours-3`) : déplacement plus posé, vers là où il n'y a pas de zombie
Retour : « ça va presque trop vite ; il faut qu'il tienne sa direction, dans une direction où il n'y a pas de zombie, comme pour les éviter,
et il tire sur le plus proche à chaque fois ; la manière dont se déplace le curseur est bien meilleure » (la souris ne change pas).
- **Allure modérée** : 60 % de la vitesse du jeu (environ 130 u/s au lieu de 220).
- **Direction tenue** 0,8 à 1,2 s. À chaque décision, parmi les 8 directions, celle qui l'**éloigne le plus des zombies** (distance au plus proche
  depuis le point atteint 0,8 s plus tard), sans sortir de la zone dégagée autour du départ. La zone est agrandie : la bande de départ, plus
  l'espace libre au-dessus entre les palettes et la caisse. Bonus pour garder la même direction ; changement plus tôt seulement si un zombie se
  met en travers ou au bord de la zone.
- **Toujours le plus proche** : la souris change aussi de cible pendant le suivi si un autre zombie devient nettement plus proche (15 %).
- **Fin de boucle** : retour au point de départ, puis approche fine (joystick relâché peu à peu), qui l'arrête pile dessus.
- Résultat : 9 zombies tués, survivant touché une fois ; clip de **406 Kio**, affiche de 12 Kio ; 2 images éteintes réparées (87, 88).
- Vérifications : `outils/verifier-lot-4b.mjs` **26/26** ; raccord de la boucle 8,50, sous le plus grand passage d'image ordinaire du clip
  (8,93 ; médiane 5,50, le décor bouge presque tout le temps).

## État git
- Commits `lot-4b A` à `lot-4b C` sur la branche `lot-4b`, PR vers `main` fusionnée par l'agent (règle de `CLAUDE.md`).
- Tag `lot-4b` créé en local ; son envoi sur GitHub est refusé par l'environnement de l'agent, comme pour les lots précédents.
