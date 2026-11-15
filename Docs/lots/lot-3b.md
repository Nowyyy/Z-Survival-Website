# Lot 3b — Page admin + actualités du site (+ images des articles)

Branche `lot-3b`, depuis `main` (`c1f90e4`). Références : `Docs/ref/admin.md` (mode d'emploi de l'admin, sur téléphone),
`Docs/ref/serveur.md` (serveur, routes, secrets), `serveur/LISEZMOI.md` (installation).

## Point de départ : le serveur en ligne
- `https://z-survival-serveur-l3ab2tj6vq-ey.a.run.app/api/sante` est **injoignable depuis l'environnement de l'agent** (le proxy de la
  session refuse les adresses `run.app`). Le journal du dernier déploiement (workflow « serveur », 15/11/2026 15:08, commit `c1f90e4`)
  montre la réponse `{"ok":true,"base":"connectée","version_migrations":1,"version_serveur":"c1f90e4"}`.
- Tout le lot a donc été fait et vérifié contre le **vrai serveur lancé en local** (base SQLite en fichier, API GitHub simulée).

## Ce qui a été fait

### A — Serveur : images des articles (`serveur/src/images.js`, `serveur/src/app.js`)
- Route **`POST /api/admin/images?slug=<slug>`** (jeton obligatoire) : corps brut `image/jpeg`, `image/png` ou `image/webp`, **8 Mo au plus**.
- Contrôles : type annoncé **et** premiers octets du fichier, image lisible, 36 mégapixels au plus, slug valide.
- Transformation par **sharp** : orientation de la photo appliquée, **1600 px au plus** de côté (jamais agrandie), **WebP** qualité 82,
  **aucune métadonnée gardée** (EXIF, GPS, appareil, profil, XMP). Mémoire réduite (pas de cache, un seul fil).
- Enregistrement par l'**API GitHub** : commit sur `main` dans **`img/actus/<slug>-<8 caractères du SHA-256>.webp`**, auteur
  « Z-Survival admin ». Même image envoyée deux fois : même nom, pas de second commit. GitHub Pages republie le site (environ une minute).
- Secret **`GITHUB_JETON_IMAGES`** (Secret Manager `github-jeton-images`), facultatif : sans lui, 503 clair (« Envoi d'images pas encore
  configuré… ») et tout le reste fonctionne. Jeton refusé ou GitHub muet : 502 avec un message clair, jamais le jeton. Jeton masqué dans le journal.
- Variables non secrètes avec valeurs par défaut : `GITHUB_DEPOT`, `GITHUB_BRANCHE`, `GITHUB_API` (tests).
- Tests : `serveur/tests/images.test.js` (9 tests, API GitHub simulée).

### B — Page admin (`admin/`)
- `admin/index.html` (noindex, non reliée au site, publiée par `pages.yml`), `admin/admin.js`, `admin/admin.css`. Français seulement
  (décision du propriétaire) : ses textes sont dans ces fichiers, pas dans `js/textes.js`.
- **CSP stricte** : `default-src 'none'`, scripts et styles du site seulement (`'self'`, rien d'« unsafe »), connexions vers le serveur
  seulement, images du site ou `blob:` (aperçu), `form-action 'none'`, `base-uri 'none'`.
- **Connexion** : jeton en `sessionStorage` (try/catch), envoyé dans `Authorization: Bearer`. Déconnexion à l'expiration (minuteur et
  retour de veille du téléphone) ou sur toute réponse 401, retour propre à l'écran de connexion. Fin de validité comptée sur l'horloge
  de l'appareil (durée du jeton), donc juste même si l'heure du téléphone est décalée. **Texte non enregistré gardé** pendant une
  expiration et rouvert après la reconnexion. Même message pour identifiant et mot de passe faux ; blocage après 5 essais expliqué
  (durée en minutes, déblocage automatique).
