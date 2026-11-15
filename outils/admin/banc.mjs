// Banc d'essai local des actualités (lot 3b), sans Internet ni secret réel :
// - le VRAI serveur (serveur/src/index.js) sur une base SQLite en fichier temporaire, avec des secrets tirés au hasard ;
// - une API GitHub SIMULÉE : chaque image « commitée » est écrite dans la copie publiée du site (comme GitHub Pages la republierait) ;
// - une copie exacte de ce que publie .github/workflows/pages.yml, servie sous /Z-Survival-Website/ (outils/copie-publiee.mjs) ;
// - brancher(page) : dans Playwright, les appels vers l'adresse de js/config.js (…run.app) partent vers ce serveur local.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { servirCopiePubliee } from '../copie-publiee.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { ADRESSE_SERVEUR } = await import(pathToFileURL(join(RACINE, 'js', 'config.js')).href);
const { calculerEmpreinte } = await import(pathToFileURL(join(RACINE, 'serveur', 'src', 'mot-de-passe.js')).href);

const libre = () => new Promise((ok) => {
  const s = createServer();
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
});

/** Fausse API GitHub (contents) : listage de img/actus, lecture (sha), PUT → écrit le fichier dans dossierSite (comme GitHub Pages le
 *  republierait), DELETE → l'efface. etat.commits : écritures ; etat.suppressions : suppressions. */
async function fausseApiGithub(dossierSite, jeton) {
  const etat = { commits: [], suppressions: [], refus: false, fichiers: new Map() };
  const json = (res, statut, corps) => { res.writeHead(statut, { 'content-type': 'application/json' }); res.end(JSON.stringify(corps)); };
  const serveur = createServer((req, res) => {
    let corps = '';
    req.on('data', (d) => { corps += d; });
    req.on('end', () => {
      const m = /^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+?)(?:\?.*)?$/.exec(req.url);
      if (!m || req.headers.authorization !== `Bearer ${jeton}` || etat.refus) { json(res, 401, { message: 'Bad credentials' }); return; }
      const chemin = decodeURIComponent(m[3]);
      if (req.method === 'GET' && chemin === 'img/actus') {
        const liste = [...etat.fichiers].map(([f, info]) => ({ type: 'file', name: f.slice(10), sha: info.sha, size: info.octets }));
        if (liste.length) json(res, 200, liste); else json(res, 404, { message: 'Not Found' });
        return;
      }
      if (req.method === 'GET') {
        if (etat.fichiers.has(chemin)) json(res, 200, { sha: etat.fichiers.get(chemin).sha }); else json(res, 404, {});
        return;
      }
      const donnees = JSON.parse(corps);
      if (req.method === 'DELETE') {
        if (!etat.fichiers.has(chemin)) { json(res, 404, {}); return; }
        if (donnees.sha !== etat.fichiers.get(chemin).sha) { json(res, 409, { message: 'sha' }); return; }
        etat.fichiers.delete(chemin);
        rmSync(join(dossierSite, chemin), { force: true });
        etat.suppressions.push({ chemin, branche: donnees.branch, auteur: donnees.author });
        json(res, 200, { commit: { sha: randomBytes(20).toString('hex') } });
        return;
      }
      const fichier = join(dossierSite, chemin);
      mkdirSync(dirname(fichier), { recursive: true });
      const octets = Buffer.from(donnees.content, 'base64');
      writeFileSync(fichier, octets);
      etat.fichiers.set(chemin, { sha: randomBytes(20).toString('hex'), octets: octets.length });
      etat.commits.push({ depot: `${m[1]}/${m[2]}`, chemin, branche: donnees.branch, auteur: donnees.author, message: donnees.message });
      json(res, 201, { commit: { sha: randomBytes(20).toString('hex') } });
    });
  });
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  return { etat, adresse: `http://127.0.0.1:${serveur.address().port}`, fermer: () => serveur.close() };
}

