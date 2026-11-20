# Section Armes — référence (lot 6a)

La vraie section Armes du site présente **toutes les armes du jeu**, une à la fois : grand visuel, nom, catégorie, courte description,
et une liste de miniatures pour passer de l'une à l'autre. Les **statistiques restent en « Prochainement »** : aucun chiffre n'est affiché.
Elle est **en coulisses** tant que la mise à jour du jeu n'est pas sortie : les visiteurs voient toujours l'ancien encart « Prochainement ».

## L'interrupteur
- **Un seul endroit** : `js/donnees.js`, constante `SECTION_ARMES_ACTIVE` (aujourd'hui `false`).
- **Éteint** : la section Armes est strictement celle d'avant (contenu provisoire atténué sous l'encart « Prochainement ») et **aucun
  fichier de la nouvelle section n'est téléchargé** : ni `js/section-armes.js`, ni `css/section-armes.css`, ni `contenus/armes.json`, ni
  les images de `img/armes/` (le module est chargé par un `import()` dynamique dans `js/site.js`, seulement quand il est demandé).
- **Aperçu pour le propriétaire**, interrupteur éteint : ajouter `?apercu=armes` à l'adresse, sur téléphone comme sur ordinateur :
  **https://zsurvival-game.com/?apercu=armes#weapons**. Rien d'autre ne change (le paramètre reste dans l'adresse quand on navigue).
  Il se combine avec les autres : `?apercu=armes&lang=en#weapons`.
- **Tout au même endroit** : **https://zsurvival-game.com/scene-v2/apercu.html** (scène v2 de l'accueil, en coulisses) ouvre le site avec
  `?apercu=armes` et se fait défiler jusqu'à la section Armes ; `scene-v2/apercu.html#weapons` y va directement, `?armes=0` montre la
  section actuelle.
- **Publier la section** : passer la constante à `true`, puis fusionner sur `main` (le site est republié en une minute environ). Rien
  d'autre à faire.

> Limite : les images de `img/armes/` et `contenus/armes.json` sont publiés avec le site. Rien n'y mène tant que l'interrupteur est éteint,
> mais quelqu'un qui connaît leur adresse peut les ouvrir (comme `scene-v2/`).

