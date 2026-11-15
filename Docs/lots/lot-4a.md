# Lot 4a — Finitions : aperçu de partage, icônes, référencement, paysage, en-tête

Branche `lot-4a`, depuis `main` (`0c726fd`), rebasée avant la PR sur `main` (`b8d0abd`, PR #55 : retouches de la scène B dans l’atelier, sans effet sur les vidéos du site ni sur l’image de partage). Des finitions maintenant que le site a sa vraie adresse, **https://zsurvival-game.com/**.
Hors périmètre, comme demandé : le logo animé du studio (laissé tel quel) et le bandeau d'alerte (toujours à l'essai, `?bandeau=1`).
Une demande du propriétaire arrivée pendant le lot est faite en **partie F** (À propos en deux blocs).

## Ce qui a été fait

### A — Aperçu de partage (Discord, WhatsApp, réseaux sociaux)
- Balises **Open Graph** et **Twitter Card** dans `index.html` : `og:type` website, `og:site_name` Z-Survival, `og:locale` fr_FR,
  `og:url` https://zsurvival-game.com/, titre, description, image (adresse, type, largeur, hauteur, texte de remplacement),
  `twitter:card` summary_large_image.
- Textes, dans le ton du jeu, rangés dans `js/textes.js` (`partage.*`, français et anglais) et recopiés tels quels dans le HTML (les
  réseaux ne lisent pas le JavaScript) ; la vérification contrôle qu'ils sont identiques :
  - titre : « Z-Survival — survie zombies sur navigateur » ;
  - description : « La nuit tombe, les morts se relèvent. Tiendrez-vous jusqu’à l’aube ? Z-Survival, jeu de survie zombies en vue de
    dessus par No Way Studio, bientôt disponible sur navigateur. »
- **Image `img/partage.jpg`** : 1200 × 630, **JPEG** (certains réseaux refusent le WebP), **72 Kio**. L'affiche du cadrage B (accueil
  16:9), la vignette et le cadre rouge de l'accueil, le **logo Z-Survival** (`js/logo.js`, polices du site), l'accroche « Tenir jusqu'à
  l'aube. » et le logo du studio.
- Fabriquée par **`outils/partage/fabriquer.mjs`** (Playwright) depuis la copie publiée du site : deux fabrications donnent le même
  fichier au bit près (empreinte dans `outils/partage/fabrication.json`).
- **Limite** : les adresses `#actu/…` partagent l'aperçu général du site (les réseaux ignorent ce qui suit le `#`). Pas de page de partage
  par article dans ce lot.

### B — Icônes
- Avant : `img/icone-48.png` et `img/icone-180.png`, copiées de l'icône du jeu (Z sans contour ni coulures), sans favicon SVG, ICO,
  icônes Android ni manifeste.
- Maintenant, tirées du **logo du site** (Z de la police du logo, incliné de 13°, contour sombre et coulures de `js/logo.js`, couleurs des
  jetons de `css/base.css`), sur le fond noir `#050505` :

| Fichier | Taille | Usage |
|---|---|---|
| `img/icones/icone.svg` | 7 Kio | favicon des navigateurs récents |
| `favicon.ico` | 3 Kio (16, 32, 48 px) | favicon de secours, à la racine |
| `img/icones/icone-180.png` | 180 px | écran d'accueil de l'iPhone |
| `img/icones/icone-192.png`, `icone-512.png` | 192, 512 px | Android, manifeste |
| `img/icones/icone-masquable-512.png` | 512 px | Android (forme imposée : Z dans la zone sûre) |

