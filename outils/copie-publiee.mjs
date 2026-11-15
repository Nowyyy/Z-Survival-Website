// Copie exacte de ce que publie .github/workflows/pages.yml (même commande cp), servie sous /Z-Survival-Website/ comme sur
// GitHub Pages. Utilisé par les contrôles Playwright (outils/musique/verifier-planche.mjs, outils/musique/verifier-site.mjs).
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.txt': 'text/plain', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

// Retour : { base (adresse de la racine du site, finit par « / »), commande (cp du workflow), fermer() }.
export async function servirCopiePubliee() {
  const workflow = readFileSync(join(RACINE, '.github', 'workflows', 'pages.yml'), 'utf8');
  const commande = workflow.split('\n').map((l) => l.trim()).find((l) => l.startsWith('cp -r '));
  const site = mkdtempSync(join(tmpdir(), 'site-'));
  const dossier = join(site, 'Z-Survival-Website');
  execSync(`rm -rf _site && mkdir -p _site && ${commande} && mv _site "${dossier}"`, { cwd: RACINE });
  const serveur = createServer((req, res) => {
    let chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (chemin.endsWith('/')) chemin += 'index.html';
    const fichier = normalize(join(site, chemin));
    if (!fichier.startsWith(site) || !existsSync(fichier) || statSync(fichier).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream', 'content-length': statSync(fichier).size });
    createReadStream(fichier).pipe(res);
  });
  await new Promise((ok) => { serveur.listen(0, '127.0.0.1', ok); });
  return { base: `http://127.0.0.1:${serveur.address().port}/Z-Survival-Website/`, commande, dossier, fermer: () => serveur.close() };
}
