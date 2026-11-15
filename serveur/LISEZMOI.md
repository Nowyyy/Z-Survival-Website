# Serveur du site Z-Survival

Serveur des actualités du site : **Node.js 24 (LTS)**, **Hono** (petit framework web), client officiel **`@libsql/client`**
(base **Turso**), image **Docker** pour **Google Cloud Run** (région `europe-west3`, Francfort).
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
migrations relançables, `/api/sante`, aucun secret dans les réponses ni dans le journal.

## Le conteneur en local

```bash
docker build -t z-survival-serveur serveur
docker run --rm -p 8080:8080 -e TURSO_DATABASE_URL=file:/tmp/local.db z-survival-serveur
```

Puis http://localhost:8080/api/sante. Sans les variables d'administration, le public marche et l'administration répond 503.
