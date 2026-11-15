# Lot 3a — Serveur du site : Cloud Run + Turso + connexion admin

Branche `lot-3a`, depuis `main` (`03918c5`). Référence : `Docs/ref/serveur.md` ; mode d'emploi : `serveur/LISEZMOI.md`.
Aucun fichier du site touché (`index.html`, `main.html`, `css/`, `js/`, `fonts/`, `img/`, `scene/`, `musique/`, `pages.yml`) :
le lot 2b travaille en parallèle sur ces fichiers.

## Ce qui a été fait

### A — Documentation
- `Docs/ref/serveur.md` : architecture (GitHub Pages ↔ Cloud Run ↔ Turso), routes, schéma de la base, migrations, connexion
  (empreinte, jeton, limite, CORS ; passage possible aux cookies sur le futur nom de domaine), secrets (noms seulement),
  comptes de service, règles de coût, redéploiement, limites.
- `CLAUDE.md` : section « Serveur » (aucun secret dans le dépôt, région `europe-west3`, 0 instance minimum, site et serveur
  séparés, migrations jamais réécrites) et entrées `serveur/` et `serveur.yml` dans « Organisation ».

### B — Serveur, migrations, tests (`serveur/`)
- **Node.js 24 LTS** (image `node:24-slim`, utilisateur sans droits), **Hono** + `@hono/node-server`, **`@libsql/client`**.
  Aucune étape de build.
