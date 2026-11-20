# CLAUDE.md — règles du projet Z-Survival-site

Site vitrine du jeu **Z-Survival** (jeu web de survie zombies en Three.js, vue de dessus,
publié sur https://nowyyy.github.io/Z-Survival/).
Adresse du site : **https://zsurvival-game.com/** (sans `www`, qui y redirige ; GitHub Pages, domaine chez OVH ; réglages et zone DNS :
`Docs/ref/nom-de-domaine.md`). L'ancienne adresse https://nowyyy.github.io/Z-Survival-Website/ y redirige.

## Fonctionnement par lots
- Le travail avance par **lots** numérotés (lot-0, lot-1, …). Chaque lot a sa consigne.
- Une branche par lot : `lot-N`, créée depuis `main` à jour.
- **Un commit par partie** du lot (`lot-N A: …`, `lot-N B: …`, …).
- En fin de lot : un bilan dans `Docs/lots/lot-N.md`, puis le tag `lot-N` et le push de
  la branche et du tag.
- **L'agent ouvre la Pull Request vers `main` et la fusionne lui-même, sans demander**
  (décision du propriétaire), une fois les vérifications passées. Il vérifie ensuite le
  déploiement GitHub Pages.

## Interdits
- **Aucun contenu de HoYoverse** (Zenless Zone Zero ou autre) : ni image, ni logo, ni police,
  ni vidéo, ni son, ni code. On s'inspire seulement de la mise en page et des effets.
- Le dépôt **Nowyyy/Z-Survival** est une référence **en lecture seule** : on peut le cloner
  dans un dossier temporaire **hors de ce dépôt** pour le lire, jamais le modifier ni y pousser.
  **Toujours lire sa branche `dev`, jamais `main`** (en retard).

