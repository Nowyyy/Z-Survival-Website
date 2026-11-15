// Images des articles (lot 3b) : envoi (bon format, trop lourd, mauvais type, sans jeton, sans secret GitHub),
// redimensionnement, métadonnées EXIF/GPS supprimées, commit simulé au bon chemin. API GitHub SIMULÉE (aucun appel réseau).

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { fabriquer } from './aide.js';

// Jeton GitHub de test tiré au hasard (jamais un vrai jeton).
const JETON_GITHUB = `test_${randomBytes(16).toString('hex')}`;
const MARQUE_GPS = 'Position-Secrete-Du-Telephone';

/** Fausse API GitHub : garde les fichiers « commités » ; mode = 'ok' | 'refus' | 'panne'. */
function fausseApiGithub() {
  const etat = { mode: 'ok', fichiers: new Map(), appels: [] };
  etat.fetch = async (url, options = {}) => {
    const u = new URL(url);
    etat.appels.push({ methode: options.method, chemin: u.pathname, auth: options.headers?.Authorization, corps: options.body });
    if (etat.mode === 'panne') throw new Error('réseau coupé');
    if (etat.mode === 'refus') return new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 });
    const fichier = decodeURIComponent(u.pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ''));
    if (options.method === 'GET') return new Response('{}', { status: etat.fichiers.has(fichier) ? 200 : 404 });
    const corps = JSON.parse(options.body);
    etat.fichiers.set(fichier, { ...corps, octets: Buffer.from(corps.content, 'base64') });
    return new Response(JSON.stringify({ commit: { sha: 'a'.repeat(40) } }), { status: 201 });
  };
  return etat;
}

/** Photo JPEG de téléphone : 3000 × 2000, avec EXIF (appareil) et position GPS. */
async function photoAvecGps() {
  return sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 120, g: 20, b: 20 } } })
    .jpeg({ quality: 80 })
    .withExif({
      IFD0: { Make: 'TelephoneTest', Model: 'Modele-42', ImageDescription: MARQUE_GPS },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '48/1 51/1 24/1', GPSLongitudeRef: 'E', GPSLongitude: '2/1 21/1 3/1' },
    })
    .toBuffer();
}