- **Réveil du serveur** : `/api/sante` appelé dès l'ouverture ; « Connexion au serveur… » s'affiche dès qu'un appel dépasse 0,6 s.
- **Liste** : tous les articles, plus récent d'abord, statut (Publié / Brouillon), date, « FR seulement ».
- **Éditeur** : onglets Français (obligatoire) / English (facultatif) ; barre de mise en forme au pouce (boutons de 44 px : gras,
  italique, intertitre, liste, lien — l'adresse est contrôlée, http(s) seulement) ; slug calculé depuis le titre FR (accents retirés),
  modifiable, figé pour un article existant avec avertissement s'il est publié ; date de publication (vide = au moment de publier).
- **Image** : choix (JPEG/PNG/WebP, 8 Mo, contrôlés aussi par la page), aperçu, envoi, remplacement, retrait ; délai de publication
  d'une minute annoncé ; aperçu local (blob) en attendant que GitHub Pages publie l'image.
- **Aperçu** tel que sur le site (carte + article complet), FR et EN, même code que le site (`js/article.js`, `js/markdown.js`).
- **Actions** : enregistrer en brouillon, publier, enregistrer un article publié, dépublier (confirmation), supprimer (confirmation).
  Alerte avant de quitter avec des modifications (bouton retour, déconnexion, fermeture de la page).
- Modules partagés avec le site : **`js/config.js`** (adresse du serveur, seul endroit côté site), **`js/markdown.js`** (Markdown sûr),
  **`js/article.js`** (carte, article complet, repli FR), **`css/actualites.css`**.

### C — Actualités du site (`js/actualites.js`, `index.html`, `css/actualites.css`)
- La section Actualités lit `GET /api/articles?lang=…` : cartes (image, date, titre, début du texte). **Actualités fictives retirées**
  (ainsi que la mention « contenu provisoire » de la section).
- **Markdown sûr** (`js/markdown.js`) : moteur maison à liste blanche (paragraphes, intertitres, gras, italique, listes, liens), tout en
  DOM (`textContent`), aucun HTML interprété ; liens http(s) seulement, `target="_blank" rel="noopener noreferrer"` ; temps linéaire
  même sur un texte piégé.
- **Article complet** dans une fenêtre (`<dialog>`), sans quitter la page unique, à l'adresse **`#actu/<slug>`** : partageable (ouverture
  directe sur la section Actualités, sans l'entrée de l'accueil), retour et avance du navigateur, Échap, ✕ ou toucher sur le fond,
  focus dans la fenêtre puis rendu à la carte ; les flèches du clavier font défiler l'article, pas les sections.
- **Chargement** : 3 cartes squelettes (animation coupée en mouvement réduit). **Erreur** ou serveur injoignable : « Actualités
  indisponibles pour le moment », le reste du site fonctionne. **Aucun article** : « Radio silencieuse — Aucune transmission pour
  l'instant. Restez à l'abri et à l'écoute : les premières nouvelles arrivent. » **Plus de 10 articles** : bouton « Actualités plus anciennes ».
- **Langues** : les actualités suivent le globe ; sans version anglaise, l'article français s'affiche avec « (FR) » (et `lang="fr"`).
  Nouvelles clés `news.*` dans `js/textes.js`, en français et en anglais.
- **Bandeau d'alerte** (il existe, affiché avec `?bandeau=1`) : le titre du dernier article publié passe en tête (« Dernière
  transmission : … »), avec un lien qui ouvre l'article.
