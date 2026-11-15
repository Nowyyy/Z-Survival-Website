// Outils communs aux tests : une base SQLite en fichier temporaire (jamais Turso), des secrets
// tirés au hasard à chaque lancement (aucune valeur dans le dépôt), une horloge réglable,
// et un journal capturé pour vérifier qu'aucun secret n'y apparaît.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import { lireConfig, valeursSecretes } from '../src/config.js';
import { creerJournal } from '../src/journal.js';
import { ouvrirBase } from '../src/base.js';
import { creerApp } from '../src/app.js';
import { calculerEmpreinte } from '../src/mot-de-passe.js';

// Calculée une seule fois par fichier de test (600 000 itérations : environ un tiers de seconde).
const identifiant = `admin-${randomBytes(6).toString('hex')}`;
const motDePasse = randomBytes(18).toString('base64url');
const empreinte = await calculerEmpreinte(motDePasse);
const cleSession = randomBytes(32).toString('base64');

export const SECRETS_TEST = Object.freeze({ identifiant, motDePasse, empreinte, cleSession });

export const ORIGINE = 'https://zsurvival-game.com';
/** Anciennes adresses, qui redirigent vers le domaine : plus acceptées par le serveur. */
export const ORIGINE_WWW = 'https://www.zsurvival-game.com';
export const ORIGINE_ANCIENNE = 'https://nowyyy.github.io';

/** Crée une application de test complète sur une base neuve. */
export async function fabriquer({ env = {}, fetchGithub } = {}) {
  const dossier = await mkdtemp(path.join(tmpdir(), 'zs-serveur-test-'));
  const config = lireConfig({
    NODE_ENV: 'test',
    TURSO_DATABASE_URL: `file:${path.join(dossier, 'test.db')}`,
    ADMIN_IDENTIFIANT: identifiant,
    ADMIN_EMPREINTE: empreinte,
    CLE_SESSION: cleSession,
    ...env,
  });
  const lignes = [];
  const journal = creerJournal({ secrets: valeursSecretes(config), ecrire: (l) => lignes.push(l) });
  const db = ouvrirBase(config);
  const horloge = { t: Date.parse('2026-11-15T12:00:00Z') };
  const app = creerApp({ config, db, journal, maintenant: () => horloge.t, ...(fetchGithub ? { fetchGithub } : {}) });
  await app.preparer();

  let numeroIp = 0;
  /** Requête JSON ; ip : adresse simulée (X-Forwarded-For), une nouvelle par défaut. */
  async function requete(methode, chemin, { corps, jeton, origine, ip, entetes = {} } = {}) {
    const headers = { ...entetes };
    const brut = corps instanceof Uint8Array;
    if (corps !== undefined && !brut) headers['Content-Type'] = 'application/json';
    if (jeton) headers.Authorization = `Bearer ${jeton}`;
    if (origine) headers.Origin = origine;
    headers['X-Forwarded-For'] = ip ?? `203.0.113.${(numeroIp++ % 250) + 1}`;
    const res = await app.request(chemin, {
      method: methode,
      headers,
      body: corps === undefined ? undefined : brut || typeof corps === 'string' ? corps : JSON.stringify(corps),
    });
    const texte = await res.text();
    let json = null;
    try { json = JSON.parse(texte); } catch { /* pas du JSON */ }
    return { statut: res.status, entetes: res.headers, json, texte };
  }

  async function connecter() {
    const r = await requete('POST', '/api/admin/connexion', { corps: { identifiant, mot_de_passe: motDePasse } });
    if (r.statut !== 200) throw new Error(`connexion de test impossible (${r.statut})`);
    return r.json.jeton;
  }

  async function fermer() {
    db.close();
    await rm(dossier, { recursive: true, force: true });
  }

  return { app, db, config, horloge, lignes, requete, connecter, fermer, dossier };
}
