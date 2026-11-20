// Relevé des armes du jeu Z-Survival pour la section Armes du site (lot 6a) : copie figée dans armes/jeu/ et données contenus/armes.json.
// Mode d'emploi : outils/armes/LISEZMOI.md (et Docs/ref/armes.md).
//
//   node outils/armes/copier-armes.mjs                 clone la branche dev dans un dossier temporaire (hors du dépôt), relève, efface le clone
//   node outils/armes/copier-armes.mjs <clone>         utilise un clone existant du jeu (il doit être sur la branche dev)
//   node outils/armes/copier-armes.mjs --essai [clone] montre ce qui changerait (armes ajoutées, modifiées, disparues), sans rien écrire
//   node outils/armes/copier-armes.mjs --verifier      vérifie que armes/jeu/ correspond exactement à ORIGINE.json (aucun fichier retouché)
//
// Le jeu est lu en LECTURE SEULE (jamais modifié, jamais poussé), toujours sur sa branche `dev` (jamais `main`, en retard).
// - armes/jeu/ : fichiers du jeu recopiés TELS QUELS, à la même place que dans le jeu (modèles 3D des armes en code, atlas, rendu Three.js,
//   données des armes, couleurs, Three.js). Servent à fabriquer les visuels (outils/armes/fabriquer-visuels.mjs) ; jamais publiés.
// - contenus/armes.json : une entrée par arme. L'outil met à jour ce qui vient du jeu (nom, catégorie) et ne touche JAMAIS à ce que le
//   propriétaire règle (famille, ordre, chapitres, « prochainement », nom anglais, descriptions, « aRelire », stats). Arme nouvelle : ajoutée
//   à la fin, famille proposée d'après sa catégorie, « prochainement » si le jeu ne la rend pas encore utilisable, dernier chapitre,
//   description vide, « aRelire » vrai. Arme disparue du jeu : sortie de la liste et rangée dans « retirees » (descriptions gardées).
// - Aucune statistique de jeu n'est relevée : data/game/armes-partie.json (qui en contient) est lu pour la catégorie et l'ordre seulement,
//   et n'est pas recopié.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '../..');
const DEST = path.join(racine, 'armes/jeu');
const DONNEES_SITE = path.join(racine, 'contenus/armes.json');
const DEPOT = 'https://github.com/Nowyyy/Z-Survival.git';
const BRANCHE = 'dev';

// Modules de départ (leurs imports relatifs suivent) et fichiers de données recopiés.
export const ENTREES = [
  'js/core/armes/armes.js', // armes : lecture des données, variantes, pièces, maillage (pur, sans Three.js)
  'js/core/armes/atlas.js', // atlas commun des armes (textures générées en code)
  'js/armes/rendu.js', // rendu Three.js des armes (kit de l'atelier des armes du jeu) : géométrie et atlas
];
export const DONNEES = [
  'data/armes/armes.json', // définition des armes : nom, genre, classe, dimensions, variantes (aucune statistique de jeu)
  'data/armes/armes-choix.json', // variante retenue par le propriétaire pour chaque arme
  'css/armes.css', // couleurs des armes (jetons --arm-*), lues par l'atlas
  'vendor/three/three.module.js', 'vendor/three/three.core.js', 'vendor/three/LICENSE-three.txt', 'vendor/three/version.json',
];
// Lus sans être recopiés (empreinte notée dans ORIGINE.json).
export const LUS = {
  'data/i18n/fr.json': 'noms affichés des armes (game.armes.<id>) ; seuls ces noms sont repris',
  'data/game/armes-partie.json': 'catégorie et ordre des armes (montée en puissance) ; contient les statistiques de jeu : jamais recopié',
};

// Familles (rangement de la liste des miniatures, retour du propriétaire : « Épaule » trop vaste) : réglées par le propriétaire dans
// contenus/armes.json ; pour une arme nouvelle, proposées d'après la catégorie du jeu. Libellés : weapons.familles de js/textes.js.
export const FAMILLES = ['poing', 'carabine', 'pompe', 'mitraillette', 'assaut', 'lourde', 'speciale'];
export const FAMILLE_DE_CATEGORIE = {
  pistolet: 'poing', 'fusil-a-verrou': 'carabine', 'fusil-semi-automatique': 'carabine', 'fusil-a-pompe': 'pompe',
  'pistolet-mitrailleur': 'mitraillette', 'fusil-d-assaut': 'assaut', 'fusil-mitrailleur': 'assaut', mitrailleuse: 'lourde',
  'lance-roquettes': 'speciale', 'lance-flammes': 'speciale',
};

