# Administration des actualités — mode d'emploi (téléphone)

Adresse : **https://zsurvival-game.com/admin/** (l'ancienne adresse https://nowyyy.github.io/Z-Survival-Website/admin/ y redirige)
(page non reliée au site et invisible pour les moteurs de recherche : ajoutez-la à vos favoris ou à l'écran d'accueil du téléphone).

Ce que vous écrivez ici apparaît dans la section **Actualités** du site, en français et, si vous le voulez, en anglais.

---

## 1. Se connecter
1. Ouvrir l'adresse ci-dessus.
2. Si un petit bandeau jaune **« Connexion au serveur… »** apparaît : c'est normal, le serveur dormait. Il se réveille en
   quelques secondes.
3. Taper votre **identifiant** et votre **mot de passe** (ceux choisis dans Cloud Shell), puis **Se connecter**.

- Message **« Identifiant ou mot de passe incorrect »** : l'un des deux est faux (par sécurité, la page ne dit pas lequel).
- Après **5 essais manqués en 15 minutes**, la connexion est **bloquée quelques minutes** (la page indique combien). Le blocage
  s'arrête tout seul : patientez, puis réessayez calmement.
- La connexion dure **2 heures**. Ensuite, la page revient à l'écran de connexion. Si vous étiez en train d'écrire, **votre texte
  est gardé** : reconnectez-vous et il revient (pensez alors à l'enregistrer).
- Fermer l'onglet vous déconnecte. Le bouton **Déconnexion** est en haut à droite.

## 2. Écrire un article
1. Toucher **Nouvel article**.
2. Onglet **Français** (obligatoire) : écrire le **titre**, puis le **texte**.
3. La petite barre au-dessus du texte met en forme : sélectionnez des mots (appui long), puis touchez :

   | Bouton | Effet | Ce qui s'écrit |
   |---|---|---|
   | **G** | gras | `**mots**` |
   | *I* | italique | `*mots*` |
   | **T** | intertitre (toute la ligne) | `## Intertitre` |
   | **•≡** | liste à puces (une puce par ligne) | `- élément` |
   | **↳•** | sous-puce, rangée sous la puce du dessus (un nouvel appui la remet en puce simple) | `  - sous-élément` (deux espaces avant le tiret) |
   | **Lien** | lien (la page demande l'adresse, qui doit commencer par `https://`) | `[mots](https://…)` |

   Une ligne vide sépare deux paragraphes. Aucun autre code n'est interprété : si vous collez du HTML, il s'affiche tel quel.
4. Onglet **English** (facultatif) : titre et texte en anglais. **Sans titre anglais**, le site anglais affiche la version
   française avec la petite mention **« (FR) »**.
5. **Adresse de l'article (slug)** : calculée toute seule depuis le titre français (`Nouvelle carte : l'hôpital !` →
   `nouvelle-carte-l-hopital`). C'est la fin de l'adresse partageable de l'article (`…/#actu/nouvelle-carte-l-hopital`).
   Vous pouvez la changer, mais **pas après avoir partagé l'article** (les liens déjà envoyés ne marcheraient plus).
6. **Date de publication** : laissez vide pour prendre la date du moment où vous publiez.
7. Toucher **Enregistrer le brouillon** : l'article est gardé mais **invisible sur le site**.

## 3. Ajouter une image
1. Écrire d'abord le titre français (il donne son nom au fichier).
2. **Choisir une image** : une photo de la galerie ou une image (JPEG, PNG ou WebP, **8 Mo au plus**). L'aperçu s'affiche.
   Sur iPhone, les photos HEIC sont converties automatiquement en JPEG par le téléphone.
3. Toucher **Envoyer l'image**. Le serveur :
   - la réduit (1600 pixels au plus de côté) et la convertit en WebP (fichier léger) ;
   - **retire les informations cachées de la photo** (position GPS, modèle du téléphone, date…) ;
   - l'enregistre dans le dépôt GitHub du site (`img/actus/…`).
4. **L'image apparaît sur le site environ une minute plus tard**, le temps que GitHub republie le site. Pendant cette minute,
   le site affiche un grand Z rouge à la place : c'est normal.
5. **Enregistrer** l'article (sinon l'image n'y est pas rattachée).

- **Remplacer l'image** : choisir une autre image, puis l'envoyer. **Retirer l'image** : l'article n'a plus d'image.
- **Réutiliser une image** (déjà envoyée pour un autre article) : toucher **Réutiliser une image**. Les images déjà envoyées
  s'affichent, avec les articles qui les utilisent. Toucher **Utiliser** : l'image est reprise telle quelle, **rien n'est
  republié** (elle est déjà en ligne). Puis **Enregistrer**.
- Si vous renvoyez par erreur une photo déjà envoyée, le serveur la reconnaît et reprend le fichier existant (pas de doublon).
- Une image qu'**aucun article n'utilise** (retirée ou remplacée) est marquée « Inutilisée » dans **Réutiliser une image**, avec
  un bouton **Supprimer** (après confirmation, elle disparaît du site d'ici une minute).
- Message « Envoi d'images pas encore configuré » : le jeton GitHub n'est pas rangé (voir « Jeton GitHub » plus bas).
  L'article peut être enregistré et publié sans image.

## 4. Prévisualiser
Toucher **Aperçu** : la carte de la liste et l'article complet, **exactement comme sur le site**. Les boutons **FR** et **EN**
montrent les deux versions (EN sans traduction : version française avec « (FR) »). **Fermer** pour revenir à l'éditeur.

## 5. Publier
Toucher **Publier**. L'article est enregistré puis mis en ligne : il apparaît dans la section Actualités **en une minute au
plus** (le serveur garde la liste en mémoire 60 secondes). Pour le voir : https://zsurvival-game.com/#news

- Modifier un article publié : changer le texte, puis **Enregistrer (reste publié)**.
- Si le bandeau d'alerte de l'accueil est un jour mis en service, il annonce le dernier article publié.
- **Annonce Discord** (lot 3c, une fois le webhook rangé : voir « Annonce Discord » plus bas) : à la **première** publication d'un
  article, un message part dans le salon Discord choisi : « 📰 Nouvelle actualité · New post », puis une carte avec le titre
  « 🇫🇷 titre français — 🇬🇧 titre anglais », le début du texte français puis celui du texte anglais (chacun avec son drapeau), l'image
  et le lien vers l'article. Sans version anglaise, seulement le français. **Une seule fois par
  article** : modifier, dépublier puis republier n'envoie rien de plus. Pour éviter une annonce : préparer l'article en brouillon et ne
  le publier que lorsqu'il est prêt.

## 6. Dépublier, supprimer
- **Dépublier** (après confirmation) : l'article disparaît du site et redevient un brouillon. Il peut être republié plus tard.
- **Supprimer l'article** (en bas, après confirmation) : définitif. **Son image est supprimée aussi** (elle disparaît du site
  d'ici une minute), **sauf si un autre article l'utilise** : elle est alors gardée. Le message après la suppression dit ce qu'il
  est advenu de l'image. Si GitHub ne répond pas, l'article est quand même supprimé et l'image, devenue « Inutilisée », pourra être
  supprimée plus tard depuis **Réutiliser une image**.
- Quitter l'éditeur (**← Articles**, fermer l'onglet…) avec des modifications non enregistrées : la page demande confirmation.

## 7. Liste des articles
Tous les articles, du plus récent au plus ancien, avec leur statut (**Publié** en rouge, **Brouillon** en pointillés jaunes) et
« FR seulement » s'il n'y a pas de version anglaise. Toucher un article pour l'ouvrir.

## 8. Page « À propos »
En haut de l'écran, au-dessus de la liste des articles : **Pages du site** → **Modifier la page « À propos »**.
1. La page s'ouvre avec les **textes actuels** du site (au premier passage, les textes d'origine), en **deux blocs**, dans l'ordre du
   site (lot 3e) :
   - **Bloc du jeu** : le **titre** (à l'origine « Le jeu ») et le **texte** à côté de l'image du jeu ;
   - **Bloc du studio** : le **titre**, c'est-à-dire la ligne en rouge sous le logo du studio (à l'origine « Un jeu de No Way Studio »),
     et le **texte** dessous.
2. Onglet **Français** (obligatoire pour les deux blocs) et **English** (facultatif, bloc par bloc) : titre et texte de chaque bloc,
   avec la même barre de mise en forme que les articles (gras, italique, intertitre, liste, lien). Sans titre anglais, le site anglais
   affiche le français de ce bloc avec « (FR) ». Si vous changez le français, pensez à l'anglais (il garde sinon l'ancien texte anglais).
