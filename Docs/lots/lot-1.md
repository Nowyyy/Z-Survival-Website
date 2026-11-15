# Lot 1 — Scène 3D de l'accueil et planche de cadrages

Branche `lot-1`, tag `lot-1`. Le site lui-même n'a pas changé : la scène vit dans `scene/`, hors du site
(pages en `noindex`, aucun lien depuis l'accueil). La vidéo en boucle et son intégration viendront au lot 2.

**Planche à comparer sur téléphone** : https://nowyyy.github.io/Z-Survival-Website/scene/planche.html

> Suite : retours du propriétaire (cadrage B retenu, poses corrigées, tir, tenues, aperçu avec le site) dans `Docs/lots/lot-1-retours.md`.

## Ce qui a été fait

### A — Copie figée des éléments du jeu
- `scene/jeu/` : 62 fichiers du jeu recopiés **tels quels** (aucun n'est retouché), à la même place que dans le jeu.
  Origine : `Nowyyy/Z-Survival`, branche **`dev`**, commit **`3c25e3a`** (`3c25e3a08e7b34f2541be145d59ecaf8d071a2ae`),
  lu dans un clone temporaire hors de ce dépôt, jamais modifié.
- Three.js **0.186.1** (même version que le jeu), monde du jeu (`world.js` : sol, bâtiment « Nacht der Untoten », décor),
  personnages « os rigides » (`character-v2.js`), hélicoptère (`epaves.js`), lampes à huile, feu, brume, textures générées
  en code, carte `rez-de-chaussee`, jetons de couleur.
- `scene/outils/copie-jeu.mjs` refait la copie depuis un clone de `dev` (suivi des imports + liste de données) et écrit
  l'origine dans `scene/jeu/ORIGINE.json` : la scène pourra être relancée avec les skins de la V0.8.
- Liste détaillée et rôle de chaque fichier : `Docs/ref/scene-accueil.md` (« Copie figée »).

### B — Scène et poses (`scene/index.html`)
- Le **monde du jeu** est construit comme dans le jeu (`scene/js/monde.js`). La scène se place **dans la cour du bâtiment,
  au nord-est de l'angle du L**, caméra tournée vers le sud-sud-ouest : **bâtiment à gauche** (façade nord de l'aile sud,
  sa fenêtre F4 éclairée de l'intérieur), **hélicoptère écrasé à droite**, la lune en haut à gauche.
- **Personnage 1** (tenue « sable ») au premier plan, de face, pistolet tenu à deux mains, il **vise au loin, à droite de la caméra**.
- **Personnage 2** (tenue « olive ») en retrait : **pied gauche sur le haut du dos du zombie** (genou plié, semelle posée sur
  le dos, suivie à chaque image), jambe droite d'appui en arrière, bassin avancé et buste penché (poids vers l'avant),
  **canon pointé sur la tête du zombie**.
- **Zombie** (marcheur, tenue « blouse », blessé) **à plat ventre**, tête relevée, **bras gauche tendu vers l'avant**,
  **bras droit qui griffe le sol**, jambes allongées pointes au sol.
- Les poses n'existent pas dans le jeu : elles sont **construites à la main** (`scene/js/poses.js`) avec un petit solveur
  (`scene/js/rig.js` : orientation d'un os, cinématique inverse à deux os pour bras et jambes, placement de l'arme).
  Les réglages de placement sont en tête de `poses.js` (`PLACEMENT`) pour les retouches.
- Lumières : **lune** (la lumière du jeu, basse, derrière à gauche : contre-jour et longues ombres), lumière ambiante baissée,
  **lueur des flammes** de l'hélicoptère (deux lumières qui vacillent, la première porte des ombres), **deux lampes à huile du
  jeu** sur des piquets, une lampe d'appoint hors champ pour que les visages ne soient pas que des silhouettes, lueur derrière
  les planches des fenêtres. Ciel en dégradé, étoiles, disque de lune. **Brume** : les nappes basses du jeu.
- Paramètres : `?cadrage=A|B|C`, `?format=paysage|portrait` (cadre 16:9 ou 9:16 dans la fenêtre), `?t=` (image fixe),
  `?capture=1&w=…&h=…` (taille exacte), `?fps=1` (compteur). Outil de mise en place : `?plan=x0,z0,x1,z1` (vue de dessus).

### C — Animations en boucle
- **Durée : 8 secondes** (`scene/js/boucle.js`). Tout est fonction du temps, chaque mouvement fait un nombre entier de
  cycles par boucle : respiration (2), armes qui dérivent un peu (1, 3, 5), personnage 2 qui appuie (2), zombie qui se débat
  (2, 5, 8), griffe sur le sol (4 coups), bras tendu qui tâtonne (2), jambe qui gigote (4), flammes et fumée (particules dont
  la vie divise 8 s), lumières qui vacillent, brume qui dérive (fondu de deux tirages décalés d'une boucle).
- Détail : `Docs/ref/scene-accueil.md` (« Boucle de la scène 3D »). Vérification : `scene/outils/verifier-boucle.mjs`.

### D — Planche de cadrages (`scene/planche.html`)
- **A** plan large de face ; **B** contre-plongée rapprochée (caméra au ras du sol) ; **C** trois quarts (vue de la droite).
- Pour chacun : **paysage 16:9 (1600 × 900)** et **portrait 9:16 (900 × 1600)**, en WebP (qualité 0,9 ; 45 à 66 Kio),
  dans `scene/planche/`, capturés par `scene/outils/planche.mjs` (Playwright, image exportée par le canvas, t = 0 s).
- Les portraits sont **recadrés** (caméra plus proche, décalée) pour que les trois personnages restent grands et lisibles
  sur téléphone. Sous chaque image : « Voir en mouvement » vers `index.html?cadrage=X&format=…`.
- Publication : `scene/` ajouté aux fichiers publiés par `.github/workflows/pages.yml` (sans `scene/outils/`).

## Enrichissements des modèles (dans la scène, les fichiers copiés restent intacts)
Appliqués en mémoire au chargement (`scene/js/enrichissements.js`, `helico.js`, `persos.js`, `poses.js`, `ambiance.js`) :
1. **Échelle de la mise en scène × 1,6** : dans le jeu un personnage mesure 60 unités, soit 1 m à l'échelle de la carte
   (60 unités par mètre), pour des murs d'étage de 3 m ; vu de face il aurait l'air d'un enfant. Personnages, lampes et
   distances de la scène sont grandis de 1,6 (1,60 m).
2. **Hélicoptère × 2,4** (le jeu : à peine plus haut qu'un personnage), même modèle, même texture et mêmes teintes,
   **décalé de (150 ; −125)** pour ne pas traverser les murs de l'angle du L ; cratère et traînée agrandis d'autant (× 1,9).
3. **Visage des survivants** : yeux (blanc + pupille), sourcils, nez, bouche, menton (la tête du jeu est une sphère nue).
4. **Visage du zombie** : orbites sombres, yeux pâles (jeton `--perso-yeux`), bouche ouverte, dents.
5. **Pouces** sur les mains (joueur et zombies).
6. **Pistolet** : canon, pontet, détente, guidon, hausse, talon de chargeur, stries de glissière (le jeu : deux boîtes).
7. **Sphères plus fines** (20 × 14 facettes au lieu de 10 × 7 : têtes, mains, bottes) et capsules à 16 côtés.
8. **Textures des personnages en 512 px** (le jeu : 128 px pour le joueur, 256 px pour les zombies), même motif.
9. **Ombres portées par les vrais maillages** des personnages (le jeu utilise un volume d'ombre grossier).
10. **Lampes à huile du jeu sur des piquets** (support « mur »), en double face (le jeu omet les dessous, vus d'en bas).

Ajustements du décor pour la prise de vue (pas des modèles) : le « mur de brume » du jeu (un plafond à 110 unités, fait pour
la vue de dessus) est retiré et les nappes basses abaissées à 5 et 10 ; les arbres, buissons, voitures et le décor « vivant »
du jeu situés entre les caméras et la scène sont retirés ; les feux du jeu (non bouclables) sont cachés et remplacés par des
feux en boucle (mêmes shaders et couleurs) ; éclairage de nuit réglé pour la vue de face (ambiante 0,32 au lieu de 2,3).

## Vérifications (Chromium + Playwright, copie exacte de ce que publie le workflow, servie sous `/Z-Survival-Website/`)
- `scene/planche.html` (375 × 667 et 1440 × 900) et `scene/index.html` (A, B, C × paysage 1280 × 720 et portrait 375 × 667,
  plus la boucle animée et le mouvement réduit) : **aucune erreur ni avertissement console, aucun fichier manquant, aucune
  requête hors du site** ; balise `noindex` présente ; image non noire ; planche sans défilement horizontal à 375 px.
- **Boucle** (`verifier-boucle.mjs`, 200 images à 25 images/s) : l'écart entre la dernière et la première image est du même
  ordre qu'entre deux images voisines — A paysage 0,354 (moyenne 0,351, max 0,473), B portrait 0,512 (moyenne 0,450,
  max 0,641), C paysage 0,324 (moyenne 0,311, max 0,421) ; l'image à 8 s est identique à l'image à 0 s.
- **Site existant inchangé** : aucune différence avec `main` dans `index.html`, `main.html`, `css/`, `js/`, `fonts/`, `img/` ;
  l'accueil charge sans erreur (375 × 667, 1440 × 900) et n'a aucun lien vers `scene/`.
- Aucun chemin ne commence par « / » dans `scene/`.
- Les scripts de vérification ponctuels sont dans le dossier temporaire de la session ; les outils réutilisables
  (copie, planche, boucle) sont dans `scene/outils/` (non publiés).

## Fluidité (à titre d'information)
Le conteneur n'a pas de carte graphique : Chromium y dessine en **logiciel (SwiftShader)**. Mesure : environ
**2 images/s en 1280 × 720** (A et B paysage) et **5 images/s en 390 × 844** (A portrait). La scène compte environ
189 000 triangles et 80 appels de dessin, avec deux cartes d'ombres (lune 2048 px, flammes 1024 px). Sur un ordinateur ou un
téléphone récent avec carte graphique, ce sera bien plus fluide, mais la scène n'est pas faite pour tourner en direct sur le
site : le lot 2 en fera une vidéo.

## Limites
- **Style des modèles du jeu** : couleurs très pâles (choisies pour le contraste vu de dessus sur un sol sombre) et motifs
  rayés des tissus qui se voient de près ; les personnages gardent un air de mannequins articulés. Les visages ajoutés sont
  simples (style du jeu, pas réaliste).
- **Bâtiment** : de longs murs lisses (le jeu n'a ni toit ni façade travaillée) et des fenêtres basses (murs montés jusqu'au
  plafond, fenêtres restées à hauteur de jeu). Il se lit comme un grand mur sombre plus que comme une maison.
- **Hélicoptère** : agrandi et décalé, il n'est plus exactement à sa place de la carte.
- **Pose du pied** : réglée à l'œil, sans collision ; le pied suit le dos à chaque image mais peut s'y enfoncer d'un rien
  pendant que le zombie se débat. Mains sans doigts séparés.
- **Portraits** : le feu sort du cadre en C portrait (bâtiment à droite seulement) et touche le bord en A portrait.
- Images de la planche prises à t = 0 s seulement ; testé dans Chromium seulement, en rendu logiciel.

## Ce que tu dois choisir
1. **Le cadrage** : A, B ou C (et si le portrait du téléphone doit être le même cadrage que le paysage).
2. **Retouches de pose** : direction de la visée du personnage 1 (plus près de la caméra ? plus de profil ?), hauteur du pied
   et inclinaison du personnage 2, bras du zombie (plus tendu ? griffe plus visible ?).
3. **Détails des modèles** : garder l'échelle × 1,6 et l'hélicoptère × 2,4 ? visages assez lisibles ou à revoir ?
   couleurs plus soutenues que celles du jeu ? garder les lampes sur piquets ?
4. **Tenues** : sable / olive pour les survivants, blouse pour le zombie — ou d'autres (skins de la V0.8 plus tard).

## État git
- Commits `lot-1 A` à `lot-1 E` sur la branche `lot-1` (poussée), PR vers `main` fusionnée par l'agent.
- Tag `lot-1` créé en local ; **son push a été refusé (HTTP 403)** par l'environnement, comme celui de `lot-0`.