const empreinte = (donnees) => crypto.createHash('sha256').update(donnees).digest('hex');
const empreinteFichier = (f) => empreinte(fs.readFileSync(f));
const lireJson = (f, d = null) => {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; }
};
// « fusil à verrou » → « fusil-a-verrou » (clé de weapons.categories dans js/textes.js).
export const cleCategorie = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function listerFichiers(source) {
  const vus = new Set();
  const absents = [];
  const file = [...ENTREES];
  while (file.length) {
    const f = path.posix.normalize(file.shift());
    if (vus.has(f)) continue;
    if (!fs.existsSync(path.join(source, f))) { absents.push(f); continue; }
    vus.add(f);
    const src = fs.readFileSync(path.join(source, f), 'utf8');
    for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      file.push(path.posix.join(path.posix.dirname(f), m[1] || m[2]));
    }
  }
  for (const d of DONNEES) if (!fs.existsSync(path.join(source, d))) absents.push(d);
  return { liste: [...[...vus].sort(), ...DONNEES.filter((d) => fs.existsSync(path.join(source, d)))], absents };
}

// Relevé des armes depuis un dossier qui a la structure du jeu (le clone) :
// [{ id, nom, categorieJeu, categorie, classeJeu, famille (proposée), active, ordreJeu, variante, empreinteDefinition, empreinteModele }].
export async function releverArmes(source) {
  const { lireArmes, lireChoix, maillageArme, armeParId, varianteDe, SPECIALES } = await import(pathToFileURL(path.join(source, 'js/core/armes/armes.js')).href);
  const brut = lireJson(path.join(source, 'data/armes/armes.json'));
  const donnees = lireArmes(brut);
  const choix = lireChoix(donnees, lireJson(path.join(source, 'data/armes/armes-choix.json'), {}));
  const noms = lireJson(path.join(source, 'data/i18n/fr.json'), {});
  const partie = lireJson(path.join(source, 'data/game/armes-partie.json'), {})?.armes ?? {};
  const ordrePartie = Object.keys(partie);
  return donnees.armes.map((a, i) => {
    const v = varianteDe(armeParId(donnees, a.id), choix.variantes[a.id]);
    const m = maillageArme(donnees, a, v, { pose: 'caisse' });
    const h = crypto.createHash('sha256');
    for (const t of [m.positions, m.uvs, m.colors]) h.update(Buffer.from(t.buffer, t.byteOffset, t.byteLength));
    const categorieJeu = partie[a.id]?.categorie ?? a.genre;
    const idx = ordrePartie.indexOf(a.id);
    return {
      id: a.id,
      nom: noms[`game.armes.${a.id}`] ?? a.nom,
      categorieJeu,
      categorie: cleCategorie(categorieJeu),
      classeJeu: SPECIALES.includes(a.id) ? 'speciale' : a.classe,
      famille: FAMILLE_DE_CATEGORIE[cleCategorie(categorieJeu)] ?? (SPECIALES.includes(a.id) ? 'speciale' : a.classe),
      active: partie[a.id]?.active !== false, // faux : arme pas encore utilisable dans le jeu (armes spéciales)
      ordreJeu: idx >= 0 ? idx : ordrePartie.length + i,
      variante: v.id,
      empreinteDefinition: empreinte(JSON.stringify({ arme: brut.armes.find((x) => x.id === a.id), variante: v.id })),
      empreinteModele: h.digest('hex'),
    };
  }).sort((a, b) => a.ordreJeu - b.ordreJeu);
}

