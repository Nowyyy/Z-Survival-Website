# Lot 2a — Musique du site : intégration de M2 avec son bouton

Branche `lot-2a`, depuis `main` (`8e73fed`, lot 1 et lot 1b fusionnés). Règles : `Docs/ref/musique.md` (partie 2, règles 1 à 9).
La planche `musique/planche.html` est restée telle quelle.

## Ce qui a été fait

### A — Documentation
- `Docs/ref/musique.md`, partie 2 : les **règles 1 à 9** validées, numérotées, plus la description du bouton. La règle
  « commutateur silencieux respecté » est remplacée par la **règle 4 : commutateur ignoré** (`navigator.audioSession.type = "playback"`
  avant la lecture, Safari 17 et plus).
- `Docs/lots/lot-1b.md`, « Décisions du propriétaire » : l'ancienne ligne est gardée et suivie de « annulé (lot 2a) », plus une ligne
  datée du 15/11/2026 qui décrit la nouvelle règle.
- Le reste de `Docs/` ne parle pas de la musique : aucune contradiction trouvée. `CLAUDE.md` mentionne maintenant `js/musique.js`.

### B — Musique et bouton de son
- **`js/musique.js`** (module à part, chargé par `index.html` après `js/site.js` ; aucune autre logique touchée) :
  - toujours **coupée au chargement**, aucun contexte audio créé tant qu'on n'a pas cliqué ;
  - **premier clic** sur une icône de son : `navigator.audioSession.type = "playback"` si possible, création et relance du contexte audio
    dans le geste (exigé par Safari iOS), puis **téléchargement** de `musique/boucles.json` et `musique/M2.mp3` (**rien avant**),
    décodage, lecture Web Audio en boucle (`loopStart` / `loopEnd` de `boucles.json`, comme sur la planche) ;
  - **montée de 1,5 s** jusqu'au volume, **descente de 0,5 s** à la coupure, puis le contexte audio est suspendu (la musique reprend
    au même endroit au clic suivant, sans nouveau téléchargement) ;
  - **onglet caché** : descente courte (0,2 s) et suspension ; au retour, reprise avec montée, **seulement si la musique jouait** ;
  - **choix gardé** dans `localStorage` (`z-survival-site.musique` = `activee` / `coupee`, protégé par `try/catch`) ; il ne relance
    jamais la musique au chargement (règle 1) ;
  - **volume : `export const VOLUME = 0.4;`**, en tête du fichier ;
  - plusieurs clics rapprochés, coupure pendant le chargement, onglet caché pendant le chargement : gérés (la dernière demande gagne).
