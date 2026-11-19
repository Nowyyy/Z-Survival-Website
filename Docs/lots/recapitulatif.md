# Récapitulatif de tous les lots — site Z-Survival

État au 15/11/2026 au soir, après la PR #77 (aucune PR ouverte). Site : **https://zsurvival-game.com/** · Admin : **https://zsurvival-game.com/admin/**
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
| **4a** | Finitions : aperçu de partage, icônes, référencement, titre en paysage, boutons à 44 px ; À propos en deux blocs (jeu, studio) | #56 | `lot-4a.md` |
| **3c** | Serveur : annonce Discord de chaque actualité publiée (titre et début du texte FR + EN, drapeaux) | #59 → #61 | `lot-3c.md` |
| **3d** | Admin : messages du bandeau d'alerte, écrits dans `contenus/bandeau.json` par le serveur | #65 | `lot-3d.md` |
| **3e** | À propos : bloc du jeu (titre et texte) modifiable depuis l'admin, comme le studio | #67 | `lot-3e.md` |
| **4b** | À propos : clip du vrai jeu (le survivant tire sur des zombies, 8 s en boucle), puis 3 retours sur le pilotage | #71, #72, #75, #77 | `lot-4b.md` |
| **3f** | Admin : texte de l'aperçu de partage modifiable ; nouveau texte ; encart de l'accueil en mode application ; e-mail de contact | voir `lot-3f.md` | `lot-3f.md` |
| — | Scène de l'accueil : retours 11 à 19 (zombie, militaire, détails, deuxième tir), vidéos refaites | #55, #57, #62, #63, #66, #68 → #70, #73 | `lot-1-retours.md` |
| — | Petits ajouts hors lot : lien Discord, « Pages du site » en haut de l'admin, bandeau en service, serveur limité au domaine, À propos plus aéré, indice « Défiler », carrousel des actualités | #53, #54, #57, #58, #64, #74, #76 | voir plus bas |

> Les lots ont été numérotés par thème, pas dans l'ordre : 1b avant 1, 3a avant 2b, 4a avant 3c.
> Depuis la PR #52, **deux sessions de l'agent ont travaillé en parallèle** : l'une sur la scène de l'accueil, les actualités et À propos
> (indice « Défiler »), l'autre sur les lots 4a, 3c, 3d, 3e et 4b. Chacune rebasait sur `main` avant de fusionner ; aucun conflit.

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

