# Serveur du site (lot 3a, images : lot 3b) — Cloud Run + Turso

Le serveur permet de **saisir les actualités depuis la page d'administration** (`admin/`, lot 3b, mode d'emploi :
[`Docs/ref/admin.md`](admin.md)) et de les **afficher sur le site** (section Actualités, `js/actualites.js`).
Adresse du serveur côté site : **`js/config.js`** (seul endroit), aujourd'hui `https://z-survival-serveur-l3ab2tj6vq-ey.a.run.app`.
Il vit dans `serveur/` et se déploie **séparément** du site : le site reste sur GitHub Pages (`pages.yml`), le serveur part sur
Google Cloud Run (`serveur.yml`). Le serveur n'est jamais publié sur GitHub Pages.

Mode d'emploi pas à pas (installation, lancement en local, tests) : `serveur/LISEZMOI.md`.

## Architecture

```
 Navigateur du visiteur / de l'admin
        │  1. pages du site (HTML, CSS, JS)               2. données (JSON, en-tête Authorization pour l'admin)
        ▼                                                 ▼
 GitHub Pages                                      Google Cloud Run (europe-west3, Francfort)
 https://zsurvival-game.com/                       service « z-survival-serveur » (…run.app)
 (pages.yml, à chaque push sur main)               Node.js 24 + Hono, image dans Artifact Registry (europe-west3)
                                                          │  secrets lus au démarrage (Secret Manager → variables d'environnement)
                                                          ├──────────────► Turso (libSQL), base « z-survival-site », Francfort
                                                          │
                                                          └──────────────► API GitHub (images des articles, lot 3b) :
                                                                           commit sur main dans img/actus/ → pages.yml republie
```

- **Site** (`zsurvival-game.com`, servi par GitHub Pages ; `Docs/ref/nom-de-domaine.md`) et **serveur** (run.app) n'ont pas le
  même domaine : le site appelle le serveur par `fetch` (CORS).
- Le serveur **s'endort** quand personne ne l'appelle (0 instance) : le premier appel après un moment prend 1 à 3 secondes.
- Rien n'est gardé en mémoire d'une visite à l'autre : tout ce qui doit durer (articles, compteur de tentatives) est dans Turso.

## Fichiers

| Chemin | Rôle |
|---|---|
| `serveur/src/index.js` | démarrage : configuration, base, migrations, écoute sur `PORT` (8080) |
| `serveur/src/app.js` | routes, CORS, en-têtes de sécurité, erreurs |
| `serveur/src/config.js` | lecture des variables d'environnement (noms seulement) |
| `serveur/src/base.js` | client `@libsql/client`, migrations |
| `serveur/src/mot-de-passe.js` | empreinte PBKDF2 et vérification |
| `serveur/src/jeton.js` | jeton de connexion signé |
| `serveur/src/limite.js` | limite des tentatives de connexion |
| `serveur/src/validation.js` | contrôle des entrées |
| `serveur/src/journal.js` | journal JSON, valeurs secrètes masquées |
| `serveur/src/images.js` | images des articles : contrôle, redimensionnement, WebP sans métadonnées, commit par l'API GitHub (lot 3b) |
| `serveur/migrations/NNN_nom.sql` | migrations versionnées |
| `serveur/tests/` | tests (`npm test`, base SQLite en fichier temporaire) |
| `serveur/Dockerfile` | image du serveur |
| `serveur/deploiement/installer-gcp.sh` | installation Google Cloud, à lancer dans Cloud Shell |
| `.github/workflows/serveur.yml` | tests, construction de l'image et déploiement à chaque push sur `main` qui touche `serveur/` |

## Routes

Toutes les réponses sont en JSON. Erreurs : `{ "erreur": "message en français" }`.

### Publiques (mises en cache 60 s : `Cache-Control: public, max-age=60`)

| Route | Réponse |
|---|---|
| `GET /api/sante` | `{ ok, base: "connectée" \| "non connectée", version_migrations, version_serveur }` — 200, ou 503 si la base ne répond pas. Jamais en cache. |
| `GET /api/articles?lang=fr\|en&page=N` | articles **publiés** seulement, du plus récent au plus ancien, 10 par page : `{ lang, page, par_page, total, pages, articles: [{ slug, date_publication, langue, titre, contenu, image }] }` |
| `GET /api/articles/:slug?lang=fr\|en` | un article **publié** : `{ article: { … } }`, 404 sinon (brouillon ou inconnu) |

