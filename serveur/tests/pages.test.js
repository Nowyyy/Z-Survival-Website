// Pages du site modifiables depuis l'administration (page « À propos ») : lecture publique, enregistrement, langues, refus.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fabriquer } from './aide.js';

describe('pages (À propos)', () => {
  let s;
  let jeton;
  before(async () => {
    s = await fabriquer();
    jeton = await s.connecter();
  });
  after(async () => { await s.fermer(); });

  const enregistrer = (corps, options = {}) => s.requete('PUT', '/api/admin/pages/a-propos', { jeton, corps, ...options });

  test('rien d’enregistré : { page: null } (le site garde ses textes par défaut), en cache 60 s', async () => {
    const r = await s.requete('GET', '/api/pages/a-propos?lang=fr');
    assert.equal(r.statut, 200);
    assert.deepEqual(r.json, { page: null });
    assert.equal(r.entetes.get('cache-control'), 'public, max-age=60');
    assert.deepEqual((await s.requete('GET', '/api/admin/pages/a-propos', { jeton })).json, { page: null });
  });

  test('jeton obligatoire pour lire (admin) et enregistrer', async () => {
    assert.equal((await s.requete('GET', '/api/admin/pages/a-propos')).statut, 401);
    assert.equal((await enregistrer({ titre_fr: 'T', contenu_fr: 'x' }, { jeton: undefined })).statut, 401);
    assert.equal((await enregistrer({ titre_fr: 'T', contenu_fr: 'x' }, { jeton: 'v1.faux.faux' })).statut, 401);
  });

  test('contrôle des entrées : français obligatoire, champs connus, longueurs', async () => {
    assert.equal((await enregistrer({ titre_fr: '', contenu_fr: 'x' })).statut, 400);
    assert.equal((await enregistrer({ titre_fr: 'T', contenu_fr: '   ' })).statut, 400);
    assert.equal((await enregistrer({ titre_fr: 'T', contenu_fr: 'x', image: 'a' })).statut, 400);
    assert.equal((await enregistrer({ titre_fr: 'T'.repeat(121), contenu_fr: 'x' })).statut, 400);
    assert.equal((await enregistrer({ titre_fr: 'T', contenu_fr: 'x'.repeat(20_001) })).statut, 400);
    assert.equal((await enregistrer({ titre_fr: 1, contenu_fr: 'x' })).statut, 400);
    assert.equal((await s.requete('PUT', '/api/admin/pages/inconnue', { jeton, corps: { titre_fr: 'T', contenu_fr: 'x' } })).statut, 404);
    assert.equal((await s.requete('GET', '/api/pages/inconnue')).statut, 404);
  });

  test('français seulement : le site anglais reçoit le français (langue « fr »)', async () => {
    const r = await enregistrer({ titre_fr: '  Le studio  ', contenu_fr: 'No Way **Studio** fait des jeux.' });
    assert.equal(r.statut, 200);
    assert.equal(r.json.page.titre_fr, 'Le studio');
    assert.equal(r.json.page.titre_en, '');
    const en = (await s.requete('GET', '/api/pages/a-propos?lang=en')).json.page;
    assert.deepEqual(en, { cle: 'a-propos', langue: 'fr', titre: 'Le studio', contenu: 'No Way **Studio** fait des jeux.', modifie_le: '2026-11-15T12:00:00.000Z' });
  });

  test('français et anglais : chaque langue reçoit son texte ; un nouvel enregistrement remplace l’ancien', async () => {
    s.horloge.t += 60_000;
    await enregistrer({ titre_fr: 'À propos', titre_en: 'About us', contenu_fr: 'Texte français.', contenu_en: 'English text.' });
    const fr = (await s.requete('GET', '/api/pages/a-propos?lang=fr')).json.page;
    const en = (await s.requete('GET', '/api/pages/a-propos?lang=en')).json.page;
    assert.equal(fr.titre, 'À propos');
    assert.equal(fr.contenu, 'Texte français.');
    assert.equal(en.titre, 'About us');
    assert.equal(en.contenu, 'English text.');
    assert.equal(en.langue, 'en');
    assert.equal(en.modifie_le, '2026-11-15T12:01:00.000Z');
    assert.equal(Number((await s.db.execute('SELECT COUNT(*) AS n FROM pages')).rows[0].n), 1);
    const admin = (await s.requete('GET', '/api/admin/pages/a-propos', { jeton })).json.page;
    assert.equal(admin.contenu_en, 'English text.');
  });
});