## D'où viennent les armes
- Jeu `Nowyyy/Z-Survival`, branche **`dev`** (jamais `main`), lu en lecture seule dans un clone temporaire hors du dépôt.
  Premier relevé : commit **`2f7716a`** (« Merge pull request #179 from Nowyyy/lot-9h », 2026-11-20).
- Dans le jeu : `data/armes/armes.json` (modèles 3D en code du lot 9c : nom, genre, classe, dimensions, variantes),
  `data/armes/armes-choix.json` (variante retenue par le propriétaire : « a » partout), `data/i18n/fr.json` (`game.armes.<id>` : nom
  affiché), `data/game/armes-partie.json` (catégorie et ordre de montée en puissance ; **contient les statistiques : jamais recopié**).
- `armes/jeu/` : copie figée (fichiers tels quels, jamais publiés), origine et empreintes dans `armes/jeu/ORIGINE.json`.
- Outils : `outils/armes/` (mode d'emploi détaillé : `outils/armes/LISEZMOI.md`).

| Ordre | id | Nom (jeu) | Catégorie | Famille | Chapitre | Prochainement |
|---|---|---|---|---|---|---|
| 1 | `m1911` | Colt M1911 | pistolet | Poing | 1 | |
| 2 | `kar98k` | Kar98k | fusil à verrou | Carabine | 1 | |
| 3 | `winchester1897` | Winchester M1897 | fusil à pompe | Pompe | 1 | |
| 4 | `thompson` | Thompson M1928 | pistolet-mitrailleur | Mitraillette | 1 | |
| 5 | `garand` | M1 Garand | fusil semi-automatique | Carabine | 1 | |
| 6 | `stg44` | StG 44 | fusil d'assaut | Fusil d'assaut | 1 | |
| 7 | `bar` | BAR M1918 | fusil-mitrailleur | Fusil d'assaut | 1 | |
| 8 | `mg42` | MG42 | mitrailleuse | Lourde | 1 | |
| 9 | `panzerschreck` | Panzerschreck | lance-roquettes | Spéciale | 1 | oui |
| 10 | `m2lanceflammes` | Lance-flammes M2 (anglais : M2 Flamethrower) | lance-flammes | Spéciale | 1 | oui |

**Familles** (retour du propriétaire : « Épaule » était trop vaste) : `poing`, `carabine`, `pompe`, `mitraillette`, `assaut` (fusil d'assaut),
`lourde`, `speciale` ; libellés FR / EN dans `weapons.familles` de `js/textes.js`. La liste des miniatures est rangée par famille (petit
titre au-dessus de chaque groupe), dans l'ordre où chaque famille apparaît, puis par `ordre` : Poing, Carabine (Kar98k, M1 Garand), Pompe,
Mitraillette, Fusil d'assaut (StG 44, BAR M1918), Lourde, Spéciale. La famille se règle arme par arme dans `contenus/armes.json` (le BAR,
fusil-mitrailleur, est rangé avec les fusils d'assaut ; `"famille": "lourde"` le mettrait avec la MG42). Nouvelle famille : ajouter son
libellé dans `weapons.familles` (français et anglais) et, si besoin, sa place dans `FAMILLES` de `js/section-armes.js`.

**Armes « prochainement »** (`"prochainement": true` ; retour du propriétaire : le lance-flammes et le Panzerschreck, pas encore utilisables
dans le jeu, restent marqués « Prochainement » jusqu'au bout, même une fois la section publiée) : grand visuel en silhouette sombre à liseré
rouge avec l'encart « Prochainement », gros « ? » rouge sur la miniature (silhouette elle aussi), mention dans le nom accessible. Nom,
catégorie et description restent affichés. Pour la dévoiler : `"prochainement": false`.

**Chapitres** (prévu pour plus tard : choisir un chapitre pour n'afficher que ses armes ; aujourd'hui le chapitre 1) : chaque arme a
`"chapitres": [1]` ; la liste `"chapitres"` en tête du fichier donne les chapitres connus, avec un nom facultatif. Un sélecteur dans
l'en-tête de la section (« Chapitre 1 » / « Chapter 1 ») montre les armes du chapitre choisi ; le dernier chapitre de la liste est affiché
d'abord. Ajouter un chapitre : `{ "id": 2, "nom": { "fr": "…", "en": "…" } }` dans `"chapitres"` (sans nom : « Chapitre 2 »), puis `2` dans
les `"chapitres"` des armes concernées (une arme peut être dans plusieurs chapitres : `[1, 2]`). Un chapitre sans arme n'est pas proposé.

**Noms** : un nom ne se coupe qu'entre deux mots (« Lance-flammes / M2 », « Winchester / M1897 » sur les miniatures, deux lignes au plus),
jamais au milieu d'un mot ni tronqué.

## Après une évolution des armes du jeu

```bash
node outils/armes/copier-armes.mjs
```

```bash
node outils/armes/fabriquer-visuels.mjs
```

1. `copier-armes.mjs` refait la copie figée, met à jour `contenus/armes.json` et affiche les armes **ajoutées**, **modifiées** (nom,
   catégorie, modèle 3D, arme devenue utilisable dans le jeu) et **disparues**. Il ne touche jamais aux descriptions, à la famille, à
   l'ordre, aux chapitres, à « prochainement », au nom anglais ni aux stats. Une arme nouvelle reçoit une famille proposée d'après sa
   catégorie, le dernier chapitre, et `"prochainement": true` si le jeu ne la rend pas encore utilisable. Fichier illisible : l'outil
   s'arrête sans rien écrire.
   `--essai` montre ce qui changerait sans rien écrire.
2. S'il le signale : ajouter les libellés de catégorie ou de famille dans `js/textes.js` (`weapons.categories`, `weapons.familles`,
   français **et** anglais) ; écrire les descriptions des armes ajoutées.
3. `fabriquer-visuels.mjs` refait les images (`--armes=id1,id2` pour quelques armes seulement).
4. Vérifier : `?apercu=armes#weapons`, puis `node outils/armes/verifier-armes.mjs`.

## Modifier une description (ou l'ordre, le nom anglais) — `contenus/armes.json`

```json
{
  "id": "kar98k", "nom": "Kar98k", "nomEn": null, "categorie": "fusil-a-verrou", "famille": "carabine", "ordre": 2, "aRelire": true, "stats": null, "chapitres": [1], "prochainement": false,
  "description": {
    "fr": "Un fusil à verrou d’une précision redoutable. Chaque balle compte : visez la tête, réarmez, recommencez.",
    "en": "A deadly accurate bolt-action rifle. Every round counts: aim for the head, work the bolt, repeat."
  }
}
```

1. Ouvrir https://github.com/Nowyyy/Z-Survival-Website/blob/main/contenus/armes.json, cliquer sur le crayon (« Edit this file »).
2. Changer le texte entre guillemets de `"fr"` et `"en"` (texte brut, une ou deux phrases ; garder les guillemets droits `"` autour, et
   écrire les guillemets du texte avec `«  »` ou `’`).
3. Une fois la description relue, mettre `"aRelire": false` (simple repère pour s'y retrouver ; rien ne change à l'écran).
4. « Commit changes » sur `main` : le site est republié en une minute environ.

Champs que l'on peut régler : `description` (fr, en), `aRelire`, `famille`, `ordre` (rang d'affichage, 1 = premier ; à l'intérieur de
chaque famille), `chapitres`, `prochainement`, `nomEn` (nom en anglais s'il diffère du nom du jeu ; `null` sinon), et la liste `chapitres` en
tête du fichier. Champs réécrits par l'outil à chaque relevé : `id`, `nom`, `categorie`. `retirees` : armes disparues du jeu, gardées pour leurs textes, jamais affichées. Fichier illisible : la section affiche
« Les armes n’ont pas pu être chargées. » (seulement si elle est allumée ou en aperçu).

## Ajouter les statistiques plus tard
Aujourd'hui `"stats": null` partout et le panneau montre quatre barres **décoratives** (mêmes longueurs pour toutes les armes, floutées et
grisées, aucun chiffre) sous l'encart « Prochainement » (`weapons.statsTitre`, `commun.comingSoon`, libellés `weapons.stats.*`).
Le jour venu (un lot le décidera) :
1. Format prévu, une valeur de **0 à 100** par barre (déjà le format des barres provisoires de `js/donnees.js`) :
   `"stats": { "degats": 65, "cadence": 45, "portee": 90, "chargeur": 30 }`. Les valeurs se calculent depuis la table du jeu
   (`data/game/armes-partie.json`) par un ajout à `copier-armes.mjs`, ou s'écrivent à la main ; une nouvelle barre = une nouvelle clé et son
   libellé dans `weapons.stats` (français et anglais).
2. Dans `js/section-armes.js` : remplacer `BARRES_DECOR` par les valeurs de l'arme choisie (`armes[courant].stats`), retirer le flou
   (`.arsenal-stats-grille` dans `css/section-armes.css`) et l'encart `.arsenal-stats-tampon`, afficher les valeurs si on le souhaite.

## La section à l'écran
- Fichiers : `js/section-armes.js` (module), `css/section-armes.css` (styles), libellés `weapons.*` de `js/textes.js`.
- **Téléphone** (portrait) : grand visuel (prend la place qui reste, flèches sur ses bords, nom de l'arme en filigrane derrière, halo
  rouge), carte d'infos (catégorie, « 01 / 10 », nom en police de titre, description), statistiques « Prochainement », miniatures qui
  défilent au doigt. Glisser le doigt sur le grand visuel change aussi d'arme. **Paysage** : visuel à gauche, carte à droite, miniatures
  dessous. **Ordinateur** : même disposition en plus grand ; flèches et clavier **← →** (quand la section Armes est affichée ; ↑ ↓ restent
  au défilement des sections) ; dans la liste, Début / Fin vont à la première / dernière arme.
- Accessibilité : miniatures en boutons (`aria-pressed` sur l'arme choisie, une seule dans l'ordre de tabulation, nom et catégorie dans
  `aria-label`), groupes nommés par leur famille, annonce discrète de l'arme choisie (`aria-live`), anneau de focus du site.
- Changement d'arme : l'image arrive du côté du changement (0,42 s), le texte remonte ; **mouvement réduit** : changement immédiat, sans
  animation. Images : la grande de l'arme choisie (et de ses voisines, en avance), les miniatures quand la section approche (`loading="lazy"`).
- Le défilement par sections, la navigation, la musique, l'accueil et les actualités ne changent pas.

## Visuels (`img/armes/`)
Un rendu par arme tiré de son **vrai modèle 3D du jeu** (Chromium sans écran + Three.js de la copie figée), vue de trois quarts du côté
droit, éclairage chaud avec contre-jour rouge sang, fond transparent : `<id>.webp` (1200 × 600, 10 à 18 Kio) et `<id>-mini.webp`
(320 × 160, 3 à 6 Kio) ; réglages et poids dans `img/armes/fabrication.json`. La page ne charge jamais Three.js : seulement ces images.
Détails : `outils/armes/LISEZMOI.md`.
