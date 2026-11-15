// Migrations (relançables sans risque) et route de santé.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appliquerMigrations, decouperSql, listerMigrations, ouvrirBase, versionMigrations } from '../src/base.js';
import { creerApp } from '../src/app.js';
import { creerJournal } from '../src/journal.js';
import { lireConfig, valeursSecretes } from '../src/config.js';
import { fabriquer } from './aide.js';

test('les fichiers de migration sont numérotés sans trou', async () => {
  const m = await listerMigrations();
  assert.ok(m.length >= 1);
  m.forEach((x, i) => assert.equal(x.version, i + 1));
});

test('migrations : tables créées, relance sans effet ni erreur, données gardées', async () => {
  const s = await fabriquer();
  try {
    const tables = (await s.db.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).rows.map((r) => r.name);
    for (const t of ['articles', 'migrations', 'tentatives_connexion']) assert.ok(tables.includes(t), t);
    const colonnes = (await s.db.execute('PRAGMA table_info(articles)')).rows.map((r) => r.name);
    assert.deepEqual(colonnes, ['id', 'slug', 'statut', 'date_publication', 'titre_fr', 'titre_en', 'contenu_fr', 'contenu_en', 'image', 'cree_le', 'modifie_le', 'annonce_discord_le']);

    await s.db.execute("INSERT INTO articles (slug, titre_fr, cree_le, modifie_le) VALUES ('garde', 'x', 'a', 'a')");
    const v1 = await versionMigrations(s.db);
    assert.equal(await appliquerMigrations(s.db), v1);
    assert.equal(await appliquerMigrations(s.db), v1);
    // Deux démarrages en même temps (deux instances) : pas d'erreur.
    const [a, b] = await Promise.all([appliquerMigrations(s.db), appliquerMigrations(s.db)]);
    assert.equal(a, v1);
    assert.equal(b, v1);
    assert.equal(Number((await s.db.execute('SELECT COUNT(*) AS n FROM migrations')).rows[0].n), v1);
    assert.equal(Number((await s.db.execute("SELECT COUNT(*) AS n FROM articles WHERE slug = 'garde'")).rows[0].n), 1);
    await assert.rejects(s.db.execute("INSERT INTO articles (slug, statut, titre_fr, cree_le, modifie_le) VALUES ('mauvais', 'autre', 'x', 'a', 'a')"));
  } finally {
    await s.fermer();
  }
});

test('découpage SQL : commentaires ignorés', () => {
  assert.deepEqual(decouperSql('-- titre\nCREATE TABLE a (x);\n\n-- autre\nCREATE INDEX i ON a (x);\n'), ['CREATE TABLE a (x)', 'CREATE INDEX i ON a (x)']);
});

test('GET /api/sante : base connectée, version des migrations, pas de cache', async () => {
  const s = await fabriquer();
  try {
    const r = await s.requete('GET', '/api/sante');
    assert.equal(r.statut, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.base, 'connectée');
    assert.equal(r.json.version_migrations, (await listerMigrations()).length);
    assert.equal(r.entetes.get('cache-control'), 'no-store');
    assert.equal(r.entetes.get('x-content-type-options'), 'nosniff');
  } finally {
    await s.fermer();
  }
});

test('GET /api/sante : base injoignable → ok false, « non connectée », sans détail', async () => {
  // Base distante injoignable (rien n'écoute sur ce port) : comme un Turso en panne.
  const jetonFactice = 'jeton-factice-pour-le-test-0123456789';
  const config = lireConfig({ TURSO_DATABASE_URL: 'http://127.0.0.1:9', TURSO_AUTH_TOKEN: jetonFactice });
  const lignes = [];
  const app = creerApp({ config, db: ouvrirBase(config), journal: creerJournal({ secrets: valeursSecretes(config), ecrire: (l) => lignes.push(l) }) });
  const res = await app.request('/api/sante');
  assert.equal(res.status, 503);
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.equal(json.base, 'non connectée');
  assert.equal(json.version_migrations, null);
  const liste = await app.request('/api/articles');
  assert.equal(liste.status, 503);
  assert.deepEqual(await liste.json(), { erreur: 'Base de données indisponible.' });
  // Le journal note l'échec sans l'adresse ni le jeton de la base.
  assert.ok(lignes.some((l) => l.includes('Migrations impossibles')));
  assert.ok(!lignes.join('\n').includes(jetonFactice));
  assert.ok(!lignes.join('\n').includes('127.0.0.1:9'));

  // Sans aucune base configurée.
  const sansBase = creerApp({ config: lireConfig({}), db: null, journal: creerJournal({ ecrire: () => {} }) });
  const r2 = await sansBase.request('/api/sante');
  assert.equal(r2.status, 503);
  assert.equal((await r2.json()).base, 'non connectée');
});
