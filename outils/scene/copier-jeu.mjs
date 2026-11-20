// Copie figée des éléments du jeu Z-Survival pour la scène v2 de l'accueil (lot 5a) : scene-v2/jeu/.
// Mode d'emploi : outils/scene/LISEZMOI.md.
//
//   node outils/scene/copier-jeu.mjs                 clone la branche dev dans un dossier temporaire (hors du dépôt), copie, efface le clone
//   node outils/scene/copier-jeu.mjs <clone>         utilise un clone existant du jeu (il doit être sur la branche dev)
//   node outils/scene/copier-jeu.mjs --essai [clone] montre ce qui changerait, sans rien écrire
//   node outils/scene/copier-jeu.mjs --verifier      vérifie que scene-v2/jeu/ correspond exactement à ORIGINE.json (aucun fichier retouché)
//
// Le jeu est lu en LECTURE SEULE (jamais modifié, jamais poussé), toujours sur sa branche `dev` (jamais `main`, en retard).
// Les fichiers sont recopiés TELS QUELS, à la même place que dans le jeu. Les modules JavaScript sont suivis par leurs imports relatifs
// (fermeture complète) ; les données sont listées à la main plus bas. La copie de la v1 (scene/jeu/) n'est jamais touchée.
// ORIGINE.json : commit de dev, date, liste des fichiers avec leur empreinte SHA-256. À chaque relance, l'outil compare avec l'ORIGINE.json
// précédent et affiche les fichiers ajoutés, modifiés et disparus (à recopier dans l'historique de scene-v2/planche.html).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '../..');
const DEST = path.join(racine, 'scene-v2/jeu');
const DEPOT = 'https://github.com/Nowyyy/Z-Survival.git';
const BRANCHE = 'dev';

// Modules de départ (tout ce qu'ils importent suit).
export const ENTREES = [
  'js/game/world.js', // monde : sol, bâtiment, décor extérieur, hélicoptère écrasé, voiture en flammes
  'js/game/character-v2.js', // personnages « os rigides » (joueur et zombies) : skins des personnages et des zombies
  'js/game/lamps.js', // lampes à huile (maillages)
  'js/game/fire.js', // feu et fumée (shaders repris par la boucle)
  'js/game/mist.js', // brume (shader repris par la boucle)
  'js/game/textures.js', // textures générées en code
  'js/game/palette.js', // couleurs lues dans css/tokens.css
  'js/core/layout.js', // couches de la carte (murs, fenêtres)
  'js/core/zones.js', // zones et portes de la carte
  'js/core/windows.js', // géométries des fenêtres (planches)
  'js/core/epaves.js', // hélicoptère écrasé, cratère, traînée
  'js/core/texgen-persos.js', // textures des personnages
  'js/core/armes/armes.js', // armes du lot 9c du jeu (Colt M1911, Kar98k…) : pièces, maillage, variantes
  'js/core/armes/atlas.js', // atlas commun des armes (généré en code)
  'js/core/armes/partie.js', // palette des armes (jetons --arm-* de css/armes.css)
];
// Données lues par la scène.
export const DONNEES = [
  'data/game/characters-v2.json', 'data/game/poses-v2.json', 'data/game/persos-choix.json', 'data/game/zombie-variants.json',
  'data/game/persos-epoque.json', 'data/game/persos-epoque-choix.json', // tenues d'époque (lot 9g du jeu) : recettes et variantes retenues
  'data/game/render.json', 'data/game/textures.json', 'data/game/camera.json', 'data/game/windows.json', 'data/game/lumieres.json',
  'data/game/maps/rez-de-chaussee/world.json', 'data/game/maps/rez-de-chaussee/decor.json', 'data/game/maps/rez-de-chaussee/zones.json',
  'data/game/maps/rez-de-chaussee/etage.world.json', 'data/game/maps/rez-de-chaussee/decor-interieur.world.json',
  'data/game/maps/rez-de-chaussee/mobilier.world.json', 'data/game/maps/rez-de-chaussee/feux.json',
  'data/game/maps/rez-de-chaussee/lampes.world.json', 'data/game/maps/rez-de-chaussee/epaves.json',
  'data/armes/armes.json', 'data/armes/armes-choix.json', 'data/armes/poses.json', // armes : modèles, variantes retenues, poses de tenue
  'data/game/armes-partie.json', // table des armes de la partie : manœuvre du verrou du Kar98k (clés, levier)
  'css/tokens.css', 'css/armes.css',
  'vendor/three/three.module.js', 'vendor/three/three.core.js', 'vendor/three/LICENSE-three.txt', 'vendor/three/version.json',
];

