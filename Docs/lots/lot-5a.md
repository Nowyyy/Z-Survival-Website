# Lot 5a — Accueil v2 : nouvelle scène en coulisses (Kar98k, Colt)

Branche `accueil-v2`, depuis `main` (`e80c9cb`). Le jeu a refait toutes ses armes : l'ancien pistolet de la scène de l'accueil n'existe
plus. Une **v2** de la scène est préparée **en coulisses** dans `scene-v2/`, avec une copie fraîche du jeu (branche `dev`) et ses nouvelles
armes. **L'accueil public ne change pas** : même vidéo, même tir, même comportement. Référence : `Docs/ref/scene-accueil-v2.md`.

## Adresses à ouvrir sur ton téléphone
- **Planche v1 / v2** : https://zsurvival-game.com/scene-v2/planche.html
- **La v2 sous l'accueil du site** (en direct, plein écran) : https://zsurvival-game.com/scene-v2/apercu.html
- La scène v2 seule : https://zsurvival-game.com/scene-v2/index.html?cadrage=B&format=portrait (ou `format=paysage`)
- Pour comparer, la première version (droitier, visée à gauche de l'écran) :
  https://zsurvival-game.com/scene-v2/apercu.html?tireur=droitier

## Ce qui a été fait

### A — Copie fraîche du jeu et outil de mise à jour
- **`outils/scene/copier-jeu.mjs`** (mode d'emploi : `outils/scene/LISEZMOI.md`) : sans argument, il clone `dev` dans un dossier
  temporaire du système (hors du dépôt, lecture seule), recopie **tels quels** dans `scene-v2/jeu/` les fichiers dont la scène a besoin
  (suivi des imports des modules de départ + liste de données : personnages, zombies, **armes**, carte, hélicoptère, lampes, matériaux,
  couleurs, Three.js), écrit `scene-v2/jeu/ORIGINE.json` (commit, date, titre, liste des fichiers avec empreinte SHA-256 et taille), puis
  efface le clone.
- À chaque relance, il affiche les fichiers **ajoutés**, **modifiés**, **disparus de la copie**, et ceux **disparus du jeu** (la scène devra
  être adaptée). `--essai` : rien n'est écrit. `--verifier` : aucun fichier copié n'a été retouché. Refuse un clone sur une autre branche
  que `dev`, ou placé dans le dépôt.
- Première copie : **`dev` @ `622df2c`** (19/11/2026, « Merge branch 'lot-9e' into dev »), 73 fichiers, 3,5 Mo. Par rapport à la copie de la
  v1 (`3c25e3a`) : 11 fichiers ajoutés (armes du jeu, « corps long »), 16 modifiés (personnages, squelettes, hélicoptère, carte, fenêtres,
  textures, couleurs). `scene/jeu/` n'est pas touché.

### B — Scène v2 avec les nouvelles armes
- `scene-v2/` reprend le code de mise en scène de `scene/` (cadrage B, nuit, bâtiment, hélicoptère en flammes, lune, lampes, brume, mêmes
  paramètres `?cadrage=` et `?format=`), branché sur `scene-v2/jeu/`. La scène v1 n'est pas modifiée.
- **Armes du jeu** (`scene-v2/js/armes.js`) : construites par le code du jeu copié (pièces, atlas généré, variantes retenues dans le jeu :
  Colt « Service, phosphaté », Kar98k « Noyer, bretelle »), aux tailles du jeu, accrochées à l'os `prop` des personnages ; l'ancien
  pistolet est retiré.
- **Personnage 1, à genou, Kar98k** : buste de biais, crosse au creux de l'épaule droite, **joue sur la crosse** (tête penchée, œil droit sur
  la ligne de mire), main droite au poignet de la crosse, **main gauche sous le garde-main**. Au tir (**5,2 s**) : œil gauche fermé comme
  avant, recul dans l'épaule, canon qui se relève, éclair, fumée ; puis **réarmement** de 5,6 à 6,6 s environ (levier relevé, culasse
  tirée : **la douille sort**, repoussée, levier rabattu, main de retour), avec les clés de la manœuvre du jeu, un peu ralenties.