const AIDE = 'Armes de la section Armes du site (lot 6a, Docs/ref/armes.md). Fichier mis à jour par node outils/armes/copier-armes.mjs : '
  + 'l\'outil réécrit seulement id, nom (nom du jeu) et categorie ; il ne touche jamais à famille, ordre, chapitres, prochainement, nomEn, description, aRelire ni stats. '
  + 'famille : groupe de la liste des miniatures (poing, carabine, pompe, mitraillette, assaut, lourde, speciale). ordre : rang d\'affichage (1 = première, à l\'intérieur de sa famille). '
  + 'chapitres : chapitres du jeu où l\'arme apparaît (liste de numéros ; sélecteur de chapitre de la section) ; la liste « chapitres » en tête du fichier peut donner un nom à chaque chapitre ({ "id": 2, "nom": { "fr": "…", "en": "…" } }). '
  + 'prochainement : true = arme montrée en silhouette, marquée « Prochainement », « ? » sur sa miniature. '
  + 'nomEn : nom en anglais s\'il diffère du nom du jeu (null : le nom du jeu). '
  + 'description : fr et en, texte brut, une ou deux phrases. aRelire : true tant que la description n\'est pas relue (mettre false une fois relue). '
  + 'stats : null pour l\'instant (aucune statistique affichée, panneau « Prochainement ») ; format prévu dans Docs/ref/armes.md. '
  + 'categorie et famille : clés des libellés weapons.categories et weapons.familles de js/textes.js. retirees : armes disparues du jeu, gardées pour leurs textes, jamais affichées.';
const CHAPITRES_DEFAUT = [{ id: 1, nom: null }];

// Fusionne le relevé avec contenus/armes.json existant. → { site, ajoutees, modifiees, disparues }
export function fusionner(releve, existant, origineAvant) {
  const avant = new Map((existant?.armes ?? []).map((a) => [a.id, a]));
  const retireesAvant = new Map((existant?.retirees ?? []).map((a) => [a.id, a]));
  const empreintesAvant = origineAvant?.armes ?? {};
  const ajoutees = [];
  const modifiees = [];
  let ordreMax = Math.max(0, ...[...avant.values()].map((a) => Number(a.ordre) || 0));
  const chapitres = Array.isArray(existant?.chapitres) && existant.chapitres.length ? existant.chapitres : CHAPITRES_DEFAUT;
  const dernierChapitre = chapitres[chapitres.length - 1].id;
  const armes = releve.map((r) => {
    const a = avant.get(r.id) ?? retireesAvant.get(r.id);
    if (!a) {
      ajoutees.push(r.id);
      ordreMax += 1;
      return { id: r.id, nom: r.nom, nomEn: null, categorie: r.categorie, famille: r.famille, ordre: existant ? ordreMax : r.ordreJeu + 1, chapitres: [dernierChapitre], prochainement: !r.active, description: { fr: '', en: '' }, aRelire: true, stats: null };
    }
    const changes = [];
    const e = empreintesAvant[r.id];
    if (a.nom !== r.nom) changes.push(`nom « ${a.nom} » → « ${r.nom} »`);
    if (a.categorie !== r.categorie) changes.push(`catégorie ${a.categorie} → ${r.categorie}`);
    if (a.prochainement && r.active && e?.active === false) changes.push('devenue utilisable dans le jeu (« prochainement » à retirer ?)');
    if (e && e.empreinteModele !== r.empreinteModele) changes.push('modèle 3D (refaire les visuels)');
    else if (e && e.empreinteDefinition !== r.empreinteDefinition) changes.push('définition dans le jeu (variante, dimensions…)');
    if (retireesAvant.has(r.id) && !avant.has(r.id)) changes.push('revenue dans le jeu');
    if (changes.length) modifiees.push(`${r.id} : ${changes.join(', ')}`);
    return {
      id: r.id, nom: r.nom, nomEn: a.nomEn ?? null, categorie: r.categorie, famille: a.famille ?? r.famille,
      ordre: Number(a.ordre) || ++ordreMax,
      chapitres: Array.isArray(a.chapitres) && a.chapitres.length ? a.chapitres : [dernierChapitre],
      prochainement: typeof a.prochainement === 'boolean' ? a.prochainement : !r.active,
      description: { fr: a.description?.fr ?? '', en: a.description?.en ?? '' },
      aRelire: a.aRelire !== false, stats: a.stats ?? null,
    };
  });
  const ids = new Set(releve.map((r) => r.id));
  const disparues = [...avant.keys()].filter((id) => !ids.has(id));
  const retirees = [
    ...[...retireesAvant.values()].filter((a) => !ids.has(a.id) && !avant.has(a.id)),
    ...disparues.map((id) => ({ ...avant.get(id), retireeLe: new Date().toISOString().slice(0, 10) })),
  ];
  armes.sort((a, b) => a.ordre - b.ordre);
  return { site: { _aide: AIDE, version: 1, chapitres, armes, retirees }, ajoutees, modifiees, disparues };
}

