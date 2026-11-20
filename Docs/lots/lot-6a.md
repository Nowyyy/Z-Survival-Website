# Lot 6a — Section Armes, en coulisses (stats en « Prochainement »)

Branche `armes-v1`. Objectif : préparer la vraie section Armes du site avec **toutes les armes du jeu**, sans la montrer aux visiteurs tant
que la mise à jour du jeu n'est pas sortie. Référence : `Docs/ref/armes.md` ; outils : `outils/armes/LISEZMOI.md`.

## Adresses d'aperçu
- **https://zsurvival-game.com/?apercu=armes#weapons** (téléphone et ordinateur ; `&lang=en` pour l'anglais).
- **https://zsurvival-game.com/scene-v2/apercu.html** : scène v2 derrière l'accueil **et** nouvelle section Armes plus bas (demande du
  propriétaire pendant le lot : « tout consulter au même endroit ») ; `scene-v2/apercu.html#weapons` ouvre directement la section Armes.
- Sans paramètre : rien ne change pour les visiteurs (encart « Prochainement » d'avant).

## Ce qui a été fait
- **A — Relevé et données** : `outils/armes/copier-armes.mjs` lit le jeu (branche `dev`, commit **`2f7716a`**, 2026-11-20, lecture seule,
  clone temporaire hors du dépôt), recopie tels quels les fichiers utiles dans `armes/jeu/` (modèles 3D en code, atlas, rendu Three.js du
  jeu, données des armes, couleurs, Three.js 0.186.1 ; `ORIGINE.json` : commit, fichiers, empreintes SHA-256, empreinte de chaque arme) et
  produit `contenus/armes.json` (id, nom du jeu, catégorie, famille, ordre, descriptions FR / EN, `aRelire`, `stats: null`). Relançable :
  il ne touche jamais aux descriptions, à l'ordre, au nom anglais ni aux stats, signale les armes ajoutées, modifiées (nom, catégorie,
  famille, modèle 3D) et disparues (rangées dans `retirees`, textes gardés), et les libellés à ajouter dans `js/textes.js`. Essayé :
  relance sans perte, et cas simulés « ajoutée / modifiée / disparue / revenue ». `armes-partie.json` du jeu (statistiques) est lu pour la
  catégorie et l'ordre seulement, **jamais recopié** ; `armes/jeu/` n'est pas publié.
