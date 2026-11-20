# Scène de l'accueil, version 2 (lot 5a) — en coulisses

La **v2** de la scène de l'accueil suit le jeu au fur et à mesure de ses évolutions (armes refaites, puis skins des personnages,
skins des zombies, carte). Elle vit dans **`scene-v2/`**, à côté de la v1 (`scene/`, `Docs/ref/scene-accueil.md`), sans la toucher :
**l'accueil public garde la vidéo de la v1** (`img/accueil/`). La vidéo v2 sera fabriquée et mise en place dans un lot ultérieur,
sur demande du propriétaire.

## Adresses (pages cachées : `noindex`, interdites dans `robots.txt`, reliées à rien sur le site)
- Planche v1 / v2 : https://zsurvival-game.com/scene-v2/planche.html
- La v2 sous l'accueil du site : https://zsurvival-game.com/scene-v2/apercu.html
  (lot 6a : le site s'y ouvre aussi avec la nouvelle section Armes, `?apercu=armes`, et se fait défiler ; `#weapons` y va directement,
  `?armes=0` montre la section actuelle ; `Docs/ref/armes.md`)
- La scène seule : https://zsurvival-game.com/scene-v2/index.html (`?cadrage=B&format=paysage|portrait|plein`, `?t=` image fixe,
  `?details=0`, `?p2=civil`, `?zombie=face`, `?isoler=p1|p2|zb`, comme la v1 ; en plus `?tireur=droitier` : première version, épaule droite
  et visée à gauche, et `?p1vise=x,y,z` : point visé par le personnage 1)

## Ce qui change par rapport à la v1
| | v1 (vidéo publique) | v2 |
|---|---|---|
| Copie du jeu | `scene/jeu/`, `dev` @ `3c25e3a` (14/11/2026) | `scene-v2/jeu/`, `dev` @ `2f7716a` (20/11/2026 ; première copie `622df2c`), voir `scene-v2/jeu/ORIGINE.json` |
| Tenues | survivant tactique (casquette, gilet), militaire construit dans la scène, zombie en blouse | **tenues d'époque du jeu** : Survivant (fantassin américain de 1942), parachutiste radio, zombie soldat casqué |
| Personnage 1 (à genou) | ancien pistolet du jeu (enrichi), tenu bras tendus | **Kar98k** du jeu, épaulé **en gaucher** |
| Personnage 2 (pied sur le zombie) | ancien pistolet | **Colt M1911** du jeu |
| Visée du personnage 1 | au loin, à droite de la caméra | au loin, à droite de la caméra (comme la v1) |
| Clin d'œil | œil gauche fermé au tir | œil **droit** fermé au tir (gaucher) |
| Douilles | petite douille du personnage 1 qui disparaît en l'air | douilles des deux armes qui s'envolent **hors de l'image** |
| Tirs | 2,6 s (personnage 2) et 5,2 s (personnage 1) | **mêmes instants** : `js/accueil-boucle.js` n'a pas changé |
| Boucle | 8 s, parfaite | 8 s, parfaite (vérifié) |

Tout le reste est repris tel quel de la v1 (code copié de `scene/js/` dans `scene-v2/js/`) : cadrage B, nuit, bâtiment, hélicoptère en
flammes, lune, lampes, brume, zombie qui se débat et tend le bras, tir du personnage 2 sur le zombie, coups d'œil, clin d'œil du
personnage 1, tenues, visages, barbe, gilets.

## Armes (`scene-v2/js/armes.js`)
- Modèles **du jeu**, construits par son propre code copié tel quel (`scene-v2/jeu/js/core/armes/` : pièces, atlas de textures généré en
  code, variantes) avec la variante retenue dans le jeu (`data/armes/armes-choix.json` : Colt « Service, phosphaté », Kar98k « Noyer,
  bretelle »), aux tailles du jeu (Kar98k à × 0,8 comme toutes les armes du jeu, Colt à × 1,2).
