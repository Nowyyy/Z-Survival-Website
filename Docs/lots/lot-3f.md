# Lot 3f — Aperçu de partage modifiable depuis l'admin, contact, encart de l'accueil

Branche `lot-3f`, depuis `main` (`61a2d12`). Trois demandes du propriétaire, le 16/11/2026 :
1. sur iPhone, site enregistré comme application, l'encart « Disponible sur navigateur » mord sur le titre ;
2. changer le texte de l'aperçu de partage (Discord, WhatsApp), et pouvoir le changer à volonté depuis l'admin ;
3. ajouter l'adresse du site, `contact@zsurvival-game.com`, en bas du site, à côté du ©.

## Ce qui a été fait

### A — Serveur (`serveur/src/partage.js`, routes `GET` et `PUT /api/admin/partage`)
- Les réseaux ne lisent que le HTML : le texte de partage vit dans les balises Open Graph et Twitter d'`index.html`. Le serveur lit
  `index.html` dans le dépôt et ne change que la valeur `content` de **quatre balises** (`og:title`, `twitter:title`, `og:description`,
  `twitter:description`), par l'API GitHub (même jeton que les images et le bandeau) : un commit « Z-Survival admin » sur `main`, en ligne
  environ une minute plus tard.
- Titre 90 caractères au plus, description 300 ; texte brut sur une ligne, échappé pour le HTML (`&`, `"`, `<`, `>`).
- **409** si `index.html` a changé depuis la lecture (rien n'est écrasé) ; 502 si une balise manque (rien n'est écrit) ; 503 sans jeton.

### B — Admin (`admin/index.html`, `admin/admin.js`, `admin/admin.css`)
- **Pages du site → Modifier l'aperçu de partage (Discord, WhatsApp…)**, sous le bandeau d'alerte :
  - titre et description, avec compteurs ;
  - aperçu à la manière de Discord (nom du site, titre, description, image de partage), à jour pendant la frappe ;
  - « Annuler les changements », « Enregistrer et publier » ;
  - statut « En ligne » / « Non enregistré », confirmation avant de quitter, texte gardé pendant une expiration de session.

### C — Site
- **Nouveau texte de partage** : « La nuit tombe, les morts se relèvent. Serez-vous en mesure de survivre ? Z-Survival, Top-Down Shooter avec
  une dose de gacha par No Way Studio, bientôt disponible sur navigateur. » Deux corrections d'écriture : « Serez vous » → « Serez-vous »,
  « Z survival » → « Z-Survival ». Le titre ne change pas.
- `index.html` devient la **seule source** du titre et de la description de partage : leur copie dans `js/textes.js` (`partage.*`) est
  retirée, pour que l'admin et le site ne se contredisent jamais. `outils/verifier-lot-4a.mjs` vérifie maintenant que les balises og et twitter
  sont identiques (au lieu de les comparer à `js/textes.js`).
- **Encart « Disponible sur navigateur »** (portrait, avec le bandeau) : sa position comptait le bas de l'écran sans la marge de l'iPhone. En
  mode application, cette marge (barre d'accueil, environ 34 px) fait remonter le titre de 26 px, l'encart restait en place : il mordait de
  **15 px** sur le Z. Il remonte maintenant d'autant (`css/accueil.css`) : 11 px d'écart, avec ou sans marge.
- **Pied de page** : « Contact : contact@zsurvival-game.com » (« Contact: » en anglais), lien mailto (`studio.contact` dans `js/textes.js`) ;
  e-mail ajouté aux données structurées du studio (JSON-LD, `Organization.email`).

## Vérifications
- **Tests du serveur** : **86/86** (8 nouveaux : connexion, lecture, écriture des seules quatre balises avec échappement, relecture, 409,
  contrôles, jeton jamais exposé, 503 sans jeton, balise manquante).
- **`outils/verifier-lot-3f.mjs`** (nouveau, banc local : vrai serveur, API GitHub simulée qui écrit dans la copie du site) : **32/32**.
  - Admin : lecture d'`index.html`, aperçu et compteurs, « Annuler », description vide refusée, enregistrement (4 lignes changées, og et
    twitter, échappement, commit « Z-Survival admin »), page servie à jour, 409 si `index.html` change entre-temps ; rien ne dépasse à 320 et
    1440 px.
  - Pied de page : lien mailto, libellé FR / EN, e-mail dans le JSON-LD, à 320, 375 et 1440 px.
  - Encart : marge basse de l'iPhone **simulée** par Chromium (`Emulation.setSafeAreaInsetsOverride`), à 430 × 932, 393 × 852, 390 × 844 (34 px)
    et 430 × 932, 375 × 667, 320 × 568 (sans marge), FR et EN : 10 à 11 px d'écart partout. Avant la correction, -15 px à 430 × 932.
- Contrôles des lots précédents, tous relancés :

| Contrôle | Résultat |
|---|---|
| `outils/verifier-lot-4a.mjs` | **80/80** |
| `outils/video/verifier-accueil.mjs` | **174/174** |
| `outils/admin/verifier-bandeau.mjs` | **29/29** (l'ordre attendu des boutons de « Pages du site » inclut le nouveau) |
| `outils/admin/verifier-actus.mjs` | **245/245** |
| `outils/musique/verifier-site.mjs` | **158/158** |

## Limites
- Discord et WhatsApp gardent l'ancien aperçu en mémoire quelques jours (astuce : partager `https://zsurvival-game.com/?v=2`).
- Le texte de partage est en français seulement (une seule version lue par les réseaux).
- Un enregistrement depuis l'admin fait un commit sur `index.html` : un lot en cours qui modifie aussi la tête de la page devra repartir de
  `main` à jour (les autres lignes ne bougent pas).
- L'encart a été vérifié avec une marge d'écran simulée dans Chromium, pas sur un vrai iPhone.

## À tester toi-même
1. **iPhone, site enregistré comme application** : l'encart ne touche plus le « Z » du titre.
2. **Admin → Pages du site → Modifier l'aperçu de partage** : le nouveau texte y est. Le changer, enregistrer, puis partager
   `https://zsurvival-game.com/?v=2` dans Discord pour voir l'aperçu.
3. **Bas du site** (À propos, pied de page) : « Contact : contact@zsurvival-game.com », qui ouvre la messagerie.

## État git
- Commits `lot-3f A` à `lot-3f D` sur la branche `lot-3f`, PR vers `main` fusionnée par l'agent. Le push touche `serveur/` (le workflow
  « serveur » redéploie) et le site (GitHub Pages republie).
- Tag `lot-3f` créé en local ; son envoi sur GitHub est refusé par l'environnement de l'agent.