- Routes publiques `GET /api/sante`, `GET /api/articles?lang=&page=`, `GET /api/articles/:slug` (publiés seulement, plus récent
  d'abord, 10 par page, repli sur le français, `Cache-Control: public, max-age=60`).
- Routes admin (jeton obligatoire) : `POST /api/admin/connexion`, `GET/POST /api/admin/articles`,
  `GET/PUT/DELETE /api/admin/articles/:id`, `POST …/:id/publier` et `…/:id/depublier`.
- Tables `articles`, `tentatives_connexion`, `migrations` ; migration `001_initial.sql`, appliquée au démarrage, relançable,
  sans risque si deux instances démarrent ensemble.
- Sécurité : PBKDF2-SHA256 600 000 itérations (sel de 16 octets, temps constant) ; jeton HMAC-SHA256 de 2 heures dans
  `Authorization: Bearer` (pas de cookie) ; 5 échecs par IP en 15 min (IP hachée, réservation atomique : les requêtes simultanées
  ne passent pas) ; même message pour identifiant et mot de passe faux ; CORS limité à `https://nowyyy.github.io`
  (+ localhost hors production) ; champs, types, longueurs et taille du corps contrôlés (4 Kio / 256 Kio) ; en-têtes de sécurité ;
  journal JSON sans en-têtes, corps ni IP, avec masquage de toute valeur secrète connue.
- Sans secrets d'administration, le public fonctionne et l'administration répond 503. Base injoignable : le serveur démarre,
  `/api/sante` dit « non connectée » et les migrations sont réessayées.
- `npm run preparer-local` : fichier `.env.local` d'essai (ignoré par git) pour lancer en local avec une base SQLite en fichier.

### C — Installation Google Cloud (`serveur/deploiement/installer-gcp.sh`)
- Une ligne à coller dans Cloud Shell (`bash <(curl … installer-gcp.sh)`), qui télécharge et lance le script : coller le fichier
  entier ferait répondre le texte collé aux questions.
- Étapes : projet vérifié (proposition de basculer sur `z-survival-website`) ; API (Cloud Run, Artifact Registry, Secret Manager,
  IAM, IAM Credentials, STS, plus Cloud Resource Manager pour le rôle au niveau du projet ; **pas de Cloud Build**) ; dépôt
  `serveur` dans `europe-west3` avec la règle « garder les 3 dernières » ; comptes `serveur-site` (lecture de ses 5 secrets,
  rien d'autre) et `deploiement-github` (`run.developer`, `artifactregistry.writer` sur le dépôt, `serviceAccountUser` sur
  `serveur-site`) ; fédération d'identité `github`/`github-oidc` limitée à `Nowyyy/Z-Survival-Website`, `refs/heads/main` et à
  l'identifiant du propriétaire du dépôt ; saisie masquée (`read -s` sur `/dev/tty`) de l'adresse et du jeton Turso, de
  l'identifiant et du mot de passe (deux fois, 12 caractères au moins) ; empreinte PBKDF2 calculée dans Cloud Shell (python3) ;
  clé de session de 32 octets générée ; tout passe par des tubes vers `gcloud secrets versions add --data-file=-` (rien à l'écran,
  sur le disque ni dans l'historique) ; anciennes versions de secrets détruites ; service Cloud Run d'attente créé et rendu
  public une fois (le compte de déploiement n'a donc pas besoin du droit de changer les accès) ; affichage final des 4 variables
  non secrètes.
- Relançable : chaque élément est d'abord recherché ; pour les secrets déjà rangés, « Les garder ? » (Entrée = oui). Si un secret
  change, une nouvelle révision est lancée pour qu'il soit pris.
- `serveur/LISEZMOI.md` : pas à pas pour quelqu'un qui ne code pas (Cloud Shell, la ligne à coller, les questions, les variables
  GitHub, le premier déploiement, problèmes courants).

### D — Déploiement automatique (`.github/workflows/serveur.yml`)
- À chaque push sur `main` qui touche `serveur/` (ou ce workflow), et à la main (« Run workflow »).
- Tâches : **tests** (Node 24, `npm ci`, `npm test`) ; **vérification de l'installation** (les 4 variables) ; **déploiement**
  seulement si elles sont là : `google-github-actions/auth` (fédération, sans clé), image construite par GitHub
  (`--provenance=false --sbom=false`), envoyée dans Artifact Registry, `gcloud run deploy` en `europe-west3` avec 0 à 2 instances,
  `--cpu-throttling`, 256 Mio, secrets `latest` de Secret Manager ; puis appel de `/api/sante` (échec si pas « ok »).
- Variables absentes : avis « Installation Google Cloud pas encore faite » + résumé, déploiement sauté, **workflow vert**.
- `pages.yml` inchangé : il ne copie que les fichiers du site, jamais `serveur/`.

## Vérifications (dans la session, avant la fusion)
- **Tests** : `npm test` → **31/31** sous Node 22 et sous Node 24 (dans `node:24-slim`), base SQLite en fichier temporaire,
  secrets tirés au hasard à chaque lancement. Couvrent : empreinte et vérification, compatibilité avec l'empreinte du script ;
  jeton valide, expiré, falsifié (charge, signature, autre clé, durée trop longue), sans secret ; limite (5 échecs, 429 +
  `Retry-After`, autre IP libre, IP hachée, de nouveau permis après 15 min, 12 requêtes simultanées → 5 passent) ; même message
  d'échec ; 7 routes admin × 4 cas sans jeton valide → 401 ; CORS (préflight, origine refusée, `http://`, faux sous-domaine,
  localhost en test mais pas en production, admin depuis une autre origine → 403) ; contrôle des entrées (415, 400, 413) ; CRUD,
  slug unique, publication, dépublication, pagination, repli sur le français ; migrations relancées et simultanées ; `/api/sante`
  connectée et injoignable ; aucun secret dans les réponses, en-têtes ni journal.
- **Conteneur** construit et lancé en local (base SQLite en fichier, `NODE_ENV=production`) : **13/13** vérifications de bout en
  bout (santé, connexion avec une empreinte calculée par Python comme dans Cloud Shell, CORS, brouillon invisible puis publié,
  cache 60 s, 401 sans jeton, limite par la dernière valeur de `X-Forwarded-For`, journal sans secret ni IP, utilisateur `node`).
  Dans cet environnement, `npm ci` dans l'image demandait le certificat du proxy de la session : la construction a utilisé une
  copie du Dockerfile qui ajoute ce certificat à l'étape des dépendances seulement (étape finale identique, rien de changé dans
  le dépôt). Sur GitHub, le Dockerfile du dépôt est utilisé tel quel.