// JSON lisible : une arme par bloc, description sur ses lignes.
export function ecrireSite(site) {
  const ligne = (a) => {
    const { description, ...reste } = a;
    const tete = Object.entries(reste).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ');
    return `    {\n      ${tete},\n      "description": {\n        "fr": ${JSON.stringify(description?.fr ?? '')},\n        "en": ${JSON.stringify(description?.en ?? '')}\n      }\n    }`;
  };
  const chapitres = (site.chapitres ?? CHAPITRES_DEFAUT).map((c) => `    ${JSON.stringify(c).replace(/,"/g, ', "').replace(/":/g, '": ')}`).join(',\n');
  return `{\n  "_aide": ${JSON.stringify(site._aide)},\n  "version": ${site.version},\n  "chapitres": [\n${chapitres}\n  ],\n  "armes": [\n${site.armes.map(ligne).join(',\n')}\n  ],\n  "retirees": [${site.retirees.length ? `\n${site.retirees.map(ligne).join(',\n')}\n  ` : ''}]\n}\n`;
}

// Catégories et familles sans libellé dans js/textes.js (à ajouter, en français et en anglais).
async function libellesManquants(site) {
  const { TEXTES } = await import(pathToFileURL(path.join(racine, 'js/textes.js')).href);
  const manque = [];
  for (const l of ['fr', 'en']) {
    for (const a of site.armes) {
      if (!TEXTES[l]?.weapons?.categories?.[a.categorie]) manque.push(`${l} : weapons.categories['${a.categorie}']`);
      if (!TEXTES[l]?.weapons?.familles?.[a.famille]) manque.push(`${l} : weapons.familles.${a.famille}`);
    }
  }
  return [...new Set(manque)];
}

function verifier() {
  const o = lireJson(path.join(DEST, 'ORIGINE.json'));
  if (!o) { console.error('armes/jeu/ORIGINE.json introuvable : lancer d’abord la copie.'); return 1; }
  const erreurs = [];
  const listes = new Set(o.fichiers.map((f) => f.chemin));
  for (const f of o.fichiers) {
    const p = path.join(DEST, f.chemin);
    if (!fs.existsSync(p)) erreurs.push(`manquant : ${f.chemin}`);
    else if (empreinteFichier(p) !== f.sha256) erreurs.push(`retouché : ${f.chemin}`);
  }
  const tous = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tous(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const p of tous(DEST)) {
    const rel = path.relative(DEST, p).split(path.sep).join('/');
    if (rel !== 'ORIGINE.json' && !listes.has(rel)) erreurs.push(`en trop : ${rel}`);
  }
  if (erreurs.length) { console.error(`armes/jeu/ : ${erreurs.length} écart(s) avec ORIGINE.json\n  ${erreurs.join('\n  ')}`); return 1; }
  console.log(`armes/jeu/ conforme à ORIGINE.json : ${o.fichiers.length} fichiers, dev @ ${o.commit.slice(0, 7)} (${o.date}).`);
  return 0;
}

