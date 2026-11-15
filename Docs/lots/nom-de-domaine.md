# Nom de domaine — www.zsurvival-game.com

Branche `nom-de-domaine`, depuis `main` (`9354453`, lot 3b fusionné). Référence : `Docs/ref/nom-de-domaine.md`.

## Déjà fait par le propriétaire (avant ce lot)
- Domaine `zsurvival-game.com` acheté chez OVH (compte particulier, serveurs DNS par défaut, DNSSEC, boîte Zimbra Starter incluse ;
  DNS Anycast et hébergement OVH non pris). Coordonnées vérifiées, renouvellement automatique activé, boîte `contact@` créée.
- Domaine **vérifié chez GitHub** (ligne TXT `_github-pages-challenge-nowyyy`).
- **Zone DNS** : lignes de la page d'attente OVH retirées (`@` A et TXT, `www` A et TXT, `ftp`), 4 lignes A et 4 lignes AAAA de
  GitHub Pages sur `@`, CNAME `www` → `nowyyy.github.io.` ; lignes de la boîte mail et NS gardées. Contrôlé sur capture.

## Ce qui a été fait
### A — Documentation
- `Docs/ref/nom-de-domaine.md` : branchement, zone DNS complète (et lignes à ne jamais toucher), réglages Pages, ce qui dépend du
  domaine dans le code, suites possibles (`api.` facultatif), problèmes courants et retour en arrière.
- `CLAUDE.md` (adresse du site, règle des chemins relatifs reformulée), `README.md`, `Docs/ref/serveur.md` (CORS),
  `Docs/ref/admin.md` (adresses de l'admin et des actualités).

### B — Serveur
- `serveur/src/app.js` : `ORIGINES_SITE` = `https://www.zsurvival-game.com` + `https://nowyyy.github.io` (transition) ;
  `ADRESSE_SITE` (adresse publique renvoyée après l'envoi d'une image) = `https://www.zsurvival-game.com/`.
- Tests : nouvelle origine acceptée (préflight et lecture), ancienne encore acceptée, refusées : domaine nu, `http://`, faux
  domaines (`….exemple.com`, `exemple-zsurvival-game.com`), autre sous-domaine.

### Site
- **Aucun fichier du site modifié** : chemins relatifs partout, adresse du serveur inchangée (`js/config.js` et CSP de l'admin).

## Vérifications (avant la fusion)
- `npm test` (serveur) : **47/47**.
- `outils/admin/verifier-actus.mjs` (vrai serveur sur SQLite, site et admin dans Chromium) : **207/207**.
- La session ne peut pas joindre `zsurvival-game.com` (proxy) : les contrôles en ligne du domaine sont faits par le propriétaire.

## Limites
- Les choix gardés par les visiteurs (langue, musique) sont liés à l'adresse : à refaire une fois sur le nouveau domaine.
- Le certificat HTTPS de GitHub peut mettre jusqu'à 24 heures à arriver après la déclaration du domaine.
- Testé seulement dans Chromium, comme les lots précédents.

## Étapes du propriétaire après la fusion
1. Attendre la coche verte du workflow **serveur** (il déploie la nouvelle liste d'origines ; l'agent la vérifie).
2. GitHub → dépôt → **Settings → Pages** → *Custom domain* : `www.zsurvival-game.com` → **Save** ; attendre « DNS check successful ».
3. Cocher **Enforce HTTPS** dès que la case est disponible (quelques minutes, jusqu'à 24 heures).
4. Ouvrir https://www.zsurvival-game.com/ (accueil, actualités), https://zsurvival-game.com/ (doit mener à `www`),
   https://nowyyy.github.io/Z-Survival-Website/ (doit mener au domaine) et https://www.zsurvival-game.com/admin/ (connexion).

## Suite (15/11/2026) : adresse principale sans `www`
- Le domaine a été déclaré en `www.zsurvival-game.com`, le certificat HTTPS est arrivé et le site fonctionnait (constaté par le propriétaire).
- À la demande du propriétaire, l'adresse principale devient **https://zsurvival-game.com/** (branche `domaine-sans-www`) :
  `ORIGINES_SITE` = domaine sans `www` + `www` + `nowyyy.github.io` ; `ADRESSE_SITE` = `https://zsurvival-game.com/` ; tests 47/47 ;
  documentation mise à jour. Zone DNS inchangée.
- Étape du propriétaire après le déploiement du serveur : Settings → Pages → *Custom domain* = `zsurvival-game.com` → Save, puis
  Enforce HTTPS dès que possible (nouveau certificat).
