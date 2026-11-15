// Mot de passe, jeton, limite des tentatives, refus sans jeton, CORS, contrôle des entrées, secrets.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { calculerEmpreinte, verifierMotDePasse, lireEmpreinte, ITERATIONS } from '../src/mot-de-passe.js';
import { creerJeton, verifierJeton, DUREE_JETON_S } from '../src/jeton.js';
import { hacherIp, FENETRE_MS } from '../src/limite.js';
import { creerJournal } from '../src/journal.js';
import { fabriquer, SECRETS_TEST, ORIGINE, ORIGINE_ANCIENNE, ORIGINE_WWW } from './aide.js';

describe('empreinte du mot de passe (PBKDF2-SHA256)', () => {
  test('format pbkdf2$600000$<sel>$<empreinte>, sel aléatoire', async () => {
    const a = await calculerEmpreinte('un mot de passe');
    const b = await calculerEmpreinte('un mot de passe');
    assert.match(a, /^pbkdf2\$600000\$[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*$/);
    assert.equal(ITERATIONS, 600_000);
    assert.notEqual(a, b, 'deux empreintes du même mot de passe doivent différer (sel)');
    assert.equal(lireEmpreinte(a).sel.length, 16);
    assert.equal(lireEmpreinte(a).empreinte.length, 32);
    assert.ok(!a.includes('un mot de passe'));
  });

  test('vérification : bon, mauvais, vide, empreinte invalide', async () => {
    const e = await calculerEmpreinte('Correct-Cheval-42 é');
    assert.equal(await verifierMotDePasse('Correct-Cheval-42 é', e), true);
    assert.equal(await verifierMotDePasse('Correct-Cheval-42 e', e), false);
    assert.equal(await verifierMotDePasse('', e), false);
    assert.equal(await verifierMotDePasse(undefined, e), false);
    assert.equal(await verifierMotDePasse('Correct-Cheval-42 é', 'pas une empreinte'), false);
    assert.equal(await verifierMotDePasse('x', 'pbkdf2$1000$AAAA$AAAA'), false, 'trop peu d’itérations refusé');
  });

  test('compatible avec une empreinte calculée ailleurs (même algorithme que le script Cloud Shell)', async () => {
    // Même calcul que python3 hashlib.pbkdf2_hmac('sha256', mdp, sel, 600000, 32), encodé en base64 standard.
    const sel = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    const e = await calculerEmpreinte('mot de passe', { sel });
    assert.equal(await verifierMotDePasse('mot de passe', e), true);
    assert.ok(e.startsWith(`pbkdf2$600000$${sel.toString('base64')}$`));
  });
});

describe('jeton signé (HMAC-SHA256, 2 heures)', () => {
  const cle = randomBytes(32).toString('base64');
  const t0 = Date.parse('2026-11-15T12:00:00Z');

  test('valide pendant 2 heures, expiré ensuite', () => {
    const { jeton, expire_le } = creerJeton(cle, t0);
    assert.equal(expire_le, new Date(t0 + DUREE_JETON_S * 1000).toISOString());
    assert.equal(verifierJeton(cle, jeton, t0).valide, true);
    assert.equal(verifierJeton(cle, jeton, t0 + DUREE_JETON_S * 1000 - 1000).valide, true);
    assert.deepEqual(verifierJeton(cle, jeton, t0 + DUREE_JETON_S * 1000), { valide: false, raison: 'expire' });
  });

  test('falsifié : charge modifiée, signature modifiée, autre clé, format', () => {
    const { jeton } = creerJeton(cle, t0);
    const [p, charge, sig] = jeton.split('.');
    const chargeModifiee = Buffer.from(JSON.stringify({ sub: 'admin', iat: Math.floor(t0 / 1000), exp: Math.floor(t0 / 1000) + 999999 })).toString('base64url');
    assert.equal(verifierJeton(cle, `${p}.${chargeModifiee}.${sig}`, t0).raison, 'signature');
    const sigModifiee = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    assert.equal(verifierJeton(cle, `${p}.${charge}.${sigModifiee}`, t0).raison, 'signature');
    assert.equal(verifierJeton(randomBytes(32).toString('base64'), jeton, t0).raison, 'signature');
    assert.equal(verifierJeton(cle, 'n.importe.quoi', t0).valide, false);
    assert.equal(verifierJeton(cle, '', t0).valide, false);
    assert.equal(verifierJeton(cle, 'x'.repeat(600), t0).valide, false);
    // Un jeton signé avec la bonne clé mais une durée plus longue que 2 h est refusé.
    const long = creerJeton(cle, t0, DUREE_JETON_S * 10).jeton;
    assert.equal(verifierJeton(cle, long, t0).raison, 'duree');
  });

  test('le jeton ne contient aucun secret', () => {
    const { jeton } = creerJeton(SECRETS_TEST.cleSession, t0);
    const charge = Buffer.from(jeton.split('.')[1], 'base64url').toString('utf8');
    assert.deepEqual(Object.keys(JSON.parse(charge)).sort(), ['exp', 'iat', 'sub']);
    for (const s of Object.values(SECRETS_TEST)) assert.ok(!charge.includes(s));
  });
});

describe('serveur : connexion, limite, refus, CORS, entrées, secrets', () => {
  let s;
  before(async () => { s = await fabriquer(); });
  after(async () => { await s.fermer(); });

  test('connexion réussie : jeton valable 2 heures, pas de cookie', async () => {
    const r = await s.requete('POST', '/api/admin/connexion', {
      corps: { identifiant: SECRETS_TEST.identifiant, mot_de_passe: SECRETS_TEST.motDePasse },
      origine: ORIGINE,
    });
    assert.equal(r.statut, 200);
    assert.match(r.json.jeton, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(r.json.expire_le, new Date(s.horloge.t + 2 * 3600 * 1000).toISOString());
    assert.equal(r.entetes.get('set-cookie'), null);
    assert.equal(r.entetes.get('cache-control'), 'no-store');
  });

  test('même message pour un mauvais identifiant et un mauvais mot de passe', async () => {
    const a = await s.requete('POST', '/api/admin/connexion', { corps: { identifiant: 'personne', mot_de_passe: SECRETS_TEST.motDePasse } });
    const b = await s.requete('POST', '/api/admin/connexion', { corps: { identifiant: SECRETS_TEST.identifiant, mot_de_passe: 'faux' } });
    assert.equal(a.statut, 401);
    assert.equal(b.statut, 401);
    assert.deepEqual(a.json, b.json);
    assert.equal(a.json.erreur, 'Identifiant ou mot de passe incorrect.');
  });

  test('limite : 5 échecs par IP en 15 minutes, puis refus (même avec le bon mot de passe), puis de nouveau permis', async () => {
    const ip = '198.51.100.7';
    const faux = { identifiant: SECRETS_TEST.identifiant, mot_de_passe: 'mauvais' };
    for (let i = 0; i < 5; i++) {
      const r = await s.requete('POST', '/api/admin/connexion', { corps: faux, ip });
      assert.equal(r.statut, 401, `échec n° ${i + 1}`);
    }
    const bon = { identifiant: SECRETS_TEST.identifiant, mot_de_passe: SECRETS_TEST.motDePasse };
    const bloquee = await s.requete('POST', '/api/admin/connexion', { corps: bon, ip });
    assert.equal(bloquee.statut, 429);
    assert.ok(Number(bloquee.entetes.get('retry-after')) > 0);

    // Une autre adresse n'est pas touchée.
    assert.equal((await s.requete('POST', '/api/admin/connexion', { corps: bon, ip: '198.51.100.8' })).statut, 200);

    // L'adresse IP n'est jamais stockée en clair.
    const lignes = (await s.db.execute('SELECT ip_hachee FROM tentatives_connexion')).rows;
    assert.ok(lignes.length >= 5);
    for (const l of lignes) assert.ok(!String(l.ip_hachee).includes('198.51.100'));
    assert.ok(lignes.some((l) => l.ip_hachee === hacherIp(SECRETS_TEST.cleSession, ip)));

    // 15 minutes plus tard, c'est de nouveau permis ; un succès efface le compteur.
    s.horloge.t += FENETRE_MS + 1000;
    assert.equal((await s.requete('POST', '/api/admin/connexion', { corps: bon, ip })).statut, 200);
    const reste = await s.db.execute({ sql: 'SELECT COUNT(*) AS n FROM tentatives_connexion WHERE ip_hachee = ?', args: [hacherIp(SECRETS_TEST.cleSession, ip)] });
    assert.equal(Number(reste.rows[0].n), 0);
  });

  test('requêtes simultanées : pas plus de 5 essais passent', async () => {
    const ip = '198.51.100.99';
    const faux = { identifiant: SECRETS_TEST.identifiant, mot_de_passe: 'mauvais' };
    const resultats = await Promise.all(Array.from({ length: 12 }, () => s.requete('POST', '/api/admin/connexion', { corps: faux, ip })));
    assert.equal(resultats.filter((r) => r.statut === 401).length, 5);
    assert.equal(resultats.filter((r) => r.statut === 429).length, 7);
  });

  test('routes admin refusées sans jeton, avec un jeton faux ou expiré', async () => {
    const routes = [
      ['GET', '/api/admin/articles'],
      ['GET', '/api/admin/articles/1'],
      ['POST', '/api/admin/articles', { slug: 'x', titre_fr: 'x' }],
      ['PUT', '/api/admin/articles/1', { titre_fr: 'x' }],
      ['DELETE', '/api/admin/articles/1'],
      ['POST', '/api/admin/articles/1/publier'],
      ['POST', '/api/admin/articles/1/depublier'],
    ];
    const jetonExpire = creerJeton(SECRETS_TEST.cleSession, s.horloge.t - 3 * 3600 * 1000).jeton;
    const jetonAutreCle = creerJeton(randomBytes(32).toString('base64'), s.horloge.t).jeton;
    for (const [methode, chemin, corps] of routes) {
      for (const jeton of [undefined, 'faux', jetonExpire, jetonAutreCle]) {
        const r = await s.requete(methode, chemin, { corps, jeton });
        assert.equal(r.statut, 401, `${methode} ${chemin} avec ${jeton ? 'jeton invalide' : 'aucun jeton'}`);
        assert.equal(r.json.erreur, 'Connexion requise.');
        assert.equal(r.entetes.get('www-authenticate'), 'Bearer');
      }
    }
    // Rien n'a été créé.
    assert.equal(Number((await s.db.execute('SELECT COUNT(*) AS n FROM articles')).rows[0].n), 0);
  });

  test('CORS : seulement le site (zsurvival-game.com, www et nowyyy.github.io pendant la transition) et localhost hors production', async () => {
    const pre = await s.app.request('/api/admin/articles', {
      method: 'OPTIONS',
      headers: { Origin: ORIGINE, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' },
    });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), ORIGINE);
    assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);
    assert.equal(pre.headers.get('access-control-allow-credentials'), null);

    const autre = await s.app.request('/api/admin/articles', {
      method: 'OPTIONS',
      headers: { Origin: 'https://exemple.com', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(autre.status, 403);
    assert.equal(autre.headers.get('access-control-allow-origin'), null);

    const pub = await s.requete('GET', '/api/articles', { origine: ORIGINE });
    assert.equal(pub.entetes.get('access-control-allow-origin'), ORIGINE);
    assert.match(pub.entetes.get('vary'), /Origin/);
    const www = await s.requete('GET', '/api/articles', { origine: ORIGINE_WWW });
    assert.equal(www.entetes.get('access-control-allow-origin'), ORIGINE_WWW, 'www encore accepté');
    const ancienne = await s.requete('GET', '/api/articles', { origine: ORIGINE_ANCIENNE });
    assert.equal(ancienne.entetes.get('access-control-allow-origin'), ORIGINE_ANCIENNE, 'ancienne adresse encore acceptée');
    const preAncienne = await s.app.request('/api/admin/articles', {
      method: 'OPTIONS',
      headers: { Origin: ORIGINE_ANCIENNE, 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(preAncienne.status, 204);
    for (const refusee of [
      'http://zsurvival-game.com', // http (sans s)
      'http://www.zsurvival-game.com',
      'https://zsurvival-game.com.exemple.com',
      'https://www.zsurvival-game.com.exemple.com',
      'https://exemple-zsurvival-game.com',
      'https://admin.zsurvival-game.com',
    ]) {
      const r = await s.requete('GET', '/api/articles', { origine: refusee });
      assert.equal(r.entetes.get('access-control-allow-origin'), null, refusee);
    }
    const pubAutre = await s.requete('GET', '/api/articles', { origine: 'https://nowyyy.github.io.exemple.com' });
    assert.equal(pubAutre.entetes.get('access-control-allow-origin'), null);
    const sousDossier = await s.requete('GET', '/api/articles', { origine: 'http://nowyyy.github.io' });
    assert.equal(sousDossier.entetes.get('access-control-allow-origin'), null, 'http (sans s) refusé');

    // Administration depuis une autre origine : refusée d'emblée.
    const connexionAutre = await s.requete('POST', '/api/admin/connexion', {
      corps: { identifiant: SECRETS_TEST.identifiant, mot_de_passe: SECRETS_TEST.motDePasse },
      origine: 'https://exemple.com',
    });
    assert.equal(connexionAutre.statut, 403);
    assert.equal(connexionAutre.json.jeton, undefined);

    // localhost : permis en test (hors production).
    const local = await s.requete('GET', '/api/articles', { origine: 'http://localhost:8000' });
    assert.equal(local.entetes.get('access-control-allow-origin'), 'http://localhost:8000');
  });

  test('CORS en production : localhost refusé (sauf ORIGINES_LOCALES=1)', async () => {
    const prod = await fabriquer({ env: { NODE_ENV: 'production' } });
    try {
      const r = await prod.requete('GET', '/api/articles', { origine: 'http://localhost:8000' });
      assert.equal(r.entetes.get('access-control-allow-origin'), null);
      const site = await prod.requete('GET', '/api/articles', { origine: ORIGINE });
      assert.equal(site.entetes.get('access-control-allow-origin'), ORIGINE);
    } finally {
      await prod.fermer();
    }
  });

  test('contrôle des entrées : JSON, type, longueur, taille du corps', async () => {
    const jeton = await s.connecter();
    const nonJson = await s.app.request('/api/admin/articles', {
      method: 'POST', headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'text/plain' }, body: 'bonjour',
    });
    assert.equal(nonJson.status, 415);
    assert.equal((await s.requete('POST', '/api/admin/articles', { jeton, corps: '{pas du json' })).statut, 400);
    assert.equal((await s.requete('POST', '/api/admin/articles', { jeton, corps: [] })).statut, 400);
    assert.equal((await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'Majuscules', titre_fr: 'x' } })).statut, 400);
    assert.equal((await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'ok', titre_fr: 42 } })).statut, 400);
    assert.equal((await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'ok', titre_fr: 'x'.repeat(201) } })).statut, 400);
    assert.equal((await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'ok', titre_fr: 'x', inconnu: 1 } })).statut, 400);
    assert.equal((await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'ok', titre_fr: 'x', statut: 'en-ligne' } })).statut, 400);
    assert.equal((await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'ok', titre_fr: 'x', date_publication: 'hier' } })).statut, 400);
    assert.equal((await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'ok', titre_fr: 'x', image: 'https://exemple.com/a.png' } })).statut, 400);
    assert.equal((await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'ok', titre_fr: 'x', image: '../secret' } })).statut, 400);
    assert.equal((await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'ok', titre_fr: 'x', image: '/absolu.png' } })).statut, 400);
    const trop = await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'gros', titre_fr: 'x', contenu_fr: 'é'.repeat(150_000) } });
    assert.equal(trop.statut, 413);
    const tropLong = await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'long', titre_fr: 'x', contenu_fr: 'a'.repeat(40_001) } });
    assert.equal(tropLong.statut, 400);
    const connexionGrosse = await s.requete('POST', '/api/admin/connexion', { corps: { identifiant: 'a', mot_de_passe: 'b'.repeat(5000) } });
    assert.equal(connexionGrosse.statut, 413);
    const connexionVide = await s.requete('POST', '/api/admin/connexion', { corps: { identifiant: 'a' } });
    assert.equal(connexionVide.statut, 400);
    assert.equal((await s.requete('GET', '/api/articles?lang=de')).statut, 400);
    assert.equal((await s.requete('GET', '/api/articles?page=0')).statut, 400);
    assert.equal((await s.requete('GET', '/api/articles?page=abc')).statut, 400);
    assert.equal((await s.requete('GET', '/api/articles/..%2F..%2Fetc')).statut, 404);
    assert.equal((await s.requete('GET', '/api/admin/articles/abc', { jeton })).statut, 404);
    assert.equal(Number((await s.db.execute('SELECT COUNT(*) AS n FROM articles')).rows[0].n), 0);
  });

  test('aucun secret dans les réponses ni dans le journal', async () => {
    const jeton = await s.connecter();
    await s.requete('POST', '/api/admin/connexion', { corps: { identifiant: SECRETS_TEST.identifiant, mot_de_passe: 'faux' } });
    const reponses = [
      await s.requete('GET', '/api/sante'),
      await s.requete('GET', '/api/articles'),
      await s.requete('GET', '/api/admin/articles', { jeton }),
      await s.requete('POST', '/api/admin/connexion', { corps: { identifiant: 'x', mot_de_passe: 'y' } }),
      await s.requete('GET', '/api/inexistant'),
    ];
    const secrets = [SECRETS_TEST.identifiant, SECRETS_TEST.motDePasse, SECRETS_TEST.empreinte, SECRETS_TEST.cleSession,
      SECRETS_TEST.empreinte.split('$')[2], SECRETS_TEST.empreinte.split('$')[3]];
    const tout = reponses.map((r) => r.texte + JSON.stringify([...r.entetes])).join('\n');
    for (const secret of secrets) {
      assert.ok(!tout.includes(secret), 'un secret apparaît dans une réponse');
      assert.ok(!s.lignes.join('\n').includes(secret), 'un secret apparaît dans le journal');
    }
    // Ni mot de passe tapé, ni adresse IP dans le journal.
    assert.ok(!s.lignes.join('\n').includes('203.0.113.'));
    assert.ok(!s.lignes.join('\n').includes('"faux"'));
    assert.ok(s.lignes.length > 10, 'le journal a bien été capturé');
  });

  test('le journal masque toute valeur secrète qu’on lui passerait par erreur', () => {
    const lignes = [];
    const j = creerJournal({ secrets: ['jeton-tres-secret', 'libsql://ma-base.turso.io', 'ma-base.turso.io'], ecrire: (l) => lignes.push(l) });
    j.erreur('Échec', { detail: 'connexion à libsql://ma-base.turso.io avec jeton-tres-secret refusée' });
    assert.ok(!lignes[0].includes('jeton-tres-secret'));
    assert.ok(!lignes[0].includes('ma-base.turso.io'));
    assert.match(lignes[0], /\[masqué\]/);
  });

  test('administration désactivée proprement si les secrets manquent', async () => {
    const vide = await fabriquer({ env: { ADMIN_IDENTIFIANT: '', ADMIN_EMPREINTE: '', CLE_SESSION: '' } });
    try {
      const r = await vide.requete('POST', '/api/admin/connexion', { corps: { identifiant: 'a', mot_de_passe: 'b' } });
      assert.equal(r.statut, 503);
      assert.equal((await vide.requete('GET', '/api/admin/articles', { jeton: 'x' })).statut, 503);
      assert.equal((await vide.requete('GET', '/api/articles')).statut, 200, 'le public marche toujours');
    } finally {
      await vide.fermer();
    }
  });
});
