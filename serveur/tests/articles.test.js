// Articles : CRUD côté admin, publication, et seuls les articles publiés sont visibles côté public.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fabriquer } from './aide.js';

describe('articles', () => {
  let s;
  let jeton;
  before(async () => {
    s = await fabriquer();
    jeton = await s.connecter();
  });
  after(async () => { await s.fermer(); });

  const creer = (corps) => s.requete('POST', '/api/admin/articles', { jeton, corps });

  test('création : brouillon par défaut, dates remplies', async () => {
    const r = await creer({ slug: 'premier-article', titre_fr: 'Premier', titre_en: 'First', contenu_fr: '# Bonjour', contenu_en: '# Hello' });
    assert.equal(r.statut, 201);
    const a = r.json.article;
    assert.equal(a.slug, 'premier-article');
    assert.equal(a.statut, 'brouillon');
    assert.equal(a.date_publication, null);
    assert.equal(a.image, '');
    assert.equal(a.cree_le, '2026-11-15T12:00:00.000Z');
    assert.equal(a.modifie_le, a.cree_le);
  });

  test('slug unique (409)', async () => {
    const r = await creer({ slug: 'premier-article', titre_fr: 'Doublon' });
    assert.equal(r.statut, 409);
  });

  test('un brouillon n’est pas visible côté public', async () => {
    const liste = await s.requete('GET', '/api/articles?lang=fr');
    assert.equal(liste.statut, 200);
    assert.equal(liste.json.total, 0);
    assert.deepEqual(liste.json.articles, []);
    assert.equal((await s.requete('GET', '/api/articles/premier-article')).statut, 404);
  });

  test('publication, puis visible ; dépublication, puis invisible', async () => {
    const [a] = (await s.requete('GET', '/api/admin/articles', { jeton })).json.articles;
    s.horloge.t += 60_000;
    const pub = await s.requete('POST', `/api/admin/articles/${a.id}/publier`, { jeton });
    assert.equal(pub.statut, 200);
    assert.equal(pub.json.article.statut, 'publie');
    assert.equal(pub.json.article.date_publication, '2026-11-15T12:01:00.000Z');

    const fr = await s.requete('GET', '/api/articles/premier-article?lang=fr');
    assert.equal(fr.statut, 200);
    assert.deepEqual(fr.json.article, {
      slug: 'premier-article', date_publication: '2026-11-15T12:01:00.000Z', langue: 'fr', titre: 'Premier', contenu: '# Bonjour', image: '',
    });
    assert.equal(fr.entetes.get('cache-control'), 'public, max-age=60');
    const en = await s.requete('GET', '/api/articles/premier-article?lang=en');
    assert.equal(en.json.article.titre, 'First');
    assert.equal(en.json.article.langue, 'en');
    // Le public ne voit ni id, ni statut, ni dates internes.
    assert.equal(en.json.article.id, undefined);
    assert.equal(en.json.article.statut, undefined);

    const dep = await s.requete('POST', `/api/admin/articles/${a.id}/depublier`, { jeton });
    assert.equal(dep.json.article.statut, 'brouillon');
    assert.equal((await s.requete('GET', '/api/articles/premier-article')).statut, 404);
    assert.equal((await s.requete('GET', '/api/articles')).json.total, 0);
  });

  test('publier exige un titre et un contenu en français', async () => {
    const r = await creer({ slug: 'sans-contenu', titre_fr: 'Titre seul', statut: 'publie' });
    assert.equal(r.statut, 400);
    const b = await creer({ slug: 'sans-contenu', titre_fr: 'Titre seul' });
    assert.equal(b.statut, 201);
    assert.equal((await s.requete('POST', `/api/admin/articles/${b.json.article.id}/publier`, { jeton })).statut, 400);
  });

  test('liste publique : publiés seulement, du plus récent au plus ancien, pagination, repli sur le français', async () => {
    for (let i = 1; i <= 12; i++) {
      const r = await creer({
        slug: `actu-${i}`,
        titre_fr: `Actu ${i}`,
        titre_en: i % 2 === 0 ? `News ${i}` : '',
        contenu_fr: `Texte ${i}`,
        contenu_en: i % 2 === 0 ? `Text ${i}` : '',
        statut: i === 5 ? 'brouillon' : 'publie',
        date_publication: `2026-10-${String(i).padStart(2, '0')}T08:00:00Z`,
      });
      assert.equal(r.statut, 201);
    }
    const p1 = await s.requete('GET', '/api/articles?lang=en&page=1');
    assert.equal(p1.json.total, 11);
    assert.equal(p1.json.pages, 2);
    assert.equal(p1.json.articles.length, 10);
    assert.deepEqual(p1.json.articles.slice(0, 3).map((a) => a.slug), ['actu-12', 'actu-11', 'actu-10']);
    assert.equal(p1.json.articles[0].titre, 'News 12');
    assert.equal(p1.json.articles[1].titre, 'Actu 11', 'sans anglais : le français');
    assert.equal(p1.json.articles[1].langue, 'fr');
    assert.ok(!p1.json.articles.some((a) => a.slug === 'actu-5' || a.slug === 'sans-contenu' || a.slug === 'premier-article'));
    const p2 = await s.requete('GET', '/api/articles?lang=en&page=2');
    assert.deepEqual(p2.json.articles.map((a) => a.slug), ['actu-1']);
    const p3 = await s.requete('GET', '/api/articles?page=3');
    assert.deepEqual(p3.json.articles, []);
  });

  test('liste admin : brouillons compris', async () => {
    const r = await s.requete('GET', '/api/admin/articles', { jeton });
    assert.equal(r.json.total, 14);
    assert.ok(r.json.articles.some((a) => a.statut === 'brouillon'));
    assert.equal(r.entetes.get('cache-control'), 'no-store');
  });

  test('lecture, modification (PUT), changement de slug, suppression', async () => {
    const [a] = (await s.requete('GET', '/api/admin/articles', { jeton })).json.articles.filter((x) => x.slug === 'actu-3');
    const lu = await s.requete('GET', `/api/admin/articles/${a.id}`, { jeton });
    assert.equal(lu.json.article.titre_fr, 'Actu 3');

    s.horloge.t += 60_000;
    const mod = await s.requete('PUT', `/api/admin/articles/${a.id}`, { jeton, corps: { titre_fr: 'Actu 3 corrigée', slug: 'actu-trois', image: 'images/2026/actu-3.webp' } });
    assert.equal(mod.statut, 200);
    assert.equal(mod.json.article.titre_fr, 'Actu 3 corrigée');
    assert.equal(mod.json.article.contenu_fr, 'Texte 3', 'les champs non fournis restent');
    assert.equal(mod.json.article.image, 'images/2026/actu-3.webp');
    assert.equal(mod.json.article.modifie_le, '2026-11-15T12:02:00.000Z');
    assert.notEqual(mod.json.article.cree_le, mod.json.article.modifie_le);
    assert.equal((await s.requete('GET', '/api/articles/actu-3')).statut, 404);
    assert.equal((await s.requete('GET', '/api/articles/actu-trois')).json.article.titre, 'Actu 3 corrigée');

    assert.equal((await s.requete('PUT', `/api/admin/articles/${a.id}`, { jeton, corps: { slug: 'actu-4' } })).statut, 409);
    assert.equal((await s.requete('PUT', `/api/admin/articles/${a.id}`, { jeton, corps: {} })).statut, 400);
    assert.equal((await s.requete('PUT', '/api/admin/articles/999999', { jeton, corps: { titre_fr: 'x' } })).statut, 404);

    const sup = await s.requete('DELETE', `/api/admin/articles/${a.id}`, { jeton });
    assert.deepEqual(sup.json, { supprime: true, id: a.id });
    assert.equal((await s.requete('GET', `/api/admin/articles/${a.id}`, { jeton })).statut, 404);
    assert.equal((await s.requete('DELETE', `/api/admin/articles/${a.id}`, { jeton })).statut, 404);
    assert.equal((await s.requete('GET', '/api/articles/actu-trois')).statut, 404);
  });

  test('un jeton expire au bout de 2 heures', async () => {
    s.horloge.t += 2 * 3600 * 1000 + 1000;
    assert.equal((await s.requete('GET', '/api/admin/articles', { jeton })).statut, 401);
  });
});