- À 16 px, les coulures sont retirées (illisibles) : il reste le Z et son contour.
- **Manifeste `site.webmanifest`** : nom Z-Survival, couleurs `#050505`, icônes ci-dessus, `display: browser` (le site s'ouvre comme
  d'habitude). `theme-color` `#050505` (déjà là).
- **Admin** : mêmes icônes (SVG, ICO, Apple). Pas de manifeste : sa règle de sécurité l'interdit (`manifest-src 'none'`), inutile ici.
- Fabriquées par **`outils/icones/fabriquer.mjs`** : un seul dessin SVG, rendu par Chromium à chaque taille. Le contour du Z est lu dans
  la police par **opentype.js** et **wawoff2** : `npm ci` dans `outils/icones/` (petit `package.json` propre à cet outil, le site reste
  sans dépendance ni build). Reproductible (empreintes dans `outils/icones/fabrication.json`).
- Le même script fabrique `img/no-way-studio.png` (600 × 457), le logo du studio en PNG pour les données structurées.

### C — Référencement (`Docs/ref/referencement.md`)
- **Une seule page indexable** : https://zsurvival-game.com/, avec `index, follow, max-image-preview:large` et aucun `noindex`.
- **Canonique fixe** `https://zsurvival-game.com/`, écrit dans le HTML, qu'aucun script ne change : `?lang=fr`, `?lang=en`, `#news`,
  `#actu/…` ne sont jamais des pages à part. **Pas de hreflang**.
- **Titre** « Z-Survival — jeu de survie zombies sur navigateur » et **description** en français (≈ 170 caractères), identiques à `meta.*`
  de `js/textes.js` ; la version anglaise y est aussi soignée (posée par `js/i18n.js` pour les visiteurs anglophones).
- **`robots.txt`** : tout autorisé (page, css, js, img, fonts, musique, sons, contenus), interdit `admin/`, `scene/`, `musique/planche.html`,
  `outils/`, `main.html`, `serveur/`, `Docs/` ; indique le sitemap.
- **`sitemap.xml`** : uniquement https://zsurvival-game.com/.
- **`noindex`** sur toutes les pages de travail (déjà là : admin, scene ×3, planche de musique ; `main.html` passe de `noindex` à
  `noindex, follow`).
- **JSON-LD** : `VideoGame` (Z-Survival, survie, navigateur web, `creativeWorkStatus` « À venir », image, auteur et éditeur le studio),
  `Organization` (No Way Studio, logo PNG, lien Discord), `WebSite`. **Ni note, ni avis, ni prix, ni date de sortie.**
- `robots.txt`, `sitemap.xml`, `favicon.ico` et `site.webmanifest` sont ajoutés à la commande de `pages.yml`.

### D — Téléphone en paysage et en-tête
- **Paysage** (hauteur ≤ 540 px) : avant, le Z touchait « Bientôt disponible » (à 740 × 360, il le recouvrait). Maintenant, la taille du titre
  suit la hauteur de l'écran (`min(14vw, 6,5rem, (hauteur − 250 px) / 1,45)`, au moins 2,25rem) et l'accroche, le bouton et la flèche sont
  un peu resserrés (écart 0,75rem au lieu de 1,25rem). Le Z est à **16 ou 17 px sous la rangée du haut** aux trois tailles. Aucun changement
  en portrait ni sur ordinateur (taille du titre vérifiée : 52,5 px à 375, 44,8 px à 320, 104 px à 1440).
- **Zones de clic de 44 × 44 px** (son, Discord, globe, logo de l'en-tête ; en-tête et coin de l'accueil) :
  - le globe n'avait aucune zone agrandie (dessiné à 34, 38 ou 40 px) : il a maintenant le même carré invisible que le son et Discord ;
  - ces carrés étaient ronds : un rond de 44 px ne couvre pas les coins du carré de 44 × 44 (le navigateur respecte l'arrondi au clic) ;
    ils sont désormais carrés, invisibles ;
  - les écarts entre boutons sont élargis là où les zones se recouvraient : 7 px entre boutons de 38 px (jusqu'à 599 px), 11 px entre
    boutons de 34 px (340 px et moins), 5 px dans le coin de l'accueil à 340 px et moins. Pour faire la place à 320 px : marges de l'en-tête
    12 px, logo un peu plus petit (1,1rem) ;
  - le logo Z-Survival de l'en-tête (lien vers l'accueil) a une zone de clic de 44 px de haut ;
  - l'apparence des boutons ne change pas.

### F — À propos : le jeu, puis le studio (demande du propriétaire pendant le lot)
- La section a maintenant **deux blocs de même forme** (image, titre, texte), **le jeu au-dessus du studio** :
  - **le jeu** : affiche de l'accueil (cadrage B) dans un cadre rouge, titre « Le jeu » / « The game », texte « Z-Survival est un jeu de survie
    zombies en vue de dessus, jouable directement dans le navigateur, sur téléphone comme sur ordinateur. Bientôt disponible. » (clés
    `about.jeu.*` de `js/textes.js`, français et anglais) ;
  - **le studio** : inchangé (logo animé rejoué à chaque arrivée, titre et texte modifiables depuis l'admin, crédits).
- Le texte par défaut du studio (affiché tant que rien n'est enregistré dans l'admin) ne répète plus la description du jeu : « No Way Studio
  crée Z-Survival. Rejoignez la communauté sur Discord pour suivre le développement du jeu. » (lien Discord).
- Ordinateur : image et logo dans une même colonne, les deux textes alignés ; le logo du studio passe de 380 à 250 px de large au plus
  pour que les deux blocs tiennent dans l'écran. Téléphone : l'un sous l'autre ; la section dépasse l'écran et défile (dernière section).
- **Retour du propriétaire (15/11/2026)** : plus d'espace entre les deux blocs (ordinateur 36 → 72 px, téléphone 32 → 48 px, paysage
  16 → 28 px) et logo du studio agrandi pour approcher la taille de la photo du jeu (ordinateur : 90 % de la colonne de l'image ;
  téléphone : 225 px au plus ; paysage : 160 px). Tout tient toujours dans l'écran à 1440 × 900 et 1024 × 768.
- **Le bloc du jeu n'est pas modifiable depuis l'admin** : le serveur n'accepte que la page « a-propos » (`serveur/src/validation.js`),
  et un lot sur le site ne touche pas `serveur/`. Pour le rendre modifiable : un petit lot serveur + admin (ajouter une page « le-jeu »).

## Vérifications

En local, sur une **copie exacte de ce que publie le workflow, servie à la racine** comme sur le domaine (`outils/copie-publiee.mjs` sert
maintenant la racine par défaut ; `--sous-dossier` garde l'ancien contrôle sous `/Z-Survival-Website/`).

**`outils/verifier-lot-4a.mjs`** (nouveau) : **79/79**.
- Partage : toutes les balises, textes identiques à `js/textes.js`, adresses absolues ; image servie en `image/jpeg`, 1200 × 630, 72 Kio.
- Icônes : favicon SVG (sans script ni ressource externe), ICO 16/32/48, Apple 180, manifeste valide et ses quatre icônes aux tailles
  annoncées ; icônes de l'admin servies.
- Référencement : `robots.txt` et `sitemap.xml` servis et corrects ; les 7 pages HTML publiées sont l'accueil et les 6 pages de travail,
  toutes en `noindex` sauf l'accueil ; canonique unique et identique pour `/`, `?lang=fr`, `?lang=en`, `#news`, `#about`, `#actu/…`,
  `?lang=en#weapons` ; pas de hreflang ; titre et description = `meta.*` ; JSON-LD valide (VideoGame, Organization, WebSite), sans note
  ni prix ni date, logo du studio servi aux dimensions annoncées.
- Paysage 667 × 375, 740 × 360, 844 × 390, français et anglais : titre sous la rangée du haut, sans toucher « Bientôt disponible », le logo
  du studio ni l'accroche.
- Zones de clic : à 16 largeurs de 320 à 1440 px, en français et en anglais, dans l'en-tête et le coin de l'accueil, le carré de 44 × 44
  centré sur chaque bouton est entièrement à lui (test du navigateur point par point) ; aucun chevauchement visible, rien hors de l'écran.
- À propos : deux blocs, le jeu au-dessus du studio, textes et image en place (375 × 667 et 1440 × 900, FR et EN).
- **Aucune erreur console, aucun fichier manquant** à 375 × 667, 320 × 568, 667 × 375, 740 × 360, 844 × 390 et 1440 × 900.

**Reste du site** (vérifications des lots précédents, relancées sur la copie servie à la racine) :
- `outils/video/verifier-accueil.mjs` (lot 2b : vidéo, tir, coup de feu, entrée VHS, encart, bouton) : **172/172**, sans retouche.
- `outils/musique/verifier-site.mjs` (lot 2a : musique, sections, langues, navigation, en-tête sans chevauchement) : **158/158**, sans retouche.
- `outils/admin/verifier-actus.mjs` (lot 3b : admin, actualités, images, page À propos modifiable) : **236/236**, sans retouche (le texte du
  studio par défaut commence toujours par « No Way Studio crée Z-Survival »).
- `outils/musique/verifier-planche.mjs` (lot 1b) : **44/44**. Il échouait (2 contrôles) parce qu'il ouvre aussi la page du site sans simuler
  le serveur des actualités, oubli qui date du lot 3b : la simulation, déjà utilisée par les autres contrôles, y est ajoutée.
- `outils/verifier-lot-4a.mjs --sous-dossier` (copie servie sous `/Z-Survival-Website/`, ancienne adresse) : **79/79** : tous les chemins
  internes restent relatifs.
- Option `--en-ligne` de ces contrôles : elle vise maintenant https://zsurvival-game.com/ (au lieu de l'ancienne adresse github.io).

## Limites
- **Aperçu des articles** : un lien `#actu/…` montre l'aperçu général du site, pas celui de l'article.
- **Langue vue par Google** : le HTML est en français, mais le robot de Google exécute le JavaScript avec un navigateur en anglais : selon
  la règle de langue du site, il peut retenir le titre et les textes anglais (soignés eux aussi). Changer cette règle sortait du lot.
- **Pas de résultat enrichi « jeu »** dans Google tant qu'il n'y a ni note ni prix (rien n'est inventé) : le test de Google peut signaler
  `offers` ou `aggregateRating` « manquants », c'est normal.
- **Favicon à 16 px** : Z seul, un peu flou à cette taille (les coulures sont retirées).
- **À propos sur téléphone** : la section est plus haute que l'écran (environ 900 px pour 667) ; on la fait défiler.
- Testé dans Chromium seulement (Playwright) ; aperçus de Discord et WhatsApp non vus par l'agent (il faut un vrai partage).
- **Tag `lot-4a`** : créé en local ; son envoi sur GitHub est refusé (HTTP 403) par l’environnement de l’agent, comme pour les lots précédents.

## À tester toi-même
1. **Aperçu de partage** : colle `https://zsurvival-game.com/` dans **Discord** et dans **WhatsApp**. Tu dois voir l'image (logo Z-Survival
   sur la scène de l'accueil), le titre « Z-Survival — survie zombies sur navigateur » et la description. Ces applications gardent parfois
   l'ancien aperçu en cache quelque temps (jusqu'à quelques jours) : si l'ancien s'affiche, réessaie plus tard, ou avec
   `https://zsurvival-game.com/?v=2` pour un premier essai (le canonique reste le même).
2. **Icônes** : l'onglet du navigateur montre le Z rouge ; sur iPhone, Safari → Partager → **Sur l'écran d'accueil** : icône Z sur fond noir ;
   sur Android, Chrome → ⋮ → **Ajouter à l'écran d'accueil**.
3. **Téléphone en paysage** : tourne le téléphone sur l'accueil : « Z-Survival » ne touche plus la rangée du haut.
4. **Boutons de l'en-tête** : sur un petit téléphone, le son, Discord et le globe se touchent facilement sans se gêner.
5. **À propos** : le bloc du jeu est au-dessus du studio. Pense à vérifier dans l'admin (**Pages du site → À propos**) que le texte du studio
   parle bien du studio : s'il reprend la description du jeu, remplace-le (le bloc du jeu la donne déjà).
6. **Google Search Console** (facultatif) : marche à suivre pas à pas dans `Docs/ref/referencement.md` (ligne TXT chez OVH, puis envoi de
   `sitemap.xml`).

## État git
- Commits `lot-4a A` à `lot-4a F` sur la branche `lot-4a`, PR vers `main` fusionnée par l'agent (règle de `CLAUDE.md`).
