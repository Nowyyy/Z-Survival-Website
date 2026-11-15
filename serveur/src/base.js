// Base de données : client officiel @libsql/client.
// - En ligne : Turso (adresse libsql://…, jeton TURSO_AUTH_TOKEN).
// - En local et pour les tests : fichier SQLite (adresse file:…), jamais Turso.
//
// Migrations : fichiers NNN_nom.sql dans serveur/migrations/, appliquées dans l'ordre au démarrage.
// La table « migrations » garde la liste des versions déjà appliquées. Chaque migration est appliquée
// d'un bloc (transaction) avec sa ligne de suivi : relancer le serveur ne la rejoue pas, et deux
// instances qui démarrent en même temps ne la cassent pas (la seconde voit la version déjà notée).

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@libsql/client';

export const DOSSIER_MIGRATIONS = fileURLToPath(new URL('../migrations/', import.meta.url));

export function ouvrirBase(config) {
  if (!config.urlBase) return null;
  return createClient({ url: config.urlBase, authToken: config.jetonBase || undefined });
}

const CREER_SUIVI = `CREATE TABLE IF NOT EXISTS migrations (
  version INTEGER PRIMARY KEY,
  nom TEXT NOT NULL,
  appliquee_le TEXT NOT NULL
)`;

/** Liste triée des migrations présentes sur le disque : [{ version, nom, fichier }]. */
export async function listerMigrations(dossier = DOSSIER_MIGRATIONS) {
  const fichiers = (await readdir(dossier)).filter((f) => /^\d{3}_[a-z0-9_-]+\.sql$/.test(f)).sort();
  return fichiers.map((fichier) => ({ version: Number(fichier.slice(0, 3)), nom: fichier.slice(4, -4), fichier }));
}

/** Découpe un fichier SQL en instructions (chaque instruction finit par « ; » en fin de ligne). */
export function decouperSql(texte) {
  const sansCommentaires = texte
    .split('\n')
    .filter((ligne) => !ligne.trim().startsWith('--'))
    .join('\n');
  return sansCommentaires
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function versionMigrations(db) {
  const r = await db.execute('SELECT COALESCE(MAX(version), 0) AS version FROM migrations');
  return Number(r.rows[0].version);
}

/** Applique les migrations manquantes ; renvoie la version atteinte. */
export async function appliquerMigrations(db, { dossier = DOSSIER_MIGRATIONS, maintenant = () => new Date() } = {}) {
  await db.execute(CREER_SUIVI);
  const deja = new Set((await db.execute('SELECT version FROM migrations')).rows.map((r) => Number(r.version)));
  for (const m of await listerMigrations(dossier)) {
    if (deja.has(m.version)) continue;
    const sql = await readFile(path.join(dossier, m.fichier), 'utf8');
    const instructions = decouperSql(sql).map((s) => ({ sql: s, args: [] }));
    instructions.push({
      sql: 'INSERT INTO migrations (version, nom, appliquee_le) VALUES (?, ?, ?)',
      args: [m.version, m.nom, maintenant().toISOString()],
    });
    try {
      await db.batch(instructions, 'write');
    } catch (err) {
      // Une autre instance l'a appliquée entre-temps : la ligne de suivi existe, rien à faire.
      const v = await db.execute({ sql: 'SELECT 1 FROM migrations WHERE version = ?', args: [m.version] });
      if (v.rows.length === 0) throw err;
    }
  }
  return versionMigrations(db);
}
