# Lot 1 — retours du propriétaire (scène B)

Suite du lot 1 (`Docs/lots/lot-1.md`). Branche `lot-1-retours`, PR fusionnée par l'agent (règle de `CLAUDE.md`).

**Planche** : https://nowyyy.github.io/Z-Survival-Website/scene/planche.html
**Aperçu en direct (la scène sous l'accueil du site)** : https://nowyyy.github.io/Z-Survival-Website/scene/apercu.html

## Demandes
1. Cadrage retenu : **B** (contre-plongée rapprochée), « très bien dans sa composition ».
2. Corriger les bras qui s'emmêlent et traversent les corps et les armes.
3. Corriger le bras du zombie qui traverse le sol.
4. Corriger le pied du personnage 2 qui traverse un peu le zombie.
5. Le personnage 1 tire une fois dans la boucle.
6. Une main sous le canon de l'arme.
7. Des tenues différentes pour les deux personnages.
8. Planche : ne garder que le cadrage choisi, avec les éléments du site par-dessus.

## Ce qui a été fait
- **Cause des bras emmêlés et du pied qui traverse** : depuis la mise à l'échelle de la scène (× 1,6), le solveur des bras et des
  jambes (`scene/js/rig.js`) comptait les longueurs des os en unités du personnage et les positions en unités du monde. Mains et pieds
  visaient donc à côté de leur cible. Plusieurs décalages des poses (hauteur des yeux, distance de l'arme, hauteur du pied sur le dos)
  avaient le même défaut. Les deux sont corrigés (`rig.js`, constante `K` dans `poses.js`) : chaque main est exactement sur sa prise
  (écart mesuré : 0).
- **Bras des survivants** (`enrichissements.js`) : le jeu leur donne des bras de 19 unités pour une carrure de 23. Pour tenir l'arme à
  deux mains, les bras devaient rentrer en biais à travers le gilet. Ils sont allongés à des proportions humaines (22, pièces allongées
  d'autant). L'arme est tenue bras presque tendus, coudes vers l'avant et un peu en dehors.
- **Prise de l'arme** (`poses.js`) : main droite en poing autour de la crosse (poignet derrière) ; **main gauche sous le canon**, paume
  vers le haut. Même prise pour le personnage 2.
- **Zombie** : poignets à 3,8 au-dessus du sol, mains à plat (paume vers le sol), coudes relevés. Bassin relevé et pointes de pied
  posées au sol, talons en l'air : les jambes ne passent plus sous le sol. Poitrine plaquée au sol, tête relevée (cloué sous le pied).
- **Pied du personnage 2** : la semelle touche le dos sans y entrer. Mesuré sur toute la boucle : écart de 0 (contact) à 0,46 unité,
  quand le zombie se débat. Le pied d'appui ne flotte plus.
- **Coup de feu** (`scene/js/tir.js`) : un tir par boucle à **5,2 s**. L'arme recule, remonte et se cabre, le buste part un peu en
  arrière (0,4 s), puis tout revient. On voit aussi :
  - un éclair au canon (2 images, couleur du jeu `--game-muzzle`) et un éclat de lumière ;
  - une douille éjectée à droite ;
  - une bouffée de fumée.
- **Tenues** : le personnage 1 garde le **survivant tactique** (casquette, gilet sable, sac à dos). Le personnage 2 passe en
  **variante B du jeu, « civil débrouillard »** : capuche, sac de sport, sweat gris clair à accent orange, et **lampe frontale
  allumée**, qui éclaire faiblement le zombie. Les enrichissements (visage, bras, pistolet, textures 512 px) valent aussi pour cette
  variante.
- **Aperçu avec le site** : `scene/apercu.html` (accueil actuel : cadre rouge, logo du studio, « Bientôt disponible », bouton du son,
  globe, logo Z-Survival, accroche, bouton, flèche).
  - La scène tourne en fond, plein écran, et la **vraie page d'accueil du site** est chargée par-dessus, telle quelle.
  - Dans l'aperçu seulement, une feuille de style rend le fond de l'accueil transparent et masque la mention « Image animée — à venir ».
    Le site lui-même n'est pas modifié.
  - Nouveau format `?format=plein` de la scène : il garde toujours la largeur du cadrage. Sur un téléphone, plus étroit que le 9:16, on
    voit donc plus de ciel et de sol au lieu de rogner les personnages.
- **Cadrage B portrait** : caméra un peu inclinée vers le bas (point visé de 50 à 34). L'action passe au-dessus du logo Z-Survival et
  l'accroche se lit sur le sol. Le cadrage paysage est inchangé (essayé plus bas : l'arme sortait du cadre et le titre couvrait encore
  la scène).
- **Planche** (`scene/planche.html`) : cadrage B seulement.
  - Aperçu ordinateur (1600 × 900) et téléphone (390 × 844) avec les éléments du site.
  - La scène seule en paysage et en portrait, et l'instant du tir.
  - Les images A et C sont retirées.
  - `scene/index.html` s'ouvre maintenant sur le cadrage B.
- Outil de retouche : `?isoler=p1|p2|zb` (un seul personnage visible).

## Vérifications (copie exacte de ce que publie le workflow, sous `/Z-Survival-Website/`, Chromium)
- `planche.html` (375 × 667 et 1440 × 900), `index.html` de la scène (B paysage et portrait, plein écran au moment du tir, mouvement
  réduit) et `apercu.html` (390 × 844 et 1440 × 900) : aucune erreur console, aucun fichier manquant, aucune requête hors du site,
  `noindex` présent. Dans l'aperçu : titre du site présent, mention provisoire masquée, fond transparent.
- **Boucle** (200 images) : jonction 8 s → 0 s normale. B paysage : 0,379 pour une moyenne de 0,391. B portrait : 0,643 pour une moyenne
  de 0,649. L'image à 8 s est identique à celle à 0 s. Le seul pic d'écart est le coup de feu (attendu).
- **Contacts mesurés sur toute la boucle** : point le plus bas du zombie à −0,18 au pire (bout de pied), mains du zombie à 0,68 au moins
  au-dessus du sol, pied du personnage 2 sur le dos de 0 à 0,46, pieds des survivants au sol (0).
- **Site inchangé** : aucune différence avec `main` dans `index.html`, `main.html`, `css/`, `js/`, `fonts/`, `img/`, `musique/`.

## Limites
- **Ordinateur** : le logo Z-Survival et le bouton, centrés, couvrent le personnage 2 et le zombie. C'est un choix à faire au lot 2.
- L'accroche « Tenir jusqu'à l'aube » manque de contraste sur la scène (sur téléphone, elle tombe sur le sol et se lit mieux).
- Les mains restent les formes simples du jeu (sphère et boîte de doigts) : la prise se lit, sans doigts séparés.
- Le pistolet du personnage 1 touche le haut du cadre en paysage (déjà le cas avant) : l'éclair du tir est près du bord.
- Testé dans Chromium seulement, en rendu logiciel.

## Questions
1. **Ordinateur** : faut-il décaler le titre de l'accueil (par exemple en bas à gauche) au lot 2, ou recadrer la scène ?
2. **Personnage 2** : la variante B (capuche grise) convient-elle, ou préfères-tu la variante C du jeu (turquoise, bonnet, brassard
   orange) pour un contraste encore plus fort ?
3. **Tir** : un seul coup vers 5,2 s ; faut-il un deuxième coup, ou un tir du personnage 2 sur le zombie ?

## Deuxièmes retours (branche `accueil-vignette`)

### Demandes
1. Une vignette en bas de l'accueil pour que le texte se lise mieux.
2. Le logo, l'accroche et le bouton le plus bas possible.
3. Le pistolet du personnage 1 sortait du cadre en haut : dézoomer ou reculer.
4. Garder l'angle de caméra d'origine du cadrage B, mais écarter les personnages (personnage 1 à gauche, personnage 2 et zombie à
   droite) pour que le titre ne cache plus rien.
5. Le personnage 1 en position militaire sur un genou, un œil fermé pour montrer qu'il tire.

### Ce qui a été fait
- **Site** (`index.html`, `css/accueil.css`) :
  - **vignette** `accueil-scene-vignette` dans la zone de l'image animée (la vidéo du lot 2 passera dessous), sous le cadre rouge.
    Dégradé de la couleur de fond (`--color-bg`) : 92 % tout en bas, transparent à mi-hauteur, plus un léger voile en haut pour la
    rangée d'icônes ;
  - **logo, accroche et bouton tout en bas**, juste au-dessus du cadre rouge. Avant, ils étaient à 12 % de la hauteur d'écran sur
    téléphone et 14 % sur ordinateur ; maintenant, 18 px au-dessus du cadre sur téléphone et 48 px du bord sur ordinateur (le cadre y
    est à 24 px).
- **Cadrage B ordinateur** : angle de caméra d'origine. Les personnages sont déplacés dans le repère de la caméra (réglage `placement`
  de `scene/js/cadrages.js`, propre au format) :
  - le personnage 1 de 30 vers la gauche de l'image et 8 vers le fond ;
  - le zombie, et le personnage 2 qui le suit, de 36 vers la droite et 8 vers le fond.
  Le titre centré ne cache plus personne ; le feu de l'hélicoptère reste visible derrière.
- **Personnage 1 à genou** (`scene/js/poses.js`) :
  - genou droit au sol, orteils repliés derrière (talon en l'air), pied gauche à plat devant, genou levé ;
  - buste droit, un peu penché, arme à hauteur des yeux ;
  - **œil gauche fermé** : une paupière couleur peau avec un trait de cils recouvre l'œil gauche (la tête du jeu est une seule
    géométrie, l'œil ne peut pas être réduit), pour ce personnage seulement.
  - Contacts mesurés sur toute la boucle : genou à −0,01, pointe du pied à 0,21, pied avant à 0.
- **Cadrage B téléphone** : caméra rapprochée (les personnages sont plus grands), tout au-dessus du titre ; l'éclair du tir reste dans
  l'écran.
- **Flamme du canon** raccourcie : longue, elle passait pour un trait de laser.
- Planche et aperçus refaits.

### Vérifications
- Test du site existant (`outils/musique/verifier-site.mjs`) : **158 vérifications réussies, 0 en échec** (dont la rangée du haut de
  l'accueil sans chevauchement de 320 à 1024 px).
- Boucle : jonction normale (B paysage 0,413 pour une moyenne de 0,450 ; B portrait 0,555 pour une moyenne de 0,584), image à 8 s
  identique à celle à 0 s.
- Planche, scène et aperçu, sur la copie exacte publiée par le workflow : voir la PR.

### Limite
- Téléphone en paysage (667 × 375) : le logo du jeu recouvre la mention provisoire « Image animée — à venir ». C'était déjà le cas sur
  `main`, et en pire (titre à 44 px du haut contre 63 maintenant). La mention disparaîtra avec la vidéo du lot 2.

## Troisième retour : personnage 1 recentré sur ordinateur
- Maintenant qu'il est à genou, le personnage 1 reprend sa **position d'origine, au centre** (le décalage vers la gauche est retiré du
  `placement` du cadrage B paysage). Le zombie et le personnage 2 restent décalés à droite.
- Le pistolet reste dans le cadre pendant le recul ; seul l'éclair du tir effleure le haut de l'écran pendant 2 images.

## Quatrième retour : caméra plus basse, œil fermé seulement pour le tir
- **Caméra de l'ordinateur inclinée vers le bas** : point visé du cadrage B paysage abaissé de 50 à 42. La scène remonte dans l'image,
  dans la place libre en haut, et le zombie sort de la vignette. Le pistolet reste dans le cadre ; au moment du tir, le bout de l'éclair
  touche le haut de l'écran pendant 2 images (étoile de l'éclair un peu réduite pour cela).
- **Œil gauche du personnage 1 fermé seulement pour tirer** (`scene/js/tir.js`, `oeilFerme(t)`) : il se ferme en 0,12 s à 0,6 s du coup
  de feu (il cale sa visée), reste fermé pendant le recul et se rouvre en 0,15 s, 0,75 s après le coup. Le reste de la boucle, il a les
  deux yeux ouverts.
- Pour cela, la paupière est portée par une **articulation ajoutée** au squelette v2 (`paupiereL`, enfant de la tête, au ras du haut de
  l'œil ; copie en mémoire de `poses-v2.json`, fichier copié intact). Son échelle verticale ferme la paupière, du haut vers le bas.

## Cinquième retour : clin d'œil plus tard
- L'œil gauche du personnage 1 se ferme **à peine avant le tir** : il commence à se fermer 0,2 s avant le coup (au lieu de 0,6 s), en
  0,1 s, donc il est fermé 0,1 s avant le coup ; il se rouvre comme avant, 0,75 s après le coup.

## Sixième retour : durées du clin d'œil
- Réglages du propriétaire : l'œil gauche commence à se fermer **0,4 s avant** le coup (en 0,1 s) et commence à se rouvrir **0,4 s après**
  le coup (en 0,15 s) : `FERME = { avant: 0.4, apres: 0.4, … }` dans `scene/js/tir.js`.

## Septième retour : le zombie tend le bras pour nous attraper
- Deux fois par boucle (vers **1,6 s** et **7,0 s**, loin du coup de feu de 5,2 s), le zombie **lève son bras gauche (à droite pour
  nous) et le tend vers le spectateur**, doigts devant, comme pour l'attraper : 0,55 s pour tendre, autant pour revenir à la main qui
  tâtonne au sol. Il soulève un peu le haut du corps et tourne l'épaule pendant le geste (`attrapeAt(t)`, `ATTRAPE` et
  `PLACEMENT.spectateur` dans `scene/js/poses.js`).
- Contacts mesurés pendant le geste : le pied du personnage 2 reste posé sur le dos sans y entrer (écart de 0,09 à 0,39).

## Huitième retour : un seul geste, plus long, bras moins haut
- **Une seule fois par boucle** : le zombie tend le bras à partir de **1,0 s** (0,55 s), le **garde tendu 1,1 s**, le ramène en 0,55 s
  (fini à 3,2 s, loin du coup de feu de 5,2 s) : le geste dure 2,2 s au lieu de 1,1 s (`ATTRAPE` dans `scene/js/poses.js`).
- **Bras moins haut** : il se tend vers le spectateur à peu près à hauteur d'épaule, sans se dresser (point visé `PLACEMENT.spectateur`
  abaissé de 62 à 42).