- Défilement par sections, navigation, musique et accueil (vidéo, tir, entrée) inchangés : seul le motif de l'entrée de l'accueil
  reconnaît aussi `#actu/…` (pas d'entrée quand on arrive sur un article).

### D — Installation et documentation
- `serveur/deploiement/installer-gcp.sh` : question **6d** du jeton GitHub (saisie masquée, contrôle auprès de GitHub sans que le jeton
  passe en argument, rangé dans Secret Manager, accès du compte `serveur-site`, ajouté au service) sans toucher aux secrets déjà saisis ;
  option **`--jeton-github`** pour ne mettre à jour **que** ce secret. Relançable : jeton gardé → pas de révision inutile.
- `.github/workflows/serveur.yml` : `--update-secrets` / `--update-env-vars` (au lieu de `--set-…`) pour qu'un redéploiement garde
  le jeton GitHub ajouté par le script ; déploiement inchangé tant qu'il n'existe pas.
- `pages.yml` publie `admin/`.
- `Docs/ref/admin.md` (nouveau, mode d'emploi téléphone), `Docs/ref/serveur.md`, `serveur/LISEZMOI.md`, `Docs/ref/contenus.md`, `CLAUDE.md`.

## Vérifications (dans la session, avant la fusion)
- **Serveur** : `npm test` → **40/40** (31 du lot 3a + 9 images) : JPEG de téléphone 3000 × 2000 avec EXIF et GPS → 1600 × 1067 WebP,
  commit simulé à `img/actus/nouvelle-carte-<empreinte>.webp` sur `main`, auteur « Z-Survival admin », **aucun EXIF/XMP/profil**, marques
  GPS et appareil absentes des octets ; même image deux fois → pas de second commit ; PNG et WebP ; trop lourde → 413 ; GIF, texte,
  PNG annoncé JPEG, JPEG tronqué → 415 ; sans jeton → 401 ; slug invalide → 400 ; GitHub refuse ou en panne → 502 sans le jeton ;
  sans secret GitHub → 503 et le reste fonctionne.
- **Conteneur** (image du `Dockerfile`, 256 Mio comme Cloud Run, `NODE_ENV=production`, API GitHub simulée) : photo 4032 × 3024 de
  5,4 Mo traitée en 315 ms, PNG de 25 mégapixels accepté, **134 Mio** de mémoire, EXIF supprimé, utilisateur `node`, aucun secret au
  journal. Docker Hub refusant les téléchargements (429), la construction de test a pris la même image `node:24-slim` sur
  `mirror.gcr.io` et ajouté le certificat du proxy de la session (copie de travail ; `serveur/Dockerfile` du dépôt inchangé).
- **Bout en bout** : `node outils/admin/verifier-actus.mjs` → **195/195**. Vrai serveur en local (SQLite en fichier, secrets tirés au
  hasard), API GitHub simulée qui écrit l'image dans la copie publiée, **copie exacte de ce que publie `pages.yml`** servie sous
  `/Z-Survival-Website/`, appels du navigateur vers `…run.app` redirigés vers le serveur local :
  - règles fixes : adresse de `js/config.js` = `connect-src` de la CSP ; une seule adresse côté site ; admin en noindex, non reliée ;
  - admin (375 × 667) : réveil, échecs (même message), connexion, jeton en `sessionStorage`, création, slug, barre de mise en forme,
    brouillon invisible, image (refus de type et de taille par la page, aperçu, envoi, commit simulé, WebP sans métadonnées),
    confirmation avant de quitter, aperçu FR / EN (« (FR) » sans anglais), publier, modifier, dépublier, republier, liste avec statuts,
    supprimer (refus puis accord), réponse 401, alerte du navigateur en quittant, **expiration du jeton à 2 h (horloge simulée) avec
    texte gardé puis rouvert**, blocage après 5 essais ; mise en page sans débordement à 320 × 568, 1440 × 900 et en mouvement réduit ;
  - site à **375 × 667, 320 × 568 et 1440 × 900, avec et sans mouvement réduit** : liste vide (FR et EN), squelettes, seuls les publiés
    dans l'ordre, image, motif de repli, article complet et adresse `#actu/…`, focus, Échap, retour / avance, article piégé (script,
    `onerror`, `javascript:`, `data:`, `onmouseover`) **sans rien exécuter**, changement de langue, « (FR) », ouverture directe d'une
    adresse d'article, article inconnu, serveur injoignable (message sobre, navigation qui marche), bandeau `?bandeau=1` ;
  - aucune erreur console hors erreurs HTTP voulues (401, 429, 404, connexion coupée exprès), aucun fichier manquant ; aucun secret
    dans le journal du serveur.
- **Reste du site inchangé** : `outils/video/verifier-accueil.mjs` → **172/172** et `outils/musique/verifier-site.mjs` → **158/158**
  (mêmes résultats qu'avant). Seule adaptation : en local, le serveur des actualités est simulé (aucun article) par
  `simulerActualites()` de `outils/copie-publiee.mjs`.
- **Script d'installation** : `bash -n` ; `shellcheck` sans avertissement (une seule information, déjà présente au lot 3a : le code
  Python entre apostrophes) ; joué dans un vrai pseudo-terminal contre un **faux `gcloud`** et un **faux `curl`** : `--jeton-github`
  (saisie refusée puis acceptée, rangé, accès, nouvelle révision, rien d'autre touché) ; passage complet qui garde tout et remet le
  jeton à plus tard (aucun secret réécrit, aucune révision) ; passage complet avec le jeton ; relance qui le garde (sans révision si le
  service l'a déjà) ; remplacement. **Le jeton n'apparaît jamais** à l'écran, dans les arguments ni dans les journaux.
- **Workflows** : `actionlint` sans erreur.
- **Secrets** : recherche par motifs (jetons GitHub, JWT, Turso, empreintes, clés Google, clés privées) et `detect-secrets` sur tout
  le dépôt : rien (seulement des exemples fictifs déjà connus, et un faux positif : le *nom* `GITHUB_JETON_IMAGES=${S_GITHUB}`).
- Aucun chemin qui commence par « / ».

### En ligne, après la fusion (PR #45, commit `53a6903`)
- Workflow **« serveur »** : tests, image, déploiement sur Cloud Run réussis ; `/api/sante` vu par le workflow :
  `{"ok":true,"base":"connectée","version_migrations":1,"version_serveur":"53a6903"}`.
- Workflow **« Déploiement GitHub Pages »** réussi : `admin/`, `js/config.js`, `js/actualites.js`, `js/markdown.js`, `css/actualites.css`
  servis (200) ; `/admin/` s'ouvre sur l'écran de connexion (`noindex, nofollow`), sans erreur.
- Accueil inchangé : bonne vidéo selon l'écran (9:16 au téléphone, 16:9 à l'ordinateur). `verifier-accueil.mjs --en-ligne` :
  148 réussies, et `verifier-site.mjs --en-ligne` : 149 réussies ; **les 25 échecs viennent tous des appels vers `…run.app`, refusés par
  le proxy de l'environnement de l'agent** (`ERR_TUNNEL_CONNECTION_FAILED`), comptés comme erreur console ou fichier manquant.
- Section Actualités en ligne, vue depuis cet environnement : message sobre « Actualités indisponibles pour le moment » (le serveur y est
  injoignable), reste du site normal. Depuis un vrai navigateur, elle doit afficher « Radio silencieuse » tant qu'aucun article n'est
  publié : à confirmer à l'étape 4 ci-dessous.

## Limites
- **Rien n'a été essayé sur le vrai GitHub ni sur Google Cloud** depuis la session (le jeton ne passe jamais par l'agent) : la route est
  vérifiée contre une API GitHub simulée, le script contre un faux `gcloud`. Le premier vrai envoi d'image confirmera.
- ~~Supprimer un article ne supprime pas son image~~ : corrigé après le retour du propriétaire (voir en fin de bilan). Retirer ou
  remplacer l'image d'un article garde le fichier (réutilisable, supprimable depuis la bibliothèque).
- **Une image n'est en ligne qu'environ une minute après l'envoi** (GitHub Pages republie) ; en attendant, le site montre le grand Z.
- **Chaque image = un commit sur `main`** (et un déploiement Pages) : faire `git pull` avant de travailler sur le site ; une branche de
  lot en cours devra être rebasée.
- Le jeton GitHub « fine-grained » ne peut pas être limité à un dossier : il peut écrire tout le contenu du dépôt. Il ne vit que dans
  Secret Manager et dans le serveur. **Il expire au bout d'un an.**
- **CSP de l'admin** : une règle de sécurité ne peut pas lire `js/config.js`. Pour le futur nom de domaine, changer `js/config.js`
  **et** la directive `connect-src` d'`admin/index.html` ; `verifier-actus.mjs` échoue tant qu'elles diffèrent.
- Le jeton de connexion vit en `sessionStorage` : un script injecté pourrait le lire (la CSP stricte rend cela très difficile ; cookie
  `HttpOnly` possible plus tard avec un domaine commun).
- La liste publique est en cache 60 s : une publication ou une dépublication met jusqu'à une minute à se voir.
- Pas de publication programmée (une date future est visible tout de suite), comme au lot 3a.
- Le bandeau d'alerte reste affiché seulement avec `?bandeau=1` (il n'est pas encore mis en service).
- Testé dans Chromium seulement (Playwright). `<dialog>` demande Safari 15.4 ou plus. Les photos HEIC d'iPhone sont converties en
  JPEG par le téléphone (le champ n'accepte que JPEG, PNG, WebP).
- Tag `lot-3b` : créé en local ; son envoi est refusé par l'environnement (403), comme aux lots précédents.

## Vos étapes après la fusion
La fusion déploie seule le site (workflow « Déploiement GitHub Pages ») et le serveur (workflow « serveur », car `serveur/` a changé).

1. **Créer le jeton GitHub** :
   1. github.com → votre photo (en haut à droite) → **Settings** ;
   2. tout en bas du menu de gauche : **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token** ;
   3. **Token name** : `Z-Survival images` ; **Expiration** : **Custom** → la même date dans **un an** ;
   4. **Repository access** : **Only select repositories** → choisir **Nowyyy/Z-Survival-Website** (et lui seul) ;
   5. **Permissions** → **Repository permissions** → **Contents** : **Read and write** (ne rien cocher d'autre) ;
   6. **Generate token**, puis **copier** le jeton (`github_pat_…`) : GitHub ne l'affiche qu'une fois.
2. **Le ranger avec le script dans Cloud Shell** : console Google Cloud (projet **z-survival-website**) → icône **>_** → coller cette
   ligne, Entrée, puis coller le jeton à la question (rien ne s'affiche : normal), Entrée :
   ```bash
   bash <(curl -fsSL https://raw.githubusercontent.com/Nowyyy/Z-Survival-Website/main/serveur/deploiement/installer-gcp.sh) --jeton-github
   ```
   Le script doit afficher « Jeton accepté par GitHub », « Secret « github-jeton-images » rangé » et « Jeton GitHub donné au serveur ».
3. **Relancer le workflow « serveur »** : github.com/Nowyyy/Z-Survival-Website → onglet **Actions** → **serveur** (à gauche) →
   **Run workflow** → branche **main** → **Run workflow** ; attendre la coche verte (3 à 5 minutes).
4. **Premier article** : sur le téléphone, ouvrir **https://nowyyy.github.io/Z-Survival-Website/admin/** → se connecter →
   **Nouvel article** → titre et texte en français (et en anglais si vous voulez) → **Choisir une image** → **Envoyer l'image** →
   **Aperçu** (FR puis EN) → **Fermer** → **Publier**. Puis ouvrir **https://nowyyy.github.io/Z-Survival-Website/#news** : l'article est
   là (l'image arrive environ une minute après l'envoi ; recharger la page).
5. **Agenda** : noter dans 11 mois « Renouveler le jeton GitHub des images Z-Survival » (refaire les étapes 1 et 2 ; mode d'emploi :
   `Docs/ref/admin.md`, « Jeton GitHub »).

## État git
- Commits `lot-3b A` à `lot-3b E` sur la branche `lot-3b` ; PR vers `main` fusionnée par l'agent (règle de `CLAUDE.md`).

## Retour du propriétaire (15/11/2026, branche `lot-3b-images`)
Demande : « En cas de suppression d'un article, il faudrait que l'image soit supprimée. Il faudrait pouvoir aussi réutiliser une
image déjà utilisée pour éviter de la republier. »

1. **Suppression de l'image avec l'article** : `DELETE /api/admin/articles/:id` supprime aussi l'image du dépôt (API GitHub,
   commit « Z-Survival admin » sur `main`), **sauf si un autre article l'utilise**. L'article est supprimé d'abord ; si GitHub ne
   répond pas (ou sans jeton), l'image reste et la réponse le dit (`image.raison`). La confirmation et le message de l'admin le disent.
2. **Bibliothèque des images** dans l'admin (« Réutiliser une image ») : les images de `img/actus/` (lues dans le dépôt,
   `GET /api/admin/images`) avec les articles qui les utilisent ; **Utiliser** reprend l'image telle quelle, **rien n'est republié**.
   Plusieurs articles peuvent partager une image.
3. **Pas de doublon à l'envoi** : une photo identique (même empreinte) déjà dans `img/actus/`, même envoyée pour un autre article,
   est reprise au lieu d'être recommitée.
4. **Images inutilisées** (retirées ou remplacées) : marquées « Inutilisée » dans la bibliothèque, avec **Supprimer**
   (`DELETE /api/admin/images/:nom`, refusé si un article l'utilise).

Vérifications :
- `npm test` → **47/47** (7 nouveaux : réutilisation sans commit, bibliothèque et usages, image gardée si partagée, image supprimée
  avec le dernier article qui l'utilise, panne de GitHub pendant la suppression, suppression d'une image inutilisée et refus si
  utilisée ou nom invalide, sans jeton GitHub).
- `outils/admin/verifier-actus.mjs` → **207/207** (12 nouveaux contrôles de bout en bout dans l'admin : bibliothèque, réutilisation
  sans commit, photo renvoyée reprise, image gardée car partagée, image inutilisée supprimée, image supprimée avec l'article).
- Le site lui-même n'a pas changé (seuls `admin/`, `serveur/`, `outils/admin/` et la documentation).
- Rien à refaire de votre côté : le jeton GitHub déjà rangé (permission *Contents* en lecture et écriture) suffit pour supprimer.

## Retour du propriétaire (15/11/2026, branche `admin-a-propos`)
Demande : « Sur la page admin : une option pour changer le texte de la page À propos (le titre, le texte sont modifiables) ; retirer
l'encart jaune « contenu provisoire ». »

1. **Serveur** : table `pages` (nouvelle migration `002_pages.sql`, appliquée au démarrage) ; `GET /api/pages/a-propos?lang=` (public,
   `{ page: null }` tant que rien n'est enregistré, cache 60 s) ; `GET` et `PUT /api/admin/pages/a-propos` (jeton, titre et texte
   français obligatoires, anglais facultatif).
2. **Admin** : « Pages du site → Modifier la page « À propos » » sous la liste des articles : titre et texte FR / EN partant des
   textes actuels du site, barre de mise en forme, aperçu FR / EN, « Enregistrer et publier », confirmation avant de quitter avec des
   modifications, texte gardé si la session expire.
3. **Site** (`js/a-propos.js`) : le titre de la section et le texte (Markdown sûr) viennent du serveur ; textes de `js/textes.js` par
   défaut ou si le serveur ne répond pas ; repli « (FR) » sur le site anglais sans version anglaise ; l'entrée « 05 À propos » du menu
   garde son intitulé fixe. **Encart jaune « contenu provisoire » retiré** (clé `about.intro` supprimée).

Vérifications :
- `npm test` → **52/52** (5 nouveaux : page vide, jeton obligatoire, contrôle des entrées, repli français, FR + EN et remplacement).
- `outils/video/verifier-accueil.mjs` → **172/172** et `outils/musique/verifier-site.mjs` → **158/158** (reste du site inchangé).
- `outils/admin/verifier-actus.mjs` → **234/234** (27 nouveaux contrôles : textes par défaut et plus d'encart, admin pré-rempli,
  mise en forme, confirmation, aperçu FR / EN, enregistrement, site à 375 × 667, 320 × 568 en mouvement réduit et 1440 × 900, Markdown
  sûr, menu inchangé, repli « (FR) », changement de langue, serveur injoignable).

### Correction (même jour) : le « titre » est la ligne sous le logo
Précision du propriétaire : le titre à modifier n'est pas « À propos » mais « Un jeu de No Way Studio ».
- Le titre enregistré dans l'admin remplace maintenant la **ligne en rouge sous le logo du studio** (`#about-signature`, par défaut
  `studio.signature`) ; le grand titre « À propos » / « About us » redevient fixe. Aucun changement du serveur (champs `titre_fr` / `titre_en`).
- L'admin part de « Un jeu de No Way Studio » / « A No Way Studio game » ; l'aperçu montre le grand titre fixe et la ligne modifiée.
- Un enregistrement éventuel fait avant la correction avec le titre « À propos » / « About us » est ignoré pour la ligne sous le logo
  (signature par défaut affichée, et proposée dans l'admin) ; l'admin refuse ce titre.
- Vérifications : `verifier-actus.mjs` → **236/236** ; `verifier-site.mjs` → 158/158 ; `verifier-accueil.mjs` → 172/172 ; `npm test` inchangé (52/52).

### Retour (même jour) : « Pages du site » au-dessus des articles
Sur l'écran d'accueil de l'admin, le cadre **Pages du site** (« Modifier la page « À propos » ») passe **en haut**, au-dessus de la
liste des articles, pour rester à portée quand il y a beaucoup d'articles. Rien d'autre ne change. Vérification : `verifier-actus.mjs` → 236/236.
