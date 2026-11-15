# Scène de l'accueil — description validée

Image animée plein écran de la page d'accueil : construite en 3D avec les éléments du jeu Z-Survival
(personnages, zombie, carte, hélicoptère écrasé) au lot 1 (`scene/`), puis transformée en **vidéo en boucle**
au lot 2b (`img/accueil/`, voir « Vidéos de l'accueil » plus bas). La page d'accueil ne charge pas Three.js :
la scène sert uniquement à fabriquer la vidéo.

## Composition
- **Personnage 1** — au premier plan, **de face**, il **vise au loin** (arme épaulée,
  regard au-delà de la caméra).
- **Personnage 2** — **légèrement en retrait**, **un pied posé sur le dos d'un zombie**
  pour le clouer au sol ; il le **vise vers le bas, canon pointé sur lui**.
- **Zombie** — **à plat ventre** sous le personnage 2, **le bras tendu vers l'avant**.
- **Fond** — la **carte du jeu (le bâtiment) à gauche**, **l'hélicoptère écrasé à droite**.

## Animations (douces, en boucle sans coupure)
- respiration des deux personnages ;
- armes qui bougent un peu ;
- zombie qui se débat sous le pied et **griffe le sol** ;
- **fumée et flammes** de l'hélicoptère ;
- **lumière qui vacille** ;
- **brume**.

La boucle doit être parfaite : la dernière image rejoint la première sans saut
(toutes les animations sur des périodes qui divisent la durée de la boucle).

## Points d'attention
- **La pose du pied sur le zombie n'existe pas dans le jeu** : il faudra la construire
  (pose du personnage 2 et pose « plaqué au sol » du zombie, contact pied / dos crédible).
- Le zombie à plat ventre n'est pas non plus une pose du jeu : à construire aussi.
- Vue : la scène est cadrée de face / trois-quarts, pas en vue de dessus comme le jeu ;
  les modèles doivent tenir à cette distance.
- Version mouvement réduit (`prefers-reduced-motion`) : afficher une image fixe de la scène
  au lieu de la vidéo.
- Téléphone d'abord : prévoir un cadrage portrait (les personnages au centre) et un
  cadrage paysage (bâtiment et hélicoptère visibles de chaque côté).

## Copie figée des éléments du jeu (lot 1)

La scène 3D (`scene/`) ne charge rien depuis le jeu en ligne : les fichiers du jeu dont elle a besoin sont
**recopiés tels quels** dans `scene/jeu/`, à la même place que dans le jeu (`js/core/`, `js/game/`, `data/game/`,
`css/`, `vendor/three/`). Aucun fichier copié n'est retouché : les enrichissements de la scène vivent dans
`scene/js/` (voir `Docs/lots/lot-1.md`).

- **Origine** : dépôt `Nowyyy/Z-Survival`, branche **`dev`**, commit **`3c25e3a08e7b34f2541be145d59ecaf8d071a2ae`**
  (« Update seed.md », 2026-11-14), lu en lecture seule dans un clone temporaire hors de ce dépôt.
- **Refaire la copie** (par exemple après les skins de la V0.8) :
  `node scene/outils/copie-jeu.mjs <clone du jeu sur dev>` ; le script suit les imports des modules de départ,
  recopie la liste de données, et écrit l'origine (branche, commit, liste) dans `scene/jeu/ORIGINE.json`.

| Dossier de `scene/jeu/` | Fichiers (même chemin dans le jeu) | Rôle pour la scène |
|---|---|---|
| `vendor/three/` | `three.module.js`, `three.core.js`, `LICENSE-three.txt`, `version.json` | Three.js **0.186.1**, même version que le jeu (importmap de `scene/index.html`). |
| `js/game/` | `world.js` (+ `windows-mesh.js`, `see-through.js`) | Monde du jeu : sol, bâtiment « Nacht der Untoten » (murs, fenêtres à planches, mobilier), décor extérieur. |
| `js/game/` | `character-v2.js` | Personnages « os rigides » (joueur et zombies), construits par le kit du jeu. |
| `js/game/` | `lamps.js`, `lights.js` | Lampes à huile (maillages) ; `lights.js` suit l'import dynamique de `lamps.js`. |
| `js/game/` | `fire.js`, `mist.js` | Feu et brume du jeu (créés par `world.js`) ; leurs shaders sont repris par la boucle. |
| `js/game/` | `textures.js`, `palette.js` | Textures générées en code, couleurs lues dans `css/tokens.css`. |
| `js/core/` | `character-parts.js`, `pose-v2.js`, `persos-variants.js`, `texgen-persos.js` | Pièces, squelettes, variantes et textures des personnages. |
| `js/core/` | `epaves.js` | Hélicoptère écrasé (`helicopterModel`), cratère, traînée, voiture en flammes. |
| `js/core/` | `layout.js`, `zones.js`, `windows.js`, `maps.js`, `collision.js`, `shape.js`, `floors.js`, `plank-layout.js` | Couches de la carte (murs, fenêtres, portes, étages), planches. |
| `js/core/` | `decor.js`, `decor-vivant.js`, `decor-interieur.js`, `furniture-model.js`, `mobilier-aspect.js`, `portes-aspect.js` | Décor extérieur et intérieur. |
| `js/core/` | `lamps.js`, `fog.js`, `see-through.js`, `texgen.js`, `color.js`, `rng.js`, `vec.js`, `camera.js`, `viewport.js`, `movement.js` | Modèle des lampes, masque de brume, textures, outils. |
| `data/game/` | `characters-v2.json`, `poses-v2.json`, `persos-choix.json`, `zombie-variants.json` | Personnages (variante « riche » de la table des choix), squelettes. |
| `data/game/` | `render.json`, `textures.json`, `camera.json`, `windows.json`, `lumieres.json` | Réglages de rendu, textures, fenêtres, lumières. |
| `data/game/maps/rez-de-chaussee/` | `world.json`, `decor.json`, `zones.json`, `etage.world.json`, `decor-interieur.world.json`, `mobilier.world.json`, `feux.json`, `lampes.world.json`, `epaves.json` | La carte (plan converti en unités du jeu), son décor, ses épaves. |
| `css/` | `tokens.css` | Jetons de couleur du jeu (`--game-*`, `--perso-*`). |

## Boucle de la scène 3D (lot 1)

- **Durée de la boucle : 8 secondes** (`DUREE` dans `scene/js/boucle.js`), en vue de la vidéo du lot 2.
- Toute la scène est une **fonction du temps** t (0 à 8 s) : aucune horloge, aucun hasard, aucun état qui s'accumule.
  Chaque mouvement fait un **nombre entier de cycles par boucle** :
  respiration 2 cycles (4 s) ; appui du pied du personnage 2 : 2 cycles ; zombie qui se débat : ondes de 2, 5 et 8 cycles ;
  griffe sur le sol : 4 coups (2 s chacun) ; bras du zombie tendu vers le personnage 1 une fois, de 1,0 s jusqu'au tir du personnage 2 (2,6 s), où il retombe ; bras tendu qui tâtonne : 2 cycles ; jambe qui gigote : 4 cycles ;
  visée qui dérive : ondes de 1, 3 et 5 cycles ; vacillement des lumières : ondes de 3 à 23 cycles.
- **Flammes et fumée** (`scene/js/feu.js`, shaders du feu du jeu) : chaque particule vit 8/k secondes (k entier : 9 à 15
  pour les flammes, 1 ou 2 pour la fumée) et naît en fondu ; son point de départ dépend de son numéro de vie modulo k.
- **Brume** (`scene/js/brume.js`, nappes et shader du jeu) : deux tirages du même bruit, décalés d'une boucle de vent,
  fondus l'un dans l'autre ; au début et à la fin de la boucle, c'est le même tirage.
- **Coup de feu du personnage 1** (retours du lot 1, `scene/js/tir.js`) : un tir par boucle à 5,2 s (recul 0,4 s, éclair 2 images,
  douille, fumée 1,4 s), terminé bien avant la fin de la boucle.
- **Détails** (retours 14 à 18 de `Docs/lots/lot-1-retours.md`, validés ; `?details=0` : l'ancienne scène) : **coup de feu du personnage 2** à
  2,6 s sur le zombie bras tendu (bras qui retombe, tête qui tape le sol, yeux fermés, relève de 6,5 à 7,5 s) ; coups d'œil du personnage 2
  (4,35 à 6,6 s) et du personnage 1 (5,8 à 7,65 s) ; rotor de queue (un tour par boucle) ; tôle métal irrégulière de l'hélicoptère ; flamme des
  lampes qui vacille ; barbe peinte et gilet noir matelassé du personnage 1 ; gilet à sangles du personnage 2.
- Vérification : `node scene/outils/verifier-boucle.mjs` (écart entre images voisines et à la jonction 8 s → 0 s ; le coup de feu
  donne un pic d'écart, attendu).

## Cadrage retenu (retours du lot 1)
- **B, contre-plongée rapprochée** (`scene/js/cadrages.js`), ouvert par défaut par `scene/index.html`.
- Aperçu dans la vraie page d'accueil : `scene/apercu.html` (scène en `?format=plein` dessous, site par-dessus, sans le modifier).
- Personnage 1 : survivant tactique (variante « riche »), **tir à genou, œil gauche fermé pendant le tir seulement** ; personnage 2 : **militaire**
  (variante « militaire » de la scène : casque, gilet pare-balles, treillis ; `?p2=civil` : ancienne tenue).
- Ordinateur : angle d'origine du cadrage B, personnage 1 au centre, zombie et personnage 2 décalés à droite (`placement` dans `cadrages.js`).
- Accueil du site : vignette sombre en bas (`.accueil-scene-vignette`), logo, accroche et bouton au plus bas, juste au-dessus du cadre.

## Coup de feu et accueil
- **`TEMPS_TIR = 5.2` s** (personnage 1) et **`TEMPS_TIR_P2 = 2.6` s** (personnage 2), réunis dans `TEMPS_TIRS` : constantes uniques, dans
  `js/accueil-boucle.js` (avec `DUREE_BOUCLE = 8`, `IMAGES_PAR_SECONDE = 30`, `TEMPS_AFFICHE = 1.9`). Elle est lue par la scène (`scene/js/tir.js` : `TIR = TEMPS_TIR` ; `scene/js/boucle.js` : `DUREE = DUREE_BOUCLE`),
  par la fabrication des vidéos (`outils/video/fabriquer.mjs`) et par le site (`js/accueil-video.js`, `js/accueil-tir.js`). Module pur, sans
  DOM : Node le lit aussi.
- Sur le site, `js/accueil-tir.js` suit le temps de la vidéo (`requestVideoFrameCallback`, sinon `currentTime`) et, une fois par tour et par
  instant de `TEMPS_TIRS` (à une demi-image près), envoie `zs:tir` : flash du cadre rouge (220 ms) et coup de feu du jeu si le son du site est activé. Au retour au
  début de la boucle, `zs:tour` (compté ; le HUD de jeu qui s'en servait a été retiré après le lot 2b, à la demande du propriétaire). Un saut de plus d'une seconde
  (rotation, reprise) recale le suivi sans effet.
- L'aperçu de l'atelier (`scene/apercu.html`) ouvre le site avec `?video=0` (pas de vidéo, la scène 3D en direct dessous) et envoie lui-même
  `zs:tir` et `zs:tour` au rythme de la scène.

## Vidéos de l'accueil (lot 2b)

**Méthode** (`outils/video/fabriquer.mjs`, détails dans `outils/video/LISEZMOI.md`) :
1. la scène est servie comme sur GitHub Pages (copie exacte de ce que publie le workflow) et ouverte dans **Chromium sans écran** (Playwright,
   rendu logiciel SwiftShader), au cadrage **B**, à la taille exacte de la vidéo (`?capture=1&w=…&h=…`) ;
2. rendu **image par image, pas de temps fixe** : l'image k montre l'instant k / 30 s (`window.__scene.rendre(t)`), quel que soit le temps
   de calcul ; **exactement un tour** : 240 images de 0 à 8 s − 1/30 s (la dernière n'est pas la copie de la première) ;
3. encodage **ffmpeg** : MP4 **H.264 High 4.0**, `yuv420p`, BT.709, deux passes à 2,6 Mbit/s, une image clé toutes les 2 s, **sans piste son**,
   **faststart**, encodage déterministe ;
4. **affiche** WebP (qualité 78) : l'image de `TEMPS_AFFICHE` = 1,9 s (bras du zombie tendu, bouche ouverte, loin des éclairs des tirs). Le site démarre la vidéo
   à cet instant : le passage de l'affiche à la vidéo ne se voit pas.

**Reproductible** : la scène est une fonction du temps (aucune horloge, aucun hasard) ; une nouvelle exécution redonne les mêmes images (vérifié
au bit près, même rendues dans le désordre) et les mêmes fichiers (empreintes SHA-256 dans `img/accueil/fabrication.json`).

| Fichier (`img/accueil/`) | Taille | Format | Usage |
|---|---|---|---|
| `accueil-16x9.mp4` | 2,47 Mo | 1920 × 1080, cadrage B paysage | écran en paysage (ordinateur, téléphone tourné) |
| `accueil-9x16.mp4` | 2,48 Mo | 1080 × 1920, cadrage B portrait | écran en portrait (téléphone, tablette debout) |
| `accueil-16x9.webp`, `accueil-9x16.webp` | 44 et 37 Kio | mêmes tailles | affiches : chargement, lecture bloquée, mouvement réduit |

Qualité mesurée contre les images rendues : PSNR ≈ 47 dB, SSIM 0,995 (flammes et brume sans dégradation visible).
Raccord de la boucle (vidéos décodées) : écart dernière → première image 0,70 (16:9) et 0,81 (9:16), pour des écarts entre images voisines de
0,35 et 0,46 en moyenne, 0,73 et 0,93 au plus : le raccord est une image voisine comme les autres.

**Intégration** (`index.html`, `js/accueil-video.js`, `css/accueil.css`) : `<picture>` de l'affiche (portrait / paysage) sous un `<video autoplay
muted loop playsinline>` sans source dans le HTML. La source est posée par le script après les polices du titre (1,5 s au plus), selon
`(orientation: portrait)`, et changée quand on tourne l'écran (reprise au même instant). La vidéo reste invisible tant qu'elle ne joue pas (aucun
bouton de lecture du navigateur si la lecture automatique est refusée) ; pause hors de l'accueil et onglet caché. **Mouvement réduit : aucune
vidéo téléchargée, affiche seule.**

## Fichiers repris du jeu au lot 2b (copies figées)

Origine : dépôt `Nowyyy/Z-Survival`, branche **`dev`**, commit **`10a9e6b90f3943f4062c4c42004f7c9f67a6804b`** (2026-11-15, « Merge pull request
#140 from Nowyyy/lot-8l »), lu en lecture seule dans un clone temporaire hors de ce dépôt.

| Fichier du site | Repris de | Rôle |
|---|---|---|
| `sons/coup-de-feu.wav` (64,6 Kio, PCM 16 bits mono 44,1 kHz, 0,75 s) | son `tir` de `data/game/sounds.json` (version 1 sur 3), calculé par `js/core/synth.js` du jeu (le jeu n'a aucun fichier audio) ; origine et empreinte : `sons/ORIGINE.json` ; refaire : `node outils/sons/copier-tir.mjs <clone>` | coup de feu joué au tir de la vidéo si le son du site est activé (`VOLUME_TIR` = 0,3 dans `js/musique.js`) |
| `css/accueil-chute-z.css` | images clés `e7-chute` et `e7-secousse` de `css/menu.css` (écran de chargement ; dernier changement du fichier : `b73e6f4`), telles quelles | chute du Z de l'entrée en scène de l'accueil |
- Zombie et personnage 2 **tournés vers le personnage 1** (le zombie rampe vers lui et tend le bras vers lui) ; `?zombie=face` : ancienne
  orientation, vers la caméra.