- **B — Visuels** : `outils/armes/fabriquer-visuels.mjs` (Chromium sans écran + Three.js de la copie figée, page `outils/armes/rendu.html`)
  rend le vrai modèle de chaque arme (variante retenue par le propriétaire), vue de trois quarts du côté droit, lumière chaude et
  contre-jour rouge sang, fond transparent : `img/armes/<id>.webp` (1200 × 600, 10 à 18 Kio) et `<id>-mini.webp` (320 × 160, 3 à 6 Kio),
  **20 fichiers, 183 Kio en tout**. Encodage WebP par Chromium (ffmpeg laissait un alpha de 1 sur le fond, d'où un rectangle sombre
  autour de l'arme sur le site : corrigé avant le commit B).
- **C — Section** : `js/section-armes.js` et `css/section-armes.css`, chargés par `import()` dans `js/site.js` **seulement** si
  `SECTION_ARMES_ACTIVE` (seul réglage, `js/donnees.js`, **false**) ou `?apercu=armes`. Grand visuel (nom en filigrane, halo rouge, entrée
  animée sobre au changement d'arme), catégorie, compteur, nom en police de titre, description ; panneau de stats « Prochainement » (quatre
  barres décoratives identiques pour toutes les armes, floutées et grisées, aucun chiffre) ; miniatures rangées par famille (Poing,
  Épaule, Lourde, Spéciale), défilement au doigt, flèches, clavier ← →, glisser sur le visuel ; boutons `aria-pressed`, annonce
  `aria-live`, focus visible. Mouvement réduit : aucune animation. Libellés FR / EN dans `js/textes.js` (`weapons.categories`,
  `weapons.familles`, etc.). `scene-v2/apercu.html` : le site s'y ouvre avec `?apercu=armes` et se fait défiler (le blocage du
  défilement est retiré ; la scène ne se voit que derrière l'accueil, les autres sections ont leur propre fond).
- **D — Documentation** : `Docs/ref/armes.md` (origine, relance, modifier une description, ajouter les stats plus tard, publier),
  `outils/armes/LISEZMOI.md`, renvois dans `CLAUDE.md`, `Docs/ref/contenus.md`, `Docs/ref/scene-accueil-v2.md`, ligne du récapitulatif.

## Armes trouvées dans le jeu (10)
| Ordre | id | Nom | Catégorie (FR / EN) | Famille |
|---|---|---|---|---|
| 1 | `m1911` | Colt M1911 | Pistolet / Pistol | Poing |
| 2 | `kar98k` | Kar98k | Fusil à verrou / Bolt-action rifle | Épaule |
| 3 | `winchester1897` | Winchester M1897 | Fusil à pompe / Pump-action shotgun | Épaule |
| 4 | `thompson` | Thompson M1928 | Pistolet-mitrailleur / Submachine gun | Épaule |
| 5 | `garand` | M1 Garand | Fusil semi-automatique / Semi-automatic rifle | Épaule |
| 6 | `stg44` | StG 44 | Fusil d'assaut / Assault rifle | Épaule |
| 7 | `bar` | BAR M1918 | Fusil-mitrailleur / Automatic rifle | Épaule |
| 8 | `mg42` | MG42 | Mitrailleuse / Machine gun | Lourde |
| 9 | `panzerschreck` | Panzerschreck | Lance-roquettes / Rocket launcher | Spéciale |
| 10 | `m2lanceflammes` | Lance-flammes M2 (EN : M2 Flamethrower, à relire) | Lance-flammes / Flamethrower | Spéciale |

Ordre : celui de la table du jeu (montée en puissance). Le Panzerschreck et le lance-flammes ne sont pas encore utilisables dans le jeu
(armes spéciales) : ils sont présentés comme les autres ; les retirer ou les déplacer = changer leur `ordre` (ou demander un lot).

## Descriptions à relire (toutes `"aRelire": true` dans `contenus/armes.json`)
Aucun chiffre, ton « survie » ; vouvoiement comme le reste du site.
- **Colt M1911** — L’arme de départ, celle qu’on ne lâche jamais. Robuste et précise, elle suffit pour passer la première nuit… pas beaucoup plus. / *The starting sidearm, the one you never let go of. Sturdy and accurate, it will get you through the first night… not much further.*
- **Kar98k** — Un fusil à verrou d’une précision redoutable. Chaque balle compte : visez la tête, réarmez, recommencez. / *A deadly accurate bolt-action rifle. Every round counts: aim for the head, work the bolt, repeat.*
- **Winchester M1897** — Le fusil des tranchées. À bout portant, il vide un couloir entier ; plus loin, mieux vaut courir. / *The trench gun. Point-blank, it clears a whole corridor; any farther, you’d better run.*
- **Thompson M1928** — La « Tommy gun » crache un déluge de plomb. Exactement ce qu’il faut quand la horde passe la fenêtre. / *The Tommy gun spits out a storm of lead. Exactly what you need when the horde comes through the window.*
- **M1 Garand** — Semi-automatique et fiable : il tire aussi vite que vous pressez la détente. Le « ping » du clip éjecté annonce qu’il faut recharger. / *Semi-automatic and reliable: it fires as fast as you pull the trigger. The “ping” of the ejected clip tells you it’s time to reload.*
- **StG 44** — Le tout premier fusil d’assaut. Assez rapide pour tenir une porte, assez précis pour garder les morts à distance. / *The very first assault rifle. Fast enough to hold a doorway, accurate enough to keep the dead at bay.*
- **BAR M1918** — Un fusil-mitrailleur lourd, tiré à la hanche. Lent à manier, mais rien ne lui résiste longtemps. / *A heavy automatic rifle, fired from the hip. Slow to handle, but nothing stands in its way for long.*
- **MG42** — Une mitrailleuse au débit infernal. Quand elle se met à chanter, la horde ne passe plus. / *A machine gun with a hellish rate of fire. Once it starts singing, the horde stops coming.*
- **Panzerschreck** — Un lance-roquettes antichar, détourné de sa cible. Une roquette, et le groupe de zombies n’est plus qu’un souvenir. / *An anti-tank rocket launcher, put to a new use. One rocket, and that pack of zombies is just a memory.*
- **Lance-flammes M2** — Réservoirs sur le dos, lance au poing : un mur de feu entre vous et les morts. / *Tanks on your back, nozzle in hand: a wall of fire between you and the dead.*

## Vérifications (copie exacte de ce que publie le workflow, servie à la racine)
- `node outils/armes/verifier-armes.mjs` : **192/192** — 375 × 667, 320 × 568, 667 × 375, 1440 × 900, avec et sans mouvement réduit, FR et
  EN : interrupteur éteint = encart d'avant et **aucune requête** vers `img/armes/`, `contenus/armes.json`, `section-armes.*` ;
  `?apercu=armes` = 10 armes et miniatures chargées, stats sans aucun chiffre avec « Prochainement » / « Coming soon », textes traduits,
  aucun chevauchement, rien sous la barre de navigation, description jamais coupée, changement d'arme au toucher (téléphone) ou au clic,
  par la flèche et au clavier (← →, la page reste sur Armes) ; interrupteur allumé (simulé à la volée, fichier non modifié) = même rendu
  que l'aperçu (captures comparées pixel à pixel) ; aucune erreur console, aucun fichier manquant. Corrigé en route : à 320 × 568, la liste
  des miniatures passait sous la navigation (stats mises sur une ligne sur les écrans bas).
- Interrupteur éteint comparé à `main` (copie de `origin/main` à côté) : HTML de `#weapons` **identique** et capture **identique au
  pixel**, 375 et 1440 px, FR et EN.
- `node outils/armes/copier-armes.mjs --verifier` : `armes/jeu/` conforme à `ORIGINE.json` (15 fichiers).
- Reste du site inchangé : `outils/video/verifier-accueil.mjs` **174/174**, `outils/musique/verifier-site.mjs` **158/158**,
  `outils/admin/verifier-actus.mjs` **248/248** et `outils/admin/verifier-bandeau.mjs` **29/29** (après `npm ci` dans `serveur/`, absent du
  conteneur : `sharp` manquait), `outils/verifier-lot-4a.mjs` **87/87**, `outils/verifier-lot-4b.mjs` **26/26**,
  `outils/verifier-lot-3f.mjs` **32/32**. `scene-v2/outils/verifier.mjs` : **50/51** ; le seul écart est **attendu** : son contrôle
  « fichiers du site identiques à `origin/main` » (garde-fou du lot 5a) liste exactement les fichiers de ce lot (section Armes) ; l'aperçu
  `scene-v2/apercu.html` passe (390 × 844 et 1440 × 900, sans erreur ni fichier manquant).
- Interrupteur : `SECTION_ARMES_ACTIVE = false` vérifié avant la PR.

## Retours du propriétaire (après la PR #96, branche `armes-v1-retours`)
1. **Noms coupés** (« Lance- / flammes M2 », « Winchester M1… ») : un nom ne se coupe plus qu'entre deux mots ; en grand « Lance-flammes / M2 »,
   et sur les miniatures deux lignes au plus (« Winchester / M1897 », « Thompson / M1928 »), jamais tronqué.
2. **Lance-flammes et Panzerschreck en « Prochainement » jusqu'au bout** : champ `"prochainement": true` dans `contenus/armes.json`
   (réglage du propriétaire, jamais réécrit par l'outil ; proposé pour une arme que le jeu ne rend pas encore utilisable). Grand visuel en
   silhouette à liseré rouge avec l'encart « Prochainement » ; gros **?** rouge sur leur miniature (silhouette aussi).
3. **« Épaule » remplacée** par des familles plus fines : Poing, **Carabine** (Kar98k, M1 Garand), **Pompe** (Winchester),
   **Mitraillette** (Thompson), **Fusil d'assaut** (StG 44, BAR M1918), Lourde (MG42), Spéciale. La famille devient un réglage du
   propriétaire (`"famille"`), proposée d'après la catégorie pour une arme nouvelle. Le BAR (fusil-mitrailleur) est rangé avec les fusils
   d'assaut : `"famille": "lourde"` le mettrait avec la MG42.
4. **Chapitres** : chaque arme a `"chapitres": [1]`, liste `"chapitres"` en tête du fichier (nom facultatif) ; sélecteur « Chapitre 1 » dans
   l'en-tête de la section, qui n'affichera que les armes du chapitre choisi quand il y en aura plusieurs (`Docs/ref/armes.md`).
- En route : l'outil s'arrête désormais si `contenus/armes.json` est illisible (avant, il l'aurait recréé sans les descriptions : vu lors
  d'un essai, rien de perdu) ; une règle CSS mettait toutes les miniatures en silhouette quand une arme à venir était choisie (corrigé).
- Vérifications : `node outils/armes/verifier-armes.mjs` **272/272** (deux passages ; contrôles ajoutés : « ? » et silhouette seulement sur
  les deux armes à venir, arme à venir choisie sans toucher aux autres miniatures, sélecteur de chapitre, noms ni coupés ni tronqués) ;
  interrupteur éteint toujours identique (aucun fichier de la section téléchargé) ; `copier-armes.mjs --verifier` conforme.

## Retours du propriétaire, deuxième série (branche `armes-v1-retours-2`)
1. **Nom en filigrane qui dépassait** derrière l'arme : deux lignes au plus, coupé entre deux mots, taille calculée sur le cadre (unités de
   conteneur) d'après la largeur du mot le plus long mesurée dans la police des titres. Un premier essai qui mesurait la page en
   JavaScript se déréglait pendant les redimensionnements ; remplacé par ce calcul en CSS.
2. **Lance-roquettes et lance-flammes** : « avec la forme et le nom, on sait ce que c'est » → plus de silhouette ni de nom : grand encart
   « Prochainement » (gros « ? » en filigrane), nom « ? ? ? », catégorie « Arme à venir » / « Upcoming weapon », texte neutre ; leurs images
   ne sont plus jamais téléchargées par la page.
3. **Miniatures de ces deux armes** : juste un gros « ? » (ni forme noire, ni nom).
- Vérifications : `node outils/armes/verifier-armes.mjs` **312/312** (contrôles ajoutés : miniature réduite au « ? », arme à venir choisie
  sans forme ni nom ni texte qui la trahisse, images des armes à venir jamais demandées, filigrane de chaque arme sur deux lignes au plus et
  dans le cadre, aux quatre tailles).

## Publication et page « Armes » de l'admin (branche `armes-publiees`, demande du propriétaire)
« Je veux que ce lot puisse apparaître sur le site dès maintenant. Par défaut, toutes les armes en « ? ». Une page dans l'admin pour les
activer comme je veux, rédiger les descriptions en français et en anglais, mettre à jour les statistiques ou les masquer. »
- **Site** : `SECTION_ARMES_ACTIVE = true` (section publiée) ; les dix armes `"prochainement": true` (des « ? ») et statistiques masquées
  par défaut. Une arme affichée avec `"statsVisibles": true` montre ses **vraies barres** (0 à 100, sans chiffre ; lecteurs d'écran :
  « Dégâts : 35 sur 100 ») ; sinon les barres décoratives sous « Prochainement ».
- **Serveur** (`serveur/src/armes.js`, commit à part) : `GET/PUT /api/admin/armes`, même principe et même jeton que le bandeau : réécrit
  dans `contenus/armes.json` les quatre réglages (affichée, descriptions, stats, stats affichées) des armes envoyées, garde tout le reste,
  même mise en forme que `copier-armes.mjs` (test qui le compare au vrai fichier) ; 409 si le fichier a changé ; description changée →
  `aRelire: false`. Tests : **94/94** (`npm test` dans `serveur/`, dont 9 nouveaux).
- **Admin** : « Pages du site → Modifier les armes (affichage, descriptions, statistiques) » : une fiche par arme (miniature, nom,
  catégorie, « Afficher sur le site », descriptions FR / EN avec compteur, quatre statistiques 0 à 100 avec leur barre, « Afficher les
  statistiques »), « Tout afficher » / « Tout cacher », « Voir la section sur le site », « Annuler les changements », « Enregistrer et
  publier » ; texte gardé si la session expire ; mode d'emploi `Docs/ref/admin.md` (section 11).
- `copier-armes.mjs` garde aussi `statsVisibles` (nouvelles armes : `false`).
- Vérifications : `outils/admin/verifier-armes-admin.mjs` **25/25** (banc local : lecture, affichage, descriptions, stats, refus des
  stats affichées sans valeur, commit « Z-Survival admin », reste du fichier intact, la section du site montre l'arme et ses vraies barres,
  conflit refusé, annuler, 320 / 375 / 1440 px, zones de toucher de 44 px, aucun secret dans le journal) ; `outils/armes/verifier-armes.mjs`
  **324/324** (interrupteur simulé dans chaque cas, données de test fixes pour ne pas dépendre des réglages de l'admin, plus un cas « tel que
  publié » : dix « ? », aucune image d'arme secrète demandée) ; reste du site : accueil **174/174**, musique **158/158** (son contrôle « encart Prochainement » suit maintenant l'interrupteur :
  seule Personnages le garde), actualités **248/248**, bandeau **29/29** (« Pages du site » : les trois premiers boutons inchangés, « Armes »
  ajouté après), lot 3f **32/32**, lot 4a **87/87**, lot 4b **26/26**.
- Ordre de mise en ligne : le serveur se déploie tout seul (`serveur.yml`, le commit touche `serveur/`) en même temps que le site ; tant
  qu'il n'est pas redéployé, la page « Armes » de l'admin affiche une erreur (« Introuvable »), le site, lui, fonctionne (il lit le fichier).

## Limites
- Les images de `img/armes/` et `contenus/armes.json` sont publiés avec le site : une arme cachée n'est jamais montrée par la page (ni ses
  images téléchargées), mais **quelqu'un qui ouvre ces fichiers à la main peut lire son nom et sa description** (et voir son image).
  Pour un vrai secret, il faudrait garder les brouillons sur le serveur et n'écrire dans le fichier que les armes affichées (à décider).
- Visuels dans le style « low poly » des modèles du jeu (pièces épaissies ×1,8 par le jeu pour la vue de dessus) : fidèles au jeu, pas des
  rendus détaillés. Le lance-flammes est montré avec ses réservoirs placés comme portés sur le dos.
- Les noms des armes viennent du jeu, en français seulement : seul le lance-flammes a un nom anglais (`nomEn`, à relire).
- Toutes les barres de stats sont décoratives et identiques : elles ne disent rien des armes. Le jour des vraies stats : `Docs/ref/armes.md`.

## État git
- Commits `lot-6a A` à `lot-6a E` sur `armes-v1`, PR vers `main` fusionnée par l'agent (règle de `CLAUDE.md`) : rien n'est visible des
  visiteurs (interrupteur éteint).
- Tag `lot-6a` créé en local ; **son push est refusé par l’environnement** (« the remote end hung up unexpectedly »), comme pour les lots précédents.
