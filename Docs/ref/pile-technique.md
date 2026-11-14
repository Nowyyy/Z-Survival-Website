# Pile technique de Z-Survival — relevé pour le lot de la scène d'accueil

Relevé fait en **lecture seule** sur un clone temporaire de `Nowyyy/Z-Survival`
(hors de ce dépôt), branche par défaut, commit `4be0796` du 2026-11-09.
Rien n'a été modifié dans ce dépôt de référence.

## Three.js
- **Version : 0.186.1** (`REVISION = '186'`), déclarée en devDependency (`"three": "0.186.1"`).
- **Servie en local** (pas de CDN) : `vendor/three/three.module.js` + `three.core.js`
  (+ `LICENSE-three.txt`, `version.json`), copiés par `npm run vendor:three`.
- Chargée par une **importmap** dans les pages :
  `<script type="importmap">{"imports":{"three":"./vendor/three/three.module.js"}}</script>`,
  puis `import * as THREE from 'three'` dans les modules.
- Rendu : `THREE.WebGLRenderer` créé dans `js/game/game.js`.
- Pas de build pour le jeu servi en local (modules ES) ; `scripts/build.mjs` existe pour la publication.

## Organisation générale
- `js/core/` : logique **pure** (ni Three.js, ni DOM, déterministe) — géométries en tableaux,
  poses, carte, épaves, vagues…
- `js/game/` : rendu Three.js et jeu (`game.js`, `world.js`, `character-v2.js`…).
- `data/game/` : paramètres en JSON (personnages, poses, ennemis, carte, lumières…).
- `css/tokens.css` : couleurs de la scène (variables `--game-*`), lues par `js/game/palette.js`.
- `jeu.html` : le jeu ; `index.html` : son accueil ; `atelier-personnages.html` : atelier
  de visualisation des personnages (utile pour cadrer des poses hors du jeu).

## Personnages (joueur et zombies) — architecture « v2, os rigides »
| Fichier | Rôle |
|---|---|
| `js/core/character-parts.js` | Kit pur : pièces (capsules, sphères, boîtes), fusion par matière avec l'os de chaque sommet (`mergeParts`), cinématique directe (`fkPose`), contact au sol, silhouette. |
| `js/game/character-v2.js` | Construction Three.js : un `SkinnedMesh` par matière, chaque sommet lié à un seul os (poids 1), proxy d'ombre ≤ 64 triangles. `createV2Kit`, `createRigidCharacter`, `rigidShared`. |
| `js/core/pose-v2.js` | Poses : angles d'Euler (ordre `'YXZ'`) par articulation, sans horloge (phase en argument). `poseAt`, `blendPoses`, `addPose`, IK du bras (`armIK`) et des pieds pour la marche. |
| `js/core/texgen-persos.js` | Textures générées en code (aucune image) : atlas par type de matière, atlas zombie 2×2 (paliers de blessure 0 à 3). |
| `js/game/persos-loader.js`, `js/game/persos-runtime.js` | Chargement et mise à jour en jeu (purement visuel). |
| `data/game/characters-v2.json` | Variantes : emplacements `joueur`, `marcheur`, `petit`, `voute`, `grand` ; pièces dont l'**arme** (`gunGrip`, `gunSlide`…, pièce `gun`). |
| `data/game/poses-v2.json` | Squelettes, pose de repos, contacts, foulées, durées, macros, styles. |
| `data/game/zombie-variants.json`, `persos-choix.json` | Variantes de zombies, tenues et choix retenus. |
| `js/core/enemy-factory.js`, `enemy-ai.js` | Zombies côté jeu (vitesse, allure, comportement) — pas utile pour la scène. |

**Conséquences pour la scène d'accueil :**
- Les personnages sont des pièces rigides liées à des os : on peut les poser librement
  en fournissant des angles par articulation (format de `pose-v2.js`).
- **La pose « pied sur le dos du zombie » et la pose « zombie à plat ventre, bras tendu »
  n'existent pas** : à écrire comme nouvelles poses (angles fixes + petites variations
  périodiques pour la respiration et le débattement).
- Les modèles sont prévus pour une vue de dessus lointaine (caméra du jeu : `gameCamera`,
  fov 40, inclinaison 75°) : vérifier leur tenue en plan rapproché de face.

## Carte (le bâtiment)
| Fichier | Rôle |
|---|---|
| `js/core/maps.js` | Conversion d'un plan en pixels (`data/game/maps/<id>/plan.json`) en monde du jeu. |
| `data/game/maps/rez-de-chaussee/` | Carte actuelle : `plan.json`, `world.json`, `decor.json`, `etage.json`, `lampes.json`, `feux.json`, `epaves.json`… ; paramètres communs dans `data/game/maps/params.json`. |
| `js/game/world.js` | Monde en 3D : sol, murs percés de fenêtres, meubles, décor extérieur, lumières, ombres ; fusion par matière. Repère : x du jeu → X, y du jeu → Z, hauteur Y (sol y = 0). |
| `js/core/decor.js`, `js/core/decor-vivant.js` | Décor extérieur déterministe (voitures, arbres, barbelés, poteaux, gravats, bidons en feu). |
| `js/game/textures.js`, `js/core/texgen.js` | Textures générées en code. |
| `js/game/lights.js`, `js/game/lamps.js`, `js/core/lamps.js` | Lumières et lampes. |

## Hélicoptère écrasé
| Fichier | Rôle |
|---|---|
| `js/core/epaves.js` | (lot 5a) **`helicopterModel`** : maillage en triangles (coupé au plan du sol), régions d'atlas et couleurs par pièce ; **`placeHelicopter`**, `helicopterFootprint`, cratère (`craterTriangles`) et traînée (`trailTriangles`) au sol. Repère du modèle : x vers le nez, y vers le haut, z à droite. Aussi la voiture calcinée. |
| `data/game/maps/rez-de-chaussee/epaves.json` | Position de l'hélicoptère et de la voiture en flammes (en pixels du plan). |
| `js/game/world.js` | Ajout au décor (`addHelicopter`, autour des lignes 339 et 767). |

## Effets réutilisables pour la scène
- `js/game/fire.js` : **flammes et fumée** en particules (mélange additif), déterministe,
  vent vers l'est ; mouvement réduit : feu dessiné immobile.
- `js/game/mist.js` (+ `js/core/fog.js`) : **brume** en nappes translucides qui dérivent.
- `js/game/lights.js` / `lamps.js` : base pour la **lumière qui vacille**.
- `js/game/effects.js`, `blood-fx.js`, `vhs-layer.js` : autres effets (sang, filtre VHS).

## Polices du jeu
Le jeu embarque Barlow, Rubik Dirt et Rubik Wet Paint (licence OFL, `fonts/`). Elles sont
libres et propres au jeu (aucun lien avec HoYoverse) : réutilisables plus tard pour
l'identité du site, avec leur licence.
