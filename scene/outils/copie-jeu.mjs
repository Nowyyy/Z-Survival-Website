// Copie figée des éléments du jeu Z-Survival utiles à la scène de l'accueil (lot 1).
// Usage : node scene/outils/copie-jeu.mjs <clone du jeu, branche dev>
// Le clone est lu, jamais modifié. Les fichiers sont recopiés tels quels dans scene/jeu/, à la même place
// que dans le jeu (js/core, js/game, data/game, css, vendor/three). Les modules JavaScript sont suivis par
// leurs imports relatifs (fermeture complète), les données sont listées à la main ci-dessous.
// Les enrichissements de la scène ne sont PAS faits ici : ils vivent dans scene/js/ (aucun fichier copié n'est retouché).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
if (!source || !fs.existsSync(path.join(source, 'js/game/world.js'))) {
  console.error('Usage : node scene/outils/copie-jeu.mjs <clone de Nowyyy/Z-Survival (branche dev)>');
  process.exit(1);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const dest = path.resolve(here, '../jeu');

// Modules de départ (tout ce qu'ils importent suit).
const ENTREES = [
  'js/game/world.js', // monde : sol, bâtiment, décor extérieur, hélicoptère écrasé, voiture en flammes
  'js/game/character-v2.js', // personnages « os rigides » (joueur et zombies)
  'js/game/lamps.js', // lampes à huile (maillages)
  'js/game/fire.js', // feu et fumée (shaders repris par la boucle)
  'js/game/mist.js', // brume (shader repris par la boucle)
  'js/game/textures.js', // textures générées en code
  'js/game/palette.js', // couleurs lues dans css/tokens.css
  'js/core/layout.js', // couches de collision de la carte (positions des murs, fenêtres)
  'js/core/zones.js', // zones et portes de la carte
  'js/core/windows.js', // géométries des fenêtres (planches)
];
// Données lues par la scène.
const DONNEES = [
  'data/game/characters-v2.json', 'data/game/poses-v2.json', 'data/game/persos-choix.json', 'data/game/zombie-variants.json',
  'data/game/render.json', 'data/game/textures.json', 'data/game/camera.json', 'data/game/windows.json', 'data/game/lumieres.json',
  'data/game/maps/rez-de-chaussee/world.json', 'data/game/maps/rez-de-chaussee/decor.json', 'data/game/maps/rez-de-chaussee/zones.json',
  'data/game/maps/rez-de-chaussee/etage.world.json', 'data/game/maps/rez-de-chaussee/decor-interieur.world.json',
  'data/game/maps/rez-de-chaussee/mobilier.world.json', 'data/game/maps/rez-de-chaussee/feux.json',
  'data/game/maps/rez-de-chaussee/lampes.world.json', 'data/game/maps/rez-de-chaussee/epaves.json',
  'css/tokens.css',
  'vendor/three/three.module.js', 'vendor/three/three.core.js', 'vendor/three/LICENSE-three.txt', 'vendor/three/version.json',
  'LICENSE',
];

const vus = new Set();
const file = [...ENTREES];
while (file.length) {
  const f = path.normalize(file.shift());
  if (vus.has(f)) continue;
  vus.add(f);
  const src = fs.readFileSync(path.join(source, f), 'utf8');
  for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    file.push(path.join(path.dirname(f), m[1] || m[2]));
  }
}
const liste = [...[...vus].sort(), ...DONNEES.filter((d) => fs.existsSync(path.join(source, d)))];
fs.rmSync(dest, { recursive: true, force: true });
for (const f of liste) {
  fs.mkdirSync(path.dirname(path.join(dest, f)), { recursive: true });
  fs.copyFileSync(path.join(source, f), path.join(dest, f));
}
const git = (...a) => execFileSync('git', ['-C', source, ...a], { encoding: 'utf8' }).trim();
const origine = { depot: 'Nowyyy/Z-Survival', branche: git('rev-parse', '--abbrev-ref', 'HEAD'), commit: git('rev-parse', 'HEAD'), date: git('log', '-1', '--format=%cI'), fichiers: liste };
fs.writeFileSync(path.join(dest, 'ORIGINE.json'), `${JSON.stringify(origine, null, 1)}\n`);
console.log(`${liste.length} fichiers copiés de ${origine.branche} @ ${origine.commit.slice(0, 7)} vers scene/jeu/`);
