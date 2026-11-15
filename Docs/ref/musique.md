# Musique du site — relevé du jeu et règles d'intégration

## 1. Musique du menu principal du jeu (relevé)

Source : dépôt `Nowyyy/Z-Survival`, **branche `dev`**, commit **`3c25e3a`** (2026-11-14 22:18 +0100, « Update seed.md »),
lu en lecture seule dans un clone temporaire hors de ce dépôt. Fichiers lus :
`js/core/musique-menu.js` (partition), `js/menu/sons/musique.js` (lecture Web Audio), `data/menu/sons.json` (bloc `musique`),
`data/menu/sons-choix.json` (variante retenue), `Docs/ref/sons-menu.md`, `Docs/lots/lot-8i.md` ;
pour la mélodie de début de manche : `data/game/sounds.json` (son `vague-annonce`), `data/game/splash.json`.

### Comment elle est faite
- **Aucun fichier audio** : la musique est générée par du code (lot 8i du jeu). Une **partition pure**
  (`js/core/musique-menu.js` : pour chaque mesure, les notes de chaque couche et le niveau des couches, tirés d'une graine)
  est jouée **en temps réel** par des nœuds Web Audio (`js/menu/sons/musique.js`), programmés une seconde à l'avance.
- Trois variantes existent ; le propriétaire a choisi à l'oreille la **variante C** (`sons-choix.json` : `"musique": "C"`) :
  « plus tendue (96) : ostinato en croches et tic métallique ». A (ré mineur, 80) et B (60, nappes et cloches) restent dans les données.
- Brief d'origine du propriétaire : musique des menus « **un peu stressante, mais pas trop** ».

### Variante C (celle du menu)
| Élément | Valeur |
|---|---|
| Tempo | **96 à la noire**, 4 temps (mesure de 2,5 s) |
| Tonalité | **mi mineur** (tonique MIDI 40 = mi 1, 82,4 Hz), couleurs chromatiques : seconde mineure (fa), triton (si♭), tierce mineure, quinte, septième mineure |
| Tour complet | 36 mesures = **90 s**, puis la boucle repart ; les motifs, accords et cloches changent d'un tour à l'autre (graine 34) |
| Structure | 6 sections : 4 mesures d'entrée (bourdon, souffle, cloches, tic) · 8 (pouls, ostinato, tic) · 8 (tout, nappe) · 4 de respiration (sans pouls : nappe et cloches) · 8 (tout) · 4 de retour vers l'entrée. Pendant la 1re mesure d'une section, les niveaux glissent depuis ceux de la section précédente (jamais d'à-coup, au bouclage compris) |
| Volume | gain de mélange 0,5, entrée en fondu de 2,5 s, baisse à 35 % pendant une ouverture de caisse, fondu de 1,2 s à « JOUER » |

### Timbres (couches)
| Couche | Fabrication |
|---|---|
| **Bourdon** (continu) | deux dents de scie sur la tonique désaccordées de ±6 cents, un triangle à la quinte, un sinus à l'octave, dans un passe-bas (Q 0,9) qui « respire » 3 fois par tour entre 200 et 520 Hz |
| **Pouls** | battement de cœur grave : sinus de 62 Hz à chute de hauteur (×3,2 → ×1 en 50 ms) doublé d'un triangle à l'octave ; motifs « coup, contrecoup » (temps 0, 1,5, 2 ou 0, 0,75, 2, 3,5) |
| **Ostinato** | triangle pincé deux octaves au-dessus de la tonique, en croches, passe-bas qui se referme (décroissance 0,16 s) ; motifs du type `0 0 3 0 7 0 3 1`, `0 7 6 7 3 7 1 7` (demi-tons) |
| **Nappe** | accord tenu toutes les 2 mesures, deux dents de scie à ±7 cents dans un passe-bas ; accords dissonants : mineur, `0 1 6` (seconde mineure + triton), `-1 3 6` |
| **Cloche** | rare (30 % des mesures), partiels inharmoniques 1 · 2,76 · 5,4, trois octaves au-dessus de la tonique, notes 0, 3, 6, 7 |
| **Souffle** | bruit blanc dans un passe-bande (400 à 1 500 Hz), qui enfle et retombe sur 2 mesures |
| **Tic** | battue métallique : bruit passe-haut (5 kHz) très court, en croches, 70 % de probabilité |
| **Écho** | ligne à retard de ¾ de temps, réinjectée à 35 % dans un passe-bas de 1 800 Hz (ostinato, cloche, tic) |

