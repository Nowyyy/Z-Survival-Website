# Serveur du site (lot 3a) — Cloud Run + Turso

Le serveur permettra de **saisir les actualités depuis une page d'administration** (lot 3b) et de les **afficher sur le site**.
Il vit dans `serveur/` et se déploie **séparément** du site : le site reste sur GitHub Pages (`pages.yml`), le serveur part sur
Google Cloud Run (`serveur.yml`). Le serveur n'est jamais publié sur GitHub Pages.

Mode d'emploi pas à pas (installation, lancement en local, tests) : `serveur/LISEZMOI.md`.

## Architecture

```
 Navigateur du visiteur / de l'admin
        │  1. pages du site (HTML, CSS, JS)               2. données (JSON, en-tête Authorization pour l'admin)
        ▼                                                 ▼
 GitHub Pages                                      Google Cloud Run (europe-west3, Francfort)
 https://nowyyy.github.io/Z-Survival-Website/      service « z-survival-serveur » (…run.app)
 (pages.yml, à chaque push sur main)               Node.js 24 + Hono, image dans Artifact Registry (europe-west3)
                                                          │  secrets lus au démarrage (Secret Manager → variables d'environnement)
                                                          ▼
                                                   Turso (libSQL), base « z-survival-site », région Francfort
```

- **Site** (github.io) et **serveur** (run.app) n'ont pas le même domaine : le site appelle le serveur par `fetch` (CORS).
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
- `contenu` est du **Markdown brut** : l'affichage sécurisé (sans HTML dangereux) se fera au lot 3b.
- Le public ne voit ni `id`, ni `statut`, ni les dates internes.

### Administration (jeton obligatoire, jamais en cache)

| Route | Rôle |
|---|---|
| `POST /api/admin/connexion` | corps `{ identifiant, mot_de_passe }` → `{ jeton, expire_le }` ; 401 si refusé, 429 si trop de tentatives |
| `GET /api/admin/articles?page=N` | tous les articles, brouillons compris (50 par page) |
| `GET /api/admin/articles/:id` | un article (tous les champs) |
| `POST /api/admin/articles` | crée un article (`slug` et `titre_fr` obligatoires ; brouillon par défaut) → 201 |
| `PUT /api/admin/articles/:id` | modifie les champs fournis (les autres restent) |
| `DELETE /api/admin/articles/:id` | supprime l'article |
| `POST /api/admin/articles/:id/publier` | publie (date de publication = maintenant si elle est vide) |
| `POST /api/admin/articles/:id/depublier` | repasse en brouillon |

- Champs acceptés : `slug`, `statut`, `date_publication`, `titre_fr`, `titre_en`, `contenu_fr`, `contenu_en`, `image`. Un champ inconnu est refusé (400).
- `slug` : minuscules, chiffres et tirets (`nouvelle-carte`), 120 caractères au plus, unique (409 sinon).
- Longueurs maximales : titres 200 caractères, contenus 40 000, image 300 (chemin relatif simple, ou vide).
- `date_publication` : date ISO 8601 (`2026-11-15T14:00:00Z`) ou `null`. Publier exige `titre_fr` et `contenu_fr`.
- Taille du corps : 4 Kio pour la connexion, 256 Kio pour un article (413 au-delà). Corps JSON obligatoire (415 sinon).
- Sans jeton, ou jeton faux ou expiré : 401 `Connexion requise.` Secrets d'administration absents : 503.

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
2. **Pas de cookie** : le site (github.io) et le serveur (run.app) n'ont pas le même domaine, et Safari bloque les cookies tiers.
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
5. **CORS** : seule l'origine `https://nowyyy.github.io` est autorisée (plus `http://localhost:*` et `http://127.0.0.1:*` hors
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

Variables **non secrètes** : `NODE_ENV=production`, `VERSION_SERVEUR` (commit déployé), `PORT` (fourni par Cloud Run).
Variables GitHub (non secrètes, onglet **Variables**, pas Secrets) : `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`,
`GCP_SERVICE_ACCOUNT`, `GCP_REGION`.

Règles : aucun secret dans le dépôt, les journaux, les messages d'erreur ni les résultats de tests. Le journal masque par précaution
toute valeur secrète connue, et ne note jamais d'en-tête, de corps de requête ni d'adresse IP. Les tests tirent leurs secrets au
hasard à chaque lancement.

## Google Cloud

- Projet **`z-survival-website`**, région **`europe-west3`** (Francfort) pour tout : Cloud Run, Artifact Registry, Secret Manager.
- Comptes de service :
  - `serveur-site` : celui sous lequel tourne le serveur ; **seulement** la lecture de ses 5 secrets ;
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
- Pas de Cloud Storage dans ce lot (images des articles au lot 3b). Pas de Cloud Build (l'image est construite par GitHub Actions).
- Avec peu de visites, tout reste dans les quotas gratuits (Cloud Run, Secret Manager 6 versions actives, Artifact Registry 0,5 Go).

## Redéployer

- **Automatique** : chaque push sur `main` qui touche `serveur/` (ou `serveur.yml`) lance le workflow **serveur** : tests, image,
  envoi dans Artifact Registry, déploiement, puis vérification de `/api/sante`.
- **À la main** : GitHub → Actions → **serveur** → **Run workflow** (branche `main`).
- **Changer un secret** (mot de passe, jeton Turso…) : relancer `installer-gcp.sh` dans Cloud Shell et répondre « n » pour la valeur
  à changer. Le script lance une nouvelle révision pour que le serveur la prenne.
- Tant que les variables GitHub ne sont pas renseignées, le workflow s'arrête proprement (« installation Google Cloud pas encore faite »).

## Limites connues

- Premier appel après une période sans visite : 1 à 3 s (démarrage de l'instance).
- La limite des tentatives repose sur l'adresse IP vue par Google : plusieurs personnes derrière la même box partagent le compteur.
- Pas encore de publication programmée (un article publié avec une date future est visible tout de suite).
- `contenu` est renvoyé en Markdown brut : ne jamais l'insérer tel quel dans la page (lot 3b : rendu sécurisé).
