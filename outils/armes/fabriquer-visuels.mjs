// Lot 6a — Visuels des armes de la section Armes du site : img/armes/<id>.webp (grande, 1200 × 600) et img/armes/<id>-mini.webp
// (miniature, 320 × 160), WebP avec transparence, tirés du vrai modèle 3D du jeu (copie figée armes/jeu/, outils/armes/copier-armes.mjs).
// Mode d'emploi : outils/armes/LISEZMOI.md.
//
//   node outils/armes/fabriquer-visuels.mjs                 toutes les armes de contenus/armes.json
//   node outils/armes/fabriquer-visuels.mjs --armes=kar98k,m1911   seulement ces armes
//
// Chromium sans écran (Playwright, WebGL logiciel SwiftShader) ouvre outils/armes/rendu.html, qui rend chaque arme avec Three.js (copie du
// jeu) à deux fois la taille, la réduit et l'encode en WebP avec transparence (encodeur de Chromium : ffmpeg perdait la transparence).
// Déterministe : mêmes fichiers d'entrée → mêmes images.
// La page d'accueil ne charge jamais Three.js pour cette section : seulement ces images.
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SORTIE = join(RACINE, 'img/armes');
export const FORMATS = {
  grande: { suffixe: '', largeur: 1200, hauteur: 600, qualite: 82 },
  mini: { suffixe: '-mini', largeur: 320, hauteur: 160, qualite: 80 },
};
const SURECHANTILLON = 2;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const args = new Map(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const site = JSON.parse(readFileSync(join(RACINE, 'contenus/armes.json'), 'utf8'));
const voulues = args.get('armes') ? String(args.get('armes')).split(',') : site.armes.map((a) => a.id);

function servir() {
  const serveur = createServer((req, res) => {
    const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const fichier = normalize(join(RACINE, chemin));
    if (!fichier.startsWith(RACINE) || !existsSync(fichier) || statSync(fichier).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream' });
    createReadStream(fichier).pipe(res);
  });
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok(serveur)));
}

const serveur = await servir();
const { chromium } = require('playwright');
const navigateur = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await navigateur.newPage({ viewport: { width: 800, height: 400 } });
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) erreurs.push(`${r.status()} ${r.url()}`); });
const fabrication = { _note: 'Visuels des armes (lot 6a), fabriqués par node outils/armes/fabriquer-visuels.mjs depuis armes/jeu/ (copie figée du jeu).', jeu: null, vue: null, formats: FORMATS, armes: {} };
try {
  await page.goto(`http://127.0.0.1:${serveur.address().port}/outils/armes/rendu.html`);
  await page.waitForFunction(() => window.__armes?.pret || window.__armesErreur, null, { timeout: 120000 });
  const etat = await page.evaluate(() => (window.__armesErreur ? { erreur: window.__armesErreur } : { ids: window.__armes.ids, ecarts: window.__armes.ecarts, vue: window.__armes.vue, poses: window.__armes.poses }));
  if (etat.erreur) throw new Error(`rendu : ${etat.erreur}`);
  if (etat.ecarts.length) console.warn(`Écarts signalés par les données du jeu : ${etat.ecarts.join(' ; ')}`);
  const origine = JSON.parse(readFileSync(join(RACINE, 'armes/jeu/ORIGINE.json'), 'utf8'));
  fabrication.jeu = { depot: origine.depot, branche: origine.branche, commit: origine.commit };
  fabrication.vue = etat.vue;
  fabrication.poses = etat.poses;
  mkdirSync(SORTIE, { recursive: true });
  for (const id of voulues) {
    if (!etat.ids.includes(id)) throw new Error(`arme absente de la copie du jeu : ${id} (relancer outils/armes/copier-armes.mjs)`);
    const g = FORMATS.grande;
    await page.evaluate(([i, l, h]) => window.__armes.rendre(i, l, h), [id, g.largeur * SURECHANTILLON, g.hauteur * SURECHANTILLON]);
    fabrication.armes[id] = { variante: origine.armes?.[id]?.variante ?? null, empreinteModele: origine.armes?.[id]?.empreinteModele ?? null, octets: {} };
    for (const [nom, f] of Object.entries(FORMATS)) {
      const fichier = join(SORTIE, `${id}${f.suffixe}.webp`);
      const webp = await page.evaluate(([l, h, q]) => window.__armes.encoder(l, h, q), [f.largeur, f.hauteur, f.qualite / 100]);
      if (!webp.startsWith('data:image/webp')) throw new Error(`${id} : encodeur WebP indisponible dans Chromium`);
      writeFileSync(fichier, Buffer.from(webp.slice(webp.indexOf(',') + 1), 'base64'));
      fabrication.armes[id].octets[nom] = statSync(fichier).size;
    }
    console.log(`${id.padEnd(16)} grande ${(fabrication.armes[id].octets.grande / 1024).toFixed(1)} Kio, mini ${(fabrication.armes[id].octets.mini / 1024).toFixed(1)} Kio`);
  }
  if (erreurs.length) throw new Error(erreurs.join(' | '));
  if (!args.get('armes')) writeFileSync(join(SORTIE, 'fabrication.json'), `${JSON.stringify(fabrication, null, 1)}\n`);
} finally {
  await navigateur.close();
  serveur.close();
}