- **Boutons de son** (`index.html`) : un **à côté de chaque globe**, à gauche (accueil, coin haut droit ; en-tête, entre « Bientôt
  disponible » et le globe). Même allure que le globe (pastille sombre, contour os, flou d'arrière-plan) :
  - **coupé** : haut-parleur barré d'une croix rouge ;
  - **chargement** : haut-parleur rouge et petit cercle en pointillés qui tourne (`aria-busy="true"`) ;
  - **lecture** : haut-parleur rouge plein, **deux ondes qui battent**, contour rouge et halo (immobiles en mouvement réduit).
  - Les deux boutons partagent le même état. `aria-pressed`, intitulé traduit (`musique.activer` / `musique.couper` dans
    `js/textes.js` : « Activer la musique » / « Couper la musique », « Turn music on » / « Turn music off »), remis dans la bonne langue
    à chaque changement de langue.
  - **Zone de clic ≥ 44 × 44 px** partout : 44 px sur l'accueil ; dans l'en-tête, bouton dessiné en 40 px (38 px au téléphone) avec une
    zone de clic invisible élargie à 44 px.
- **En-tête du téléphone** : pour faire de la place au bouton, jusqu'à 420 px le logo et « Bientôt disponible » sont un peu plus petits ;
  jusqu'à 360 px, « Bientôt disponible » passe sur deux lignes (sinon il chevauchait le logo en français).
- `pages.yml` publie toujours `musique/` (inchangé : `cp -r index.html main.html css js fonts img musique scene .nojekyll _site/`).

### C — Vérifications
- `outils/musique/verifier-site.mjs` (Playwright, Chromium), sur une **copie exacte de ce que publie le workflow** servie sous
  `/Z-Survival-Website/` : **133 vérifications sur 133 réussies**, au téléphone (375 × 667) et à l'ordinateur (1440 × 900), avec et sans
  `prefers-reduced-motion`, plus l'en-tête à 320 px en français :
  - **aucune requête vers `musique/`** avant le premier clic ; au chargement : coupée, icône barrée, **aucun contexte audio** ;
  - clic : état **« chargement »** sur les deux boutons (téléchargement ralenti exprès pour le voir), puis **lecture** : contexte en marche,
    **gain qui monte** (≈ 0,11 à 0,4 s, puis 0,400) ; `boucles.json` et `M2.mp3` téléchargés une seule fois ;
  - second clic (bouton de l'en-tête) : **descente** (gain intermédiaire à 0,2 s), puis gain 0 et contexte suspendu ; nouveau clic :
    reprise **sans nouveau téléchargement** ;
  - **boutons synchronisés** (accueil et en-tête) en français et en anglais, intitulés traduits ; zone de clic de 44 px vérifiée par des
    clics simulés à 21 px du centre ;
  - **rechargement** pendant la lecture : coupée, aucun contexte audio, aucun téléchargement (alors que le choix gardé vaut « activee ») ;
  - **onglet caché** pendant la lecture : pause (contexte suspendu), puis reprise au retour ; onglet caché alors qu'elle est coupée :
    rien ne repart ;
  - **ondes animées**, et immobiles en mouvement réduit ; **en-tête sans chevauchement** (320, 375, 1440 px ; mesuré aussi à 340, 361,
    390, 414, 430 et 600 px) ;
  - **boucle** : M2 décodé par Chromium, lecture en boucle Web Audio rendue hors ligne autour du point de boucle : passage fin → début
    **identique** à la suite naturelle du fichier, aucun saut, aucun blanc (même méthode qu'au lot 1b) ;
  - **reste du site** : navigation (clic sur « Armes »), clavier (Fin, flèche haut), changement de langue, défilement par sections, la
    musique continue pendant la navigation ; **aucune erreur console, aucun fichier manquant**.
- `outils/musique/verifier-planche.mjs` (lot 1b) relancé : 44/44 (la planche n'a pas changé ; la préparation de la copie publiée est
  maintenant partagée dans `outils/copie-publiee.mjs`).
- Vérifications refaites **en ligne** après la fusion (voir plus bas).

## Limites
- **Safari iOS non testé ici** (Chromium seulement) ; `navigator.audioSession` n'existe que sur Safari 17 et plus : sur un iPhone plus
  ancien, le commutateur silencieux coupe la musique (accepté).
- **iPhone d'avant iOS 17** et vieux Android : non essayés. Le code garde la forme ancienne de `decodeAudioData` et `webkitAudioContext`.
- Mémoire : M2 décodée occupe environ 35 Mo (stéréo, flottants), seulement après le clic.
- Un appel téléphonique ou une autre application audio peut interrompre la musique sur téléphone ; elle ne reprend pas seule tant que
  l'onglet reste visible (un clic sur le bouton coupe, un second relance).
- L'intitulé change avec l'état **et** `aria-pressed` est posé, comme demandé ; certains lecteurs d'écran annonceront donc
  « Couper la musique, enfoncé ».
- Tag `lot-2a` : créé localement, push refusé (403 de l'environnement, comme pour les lots précédents).

## À tester à l'oreille (iPhone et Android)
1. **Volume** : à côté d'une vidéo ou d'un autre site, M2 doit rester un fond discret. Trop fort ou trop faible : changer `VOLUME`
   (0,4) en tête de `js/musique.js` (par exemple 0,3 ou 0,5).
2. **Mode silencieux de l'iPhone** (iOS 17 et plus) : commutateur enclenché, un clic sur le bouton doit faire entendre la musique.
3. **Raccord de la boucle** : laisser jouer plus de 1 min 36 s ; aucun blanc ni saut au retour au début (la planche permet de l'écouter
   directement : « Écouter le raccord » sur M2).
4. **Montée et descente** : douces, sans claquement, au clic et en changeant d'application (onglet caché puis revenu).
5. **Chargement** : sur une connexion lente (4G), le cercle en pointillés tourne pendant le téléchargement de 1,5 Mo, puis la musique part.
6. **Rechargement** : la page rouverte est toujours muette jusqu'au clic.

## Retour du propriétaire (15/11/2026, branche `accueil-bientot`)
- **« Bientôt disponible » aussi en haut à droite de l'accueil**, comme dans l'en-tête des autres sections : rangée
  « Bientôt disponible » · son · globe. Jusqu'à 420 px, le globe de l'accueil perd son code « FR / EN » (comme dans l'en-tête) pour
  laisser la place au logo du studio ; entre 900 et 1023 px, la mention « Image animée — à venir » passe sous la rangée.
- `verifier-site.mjs` contrôle aussi cette rangée (présence, traduction, aucun chevauchement de 320 à 1440 px) : 150/150.
- **Encart « Coming soon » des sections 03 Personnages et 04 Armes traduit en français : « Prochainement »** (« Coming soon » reste
  en anglais) ; « Prochainement » plutôt que « Bientôt disponible » pour ne pas répéter l'étiquette de l'en-tête juste au-dessus.
  `CLAUDE.md` mis à jour. `verifier-site.mjs` : 158/158.
