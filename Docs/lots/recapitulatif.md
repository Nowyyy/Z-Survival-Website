# Récapitulatif de tous les lots — site Z-Survival

État au 15/11/2026, après la PR #51. Site : **https://zsurvival-game.com/** · Admin : **https://zsurvival-game.com/admin/**
Dépôt : `Nowyyy/Z-Survival-Website` · Bilans détaillés : un fichier par lot dans `Docs/lots/`.

## En un coup d'œil

| Lot | Sujet | PR | Bilan |
|---|---|---|---|
| **0** | Squelette du site vitrine, puis 6 retours (DA du jeu, About us, page unique, langues FR/EN) | #1 → #8 | `lot-0.md`, `lot-0-retours.md` |
| **1b** | Musique : 3 propositions sur une planche d'écoute, **M2 retenue** | #9, #10 | `lot-1b.md` |
| **1** | Scène 3D de l'accueil (copie figée du jeu), **cadrage B retenu**, puis une dizaine de retours sur les poses | #11, #14 → #22, #33, #34 | `lot-1.md`, `lot-1-retours.md` |
| **2a** | Musique M2 intégrée au site, bouton de son | #12, #13 | `lot-2a.md` |
| — | Idées « accrocheuses » de l'accueil (flash au tir, entrée VHS, accroche radio, bandeau d'alerte) | #23 → #32, #35 → #37 | `Docs/ref/idees-accroche.md` |
| **3a** | Serveur (Google Cloud Run + base Turso + connexion admin) | #38, #42, #43 | `lot-3a.md` |
| **2b** | Accueil : vidéo en boucle de la scène, tir synchronisé, entrée VHS, encart « Disponible sur navigateur » | #39 → #41, #44 | `lot-2b.md` |
| **3b** | Page admin + vraies actualités + images des articles, puis bibliothèque d'images et page « À propos » modifiable | #45 → #47, #50, #51 | `lot-3b.md` |
| — | Nom de domaine **zsurvival-game.com** | #48, #49 | `nom-de-domaine.md` |

> Les lots ont été numérotés par thème, pas dans l'ordre : 1b avant 1, 3a avant 2b.

---

## Lot 0 — Squelette du site (PR #1 à #8)
- **Départ** : accueil plein écran, sections News / Characters / Weapons qui s'arrêtent à chaque écran, navigation (onglets en bas
  sur téléphone, colonne à droite sur ordinateur), contenus fictifs marqués en jaune, déploiement GitHub Pages automatique.
- **Retours** :
  - « Jouer » → étiquette **« Bientôt disponible »** ;
  - **direction artistique du jeu** : logo au Z rouge incliné, couleurs « sang noir », polices du jeu ;
  - section **About us** et logo de **No Way Studio** (animé dans About us) ;
  - **page unique** avec « En savoir plus » qui descend vers les actualités ;
  - **français / anglais** (globe), langue choisie selon le navigateur ;
  - encarts **« Prochainement » / « Coming soon »** sur Personnages et Armes.
- Règle adoptée : l'agent ouvre et fusionne lui-même les PR.

## Lot 1b — Musique : planche d'écoute (PR #9, #10)
- Analyse de la musique du menu du jeu (générée par du code, pas un fichier).
- Trois morceaux générés par script, en boucle parfaite : M1 (variation du menu), **M2 (ambiante, retenue)**, M3 (tension).
- Planche d'écoute `musique/planche.html` (non reliée au site).

## Lot 1 — Scène 3D de l'accueil (PR #11, puis retours #14 à #22, #33, #34)
- Copie figée de 62 fichiers du jeu (branche `dev`), jamais retouchés, dans `scene/jeu/`.
- Scène : cour du bâtiment, hélicoptère en feu, deux survivants et un zombie, poses construites à la main ; 3 cadrages sur une
  planche → **cadrage B** retenu.
- Retours : bras et pieds qui traversaient corrigés, **un coup de feu par boucle à 5,2 s**, tenues différentes, clin d'œil, zombie qui
  tend le bras vers le spectateur, personnage 1 en colère, page d'aperçu (la scène sous le vrai accueil).

## Lot 2a — Musique intégrée (PR #12, #13)
- M2 jouée sur le site, **toujours coupée au chargement**, bouton de son à côté de chaque globe (accueil et en-tête), fondu à
  l'activation, pause quand l'onglet est caché, choix gardé.
