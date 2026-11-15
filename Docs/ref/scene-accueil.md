# Scène de l'accueil — description validée

Image animée plein écran de la page d'accueil. **Réalisée dans un lot futur** : construite
en 3D avec les éléments du jeu Z-Survival (personnages, zombie, carte, hélicoptère écrasé),
puis transformée en **vidéo en boucle**. Au lot 0, la zone est un emplacement provisoire
(fond sombre + mention « Image animée — à venir »).

## Composition
- **Personnage 1** — au premier plan, **de face**, il **vise au loin** (arme épaulée,
  regard au-delà de la caméra).
- **Personnage 2** — **légèrement en retrait**, **un pied posé sur le dos d'un zombie**
  pour le clouer au sol ; il le **vise vers le bas, canon pointé sur lui**.
- **Zombie** — **à plat ventre** sous le personnage 2, **le bras tendu vers l'avant**.
- **Fond** — la **carte du jeu (le bâtiment) à gauche**, **l'hélicoptère écrasé à droite**.

## Animations (douces, en boucle sans coupure)
- respiration des deux personnages ;
- armes qui bougent un peu ;
- zombie qui se débat sous le pied et **griffe le sol** ;
- **fumée et flammes** de l'hélicoptère ;
- **lumière qui vacille** ;
- **brume**.

La boucle doit être parfaite : la dernière image rejoint la première sans saut
(toutes les animations sur des périodes qui divisent la durée de la boucle).

## Points d'attention
- **La pose du pied sur le zombie n'existe pas dans le jeu** : il faudra la construire
  (pose du personnage 2 et pose « plaqué au sol » du zombie, contact pied / dos crédible).
- Le zombie à plat ventre n'est pas non plus une pose du jeu : à construire aussi.
- Vue : la scène est cadrée de face / trois-quarts, pas en vue de dessus comme le jeu ;
  les modèles doivent tenir à cette distance.
- Version mouvement réduit (`prefers-reduced-motion`) : afficher une image fixe de la scène
  au lieu de la vidéo.
- Téléphone d'abord : prévoir un cadrage portrait (les personnages au centre) et un
  cadrage paysage (bâtiment et hélicoptère visibles de chaque côté).

## Copie figée des éléments du jeu (lot 1)

La scène 3D (`scene/`) ne charge rien depuis le jeu en ligne : les fichiers du jeu dont elle a besoin sont
**recopiés tels quels** dans `scene/jeu/`, à la même place que dans le jeu (`js/core/`, `js/game/`, `data/game/`,
`css/`, `vendor/three/`). Aucun fichier copié n'est retouché : les enrichissements de la scène vivent dans
`scene/js/` (voir `Docs/lots/lot-1.md`).

- **Origine** : dépôt `Nowyyy/Z-Survival`, branche **`dev`**, commit **`3c25e3a08e7b34f2541be145d59ecaf8d071a2ae`**
  (« Update seed.md », 2026-11-14), lu en lecture seule dans un clone temporaire hors de ce dépôt.
- **Refaire la copie** (par exemple après les skins de la V0.8) :
  `node scene/outils/copie-jeu.mjs <clone du jeu sur dev>` ; le script suit les imports des modules de départ,
  recopie la liste de données, et écrit l'origine (branche, commit, liste) dans `scene/jeu/ORIGINE.json`.