## Règles techniques
- HTML, CSS et JavaScript en modules ES, sans étape de build (tant qu'un lot n'en décide pas autrement).
- **Téléphone d'abord** : le rendu en portrait (375 px de large) est la référence, puis l'ordinateur.
- **`prefers-reduced-motion`** respecté partout : animations réduites ou coupées.
- Textes regroupés dans `js/textes.js` (français et anglais : toute nouvelle clé s'écrit dans les deux langues),
  jamais éparpillés dans le HTML. Intitulés de section traduits : Accueil / Actualités / Personnages / Armes /
  À propos en français, Home / News / Characters / Weapons / About us en anglais (identifiants #news, #characters,
  #weapons, #about inchangés).
- **Aucun chemin ne commence par « / »** (chemins relatifs uniquement) : le site doit marcher à la racine du domaine comme
  sous un sous-dossier (copies de vérification servies à la racine, ou sous `/Z-Survival-Website/` avec `--sous-dossier`).
  Exceptions : `robots.txt` (syntaxe imposée) ; les **adresses publiques** (aperçu de partage, canonique, sitemap, JSON-LD) sont
  absolues, en `https://zsurvival-game.com/`.
- **Référencement** (lot 4a, `Docs/ref/referencement.md`) : une seule page indexable, `https://zsurvival-game.com/`, canonique fixe ;
  toute nouvelle page de travail porte `<meta name="robots" content="noindex, nofollow">` et une ligne `Disallow` dans `robots.txt`.
- Les contenus provisoires sont clairement marqués comme tels à l'écran.
- **Direction artistique = celle du jeu** (`Docs/ref/direction-artistique.md`) : couleurs en jetons
  dans `css/base.css` (mêmes noms que `css/tokens.css` du jeu), logo au Z incliné (`js/logo.js`),
  polices du jeu dans `fonts/` (licences OFL à garder à côté). Pas de couleur en dur hors jetons
  quand un jeton existe.

## Serveur (lot 3a : `serveur/`, référence `Docs/ref/serveur.md`)
- **Aucun secret dans le dépôt** (public), ni dans les journaux, les messages d'erreur ou les résultats de tests :
  jeton Turso, identifiant admin, empreinte du mot de passe, clé de session vivent dans **Google Secret Manager**
  (rangés par `serveur/deploiement/installer-gcp.sh`, que le propriétaire lance lui-même dans Cloud Shell). L'agent ne les
  voit jamais et ne les demande jamais. Les tests tournent sur une base SQLite en fichier, jamais sur Turso.
- Google Cloud : projet `z-survival-website`, **région `europe-west3`** (Francfort) pour tout ; base Turso `z-survival-site` (Francfort).
- Règles de coût : Cloud Run à **0 instance minimum**, 2 au maximum, processeur facturé seulement pendant les requêtes, 256 Mio ;
  Artifact Registry ne garde que les 3 dernières images ; pas de Cloud Storage tant qu'un lot ne le décide pas.
- **Le site et le serveur évoluent séparément** : `pages.yml` publie le site (jamais `serveur/`), `serveur.yml` déploie le serveur.
  Un lot sur le site ne touche pas `serveur/`, un lot sur le serveur ne touche pas les fichiers du site.
- Images des articles (lot 3b) : envoyées au serveur, réduites, converties en WebP sans métadonnées, enregistrées dans le dépôt
  (`img/actus/`) par l'API GitHub avec le secret facultatif `GITHUB_JETON_IMAGES` (`installer-gcp.sh --jeton-github`).
- Annonce Discord (lot 3c, `serveur/src/discord.js`) : à la **première** publication d'un article, message dans un salon par le webhook
  `DISCORD_WEBHOOK_ACTUS` (secret facultatif, `installer-gcp.sh --discord`), une seule fois par article (`annonce_discord_le`) ; un échec
  de Discord n'empêche jamais la publication ; aucune mention qui notifie.
- Bandeau d'alerte (lot 3d, `serveur/src/bandeau.js`) : l'admin modifie `contenus/bandeau.json`, que le serveur relit et réécrit dans le
  dépôt par l'API GitHub (même jeton que les images, commit « Z-Survival admin » sur `main`, refus 409 si le fichier a changé entre-temps) ;
  le site lit toujours le fichier.
- Aperçu de partage (lot 3f, `serveur/src/partage.js`) : l'admin modifie le titre et la description des balises Open Graph / Twitter
  d'`index.html` (seule source de ces textes) ; le serveur ne réécrit que ces quatre valeurs `content`, par l'API GitHub (même jeton, 409 si
  la page a changé entre-temps).
- Connexion admin sans cookie (domaines différents) : jeton signé dans `Authorization: Bearer`. Migrations versionnées
  dans `serveur/migrations/` (nouveau fichier `NNN_…sql`, jamais modifier une migration déployée).

## Organisation
- `index.html` : **page unique**. Accueil plein écran (vidéo en boucle de la scène sur son affiche, encart « Disponible sur navigateur » en bas à gauche, logo du studio, globe
  Français / English, « En savoir plus » + flèche qui descend vers News), puis les sections plein écran
  News / Characters / Weapons / About us. Navigation : 01 Accueil à 05 About us. Actualités : articles publiés lus sur le serveur (lot 3b), cartes, article complet dans une fenêtre à l'adresse `#actu/<slug>`.
  Personnages et Armes :
  contenu provisoire atténué et inerte sous un encart « Prochainement » (« Coming soon » en anglais). **Nouvelle section Armes en coulisses**
  (lot 6a, `Docs/ref/armes.md`) : interrupteur `SECTION_ARMES_ACTIVE` de `js/donnees.js` (false ; true = publiée), aperçu `?apercu=armes` ;
  éteint, aucun de ses fichiers n'est téléchargé. Globe de langue aussi
  dans l'en-tête ; « Bientôt disponible », lien Discord (https://discord.gg/4bBRJNzwwB, logo en SVG, nouvel onglet), bouton de son et globe en haut à droite de l'accueil comme dans l'en-tête (About us : ligne sous le logo du studio et texte modifiables depuis l'admin, `js/a-propos.js` ; grand titre fixe ; logo animé du studio rejoué à chaque arrivée,
  puis pied de page). À propos a **deux blocs de même forme** (image, titre, texte) : le jeu (clip du vrai jeu en boucle, lot 4b) au-dessus du studio (sur téléphone et sur un écran d'ordinateur de 860 px de haut ou moins : carrousel horizontal, le studio à droite, pour que la section tienne dans l'écran) ;
  titres et textes des deux blocs modifiables depuis l'admin (lot 3e : pages `a-propos-jeu` et `a-propos` du serveur ; par défaut
  `about.jeu.*`, `studio.signature`, `about.texte`). En-tête et navigation cachés sur l'accueil.
  Tête de page : titre et description français (= `meta.*`), aperçu de partage Open Graph / Twitter Card (titre et description modifiables
  depuis l'admin, lot 3f ; image `img/partage.jpg`), canonique, icônes, manifeste, JSON-LD (VideoGame, Organization avec l'e-mail, WebSite).
  Pied de page : © No Way Studio, licences des polices, contact `contact@zsurvival-game.com` (lien mailto).