- Seule différence avec la partie : pas d'élargissement « vue de dessus » (`echelle.largeur` du jeu, fait pour la caméra lointaine).
- Accrochées à l'os `prop` de chaque personnage ; l'ancien pistolet du joueur est retiré (`sansPistolet` du kit du jeu).
- **Kar98k** : verrou animé comme dans le jeu (levier relevé autour de l'axe de la culasse, culasse tirée), avec les **clés de la manœuvre du
  jeu** (`data/game/armes-partie.json` → `kar98k.manoeuvre`), jouées 1,3 fois plus lentement pour se lire dans la vidéo (`MANOEUVRE` dans
  `scene-v2/js/tir.js`).

## Poses (`scene-v2/js/poses.js`)
- **Personnage 1, tir à genou au Kar98k, en gaucher** (jambes de la v1, `TIREUR.gaucher`) : buste de biais (le fusil vise 17° à droite de
  l'avant du buste, comme la pose de tenue du jeu en miroir), épaule gauche un peu relevée, **crosse au creux de l'épaule gauche**, **joue sur
  la crosse** (tête penchée vers la gauche, œil gauche sur la ligne de mire : le fusil est placé depuis l'œil, puis glissé le long du canon
  jusqu'à l'épaule), main gauche au poignet de la crosse, **main droite sous le garde-main**, paume en haut. Réglages : `FUSIL` et
  `PRISES.kar98k` (écrits pour un droitier, appliqués en miroir).
- **Pourquoi gaucher** : il vise à droite de notre écran (comme le pistolet de la v1). Épaulé à droite, sa main et son bras de tir passaient
  devant son visage, vu de la caméra basse du cadrage B, et l'œil qu'il ferme ne se voyait plus ; épaulé à gauche, son visage reste devant le
  fusil. Première version (droitier, visée à gauche de l'écran) : `?tireur=droitier`.
- **Au tir (5,2 s)** : **œil droit fermé** (paupière droite ajoutée dans `scene-v2/js/enrichissements.js`, mêmes durées que la v1), recul dans
  l'épaule (le buste part en arrière, le canon se relève autour de la crosse), éclair un peu plus grand que celui du pistolet, fumée ; puis,
  de 5,6 à 6,6 s environ, **réarmement** : le levier du Kar98k est à droite, c'est la main droite qui quitte le garde-main, relève le levier,
  tire la culasse (**la douille sort à ce moment**, comme dans le jeu), la repousse, rabat le levier et revient. Tout est fini bien avant la
  fin de la boucle.
- **Coup d'œil du personnage 1 après le réarmement** (retour du propriétaire) : il tourne la tête hors champ 0,25 s après avoir fini de manœuvrer
  le verrou (main revenue à sa place, vers 6,6 s ; `REGARD` dans `scene-v2/js/poses.js`, début calculé depuis les clés de la manœuvre du jeu) :
  début vers 6,9 s, même mouvement que la v1 (aller 0,6 s, tenue 0,55 s, retour 0,7 s). Il finit au début de la boucle suivante (vers 0,7 s),
  bien avant l'affiche de 1,9 s ; la fonction est périodique, la boucle reste parfaite. Jamais pendant la manœuvre (vérifié).
- Point visé et orientation du personnage 1 réglés par tireur et par format (`placement.p1Cap`, `placement.p1Vise` dans
  `scene-v2/js/cadrages.js`) pour que la bouche du fusil et l'éclair restent dans l'image.
- **Téléphone** : un peu d'espace entre les deux personnages (`placement` du cadrage B portrait, `scene-v2/js/cadrages.js`) : personnage 1 à
  peine décalé vers la gauche (x = −31 au lieu de −30 : plus loin, son bras passait derrière la bordure rouge du site), zombie et personnage 2
  décalés de 10 vers la droite (x = 32 au lieu de 22 ; leurs pieds touchent le bord droit de l'image).
- **Personnage 2 au Colt** : même pose que la v1 (pied sur le dos du zombie, canon pointé sur sa tête), mains aux prises du Colt
  (`PRISES.m1911` : poing droit autour de la poignée, main gauche qui l'enveloppe), arme un peu plus près du corps (le Colt est plus petit
  que l'ancien pistolet).
- **Glissière du Colt** (retour du propriétaire) : le M1911 est un pistolet semi-automatique ; au coup de feu, sa glissière (le dessus de
  l'arme) recule, éjecte la douille, puis revient en avant en chargeant la cartouche suivante. Dans la scène : recul de 24 mm en 0,05 s, 0,03 s
  en arrière (la douille sort à ce moment), retour en 0,08 s (`GLISSIERE` et `glissiereAt` dans `scene-v2/js/tir.js`), un peu plus lent qu'en
  vrai pour se voir à 30 images par seconde. Le modèle du jeu n'a qu'un maillage : les pièces de la glissière (glissière, bague, guidon,
  hausse, fenêtre d'éjection) sont reconnues par leur place dans le modèle (`estGlissiere`, `scene-v2/js/armes.js`) ; si le jeu change ce
  modèle, l'arme reste entière, sans animation.
- **Douilles** (`scene-v2/js/tir.js`, `DOUILLE`) : éjectées du côté droit de l'arme, vers le bord de l'image de ce côté et vers le haut, puis
  pesanteur ; elles volent **jusqu'à sortir de l'image** (elles sont cachées seulement une fois hors du champ de la caméra, jamais en l'air)
  et restent au-dessus du sol. Kar98k : quand la culasse est tirée (vers 6,0 s), sortie par le bord gauche en 0,3 s environ ; Colt : au coup
  de feu (2,6 s), elle part vers le **bord droit** de l'image, tout proche (option `ecran: 1`, choix du propriétaire : elle traversait
  toute l'image vers la gauche), sortie en 0,2 s (paysage) à 0,6 s (portrait). Taille lisible (au moins 2,1 de long), laiton qui accroche la
  lumière. Toujours cachées avant la fin de la boucle.
- **Corps** : le jeu a maintenant un « corps long » (épaules à 9 au lieu de 11,5, bras × 1,2). La v2 ne le prend pas encore (`corps: null`
  dans `scene-v2/js/persos.js`) : elle garde les épaules d'avant et ses propres bras allongés (22, presque la longueur du corps long : 22,8),
  dont dépendent ses poses de près. À revoir avec les nouveaux skins.

## Mettre à jour la v2 quand le jeu change
1. `node outils/scene/copier-jeu.mjs` (mode d'emploi : `outils/scene/LISEZMOI.md`) : clone `dev` dans un dossier temporaire hors du dépôt,
   recopie les fichiers tels quels dans `scene-v2/jeu/`, écrit `scene-v2/jeu/ORIGINE.json` et affiche les fichiers **ajoutés**, **modifiés** et
   **disparus**. `--essai` montre les changements sans rien écrire ; `--verifier` contrôle qu'aucun fichier copié n'a été retouché.
2. Ouvrir `scene-v2/index.html` et `scene-v2/apercu.html` ; retoucher les poses si les nouvelles proportions l'imposent (`scene-v2/js/poses.js`).
3. Refaire les images de la planche : `node scene-v2/outils/planche.mjs`.
4. Ajouter une ligne à l'historique en bas de `scene-v2/planche.html`.
5. Vérifier : `node scene-v2/outils/verifier.mjs` (pages sans erreur, boucle, tir, accueil public inchangé).

## Vidéo (plus tard, sur demande)
- `node outils/video/fabriquer.mjs --scene=v2` fabrique les deux vidéos et leurs affiches de la v2 dans `outils/video/sortie-v2/` (non suivi
  par git), avec les mêmes réglages que la v1 (`outils/video/LISEZMOI.md`). Sans option, le script fabrique toujours la v1, à l'identique.
- Mise en place (lot ultérieur) : copier ces fichiers dans `img/accueil/`, relancer `outils/video/verifier-accueil.mjs`. Les instants de
  tir étant les mêmes (`TEMPS_TIRS`), le site n'a rien d'autre à changer. L'affiche (`TEMPS_AFFICHE` = 1,9 s) convient aussi à la v2.

## Tenues d'époque (copie `dev` @ `2f7716a`, lot 9g du jeu)
- Construites par le code du jeu copié (`slotsWithEpoch` de `js/core/persos-variants.js`, niveau complet) à partir des recettes
  `data/game/persos-epoque.json`, avec les choix du jeu (`data/game/persos-epoque-choix.json`) :
  - **personnage 1** = Survivant `epoque-A`, tenue `standard` : casque M1 gris à jugulaire, veste M41 sable, pantalon olive, guêtres, ceinturon,
    bretelles, gourde ;
  - **personnage 2** = personnage 2 du jeu `para-B` (parachutiste radio), tenue `standard` : casque à filet, poste radio dorsal à antenne,
    harnais, poches de cuisse, bottes de saut ;
  - **zombie** = zombie soldat du marcheur `epoque-A`, tenue `soldat` (casque modèle 1935, veste, bretelles en Y, cartouchières). Le jeu mélange
    les variantes A et B et tire une tenue parmi douze ; la scène en montre une : `?zbtenue=variante:tenue` pour en essayer une autre (par
    exemple `?zbtenue=epoque-B:capote`).
- Enrichissements de la scène appliqués aux variantes d'époque comme aux autres (`scene-v2/js/enrichissements.js`) : visage (personnage 1 en
  colère, paupières du clin d'œil), pouces, bras allongés, sphères plus fines, textures en 512 px ; zombies : visage, bouche, yeux, épaules.
  **Casques remontés** (`casquesRemontes`) : faits pour la vue de dessus, ils descendaient jusque sur les yeux ; dôme remonté de 1,9 et un peu
  aplati, bord au-dessus des sourcils, jugulaires allongées. Plus de gilets texturés (tenues de la première v2 seulement) ; barbe gardée.
- **Corps des survivants** (retour du propriétaire : « on dirait des sacs à patates ») : dans le jeu, le torse est une grosse capsule arrondie
  sur un tronc de cône, d'une seule couleur, avec une trame de tissu diagonale faite pour se lire de loin. Retouches de gros plan :
  - **veste à la coupe nette, d'un seul bloc** (`vesteScene` : boîte de la couleur de la tenue portée par la poitrine, du col au ceinturon qui
    cache son bas ; capsule de la poitrine et ventre du jeu rentrés dedans ; bretelles et harnais du jeu visibles devant). Retour « le torse se
    traverse » : une veste en deux morceaux (poitrine, ventre) se décalait quand le buste du tireur tourne ; la rotation du buste est aussi
    répartie entre bassin (30 %), colonne (35 %) et poitrine (`tournerBuste`, `scene-v2/js/poses.js` ; pieds inchangés) ;
  - **trame des tissus adoucie** à 40 % de son relief (`adoucirTissus`, textures en 512 px : tissu, toile, laine, chevrons ; peau, cuir, métal,
    filet, camouflage et sang intacts) ; `?trame=jeu` : la trame du jeu ;
  - **contraste veste / pantalon** (`CONTRASTE`, réglage « ombre » des couleurs dérivées du jeu, aucun jeton nouveau) : pantalon olive du
    Survivant assombri, veste verte du parachutiste assombrie ; sous les lampes chaudes, tout se confondait en un seul beige.
- La lampe du personnage 2 (casque du militaire) est éteinte : le parachutiste n'en a pas (`?frontale=1` la rallume).
- `?tenues=avant` : les tenues de la première v2 (survivant tactique, militaire, zombie en blouse), pour comparer.
- Couleurs : celles du jeu, très claires (règle de contraste du jeu pour la vue de dessus sur un sol sombre) ; sous les lampes chaudes de la
  scène, les tenues paraissent sable et le gris-vert des zombies très pâle.

## Décor d'époque (lot 9h du jeu, demande du propriétaire du 20/11/2026)
- Le décor extérieur du jeu de 1942 est pris tel quel (`decor.json` → `epoque`, construit par `js/game/world.js` et `js/core/decor-epoque.js` du
  jeu) : jeeps et Kübelwagen à la place des voitures, camion, barbelés, hérissons, panneau, jerrycans, caisses, projecteur, trous d'obus,
  poteaux télégraphiques et leurs fils. Comme les voitures et les arbres, les objets entre les caméras et la scène sont retirés : seul le
  **parachute** (sur un arbre mort, tout près de la scène) l'est (`__scene.decor.retiresEpoque`).
- **Avion écrasé** (P-51) à la place de l'hélicoptère (`scene-v2/js/avion.js`) : le modèle du jeu (même atlas d'époque, mêmes teintes, cratère et
  traînée du jeu), **agrandi** (× 2,2 : dans le jeu, l'avion est à 28 unités par mètre et les personnages de la scène sont grandis de 1,6),
  **décalé** comme l'était l'hélicoptère, posé **nez planté dans le sol, queue relevée** (7°, autour du nez), **enfoncé dans la terre** (10 unités
  du modèle : retour « on dirait qu'il flotte ») et
  **en flammes** (feu en boucle de la scène sur le moteur et l'emplanture de l'aile ; dans la partie, il fume sans brûler). Tôle un peu
  métallique (reflets de la petite image d'environnement de nuit de l'hélicoptère).
- **Aile arrachée** (retour « une partie de l'avion sur la partie gauche, vide ») : l'aile gauche du modèle (`aile-g`), projetée loin de l'épave,
  **plantée de biais dans le sol à gauche de l'image**, derrière la lampe (repère de la scène (−70 ; −130), inclinée de 55° autour de sa corde,
  cap 20°, enfouie au quart ; `AILE` dans `scene-v2/js/avion.js`) ; l'avion garde le moignon de l'aile. Atelier : `?aile=x,0,z`, `?aileinc=`,
  `?ailecap=`.
- **Animations du décor** (retour « avant, le rotor de l'hélicoptère tournait ; là, il n'y a plus rien » ; propositions 2 à 5 retenues), toutes
  sur la boucle de 8 s (nombre entier de cycles), `?animations=0` pour les retirer :
  - **tôle qui bat au vent** sur l'aile plantée à gauche (`userData.tole`, `scene-v2/js/avion.js`) : volet de tôle de l'avion accroché par une
    charnière au **bord de fuite** de l'aile, qui pend au-delà ; 4 battements par boucle et un frémissement, angle de −1,3 à +0,35 rad autour
    du bord : il ne rentre jamais dans l'aile (retour « le clapet traverse l'aile ») ; `?tolepos=` le déplace le long du bord ;
  - **faisceau du projecteur** (`creerFaisceau`, `scene-v2/js/animations.js`) : le projecteur du jeu est éteint et derrière les caméras ; un cône
    de lumière part de loin derrière la scène et balaie le ciel, un aller-retour par boucle (`?projecteur=x,0,z`, `?faisceau=` : décalage du cap) ;
  - **braises et étincelles** (`creerBraises`) qui montent du feu de l'avion en tournoyant (vies de 8/3 à 8/7 s), et **fumée plus épaisse et plus
    sombre** (mélange des jetons de fumée du jeu) ;
  - **parachute du jeu** : sa voilure est accrochée à un **arbre mort** (modèle du jeu : tronc, trois branches, suspentes, harnais vide ;
    `creerParachute`), replacé à droite du personnage 2 pour que le tronc se voie (retour « comment il tient ? »), plus grand ; la voilure ondule
    au vent (2 et 3 cycles par boucle) ; `?parachute=x,0,z`, `?parachutek=`, `?parachutecap=`. Hors du cadre sur téléphone.
- `?decor=avant` : l'ancien décor (hélicoptère agrandi, voitures), comme le réglage `?test=1&decor=avant` du jeu. Atelier : `?avionlacet=degrés`
  fait pivoter l'épave autour du nez (essais à 140, 180, 220° : l'avion passait derrière le personnage 2 et le mur ; orientation du jeu gardée).

## À venir côté jeu
- **Carte** : la scène est posée dans la cour du bâtiment (`stage` dans `scene-v2/js/scene.js`), décor dégagé devant les caméras ;
  hélicoptère agrandi et déplacé (`scene-v2/js/helico.js`). Une nouvelle carte demandera sans doute de reposer la scène, d'ajouter ses fichiers
  à la liste de `outils/scene/copier-jeu.mjs` (`DONNEES`) et de revoir les cadrages.
