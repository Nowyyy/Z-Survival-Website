# Référencement du site — zsurvival-game.com (lot 4a)

## Ce qui est en place

### Une seule page indexable
- **https://zsurvival-game.com/** (la page par défaut, `index.html`) est la seule page que les moteurs doivent indexer.
- Elle porte :
  - un **titre** et une **description** en français (`<title>`, `<meta name="description">`), identiques à `meta.titre` et
    `meta.description` de `js/textes.js` ; une fois la page affichée, `js/i18n.js` pose ceux de la langue du visiteur ;
  - `<meta name="robots" content="index, follow, max-image-preview:large">` (aucun `noindex`) ;
  - un **lien canonique fixe** : `<link rel="canonical" href="https://zsurvival-game.com/">`. Il est écrit dans le HTML et aucun script
    ne le change : `?lang=fr`, `?lang=en`, `#news`, `#actu/…` désignent tous la même page. **Pas de `hreflang`** (une seule adresse pour
    les deux langues).
- **Tout le reste est non indexé**, deux fois (règle `Disallow` de `robots.txt` et balise `noindex` dans la page) :

| Page | Balise | robots.txt |
|---|---|---|
| `admin/` | `noindex, nofollow` | `Disallow: /admin/` |
| `scene/index.html`, `scene/apercu.html`, `scene/planche.html` | `noindex, nofollow` | `Disallow: /scene/` |
| `musique/planche.html` | `noindex, nofollow` | `Disallow: /musique/planche.html` |
| `main.html` (ancienne page, redirige vers `./#news`) | `noindex, follow` | `Disallow: /main.html` |
| `outils/`, `serveur/`, `Docs/` | non publiés par `pages.yml` | `Disallow` par précaution |

### Fichiers à la racine
- **`robots.txt`** : autorise tout le reste (la page et les fichiers qu'elle utilise : `css/`, `js/`, `img/`, `fonts/`, `musique/`,
  `sons/`, `contenus/`), interdit les pages de travail ci-dessus, indique le plan du site. Exception assumée à la règle « aucun chemin
  ne commence par / » : la syntaxe de `robots.txt` l'impose, et ce fichier n'est lu qu'à la racine du domaine.
- **`sitemap.xml`** : une seule adresse, `https://zsurvival-game.com/`.
- Les deux sont publiés par `.github/workflows/pages.yml`.

### Données structurées (JSON-LD, dans `index.html`)
- **`VideoGame`** : Z-Survival, jeu de survie zombies en vue de dessus, jouable sur navigateur, encore à venir
  (`creativeWorkStatus` « À venir »), image de partage, auteur et éditeur No Way Studio.
- **`Organization`** : No Way Studio, avec son logo en PNG (`img/no-way-studio.png`, 600 × 457) et le lien Discord (`sameAs`).
- **`WebSite`** : le site Z-Survival, en français et en anglais.
- **Rien d'inventé** : ni note, ni avis, ni prix, ni date de sortie. Conséquence voulue : Google n'affichera pas de « résultat enrichi »
  de jeu (il demande une note et un prix). Le test de résultats enrichis peut donc signaler des champs « manquants » (`offers`,
  `aggregateRating`) : c'est normal tant que le jeu n'est pas sorti.

### Aperçu de partage et icônes
- Lot 3f : le **titre et la description de partage** (balises Open Graph et Twitter d'`index.html`) se modifient depuis l'admin (`Docs/ref/admin.md`, section 10) ; `index.html` en est la seule source.
- Balises Open Graph et Twitter Card, image `img/partage.jpg` (1200 × 630) : voir `Docs/lots/lot-4a.md` (partie A).
- Favicon, icônes Apple et Android, manifeste `site.webmanifest` : voir `Docs/ref/direction-artistique.md` (« Icônes »).

## Limites
- **Langue vue par Google** : le HTML est en français. Mais Google exécute aussi le JavaScript, et son robot se présente avec un
  navigateur en anglais : selon la règle de langue du site (langue du navigateur), il peut voir le titre et les textes anglais.
  Les deux versions sont soignées (`js/textes.js`). Pour forcer le français pour les robots, il faudrait changer la règle de langue :
  ce n'est pas l'objet de ce lot.
- **Articles** : les adresses `#actu/<slug>` ne sont pas des pages à part (les moteurs et les réseaux ignorent ce qui suit le `#`).
  Un article ne peut donc pas sortir seul dans Google ni avoir son propre aperçu de partage. Il faudrait des pages par article
  (un futur lot).
- L'apparition dans Google prend de quelques jours à quelques semaines ; rien ne la garantit.

## Vérifier le site dans Google Search Console (facultatif, à faire toi-même)

Search Console montre si Google a trouvé et indexé le site, et par quelles recherches on y arrive. La validation se fait en ajoutant
une ligne **TXT** dans la zone DNS chez OVH (elle prouve que le domaine est à toi). Environ 15 minutes, plus l'attente de la
propagation.

1. **Ouvrir Search Console** : https://search.google.com/search-console, avec ton compte Google.
2. **Ajouter une propriété** (menu en haut à gauche → « Ajouter une propriété ») et choisir le type **« Domaine »** (à gauche, pas
   « Préfixe de l'URL »). Saisir `zsurvival-game.com` (sans `https://` ni `www`), puis **Continuer**.
3. Google affiche un **enregistrement TXT** de la forme `google-site-verification=…`. Cliquer **Copier**. Laisser cette fenêtre ouverte.
4. **Chez OVH** : https://www.ovh.com/manager → **Web Cloud** → **Noms de domaine** → `zsurvival-game.com` → onglet **Zone DNS**.
5. Cliquer **Ajouter une entrée** → choisir **TXT**.
   - **Sous-domaine** : laisser **vide** (le domaine lui-même).
   - **TTL** : laisser par défaut.
   - **Valeur** : coller `google-site-verification=…` (tout, sans guillemets en plus).
   - **Suivant** → **Valider**.
6. **Ne touche à aucune autre ligne** : les lignes A, AAAA, CNAME `www`, la ligne TXT `_github-pages-challenge-nowyyy` et celles de la
   boîte mail (MX, SPF, DKIM, SRV) restent telles quelles (`Docs/ref/nom-de-domaine.md`). S'il existe déjà une ligne TXT sur le domaine
   (par exemple le SPF `v=spf1 …`), on en **ajoute** une nouvelle, on ne la modifie pas.
7. Attendre quelques minutes (parfois jusqu'à quelques heures), puis revenir à Search Console et cliquer **Valider**. Si Google dit qu'il
   ne trouve pas l'enregistrement, réessayer plus tard : c'est la propagation.
8. **Garder la ligne TXT pour toujours** : si elle disparaît, Search Console perd la validation.
9. Une fois validé :
   - **Sitemaps** (menu de gauche) → saisir `sitemap.xml` → **Envoyer**. L'état doit passer à « Opération effectuée ».
   - **Inspection de l'URL** (barre du haut) → `https://zsurvival-game.com/` → **Demander une indexation**.
   - Dans **Pages**, seule `https://zsurvival-game.com/` doit apparaître comme indexée ; les pages de travail apparaissent, au mieux, comme
     « Bloquée par le fichier robots.txt » ou « Exclue par la balise noindex » : c'est voulu.

Outils utiles, sans compte :
- Test des résultats enrichis (données structurées) : https://search.google.com/test/rich-results → saisir l'adresse du site.
- Validateur de schema.org : https://validator.schema.org/ → saisir l'adresse du site.
