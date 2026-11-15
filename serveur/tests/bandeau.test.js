// Lot 3d : messages du bandeau d'alerte, lus et réécrits dans contenus/bandeau.json par l'API GitHub (simulée ici).

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { fabriquer } from './aide.js';
import { fichierBandeau, validerBandeau } from '../src/bandeau.js';

const JETON_GITHUB = `github_pat_${randomBytes(30).toString('hex')}`;
const shaDe = (texte) => createHash('sha1').update(texte).digest('hex');

/** API « contents » simulée pour un seul fichier, avec le comportement de GitHub : sha obligatoire et à jour pour modifier. */
function githubSimule(contenuInitial) {
  const etat = { contenu: contenuInitial, commits: [], refus: 0 };
  etat.fetch = async (adresse, options = {}) => {
    if (options.headers?.Authorization !== `Bearer ${JETON_GITHUB}`) return new Response('{}', { status: 401 });
    if (etat.refus) return new Response('{}', { status: etat.refus });
    if (!/\/repos\/Nowyyy\/Z-Survival-Website\/contents\/contenus\/bandeau\.json/.test(adresse)) return new Response('{}', { status: 404 });
    const methode = options.method ?? 'GET';
    if (methode === 'GET') {
      if (etat.contenu === null) return new Response('{}', { status: 404 });
      return Response.json({ sha: shaDe(etat.contenu), content: Buffer.from(etat.contenu).toString('base64') });
    }
    const corps = JSON.parse(options.body);
    if (etat.contenu !== null && !corps.sha) return Response.json({ message: 'sha wasn’t supplied' }, { status: 422 });
    if (etat.contenu !== null && corps.sha !== shaDe(etat.contenu)) return Response.json({ message: 'conflict' }, { status: 409 });
    etat.contenu = Buffer.from(corps.content, 'base64').toString('utf8');
    etat.commits.push({ message: corps.message, branche: corps.branch, auteur: corps.author?.name });
    return Response.json({ content: { sha: shaDe(etat.contenu) }, commit: { sha: randomBytes(20).toString('hex') } }, { status: 200 });
  };
  return etat;
}

const INITIAL = `{
  "_aide": "…",
  "version": 1,
  "messages": [
    { "id": "horde-hopital", "actif": true, "fr": "Horde signalée près de l’hôpital", "en": "Horde reported near the hospital" },
    { "id": "couvre-feu", "actif": false, "fr": "Couvre-feu", "en": "Curfew" }
  ]
}
`;

