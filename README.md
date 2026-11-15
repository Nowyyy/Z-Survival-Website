# Z-Survival-site

Site vitrine du jeu de survie zombies **Z-Survival**
(le jeu : https://nowyyy.github.io/Z-Survival/).

- Adresse du site : https://nowyyy.github.io/Z-Survival-Website/
  (GitHub Pages sert le site sous le nom du dépôt, `Z-Survival-Website`).
- Structure : une seule page. Accueil plein écran (« En savoir plus » descend vers les sections),
  puis les sections plein écran News, Characters, Weapons et About us, avec un défilement qui
  s'arrête sur chaque section. Site en français et en anglais (globe sur l'accueil).

## Tester en local
Le site est statique (HTML, CSS, JavaScript en modules ES, sans build). Les modules ES
demandent un petit serveur local (ouvrir le fichier directement ne suffit pas) :

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000/ dans le navigateur. Pour tester en largeur téléphone :
outils de développement du navigateur → mode appareil (375 px).

## Documentation
- `CLAUDE.md` : règles du projet.
- `Docs/ref/` : références (scène d'accueil, pile technique du jeu).
- `Docs/lots/` : bilan de chaque lot.
