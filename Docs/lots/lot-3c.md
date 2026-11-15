# Lot 3c — Serveur : annonce Discord de chaque actualité publiée

Branche `lot-3c`, depuis `main` (`42cc371`). Demande du propriétaire : « à chaque news publiée dans l'onglet News, une notification sur un
channel Discord ». Lot **serveur** : aucun fichier du site n'est touché (règle de `CLAUDE.md`).

## Ce qui a été fait

### A — L'annonce (`serveur/src/discord.js`, `serveur/src/app.js`, migration 003)
- **Quand** : à la **première publication** d'un article, quelle que soit la façon de publier (bouton **Publier**, création directement
  publiée, ou modification qui passe l'article en publié).
- **Une seule fois par article** : nouvelle colonne `annonce_discord_le` (migration `003_annonce_discord.sql`). Modifier un article,
  le dépublier puis le republier n'envoie rien de plus.
- **Le message**, envoyé par un **webhook Discord** (adresse secrète `DISCORD_WEBHOOK_ACTUS`) :
  - une ligne « 📰 **Nouvelle actualité sur Z-Survival** » suivie du lien ;
  - une carte rouge (couleur du jeu) : titre français de l'article, début du texte (Markdown retiré, 280 caractères au plus), image de
    l'article, lien `https://zsurvival-game.com/#actu/<slug>`, date ;
  - nom « Z-Survival » et icône du site ;
  - **aucune mention ne notifie** : un « @everyone » écrit dans un titre reste du texte.
- **Image tout juste envoyée** : GitHub Pages met environ une minute à la mettre en ligne. Si son adresse publique ne répond pas encore,
  le serveur lit le fichier dans le dépôt (API GitHub) et le **joint** au message ; l'image apparaît donc toujours.
- **Discord en panne ou qui refuse** : l'article est **publié quand même** ; l'échec est noté dans le journal et l'annonce sera tentée à
  la prochaine publication de cet article (dépublier puis publier).
- **Sans webhook rangé** : rien ne change, aucune annonce.
- **Secret** : l'adresse du webhook (et sa partie secrète) est masquée dans le journal, n'apparaît dans aucune réponse ni erreur. Une
  adresse mal formée est ignorée, avec un avertissement sans la valeur.
- Les routes qui publient renvoient en plus `annonce_discord: { envoyee, raison? }` (information pour plus tard : l'admin ne l'affiche
  pas encore, ce serait un lot sur le site).

### B — Installation (`serveur/deploiement/installer-gcp.sh --discord`)
- Nouvelle option **`--discord`**, sur le modèle de `--jeton-github` : saisie masquée de l'adresse, contrôle de sa forme, **vérification
  auprès de Discord sans rien poster**, **message d'essai** proposé dans le salon, rangement dans Secret Manager
  (`discord-webhook-actus`), droit de lecture pour le compte `serveur-site` seulement, et ajout au service Cloud Run (nouvelle
  révision).
- L'adresse passe à `curl` par son entrée standard (`-K -`), jamais en argument : ni dans la liste des processus, ni dans l'historique.
- Le passage complet du script pose aussi la question (6e) ; Entrée = plus tard.
- `serveur.yml` déploie déjà avec `--update-secrets` : un redéploiement garde le webhook.

### C — Documentation
- `Docs/ref/admin.md`, « Annonce Discord » : créer le webhook dans Discord, le ranger, changer de salon, arrêter les annonces, que faire si
  l'adresse est divulguée, relancer une annonce manquée.
- `Docs/ref/serveur.md` (fonctionnement, secret), `serveur/LISEZMOI.md`, `CLAUDE.md`.

## Vérifications
- **Tests du serveur** : **64/64** (52 avant, 12 nouveaux dans `tests/discord.test.js`, Discord et site simulés, aucun appel réseau réel) :
  - brouillon : pas d'annonce ; première publication : un message, carte complète, `allowed_mentions` vide, bonne adresse d'article,
    extrait sans Markdown, image par son adresse publique ;
  - modification, dépublication puis republication : jamais de deuxième message ;
  - création directement publiée et passage en publié par modification : annoncés ;
  - image pas encore en ligne : lue dans le dépôt et jointe ;
  - Discord qui refuse (500) ou ne répond pas : article publié et visible, raison `erreur_discord`, annonce réussie à la publication
    suivante ;
  - sans webhook : `non_configure`, aucun appel ; adresse mal formée : `webhook_invalide`, avertissement sans la valeur ;
  - l'adresse du webhook n'apparaît ni dans le journal, ni dans les réponses de l'admin, ni dans `/api/sante` ; rien côté public.
  - Les tests existants passent tous ; seul le contrôle des colonnes de la table `articles` connaît la nouvelle colonne.
