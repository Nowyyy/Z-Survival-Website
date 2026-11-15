# Lot 4b — À propos : clip du vrai jeu à la place de l'image

Branche `lot-4b`, depuis `main` (`3accabe`). Demande du propriétaire : « pour l'image du jeu dans la partie À propos, enregistrer un petit clip
du jeu avec le perso qui tire sur des zombies, une petite boucle de 5-10 s pas plus ».

## Ce qui a été fait

### A — Fabrication du clip (`outils/clip-jeu/fabriquer.mjs`, mode d'emploi `outils/clip-jeu/LISEZMOI.md`)
- Le clip vient du **vrai jeu** : dépôt `Nowyyy/Z-Survival`, **branche `dev`** (commit noté dans `img/a-propos/fabrication.json`), copié
  en lecture seule dans un dossier temporaire **hors de ce dépôt**, jamais modifié.
- Le jeu est servi en local et ouvert dans Chromium sans écran, avec **son propre accès de test** (`jeu.html?test=1`) :
  - graine fixe, aucune vague automatique ;
  - sans effet VHS (plus net à petite taille, et plus léger) ;
  - zoom maximal du jeu ;
  - HUD masqué.
- **Horloge contrôlée** (Playwright) : chaque image avance le jeu d'exactement 1/30 s, quel que soit le temps de rendu (environ 1,5 s par
  image en rendu logiciel). L'animation est donc fluide.
- **Action** : quatre petits groupes de zombies arrivent de plusieurs côtés à des instants fixes. Le survivant pivote vers le plus proche,
  vite mais pas d'un coup (520° par seconde au plus). Le tir est celui du jeu : automatique quand un zombie est dans la ligne de visée, avec
  laser, éclair au canon, sang, zombies qui tombent. **10 zombies tués** en 8 s, sans que le survivant soit touché.
- **Cadrage** : 800 × 450 autour du joueur dans une fenêtre de 1600 × 900, soit des personnages deux fois plus grands qu'en plein écran,
  sans perte de netteté.
- **Boucle de 8 s** : 255 images rendues ; les 15 dernières sont fondues dans les 15 premières (0,5 s). La fin rejoint le début sans saut :
  les corps au sol s'effacent pendant ce fondu.
- **Fichiers** (`img/a-propos/`) :

| Fichier | Contenu | Poids |
|---|---|---|
| `jeu-clip.mp4` | 800 × 450, 30 im/s, 240 images (8 s), H.264 High 4.0, `yuv420p`, sans son, faststart, léger éclaircissement | **256 Kio** |
| `jeu-clip.webp` | affiche (image fixe du clip : le survivant qui tire) | 16 Kio |
| `fabrication.json` | commit du jeu, réglages, zombies tués, empreintes SHA-256 | — |

### B — Site (`index.html`, `css/principal.css`, `js/a-propos-clip.js`, `js/site.js`, `js/textes.js`)
- Dans le bloc « Le jeu » d'À propos, le clip remplace l'ancienne image (l'affiche de l'accueil), **dans le même cadre rouge**, à la même
  taille.
- Comme la vidéo de l'accueil :
  - l'**affiche** est dessous et la vidéo par-dessus ;
  - la vidéo reste invisible tant qu'elle ne joue pas vraiment : sans lecture automatique (mode économie d'énergie de l'iPhone), on voit
    l'affiche, sans bouton de lecture ;
  - **rien n'est téléchargé** avant que le bloc soit à l'écran (la source n'est posée qu'à ce moment-là) ;
  - lecture quand le bloc est visible, **pause** quand on quitte la section ou que l'onglet est caché ;
  - **mouvement réduit** : jamais de vidéo, seulement l'affiche.
- Texte de remplacement de l'image mis à jour (FR et EN) : « Z-Survival en jeu, vu de dessus : le survivant tire sur des zombies qui
  l'encerclent. »

## Vérifications
**`outils/verifier-lot-4b.mjs`** (nouveau), sur la copie exacte de ce que publie le workflow, servie à la racine : **26/26**.
- Fichier : une seule piste (vidéo), H.264 High `yuv420p`, 800 × 450, 30 im/s, 240 images, 8,00 s, index en tête, moins de 1 Mio ;
  affiche WebP 800 × 450.
- Raccord de la boucle (vidéo décodée) : du même ordre que les plus grands passages d'image naturels du clip (un tir, un zombie qui tombe).
  Sur les images avant encodage, il est plus faible que le plus grand passage naturel. Dans la vidéo, la compression y ajoute moins d'un
  niveau de gris en moyenne, ce qui est invisible.
- Site à 375 × 667 et 1440 × 900, avec et sans mouvement réduit :
  - aucune requête vers le clip avant l'arrivée sur À propos ;
  - à l'arrivée, le clip joue, visible, sur son affiche et dans le cadre rouge ;
  - pause en quittant la section ;
  - en mouvement réduit, affiche seule et aucune requête vidéo ;
  - aucune erreur console, aucun fichier manquant.
- **Pas reproductible au bit près** (vérifié : deux fabrications donnent des fichiers différents). La chorégraphie est la même (mêmes zombies
  aux mêmes instants, 10 tués), mais le jeu tourne un peu en temps réel pendant son chargement, avant que l'horloge soit prise en main :
  son temps de départ varie de quelques centièmes de seconde, et avec lui des détails (flammes, lumières, sang). La version retenue est
  décrite dans `fabrication.json`.
- `outils/verifier-lot-4a.mjs` (À propos, console, fichiers manquants) : **79/79**.

## Limites
- **Le clip n'est pas reproductible au bit près** (voir Vérifications) : le refaire donne la même scène, pas exactement les mêmes images.
- **Le clip est figé** : si le jeu change (personnages, salle de départ), il faut le refaire (`node outils/clip-jeu/fabriquer.mjs`, environ
  6 minutes). Si la salle de départ change beaucoup, ajuster les positions d'arrivée des zombies (`REGLAGES.vagues`).
- Image du jeu **sans l'effet VHS** du jeu : choisi pour la netteté à petite taille et le poids. Il peut être remis (`vhs=0` → `vhs=1` dans
  `REGLAGES.adresse`), mais le grain rend la vidéo plus lourde.
- Lecture testée dans Chromium seulement. Le format (H.264 High, `yuv420p`, faststart, `muted playsinline`) est celui de la vidéo de
  l'accueil, lue par Safari et Chrome sur téléphone.

## À tester toi-même
1. https://zsurvival-game.com/#about : le clip joue dans le bloc « Le jeu », en boucle, sans saut visible.
2. Sur téléphone : il démarre en arrivant sur À propos ; en mode économie d'énergie de l'iPhone, l'affiche fixe reste, sans bouton de lecture.
3. Réglages → Accessibilité → Réduire les animations : affiche fixe seulement.

## État git
- Commits `lot-4b A` à `lot-4b C` sur la branche `lot-4b`, PR vers `main` fusionnée par l'agent (règle de `CLAUDE.md`).
- Tag `lot-4b` créé en local ; son envoi sur GitHub est refusé par l'environnement de l'agent, comme pour les lots précédents.