async function main() {
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
    if (!fs.existsSync(path.join(source, 'data/armes/armes.json'))) throw new Error(`${source} n’est pas un clone de Nowyyy/Z-Survival (data/armes/armes.json absent).`);
    if (!path.relative(racine, source).startsWith('..')) throw new Error('le clone du jeu doit être hors de ce dépôt.');
    const git = (...a) => execFileSync('git', ['-C', source, ...a], { encoding: 'utf8' }).trim();
    const branche = git('rev-parse', '--abbrev-ref', 'HEAD');
    if (branche !== BRANCHE) throw new Error(`le clone est sur « ${branche} » : les armes se relèvent toujours sur la branche ${BRANCHE} (git checkout ${BRANCHE} && git pull).`);
    if (git('status', '--porcelain')) console.warn('Attention : le clone a des modifications locales ; elles ne sont pas celles de dev.');
    const commit = git('rev-parse', 'HEAD');
    const date = git('log', '-1', '--format=%cI');
    const titre = git('log', '-1', '--format=%s');

    const { liste, absents } = listerFichiers(source);
    const fichiers = liste.map((f) => ({ chemin: f, sha256: empreinteFichier(path.join(source, f)), octets: fs.statSync(path.join(source, f)).size }));
    const lus = Object.entries(LUS).filter(([f]) => fs.existsSync(path.join(source, f)))
      .map(([chemin, role]) => ({ chemin, role, sha256: empreinteFichier(path.join(source, chemin)) }));
    const releve = await releverArmes(source);
    const origineAvant = lireJson(path.join(DEST, 'ORIGINE.json'));
    const existant = lireJson(DONNEES_SITE);
    // Fichier présent mais illisible (virgule oubliée…) : on s'arrête, sinon les descriptions du propriétaire seraient perdues.
    if (!existant && fs.existsSync(DONNEES_SITE)) throw new Error('contenus/armes.json est illisible (JSON invalide) : le corriger d’abord ; rien n’a été écrit.');
    const { site, ajoutees, modifiees, disparues } = fusionner(releve, existant, origineAvant);

    console.log(`\nJeu : dev @ ${commit.slice(0, 7)} (${date}) « ${titre} »`);
    console.log(origineAvant ? `Relevé précédent : dev @ ${origineAvant.commit.slice(0, 7)} (${origineAvant.date})` : 'Aucun relevé précédent : premier relevé.');
    console.log(`\n${releve.length} armes dans le jeu :`);
    for (const r of releve) console.log(`  ${String(r.ordreJeu + 1).padStart(2)}. ${r.id.padEnd(16)} ${r.nom.padEnd(18)} ${r.categorieJeu} (classe ${r.classeJeu}, variante ${r.variante}${r.active ? '' : ', pas encore utilisable'})`);
    const bloc = (nom, l) => console.log(`${nom} (${l.length})${l.length ? `\n  ${l.join('\n  ')}` : ''}`);
    console.log('');
    bloc('Armes ajoutées (description à écrire dans contenus/armes.json)', existant ? ajoutees : []);
    bloc('Armes modifiées', modifiees);
    bloc('Armes disparues du jeu (rangées dans « retirees »)', disparues);
    if (absents.length) console.log(`\n!! Fichiers attendus mais DISPARUS DU JEU (${absents.length}) : l’outil devra peut-être être adapté.\n  ${absents.join('\n  ')}`);
    const manque = await libellesManquants(site);
    if (manque.length) console.log(`\n!! Libellés à ajouter dans js/textes.js (français ET anglais) :\n  ${manque.join('\n  ')}`);
    const aEcrire = site.armes.filter((a) => !a.description.fr || !a.description.en).map((a) => a.id);
    if (aEcrire.length) console.log(`\nDescriptions vides : ${aEcrire.join(', ')}`);
    if (ajoutees.length || modifiees.some((m) => m.includes('modèle 3D'))) console.log('\nRefaire les visuels : node outils/armes/fabriquer-visuels.mjs');
    if (essai) { console.log('\n--essai : rien n’a été écrit.'); return 0; }

    fs.rmSync(DEST, { recursive: true, force: true });
    for (const f of liste) {
      fs.mkdirSync(path.dirname(path.join(DEST, f)), { recursive: true });
      fs.copyFileSync(path.join(source, f), path.join(DEST, f));
    }
    const origine = {
      _note: 'Copie figée du jeu pour les visuels de la section Armes du site (lot 6a). Fichiers repris TELS QUELS, jamais retouchés, jamais publiés. Refaire : node outils/armes/copier-armes.mjs (outils/armes/LISEZMOI.md) ; vérifier : node outils/armes/copier-armes.mjs --verifier.',
      depot: 'Nowyyy/Z-Survival',
      branche: BRANCHE,
      commit,
      date,
      titre,
      copieLe: new Date().toISOString().slice(0, 10),
      precedent: origineAvant ? { commit: origineAvant.commit, date: origineAvant.date } : null,
      changements: origineAvant ? { ajoutees, modifiees, disparues } : null,
      absentsDuJeu: absents,
      armes: Object.fromEntries(releve.map((r) => [r.id, { nom: r.nom, categorieJeu: r.categorieJeu, classeJeu: r.classeJeu, active: r.active, variante: r.variante, empreinteDefinition: r.empreinteDefinition, empreinteModele: r.empreinteModele }])),
      lusSansCopie: lus,
      fichiers,
    };
    fs.writeFileSync(path.join(DEST, 'ORIGINE.json'), `${JSON.stringify(origine, null, 1)}\n`);
    fs.writeFileSync(DONNEES_SITE, ecrireSite(site));
    console.log(`\n${liste.length} fichiers copiés dans armes/jeu/ (origine et empreintes : armes/jeu/ORIGINE.json) ; contenus/armes.json mis à jour.`);
    return 0;
  } catch (e) {
    console.error(`Erreur : ${e.message}`);
    return 1;
  } finally {
    if (temporaire) fs.rmSync(temporaire, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
