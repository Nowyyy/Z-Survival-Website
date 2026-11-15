# Vidéos de l'accueil — fabrication (lot 2b)

`fabriquer.mjs` transforme la scène 3D de l'accueil (`scene/index.html`, cadrage **B** retenu au lot 1) en deux vidéos en boucle
de 8 s, plus une affiche (image fixe) par format. La page d'accueil du site ne charge jamais Three.js ni rien de `scene/` : elle lit
seulement ces fichiers.

| Fichier (`img/accueil/`) | Format | Usage |
|---|---|---|
| `accueil-16x9.mp4`, `accueil-16x9.webp` | 1920 × 1080 (cadrage B paysage) | écran en paysage (ordinateur, téléphone tourné) |
| `accueil-9x16.mp4`, `accueil-9x16.webp` | 1080 × 1920 (cadrage B portrait) | écran en portrait (téléphone, tablette debout) |
| `fabrication.json` | — | réglages et empreintes SHA-256 des fichiers produits |

## Lancer

```bash
node outils/video/fabriquer.mjs
```

- Prérequis : Node 18 ou plus, Playwright avec son Chromium, ffmpeg avec `libx264` et `libwebp`.
- Durée : environ 8 minutes (les deux formats sont rendus en même temps, un Chromium chacun ; rendu logiciel, sans carte graphique).
- Options : `--formats=ordinateur` ou `--formats=telephone` (un seul format) ; `--sans-rendu` (réencode les images déjà rendues,
  pour essayer d'autres réglages d'encodage) ; `--nettoyer` (efface les images rendues, environ 1 Go, dans `outils/video/rendu/`,
  dossier non suivi par git).

## Méthode

1. **Copie publiée** : le script sert une copie exacte de ce que publie `.github/workflows/pages.yml` (`outils/copie-publiee.mjs`),
   sous `/Z-Survival-Website/`, comme GitHub Pages.
2. **Rendu image par image, pas de temps fixe** : la scène est ouverte avec `?cadrage=B&format=paysage|portrait&capture=1&w=…&h=…`
   (taille exacte, pixel ratio 1, aucune boucle d'animation). Pour l'image k, le script appelle `window.__scene.rendre(k / 30)` puis
   récupère le PNG du canvas : le temps de calcul (environ 1 s par image ici) ne change rien à l'image. Toute la scène est une fonction
   du temps de la boucle (lot 1) : aucune horloge, aucun hasard.
3. **Exactement un tour** : 240 images, de t = 0 à t = 8 s − 1/30 s. La dernière image n'est pas la copie de la première ; la vidéo
   en boucle enchaîne donc 7,967 s → 0 s comme deux images voisines (vérifié par `outils/video/verifier-accueil.mjs`).
4. **Encodage** (ffmpeg) : H.264 **High 4.0**, `yuv420p`, BT.709, **deux passes** à 2,6 Mbit/s (plafond 4,2 Mbit/s), une image clé
   toutes les 2 s (reprise rapide au même instant quand on tourne l'écran), **sans piste son** (`-an`), **faststart** (index en tête
   de fichier : la lecture démarre avant la fin du téléchargement), métadonnées retirées, encodage déterministe (`-threads 1`,
   `bitexact`). Lisible partout, Safari de l'iPhone compris.
5. **Affiche** : l'image de `TEMPS_AFFICHE` (2,4 s : bras du zombie tendu, loin de l'éclair du tir), en WebP qualité 78. Le site
   démarre la vidéo à ce même instant : le passage de l'affiche à la vidéo ne se voit pas.

## Temps partagés

Toutes les valeurs de temps sont dans **`js/accueil-boucle.js`**, lu à la fois par ce script, par la scène (`scene/js/boucle.js`,
`scene/js/tir.js`) et par le site (`js/accueil-video.js`, `js/accueil-tir.js`) :
`DUREE_BOUCLE = 8`, **`TEMPS_TIR = 5.2`**, `IMAGES_PAR_SECONDE = 30`, `TEMPS_AFFICHE = 2.4`.
Si l'une change, relancer ce script : le site suit tout seul.

## Reproductibilité

Une nouvelle exécution redonne les mêmes images et les mêmes fichiers : comparer les empreintes de `img/accueil/fabrication.json`
avant et après (`git diff img/accueil/fabrication.json` ne doit rien montrer). Le rendu dépend de la version de Chromium (SwiftShader) et
de ffmpeg : avec d'autres versions, les images peuvent différer de quelques niveaux de gris, sans que la vidéo change d'aspect.