- `main.html` : ancienne page principale, simple redirection vers `./#news` (garde l'ancre).
- `admin/` (lot 3b) : page d'administration des actualités (noindex, non reliée au site, français seulement, CSP stricte),
  mode d'emploi `Docs/ref/admin.md` ; « Pages du site » : page « À propos », bandeau d'alerte (lot 3d), aperçu de partage (lot 3f).
- `css/`, `js/` : styles et scripts ; `js/site.js` : script de la page (molette prise en main sur ordinateur : une section par geste, dans le sens de la molette) ; `js/textes.js` : tous les textes
  (blocs `fr` et `en`, mêmes clés) ; `js/i18n.js` : langue (priorité : `?lang=`, puis choix gardé du globe, puis langue du navigateur :
  français pour les visiteurs francophones, anglais pour les autres ; aucune géolocalisation) ;
  `js/logo.js` : logo du jeu ;
  `js/config.js` : **adresse du serveur, seul endroit côté site** (la CSP d'`admin/index.html` doit autoriser la même) ;
  `js/a-propos.js` : titre et texte du bloc du jeu (`GET /api/pages/a-propos-jeu`), ligne sous le logo (« Un jeu de No Way Studio » par défaut) et texte du studio (`GET /api/pages/a-propos`), lus sur le serveur ; textes de `js/textes.js` par défaut ;
  `js/a-propos-clip.js` : clip du jeu du bloc « Le jeu » (lot 4b : source posée seulement quand le bloc est visible, pause hors de l'écran,
  affiche seule en mouvement réduit) ;
  `js/actualites.js` : section Actualités (lecture du serveur, cartes, squelettes, erreur, liste vide, fenêtre de l'article, `#actu/<slug>`) ;
  `js/article.js` : carte et article complet (site et aperçu de l'admin) ; `js/markdown.js` : Markdown sûr, liste blanche, aucun HTML (sous-puces : deux espaces avant le tiret, trois niveaux au plus) ;
  `css/actualites.css` : styles des actualités ;
  `js/musique.js` : musique M2 et boutons de son à côté de chaque globe (règles : `Docs/ref/musique.md`, volume : constante `VOLUME`).
  `js/accueil-boucle.js` : **seules valeurs de temps** de la boucle (`DUREE_BOUCLE`, **`TEMPS_TIR` = 5,2 s**, **`TEMPS_TIR_P2` = 2,6 s**,
  `TEMPS_TIRS`, `IMAGES_PAR_SECONDE`, `TEMPS_AFFICHE`), partagées par la scène, la fabrication des vidéos et le site ;
  `js/accueil-video.js` : vidéo de l'accueil (16:9 ou 9:16 selon la forme de l'écran, affiche seule en mouvement réduit, `?video=0` pour l'atelier) ;
  `js/accueil-entree.js` : entrée en scène de l'accueil (chute du Z copiée du jeu dans `css/accueil-chute-z.css`, puis grain VHS ; 1,5 s,
  première visite de la session, `?intro=1` la force) ;
  `js/accueil-accroche.js` : accroche « radio de survie » (écriture lettre par lettre pendant l'entrée ; grésillement en CSS) ;
  `js/accueil-bandeau.js` : bandeau d'alerte qui défile en bas de l'accueil (en service ; `?bandeau=0` le cache) ;
  `js/section-armes.js`, `css/section-armes.css` (lot 6a) : nouvelle section Armes (chargés par `import()` seulement si l'interrupteur est
  allumé ou en aperçu) ; données `contenus/armes.json`, visuels `img/armes/` ;
  `js/accueil-tir.js` : suit le temps de la vidéo et, à chaque instant de `TEMPS_TIRS` (tir du personnage 2 puis du personnage 1), flash du cadre rouge et coup de feu du jeu si le son est activé (idées « catchy » suivies dans `Docs/ref/idees-accroche.md`).
- `musique/` : propositions de musique (MP3 en boucle, points de boucle dans `boucles.json` ; **M2 retenue**, règles
  d'intégration dans `Docs/ref/musique.md`) et planche d'écoute
  `planche.html` (noindex, non reliée au site) ; `outils/musique/` : script qui génère la musique (`Docs/ref/musique.md`).
- `contenus/` : contenus modifiables sans toucher au code, aujourd'hui sur GitHub, plus tard par une interface d'administration
  (`bandeau.json` : messages du bandeau d'alerte, modifiables depuis l'admin (lot 3d) ; format et marche à suivre : `Docs/ref/contenus.md`). Exception assumée à la règle
  « textes dans `js/textes.js` », qui vaut pour les libellés fixes.
- `img/actus/` (lot 3b) : images des articles, ajoutées par le serveur (commit « Z-Survival admin » sur `main`) : ne pas les retoucher à la main.
- Racine : `favicon.ico`, `site.webmanifest`, `robots.txt`, `sitemap.xml` (lot 4a, publiés par `pages.yml`).
- `img/icones/` (lot 4a) : favicon SVG, icônes 180 / 192 / 512 px et masquable, fabriquées par `outils/icones/fabriquer.mjs` (après `npm ci`
  dans ce dossier : opentype.js et wawoff2 lisent le Z de la police) ; `img/partage.jpg` : image de partage 1200 × 630, fabriquée par
  `outils/partage/fabriquer.mjs` ; vérification du lot : `outils/verifier-lot-4a.mjs`.
- `img/a-propos/` (lot 4b) : clip du jeu (`jeu-clip.mp4`, 8 s en boucle, 800 × 450, sans son) et son affiche, fabriqués depuis le **vrai jeu**
  (branche `dev`, copie en lecture seule hors du dépôt) par `outils/clip-jeu/fabriquer.mjs` (méthode : `outils/clip-jeu/LISEZMOI.md`) ;
  vérification : `outils/verifier-lot-4b.mjs`.
- `fonts/` : polices du jeu (+ licences) ; `img/` : logos du studio (`no-way-studio.svg` fixe, `no-way-studio-anime.svg` animé,
  `no-way-studio.png` pour le JSON-LD) ;
  `img/accueil/` : vidéos de l'accueil (`accueil-16x9.mp4`, `accueil-9x16.mp4`) et leurs affiches WebP, fabriquées par
  `outils/video/fabriquer.mjs` depuis la scène (méthode : `outils/video/LISEZMOI.md`, `Docs/ref/scene-accueil.md`) ; vérification de
  l'accueil : `outils/video/verifier-accueil.mjs`.
- `sons/` : coup de feu du jeu (copie figée, origine dans `sons/ORIGINE.json`, refaite par `outils/sons/copier-tir.mjs`).
- `scene/` (lot 1) : atelier de la scène 3D de l'accueil, hors du site (noindex, aucun lien depuis l'accueil) :
  `scene/index.html` (la scène, `?cadrage=A|B|C&format=paysage|portrait|plein`, **B retenu**), `scene/planche.html` (planche),
  `scene/apercu.html` (la scène sous la vraie page d'accueil, pour juger le rendu),
  `scene/jeu/` (copie figée du jeu, jamais retouchée), `scene/js/` (scène, poses, enrichissements), `scene/outils/`
  (copie, captures, vérification de la boucle ; Node + Playwright, non publiés). **La v1 reste celle de la vidéo publique : ne pas la modifier.**
- `scene-v2/` (lot 5a) : scène v2 de l'accueil, **en coulisses** (noindex, `Disallow` dans `robots.txt`, reliée à rien) : nouvelles armes du jeu
  (Kar98k, Colt), suivra les skins et la carte (`Docs/ref/scene-accueil-v2.md`) ; `scene-v2/jeu/` : copie figée refaite par
  `node outils/scene/copier-jeu.mjs` (lecture seule de `dev`, `ORIGINE.json` avec empreintes) ; `planche.html` (v1 / v2, historique),
  `apercu.html` ; vérification `node scene-v2/outils/verifier.mjs`. Sa vidéo (`outils/video/fabriquer.mjs --scene=v2`) ne va dans
  `img/accueil/` que sur demande du propriétaire.
- `armes/jeu/` (lot 6a) : copie figée des armes du jeu (lecture seule de `dev`, `ORIGINE.json`), **jamais publiée** ; `outils/armes/` :
  `copier-armes.mjs` (relevé, `contenus/armes.json` sans écraser les descriptions), `fabriquer-visuels.mjs` (`img/armes/`),
  `verifier-armes.mjs` (vérification) ; mode d'emploi `outils/armes/LISEZMOI.md`.
- `outils/admin/` (lot 3b) : banc local des actualités (`banc.mjs` : serveur sur SQLite, API GitHub simulée) et vérification
  de bout en bout `verifier-actus.mjs` (site et admin) et `verifier-bandeau.mjs` (bandeau d'alerte, lot 3d) ; `outils/copie-publiee.mjs` : copie publiée + `simulerActualites()`.
- `Docs/ref/` : documents de référence ; `Docs/lots/` : bilans de lot.
- `.github/workflows/pages.yml` : déploiement GitHub Pages à chaque push sur `main`.
- `serveur/` (lot 3a) : serveur des actualités (Node.js, Hono, `@libsql/client`, Dockerfile ; mode d'emploi `serveur/LISEZMOI.md`) ;
  `.github/workflows/serveur.yml` : tests et déploiement sur Cloud Run à chaque push sur `main` qui touche `serveur/`
  (s'arrête proprement tant que l'installation Google Cloud n'est pas faite).
