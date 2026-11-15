# Nom de domaine du site — zsurvival-game.com

- Adresse du site : **https://www.zsurvival-game.com/**, toujours servi par **GitHub Pages** (workflow `pages.yml`, inchangé).
- Domaine acheté chez **OVH** (compte particulier, novembre 2026, renouvellement automatique activé). Zone DNS gérée par OVH
  (« serveurs DNS par défaut »).
- Boîte mail du studio sur le même domaine (Zimbra Starter, incluse avec le domaine) : ses lignes DNS ne doivent jamais être touchées.
- Le **serveur** (Cloud Run) garde son adresse `…run.app` : il n'a pas besoin du domaine (`Docs/ref/serveur.md`).
- Le jeu reste à son adresse : https://nowyyy.github.io/Z-Survival/ (autre dépôt, non concerné).

## Comment c'est branché

```
 www.zsurvival-game.com ──CNAME──▶ nowyyy.github.io ──▶ GitHub Pages ──▶ site du dépôt Nowyyy/Z-Survival-Website
 zsurvival-game.com ──A/AAAA (GitHub Pages)──▶ GitHub redirige vers https://www.zsurvival-game.com/
 nowyyy.github.io/Z-Survival-Website/… ──▶ GitHub redirige vers https://www.zsurvival-game.com/…
```

1. **Domaine vérifié chez GitHub** (réglages du compte Nowyyy → Pages → Verified domains) : personne d'autre ne peut l'utiliser
   pour un site GitHub Pages. La ligne TXT `_github-pages-challenge-nowyyy` doit **rester pour toujours** dans la zone DNS.
2. **Zone DNS chez OVH** (Web Cloud → Noms de domaine → zsurvival-game.com → Zone DNS) :

| Sous-domaine | Type | Cible | Rôle |
|---|---|---|---|
| *(vide, « @ »)* | A | `185.199.108.153` | GitHub Pages (IPv4) |
| *(vide)* | A | `185.199.109.153` | GitHub Pages (IPv4) |
| *(vide)* | A | `185.199.110.153` | GitHub Pages (IPv4) |
| *(vide)* | A | `185.199.111.153` | GitHub Pages (IPv4) |
| *(vide)* | AAAA | `2606:50c0:8000::153` | GitHub Pages (IPv6) |
| *(vide)* | AAAA | `2606:50c0:8001::153` | GitHub Pages (IPv6) |
| *(vide)* | AAAA | `2606:50c0:8002::153` | GitHub Pages (IPv6) |
| *(vide)* | AAAA | `2606:50c0:8003::153` | GitHub Pages (IPv6) |
| `www` | CNAME | `nowyyy.github.io.` | GitHub Pages |
| `_github-pages-challenge-nowyyy` | TXT | *(code donné par GitHub)* | vérification du domaine |

   Quatre adresses de chaque sorte : GitHub Pages a quatre points d'entrée (si l'un tombe, les navigateurs passent par un autre).
   **À ne jamais toucher** : `@` NS (serveurs DNS d'OVH), `@` MX, `@` SPF, `ovhmo-selector-1/2._domainkey` (DKIM),
   `_autodiscover._tcp` (SRV) : la boîte mail.
   Lignes d'OVH retirées (page d'attente de l'hébergement OVH, non utilisé) : `@` A et TXT, `www` A et TXT, `ftp` CNAME.
3. **Réglages Pages du dépôt** (Settings → Pages) : *Custom domain* = `www.zsurvival-game.com`, **Enforce HTTPS** coché.
   Avec le déploiement par GitHub Actions, aucun fichier `CNAME` n'est nécessaire dans le dépôt : le domaine est gardé dans ces réglages.
   Certificat HTTPS fourni et renouvelé automatiquement par GitHub (Let's Encrypt).

## Ce qui en dépend dans le code
- **Site** : rien. Tous les chemins sont relatifs (règle de `CLAUDE.md`) : le site marche à la racine du domaine comme sous
  `/Z-Survival-Website/` (copies de vérification des outils, ancienne adresse).
- **Serveur** (`serveur/src/app.js`) : `ORIGINES_SITE` (CORS) contient `https://www.zsurvival-game.com` et, pendant la transition,
  `https://nowyyy.github.io` ; `ADRESSE_SITE` (adresse publique des images envoyées) = `https://www.zsurvival-game.com/`.
  Le domaine nu `https://zsurvival-game.com` n'est pas autorisé : GitHub le redirige vers `www` avant que la page ne s'exécute.
- **Page admin** : sa règle de sécurité (CSP) n'autorise que l'adresse du serveur (`js/config.js`), qui ne change pas.
- Les choix gardés par les visiteurs (langue, musique : `localStorage`) dépendent de l'adresse : chacun les refait une fois.

## Plus tard
- Retirer `https://nowyyy.github.io` de `ORIGINES_SITE` quand plus personne n'utilise l'ancienne adresse (elle redirige de toute façon).
- Serveur sur `api.zsurvival-game.com` : facultatif. Il permettrait un cookie `HttpOnly` pour la connexion admin au lieu du jeton.
  Le branchement direct d'un domaine sur Cloud Run n'est, à notre connaissance, pas proposé en `europe-west3` : passer alors par
  Firebase Hosting ou Cloudflare (gratuits), pas par un équilibreur de charge Google (environ 18 € par mois).

## En cas de problème
- **« Domain's DNS record could not be retrieved » / « improperly configured »** dans Settings → Pages : la zone DNS met jusqu'à
  24 heures à se propager. Vérifier les lignes ci-dessus, puis cliquer **Check again**.
- **« Enforce HTTPS » grisé** : le certificat n'est pas encore prêt (quelques minutes, jusqu'à 24 heures). Revenir plus tard.
- **Revenir en arrière** : Settings → Pages → *Custom domain* → **Remove**. Le site revient sur https://nowyyy.github.io/Z-Survival-Website/
  (le serveur accepte toujours cette origine).
