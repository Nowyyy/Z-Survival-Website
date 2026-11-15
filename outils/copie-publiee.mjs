// Copie exacte de ce que publie .github/workflows/pages.yml (même commande cp), servie à la racine comme sur le domaine
// https://zsurvival-game.com/ (lot 4a), ou sous /Z-Survival-Website/ avec --sous-dossier (ancienne adresse GitHub Pages : vérifie que
// tous les chemins restent relatifs). Utilisé par les contrôles Playwright (outils/*/verifier-*.mjs).
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
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

// Retour : { base (adresse de la racine du site, finit par « / »), commande (cp du workflow), dossier, fermer() }.
export async function servirCopiePubliee({ sousDossier = process.argv.includes('--sous-dossier') } = {}) {
  const workflow = readFileSync(join(RACINE, '.github', 'workflows', 'pages.yml'), 'utf8');
  const commande = workflow.split('\n').map((l) => l.trim()).find((l) => l.startsWith('cp -r '));
  const site = mkdtempSync(join(tmpdir(), 'site-'));
  const prefixe = sousDossier ? 'Z-Survival-Website/' : '';
  const dossier = sousDossier ? join(site, 'Z-Survival-Website') : join(site, 'racine');
  execSync(`rm -rf _site && mkdir -p _site && ${commande} && mv _site "${dossier}"`, { cwd: RACINE });
  const serveur = createServer((req, res) => {
    let chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (chemin.endsWith('/')) chemin += 'index.html';
    const fichier = normalize(sousDossier ? join(site, chemin) : join(dossier, chemin));
    if (!fichier.startsWith(dossier) || !existsSync(fichier) || statSync(fichier).isDirectory()) { res.writeHead(404); res.end(); return; }
    const taille = statSync(fichier).size;
    const type = TYPES[extname(fichier)] ?? 'application/octet-stream';
    // Requêtes partielles (Range), comme GitHub Pages : les vidéos de l'accueil (lot 2b) se lisent par morceaux.
    const plage = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (plage && (plage[1] || plage[2])) {
      const debut = plage[1] ? Number(plage[1]) : Math.max(0, taille - Number(plage[2]));
      const fin = plage[1] && plage[2] ? Math.min(Number(plage[2]), taille - 1) : taille - 1;
      if (debut > fin || debut >= taille) { res.writeHead(416, { 'content-range': `bytes */${taille}` }); res.end(); return; }
      res.writeHead(206, { 'content-type': type, 'content-length': fin - debut + 1, 'content-range': `bytes ${debut}-${fin}/${taille}`, 'accept-ranges': 'bytes' });
      createReadStream(fichier, { start: debut, end: fin }).pipe(res);
      return;
    }
    res.writeHead(200, { 'content-type': type, 'content-length': taille, 'accept-ranges': 'bytes' });
    createReadStream(fichier).pipe(res);
  });
  await new Promise((ok) => { serveur.listen(0, '127.0.0.1', ok); });
  return { base: `http://127.0.0.1:${serveur.address().port}/${prefixe}`, commande, dossier, fermer: () => serveur.close() };
}

// Lot 3b : la section Actualités appelle le serveur (adresse de js/config.js). Les contrôles locaux qui ne portent pas sur les
// actualités (accueil, musique) lui substituent une réponse vide (aucun article) : pas d'appel réseau, pas d'erreur console.
// Les actualités elles-mêmes sont vérifiées par outils/admin/verifier-actus.mjs (vrai serveur en local).
export async function simulerActualites(cible) {
  const { ADRESSE_SERVEUR } = await import(new URL('../js/config.js', import.meta.url).href);
  await cible.route(`${ADRESSE_SERVEUR}/**`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ lang: 'fr', page: 1, par_page: 10, total: 0, pages: 0, articles: [] }),
  }));
}