- **Personnage 2, Colt** : pied sur le dos du zombie, Colt tenu à deux mains et pointé sur sa tête ; tir à **2,6 s** (douille éjectée).
- Inchangé : zombie qui se débat et tend le bras, tir du personnage 2 sur le zombie, coups d'œil, clin d'œil, tenues, visages.
- **Ajusté à cause du fusil** : le personnage 1 vise maintenant **à gauche de la caméra** (voir « Questions ») ; son corps est tourné de 18°
  de plus vers la gauche de l'image ; point visé réglé par format pour que la bouche du fusil et l'éclair restent dans l'image.
- **Temps inchangés** : `TEMPS_TIR` = 5,2 s, `TEMPS_TIR_P2` = 2,6 s, boucle de 8 s (`js/accueil-boucle.js` n'a pas changé) ; aucune arme
  n'a imposé un autre temps.

### C — Pages d'aperçu
- **`scene-v2/apercu.html`** : la v2 en direct sous la vraie page d'accueil (même principe que `scene/apercu.html`) ; flash du cadre aux deux
  tirs. Aucun ajout dans le code du site : l'aperçu utilise `?video=0`, qui existait déjà.
- **`scene-v2/planche.html`** : la v2 sous l'accueil (ordinateur, téléphone), puis la comparaison **v1 / v2** en images fixes (cadrage B,
  paysage et portrait, **avant le tir** à 4,7 s et **pendant** à 5,24 s), liens « Voir en mouvement », **historique** en bas (date, commit
  de `dev`, ce qui a changé). Lisible à 375 px, sans défilement horizontal. Images refaites par `node scene-v2/outils/planche.mjs`.
- `scene-v2/` est publié par `pages.yml` (sans `scene-v2/outils/`), pages en `noindex`, `Disallow: /scene-v2/` dans `robots.txt`.

### D — Préparer la future vidéo (sans la fabriquer)
- `outils/video/fabriquer.mjs --scene=v2` : mêmes réglages que la v1, sortie dans **`outils/video/sortie-v2/`** (non suivi par git) ; sans
  option (`--scene=v1` par défaut), il fabrique la v1 exactement comme avant, dans `img/accueil/`. `--images=0,57,156` rend seulement
  quelques images, sans encoder (contrôle).
- **Aucune vidéo fabriquée**, aucun fichier de `img/accueil/` remplacé.
- Documentation : `Docs/ref/scene-accueil-v2.md` (ce qu'est la v2, choix des armes et des poses, mise à jour, ce qui reste à venir côté
  jeu), renvoi en tête de `Docs/ref/scene-accueil.md`, `outils/video/LISEZMOI.md`, `CLAUDE.md`.

## Vérifications
- **`node scene-v2/outils/verifier.mjs`** (copie exacte de ce que publie le workflow, à la racine et avec `--sous-dossier`) : **47/47** :
  - `scene-v2/index.html` (B paysage et portrait), `apercu.html` (390 × 844, 1440 × 900), `planche.html` (375 et 1280 px) : aucune erreur
    console, aucun fichier manquant, aucune requête hors du site, `noindex` ; planche sans défilement horizontal, 10 images chargées ;
  - armes Kar98k et Colt en place ; **image à 8 s identique à l'image à 0 s** ; jonction 0,45 (paysage) et 0,46 (portrait) pour des écarts
    entre images voisines de 0,31 à 0,50 : **boucle sans saut** ;
  - **éclairs à 2,6 s (personnage 2) et 5,2 s (personnage 1)**, absents juste avant, finis en 2 images ; verrou manœuvré après le tir et
    revenu avant la fin de la boucle ;
  - **accueil public** (375 × 667, 1440 × 900) : aucune requête vers `scene-v2/` ni `scene/`, aucun lien, vidéo v1 de `img/accueil/` ;
    fichiers du site et de `scene/` identiques à `origin/main` ; **empreintes de `img/accueil/` égales à `fabrication.json`** ;
    `robots.txt` interdit `/scene-v2/` ; `scene-v2/jeu/` conforme à `ORIGINE.json` ; aucun chemin qui commence par « / ».