3. **Aperçu** : la section telle qu'elle apparaîtra (les deux blocs), en FR et en EN.
4. **Enregistrer et publier** : seuls les blocs modifiés sont envoyés ; en ligne sur le site en **une minute au plus**. Le statut passe
   à « En ligne · date ».

- Seuls les **titres** et les **textes** des deux blocs changent : le grand titre « À propos » (« About us »), l'image du jeu, le logo du
  studio, le pied de page et l'entrée « 05 À propos » du menu restent tels quels.
- Si le serveur ne répond pas, le site affiche les textes d'origine (rien n'est cassé).

---

## Jeton GitHub (pour les images)
Le serveur enregistre les images dans le dépôt grâce à un **jeton GitHub** limité à ce dépôt. Il est rangé dans Google Secret
Manager (jamais dans le dépôt) et **expire au bout d'un an** : à renouveler.

**Créer (ou renouveler) le jeton** :
1. GitHub → photo de profil → **Settings** → **Developer settings** (tout en bas à gauche) → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**.
2. **Token name** : `Z-Survival images` ; **Expiration** : 1 an (*Custom* → date dans un an) ;
   **Repository access** : *Only select repositories* → **Nowyyy/Z-Survival-Website** seulement.
3. **Permissions** → **Repository permissions** → **Contents** : **Read and write** (rien d'autre).
4. **Generate token**, puis copier le jeton (`github_pat_…`) : GitHub ne le montre qu'une fois.

**Le ranger** : console Google Cloud (projet `z-survival-website`) → Cloud Shell (**>_**) → coller cette ligne, puis le jeton
(rien ne s'affiche quand vous collez : normal) :

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Nowyyy/Z-Survival-Website/main/serveur/deploiement/installer-gcp.sh) --jeton-github
```

Le script ne touche à rien d'autre. Il vérifie le jeton auprès de GitHub, le range et le donne au serveur.

Message **« GitHub refuse le jeton des images »** dans l'admin : jeton expiré ou révoqué → en créer un nouveau et le ranger.

## 9. Bandeau d'alerte de l'accueil (lot 3d)
En haut de l'écran : **Pages du site** → **Modifier le bandeau d’alerte** (sous « À propos »).
1. L'écran montre les **messages actuels**, dans l'ordre où ils défilent en bas de l'accueil, et un **aperçu** du bandeau (FR / EN).
   Le titre du **dernier article publié** passe tout seul en tête (« Dernière transmission : … ») : rien à faire pour lui.
2. Pour chaque message : texte **français** (obligatoire) et **anglais** (facultatif : sans lui, le site anglais affiche le français),
   160 caractères au plus, texte simple sur une ligne.
   - **Affiché** : décocher cache le message sans le supprimer (carte en pointillés) ;
   - **↑ Monter** / **↓ Descendre** : change l'ordre ;
   - **Supprimer** : retire le message de la liste.
3. **+ Ajouter un message** (30 au plus).
4. **Enregistrer et publier** : le serveur réécrit le fichier `contenus/bandeau.json` du dépôt (un commit « Z-Survival admin » sur
   `main`) ; le site est republié et les nouveaux messages sont sur l'accueil **environ une minute plus tard**.
   **Annuler les changements** revient aux messages enregistrés tant que vous n'avez pas enregistré.
- Si le bandeau a été modifié ailleurs pendant ce temps (autre onglet, ou directement sur GitHub), l'enregistrement est refusé pour ne rien
  écraser : revenez à **← Articles**, rouvrez le bandeau (il relit la dernière version) et refaites vos changements.
- Il faut le **jeton GitHub** (le même que pour les images, voir plus bas) : sans lui, l'écran affiche « pas encore configurée ».
- Aucun message affiché et aucun article publié : le bandeau disparaît de l'accueil.
- On peut toujours modifier le fichier à la main sur GitHub (`Docs/ref/contenus.md`) : l'admin relit le fichier à chaque ouverture.

## 10. Aperçu de partage (lot 3f)
Ce que montrent **Discord, WhatsApp et les réseaux sociaux** quand on partage `zsurvival-game.com` : un titre, une description et l'image de
l'accueil (fixe, `img/partage.jpg`). **Pages du site → Modifier l'aperçu de partage (Discord, WhatsApp…)** :
1. L'écran s'ouvre avec le titre et la description en ligne.
2. Changer le **titre** (90 caractères au plus) et la **description** (300 au plus) : texte simple, sur une ligne, en français (les réseaux
   n'affichent qu'une version). L'aperçu, à la manière de Discord, suit la frappe.
3. **Enregistrer et publier** : le serveur réécrit ces deux textes dans la page du site (`index.html`) ; en ligne **environ une minute** plus
   tard. **Annuler les changements** remet le texte en ligne.

- Discord et WhatsApp gardent souvent l'ancien aperçu en mémoire **quelques jours**. Pour voir le nouveau tout de suite, partager l'adresse
  avec un paramètre en plus, par exemple `https://zsurvival-game.com/?v=2`.
- Message « La page a été modifiée entre-temps » : le site a été mis à jour pendant que l'écran était ouvert ; revenir aux articles et
  rouvrir l'aperçu, puis refaire le changement.

## Annonce Discord (lot 3c)
Chaque article publié pour la première fois est annoncé dans un salon de votre serveur Discord, par un **webhook** (une adresse
secrète qui permet d'écrire dans ce salon, et seulement dans lui). Comme le jeton GitHub, elle est rangée dans Google Secret Manager,
jamais dans le dépôt.

**Créer le webhook** (sur ordinateur, avec le droit « Gérer les webhooks » sur le serveur Discord) :
1. Discord → clic droit sur votre serveur → **Paramètres du serveur** → **Intégrations** → **Webhooks** → **Nouveau webhook**.
2. Le renommer `Z-Survival` (le nom affiché vient de toute façon du serveur), choisir le **salon** des annonces (par exemple
   `#actualités`), **Enregistrer les modifications**.
3. **Copier l'URL du webhook** (`https://discord.com/api/webhooks/…`). Ne la collez nulle part ailleurs que dans le script ci-dessous :
   n'importe qui la possédant peut écrire dans le salon.

**La ranger** : console Google Cloud (projet `z-survival-website`) → Cloud Shell (**>_**) → coller cette ligne, puis l'adresse
(rien ne s'affiche quand vous collez : normal) :

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Nowyyy/Z-Survival-Website/main/serveur/deploiement/installer-gcp.sh) --discord
```

Le script vérifie l'adresse auprès de Discord (sans rien poster), propose un **message d'essai** dans le salon, la range et la donne au
serveur. Il ne touche à rien d'autre.

- **Changer de salon** : créer un nouveau webhook sur l'autre salon et refaire la même chose (l'ancienne adresse est remplacée).
- **Arrêter les annonces** : supprimer le webhook dans Discord (Intégrations → Webhooks). Les publications continuent normalement.
- **Adresse divulguée par erreur** : supprimer le webhook dans Discord (l'adresse ne marche plus), en créer un nouveau, le ranger.
- Si Discord est en panne au moment de publier, l'article est publié quand même ; l'annonce n'est pas partie. Pour la relancer :
  **Dépublier**, puis **Publier** à nouveau (un article jamais annoncé l'est à sa prochaine publication).
- Le message ne notifie personne (pas de `@everyone`, même écrit dans un titre). Pour prévenir les membres, régler les notifications
  du salon dans Discord.

## Pour le développeur
- Fichiers : `admin/index.html`, `admin/admin.js`, `admin/admin.css` ; partagés avec le site : `js/config.js` (adresse du
  serveur), `js/markdown.js` (Markdown sûr), `js/article.js` (carte et article), `css/actualites.css`, `js/textes.js` (`news.*`).
- Sécurité de la page : `Content-Security-Policy` stricte en tête de `admin/index.html` (scripts et styles du site seulement,
  connexions vers le serveur seulement, images du site ou `blob:`). **Changer l'adresse du serveur** (futur nom de domaine) :
  `js/config.js` **et** la directive `connect-src` de cette CSP (une règle de sécurité ne peut pas lire le JavaScript) ;
  `outils/admin/verifier-actus.mjs` échoue tant que les deux diffèrent.
- Jeton de connexion dans `sessionStorage` (onglet seulement), envoyé dans `Authorization: Bearer` ; fin comptée sur l'horloge de
  l'appareil (durée du jeton), pour qu'une horloge de téléphone décalée ne fausse pas l'expiration.
- Vérification de bout en bout : `node outils/admin/verifier-actus.mjs` (serveur local sur SQLite, API GitHub simulée).
