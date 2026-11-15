# Clip du jeu pour À propos — fabrication (lot 4b)

`fabriquer.mjs` enregistre une boucle de 8 s du **vrai jeu** (dépôt `Nowyyy/Z-Survival`, branche `dev`) : le survivant, vu de dessus, tire
sur des zombies qui arrivent de plusieurs côtés. La section À propos du site l'affiche dans le bloc du jeu, à la place de l'ancienne image.

| Fichier (`img/a-propos/`) | Contenu |
|---|---|
| `jeu-clip.mp4` | 800 × 450, 30 images/s, 8 s en boucle, H.264 High 4.0, `yuv420p`, sans son, faststart |
| `jeu-clip.webp` | affiche (image fixe du clip, survivant qui tire) : avant la lecture, sans lecture automatique et en mouvement réduit |
| `fabrication.json` | commit du jeu utilisé, réglages, nombre de zombies tués, empreintes SHA-256 |

## Lancer

```bash
node outils/clip-jeu/fabriquer.mjs
```

- Prérequis : Node 18 ou plus, Playwright avec son Chromium, git, ffmpeg (`libx264`, `libwebp`), ImageMagick (`composite`).
- Durée : environ 6 minutes (rendu logiciel, sans carte graphique).
- Options : `--jeu=DOSSIER` (une copie du jeu déjà faite, au lieu d'en refaire une) ; `--garder` (garde les images rendues, dossier
  temporaire affiché à la fin).

## Méthode

1. **Copie du jeu en lecture seule** : `git clone --depth 1 -b dev` dans un dossier temporaire, **hors de ce dépôt** (règle de
   `CLAUDE.md`). Rien n'y est modifié ni envoyé.
2. **Jeu ouvert dans Chromium sans écran**, avec son accès de test (`jeu.html?test=1`) : graine fixe (`seed=7`), aucune vague automatique
   (`nospawn=1`), sans effet VHS (`vhs=0` : plus net à petite taille et plus léger), zoom maximal du jeu (`zoom=3`). Le HUD est masqué.
3. **Horloge contrôlée** (`page.clock` de Playwright) : chaque image avance le jeu d'exactement 1/30 s, quel que soit le temps de rendu.
4. **Action** : des groupes de zombies apparaissent à des instants fixes autour du point de départ (`REGLAGES.vagues`). Le survivant est
   piloté **comme par un joueur au clavier et à la souris** (`creerPilote`, réglages `REGLAGES.pilote`) :
   - **déplacement** : 8 directions à allure modérée (60 % de la vitesse du jeu, environ 130 u/s), chaque direction **tenue** 0,8 à 1,2 s ;
     à chaque décision, la direction qui l'éloigne le plus des zombies (là où il n'y en a pas) sans sortir de la zone dégagée autour de
     son point de départ ; il change plus tôt si un zombie se met en travers ou s'il arrive au bord ; dans les 2,3 dernières secondes, il
     revient à son point de départ et s'y arrête pile (la boucle reste propre) ;
   - **souris** : temps de réaction de 0,13 à 0,23 s (souris immobile) après chaque zombie abattu ; geste rapide vers la cible (0,13 à 0,23 s,
     vitesse en cloche) qui la dépasse le plus souvent (6 à 18 % de l'angle parcouru) ou s'arrête un peu avant ; courte correction ; puis
     suivi du zombie avec un léger retard ; nouveau geste s'il décroche. Toujours le zombie le plus proche : il change de cible si un autre
     devient nettement plus proche. Sans cible, la souris ne bouge pas.
   Le tir est celui du jeu (automatique quand un zombie est dans la ligne de visée ; le cône s'élargit quand le joueur bouge).
5. **Cadrage** : 800 × 450 autour du joueur dans une fenêtre de 1600 × 900 (personnages deux fois plus grands qu'en plein écran au zoom maximal du jeu, sans perte de netteté).
6. **Boucle** : 255 images rendues ; la vidéo commence à l'image 15 et ses 15 dernières images sont fondues dans les 15 premières (0,5 s) :
   la fin rejoint le début sans saut (les corps au sol apparaissent et disparaissent dans ce fondu).
7. **Images éteintes** : quand la caméra bouge, la carte d'ombres du soleil du jeu rate parfois une ou deux images (une grande bande d'ombre
   couvre la scène, qui perd jusqu'à la moitié de sa lumière). Après le rendu, une image sous 85 % de la luminosité médiane de ses 8 voisines
   est remplacée par le mélange des images saines qui l'entourent (séries de 3 images au plus ; au-delà, le script prévient et n'y touche
   pas). Les images réparées sont notées dans `fabrication.json`.
8. **Encodage** : léger éclaircissement (le jeu est sombre et la vidéo petite dans la page), H.264 `crf 27`, métadonnées retirées.

## Refaire le clip quand le jeu change
Relancer le script : il recopie la branche `dev` du jeu. Le commit utilisé est noté dans `fabrication.json`. Si la salle de départ change
(murs, meubles), ajuster `REGLAGES.vagues` (positions des zombies autour du joueur, en unités du jeu) pour qu'ils arrivent par des zones
dégagées.

## Reproductibilité
Le clip n'est **pas identique au bit près** d'une fabrication à l'autre : le jeu tourne un peu en temps réel pendant son chargement, avant que
l'horloge soit prise en main, et son temps de départ varie de quelques centièmes de seconde. La scène est la même (mêmes zombies aux mêmes
instants, environ 10 tués) ; seuls des détails changent (flammes, lumières, sang). La version publiée est décrite dans `img/a-propos/fabrication.json`.