- « Bientôt disponible » en haut à droite de l'accueil.

## Idées « accrocheuses » de l'accueil (PR #23 à #32, #35 à #37)
- Flash du cadre rouge au coup de feu, entrée en scène (chute du Z du jeu + grain VHS), accroche « radio de survie » écrite lettre
  par lettre.
- **Bandeau d'alerte qui défile** : messages dans `contenus/bandeau.json`. **Toujours à l'essai** : visible seulement avec `?bandeau=1`.

## Lot 3a — Serveur (PR #38, correctifs #42, #43)
- Serveur Node.js sur **Google Cloud Run** (Francfort, 0 instance au repos pour le coût), base **Turso**.
- Connexion admin par identifiant et mot de passe (empreinte, jamais en clair), jeton de 2 heures, **blocage après 5 essais**.
- Secrets dans Google Secret Manager, rangés par un script à coller dans Cloud Shell (`installer-gcp.sh`), jamais dans le dépôt.
- Déploiement automatique à chaque modification de `serveur/` (workflow « serveur »).

## Lot 2b — Accueil vivant (PR #39 à #41, #44)
- La scène 3D devient une **vidéo en boucle** (16:9 sur ordinateur, 9:16 sur téléphone, moins de 2,5 Mo), affiche fixe en
  mouvement réduit.
- Tir synchronisé : flash du cadre et **coup de feu du jeu** (seulement si le son est activé) ; entrée VHS de 1,5 s à la première
  visite ; bouton « En savoir plus » avec coup de pinceau et coulure.
- Retours : HUD retiré, encart **« Disponible sur navigateur » / « Available on Browser »**, logo du studio plus grand.

## Lot 3b — Admin et actualités (PR #45 à #47, #50, #51)
- **Page admin** (téléphone d'abord) : connexion, liste des articles, éditeur FR (obligatoire) / EN (facultatif) avec barre de
  mise en forme, aperçu, brouillon / publier / dépublier / supprimer.
- **Actualités du site** : vraies cartes lues sur le serveur, article complet dans une fenêtre à l'adresse `#actu/…`, « (FR) » quand
  il n'y a pas d'anglais. Les actualités fictives sont retirées.
- **Images** : réduites, converties en WebP, **position GPS et infos de la photo retirées**, enregistrées dans le dépôt (`img/actus/`) ;
  en ligne environ une minute après l'envoi.
- Retours :
  - image **supprimée avec l'article** (sauf si un autre article l'utilise) ;
  - **bibliothèque** pour réutiliser une image sans la republier ;
  - page **« À propos » modifiable** : la ligne sous le logo (« Un jeu de No Way Studio ») et le texte ; encart jaune retiré.

## Nom de domaine (PR #48, #49)
- **zsurvival-game.com** (OVH) branché sur GitHub Pages, adresse principale sans `www` ; `www` et l'ancienne adresse github.io
  redirigent. Le serveur accepte les trois adresses.

---

## Ce qui est en place aujourd'hui
- Accueil : vidéo en boucle, tir, entrée VHS, musique M2 au clic, encart « Disponible sur navigateur ».
- Actualités : gérées depuis l'admin, avec images.
- Personnages et Armes : **encore provisoires**, sous l'encart « Prochainement ».
- À propos : ligne sous le logo et texte modifiables depuis l'admin ; logo animé, crédits, pied de page fixes.
- Français / anglais partout.

## Restant à faire ou à décider
- **Personnages** et **Armes** : contenu définitif (aucun lot prévu pour l'instant).
- **Bandeau d'alerte** : le mettre en service sur le site public ou non (il afficherait aussi le dernier article publié).
- **Bouton « Jouer »** : à remettre quand le jeu sera disponible (le lien est déjà dans `js/donnees.js`).
- **Jeton GitHub des images** : à renouveler dans environ 11 mois (marche à suivre dans `Docs/ref/admin.md`, « Jeton GitHub »).
- Facultatif : serveur sur `api.zsurvival-game.com` (permettrait une connexion admin par cookie, plus protégée).
- Tags `lot-N` : créés en local seulement, leur envoi sur GitHub est refusé par l'environnement de l'agent.
- Testé seulement dans Chromium : à vérifier sur iPhone et Android réels (liste dans `lot-2b.md`, « À tester »).