- **Boucle complète** (`scene-v2/outils/verifier-boucle.mjs`, 200 images) : B paysage jonction 0,515 pour une moyenne de 0,542 ; B portrait
  0,542 pour 0,598 ; le seul pic est le coup de feu (attendu).
- **Accueil inchangé** : `outils/video/verifier-accueil.mjs` **174/174** ; `outils/musique/verifier-site.mjs` **158/158** ;
  `outils/verifier-lot-4a.mjs` **87/87** (les trois pages de `scene-v2/` ajoutées à sa liste des pages de travail, contrôlées `noindex`).
- **La v1 sait toujours se fabriquer** : les images 0, 57, 156 (le tir) et 239 du format téléphone, rendues par le nouveau script sans
  option, sont **identiques au bit près** à celles rendues par le script de `main` (copie de travail de `main` hors du dépôt).

## Limites
- **Réencodage des vidéos v1 dans ce conteneur** : le script de `main` lui-même, relancé ici, ne redonne pas les mêmes MP4 que ceux du dépôt
  (versions de Chromium et ffmpeg différentes de celles du lot 2b, limite déjà notée dans `outils/video/LISEZMOI.md`). Ce lot ne refait
  aucune vidéo ; les images rendues, elles, sont identiques avant et après.
- **Main droite du Kar98k pendant le réarmement** : vue de la caméra du cadrage B, elle passe en partie derrière le fusil (le levier est du
  côté droit, la caméra voit le côté gauche) ; la douille se voit.
- **Colt plus petit** que l'ancien pistolet (taille du jeu : 9 unités contre environ 17) : il se lit moins de loin ; les mains du jeu (une
  sphère et une boîte de doigts) l'enveloppent largement.
- **Joue sur la crosse** : les têtes du jeu sont grandes ; l'œil est placé un peu au-dessus de la ligne de mire pour que la tête ne rentre
  pas dans la crosse.