describe('bandeau d’alerte (admin)', () => {
  let s;
  let jeton;
  let gh;
  before(async () => {
    gh = githubSimule(INITIAL);
    s = await fabriquer({ env: { GITHUB_JETON_IMAGES: JETON_GITHUB }, fetchGithub: gh.fetch });
    jeton = await s.connecter();
  });
  after(async () => { await s.fermer(); });

  test('connexion obligatoire', async () => {
    assert.equal((await s.requete('GET', '/api/admin/bandeau')).statut, 401);
    assert.equal((await s.requete('PUT', '/api/admin/bandeau', { corps: { messages: [] } })).statut, 401);
  });

  test('lecture : tous les messages (même cachés) et l’empreinte du fichier', async () => {
    const r = await s.requete('GET', '/api/admin/bandeau', { jeton });
    assert.equal(r.statut, 200);
    assert.equal(r.entetes.get('cache-control'), 'no-store');
    assert.equal(r.json.sha, shaDe(INITIAL));
    assert.deepEqual(r.json.messages, [
      { id: 'horde-hopital', actif: true, fr: 'Horde signalée près de l’hôpital', en: 'Horde reported near the hospital' },
      { id: 'couvre-feu', actif: false, fr: 'Couvre-feu', en: 'Curfew' },
    ]);
  });

  test('écriture : un commit « Z-Survival admin » sur main, fichier au format du site, nouvelle empreinte', async () => {
    const sha = (await s.requete('GET', '/api/admin/bandeau', { jeton })).json.sha;
    const r = await s.requete('PUT', '/api/admin/bandeau', {
      jeton,
      corps: { sha, messages: [
        { id: 'horde-hopital', actif: true, fr: '  Horde   signalée\nprès de l’hôpital ', en: 'Horde reported near the hospital' },
        { fr: 'Nouveau message', en: '' },
        { id: 'couvre-feu', actif: false, fr: 'Couvre-feu', en: 'Curfew' },
      ] },
    });
    assert.equal(r.statut, 200, r.texte);
    assert.equal(r.json.sha, shaDe(gh.contenu));
    assert.deepEqual(gh.commits.at(-1), { message: 'Bandeau d\'alerte modifié : 3 messages (2 affichés)', branche: 'main', auteur: 'Z-Survival admin' });
    const doc = JSON.parse(gh.contenu);
    assert.equal(doc.version, 1);
    assert.match(doc._aide, /administration/);
    assert.deepEqual(doc.messages, [
      { id: 'horde-hopital', actif: true, fr: 'Horde signalée près de l’hôpital', en: 'Horde reported near the hospital' },
      { id: 'nouveau-message', actif: true, fr: 'Nouveau message', en: '' },
      { id: 'couvre-feu', actif: false, fr: 'Couvre-feu', en: 'Curfew' },
    ]);
    // Un message par ligne, comme le fichier écrit à la main.
    assert.equal(gh.contenu.split('\n').filter((l) => l.trim().startsWith('{ "id"')).length, 3);
    assert.ok(s.lignes.some((l) => l.includes('Bandeau modifié')));
  });

  test('fichier modifié ailleurs entre-temps : 409, rien n’est écrit', async () => {
    const avant = gh.contenu;
    const r = await s.requete('PUT', '/api/admin/bandeau', { jeton, corps: { sha: shaDe('ancienne version'), messages: [{ fr: 'Écrasé ?' }] } });
    assert.equal(r.statut, 409);
    assert.match(r.json.erreur, /modifié ailleurs/);
    assert.equal(gh.contenu, avant);
    const sansSha = await s.requete('PUT', '/api/admin/bandeau', { jeton, corps: { messages: [{ fr: 'Écrasé ?' }] } });
    assert.equal(sansSha.statut, 409);
    assert.equal(gh.contenu, avant);
  });

  test('liste vide acceptée (plus de bandeau, sauf le dernier article)', async () => {
    const sha = (await s.requete('GET', '/api/admin/bandeau', { jeton })).json.sha;
    const r = await s.requete('PUT', '/api/admin/bandeau', { jeton, corps: { sha, messages: [] } });
    assert.equal(r.statut, 200);
    assert.deepEqual(JSON.parse(gh.contenu).messages, []);
  });

  test('contrôles : texte français obligatoire, longueurs, nombre, types', async () => {
    const sha = (await s.requete('GET', '/api/admin/bandeau', { jeton })).json.sha;
    const refus = async (corps) => (await s.requete('PUT', '/api/admin/bandeau', { jeton, corps: { sha, ...corps } })).statut;
    assert.equal(await refus({ messages: [{ fr: '   ', en: 'Only English' }] }), 400);
    assert.equal(await refus({ messages: [{ fr: 'x'.repeat(161) }] }), 400);
    assert.equal(await refus({ messages: [{ fr: 'ok', en: 'x'.repeat(161) }] }), 400);
    assert.equal(await refus({ messages: Array.from({ length: 31 }, (_, i) => ({ fr: `m${i}` })) }), 400);
    assert.equal(await refus({ messages: [{ fr: 'ok', actif: 'oui' }] }), 400);
    assert.equal(await refus({ messages: 'pas une liste' }), 400);
    assert.equal(await refus({ messages: [], sha: 'abc' }), 400);
  });

  test('GitHub refuse le jeton : 502 clair, jamais le jeton', async () => {
    gh.refus = 401;
    const r = await s.requete('GET', '/api/admin/bandeau', { jeton });
    gh.refus = 0;
    assert.equal(r.statut, 502);
    assert.ok(!r.texte.includes(JETON_GITHUB));
    assert.ok(!s.lignes.join('\n').includes(JETON_GITHUB));
  });

  test('fichier illisible sur GitHub : 502 avec un message clair', async () => {
    const garde = gh.contenu;
    gh.contenu = '{ pas du json';
    const r = await s.requete('GET', '/api/admin/bandeau', { jeton });
    gh.contenu = garde;
    assert.equal(r.statut, 502);
    assert.match(r.json.erreur, /illisible/);
  });
});

describe('bandeau d’alerte : sans jeton GitHub', () => {
  test('503 clair', async () => {
    const s = await fabriquer();
    try {
      const jeton = await s.connecter();
      const r = await s.requete('GET', '/api/admin/bandeau', { jeton });
      assert.equal(r.statut, 503);
      assert.match(r.json.erreur, /pas encore configurée/);
      assert.equal((await s.requete('PUT', '/api/admin/bandeau', { jeton, corps: { messages: [] } })).statut, 503);
    } finally { await s.fermer(); }
  });
});

describe('bandeau d’alerte : outils', () => {
  test('identifiants refaits si absents, mal formés ou en double', () => {
    const { messages } = validerBandeau({ messages: [
      { id: 'Avec Espace', fr: 'Élan mortel !' }, { id: 'ok', fr: 'a' }, { id: 'ok', fr: 'b' }, { fr: '???' },
    ] });
    assert.deepEqual(messages.map((m) => m.id), ['elan-mortel', 'ok', 'ok-2', 'message']);
  });

  test('le fichier produit se relit à l’identique, même avec guillemets et deux-points dans le texte', () => {
    const messages = [{ id: 'a', actif: true, fr: 'Il a dit « non » : "stop"', en: 'He said: "no", "stop"' }];
    assert.deepEqual(JSON.parse(fichierBandeau(messages)).messages, messages);
  });
});