### Ambiance
Sombre et feutrée, pulsée comme un cœur qui bat un peu trop vite ; pas de mélodie chantante : c'est l'ostinato et ses
demi-tons (seconde mineure, triton) qui portent la tension, la nappe dissonante et les cloches lointaines donnent l'espace.
Mono, sans réverbération (seulement l'écho).

### Mélodie de début de manche (référence pour la version « horreur »)
Son `vague-annonce` (`data/game/sounds.json`, 3 variantes jouées tour à tour, 3,8 s) :
bourdon de deux dents de scie à **55 et 55,8 Hz** (la, battement lent) dans un passe-bas qui s'ouvre (180 → 420 Hz) ;
**quatre coups de cloche** espacés de 0,6 s (partiels 220 · 607 · 1 188 · 1 958 Hz) : la, si♭, mi, mi♭ (variante 1 :
unisson, seconde mineure, quinte, triton) ; **bruit rose qui enfle** pendant 3 s (passe-bande 200 → 2 500 Hz) ;
puis un **coup sourd** (sinus 55 → 45 Hz) et un claquement aigu ; réverbération courte, légère saturation.

## 2. Règles prévues pour l'intégration (lot 2)
**Morceau retenu par le propriétaire (15/11/2026) : M2 — Ambiante** (`musique/M2.mp3`, boucle de 96 s, 60 à la noire,
mi mineur ; points de boucle dans `musique/boucles.json`). M1 et M3 restent sur la planche et dans `outils/musique/`.

- **Musique coupée au départ.** Aucun son avant un geste (règle des navigateurs, et choix du jeu).
- **Bouton haut-parleur dans l'en-tête, à côté du globe** de langue (même taille, zone de toucher ≥ 44 px si possible,
  nom accessible traduit dans `js/textes.js`, état `aria-pressed`). Icône barrée quand la musique est coupée.
- **Lancement seulement après un clic sur ce bouton**, puis **montée en douceur** (fondu d'entrée de 2 à 3 s, comme le jeu) ;
  coupure par un fondu court (≈ 0,3 s).
- **Le son ne part que par ce bouton** (décision du propriétaire) : jamais au premier clic ou toucher ailleurs sur la page.
- **Coupure mémorisée** (décision du propriétaire) : un visiteur qui coupe le son avec ce bouton le retrouve coupé aux visites
  suivantes (`localStorage`, lecture et écriture protégées par `try/catch` ; sans stockage, simplement coupé à chaque visite).
- **Pause quand l'onglet est caché** (`visibilitychange`), reprise au retour, avec fondus courts.
- **Volume modéré** : gain de lecture ≈ 0,4 au départ, à régler à l'oreille (fourchette 0,35 à 0,5) (fichiers normalisés vers −18 LUFS, voir `Docs/lots/lot-1b.md`).
- **Lecture** : fichier MP3 pré-rendu (aucune musique générée dans la page), chargé seulement après le clic, décodé et
  joué par Web Audio (`AudioBufferSourceNode`, `loop = true`, `loopStart` / `loopEnd` lus dans `musique/boucles.json`) :
  c'est la seule lecture **sans blanc au raccord** partout (une balise `<audio loop>` laisse un petit trou avec le MP3).
  Chaque fichier contient 1 s de marge avant et après la boucle (contenu identique à la fin et au début de la boucle),
  si bien que le raccord reste parfait même si un navigateur décale le décodage de quelques millisecondes.
- **iPhone : commutateur silencieux respecté** (décision du propriétaire) : on ne touche pas à `navigator.audioSession`.
  Commutateur enclenché, Web Audio se tait, même après un clic sur le bouton ; pour entendre la musique, il faut désactiver
  le mode silencieux puis cliquer sur le bouton. (La planche d'écoute, elle, force la lecture : c'est un outil de travail.)
- Mouvement réduit : sans objet pour le son ; l'icône du bouton ne s'anime pas.