- Le « corps long » du jeu (lot 9e du jeu) n'est pas pris (voir « Questions »).
- Testé dans Chromium seulement, en rendu logiciel ; la v2 tourne en direct, lourde sur téléphone (comme l'aperçu de la v1).

## Questions à trancher
1. **Direction du tir du personnage 1** : épaulé à droite et visant à droite de la caméra basse (comme le pistolet de la v1), sa main et son
   bras cachaient son visage et l'œil qu'il ferme. J'ai fait viser le Kar98k **à gauche** de la caméra. Garder ce choix, ou revenir à droite
   (`?p1vise=330,64,900` pour voir) en acceptant un visage caché, ou essayer autre chose (le faire tirer de l'épaule gauche) ?
2. **Taille des armes** : celle du jeu (Kar98k à 31 unités, soit 0,8 fois la taille réelle comme toutes les armes du jeu ; Colt à 1,2 fois).
   Pour le gros plan, faut-il un Kar98k à la taille réelle (plus long) et un Colt plus gros ?
3. **Réarmement** : la manœuvre du verrou (5,6 à 6,6 s) pendant que le personnage 1 tourne la tête (coup d'œil de 5,8 à 7,65 s, inchangé) :
   ça te va, ou faut-il décaler le coup d'œil après le réarmement ?
4. **Corps long du jeu** (épaules plus étroites, bras plus longs) : le prendre maintenant, ou attendre les nouveaux skins des personnages ?
5. **Variantes des armes** : celles retenues dans le jeu (Colt phosphaté, Kar98k noyer avec bretelle) ; une autre variante pour l'accueil
   (Colt bronzé, Kar98k hêtre clair) ?

## Retours du propriétaire (19/11/2026, branche `accueil-v2-retours`)
1. « Le personnage 1 ne peut-il pas regarder vers la droite de l'écran ? » → **oui, en gaucher** : crosse à l'épaule gauche, joue gauche sur la
   crosse, il vise à droite de l'écran comme le pistolet de la v1, et **ferme l'œil droit** au tir (paupière droite ajoutée). Vu de la caméra
   basse, son visage reste devant le fusil (épaulé à droite, sa main et son bras le cachaient). Le levier du Kar98k étant à droite, c'est la
   main droite (sous le garde-main) qui manœuvre le verrou. Son corps reprend l'orientation de la v1. `?tireur=droitier` : la première
   version.
2. **Douille du Kar98k** : elle vole maintenant **jusqu'à sortir de l'image** (vers le bord de l'image du côté de la fenêtre d'éjection, vers le
   haut, puis pesanteur), au lieu de disparaître en l'air au bout de 0,55 s : cachée seulement une fois hors du champ de la caméra.
3. **Douille du Colt** : même vol jusqu'à la sortie de l'image ; plus grande (au moins 2,1 de long au lieu de 0,9 à l'échelle du jeu, où elle
   ne se voyait pas) et en laiton qui accroche la lumière.

Vérifications : `node scene-v2/outils/verifier.mjs` (racine et `--sous-dossier`), boucle complète, `verifier-accueil.mjs`, `verifier-site.mjs` :
voir la PR. Trajectoires mesurées (position dans l'image toutes les 0,05 s) : en paysage et en portrait, les deux douilles sortent par le bord
gauche de l'image, toujours au-dessus du sol ; celle du Colt passe un instant derrière le personnage 1.
La question 1 (« direction du tir ») est tranchée : à droite de l'écran.

## Deuxièmes retours (20/11/2026, branche `accueil-v2-retours-2`)
1. **Téléphone** : personnage 1 décalé un peu vers la gauche (8 unités, `placement.p1` du cadrage B portrait) : un espace sépare maintenant les
   deux personnages. Au-delà de 8, son dos sortait du cadre à gauche. Ordinateur inchangé.
2. **Douille du Colt** : elle part maintenant vers le **bord droit** de l'image, tout proche du personnage 2 (option `ecran: 1` de
   `creerTir`), au lieu de traverser toute l'image vers la gauche : sortie en 0,2 s en paysage, 0,6 s en portrait, toujours au-dessus du sol.

Vérifications : `node scene-v2/outils/verifier.mjs` 47/47 ; boucle portrait parfaite (jonction 0,52 pour une moyenne de 0,66) ; planche
refaite.

## Troisième retour (20/11/2026, branche `accueil-v2-retours-3`)
- « Le personnage 1 est trop décalé, une partie passe derrière la bordure rouge du site » : il revient presque à sa place (x = −31 au lieu de
  −38 ; −30 à l'origine) et ce sont **le zombie et le personnage 2 qui se décalent de 10 vers la droite** sur téléphone : l'espace entre les
  deux personnages reste, le personnage 1 est entièrement dans la bordure (vérifié sur l'aperçu à 390 × 844). Les pieds du zombie touchent le
  bord droit de l'image. Ordinateur inchangé.
- Vérifications : `node scene-v2/outils/verifier.mjs` 47/47 ; boucle portrait parfaite (jonction 0,48, moyenne 0,61) ; douille du Colt
  toujours vers le bord droit (sortie en 0,1 s environ) ; planche refaite.

## Quatrième retour (20/11/2026, branche `accueil-v2-retours-4`)
1. **Coup d'œil du personnage 1 après le réarmement** : il tourne la tête 0,25 s après avoir fini de manœuvrer le verrou (main revenue vers
   6,6 s) : de 6,9 s environ jusqu'au début de la boucle suivante (vers 0,7 s), même mouvement que la v1. Jamais pendant la manœuvre (vérifié
   sur toute la boucle). Cela tranche la question 3.
2. **Arme du personnage 2** : le Colt M1911 est un pistolet semi-automatique : au tir, ce n'est pas la crosse mais la **glissière** (le dessus
   de l'arme) qui bouge : elle recule, éjecte la douille, puis revient en avant en chargeant la cartouche suivante. Animée ainsi : recul en
   0,05 s, la douille sort, retour en 0,08 s (un peu plus lent qu'en vrai pour se voir à 30 images par seconde). Vue de la caméra du cadrage B,
   elle est en partie cachée par les mains du personnage 2.

Vérifications : `node scene-v2/outils/verifier.mjs` **51/51** (deux contrôles ajoutés : coup d'œil jamais pendant la manœuvre, glissière qui
recule puis revient) ; boucle parfaite (paysage 0,50 pour une moyenne de 0,56 ; portrait 0,48 pour 0,61) ; planche refaite.

## Nouvelles tenues du jeu (20/11/2026, branche `accueil-v2-tenues`)
- Demande : « remplacer les tenues des personnages 1 et 2 et du zombie par les nouvelles tenues du jeu ».
- **Copie du jeu refaite** : `dev` @ `2f7716a` (« Merge pull request #179 from Nowyyy/lot-9h »), 77 fichiers. Ajoutés : les recettes des tenues
  d'époque (`data/game/persos-epoque.json`, `persos-epoque-choix.json`, ajoutés à la liste de `outils/scene/copier-jeu.mjs`), `decor-epoque.js`,
  `nav.js` ; modifiés : personnages (`character-v2.js`, `persos-variants.js`, `texgen-persos.js`, `persos-choix.json`) et décor (`world.js`,
  `decor.js`, `decor-vivant.js`, `decor.json`).
- **Tenues d'époque** (lot 9g du jeu), avec les choix du jeu : personnage 1 = Survivant (fantassin américain de 1942 : casque M1 gris, veste
  sable, guêtres, ceinturon, bretelles, gourde) ; personnage 2 = parachutiste radio (casque à filet, poste radio dorsal à antenne, harnais,
  poches de cuisse) ; zombie = zombie soldat casqué (modèle 1935, bretelles en Y, cartouchières). Construites par le code du jeu, puis les
  retouches de gros plan de la scène (visage, clin d'œil, pouces, bras).
- **Casques remontés** dans la scène : ceux du jeu descendaient jusque sur les yeux (vue de dessus) ; de près, on ne voyait ni les sourcils
  froncés ni le clin d'œil du personnage 1. Lampe du personnage 2 éteinte (le parachutiste n'en a pas).
- **Décor d'époque du jeu pas pris** (avion P-51 à la place de l'hélicoptère, jeeps) : la scène garde son décor (réglage « décor d'avant » du
  jeu). Question ci-dessous.
- Comparer : `?tenues=avant` (tenues de la première v2) ; autre tenue du zombie : `?zbtenue=epoque-B:capote` (par exemple).
- Vérifications : `node scene-v2/outils/verifier.mjs` 51/51 ; boucle parfaite (paysage 0,48 pour une moyenne de 0,55 ; portrait 0,46 pour 0,59) ;
  `copier-jeu.mjs --verifier` conforme ; planche refaite.
- Questions : (1) prendre aussi le **décor d'époque** du jeu (avion écrasé au lieu de l'hélicoptère, jeeps) ? (2) **tenue du zombie** : soldat
  casqué, ou une autre des douze (au calot, en capote, sous-officier, officier, tête nue) ? (3) couleurs du jeu très claires sous les lampes
  de la scène : les garder telles quelles ?

## Corps des survivants (20/11/2026, branche `accueil-v2-corps`)
- Retour : « les corps sont bizarres, on dirait des sacs à patates ». Cause : torse du jeu en grosse capsule arrondie, d'une seule couleur,
  trame de tissu diagonale agrandie (toile de jute) ; sous les lampes chaudes, veste et pantalon d'un même beige.
- Retouches de gros plan, sans toucher au jeu : **veste à la coupe nette** sur la poitrine (comme le gilet de la première v2), **trame des tissus
  adoucie** (40 % de son relief ; aussi sur le zombie), **contraste veste / pantalon** (pantalon olive du Survivant et veste verte du
  parachutiste assombris par le réglage « ombre » des couleurs du jeu). `?trame=jeu` : trame d'origine.
- Vérifications : `node scene-v2/outils/verifier.mjs` 51/51 ; boucle parfaite (paysage 0,47 pour une moyenne de 0,55 ; portrait 0,44 pour 0,58) ;
  planche refaite.

## État git
- Commits `accueil-v2 A` à `accueil-v2 E` sur la branche `accueil-v2` (poussée), PR vers `main` fusionnée par l'agent (règle de
  `CLAUDE.md`) : rien n'est visible des visiteurs.
- Tag `lot-5a` créé en local ; **son push est refusé par l'environnement** (connexion coupée par le serveur), comme pour les lots précédents.