- `lang` vaut `fr` par défaut. Si l'anglais manque, le français est renvoyé et `langue` vaut `fr`.
- `contenu` est du **Markdown brut** : le site l'affiche par `js/markdown.js` (liste blanche : intertitres, gras, italique, listes,
  liens http(s) avec `rel="noopener noreferrer"`, paragraphes ; aucun HTML interprété).
- Le public ne voit ni `id`, ni `statut`, ni les dates internes.

| Route publique | Réponse |
|---|---|
| `GET /api/pages/a-propos?lang=fr\|en`, `GET /api/pages/a-propos-jeu?lang=fr\|en` | textes de la section « À propos » : bloc du studio (`titre` = ligne sous le logo du studio, `contenu` = texte) et bloc du jeu (lot 3e, `titre` et `contenu` à côté de l'image du jeu) : `{ page: { cle, langue, titre, contenu, modifie_le } }`, ou **`{ page: null }`** tant que rien n'est enregistré (le site garde alors ses textes par défaut, `js/textes.js`) ; même règle de langue que les articles ; en cache 60 s ; 404 pour une autre clé |

### Administration (jeton obligatoire, jamais en cache)

Pages du site (clés : `a-propos`, bloc du studio ; `a-propos-jeu`, bloc du jeu, lot 3e ; mêmes routes, même format) : `GET /api/admin/pages/a-propos` → `{ page: null | { cle, titre_fr, titre_en,
contenu_fr, contenu_en, modifie_le } }` ; `PUT /api/admin/pages/a-propos` avec `{ titre_fr, contenu_fr, titre_en?, contenu_en? }`
(titre et texte français obligatoires, titres 120 caractères, textes 20 000, aucun autre champ) → crée ou remplace, `{ page }`.

| Route | Rôle |
|---|---|
| `POST /api/admin/connexion` | corps `{ identifiant, mot_de_passe }` → `{ jeton, expire_le }` ; 401 si refusé, 429 si trop de tentatives |
| `GET /api/admin/articles?page=N` | tous les articles, brouillons compris (50 par page) |
| `GET /api/admin/articles/:id` | un article (tous les champs) |
| `POST /api/admin/articles` | crée un article (`slug` et `titre_fr` obligatoires ; brouillon par défaut) → 201 |
| `PUT /api/admin/articles/:id` | modifie les champs fournis (les autres restent) |
| `DELETE /api/admin/articles/:id` | supprime l'article **et son image** (si aucun autre article ne l'utilise) → `{ supprime, id, image: null \| { chemin, supprimee, raison? } }` ; `raison` : `utilisee_ailleurs`, `non_configure` ou `erreur_github` (l'article est supprimé quand même) |
| `POST /api/admin/articles/:id/publier` | publie (date de publication = maintenant si elle est vide) |
| `POST /api/admin/articles/:id/depublier` | repasse en brouillon |
| `POST /api/admin/images?slug=<slug>` | image d'un article (lot 3b) : corps **brut** (`Content-Type: image/jpeg`, `image/png` ou `image/webp`), 8 Mo au plus → 201 `{ image, adresse, largeur, hauteur, octets, deja_presente, commit }` (200 si l'image était déjà dans le dépôt) |
| `GET /api/admin/images` | bibliothèque : images de `img/actus/` (lues dans le dépôt) avec les articles qui les utilisent → `{ source: "depot" \| "articles", images: [{ image, octets, utilisee_par: [{ id, titre_fr, statut }] }] }` ; sans jeton GitHub, `source: "articles"` (images connues des articles) |
| `DELETE /api/admin/images/:nom` | supprime une image **inutilisée** du dépôt (commit sur `main`) ; 409 si un article l'utilise, 404 si le nom est invalide, 503 sans jeton GitHub |
| `GET /api/admin/bandeau` | bandeau d'alerte (lot 3d) : messages de `contenus/bandeau.json`, lus dans le dépôt → `{ messages: [{ id, actif, fr, en }], sha }` (`sha` : empreinte du fichier lu, `null` s'il n'existe pas) ; 503 sans jeton GitHub |
| `GET /api/admin/partage` | aperçu de partage (lot 3f) : titre et description des balises Open Graph d'`index.html`, lus dans le dépôt → `{ titre, description, sha }` ; 503 sans jeton GitHub |
| `PUT /api/admin/partage` | réécrit dans `index.html` (commit « Z-Survival admin » sur `main`) la valeur `content` de quatre balises seulement (`og:title`, `twitter:title`, `og:description`, `twitter:description`) avec `{ titre, description, sha }` → `{ titre, description, sha }`. Titre 90 caractères au plus, description 300, texte brut sur une ligne, échappé pour le HTML. **409** si `index.html` a changé depuis la lecture (rien n'est écrasé) ; 502 si une balise manque (rien n'est écrit) ; 503 sans jeton GitHub |
| `PUT /api/admin/bandeau` | réécrit `contenus/bandeau.json` (commit « Z-Survival admin » sur `main`) avec `{ messages, sha }` → `{ messages, sha }` (nouvelle empreinte). 30 messages au plus ; `fr` obligatoire, `fr` et `en` 160 caractères au plus, texte brut sur une ligne (caractères de contrôle retirés) ; `actif` booléen ; `id` refait à partir du français s'il manque, est mal formé ou en double. **409** si le fichier a changé depuis la lecture (autre onglet, modification sur GitHub) : rien n'est écrasé. 503 sans jeton GitHub |
| `GET /api/admin/armes` | armes de la section Armes (lot 6a) : `contenus/armes.json` lu dans le dépôt → `{ armes: [{ id, nom, nomEn, categorie, famille, ordre, chapitres, prochainement, description: { fr, en }, stats, statsVisibles }], chapitres: [{ id, nom: { fr, en } | null, armes }], sha }` (menu des chapitres de l'admin) ; 404 si le fichier manque, 502 s'il est illisible, 503 sans jeton GitHub |
| `PUT /api/admin/armes` | avec `{ armes: [{ id, prochainement, description: { fr, en }, stats, statsVisibles }], sha }` (seulement les armes changées) : réécrit dans `contenus/armes.json` ces quatre réglages (commit « Z-Survival admin » sur `main`), le reste du fichier est gardé (même mise en forme que `outils/armes/copier-armes.mjs`) → `{ armes, chapitres, sha }`. Descriptions : texte brut sur une ligne, 400 caractères au plus ; `stats` : `null` ou `{ degats, cadence, portee, chargeur }` entiers de 0 à 100 (ou `null`) ; `statsVisibles: true` exige au moins une valeur ; description changée → `aRelire: false`. Arme inconnue : 400. **409** si le fichier a changé depuis la lecture. 503 sans jeton GitHub |

- Champs acceptés : `slug`, `statut`, `date_publication`, `titre_fr`, `titre_en`, `contenu_fr`, `contenu_en`, `image`. Un champ inconnu est refusé (400).
- `slug` : minuscules, chiffres et tirets (`nouvelle-carte`), 120 caractères au plus, unique (409 sinon).
- Longueurs maximales : titres 200 caractères, contenus 40 000, image 300 (chemin relatif simple, ou vide).
- `date_publication` : date ISO 8601 (`2026-11-15T14:00:00Z`) ou `null`. Publier exige `titre_fr` et `contenu_fr`.
- Taille du corps : 4 Kio pour la connexion, 256 Kio pour un article (413 au-delà). Corps JSON obligatoire (415 sinon).
- Sans jeton, ou jeton faux ou expiré : 401 `Connexion requise.` Secrets d'administration absents : 503.

### Images des articles (lot 3b)

1. **Contrôle** : type annoncé **et** premiers octets du fichier (JPEG, PNG ou WebP ; sinon 415), 8 Mo au plus (413),
   36 mégapixels au plus (413), image lisible (415). `slug` valide obligatoire (400) : il donne son nom au fichier.
2. **Transformation** (sharp) : tournée selon l'orientation de la photo, réduite à **1600 px** au plus de côté (jamais agrandie),
   convertie en **WebP** (qualité 82). **Aucune métadonnée gardée** : EXIF, position GPS, modèle de l'appareil, profil, XMP.
3. **Enregistrement** dans le dépôt par l'API GitHub (`PUT /repos/Nowyyy/Z-Survival-Website/contents/…`) : un commit sur `main`,
   auteur « Z-Survival admin », fichier **`img/actus/<slug>-<8 premiers caractères du SHA-256>.webp`**. Si une image identique (même
   empreinte) est déjà dans `img/actus/`, même sous le nom d'un autre article, ce fichier est repris : pas de second commit
   (200, `deja_presente: true`, `image` = chemin existant).
4. **Publication** : le commit sur `main` relance `pages.yml` ; l'image est en ligne **environ une minute plus tard** (l'admin
   l'indique ; en attendant, le site montre son motif de repli). `serveur.yml` n'est pas relancé (le commit ne touche pas `serveur/`).
6. **Réutilisation** : la bibliothèque de l'admin (`GET /api/admin/images`) permet de reprendre une image déjà en ligne pour un
   autre article ; plusieurs articles peuvent partager une image.
7. **Suppression** : supprimer un article supprime son image du dépôt (`DELETE` de l'API GitHub, commit « Z-Survival admin » sur
   `main`) **si plus aucun article ne l'utilise** ; une image inutilisée (retirée ou remplacée) se supprime depuis la bibliothèque
   (`DELETE /api/admin/images/:nom`). Seuls des noms simples de `img/actus/` sont acceptés.
5. Le champ `image` de l'article reçoit le chemin relatif (`img/actus/…`), affiché par le site tel quel (chemin relatif).

- **Sans le secret `GITHUB_JETON_IMAGES`** : 503 « Envoi d'images pas encore configuré… », tout le reste fonctionne.
- GitHub refuse (jeton expiré, sans droit) ou ne répond pas : 502 avec un message clair, **jamais** le jeton ni la réponse de GitHub.
- Les **tests** utilisent une API GitHub **simulée** (`fetchGithub` remplaçable dans `creerApp`, ou `GITHUB_API` pour le banc local).

### Annonce Discord des actualités (lot 3c, `src/discord.js`)
- **Quand** : un article devient public (`POST /api/admin/articles/:id/publier`, création avec `statut: "publie"`, ou `PUT` qui passe le
  statut à `publie`) **et** n'a jamais été annoncé (colonne `annonce_discord_le` nulle, migration 003). Jamais pour une modification,
  ni pour une republication après dépublication.
- **Message** (webhook `DISCORD_WEBHOOK_ACTUS`, `POST …?wait=true`) : ligne « 📰 **Nouvelle actualité · New post** » (sans lien : Discord
  ajouterait un second aperçu, celui du site), carte (*embed*) rouge `#d81414` dont le titre est **« 🇫🇷 titre français — 🇬🇧 titre
  anglais »** (seulement « 🇫🇷 titre français » sans version anglaise ; 256 caractères au plus), en corps **« 🇫🇷 début du texte
  français » puis « 🇬🇧 début du texte anglais »** (200 caractères chacun ; sans version anglaise : le français seul, 280 caractères, sans
  drapeau ; Markdown retiré, un point après un titre ou un élément de liste), l'image, le lien `https://zsurvival-game.com/#actu/<slug>`
  (titre cliquable), la date ; pied « Z-Survival — Actualités · News » ; nom « Z-Survival », icône du site. `allowed_mentions: { parse: [] }` :
  aucune mention ne notifie.
- **Image** : son adresse publique si elle répond déjà (`HEAD`) ; sinon (image envoyée à l'instant, pas encore republiée par GitHub
  Pages), le fichier lu dans le dépôt par l'API GitHub (`Accept: application/vnd.github.raw`) et **joint** au message
  (`attachment://…`) ; sinon pas d'image.
- **Réponse** des routes qui publient : champ en plus `annonce_discord: { envoyee: true }` ou `{ envoyee: false, raison }`
  (`non_configure`, `webhook_invalide`, `erreur_discord`), seulement quand l'article devenait public sans avoir été annoncé. La date
  d'annonce n'est notée qu'en cas de succès : un échec est réessayé à la publication suivante.
- **Un échec de Discord n'empêche jamais la publication** (délai de 8 s au plus pendant la requête de publication ; Cloud Run ne
  facturant le processeur que pendant les requêtes, l'envoi ne peut pas être fait après la réponse).
- **Secret** : l'adresse entière et sa dernière partie (le jeton) sont masquées dans le journal ; jamais dans une réponse ni une erreur.
  Une adresse mal formée est ignorée (avertissement sans la valeur).
- **Tests** : `tests/discord.test.js`, Discord et site simulés (`fetchAnnonce` remplaçable dans `creerApp`) ; par défaut, les tests
  font échouer tout appel réseau imprévu.

## Base de données (Turso, libSQL)

Dates en texte ISO 8601 UTC, sauf `tentee_le` (millisecondes depuis 1970).

**`articles`**

| Colonne | Type | Notes |
|---|---|---|
| `id` | INTEGER | clé, automatique |
| `slug` | TEXT | unique |
| `statut` | TEXT | `brouillon` ou `publie` (contrainte CHECK) |
| `date_publication` | TEXT | vide tant que jamais publié |
| `titre_fr`, `titre_en` | TEXT | |
| `contenu_fr`, `contenu_en` | TEXT | Markdown |
| `image` | TEXT | chemin, vide pour l'instant (images au lot 3b) |
| `cree_le`, `modifie_le` | TEXT | |

**`tentatives_connexion`** : `id`, `ip_hachee` (HMAC-SHA256 de l'adresse IP, jamais l'adresse en clair), `tentee_le`.

**`pages`** (migration `002_pages.sql`) : `cle` (clé, ex. `a-propos`), `titre_fr`, `titre_en`, `contenu_fr`, `contenu_en` (Markdown),
`modifie_le` — textes de pages du site modifiables depuis l'administration ; sans ligne, le site garde ses textes par défaut.

**`migrations`** : `version`, `nom`, `appliquee_le` — suivi des migrations appliquées.

**Migrations** : fichiers `serveur/migrations/NNN_nom.sql` (numérotés sans trou), appliqués dans l'ordre **au démarrage** du serveur.
Chaque migration est appliquée d'un bloc avec sa ligne dans `migrations` : relancer le serveur ne rejoue rien, deux instances qui
démarrent ensemble ne cassent rien. Une nouvelle migration = un nouveau fichier (`002_…sql`), **on ne modifie jamais** une migration
déjà déployée. Si la base est injoignable au démarrage, le serveur démarre quand même (`/api/sante` répond « non connectée ») et
réessaie à la requête suivante.

## Connexion de l'administrateur

Un seul administrateur, avec un identifiant et un mot de passe.

1. **Mot de passe jamais stocké en clair** : on stocke son empreinte **PBKDF2-SHA256, 600 000 itérations, sel aléatoire de 16 octets**,
   au format `pbkdf2$600000$<sel_base64>$<empreinte_base64>`. Elle est calculée **dans Cloud Shell** par le script d'installation.
   La vérification compare en **temps constant**.
2. **Pas de cookie** : le site (`zsurvival-game.com`) et le serveur (run.app) n'ont pas le même domaine, et Safari bloque les cookies tiers.
   À la connexion, le serveur renvoie un **jeton signé** (HMAC-SHA256 avec la clé de session), valable **2 heures**, que la page
   d'administration envoie ensuite dans l'en-tête `Authorization: Bearer <jeton>`. Le jeton ne contient aucun secret
   (`{ sub: "admin", iat, exp }`). Changer la clé de session déconnecte immédiatement l'administrateur.
   **Plus tard** : quand le site et le serveur seront sur le futur nom de domaine du studio (par exemple `www.…` et `api.…`),
   on pourra passer à un cookie `HttpOnly; Secure; SameSite=Strict`, plus protégé contre le vol du jeton par un script.
3. **Même message** pour un mauvais identifiant et un mauvais mot de passe (`Identifiant ou mot de passe incorrect.`), et les deux
   vérifications sont toujours faites (même durée).
4. **Limite des tentatives** : 5 échecs par adresse IP en 15 minutes, puis refus (429, en-tête `Retry-After`) jusqu'à ce que la
   plus ancienne tentative ait plus de 15 minutes. Compteur dans Turso (le serveur s'endort : un compteur en mémoire serait perdu),
   adresse IP **hachée** (HMAC-SHA256 avec une clé dérivée de la clé de session). Une connexion réussie efface le compteur de
   l'adresse ; les tentatives de plus de 24 heures sont supprimées. Réservation de la tentative en une seule instruction SQL :
   des requêtes simultanées ne passent pas la limite.
   Adresse IP : la **dernière** valeur de `X-Forwarded-For` (celle qu'ajoute le frontal de Google ; les précédentes peuvent venir du client).
5. **CORS** : seule l'origine du site est autorisée : `https://zsurvival-game.com` (constante `ORIGINES_SITE` de
   `serveur/src/app.js` ; `www` et l'ancienne adresse GitHub Pages redirigent vers elle), plus `http://localhost:*` et `http://127.0.0.1:*` hors
   production, ou en production avec la variable `ORIGINES_LOCALES=1`). Une requête d'administration venant d'une autre origine est
   refusée (403). Pas de `Access-Control-Allow-Credentials` (aucun cookie).

## Secrets (noms seulement — les valeurs ne sont JAMAIS dans le dépôt)

Rangés dans **Google Secret Manager** (région europe-west3) par `installer-gcp.sh`, donnés au service Cloud Run comme variables
d'environnement (version `latest`, lue au démarrage de chaque instance). Seul le compte de service `serveur-site` peut les lire.

| Secret Manager | Variable d'environnement | Contenu |
|---|---|---|
| `turso-url` | `TURSO_DATABASE_URL` | adresse de la base Turso (`libsql://…`) |
| `turso-jeton` | `TURSO_AUTH_TOKEN` | jeton d'accès Turso |
| `admin-identifiant` | `ADMIN_IDENTIFIANT` | identifiant de l'administrateur |
| `admin-empreinte` | `ADMIN_EMPREINTE` | empreinte PBKDF2 du mot de passe |
| `cle-session` | `CLE_SESSION` | clé de signature des jetons (32 octets aléatoires, générée par le script) |
| `github-jeton-images` | `GITHUB_JETON_IMAGES` | **facultatif (lot 3b)** : jeton GitHub « fine-grained », dépôt `Nowyyy/Z-Survival-Website` seulement, permission *Contents* en lecture et écriture, **expire au bout d'un an** |
| `discord-webhook-actus` | `DISCORD_WEBHOOK_ACTUS` | **facultatif (lot 3c)** : adresse du webhook Discord du salon des annonces (`https://discord.com/api/webhooks/…`), rangée par `installer-gcp.sh --discord` ; sans elle, pas d'annonce |

Variables **non secrètes** : `NODE_ENV=production`, `VERSION_SERVEUR` (commit déployé), `PORT` (fourni par Cloud Run) ; facultatives,
avec valeur par défaut : `GITHUB_DEPOT` (`Nowyyy/Z-Survival-Website`), `GITHUB_BRANCHE` (`main`), `GITHUB_API` (tests seulement).

**Jeton GitHub des images** : rangé par `installer-gcp.sh --jeton-github` (ou à la question 6d du passage complet), qui donne au
compte `serveur-site` la lecture de ce secret et l'ajoute au service (`gcloud run services update --update-secrets`). Le workflow
déploie avec `--update-secrets` / `--update-env-vars` : un redéploiement garde ce secret. Tant qu'il n'est pas rangé, le
déploiement marche et seul l'envoi d'images est refusé.
**Webhook Discord** (lot 3c) : même principe, `installer-gcp.sh --discord` (ou question 6e du passage complet) ; tant qu'il n'est pas
rangé, les articles publiés ne sont pas annoncés.
Variables GitHub (non secrètes, onglet **Variables**, pas Secrets) : `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`,
`GCP_SERVICE_ACCOUNT`, `GCP_REGION`.

Règles : aucun secret dans le dépôt, les journaux, les messages d'erreur ni les résultats de tests. Le journal masque par précaution
toute valeur secrète connue, et ne note jamais d'en-tête, de corps de requête ni d'adresse IP. Les tests tirent leurs secrets au
hasard à chaque lancement.

## Google Cloud

- Projet **`z-survival-website`**, région **`europe-west3`** (Francfort) pour tout : Cloud Run, Artifact Registry, Secret Manager.
- Comptes de service :
  - `serveur-site` : celui sous lequel tourne le serveur ; **seulement** la lecture de ses secrets (5, plus le jeton GitHub des images) ;
  - `deploiement-github` : celui qu'utilise GitHub Actions ; `roles/run.developer` (déployer, sans pouvoir changer qui a accès),
    `roles/artifactregistry.writer` sur le dépôt `serveur` seulement, `roles/iam.serviceAccountUser` sur `serveur-site` seulement.
- **GitHub ↔ Google Cloud sans clé** : fédération d'identité de charge de travail (groupe `github`, fournisseur `github-oidc`),
  acceptée seulement pour le dépôt `Nowyyy/Z-Survival-Website`, la branche `main` (et l'identifiant du propriétaire du dépôt).
  Aucune clé de compte de service n'existe.
- Accès public au service (`allUsers` → `roles/run.invoker`), donné une fois par le script : la sécurité est gérée par l'application.

## Règles de coût

- Cloud Run : **0 instance minimum** (le serveur s'endort), **2 au maximum**, **processeur facturé seulement pendant les requêtes**
  (`--cpu-throttling`), 1 processeur, **256 Mio**, 40 requêtes simultanées par instance, 30 s au plus par requête.
- Artifact Registry (europe-west3) : règle de nettoyage qui **ne garde que les 3 dernières images** (le nettoyage passe environ une
  fois par jour). Images construites sans attestations à part (une image = une version).
- Réponses publiques en cache 60 s.
- Secret Manager : une seule version active par secret (le script détruit les anciennes).
- Pas de Cloud Storage : les images des articles vont dans le dépôt GitHub du site (lot 3b), publiées par GitHub Pages.
  Pas de Cloud Build (l'image est construite par GitHub Actions).
- Avec peu de visites, tout reste dans les quotas gratuits (Cloud Run, Secret Manager 6 versions actives, Artifact Registry 0,5 Go).

## Redéployer

- **Automatique** : chaque push sur `main` qui touche `serveur/` (ou `serveur.yml`) lance le workflow **serveur** : tests, image,
  envoi dans Artifact Registry, déploiement, puis vérification de `/api/sante`.
- **À la main** : GitHub → Actions → **serveur** → **Run workflow** (branche `main`).
- **Changer un secret** (mot de passe, jeton Turso…) : relancer `installer-gcp.sh` dans Cloud Shell et répondre « n » pour la valeur
  à changer. Le script lance une nouvelle révision pour que le serveur la prenne.
- **Changer seulement le jeton GitHub des images** (renouvellement annuel) : même ligne suivie de ` --jeton-github`.
- Tant que les variables GitHub ne sont pas renseignées, le workflow s'arrête proprement (« installation Google Cloud pas encore faite »).

## Limites connues

- Premier appel après une période sans visite : 1 à 3 s (démarrage de l'instance).
- La limite des tentatives repose sur l'adresse IP vue par Google : plusieurs personnes derrière la même box partagent le compteur.
- Pas encore de publication programmée (un article publié avec une date future est visible tout de suite).
- `contenu` est renvoyé en Markdown brut : ne jamais l'insérer tel quel dans la page (rendu sûr : `js/markdown.js`).
- **Images** : retirer ou remplacer l'image d'un article ne supprime pas le fichier (il reste réutilisable ; le supprimer depuis la
  bibliothèque) ; si GitHub ne répond pas pendant la suppression d'un article, l'image reste (inutilisée) ; une image n'est en ligne
  qu'environ une minute après l'envoi ; le jeton GitHub expire au bout d'un an (à renouveler, voir `Docs/ref/admin.md`) ;
  chaque image ajoute un commit sur `main` (penser à `git pull` avant de travailler sur le site).
