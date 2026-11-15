# Lot 3d — Admin : messages du bandeau d'alerte de l'accueil

Branche `lot-3d`, depuis `main`. Demande du propriétaire : « sous “À propos”, un menu permettant de paramétrer des messages pour le
bandeau d'alerte de la page d'accueil ».

## Choix
Les messages restent dans le fichier du site **`contenus/bandeau.json`** (format de `Docs/ref/contenus.md`, inchangé). L'admin les modifie,
et le **serveur réécrit ce fichier dans le dépôt** par l'API GitHub, avec le jeton déjà utilisé pour les images.
- Le **site ne change pas** : il lit toujours le fichier. Le bandeau s'affiche donc tout de suite, sans attendre le réveil du serveur
  (Cloud Run s'endort, et le réveil prend quelques secondes).
- Chaque enregistrement est un commit « Z-Survival admin » sur `main` : historique et retour en arrière possibles sur GitHub.
- Contrepartie : les nouveaux messages sont en ligne **environ une minute** après l'enregistrement (republication de GitHub Pages), comme
  les images des articles.
- C'est la piste prévue par `Docs/ref/contenus.md` (« elle écrira le même format… dans ce fichier »).

## Ce qui a été fait

### A — Serveur (`serveur/src/bandeau.js`, routes dans `serveur/src/app.js`)
- `GET /api/admin/bandeau` : lit `contenus/bandeau.json` dans le dépôt (tous les messages, même cachés) et renvoie l'empreinte (`sha`) du
  fichier lu.
- `PUT /api/admin/bandeau` : contrôle la liste puis réécrit le fichier (commit sur `main`) :
  - 30 messages au plus ;
  - français obligatoire, 160 caractères au plus par langue ;
  - texte brut sur une ligne (caractères de contrôle retirés) ;
  - identifiants refaits à partir du français s'ils manquent ou sont en double.
- Fichier écrit **au même format qu'à la main** : en-tête d'aide mis à jour (mentionne l'admin), un message par ligne, lisible sur GitHub.
- **Pas d'écrasement à l'aveugle** : l'admin renvoie l'empreinte du fichier qu'il a lu. Si le fichier a changé entre-temps (autre onglet,
  modification sur GitHub), GitHub refuse et le serveur répond **409** avec un message clair.
- Sans jeton GitHub : 503 « pas encore configurée ». Le jeton n'apparaît jamais dans une réponse ni dans le journal.
- Le client GitHub des images (`clientGithub`, `AUTEUR` de `serveur/src/images.js`) est réutilisé.

### B — Admin (`admin/index.html`, `admin/admin.js`, `admin/admin.css`)
- **Pages du site** : nouveau bouton **« Modifier le bandeau d’alerte »** sous « Modifier la page « À propos » ».
- Écran **Bandeau d’alerte** :
  - un **aperçu** du bandeau, en FR et en EN, avec le dernier article en tête (« Dernière transmission : … ») ;
  - un statut (« 6 messages · 5 affichés », ou « Non enregistré ») ;
  - chaque message dans une carte : français (obligatoire), anglais (facultatif), case **Affiché** (carte en pointillés quand le message est
    caché), **↑ Monter**, **↓ Descendre**, **Supprimer** ;
  - **+ Ajouter un message** ;
  - **Annuler les changements**, **Enregistrer et publier**.
- Téléphone d'abord : boutons de 44 px, barre d'actions collée en bas ; jusqu'à 380 px, « Supprimer » passe sous « Monter » et « Descendre ».
- Même protection que pour les autres écrans :
  - confirmation avant de quitter avec des changements non enregistrés (bouton retour, déconnexion, fermeture de l'onglet) ;
  - liste gardée et rouverte après une expiration de session.
- Le focus suit le message déplacé ; le curseur va dans le champ d'un nouveau message.

### C — Documentation
- `Docs/ref/admin.md` (section 9, pas à pas), `Docs/ref/contenus.md` (choix faits, modification à la main toujours possible),
  `Docs/ref/serveur.md` (routes), `CLAUDE.md`.
- Commentaire de `js/accueil-bandeau.js` mis à jour (seul fichier du site touché, sans changement de code).

## Vérifications
- **Tests du serveur** : **77/77**, dont 11 nouveaux (`serveur/tests/bandeau.test.js`, API GitHub simulée qui exige l'empreinte comme la
  vraie) :
  - connexion obligatoire ;
  - lecture (messages cachés compris, empreinte) ;
  - écriture : commit, format, nettoyage des textes, identifiants ;
  - 409 si le fichier a changé (et sans empreinte) ;
  - liste vide acceptée, contrôles de longueur, de nombre et de type ;
  - refus du jeton (502, sans fuite), fichier illisible (502), sans jeton (503) ;
  - le fichier écrit se relit à l'identique, guillemets et deux-points compris.
- **Bout en bout** (`outils/admin/verifier-bandeau.mjs`, nouveau ; banc local avec le vrai serveur et une API GitHub simulée qui écrit dans la
  copie du site) : **29/29**.
  - Ouverture depuis « Pages du site », sous « À propos » ; lecture du fichier.
  - Aperçu FR / EN.
  - Modifier, cacher, monter, supprimer, ajouter ; texte vide refusé.
  - Boutons de 44 px, aucun défilement horizontal.
  - Enregistrement : commit « Z-Survival admin » sur `main`, fichier au bon format.
  - **L'accueil de la copie servie affiche les nouveaux messages** (et pas le message caché).
  - Modification faite ailleurs : refusée sans rien écraser ; « Annuler les changements » ; réouverture qui relit la version de GitHub.
  - 320 et 1440 px sans débordement ni chevauchement ; aucune erreur console.
- **Admin et actualités** (`outils/admin/verifier-actus.mjs`, lot 3b) : **236/236**, inchangé. Le faux GitHub du banc sait maintenant
  lire le contenu des fichiers existants et exige leur empreinte pour les modifier, comme GitHub.

## Limites
- **Une minute** entre l'enregistrement et l'affichage sur l'accueil (republication du site).
- Pas de dates de début et de fin par message : on cache ou on montre à la main.
- Il faut le **jeton GitHub des images** (déjà en place). S'il expire (dans environ 11 mois), l'écran du bandeau affiche l'erreur de
  GitHub, comme l'envoi d'images.
- **Tag `lot-3d`** : créé en local ; son envoi sur GitHub est refusé par l'environnement de l'agent, comme pour les lots précédents.

## À tester toi-même
1. Admin → **Pages du site** → **Modifier le bandeau d’alerte** : les 6 messages actuels apparaissent.
2. Change un texte, décoche un message, ajoute-en un, regarde l'aperçu en FR puis en EN, **Enregistrer et publier**.
3. Une minute plus tard, recharge l'accueil : le bandeau montre les nouveaux messages. Sur GitHub, `contenus/bandeau.json` a un nouveau
   commit « Z-Survival admin ».

## État git
- Commits `lot-3d A` à `lot-3d D` sur la branche `lot-3d`, PR vers `main` fusionnée par l'agent. Le push sur `main` touche `serveur/`
  (workflow « serveur » : tests et déploiement) et le site (`pages.yml` : admin republiée).
