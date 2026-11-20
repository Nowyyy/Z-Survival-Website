# Vidéo de la scène v2 — en attente (NE PAS FUSIONNER)

Fabriquée le 20/11/2026 par `node outils/video/fabriquer.mjs --scene=v2`, depuis `scene-v2/` (copie du jeu `dev` @ `2f7716a` : Kar98k, Colt,
tenues et décor d'époque). Rangée sur la branche `video-v2-en-attente`, **jamais fusionnée dans `main`** : elle n'est pas sur le site.

**Seul le propriétaire décide de la mise en ligne** (quand le jeu sera mis à jour). Ce jour-là :
1. si le jeu a changé depuis, refaire la copie (`node outils/scene/copier-jeu.mjs`) et la vidéo (`node outils/video/fabriquer.mjs --scene=v2`) ;
2. copier `accueil-16x9.mp4`, `accueil-9x16.mp4` et leurs affiches `.webp` dans `img/accueil/` et reporter les empreintes dans
   `img/accueil/fabrication.json` ;
3. relancer `node outils/video/verifier-accueil.mjs`, puis PR vers `main`.

| Fichier | Taille | Format |
|---|---|---|
| `accueil-16x9.mp4` | 2,45 Mo | 1920 × 1080, 240 images (8 s, 30 im/s), H.264 High, yuv420p, sans son |
| `accueil-9x16.mp4` | 2,46 Mo | 1080 × 1920, 240 images, mêmes réglages |
| `accueil-16x9.webp`, `accueil-9x16.webp` | 38 et 29 Kio | affiches à 1,9 s (TEMPS_AFFICHE) |

Empreintes : `fabrication.json`. Tirs aux mêmes instants que la vidéo actuelle (2,6 et 5,2 s) : rien d'autre à changer sur le site.
