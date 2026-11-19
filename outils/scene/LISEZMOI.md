# Copie du jeu pour la scène v2 de l'accueil (`outils/scene/copier-jeu.mjs`)

La scène v2 de l'accueil (`scene-v2/`, lot 5a) ne charge rien depuis le jeu en ligne : les fichiers du jeu dont elle a besoin
(personnages, zombies, armes, carte, hélicoptère, lampes, matériaux, Three.js) sont **recopiés tels quels** dans `scene-v2/jeu/`,
à la même place que dans le jeu. Cet outil refait cette copie à chaque évolution du jeu (skins des personnages, skins des zombies,
carte…). La copie de la v1 (`scene/jeu/`) n'est **jamais** touchée : elle sert à refaire la vidéo actuelle de l'accueil.

## Règles
- Le jeu `Nowyyy/Z-Survival` est lu sur sa branche **`dev`** (jamais `main`, en retard), en **lecture seule**, dans un clone
  **hors de ce dépôt**. L'outil refuse un clone sur une autre branche, ou placé dans ce dépôt.
- Aucun fichier copié n'est retouché : les ajouts de la scène vivent dans `scene-v2/js/`.

## Utilisation (Node 20 ou plus, depuis la racine du dépôt)

```bash
node outils/scene/copier-jeu.mjs
```

Clone `dev` dans un dossier temporaire du système, copie, puis efface le clone. Pour utiliser un clone déjà présent (sur `dev`) :

```bash
node outils/scene/copier-jeu.mjs /chemin/vers/clone-du-jeu
```

Voir ce qui changerait, sans rien écrire :

```bash
node outils/scene/copier-jeu.mjs --essai
```

Vérifier que `scene-v2/jeu/` n'a pas été retouché (chaque fichier a l'empreinte notée, aucun fichier en trop) :

```bash
node outils/scene/copier-jeu.mjs --verifier
```

## Ce que l'outil affiche et écrit
- Le commit de `dev` copié, et celui de la copie précédente.
- Les fichiers **ajoutés**, **modifiés** et **disparus de la copie** depuis la copie précédente (comparaison des empreintes SHA-256).
- Les fichiers attendus mais **disparus du jeu** (un module renommé, une donnée supprimée) : la scène v2 devra sans doute être adaptée.
- `scene-v2/jeu/ORIGINE.json` : dépôt, branche, commit, date et titre du commit, date de la copie, copie précédente, changements, et la
  liste des fichiers avec leur empreinte et leur taille.

## Quels fichiers
- **Modules de départ** (`ENTREES` en tête du script), suivis par leurs imports relatifs : monde (`js/game/world.js`), personnages et
  zombies (`js/game/character-v2.js`), lampes, feu, brume, textures, palette, couches de la carte, fenêtres, hélicoptère
  (`js/core/epaves.js`), textures des personnages, **armes** (`js/core/armes/armes.js`, `atlas.js`, `partie.js`).
- **Données** (`DONNEES`) : personnages et squelettes, zombies, rendu, textures, fenêtres, lumières, carte `rez-de-chaussee`,
  **armes** (`data/armes/armes.json`, `armes-choix.json`, `poses.json`, `data/game/armes-partie.json`), jetons de couleur
  (`css/tokens.css`, `css/armes.css`), Three.js.
- Si le jeu ajoute un fichier dont la scène a besoin (une nouvelle carte, par exemple), l'ajouter à l'une de ces deux listes.

## Après une mise à jour
1. Ouvrir `scene-v2/index.html` (et `scene-v2/apercu.html`) : aucune erreur, personnages, armes et décor en place.
2. Si une pose ou une prise d'arme ne tombe plus juste (proportions des nouveaux skins), retoucher `scene-v2/js/poses.js`.
3. Refaire les images de la planche : `node scene-v2/outils/planche.mjs`.
4. Ajouter une ligne à l'historique en bas de `scene-v2/planche.html` (date, commit de `dev`, ce qui a changé).
5. Vérifier : `node scene-v2/outils/verifier.mjs`.
