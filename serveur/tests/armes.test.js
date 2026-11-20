// Lot 6a : armes de la section Armes, réglées depuis l'admin et réécrites dans contenus/armes.json par l'API GitHub (simulée ici).

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fabriquer } from './aide.js';
import { fichierArmes, validerArmes } from '../src/armes.js';

const JETON_GITHUB = `github_pat_${randomBytes(30).toString('hex')}`;
const shaDe = (texte) => createHash('sha1').update(texte).digest('hex');

/** API « contents » simulée pour un seul fichier, avec le comportement de GitHub : sha obligatoire et à jour pour modifier. */
function githubSimule(contenuInitial) {
  const etat = { contenu: contenuInitial, commits: [] };
  etat.fetch = async (adresse, options = {}) => {
    if (options.headers?.Authorization !== `Bearer ${JETON_GITHUB}`) return new Response('{}', { status: 401 });
    if (!/\/repos\/Nowyyy\/Z-Survival-Website\/contents\/contenus\/armes\.json/.test(adresse)) return new Response('{}', { status: 404 });
    if ((options.method ?? 'GET') === 'GET') return Response.json({ sha: shaDe(etat.contenu), content: Buffer.from(etat.contenu).toString('base64') });
    const corps = JSON.parse(options.body);
    if (corps.sha !== shaDe(etat.contenu)) return Response.json({ message: 'conflict' }, { status: 409 });
    etat.contenu = Buffer.from(corps.content, 'base64').toString('utf8');
    etat.commits.push({ message: corps.message, branche: corps.branch, auteur: corps.author?.name });
    return Response.json({ content: { sha: shaDe(etat.contenu) }, commit: { sha: randomBytes(20).toString('hex') } }, { status: 200 });
  };
  return etat;
}

const DOC = {
  _aide: '…',
  version: 1,
  chapitres: [{ id: 1, nom: null }],
  armes: [
    { id: 'm1911', nom: 'Colt M1911', nomEn: null, categorie: 'pistolet', famille: 'poing', ordre: 1, chapitres: [1], prochainement: true, aRelire: true, stats: null, statsVisibles: false, description: { fr: 'L’arme de départ.', en: 'The starting sidearm.' } },
    { id: 'kar98k', nom: 'Kar98k', nomEn: null, categorie: 'fusil-a-verrou', famille: 'carabine', ordre: 2, chapitres: [1], prochainement: true, aRelire: true, stats: null, statsVisibles: false, description: { fr: 'Un fusil à verrou.', en: 'A bolt-action rifle.' } },
  ],
  retirees: [],
};
const INITIAL = fichierArmes(DOC);
const reglage = (id, extra = {}) => ({ id, prochainement: true, description: { fr: 'x', en: 'y' }, stats: null, statsVisibles: false, ...extra });

describe('armes (admin)', () => {
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
    assert.equal((await s.requete('GET', '/api/admin/armes')).statut, 401);
    assert.equal((await s.requete('PUT', '/api/admin/armes', { corps: { armes: [], sha: shaDe(INITIAL) } })).statut, 401);
  });

  test('lecture : armes, réglages et empreinte du fichier', async () => {
    const r = await s.requete('GET', '/api/admin/armes', { jeton });
    assert.equal(r.statut, 200);
    assert.equal(r.json.sha, shaDe(INITIAL));
    assert.deepEqual(r.json.armes.map((a) => [a.id, a.nom, a.prochainement, a.statsVisibles]), [['m1911', 'Colt M1911', true, false], ['kar98k', 'Kar98k', true, false]]);
    assert.equal(r.json.armes[0].description.fr, 'L’arme de départ.');
  });

  test('écriture : affichée, descriptions, stats ; le reste du fichier est gardé', async () => {
    const sha = shaDe(gh.contenu);
    const r = await s.requete('PUT', '/api/admin/armes', {
      jeton,
      corps: { sha, armes: [{ id: 'm1911', prochainement: false, description: { fr: '  Robuste\net précise. ', en: 'Sturdy.' }, stats: { degats: 35, cadence: 70, portee: 45, chargeur: 40 }, statsVisibles: true }] },
    });
    assert.equal(r.statut, 200, JSON.stringify(r.json));
    const doc = JSON.parse(gh.contenu);
    const colt = doc.armes[0];
    assert.equal(colt.prochainement, false);
    assert.deepEqual(colt.description, { fr: 'Robuste et précise.', en: 'Sturdy.' });
    assert.deepEqual(colt.stats, { degats: 35, cadence: 70, portee: 45, chargeur: 40 });
    assert.equal(colt.statsVisibles, true);
    assert.equal(colt.aRelire, false, 'description modifiée : relue');
    assert.equal(colt.nom, 'Colt M1911');
    assert.deepEqual(colt.chapitres, [1]);
    assert.deepEqual(doc.armes[1], DOC.armes[1], 'arme non envoyée : intacte');
    assert.equal(gh.commits.at(-1).auteur, 'Z-Survival admin');
    assert.match(gh.commits.at(-1).message, /1 affichée sur 2/);
    assert.equal(r.json.sha, shaDe(gh.contenu));
    assert.equal(gh.contenu, fichierArmes(doc), 'même mise en forme que l’outil');
  });

  test('conflit : fichier changé entre-temps → 409, rien n’est écrit', async () => {
    const avant = gh.contenu;
    const r = await s.requete('PUT', '/api/admin/armes', { jeton, corps: { sha: shaDe(INITIAL), armes: [reglage('m1911')] } });
    assert.equal(r.statut, 409);
    assert.equal(gh.contenu, avant);
  });

  test('refus : arme inconnue, stats hors limites, stats affichées sans valeur, sha absent', async () => {
    const sha = shaDe(gh.contenu);
    for (const corps of [
      { sha, armes: [reglage('inconnue')] },
      { sha, armes: [reglage('m1911', { stats: { degats: 120 } })] },
      { sha, armes: [reglage('m1911', { stats: { degats: 3.5 } })] },
      { sha, armes: [reglage('m1911', { statsVisibles: true })] },
      { sha, armes: [reglage('m1911', { prochainement: 'oui' })] },
      { armes: [reglage('m1911')] },
    ]) {
      const r = await s.requete('PUT', '/api/admin/armes', { jeton, corps });
      assert.equal(r.statut, 400, JSON.stringify(corps));
    }
  });

  test('validation : description en texte brut, limitée', () => {
    const sha = 'a'.repeat(40);
    assert.throws(() => validerArmes({ sha, armes: [reglage('m1911', { description: { fr: 'x'.repeat(401), en: '' } })] }));
    const { armes } = validerArmes({ sha, armes: [reglage('m1911', { description: { fr: '<b>gras</b>\u0007', en: '' }, stats: { degats: 0 } })] });
    assert.equal(armes[0].description.fr, '<b>gras</b>');
    assert.deepEqual(armes[0].stats, { degats: 0, cadence: null, portee: null, chargeur: null });
  });
});

test('mise en forme identique à outils/armes/copier-armes.mjs (contenus/armes.json du dépôt)', { skip: !existsSync(new URL('../../contenus/armes.json', import.meta.url)) }, () => {
  const texte = readFileSync(new URL('../../contenus/armes.json', import.meta.url), 'utf8');
  assert.equal(fichierArmes(JSON.parse(texte)), texte);
});

test('sans jeton GitHub : 503 clair', async () => {
  const s = await fabriquer({ env: {} });
  try {
    const jeton = await s.connecter();
    assert.equal((await s.requete('GET', '/api/admin/armes', { jeton })).statut, 503);
  } finally {
    await s.fermer();
  }
});
