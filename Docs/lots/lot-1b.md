# Lot 1b — Musique du site : planche d'écoute

Branche `lot-1b`, depuis `main` (`4e883cb`). Ce lot **n'ajoute aucune musique au site** : il propose trois morceaux à écouter
sur une planche. L'intégration se fera au lot 2.

Planche : https://nowyyy.github.io/Z-Survival-Website/musique/planche.html (noindex, non reliée au site).

## Ce qui a été fait

### A — Analyse de la musique du menu du jeu (`Docs/ref/musique.md`)
- Jeu lu sur la branche **`dev`**, commit **`3c25e3a`** (clone temporaire hors du dépôt, lecture seule).
- La musique du menu **n'est pas un fichier** : une partition générée par du code (graine), jouée en temps réel par Web Audio
  (lot 8i du jeu). Variante retenue par le propriétaire : **C**, mi mineur, **96 à la noire**, tour de 90 s en 6 sections ;
  bourdon de deux dents de scie désaccordées, battement de cœur grave, ostinato pincé en croches (secondes mineures, tritons),
  nappe dissonante, cloches rares, souffle, tic métallique, écho. Relevé aussi : la mélodie de début de manche (`vague-annonce`).
- Règles de l'intégration du lot 2 écrites dans la fiche (coupée au départ, bouton haut-parleur près du globe, lancement au clic
  avec fondu, choix gardé, pause onglet caché, volume modéré, lecture Web Audio sans blanc).

### B — Trois propositions (`musique/`, script dans `outils/musique/`)
| Morceau | Idée | Tempo, tonalité | Boucle | Fichier |
|---|---|---|---|---|
| **M1 — Variation du menu** | mêmes timbres, tonalité et forme que la variante C ; nouveaux motifs d'ostinato et une **vraie mélodie** de cloche (phrase, puis réponse qui revient sur la tonique) | 96, mi mineur | 90 s (36 mesures) | `M1.mp3`, **1,40 Mo** (1 473 065 octets) |
| **M2 — Ambiante** | fond de navigation discret : bourdon plus sombre, nappes longues, cloches lentes, cœur lointain, ostinato en noires au milieu seulement, plus de réverbération, aucun tic | 60, mi mineur | 96 s (24 mesures) | `M2.mp3`, **1,50 Mo** (1 569 186 octets) |
| **M3 — Tension** | côté horreur, d'après la mélodie de début de manche : bourdon la 55 / 55,8 Hz qui bat, figures de quatre coups de cloche (la, si♭, mi, mi♭…) en leitmotiv, cœur qui s'emballe, ostinato chromatique jusqu'aux doubles croches, nappe en trémolo, houles de bruit rose vers des coups sourds, plaintes qui glissent | 100 (un temps = 0,6 s, l'écart des cloches de la manche), la | 96 s (40 mesures) | `M3.mp3`, **1,50 Mo** (1 569 185 octets) |

- MP3 128 kb/s constant, 44,1 kHz stéréo (lisible partout, iPhone compris), chacun sous 2 Mo. Sonie : M1 −18,6 LUFS,
  M2 −20,4 LUFS (voulue plus discrète), M3 −18,4 LUFS ; crêtes ≤ −1,7 dBFS.
- **Génération par du code**, sans dépendance (Node + ffmpeg) : `outils/musique/partitions.mjs` (la musique, à retoucher ici),
  `moteur.mjs` (synthèse des timbres du jeu, écho, réverbération, limiteur), `generer.mjs` (WAV → MP3 → `musique/boucles.json`).
  Déterministe : une nouvelle génération redonne exactement les mêmes fichiers (vérifié). Mode d'emploi : `outils/musique/LISEZMOI.md`.
- **Boucle parfaite par construction** : le même tour est rendu trois fois et le deuxième est découpé (échos et notes tenues de la
  fin déjà présents au début) ; bourdon à nombre entier de périodes par tour ; bruit à graine par note. Chaque fichier garde **1 s de
  marge** avant et après la boucle ; points de boucle dans `musique/boucles.json` (début 1 s, fin 91 ou 97 s).

### C — Planche d'écoute (`musique/planche.html`, `planche.css`, `planche.js`)
- Pour chaque morceau : description, durée, tempo, taille ; **Lecture / Pause** (la position est gardée) ; **« Écouter le raccord »**
  (5 dernières secondes, retour au début, 5 s du début, arrêt en fondu, avec un message « retour au début dans … s » puis
  « raccord passé ») ; barre de position et numéro du tour. **Un seul morceau à la fois** ; pause si l'onglet est caché.
- Lecture **Web Audio** (celle prévue au lot 2) : seul moyen d'avoir un raccord sans blanc avec du MP3.
- Téléphone d'abord (375 px), couleurs et polices du site (`css/base.css`), marquée « page de travail provisoire ».
  Textes en français dans `planche.js` (page de travail pour le propriétaire, hors `js/textes.js` du site).
- `pages.yml` publie désormais aussi `musique/`. La page est en `noindex, nofollow` et aucun lien du site n'y mène.

## Vérifications (partie D)
- **Périodicité du rendu** (avant compression) : marges identiques à la fin et au début de la boucle à 10⁻⁷ près (M1) ou exactement (M2, M3).
- **Raccord des MP3 décodés** (`node outils/musique/verifier-boucle.mjs`, ffmpeg) :

