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
  sous un sous-dossier (copies de vérification servies sous `/Z-Survival-Website/`, ancienne adresse GitHub Pages).
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
- Connexion admin sans cookie (domaines différents) : jeton signé dans `Authorization: Bearer`. Migrations versionnées
  dans `serveur/migrations/` (nouveau fichier `NNN_…sql`, jamais modifier une migration déployée).

## Organisation
- `index.html` : **page unique**. Accueil plein écran (vidéo en boucle de la scène sur son affiche, encart « Disponible sur navigateur » en bas à gauche, logo du studio, globe
  Français / English, « En savoir plus » + flèche qui descend vers News), puis les sections plein écran
  News / Characters / Weapons / About us. Navigation : 01 Accueil à 05 About us. Actualités : articles publiés lus sur le serveur (lot 3b), cartes, article complet dans une fenêtre à l'adresse `#actu/<slug>`.
  Personnages et Armes :
  contenu provisoire atténué et inerte sous un encart « Prochainement » (« Coming soon » en anglais). Globe de langue aussi
  dans l'en-tête ; « Bientôt disponible », bouton de son et globe en haut à droite de l'accueil comme dans l'en-tête (About us : logo animé du studio rejoué à chaque arrivée,
  puis pied de page). En-tête et navigation cachés sur l'accueil.
- `main.html` : ancienne page principale, simple redirection vers `./#news` (garde l'ancre).
- `admin/` (lot 3b) : page d'administration des actualités (noindex, non reliée au site, français seulement, CSP stricte),
  mode d'emploi `Docs/ref/admin.md`.
- `css/`, `js/` : styles et scripts ; `js/site.js` : script de la page ; `js/textes.js` : tous les textes
  (blocs `fr` et `en`, mêmes clés) ; `js/i18n.js` : langue (priorité : `?lang=`, puis choix gardé du globe, puis langue du navigateur :
  français pour les visiteurs francophones, anglais pour les autres ; aucune géolocalisation) ;
  `js/logo.js` : logo du jeu ;
  `js/config.js` : **adresse du serveur, seul endroit côté site** (la CSP d'`admin/index.html` doit autoriser la même) ;
  `js/actualites.js` : section Actualités (lecture du serveur, cartes, squelettes, erreur, liste vide, fenêtre de l'article, `#actu/<slug>`) ;
  `js/article.js` : carte et article complet (site et aperçu de l'admin) ; `js/markdown.js` : Markdown sûr, liste blanche, aucun HTML ;
  `css/actualites.css` : styles des actualités ;
  `js/musique.js` : musique M2 et boutons de son à côté de chaque globe (règles : `Docs/ref/musique.md`, volume : constante `VOLUME`).
  `js/accueil-boucle.js` : **seules valeurs de temps** de la boucle (`DUREE_BOUCLE`, **`TEMPS_TIR` = 5,2 s**, `IMAGES_PAR_SECONDE`,
  `TEMPS_AFFICHE`), partagées par la scène, la fabrication des vidéos et le site ;
  `js/accueil-video.js` : vidéo de l'accueil (16:9 ou 9:16 selon la forme de l'écran, affiche seule en mouvement réduit, `?video=0` pour l'atelier) ;
  `js/accueil-entree.js` : entrée en scène de l'accueil (chute du Z copiée du jeu dans `css/accueil-chute-z.css`, puis grain VHS ; 1,5 s,
  première visite de la session, `?intro=1` la force) ;
  `js/accueil-accroche.js` : accroche « radio de survie » (écriture lettre par lettre pendant l'entrée ; grésillement en CSS) ;
  `js/accueil-bandeau.js` : bandeau d'alerte qui défile (affiché seulement avec `?bandeau=1` tant qu'il n'est pas mis en service) ;
  `js/accueil-tir.js` : suit le temps de la vidéo et, à `TEMPS_TIR`, flash du cadre rouge et coup de feu du jeu si le son est activé (idées « catchy » suivies dans `Docs/ref/idees-accroche.md`).
- `musique/` : propositions de musique (MP3 en boucle, points de boucle dans `boucles.json` ; **M2 retenue**, règles
  d'intégration dans `Docs/ref/musique.md`) et planche d'écoute
  `planche.html` (noindex, non reliée au site) ; `outils/musique/` : script qui génère la musique (`Docs/ref/musique.md`).
- `contenus/` : contenus modifiables sans toucher au code, aujourd'hui sur GitHub, plus tard par une interface d'administration
  (`bandeau.json` : messages du bandeau d'alerte ; format et marche à suivre : `Docs/ref/contenus.md`). Exception assumée à la règle
  « textes dans `js/textes.js` », qui vaut pour les libellés fixes.
- `img/actus/` (lot 3b) : images des articles, ajoutées par le serveur (commit « Z-Survival admin » sur `main`) : ne pas les retoucher à la main.
- `fonts/` : polices du jeu (+ licences) ; `img/` : icônes et logos du studio (`no-way-studio.svg` fixe, `no-way-studio-anime.svg` animé) ;
  `img/accueil/` : vidéos de l'accueil (`accueil-16x9.mp4`, `accueil-9x16.mp4`) et leurs affiches WebP, fabriquées par
  `outils/video/fabriquer.mjs` depuis la scène (méthode : `outils/video/LISEZMOI.md`, `Docs/ref/scene-accueil.md`) ; vérification de
  l'accueil : `outils/video/verifier-accueil.mjs`.
- `sons/` : coup de feu du jeu (copie figée, origine dans `sons/ORIGINE.json`, refaite par `outils/sons/copier-tir.mjs`).
- `scene/` (lot 1) : atelier de la scène 3D de l'accueil, hors du site (noindex, aucun lien depuis l'accueil) :
  `scene/index.html` (la scène, `?cadrage=A|B|C&format=paysage|portrait|plein`, **B retenu**), `scene/planche.html` (planche),
  `scene/apercu.html` (la scène sous la vraie page d'accueil, pour juger le rendu),
  `scene/jeu/` (copie figée du jeu, jamais retouchée), `scene/js/` (scène, poses, enrichissements), `scene/outils/`
  (copie, captures, vérification de la boucle ; Node + Playwright, non publiés).
- `outils/admin/` (lot 3b) : banc local des actualités (`banc.mjs` : serveur sur SQLite, API GitHub simulée) et vérification
  de bout en bout `verifier-actus.mjs` (site et admin) ; `outils/copie-publiee.mjs` : copie publiée + `simulerActualites()`.
- `Docs/ref/` : documents de référence ; `Docs/lots/` : bilans de lot.
- `.github/workflows/pages.yml` : déploiement GitHub Pages à chaque push sur `main`.
- `serveur/` (lot 3a) : serveur des actualités (Node.js, Hono, `@libsql/client`, Dockerfile ; mode d'emploi `serveur/LISEZMOI.md`) ;
  `.github/workflows/serveur.yml` : tests et déploiement sur Cloud Run à chaque push sur `main` qui touche `serveur/`
  (s'arrête proprement tant que l'installation Google Cloud n'est pas faite).