describe('images des articles', () => {
  let s;
  let jeton;
  let gh;
  const envoyer = (octets, type, { slug = 'nouvelle-carte', avecJeton = true } = {}) =>
    s.requete('POST', `/api/admin/images?slug=${slug}`, { jeton: avecJeton ? jeton : undefined, corps: octets, entetes: { 'Content-Type': type } });

  before(async () => {
    gh = fausseApiGithub();
    s = await fabriquer({ env: { GITHUB_JETON_IMAGES: JETON_GITHUB }, fetchGithub: gh.fetch });
    jeton = await s.connecter();
  });
  after(async () => { await s.fermer(); });

  test('la photo d’origine contient bien EXIF et GPS (contrôle du test)', async () => {
    const infos = await sharp(await photoAvecGps()).metadata();
    assert.ok(infos.exif && infos.exif.includes(Buffer.from(MARQUE_GPS)));
  });

  test('JPEG : réduite à 1600 px, en WebP, commit simulé au bon chemin, sans aucune métadonnée', async () => {
    const r = await envoyer(await photoAvecGps(), 'image/jpeg');
    assert.equal(r.statut, 201, r.texte);
    assert.match(r.json.image, /^img\/actus\/nouvelle-carte-[0-9a-f]{8}\.webp$/);
    assert.equal(r.json.adresse, `https://nowyyy.github.io/Z-Survival-Website/${r.json.image}`);
    assert.equal(r.json.largeur, 1600);
    assert.equal(r.json.hauteur, 1067);

    const put = gh.appels.find((a) => a.methode === 'PUT');
    assert.equal(put.chemin, `/repos/Nowyyy/Z-Survival-Website/contents/${r.json.image}`);
    assert.equal(put.auth, `Bearer ${JETON_GITHUB}`);
    const fichier = gh.fichiers.get(r.json.image);
    assert.equal(fichier.branch, 'main');
    assert.deepEqual(fichier.author, { name: 'Z-Survival admin', email: 'z-survival-admin@nowyyy.github.io' });
    assert.equal(fichier.committer.name, 'Z-Survival admin');

    const infos = await sharp(fichier.octets).metadata();
    assert.equal(infos.format, 'webp');
    assert.equal(infos.width, 1600);
    assert.equal(infos.exif, undefined, 'aucun EXIF');
    assert.equal(infos.xmp, undefined, 'aucun XMP');
    assert.equal(infos.icc, undefined, 'aucun profil');
    for (const marque of [MARQUE_GPS, 'TelephoneTest', 'Modele-42', 'Exif']) {
      assert.ok(!fichier.octets.includes(Buffer.from(marque)), `« ${marque} » absent du fichier publié`);
    }
  });

  test('même image envoyée deux fois : même chemin, pas de second commit', async () => {
    const avant = gh.appels.filter((a) => a.methode === 'PUT').length;
    const r = await envoyer(await photoAvecGps(), 'image/jpeg');
    assert.equal(r.statut, 200);
    assert.equal(r.json.deja_presente, true);
    assert.equal(gh.appels.filter((a) => a.methode === 'PUT').length, avant);
  });

  test('PNG et WebP acceptés ; petite image jamais agrandie', async () => {
    const png = await sharp({ create: { width: 400, height: 300, channels: 4, background: '#d81414' } }).png().toBuffer();
    const r1 = await envoyer(png, 'image/png', { slug: 'image-png' });
    assert.equal(r1.statut, 201, r1.texte);
    assert.deepEqual([r1.json.largeur, r1.json.hauteur], [400, 300]);
    const webp = await sharp({ create: { width: 900, height: 2400, channels: 3, background: '#131313' } }).webp().toBuffer();
    const r2 = await envoyer(webp, 'image/webp', { slug: 'image-webp' });
    assert.equal(r2.statut, 201, r2.texte);
    assert.deepEqual([r2.json.largeur, r2.json.hauteur], [600, 1600]);
  });

  test('trop lourde (plus de 8 Mo) : 413', async () => {
    const lourde = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), randomBytes(8 * 1024 * 1024)]);
    const r = await envoyer(lourde, 'image/jpeg');
    assert.equal(r.statut, 413);
    assert.match(r.json.erreur, /8 Mo/);
  });

  test('mauvais type : 415 (GIF, texte, ou contenu qui ne correspond pas au type annoncé)', async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).gif().toBuffer();
    assert.equal((await envoyer(gif, 'image/gif')).statut, 415);
    assert.equal((await envoyer(gif, 'image/jpeg')).statut, 415);
    assert.equal((await envoyer(Buffer.from('<script>alert(1)</script>'), 'image/png')).statut, 415);
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
    assert.equal((await envoyer(png, 'image/jpeg')).statut, 415, 'PNG annoncé comme JPEG');
    // JPEG tronqué (abîmé)
    const abime = (await photoAvecGps()).subarray(0, 2000);
    assert.equal((await envoyer(abime, 'image/jpeg')).statut, 415);
  });

  test('sans jeton : 401 ; slug absent ou invalide : 400', async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
    assert.equal((await envoyer(png, 'image/png', { avecJeton: false })).statut, 401);
    assert.equal((await envoyer(png, 'image/png', { slug: '../../etc' })).statut, 400);
    assert.equal((await envoyer(png, 'image/png', { slug: '' })).statut, 400);
  });

  test('GitHub refuse le jeton ou ne répond pas : 502, message clair, jeton jamais montré', async () => {
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#abc' } }).png().toBuffer();
    gh.mode = 'refus';
    const r1 = await envoyer(png, 'image/png', { slug: 'refus' });
    assert.equal(r1.statut, 502);
    assert.match(r1.json.erreur, /jeton/);
    gh.mode = 'panne';
    const r2 = await envoyer(png, 'image/png', { slug: 'panne' });
    assert.equal(r2.statut, 502);
    gh.mode = 'ok';
    for (const texte of [r1.texte, r2.texte, ...s.lignes]) assert.ok(!texte.includes(JETON_GITHUB), 'jeton GitHub absent des réponses et du journal');
  });
});

describe('images sans le secret GitHub', () => {
  let s;
  before(async () => { s = await fabriquer(); });
  after(async () => { await s.fermer(); });

  test('envoi refusé (503, message clair), le reste fonctionne', async () => {
    const jeton = await s.connecter();
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
    const r = await s.requete('POST', '/api/admin/images?slug=essai', { jeton, corps: png, entetes: { 'Content-Type': 'image/png' } });
    assert.equal(r.statut, 503);
    assert.match(r.json.erreur, /jeton GitHub/);
    const a = await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'sans-image', titre_fr: 'Sans image' } });
    assert.equal(a.statut, 201);
    assert.equal((await s.requete('GET', '/api/sante')).statut, 200);
  });
});