| Morceau | Décalage du décodage | Périodicité des marges | Témoin décalé de 10 ms | Saut au raccord / sauts ordinaires | 5 ms les plus faibles au raccord | Écart avec la suite naturelle |
|---|---|---|---|---|---|---|
| M1 | 0 échantillon | −30,7 dB | +2,8 dB | 0,0010 / 0,0380 | −8,6 dB sous la médiane | −31,5 dB (bruit de compression) |
| M2 | 0 | −35,6 dB | +1,4 dB | 0,0020 / 0,0256 | −4,4 dB | −55,2 dB |
| M3 | 0 | −39,1 dB | +4,4 dB | 0,0011 / 0,0487 | −10,1 dB | identique |

  Lecture : le passage « fin → début » est indiscernable de la suite naturelle du fichier ; le saut au raccord est 20 à 40 fois plus
  petit que les sauts ordinaires d'un échantillon à l'autre ; aucune fenêtre de 5 ms ne tombe dans le silence (un blanc donnerait
  −60 dB ou moins). M2 et M3 durent un nombre entier de trames MP3 (96 s = 3 675 × 1 152 échantillons), d'où un raccord encore plus
  exact que M1 (90 s).
- **Playwright** (`node outils/musique/verifier-planche.mjs`, Chromium), sur une **copie exacte de ce que publie le workflow** servie
  sous `/Z-Survival-Website/` : **44 vérifications réussies sur 44** — planche au téléphone (375 × 667), à l'ordinateur (1440 × 900)
  et en mouvement réduit : chargement, noindex, pas de défilement horizontal, lecture des trois morceaux, pause et reprise, un seul
  morceau à la fois, raccord (départ 5 s avant la fin, retour au début, arrêt seul), pause onglet caché ; **décodage par Chromium**
  (longueurs exactes : Chromium retire le délai de l'encodeur) et **lecture en boucle Web Audio rendue hors ligne** autour du raccord :
  mêmes résultats qu'avec ffmpeg ; aucune erreur console, aucun fichier manquant.
- **Site inchangé** : `git diff main` vide sur `index.html`, `main.html`, `css/`, `js/`, `fonts/`, `img/` ; l'accueil charge sans erreur
  au téléphone et à l'ordinateur et ne pointe pas vers `musique/`.

## Limites
- **Aucun morceau n'a été écouté par l'agent** : les contrôles portent sur les fichiers (raccord, niveaux, spectre), pas sur le goût.
  Le jugement à l'oreille revient au propriétaire.
- Testé dans Chromium seulement (pas Safari iOS ni Firefox) ; la lecture Web Audio du MP3 est standard sur iPhone, mais non essayée ici.
- Sur la planche, l'iPhone joue même commutateur silencieux enclenché (`navigator.audioSession`, Safari 17 et plus) ; plus ancien : le
  commutateur coupe le son.
- Mémoire : un morceau décodé occupe environ 35 Mo (stéréo, flottants) ; acceptable pour un seul morceau à la fois.
- Basses (bourdon, battement de cœur) peu audibles dans le haut-parleur d'un téléphone : à écouter au casque, puis au haut-parleur.
- M1 passe un peu par le limiteur (5 % du temps, au plus −2,6 dB sur les coups) ; M2 et M3 jamais.
- Tag `lot-1b` créé localement mais **refusé au push** (403 de l'environnement, comme le tag `lot-0`) ; la branche est poussée.
- MP3 à 128 kb/s (pour tenir sous 2 Mo avec des boucles d'1 min 30) : fidélité correcte, pas transparente.

## Décisions du propriétaire (15/11/2026, après la fusion)
- **M2 — Ambiante est retenue** pour le site (marquée « Retenue » sur la planche ; M1 et M3 y restent pour mémoire).
- **Coupure mémorisée** : un visiteur qui coupe le son avec le petit bouton à côté de la langue le retrouve coupé ensuite.
- **Le son ne part que par ce bouton.**
- **Commutateur silencieux de l'iPhone respecté** : pour avoir le son, on clique sur le bouton (mode silencieux désactivé).
- Pas de retouche demandée sur M2 ; volume de départ proposé (≈ 0,4) à régler au lot 2.
Ces règles sont reportées dans `Docs/ref/musique.md` (partie 2).

## À choisir par le propriétaire (questions posées à la fin du lot ; réponses ci-dessus)
1. **Quel morceau** garder pour le site : M1, M2 ou M3 (ou un mélange : par exemple la mélodie de M1 dans l'ambiance de M2).
2. Ce qu'il faut **changer** dans le morceau gardé : tempo, place de la mélodie, force du bourdon ou du battement de cœur, durée de la boucle.
3. **Au retour d'un visiteur** qui avait activé la musique : relancer au premier clic n'importe où sur la page, ou seulement au clic
   sur le haut-parleur ?
4. **iPhone** : respecter le commutateur silencieux (proposé) ou jouer quand même ?
5. **Volume** de départ proposé : gain de 0,4 environ (fichiers à −18 LUFS), à régler à l'oreille au lot 2.
