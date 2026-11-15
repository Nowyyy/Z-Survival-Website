// Lot 3f : aperçu de partage (titre et description des balises Open Graph / Twitter d'index.html), lu et réécrit par l'API GitHub
// (simulée ici, avec le vrai index.html du dépôt).

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fabriquer } from './aide.js';
import { extrairePartage, remplacerPartage } from '../src/partage.js';

const JETON_GITHUB = `github_pat_${randomBytes(30).toString('hex')}`;
const INDEX = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const shaDe = (t) => createHash('sha1').update(t).digest('hex');

function githubSimule(contenu) {
  const etat = { contenu, commits: [], refus: 0 };
  etat.fetch = async (adresse, options = {}) => {
    if (options.headers?.Authorization !== `Bearer ${JETON_GITHUB}`) return new Response('{}', { status: 401 });
    if (etat.refus) return new Response('{}', { status: etat.refus });
    if (!/\/repos\/Nowyyy\/Z-Survival-Website\/contents\/index\.html/.test(adresse)) return new Response('{}', { status: 404 });
    if ((options.method ?? 'GET') === 'GET') return Response.json({ sha: shaDe(etat.contenu), content: Buffer.from(etat.contenu).toString('base64') });
    const corps = JSON.parse(options.body);
    if (corps.sha !== shaDe(etat.contenu)) return Response.json({ message: 'conflict' }, { status: 409 });
    etat.contenu = Buffer.from(corps.content, 'base64').toString('utf8');
    etat.commits.push({ message: corps.message, branche: corps.branch, auteur: corps.author?.name });
    return Response.json({ content: { sha: shaDe(etat.contenu) }, commit: { sha: randomBytes(20).toString('hex') } });
  };
  return etat;
}

describe('aperçu de partage (admin)', () => {
  let s;
  let jeton;
  let gh;
  before(async () => {
    gh = githubSimule(INDEX);
    s = await fabriquer({ env: { GITHUB_JETON_IMAGES: JETON_GITHUB }, fetchGithub: gh.fetch });
    jeton = await s.connecter();
  });
  after(async () => { await s.fermer(); });

  test('connexion obligatoire', async () => {
    assert.equal((await s.requete('GET', '/api/admin/partage')).statut, 401);
    assert.equal((await s.requete('PUT', '/api/admin/partage', { corps: { titre: 'a', description: 'b' } })).statut, 401);
  });

  test('lecture : titre et description actuels d’index.html, empreinte du fichier', async () => {
    const r = await s.requete('GET', '/api/admin/partage', { jeton });
    assert.equal(r.statut, 200);
    assert.deepEqual(r.json, { ...extrairePartage(INDEX), sha: shaDe(INDEX) });
    assert.ok(r.json.titre.length > 0 && r.json.description.length > 0);
  });

  test('écriture : seules les quatre balises changent, texte échappé, un commit « Z-Survival admin »', async () => {
    const sha = (await s.requete('GET', '/api/admin/partage', { jeton })).json.sha;
    const titre = 'Z-Survival — « essai » & <b>';
    const description = 'La nuit tombe.\nSerez-vous en mesure de "survivre" ?';
    const r = await s.requete('PUT', '/api/admin/partage', { jeton, corps: { titre, description, sha } });
    assert.equal(r.statut, 200, r.texte);
    assert.equal(r.json.description, 'La nuit tombe. Serez-vous en mesure de "survivre" ?');
    assert.equal(r.json.sha, shaDe(gh.contenu));
    assert.deepEqual(gh.commits.at(-1), { message: 'Aperçu de partage modifié (titre et description)', branche: 'main', auteur: 'Z-Survival admin' });
    assert.ok(gh.contenu.includes('<meta property="og:title" content="Z-Survival — « essai » &amp; &lt;b&gt;">'));
    assert.ok(gh.contenu.includes('<meta name="twitter:title" content="Z-Survival — « essai » &amp; &lt;b&gt;">'));
    assert.ok(gh.contenu.includes('<meta property="og:description" content="La nuit tombe. Serez-vous en mesure de &quot;survivre&quot; ?">'));
    assert.ok(gh.contenu.includes('<meta name="twitter:description" content="La nuit tombe. Serez-vous en mesure de &quot;survivre&quot; ?">'));
    // Le reste de la page est identique (mêmes lignes, sauf les quatre balises).
    const avant = INDEX.split('\n');
    const apres = gh.contenu.split('\n');
    assert.equal(apres.length, avant.length);
    const changees = avant.filter((l, i) => l !== apres[i]);
    assert.equal(changees.length, 4);
    assert.ok(changees.every((l) => /og:title|twitter:title|og:description|twitter:description/.test(l)));
    // Relecture : les textes reviennent tels quels (déséchappés).
    const relu = (await s.requete('GET', '/api/admin/partage', { jeton })).json;
    assert.equal(relu.titre, titre);
    assert.equal(relu.description, 'La nuit tombe. Serez-vous en mesure de "survivre" ?');
  });

  test('page modifiée entre-temps : 409, rien n’est écrit', async () => {
    const avant = gh.contenu;
    const r = await s.requete('PUT', '/api/admin/partage', { jeton, corps: { titre: 'X', description: 'Y', sha: shaDe('autre version') } });
    assert.equal(r.statut, 409);
    assert.match(r.json.erreur, /modifiée entre-temps/);
    assert.equal(gh.contenu, avant);
  });

  test('contrôles : obligatoires, longueurs, champs connus', async () => {
    const sha = (await s.requete('GET', '/api/admin/partage', { jeton })).json.sha;
    const refus = async (corps) => (await s.requete('PUT', '/api/admin/partage', { jeton, corps: { sha, ...corps } })).statut;
    assert.equal(await refus({ titre: '  ', description: 'ok' }), 400);
    assert.equal(await refus({ titre: 'ok', description: '' }), 400);
    assert.equal(await refus({ titre: 'x'.repeat(91), description: 'ok' }), 400);
    assert.equal(await refus({ titre: 'ok', description: 'x'.repeat(301) }), 400);
    assert.equal(await refus({ titre: 'ok', description: 'ok', image: 'a.png' }), 400);
    assert.equal(await refus({ titre: 1, description: 'ok' }), 400);
  });

  test('GitHub refuse le jeton : 502, jamais le jeton', async () => {
    gh.refus = 401;
    const r = await s.requete('GET', '/api/admin/partage', { jeton });
    gh.refus = 0;
    assert.equal(r.statut, 502);
    assert.ok(!r.texte.includes(JETON_GITHUB) && !s.lignes.join('\n').includes(JETON_GITHUB));
  });
});

describe('aperçu de partage : sans jeton GitHub, outils', () => {
  test('503 clair sans jeton', async () => {
    const s = await fabriquer();
    try {
      const jeton = await s.connecter();
      assert.equal((await s.requete('GET', '/api/admin/partage', { jeton })).statut, 503);
    } finally { await s.fermer(); }
  });

  test('balise manquante : erreur, rien n’est remplacé', () => {
    assert.throws(() => remplacerPartage('<html></html>', { titre: 'a', description: 'b' }), /introuvable/);
    assert.equal(extrairePartage('<html></html>'), null);
  });
});
