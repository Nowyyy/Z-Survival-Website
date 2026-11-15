# outils/musique — musique du site générée par du code (lot 1b)

Comme les sons du jeu, la musique est **faite maison et générée par du code** ; ce dossier permet de la retoucher ou de la refaire.
Relevé de la musique du menu du jeu et règles d'intégration : `Docs/ref/musique.md`.

| Fichier | Rôle |
|---|---|
| `partitions.mjs` | Les trois propositions (M1, M2, M3) : tempo, tonique, bourdon, couches, motifs, accords, mélodies, sections, effets, sonie visée. **C'est ici qu'on retouche la musique.** |
| `moteur.mjs` | Synthèse hors ligne (timbres du menu du jeu et de la mélodie de début de manche), écho, réverbération, sonie, limiteur, découpe en boucle parfaite. |
| `generer.mjs` | Rendu → `rendu/<id>.wav` (non versionné) → `musique/<id>.mp3` (128 kb/s, 44,1 kHz stéréo) et `musique/boucles.json` (points de boucle). |
| `verifier-boucle.mjs` | Décode les MP3 et contrôle le raccord (périodicité, saut, blanc, écart avec la suite naturelle). |
| `verifier-planche.mjs` | Contrôle Playwright de `musique/planche.html` servie comme sur GitHub Pages (voir l'en-tête du fichier). |
| `verifier-site.mjs` | Contrôle Playwright de la musique du site (lot 2a, `js/musique.js` et boutons de son), servie comme sur GitHub Pages ; `--en-ligne` pour le site publié. |
| `../copie-publiee.mjs` | Copie exacte de ce que publie `pages.yml`, servie sous `/Z-Survival-Website/` (utilisée par les deux contrôles). |

## Refaire les fichiers
Il faut Node 18 ou plus et `ffmpeg` (avec `libmp3lame`).

```bash
node outils/musique/generer.mjs
```

```bash
node outils/musique/verifier-boucle.mjs
```

`node outils/musique/generer.mjs M2` ne refait que M2. Le rendu est déterministe : mêmes notes, même bruit à chaque fois.

## Comment la boucle reste parfaite
- Une partition décrit **un tour** (nombre entier de mesures, durée qui tombe sur un échantillon entier) ; le moteur rend ce même
  tour trois fois de suite et découpe le deuxième : écho, réverbération et notes tenues de la fin du tour sont déjà là au début.
- Le bourdon continu a un nombre entier de périodes par tour (fréquence arrondie de moins de 0,1 cent) et sa phase se calcule
  à partir de l'échantillon, modulo le tour ; ses modulations (respiration du filtre) ont une période qui divise le tour.
- Le bruit de chaque note vient d'une graine propre à la note, la même à chaque tour.
- Chaque fichier garde **1 s de marge** avant et après la boucle (fin de la boucle avant, début après). Lecture : Web Audio,
  `loopStart = debutBoucle`, `loopEnd = finBoucle` (`musique/boucles.json`). Si un navigateur décale le décodage de quelques
  millisecondes, les deux points se décalent ensemble dans une zone qui se répète : le raccord reste parfait.
- Avec une balise `<audio loop>`, le MP3 laisse un petit blanc au raccord : ne pas l'utiliser pour ces fichiers.