- **Contrôle de bout en bout de l'admin et des actualités** (`outils/admin/verifier-actus.mjs`, vrai serveur en local) : **236/236**.
- **Script d'installation** : syntaxe vérifiée (`bash -n`) ; les deux appels à Discord (contrôle et message d'essai) essayés contre un
  faux webhook local : bonne méthode, JSON valide, adresse jamais en argument.
- Fichiers du site : aucun modifié.

## Limites
- **Pas encore actif** : il faut créer le webhook et le ranger (ci-dessous). D'ici là, les publications se font comme avant.
- L'annonce est en **français** (titre et texte français de l'article).
- L'agent n'a pas pu essayer un vrai salon Discord (pas d'accès au réseau de Discord, et il ne voit jamais l'adresse) : le message
  d'essai du script sert de vérification.
- L'admin n'affiche pas encore si l'annonce est partie (le serveur renvoie l'information) : ce serait un petit lot sur le site.
- Publier un article prend jusqu'à quelques secondes de plus quand Discord est lent (8 s au plus).
- **Tag `lot-3c`** : créé en local ; son envoi sur GitHub est refusé par l'environnement de l'agent, comme pour les lots précédents.

## À faire toi-même (10 minutes)
1. **Discord** (sur ordinateur) : clic droit sur ton serveur → **Paramètres du serveur** → **Intégrations** → **Webhooks** →
   **Nouveau webhook** → choisir le salon des annonces → **Enregistrer** → **Copier l'URL du webhook**.
2. **Google Cloud** : console du projet `z-survival-website` → **Cloud Shell** (>_) → coller :
   ```bash
   bash <(curl -fsSL https://raw.githubusercontent.com/Nowyyy/Z-Survival-Website/main/serveur/deploiement/installer-gcp.sh) --discord
   ```
   puis coller l'adresse (rien ne s'affiche : normal) et accepter le **message d'essai** : il doit apparaître dans le salon.
3. **Essai réel** : dans l'admin, publier un article (un vrai, ou un essai à supprimer ensuite) : le message doit arriver dans le salon
   en quelques secondes, avec le titre, le début du texte, l'image et le lien. Le republier ne doit rien renvoyer.

## Retour du propriétaire (15/11/2026, branche `lot-3c-retours`)
- **Titre en français et en anglais avec drapeaux** : « 🇫🇷 Nouvelle carte : l’hôpital — 🇬🇧 New map: the hospital ». Sans titre anglais :
  « 🇫🇷 titre français » seulement. 256 caractères au plus (limite de Discord), partagés entre les deux langues.
- Première ligne bilingue « 📰 **Nouvelle actualité · New post** », **sans le lien** : Discord aurait ajouté sous la carte un second
  aperçu (celui du site, avec son image de partage). Le titre de la carte reste le lien vers l'article.
- Pied de carte « Z-Survival — Actualités · News ».
- Extrait : un titre (`#`) ou un élément de liste sans ponctuation finale est suivi d'un point (« La nuit tombe sur l’hôpital. Une nouvelle
  carte… » au lieu de « …l’hôpital Une nouvelle carte… »).
- **Aperçu** montré au propriétaire avant la mise en service : maquette fabriquée à partir du contenu exact que le serveur envoie
  (`messageArticle` de `serveur/src/discord.js`), avec et sans titre anglais.
- Tests du serveur : **65/65** (titre bilingue, ligne sans lien, ponctuation de l'extrait).

## État git
- Commits `lot-3c A` à `lot-3c D` sur la branche `lot-3c`, PR vers `main` fusionnée par l'agent (règle de `CLAUDE.md`). Le push sur `main`
  touche `serveur/` : le workflow « serveur » teste puis déploie le serveur sur Cloud Run (la migration 003 s'applique au démarrage).
