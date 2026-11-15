# Contenus modifiables sans toucher au code

Certains contenus du site sont rangés dans des **fichiers de données** (dossier `contenus/`, publié tel quel) plutôt que dans le code.
Aujourd'hui on les modifie directement sur GitHub ; plus tard, une **interface d'administration** les modifiera (même principe que le jeu,
qui prévoit une base de données Turso et une interface d'administration pour les contenus de son menu : `Docs/ref/menu-principal.md` du
jeu). Le jour venu, seule la **source** change (un fichier aujourd'hui, l'adresse de l'API demain) : le format reste le même.

Exception assumée à la règle « tous les textes dans `js/textes.js` » : ces contenus changent souvent et doivent pouvoir être réglés sans
développeur. Les libellés fixes (par exemple l'étiquette « Alerte ») restent dans `js/textes.js`.

## Bandeau d'alerte de l'accueil — `contenus/bandeau.json`

```json
{
  "version": 1,
  "messages": [
    { "id": "couvre-feu", "actif": true, "fr": "Couvre-feu : restez à l’abri jusqu’à l’aube", "en": "Curfew: stay inside until dawn" }
  ]
}
```

- `id` : identifiant unique, sans espace (sert à reconnaître un message, par exemple pour l'interface d'administration).
- `actif` : `false` cache le message sans le supprimer.
- `fr`, `en` : le texte dans chaque langue, **texte brut** (pas de HTML). Sans anglais, le français est affiché.
- Les messages défilent dans l'ordre du fichier. La vitesse reste la même quelle que soit la longueur (environ 70 px par seconde).
- Fichier illisible ou aucun message actif : pas de bandeau (l'accueil reprend sa mise en page sans bandeau).
- Lecture : `js/accueil-bandeau.js`, constante `SOURCE_BANDEAU`.
- Lot 3b : quand des articles sont publiés (page d'administration, `Docs/ref/admin.md`), le **titre du dernier article** passe en
  tête du bandeau (« Dernière transmission : … »), avec un lien vers l'article (`#actu/<slug>`).

### Modifier les messages depuis l'admin (lot 3d, le plus simple)
Page d'administration → **Pages du site** → **Modifier le bandeau d’alerte** (`Docs/ref/admin.md`, section 9) : textes FR / EN, affiché ou
caché, ordre, ajout et suppression, aperçu. Le serveur réécrit ce fichier dans le dépôt (même format, un message par ligne, commit
« Z-Survival admin » sur `main`) ; le site est republié en une minute environ. Le site lit toujours le fichier : il n'attend jamais le
serveur pour afficher le bandeau.

### Modifier les messages à la main sur GitHub (toujours possible)
1. Ouvrir https://github.com/Nowyyy/Z-Survival-Website/blob/main/contenus/bandeau.json
2. Cliquer sur le crayon (« Edit this file »).
3. Changer les textes entre guillemets, ajouter ou retirer un bloc `{ … }` (attention aux virgules entre les blocs).
4. « Commit changes » sur `main`. Le site est republié en une minute environ.

### Choix faits pour l'interface d'administration (lot 3d)
- Elle écrit **ce fichier** (pas une base de données) : le site n'a pas besoin du serveur pour le bandeau, et `SOURCE_BANDEAU` ne change pas.
- Connexion : celle de l'admin. Ordre : celui de la liste. Si quelqu'un a modifié le fichier entre-temps, l'enregistrement est refusé
  (aucune écriture à l'aveugle).
- Pas encore de dates de début et de fin par message (un message se cache ou se montre à la main).