export async function demarrerBanc({ avecJetonGithub = true, journal = false } = {}) {
  const copie = await servirCopiePubliee();
  const dossierBase = mkdtempSync(join(tmpdir(), 'zs-banc-'));
  const identifiant = `admin-${randomBytes(4).toString('hex')}`;
  const motDePasse = randomBytes(15).toString('base64url');
  const jetonGithub = `test_${randomBytes(16).toString('hex')}`;
  const github = await fausseApiGithub(copie.dossier, jetonGithub);
  const port = await libre();
  const env = {
    PATH: process.env.PATH,
    NODE_ENV: 'development',
    PORT: String(port),
    TURSO_DATABASE_URL: `file:${join(dossierBase, 'banc.db')}`,
    ADMIN_IDENTIFIANT: identifiant,
    ADMIN_EMPREINTE: await calculerEmpreinte(motDePasse),
    CLE_SESSION: randomBytes(32).toString('base64'),
    GITHUB_API: github.adresse,
    ...(avecJetonGithub ? { GITHUB_JETON_IMAGES: jetonGithub } : {}),
  };
  const journalServeur = [];
  const processus = spawn(process.execPath, ['src/index.js'], { cwd: join(RACINE, 'serveur'), env, stdio: ['ignore', 'pipe', 'pipe'] });
  const lireSortie = (d) => {
    for (const l of String(d).split('\n').filter(Boolean)) {
      journalServeur.push(l);
      if (journal) console.log(`   [serveur] ${l}`);
    }
  };
  processus.stdout.on('data', lireSortie);
  processus.stderr.on('data', lireSortie);
  const local = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`${local}/api/sante`)).ok) break; } catch { /* pas encore prêt */ }
    await new Promise((ok) => setTimeout(ok, 100));
  }

  /** Dans Playwright : les requêtes vers ADRESSE_SERVEUR partent vers le serveur local (en-têtes et corps tels quels). */
  async function brancher(contexte, { coupe = () => false, lenteur = () => 0 } = {}) {
    await contexte.route(`${ADRESSE_SERVEUR}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (coupe(url, req)) { await route.abort('connectionrefused'); return; }
      const attente = lenteur(url, req);
      if (attente) await new Promise((ok) => setTimeout(ok, attente));
      const entetes = { ...req.headers() };
      delete entetes.host;
      try {
        const r = await fetch(`${local}${url.pathname}${url.search}`, { method: req.method(), headers: entetes, body: req.postDataBuffer() ?? undefined });
        await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
      } catch {
        await route.abort('failed').catch(() => {});
      }
    });
  }

  /** Appel direct au serveur local (préparation des données des tests). */
  async function api(methode, chemin, { corps, jeton, type } = {}) {
    const headers = {};
    if (corps !== undefined) headers['Content-Type'] = type ?? 'application/json';
    if (jeton) headers.Authorization = `Bearer ${jeton}`;
    const r = await fetch(`${local}${chemin}`, { method: methode, headers, body: corps === undefined ? undefined : type ? corps : JSON.stringify(corps) });
    const texte = await r.text();
    let json = null;
    try { json = JSON.parse(texte); } catch { /* pas du JSON */ }
    return { statut: r.status, json, texte };
  }

  async function connecter() {
    const r = await api('POST', '/api/admin/connexion', { corps: { identifiant, mot_de_passe: motDePasse } });
    return r.json?.jeton;
  }

  function fermer() {
    processus.kill('SIGTERM');
    github.fermer();
    copie.fermer();
    rmSync(dossierBase, { recursive: true, force: true });
  }

  return {
    base: copie.base, dossierSite: copie.dossier, commande: copie.commande, local, ADRESSE_SERVEUR,
    identifiant, motDePasse, jetonGithub, github: github.etat, journalServeur, secrets: [motDePasse, env.CLE_SESSION, env.ADMIN_EMPREINTE, jetonGithub],
    brancher, api, connecter, fermer,
  };
}