- **Script d'installation** : syntaxe (`bash -n`) et `shellcheck` sans avertissement ; joué 3 fois dans un pseudo-terminal contre
  un **faux `gcloud`** (Google Cloud non accessible d'ici) : premier passage (saisies refusées puis acceptées), relance qui garde
  tout (rien recréé, aucun secret réécrit), relance qui change le mot de passe et la clé (nouvelle version, ancienne détruite,
  nouvelle révision). L'empreinte produite par le script est acceptée par le serveur. Aucun secret à l'écran, dans les arguments
  de `gcloud`, dans un fichier ni dans l'historique.
- **Workflow** : `actionlint` sans erreur.
- **Recherche de secrets** dans tout le dépôt (motifs de jetons JWT/Turso, `libsql://…turso.io`, empreintes `pbkdf2$…`, clés
  Google et GitHub, clés privées, affectations `password/secret/token = "…"`, fichiers `.env`/`.db`/`.pem`) et `detect-secrets` :
  **rien** (seulement des exemples fictifs dans un message d'aide et un test du masquage).
- `git diff --stat main` : seulement `serveur/`, `.github/workflows/serveur.yml`, `Docs/` et `CLAUDE.md`.

## Limites
- **Rien n'a été essayé sur Google Cloud ni sur Turso** depuis la session (pas d'accès, et les secrets ne passent jamais par
  l'agent) : le script a été vérifié contre un faux `gcloud`. Le premier vrai passage peut révéler un détail (droits qui mettent
  quelques secondes à arriver : le script réessaie ; message d'erreur : relancer la même ligne).
- **Adresse IP** : prise dans la dernière valeur de `X-Forwarded-For` (celle qu'ajoute Google). Si Google en ajoutait une autre
  après, tous les visiteurs partageraient le même compteur (plus strict, pas plus faible). À observer après la mise en service.
- Premier appel après une période sans visite : 1 à 3 s (le serveur s'endort, voulu pour le coût).
- Le nettoyage d'Artifact Registry passe environ une fois par jour (pas immédiatement après chaque envoi).
- Pas encore de publication programmée ; `contenu` est du Markdown brut (rendu sécurisé au lot 3b) ; pas d'images (lot 3b).
- Le jeton est gardé par la page d'administration (lot 3b) : un script malveillant injecté dans le site pourrait le lire, d'où
  l'intérêt des cookies `HttpOnly` quand site et serveur partageront un domaine.
- Tag `lot-3a` : créé localement ; son envoi est refusé par l'environnement (403), comme aux lots précédents.

## Vos étapes après la fusion
1. **Lancer le script dans Cloud Shell** : console Google Cloud sur le projet `z-survival-website` → icône **>_** → coller la ligne
   de `serveur/LISEZMOI.md` (« 2. Coller le script ») → répondre aux questions (rien ne s'affiche quand vous tapez : normal).
2. **Recopier les 4 variables dans GitHub** : Settings → Secrets and variables → Actions → onglet **Variables** →
   `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `GCP_REGION` (valeurs affichées à la fin du script).
3. **Relancer le workflow « serveur »** : onglet **Actions** → **serveur** → **Run workflow** (branche `main`), attendre la coche verte.
4. **Ouvrir `https://…run.app/api/sante`** (adresse affichée par le script et dans le résumé du workflow) et vérifier
   `"ok":true` et `"base":"connectée"`.
5. **Vérifier dans la console** : Cloud Run → service `z-survival-serveur` dans la région **europe-west3**
   (et, si vous voulez : instances minimum 0, maximum 2 dans l'onglet « Révisions »).