## Lot 4a — Finitions après le nom de domaine (PR #56)
- **Aperçu de partage** (Discord, WhatsApp…) : titre, description et image 1200 × 630 tirée de l'accueil, avec le logo.
- **Icônes** : favicon, icône d'iPhone et d'Android, manifeste, tirées du Z rouge du logo ; mêmes icônes sur l'admin.
- **Référencement** : une seule page indexée (la page d'accueil), `robots.txt`, `sitemap.xml`, canonique fixe, données structurées
  (jeu, studio, site), rien d'inventé. Mode d'emploi Google Search Console : `Docs/ref/referencement.md`.
- **Téléphone en paysage** : le titre ne touche plus la rangée du haut. **Boutons de l'en-tête** : zone de clic de 44 × 44 px.
- **À propos** (demande pendant le lot) : bloc du jeu au-dessus du bloc du studio ; puis plus d'espace entre les deux et logo du studio
  agrandi (#64).

## Lot 3c — Annonce Discord des actualités (PR #59 à #61)
- À la **première** publication d'un article, le serveur poste dans un salon Discord : « 📰 Nouvelle actualité · New post », puis une
  carte avec le titre « 🇫🇷 … — 🇬🇧 … », le début du texte français puis anglais, l'image et le lien vers l'article.
- Une seule fois par article ; aucune mention qui notifie ; un échec de Discord n'empêche jamais la publication.
- Webhook rangé dans Secret Manager par `installer-gcp.sh --discord` (fait par le propriétaire le 15/11).
- Incident du 15/11 (19 h 27 à 20 h 45 environ) : le serveur ne répondait plus. Cause côté Google Cloud (limite budgétaire réglée à 0 €,
  relevée à 1 € par le propriétaire), pas le code ; le serveur est reparti au déploiement suivant.

## Lot 3d — Bandeau d'alerte depuis l'admin (PR #65)
- **Pages du site → Bandeau d'alerte** : textes FR / EN, affiché ou caché, ordre, ajout, suppression, aperçu.
- Le serveur réécrit `contenus/bandeau.json` dans le dépôt (commit « Z-Survival admin »), avec le jeton GitHub des images ; l'accueil est à
  jour une minute plus tard. Refus clair si le fichier a été modifié ailleurs entre-temps.
- Le bandeau est **en service** sur le site public depuis la PR #57 (`?bandeau=0` le cache) ; le dernier article publié passe en tête.

## Lot 3e — À propos : les deux blocs modifiables (PR #67)
- L'écran « À propos » de l'admin montre **le bloc du jeu** (titre, texte) puis **le bloc du studio** (ligne sous le logo, texte), en
  français et en anglais, avec aperçu ; seuls les blocs modifiés sont enregistrés (pages `a-propos-jeu` et `a-propos` du serveur).

## Lot 3f — Aperçu de partage depuis l'admin, contact, encart
- **Pages du site → Aperçu de partage** : titre et description montrés par Discord / WhatsApp, réécrits dans `index.html` par le serveur.
- Nouveau texte : « La nuit tombe, les morts se relèvent. Serez-vous en mesure de survivre ? Z-Survival, Top-Down Shooter avec une dose de
  gacha par No Way Studio, bientôt disponible sur navigateur. »
- Accueil sur iPhone en mode application : l'encart « Disponible sur navigateur » ne mord plus sur le titre.
- Pied de page : **contact@zsurvival-game.com** (lien mailto), aussi dans les données structurées du studio.

## Lot 4b — Clip du vrai jeu dans À propos (PR #71, retours #72, #75, #77)
- Le bloc « Le jeu » montre un **clip de 8 s en boucle tiré du vrai jeu** (branche `dev`, copie en lecture seule), fabriqué par
  `outils/clip-jeu/fabriquer.mjs` : 800 × 450, sans son, environ 400 Kio, posé sur son affiche ; chargé seulement en arrivant sur À propos,
  en pause hors de l'écran, affiche seule en mouvement réduit.
- Retours du propriétaire : le survivant se déplace (#72) ; visée « à la souris » (temps de réaction, geste rapide qui dépasse souvent la
  cible, correction, suivi) et déplacement d'un vrai joueur (#75) ; allure modérée, direction tenue vers là où il n'y a pas de zombie,
  toujours le plus proche (#77).
- Les rares images assombries par le rendu logiciel (carte d'ombres du jeu) sont réparées automatiquement.

## Scène de l'accueil : retours 11 à 19 (PR #55, #57, #62, #63, #66, #68 à #70, #73)
- Zombie corrigé (épaules, bras qui griffe, bouche qui s'ouvre quand il tend le bras), **personnage 2 en militaire**, zombie tourné vers le
  personnage 1.
- Détails validés et mis en ligne (#73) : rotor de queue qui tourne, hélicoptère en métal, flammes des lampes, coups d'œil des personnages,
  **tir du personnage 2 à 2,6 s** (le zombie retombe, tête au sol) ; vidéos de l'accueil refaites.
- Sur le site : **flash du cadre rouge et coup de feu aux deux tirs** (`TEMPS_TIRS` : 2,6 et 5,2 s, `js/accueil-boucle.js`) ; affiche à 1,9 s.
- Détails : `Docs/lots/lot-1-retours.md`.

## Petits ajouts hors lot
- **Lien Discord** (logo) entre « Bientôt disponible » et le bouton de son, sur l'accueil et dans l'en-tête (#54).
- **Admin** : « Pages du site » au-dessus de la liste des articles (#53).
- **Serveur** limité à `https://zsurvival-game.com` (les anciennes adresses redirigent) et actions GitHub à jour, Node.js 24 (#58).
- **À propos sur téléphone** : dégradé et pastille « Défiler » tant que la section dépasse de l'écran ; flèches et Page suivante / précédente
  parcourent une section haute au clavier (#74).
- **Actualités sur téléphone** : position « 01 / 02 », barre de progression et flèches sous le carrousel ; bloc « Rejoindre le Discord » en
  bas de la section (#76).
- **À propos sur téléphone, retours du propriétaire** (« le défilement me ramène en haut de la partie », #80 à #82, puis carrousel) :
  la pastille « Défiler » laisse passer le toucher ; crédits « Création Nowy » retirés. Safari gérait mal l'aimantation des sections
  avec une section plus haute que l'écran : ni des points d'aimantation intérieurs (#80), ni un défilement à l'intérieur de la section
  (#81, avec rattrapage des gestes rapides #82) n'ont suffi sur iPhone (retour en haut, puis gestes rapides ignorés). Solution retenue,
  à la demande du propriétaire : **sur téléphone, les deux blocs forment un carrousel horizontal, comme les actualités** (le studio à
  droite du jeu, position « 01 / 02 », barre et flèches ; en paysage, sans cette ligne) ; image, logo et texte resserrés sur les écrans
  bas, pour que la section tienne dans l'écran, sans défilement vertical (vérifié de 540 à 940 px de haut en portrait, et en paysage).
  #81 et #82 annulés. Ordinateur inchangé. Un texte d'À propos beaucoup plus long (admin) pourrait de nouveau dépasser de l'écran.
- **Pastille « Défiler » retirée** (dégradé et flèche en bas des sections plus hautes que l'écran), à la demande du propriétaire : À propos
  tient maintenant dans l'écran sur téléphone. Les touches du clavier parcourent toujours une section haute avant de passer à la voisine.
- **Molette qui ramenait parfois vers le bas** (retour du propriétaire, ordinateur) : sur un écran bas (fenêtre de 860 px de haut ou moins,
  la plupart des portables), À propos dépassait de l'écran (jusqu'à 230 px), et l'aimantation des sections se trompait de sens. Sur ces
  écrans, À propos prend aussi le carrousel (flèches et « 01 / 02 ») ; sur un écran plus haut, les blocs restent l'un sous l'autre. Toutes
  les sections tiennent dans l'écran à partir de 600 px de haut (Personnages dépasse encore un peu en dessous).
- **Molette, suite** (passage rapide de Personnages à Actualités, puis cran vers le haut avant la fin du mouvement : retour vers le bas) :
  le navigateur choisissait la section la plus proche pendant que la page se calait encore. Le script prend la molette en main
  (`js/site.js`) : un geste va toujours à la section voisine dans le sens de la molette, comptée depuis la section visée si la page bouge
  encore ; molette tournée sans pause : une section toutes les 450 ms environ ; élan d'un pavé tactile : une section ; molette horizontale
  (carrousels) et zoom laissés au navigateur. Le défilement au doigt (téléphone) n'est pas concerné.
- **Sous-puces dans l'admin** (demande du propriétaire) : une puce précédée de deux espaces (`  - sous-élément`) se range sous la puce du
  dessus (rond vide, puis carré au troisième niveau, trois niveaux au plus) ; bouton **↳•** dans la barre de mise en forme (articles et
  page « À propos »), qui décale la ligne ou la remet en puce simple. Mode d'emploi : `Docs/ref/admin.md`. Au clavier, **Tab** décale une
  puce et **Maj + Tab** la remonte (dans le texte seulement ; ligne ordinaire ou Échap puis Tab : champ suivant).

---

## Ce qui est en place aujourd'hui
- **Accueil** : vidéo en boucle de la scène (deux tirs, flash du cadre et coup de feu son activé), entrée VHS, accroche radio, musique M2 au
  clic, encart « Disponible sur navigateur », **bandeau d'alerte en service**, lien Discord.
- **Actualités** : gérées depuis l'admin (images comprises), carrousel sur téléphone, **annonce Discord** à chaque nouvel article.
- **Personnages** et **Armes** : encore provisoires, sous l'encart « Prochainement ».
- **À propos** : bloc du jeu (clip du vrai jeu) et bloc du studio (logo animé), titres et textes modifiables depuis l'admin,
  pied de page (plus de crédits).
- **Admin** (https://zsurvival-game.com/admin/) : articles, images et bibliothèque, page « À propos » (deux blocs), bandeau d'alerte.
- **Adresse** https://zsurvival-game.com/, aperçu de partage, icônes, référencement ; français / anglais partout.
- **Serveur** : Cloud Run (Francfort, 0 instance au repos) + Turso ; secrets dans Secret Manager (jeton GitHub des images, webhook Discord).

## À faire ou à vérifier par le propriétaire
- **Partager** https://zsurvival-game.com/ dans Discord ou WhatsApp pour voir l'aperçu (cache possible quelques jours).
- **Google Search Console** (facultatif) : pas à pas dans `Docs/ref/referencement.md`.
- **Admin → À propos** : vérifier que le texte du studio parle du studio (le bloc du jeu décrit déjà le jeu).
- **Téléphones réels** (iPhone, Android) : vidéo de l'accueil et clip d'À propos (mode économie d'énergie : affiche fixe), son, rotation.
- **Budget Google Cloud** : le garder au-dessus de 0 € (le projet coûte quelques centimes par mois, couverts par le crédit d'essai).

## Restant à faire ou à décider
- **Personnages** et **Armes** : contenu définitif (aucun lot prévu pour l'instant).
- **Bouton « Jouer »** : à remettre quand le jeu sera disponible (le lien est déjà dans `js/donnees.js`).
- **Jeton GitHub des images** (aussi utilisé par le bandeau) : à renouveler dans environ 11 mois (`Docs/ref/admin.md`, « Jeton GitHub »).
- **Clip d'À propos** : à refaire si le jeu change (`node outils/clip-jeu/fabriquer.mjs`, environ 7 minutes).
- Facultatif : serveur sur `api.zsurvival-game.com` (connexion admin par cookie, plus protégée) ; pages de partage par article (aujourd'hui
  un lien `#actu/…` montre l'aperçu général du site).
- Tags `lot-N` : créés en local seulement, leur envoi sur GitHub est refusé par l'environnement de l'agent.