| Dossier de `scene/jeu/` | Fichiers (même chemin dans le jeu) | Rôle pour la scène |
|---|---|---|
| `vendor/three/` | `three.module.js`, `three.core.js`, `LICENSE-three.txt`, `version.json` | Three.js **0.186.1**, même version que le jeu (importmap de `scene/index.html`). |
| `js/game/` | `world.js` (+ `windows-mesh.js`, `see-through.js`) | Monde du jeu : sol, bâtiment « Nacht der Untoten » (murs, fenêtres à planches, mobilier), décor extérieur. |
| `js/game/` | `character-v2.js` | Personnages « os rigides » (joueur et zombies), construits par le kit du jeu. |
| `js/game/` | `lamps.js`, `lights.js` | Lampes à huile (maillages) ; `lights.js` suit l'import dynamique de `lamps.js`. |
| `js/game/` | `fire.js`, `mist.js` | Feu et brume du jeu (créés par `world.js`) ; leurs shaders sont repris par la boucle. |
| `js/game/` | `textures.js`, `palette.js` | Textures générées en code, couleurs lues dans `css/tokens.css`. |
| `js/core/` | `character-parts.js`, `pose-v2.js`, `persos-variants.js`, `texgen-persos.js` | Pièces, squelettes, variantes et textures des personnages. |
| `js/core/` | `epaves.js` | Hélicoptère écrasé (`helicopterModel`), cratère, traînée, voiture en flammes. |
| `js/core/` | `layout.js`, `zones.js`, `windows.js`, `maps.js`, `collision.js`, `shape.js`, `floors.js`, `plank-layout.js` | Couches de la carte (murs, fenêtres, portes, étages), planches. |
| `js/core/` | `decor.js`, `decor-vivant.js`, `decor-interieur.js`, `furniture-model.js`, `mobilier-aspect.js`, `portes-aspect.js` | Décor extérieur et intérieur. |
| `js/core/` | `lamps.js`, `fog.js`, `see-through.js`, `texgen.js`, `color.js`, `rng.js`, `vec.js`, `camera.js`, `viewport.js`, `movement.js` | Modèle des lampes, masque de brume, textures, outils. |
| `data/game/` | `characters-v2.json`, `poses-v2.json`, `persos-choix.json`, `zombie-variants.json` | Personnages (variante « riche » de la table des choix), squelettes. |
| `data/game/` | `render.json`, `textures.json`, `camera.json`, `windows.json`, `lumieres.json` | Réglages de rendu, textures, fenêtres, lumières. |
| `data/game/maps/rez-de-chaussee/` | `world.json`, `decor.json`, `zones.json`, `etage.world.json`, `decor-interieur.world.json`, `mobilier.world.json`, `feux.json`, `lampes.world.json`, `epaves.json` | La carte (plan converti en unités du jeu), son décor, ses épaves. |
| `css/` | `tokens.css` | Jetons de couleur du jeu (`--game-*`, `--perso-*`). |

## Boucle de la scène 3D (lot 1)

- **Durée de la boucle : 8 secondes** (`DUREE` dans `scene/js/boucle.js`), en vue de la vidéo du lot 2.
- Toute la scène est une **fonction du temps** t (0 à 8 s) : aucune horloge, aucun hasard, aucun état qui s'accumule.
  Chaque mouvement fait un **nombre entier de cycles par boucle** :
  respiration 2 cycles (4 s) ; appui du pied du personnage 2 : 2 cycles ; zombie qui se débat : ondes de 2, 5 et 8 cycles ;
  griffe sur le sol : 4 coups (2 s chacun) ; bras tendu qui tâtonne : 2 cycles ; jambe qui gigote : 4 cycles ;
  visée qui dérive : ondes de 1, 3 et 5 cycles ; vacillement des lumières : ondes de 3 à 23 cycles.
- **Flammes et fumée** (`scene/js/feu.js`, shaders du feu du jeu) : chaque particule vit 8/k secondes (k entier : 9 à 15
  pour les flammes, 1 ou 2 pour la fumée) et naît en fondu ; son point de départ dépend de son numéro de vie modulo k.
- **Brume** (`scene/js/brume.js`, nappes et shader du jeu) : deux tirages du même bruit, décalés d'une boucle de vent,
  fondus l'un dans l'autre ; au début et à la fin de la boucle, c'est le même tirage.
- **Coup de feu du personnage 1** (retours du lot 1, `scene/js/tir.js`) : un tir par boucle à 5,2 s (recul 0,4 s, éclair 2 images,
  douille, fumée 1,4 s), terminé bien avant la fin de la boucle.
- Vérification : `node scene/outils/verifier-boucle.mjs` (écart entre images voisines et à la jonction 8 s → 0 s ; le coup de feu
  donne un pic d'écart, attendu).

## Cadrage retenu (retours du lot 1)
- **B, contre-plongée rapprochée** (`scene/js/cadrages.js`), ouvert par défaut par `scene/index.html`.
- Aperçu dans la vraie page d'accueil : `scene/apercu.html` (scène en `?format=plein` dessous, site par-dessus, sans le modifier).
- Personnage 1 : survivant tactique (variante « riche ») ; personnage 2 : civil débrouillard (variante B du jeu, lampe frontale).
