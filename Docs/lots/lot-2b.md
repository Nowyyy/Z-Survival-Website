# Lot 2b — Accueil : vidéo en boucle, tir synchronisé (flash, HUD, son), entrée VHS

Branche `lot-2b`, depuis `main` (`03918c5`). L'emplacement « Image animée — à venir » de l'accueil est remplacé par la **vidéo en boucle
de la scène du lot 1** (cadrage B), et l'interface réagit au coup de feu du personnage 1. La page d'accueil ne charge pas Three.js : la scène
sert uniquement à fabriquer la vidéo.

## Ce qui a été fait

### A — Fabrication des vidéos (`outils/video/`)
- **`outils/video/fabriquer.mjs`** (mode d'emploi : `outils/video/LISEZMOI.md`) : la scène (`scene/index.html`) est servie comme sur GitHub
  Pages et ouverte dans **Chromium sans écran** (Playwright). Elle est rendue **image par image avec un pas de temps fixe** : l'image k montre
  l'instant k / 30 s, quel que soit le temps de calcul (environ 1 s par image ici). Puis **ffmpeg** encode la vidéo.
- **Exactement un tour** : 240 images de 0 à 7,967 s, la dernière n'est pas la copie de la première.
- Deux versions, cadrages validés au lot 1 : **ordinateur 16:9, 1920 × 1080** (B paysage) et **téléphone 9:16, 1080 × 1920** (B portrait).
- **MP4 H.264 High 4.0**, `yuv420p`, **sans piste son**, **faststart**, deux passes à 2,6 Mbit/s, une image clé toutes les 2 s.
- **Affiche WebP** par format, prise à **2,4 s** : le bras du zombie est tendu, loin de l'éclair du tir.
- **Une seule constante de temps** : `js/accueil-boucle.js` contient `DUREE_BOUCLE = 8`, **`TEMPS_TIR = 5.2`**, `IMAGES_PAR_SECONDE = 30` et
  `TEMPS_AFFICHE = 2.4`. Ce module est lu par la scène (`scene/js/tir.js`, `scene/js/boucle.js`), par la fabrication et par le site.
- **Reproductible**, vérifié :
  - quelques images rendues une seconde fois, dans un autre ordre, sont identiques au bit près ;
  - un second encodage donne les mêmes empreintes SHA-256 (`img/accueil/fabrication.json`).

### B — Vidéo dans l'accueil (`js/accueil-video.js`, `index.html`, `css/accueil.css`)
- Dans le cadre :
  - une `<picture>` porte l'**affiche** (portrait ou paysage, choisie par le navigateur) ;
  - par-dessus, un `<video autoplay muted loop playsinline>` **sans source dans le HTML**, avec l'affiche en `poster` ;
  - le cadre rouge, la vignette, les logos, l'accroche et les boutons ne bougent pas.
- **Choix de la version** selon `(orientation: portrait)` : portrait → 9:16, paysage → 16:9, tablette comprise. Quand on **tourne l'écran**,
  la version change et reprend au même instant de la boucle.
- **La vidéo ne retarde pas le titre** : sa source n'est posée qu'après le chargement des polices du titre (1,5 s au plus).
- Si la page s'ouvre sur une autre section, rien n'est téléchargé avant l'arrivée sur l'accueil. Accueil quitté ou onglet caché : la vidéo
  se met en pause.
- **Lecture automatique bloquée** (mode économie d'énergie de l'iPhone…) :
  - la vidéo reste **invisible tant qu'elle ne joue pas vraiment** : seule l'affiche se voit, sans bouton de lecture du navigateur ;
  - les contrôles WebKit sont masqués aussi en CSS ;
  - la lecture est retentée une fois, au premier toucher du visiteur.
- La lecture **démarre à 2,4 s**, l'instant de l'affiche : le passage de l'image fixe à la vidéo ne se voit pas.
- **Mouvement réduit** : la source n'est jamais posée, donc **aucune vidéo téléchargée** ; seule l'affiche est visible.
- La mention provisoire, la brume et le grain provisoires sont retirés.
- **Pages de travail** : `scene/apercu.html` et `scene/planche.html` restent en ligne (`noindex`, non reliées au site). L'aperçu ouvre le
  site avec `?video=0` : la scène 3D tourne dessous, en direct. Il envoie lui-même `zs:tir` et `zs:tour`.

### C — Tir synchronisé (`js/accueil-tir.js`, `js/musique.js`)
- **Suivi du temps** par un seul module :
  - il lit `requestVideoFrameCallback` (instant de l'image affichée), sinon il boucle sur `currentTime` ;
  - à **`TEMPS_TIR`** (à une demi-image près), il envoie `zs:tir`, **une fois par tour** ;
  - au **retour au début de la boucle**, il envoie `zs:tour` ;
  - après un saut de plus d'une seconde (rotation, reprise), il se recale sans effet : jamais de tir en double ni à contretemps.
- **Flash du cadre** : 220 ms (au lieu de 520 ms). Le cadre et son halo virent au rouge vif, jamais au blanc, un éclat par tour de 8 s.
- **HUD de jeu** : puces du HUD du jeu (fond `--hud-bg` à 78 %, contour `--hud-border`, mêmes jetons que le jeu), libellés en **Rubik Dirt**.
  - Contenu :
    - **« MANCHE 01 »** (« ROUND 01 » en anglais, clé `accueil.hud.manche`) ;
    - **heure de nuit** « 23:47 », avec un point rouge « REC » qui pulse doucement, **+ 1 min à chaque tour** ;
    - **munitions** (cartouche + « 30 »), qui passent **à 29 au tir** avec un petit sursaut rouge, puis **reviennent à 30 au tour suivant**.
  - Placement :
    - téléphone en portrait : sous les deux rangées du haut (manche et heure à gauche, munitions à droite) ;
    - ordinateur et téléphone en paysage : dans les coins du bas, de part et d'autre du titre et du bouton.
  - Il y avait la place de garder l'heure à toutes les tailles testées.
  - **Mouvement réduit** : HUD affiché, fixe (30 munitions, 23:47, point immobile).
- **Coup de feu audible** :
  - le **bruit de tir du jeu**, en copie figée (`sons/coup-de-feu.wav`, 64,6 Kio) : le jeu n'a aucun fichier audio, ce son est **calculé par
    son propre synthétiseur** (`js/core/synth.js`, son `tir`, version 1 sur 3, `dev` @ `10a9e6b`) par `outils/sons/copier-tir.mjs` ;
  - origine et empreinte : `sons/ORIGINE.json` ;
  - il est joué **par-dessus la musique**, au volume **`VOLUME_TIR = 0.3`** (en tête de `js/musique.js`) ;
  - seulement si le **son du site est activé** par le bouton : il ne déclenche jamais le son à lui seul ;
  - jamais onglet caché, jamais sans vidéo qui joue, jamais en mouvement réduit ;
  - le fichier n'est **téléchargé qu'à l'activation du son** (et jamais en mouvement réduit).
- `pages.yml` publie maintenant `sons/`.

### D — Entrée VHS et bouton vivant
- **Entrée en scène** à la **première visite de la session** seulement :
  - un drapeau `sessionStorage` est lu et écrit par le script de tête, protégé par `try/catch` ; `?intro=1` force l'entrée ;
  - **0 à 1,5 s** : **chute du Z de l'écran de chargement du jeu**, copie figée des images clés `e7-chute` et `e7-secousse` de `css/menu.css`
    (`dev` @ `10a9e6b`) dans `css/accueil-chute-z.css`, avec les mêmes durées et les mêmes courbes ; l'impact tombe à 0,6 s et le titre
    tremble ;
  - un **léger grain VHS**, posé sur la scène dès le départ, **se dissipe d'un fondu continu de 0,6 à 1,4 s** et laisse apparaître la scène,
    sans clignotement ;
  - l'accroche, le bouton et la flèche arrivent à 0,65, 0,75 et 0,85 s. L'accroche « radio » s'écrit entre 0,65 et 1,45 s ;
  - **tout est fini à 1,5 s**, compté depuis le premier affichage ;
  - **un toucher, un clic, une touche ou la molette la passe** : tout se met en place d'un coup ;
  - rien ne bloque les clics pendant l'entrée.
  - Les coulures animées de l'ancienne entrée (2 à 3,9 s) sont retirées : elles dépassaient 1,5 s.
- **Bouton « En savoir plus » vivant** :
  - **coup de pinceau** rouge aux bords irréguliers, avec le filtre `#brush` existant (celui de la navigation), qui balaie le bouton ;
  - en même temps, une **coulure de sang** descend sous le bouton et sa goutte tombe ;
  - au **survol** sur ordinateur, au **toucher** sur téléphone (classe `est-touche`), au focus clavier ;
  - **petite coulure discrète toutes les 7 s** (à partir de 3 s) ;
  - mouvement réduit : ni coulure ni animation du pinceau.

## Vérifications

`outils/video/verifier-accueil.mjs` (Playwright, Chromium) tourne sur une **copie exacte de ce que publie le workflow**, servie sous
`/Z-Survival-Website/` (avec les requêtes partielles, comme GitHub Pages). Tailles : **375 × 667, 320 × 568, 667 × 375 (téléphone en
paysage), 1440 × 900**, chacune avec et sans mouvement réduit. Résultat : **152 vérifications sur 152 réussies** :
- **Bonne vidéo** :
  - 9:16 en portrait, 16:9 en paysage, une seule vidéo téléchargée, affiche en `poster` ;
  - lecture partie de 2,4 s ;
  - **écran tourné** (375 × 667 → 667 × 375) : version 16:9 chargée, même instant de la boucle, tir suivant toujours unique.
- **Mouvement réduit** : affiche visible, vidéo sans source, **aucune requête vidéo ni son de tir**, même après activation de la musique ; HUD
  fixe ; pas d'entrée ; pas de coulure.
- **Ni Three.js ni rien de `scene/`** chargés par l'accueil.
- **Tir** :
  - **à 5,200 s** à chaque fois (tolérance 0,1 s) ;
  - flash du cadre (`cadre-tir`, 0,22 s) et munitions **30 → 29** avec sursaut ;
  - retour au début : **30 et 23:48** ;
  - suite des événements **tir → tour → tir** : **aucun double**.
- **Coup de feu** :
  - **jamais sans le son activé** (aucun fichier son demandé) ;
  - **présent avec le son activé** (fichier chargé une seule fois, un coup de feu au tir) ;
  - **absent onglet caché** : la vidéo se met en pause ; un tir reçu malgré tout ne sonne pas. Au retour, la vidéo reprend.
- **Entrée** :
  - jouée à la première visite, **finie en ≤ 1,5 s** (marge de mesure 0,1 s) ;
  - **pas rejouée** à la réouverture dans le même onglet ;
  - `?intro=1` la force ; **un clic la passe aussitôt** ;
  - un nouvel onglet est une nouvelle session : elle s'y rejoue.
- **HUD** : **aucun chevauchement** (logos, réglages, titre, accroche, bouton, flèche), toujours dans le cadre, à toutes les tailles, rotation
  comprise.
- **Bouton** : coulure toutes les 7 s ; survol (pinceau et coulure) ; toucher (pinceau et coulure, puis descente vers News, vidéo en pause).
- **Raccord de la boucle**, mesuré sur les vidéos décodées par ffmpeg : l'écart entre la dernière et la première image est de **0,70** (16:9) et
  **0,81** (9:16). Entre images voisines : 0,35 et 0,46 en moyenne, 0,73 et 0,93 au plus. Le raccord ne se distingue pas d'un passage d'image
  ordinaire.
- **Fichiers** : 240 images, 30 im/s, H.264 High, `yuv420p`, **une seule piste (vidéo)**, **moov en tête** (faststart).
- Qualité contre les images rendues : **PSNR ≈ 47 dB, SSIM 0,995**.
- **Aucune erreur console, aucun fichier manquant**.
- **Reste du site inchangé** : `outils/musique/verifier-site.mjs` (lot 2a) relancé, **158/158**. Il couvre la musique et ses boutons, les
  sections, les langues, la navigation au clavier et au clic, le défilement et l'en-tête sans chevauchement. Seule retouche : la mention
  provisoire, retirée, n'est plus dans sa liste.
- **Pages d'atelier** : `scene/index.html`, `scene/apercu.html` et `scene/planche.html` s'ouvrent sans erreur, `noindex`, et l'aperçu ne
  télécharge aucune vidéo.
- Aucun chemin ne commence par « / ».

### En ligne, après la fusion (https://nowyyy.github.io/Z-Survival-Website/)
- `node outils/video/verifier-accueil.mjs --en-ligne` : **144/144**. Ce sont toutes les vérifications de navigateur ci-dessus, aux huit
  combinaisons de taille et de mouvement réduit. Le contrôle des fichiers vidéo (raccord, pistes, faststart) ne tourne qu'en local, sur les
  fichiers du dépôt.
- `node outils/musique/verifier-site.mjs --en-ligne` (lot 2a : musique, navigation, langues, en-tête) : **158/158**.
- Le lot 3a (serveur, PR #38), fusionné juste avant, ne touche aucun fichier du site.

## Poids des fichiers de l'accueil

| Fichier | Poids | Quand |
|---|---|---|
| `img/accueil/accueil-9x16.webp` (affiche téléphone) | 37 Kio | au chargement (portrait) |
| `img/accueil/accueil-16x9.webp` (affiche ordinateur) | 44 Kio | au chargement (paysage) |
| `img/accueil/accueil-9x16.mp4` | **2,48 Mo** (2 602 360 octets) | après les polices, écran en portrait, sauf mouvement réduit |
| `img/accueil/accueil-16x9.mp4` | **2,47 Mo** (2 586 987 octets) | après les polices, écran en paysage, sauf mouvement réduit |
| `sons/coup-de-feu.wav` | 64,6 Kio | au clic sur le bouton de son (pas en mouvement réduit) |
| `musique/M2.mp3` (lot 2a) | 1,5 Mo | au clic sur le bouton de son |

Les vidéos restent sous les 3 Mo visés, **sans perte de qualité visible**, flammes et brume comprises : rien à signaler.

## Limites
- **Safari iOS et Android réels non testés ici** : seulement Chromium (Playwright), qui lit le H.264. Le format choisi (High 4.0, `yuv420p`,
  faststart, sans son, `muted playsinline`) est celui qu'acceptent Safari et Chrome sur téléphone.
- **Téléphones très allongés** (19,5:9) : la vidéo 9:16 remplit l'écran en `cover`, donc environ 9 % de chaque bord gauche et droit sont
  rognés. Les personnages restent entiers ; le bâtiment et l'hélicoptère sont un peu coupés.
- **Tablette debout** (3:4) : le haut et le bas de la vidéo 9:16 sont rognés.
- `requestVideoFrameCallback` n'existe que depuis Safari 15.4 ; avant, le suivi lit `currentTime` à chaque image (précision d'environ une
  image).
- **Session** : `sessionStorage` est propre à chaque onglet. Un nouvel onglet rejoue l'entrée ; un rechargement dans le même onglet ne la
  rejoue pas.
- **Téléphone en paysage** (667 × 375) : le titre Z-Survival, très grand (14 vw), arrive juste sous « Bientôt disponible ». C'était déjà le cas
  avant ce lot ; il ne le touche pas.
- Le volume du coup de feu (0,3) n'a pas été écouté par l'agent.
- **Tag `lot-2b`** : créé en local ; son push est refusé (HTTP 403) par l'environnement, comme pour les lots précédents.

## À tester sur ton iPhone et ton Android
1. **Mode économie d'énergie de l'iPhone** (Réglages → Batterie) : l'accueil doit montrer l'**affiche fixe, propre, sans bouton de lecture**.
   Un toucher sur la page peut relancer la vidéo (essai unique). Sans ce mode, la vidéo doit partir seule.
2. **Son activé** :
   - touche le haut-parleur, puis attends le tir (le personnage 1 tire environ toutes les 8 s) ;
   - le **coup de feu** doit tomber pile avec l'éclair, au-dessus de la musique sans la couvrir ;
   - trop fort ou trop faible : change `VOLUME_TIR` (0,3) en tête de `js/musique.js`, par exemple 0,2 ou 0,45 ;
   - son coupé : jamais de coup de feu ;
   - change d'application puis reviens : pas de coup de feu pendant l'absence.
3. **Rotation de l'écran** : tourne le téléphone sur l'accueil. La vidéo passe en 16:9 (ou revient en 9:16) au même moment de la scène, et le HUD
   va dans les coins du bas. Les munitions et l'heure continuent normalement.
4. **Entrée** :
   - premier passage : le Z tombe, puis le grain se dissipe, en 1,5 s ;
   - rechargement : plus d'entrée ;
   - `?intro=1` : à chaque fois ; un toucher la passe.
5. **HUD** : munitions 30 → 29 au tir, 30 au tour suivant, heure + 1 min par tour ; rien ne recouvre les logos ni les boutons.
6. **Bouton** : un toucher sur « En savoir plus » donne le coup de pinceau et la coulure, pendant la descente vers les Actualités. Une petite
   coulure revient de temps en temps.
7. **Réglages du téléphone → Accessibilité → Réduire les animations** : affiche fixe, aucune vidéo, HUD immobile, pas d'entrée.
8. **Données mobiles** : environ 2,5 Mo par ouverture de l'accueil (une seule vidéo selon l'orientation). Vérifie que le titre et les boutons
   s'affichent tout de suite, avant la vidéo.

## Retour du propriétaire (15/11/2026, branche `accueil-plateforme`)
1. **HUD retiré** : plus de manche, d'heure ni de balles. Le tir garde le flash du cadre et le coup de feu (son activé). Le module repère
   toujours le retour au début de la boucle (`zs:tour`). Les jetons `--hud-*`, ajoutés pour le HUD, sont retirés de `css/base.css`.
2. **Encart « Disponible sur navigateur »** en bas à gauche, à la manière des badges « disponible sur… » des boutiques et des consoles, sans aucun de
   leurs logos :
   - pastille sombre à contour os, flou d'arrière-plan ;
   - icône de fenêtre de navigateur dessinée en SVG, avec son curseur rouge ;
   - petite ligne « DISPONIBLE SUR », puis « Navigateur » en gras. En anglais : « AVAILABLE ON » puis « Browser » (demande du propriétaire, au lieu de « Available on the Web » ; clés
     `accueil.plateforme.petit` et `accueil.plateforme.grand` dans `js/textes.js`) ;
   - c'est une simple information, pas un lien ;
   - placement : sur téléphone en portrait, à gauche de la flèche ; sur ordinateur et téléphone en paysage, dans le coin du bas. Il remonte au-dessus
     du bandeau d'alerte quand celui-ci est affiché ;
   - jusqu'à 360 px, il est un peu plus compact : à 320 px en anglais, il touchait la flèche.
3. **Logo du studio de l'accueil un peu plus grand** : 64 → 76 px sur téléphone, 96 → 112 px sur ordinateur.

Vérifications :
- `outils/video/verifier-accueil.mjs`, adapté : **172/172**. L'encart est en bas à gauche, en français et en anglais, sans chevauchement, à
  toutes les tailles et après rotation. Le HUD est absent, le logo mesure 76 ou 112 px, et tout le reste du lot (vidéo, tir, son, entrée, bouton)
  est vérifié comme avant.
- `outils/musique/verifier-site.mjs` : **158/158**, dont la rangée du haut de l'accueil sans chevauchement de 320 à 1440 px avec le logo agrandi.

## État git
- Commits `lot-2b A` à `lot-2b E` sur la branche `lot-2b`, PR vers `main` fusionnée par l'agent (règle de `CLAUDE.md`).
- Tag `lot-2b` créé en local ; push du tag refusé (403) par l'environnement.
