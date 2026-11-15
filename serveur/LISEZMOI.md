# Serveur du site Z-Survival

Serveur des actualités du site : **Node.js 24 (LTS)**, **Hono** (petit framework web), client officiel **`@libsql/client`**
(base **Turso**), **sharp** (images des articles, lot 3b), image **Docker** pour **Google Cloud Run** (région `europe-west3`, Francfort).
Page d'administration : `admin/` du site, mode d'emploi [`Docs/ref/admin.md`](../Docs/ref/admin.md).
Architecture, routes, base, connexion, secrets et coûts : [`Docs/ref/serveur.md`](../Docs/ref/serveur.md).

---

## Lancer en local (base SQLite en fichier, jamais Turso)

Il faut Node.js 22.12 ou plus récent.

```bash
cd serveur
npm install
npm run preparer-local
npm run dev
```

- `npm run preparer-local` demande un identifiant et un mot de passe **d'essai** (masqué), calcule l'empreinte et crée
  `serveur/.env.local` (base `file:donnees/local.db`, clé de session tirée au hasard). Ce fichier et la base sont **ignorés par git**.
- `npm run dev` lance le serveur sur http://localhost:8080 (les migrations sont appliquées au démarrage).
- Vérifier : http://localhost:8080/api/sante → `{"ok":true,"base":"connectée",…}`.
- Se connecter (remplacer par vos valeurs d'essai) :

```bash
curl -s -X POST http://localhost:8080/api/admin/connexion -H 'Content-Type: application/json' -d '{"identifiant":"…","mot_de_passe":"…"}'
```

  puis envoyer le jeton reçu : `-H 'Authorization: Bearer <jeton>'`.
- Hors production, les pages servies depuis `http://localhost:*` ou `http://127.0.0.1:*` peuvent appeler le serveur (CORS).

## Lancer les tests

```bash
cd serveur
npm test
```

Tests sur une base SQLite en fichier temporaire (supprimée ensuite), avec des secrets tirés au hasard à chaque lancement.
Ils couvrent : empreinte et vérification du mot de passe, jeton (valide, expiré, falsifié), limite des tentatives (y compris
des requêtes simultanées), CRUD des articles, seuls les articles publiés côté public, CORS, refus sans jeton, contrôle des entrées,
migrations relançables, `/api/sante`, aucun secret dans les réponses ni dans le journal ; images des articles (bon format, trop
lourde, mauvais type, sans jeton, sans secret GitHub, EXIF et GPS supprimés, commit au bon chemin) avec une API GitHub **simulée**.

Banc complet (serveur local sur SQLite, API GitHub simulée, site et admin dans Chromium) : `node outils/admin/verifier-actus.mjs`
depuis la racine du dépôt.

## Le conteneur en local

```bash
docker build -t z-survival-serveur serveur
docker run --rm -p 8080:8080 -e TURSO_DATABASE_URL=file:/tmp/local.db z-survival-serveur
```

Puis http://localhost:8080/api/sante. Sans les variables d'administration, le public marche et l'administration répond 503.

---

## Installation Google Cloud (une seule fois, sans rien installer chez vous)

Vous aurez besoin de :
- la **console Google Cloud** ouverte sur le projet **z-survival-website** (facturation activée) ;
- dans **Turso**, la base **z-survival-site** : son **adresse** (`libsql://…`) et un **jeton** (bouton « Connect » de la base,
  puis « Create token » ; gardez l'onglet ouvert pour copier les deux) ;
- l'**identifiant** et le **mot de passe** que vous voulez pour l'administration (12 caractères au moins ; une phrase de
  plusieurs mots est idéale). Notez-les dans votre gestionnaire de mots de passe : ils ne sont stockés nulle part en clair.

### 1. Ouvrir Cloud Shell
1. Aller sur https://console.cloud.google.com/ et vérifier, en haut à gauche, que le projet choisi est **z-survival-website**.
2. Cliquer sur l'icône **>_** (« Activer Cloud Shell »), en haut à droite de la console.
3. Un terminal s'ouvre en bas de la page (la première fois, cliquer « Continuer » et attendre quelques secondes).

### 2. Coller le script
Copier **cette ligne exactement**, la coller dans Cloud Shell (clic droit → Coller, ou Ctrl+V), puis appuyer sur **Entrée** :

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Nowyyy/Z-Survival-Website/main/serveur/deploiement/installer-gcp.sh)
```

> Collez bien **cette ligne** et non le contenu du fichier : le script vous pose des questions, et un long texte collé
> répondrait à votre place. Si Google demande « Autoriser Cloud Shell », cliquer **Autoriser**.

### 3. Répondre aux questions
Le script travaille seul quelques minutes (activation des API, comptes, liaison avec GitHub), puis demande :

| Question | Réponse |
|---|---|
| Adresse de la base Turso | coller l'adresse `libsql://…` |
| Jeton Turso | coller le jeton |
| Identifiant admin | taper votre identifiant |
| Mot de passe admin, puis « encore une fois » | taper votre mot de passe deux fois |

**Rien ne s'affiche quand vous tapez ou collez : c'est normal** (saisie masquée). Appuyer sur Entrée après chaque réponse.
Les valeurs partent directement dans Google Secret Manager : elles ne sont ni affichées, ni écrites sur le disque, ni gardées
dans l'historique. Le mot de passe est transformé en empreinte dans Cloud Shell ; le mot de passe lui-même n'est stocké nulle part.
La clé de session est fabriquée par le script, vous n'avez rien à fournir.

### 4. Recopier les 4 variables dans GitHub
À la fin, le script affiche un tableau de **4 valeurs non secrètes**. Pour chacune :
1. Ouvrir https://github.com/Nowyyy/Z-Survival-Website/settings/variables/actions
   (Settings → Secrets and variables → Actions → onglet **Variables** — **pas** l'onglet Secrets).
2. Cliquer **New repository variable**, recopier le **Name** et la **Value**, puis **Add variable**.

| Name | Value (exemple) |
|---|---|
| `GCP_PROJECT_ID` | `z-survival-website` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/123456789/locations/global/workloadIdentityPools/github/providers/github-oidc` |
| `GCP_SERVICE_ACCOUNT` | `deploiement-github@z-survival-website.iam.gserviceaccount.com` |
| `GCP_REGION` | `europe-west3` |

### 5. Lancer le déploiement
1. Ouvrir https://github.com/Nowyyy/Z-Survival-Website/actions/workflows/serveur.yml
2. **Run workflow** → branche **main** → **Run workflow**. Attendre la coche verte (3 à 5 minutes).
3. Ouvrir l'adresse affichée à la fin du script (ou dans le résumé du workflow), suivie de `/api/sante` :
   `https://z-survival-serveur-….europe-west3.run.app/api/sante` → doit afficher `"ok":true` et `"base":"connectée"`.

### Jeton GitHub des images (lot 3b)
Pour que l'admin puisse ajouter des images aux articles, il faut un jeton GitHub (création pas à pas : `Docs/ref/admin.md`,
« Jeton GitHub »). Pour le ranger **sans toucher au reste**, coller cette ligne dans Cloud Shell, puis le jeton :

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Nowyyy/Z-Survival-Website/main/serveur/deploiement/installer-gcp.sh) --jeton-github
```

Le passage complet du script pose aussi la question (« Avez-vous le jeton GitHub des images… ? ») ; Entrée = plus tard.
Le jeton expire au bout d'un an : refaire la même chose avec un nouveau jeton.

### Webhook Discord des actualités (lot 3c)
Pour annoncer chaque article publié dans un salon Discord : créer un webhook sur ce salon (pas à pas : `Docs/ref/admin.md`,
« Annonce Discord »), puis coller cette ligne dans Cloud Shell, et l'adresse du webhook :

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Nowyyy/Z-Survival-Website/main/serveur/deploiement/installer-gcp.sh) --discord
```

