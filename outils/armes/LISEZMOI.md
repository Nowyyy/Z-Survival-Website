# Armes du jeu pour la section Armes du site (`outils/armes/`, lot 6a)

La section Armes du site (`js/section-armes.js`, derrière l'interrupteur `SECTION_ARMES_ACTIVE` de `js/donnees.js`) présente les armes
du jeu Z-Survival. Ces outils relèvent les armes dans le jeu et fabriquent leurs visuels. Référence complète : `Docs/ref/armes.md`.

## Règles
- Le jeu `Nowyyy/Z-Survival` est lu sur sa branche **`dev`** (jamais `main`, en retard), en **lecture seule**, dans un clone
  **hors de ce dépôt**. L'outil refuse un clone sur une autre branche, ou placé dans ce dépôt.
- `armes/jeu/` : copie figée des fichiers du jeu, **tels quels**, à la même place que dans le jeu ; jamais retouchée, **jamais publiée**
  (absente de `.github/workflows/pages.yml`). Origine (commit, fichiers, empreintes SHA-256) : `armes/jeu/ORIGINE.json`.
- **Aucune statistique de jeu** n'est relevée : `data/game/armes-partie.json` du jeu (qui en contient) est lu pour la catégorie et l'ordre
  des armes seulement, et n'est pas recopié.

## 1. Relever les armes : `copier-armes.mjs` (Node 20 ou plus, depuis la racine du dépôt)

```bash
node outils/armes/copier-armes.mjs
```

Clone `dev` dans un dossier temporaire du système, recopie les fichiers utiles dans `armes/jeu/`, met à jour `contenus/armes.json`, puis
efface le clone. Il affiche la liste des armes du jeu et :
- les **armes ajoutées** (ajoutées à la fin de `contenus/armes.json`, description vide, `"aRelire": true`) ;
- les **armes modifiées** (nom, catégorie, famille, modèle 3D : dans ce cas, refaire les visuels) ;
- les **armes disparues** (sorties de la liste et rangées dans `"retirees"`, descriptions gardées ; elles reviennent telles quelles si
  l'arme revient dans le jeu) ;
- les libellés de catégorie ou de famille à ajouter dans `js/textes.js` (français et anglais).

Ce que l'outil réécrit dans `contenus/armes.json` : `id`, `nom` (nom affiché par le jeu, `game.armes.<id>` de son `data/i18n/fr.json`),
`categorie`, `famille`. Ce qu'il ne touche **jamais** : `ordre`, `nomEn`, `description`, `aRelire`, `stats`.

Autres usages :

```bash
node outils/armes/copier-armes.mjs /chemin/vers/clone-du-jeu
```

```bash
node outils/armes/copier-armes.mjs --essai
```

```bash
node outils/armes/copier-armes.mjs --verifier
```

- un clone déjà présent (sur `dev`) ;
- `--essai` : montre ce qui changerait, sans rien écrire ;
- `--verifier` : vérifie que `armes/jeu/` correspond exactement à `ORIGINE.json` (aucun fichier retouché, aucun en trop).

### Fichiers recopiés dans `armes/jeu/`
| Fichier (même chemin dans le jeu) | Rôle |
|---|---|
| `js/core/armes/armes.js`, `modeles.js`, `geometrie.js`, `atlas.js`, `caisse.js` | Modèles 3D des armes, en code (pièces → maillage), atlas des matières |
| `js/core/color.js`, `js/core/vec.js` | Outils (couleurs) |
| `js/armes/rendu.js` | Rendu Three.js des armes de l'atelier des armes du jeu (géométrie, atlas) |
| `data/armes/armes.json`, `data/armes/armes-choix.json` | Définition des armes (nom, genre, classe, dimensions, variantes) et variante retenue |
| `css/armes.css` | Couleurs des matières (jetons `--arm-*`) |
| `vendor/three/` | Three.js 0.186.1, même version que le jeu |

Les fichiers à recopier sont trouvés en suivant les imports de `ENTREES`, plus la liste `DONNEES` (en tête de l'outil).

## 2. Fabriquer les visuels : `fabriquer-visuels.mjs`

```bash
node outils/armes/fabriquer-visuels.mjs
```

```bash
node outils/armes/fabriquer-visuels.mjs --armes=kar98k,m1911
```

Pour chaque arme de `contenus/armes.json` (ou seulement celles de `--armes=`) : Chromium sans écran (Playwright déjà installé, WebGL
logiciel) ouvre `outils/armes/rendu.html`, qui rend le **vrai modèle 3D du jeu** (copie figée `armes/jeu/`, variante retenue par le
propriétaire dans `armes-choix.json`) avec Three.js, à deux fois la taille voulue, puis réduit l'image et l'encode en WebP avec
transparence, sans métadonnées (encodeur de Chromium : la conversion par ffmpeg laissait un fond presque noir au lieu d'un fond
transparent). Déterministe : mêmes fichiers d'entrée, mêmes images.

- `img/armes/<id>.webp` : grande image, **1200 × 600** (≈ 10 à 18 Kio) ;
- `img/armes/<id>-mini.webp` : miniature, **320 × 160** (≈ 3 à 6 Kio) ;
- `img/armes/fabrication.json` : commit du jeu, réglages de la vue, poids (réécrit seulement quand toutes les armes sont refaites).

Vue (constante `VUE` de `rendu.js`) : trois quarts du côté droit de l'arme (fenêtre d'éjection, levier), bouche vers la droite, un peu
au-dessus (lacet 22°, hauteur 12°, champ 14°). L'arme remplit l'image (marge 5 %), sauf les armes courtes, un peu plus petites (le Colt :
69 % de la largeur) pour garder une idée de leur taille. Pose « caisse » du jeu (arme entière, sans être couchée) ; lance-flammes en pose
« main » (réservoirs placés comme portés sur le dos). Éclairage dans l'ambiance du site : lumière principale chaude en haut à gauche,
appoint de face, contre-jour **rouge sang** (`--color-action` du site) derrière à droite, débouché froid en bas. Matière : l'atlas et les
couleurs de sommet du jeu, un peu plus brillante que dans le jeu (vu de loin, mat).

La page du site ne charge **jamais** Three.js pour la section Armes : seulement ces images.

## Après une évolution des armes du jeu
1. `node outils/armes/copier-armes.mjs` ; lire la liste des armes ajoutées, modifiées, disparues.
2. Ajouter les libellés signalés dans `js/textes.js` (français et anglais), écrire les descriptions vides dans `contenus/armes.json`.
3. `node outils/armes/fabriquer-visuels.mjs` (au moins pour les armes ajoutées ou au modèle modifié).
4. Vérifier avec `?apercu=armes` (`Docs/ref/armes.md`).