const empreinte = (fichier) => crypto.createHash('sha256').update(fs.readFileSync(fichier)).digest('hex');

// Liste des fichiers à copier depuis le clone : fermeture des imports des modules de départ, puis données. → { liste, absents }
export function listerFichiers(source) {
  const vus = new Set();
  const absents = [];
  const file = [...ENTREES];
  while (file.length) {
    const f = path.posix.normalize(file.shift());
    if (vus.has(f)) continue;
    const chemin = path.join(source, f);
    if (!fs.existsSync(chemin)) {
      absents.push(f);
      continue;
    }
    vus.add(f);
    const src = fs.readFileSync(chemin, 'utf8');
    for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      file.push(path.posix.join(path.posix.dirname(f), m[1] || m[2]));
    }
  }
  for (const d of DONNEES) if (!fs.existsSync(path.join(source, d))) absents.push(d);
  const liste = [...[...vus].sort(), ...DONNEES.filter((d) => fs.existsSync(path.join(source, d)))];
  return { liste, absents };
}

function lireOrigine() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DEST, 'ORIGINE.json'), 'utf8'));
  } catch {
    return null;
  }
}

// Vérifie que la copie n'a pas été retouchée : chaque fichier listé existe et a son empreinte ; aucun fichier en trop.
function verifier() {
  const o = lireOrigine();
  if (!o) {
    console.error('scene-v2/jeu/ORIGINE.json introuvable : lancer d’abord la copie.');
    return 1;
  }
  const erreurs = [];
  const listes = new Set(o.fichiers.map((f) => f.chemin));
  for (const f of o.fichiers) {
    const p = path.join(DEST, f.chemin);
    if (!fs.existsSync(p)) erreurs.push(`manquant : ${f.chemin}`);
    else if (empreinte(p) !== f.sha256) erreurs.push(`retouché : ${f.chemin}`);
  }
  const tous = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tous(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const p of tous(DEST)) {
    const rel = path.relative(DEST, p).split(path.sep).join('/');
    if (rel !== 'ORIGINE.json' && !listes.has(rel)) erreurs.push(`en trop : ${rel}`);
  }
  if (erreurs.length) {
    console.error(`scene-v2/jeu/ : ${erreurs.length} écart(s) avec ORIGINE.json\n  ${erreurs.join('\n  ')}`);
    return 1;
  }
  console.log(`scene-v2/jeu/ conforme à ORIGINE.json : ${o.fichiers.length} fichiers, dev @ ${o.commit.slice(0, 7)} (${o.date}).`);
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--verifier')) return verifier();
  const essai = args.includes('--essai');
  let source = args.find((a) => !a.startsWith('--'));
  let temporaire = null;
  if (!source) {
    temporaire = fs.mkdtempSync(path.join(os.tmpdir(), 'z-survival-dev-'));
    console.log(`Clone de ${DEPOT} (branche ${BRANCHE}, lecture seule) dans ${temporaire}…`);
    execFileSync('git', ['clone', '--quiet', '--depth', '1', '--branch', BRANCHE, '--single-branch', DEPOT, temporaire], { stdio: 'inherit' });
    source = temporaire;
  }
  source = path.resolve(source);
  try {
    if (!fs.existsSync(path.join(source, 'js/game/world.js'))) throw new Error(`${source} n’est pas un clone de Nowyyy/Z-Survival.`);
    // Le clone doit être hors de ce dépôt (règle : copie temporaire hors du dépôt).
    if (!path.relative(racine, source).startsWith('..')) throw new Error('le clone du jeu doit être hors de ce dépôt.');
    const git = (...a) => execFileSync('git', ['-C', source, ...a], { encoding: 'utf8' }).trim();
    const branche = git('rev-parse', '--abbrev-ref', 'HEAD');
    if (branche !== BRANCHE) throw new Error(`le clone est sur « ${branche} » : la scène se copie toujours depuis la branche ${BRANCHE} (git checkout ${BRANCHE} && git pull).`);
    if (git('status', '--porcelain')) console.warn('Attention : le clone a des modifications locales ; elles ne sont pas celles de dev.');
    const commit = git('rev-parse', 'HEAD');
    const date = git('log', '-1', '--format=%cI');
    const titre = git('log', '-1', '--format=%s');

    const { liste, absents } = listerFichiers(source);
    const fichiers = liste.map((f) => ({ chemin: f, sha256: empreinte(path.join(source, f)), octets: fs.statSync(path.join(source, f)).size }));
    const avant = lireOrigine();
    const ancien = new Map((avant?.fichiers ?? []).map((f) => [f.chemin, f.sha256]));
    const nouveau = new Map(fichiers.map((f) => [f.chemin, f.sha256]));
    const ajoutes = fichiers.filter((f) => !ancien.has(f.chemin)).map((f) => f.chemin);
    const modifies = fichiers.filter((f) => ancien.has(f.chemin) && ancien.get(f.chemin) !== f.sha256).map((f) => f.chemin);
    const retires = [...ancien.keys()].filter((c) => !nouveau.has(c));

    console.log(`\nJeu : dev @ ${commit.slice(0, 7)} (${date}) « ${titre} »`);
    console.log(avant ? `Copie précédente : dev @ ${avant.commit.slice(0, 7)} (${avant.date})` : 'Aucune copie précédente : première copie.');
    const bloc = (nom, l) => console.log(`${nom} (${l.length})${l.length ? `\n  ${l.join('\n  ')}` : ''}`);
    bloc('Ajoutés', avant ? ajoutes : []);
    bloc('Modifiés', modifies);
    bloc('Disparus de la copie (plus importés ou plus listés)', retires);
    if (absents.length) {
      console.log(`\n!! Fichiers attendus mais DISPARUS DU JEU (${absents.length}) : la scène v2 devra peut-être être adaptée.\n  ${absents.join('\n  ')}`);
    }
    if (essai) {
      console.log('\n--essai : rien n’a été écrit.');
      return 0;
    }
    fs.rmSync(DEST, { recursive: true, force: true });
    for (const f of liste) {
      fs.mkdirSync(path.dirname(path.join(DEST, f)), { recursive: true });
      fs.copyFileSync(path.join(source, f), path.join(DEST, f));
    }
    const origine = {
      _note: 'Copie figée du jeu pour la scène v2 de l’accueil (lot 5a). Fichiers repris TELS QUELS, jamais retouchés. Refaire : node outils/scene/copier-jeu.mjs (outils/scene/LISEZMOI.md) ; vérifier : node outils/scene/copier-jeu.mjs --verifier.',
      depot: 'Nowyyy/Z-Survival',
      branche: BRANCHE,
      commit,
      date,
      titre,
      copieLe: new Date().toISOString().slice(0, 10),
      precedent: avant ? { commit: avant.commit, date: avant.date } : null,
      changements: avant ? { ajoutes, modifies, retires } : null,
      absentsDuJeu: absents,
      fichiers,
    };
    fs.writeFileSync(path.join(DEST, 'ORIGINE.json'), `${JSON.stringify(origine, null, 1)}\n`);
    console.log(`\n${liste.length} fichiers copiés dans scene-v2/jeu/ ; origine et empreintes : scene-v2/jeu/ORIGINE.json.`);
    console.log('Pense à ajouter une ligne à l’historique de scene-v2/planche.html (date, commit, ce qui a changé).');
    return 0;
  } catch (e) {
    console.error(`Erreur : ${e.message}`);
    return 1;
  } finally {
    if (temporaire) fs.rmSync(temporaire, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