Le script vérifie l'adresse auprès de Discord, propose un message d'essai, la range et la donne au serveur.

### Relancer le script plus tard
Le script peut être relancé autant de fois que voulu (même ligne) : il ne recrée pas ce qui existe. Pour chaque groupe de secrets,
il demande « Les garder ? » : **Entrée** garde la valeur, **n** permet d'en taper une nouvelle (par exemple pour changer le mot de
passe). Il relance alors le serveur pour qu'il prenne les nouvelles valeurs.

### Problèmes
- **« Projet introuvable »** : choisir le projet en haut de la console, fermer et rouvrir Cloud Shell, relancer.
- **Erreur de facturation** à l'étape 2 : la facturation du projet doit être activée (menu ☰ → Facturation).
- **« Impossible de rendre le service public »** : une règle d'organisation interdit l'accès public ; ce n'est pas le cas d'un
  compte Google personnel. Me prévenir.
- **Le workflow « serveur » s'arrête avec « Installation Google Cloud pas encore faite »** : une des 4 variables manque ou est mal
  nommée (onglet Variables, pas Secrets).
- **`/api/sante` répond `"base":"non connectée"`** : adresse ou jeton Turso faux ; relancer le script et répondre **n** pour Turso.
- Arrêt du script en cours de route : rien de grave, relancer la même ligne.
