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

/** Fausse API GitHub (contents) : listage du dossier, lecture (sha), écriture, suppression ; mode = 'ok' | 'refus' | 'panne'. */
function fausseApiGithub() {
  const etat = { mode: 'ok', fichiers: new Map(), appels: [] };
  etat.fetch = async (url, options = {}) => {
    const u = new URL(url);
    etat.appels.push({ methode: options.method, chemin: u.pathname, auth: options.headers?.Authorization, corps: options.body });
    if (etat.mode === 'panne') throw new Error('réseau coupé');
    if (etat.mode === 'refus') return new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 });
    const chemin = decodeURIComponent(u.pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ''));
    const json = (corps, status = 200) => new Response(JSON.stringify(corps), { status });
    if (options.method === 'GET' && chemin === 'img/actus') {
      const liste = [...etat.fichiers.keys()].filter((f) => f.startsWith('img/actus/'))
        .map((f) => ({ type: 'file', name: f.slice(10), sha: etat.fichiers.get(f).sha, size: etat.fichiers.get(f).octets.length }));
      return liste.length ? json(liste) : json({ message: 'Not Found' }, 404);
    }
    if (options.method === 'GET') return etat.fichiers.has(chemin) ? json({ sha: etat.fichiers.get(chemin).sha }) : json({}, 404);
    if (options.method === 'DELETE') {
      const corps = JSON.parse(options.body);
      if (!etat.fichiers.has(chemin)) return json({}, 404);
      if (corps.sha !== etat.fichiers.get(chemin).sha) return json({ message: 'sha' }, 409);
      etat.fichiers.delete(chemin);
      etat.supprimes = [...(etat.supprimes ?? []), { chemin, ...corps }];
      return json({ commit: { sha: 'b'.repeat(40) } });
    }
    const corps = JSON.parse(options.body);
    etat.fichiers.set(chemin, { ...corps, octets: Buffer.from(corps.content, 'base64'), sha: randomBytes(20).toString('hex') });
    return json({ commit: { sha: 'a'.repeat(40) } }, 201);
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
    assert.equal(r.json.adresse, `https://zsurvival-game.com/${r.json.image}`);
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

describe('réutilisation et suppression des images', () => {
  let s;
  let jeton;
  let gh;
  const png = (couleur) => sharp({ create: { width: 64, height: 48, channels: 3, background: couleur } }).png().toBuffer();
  const envoyer = async (octets, slug) =>
    s.requete('POST', `/api/admin/images?slug=${slug}`, { jeton, corps: octets, entetes: { 'Content-Type': 'image/png' } });
  const creer = (corps) => s.requete('POST', '/api/admin/articles', { jeton, corps });

  before(async () => {
    gh = fausseApiGithub();
    s = await fabriquer({ env: { GITHUB_JETON_IMAGES: JETON_GITHUB }, fetchGithub: gh.fetch });
    jeton = await s.connecter();
  });
  after(async () => { await s.fermer(); });

  test('même image pour un autre article : le fichier existant est repris, rien n’est republié', async () => {
    const image = await png('#112233');
    const r1 = await envoyer(image, 'premier-article');
    assert.equal(r1.statut, 201);
    const puts = gh.appels.filter((a) => a.methode === 'PUT').length;
    const r2 = await envoyer(image, 'autre-article');
    assert.equal(r2.statut, 200);
    assert.equal(r2.json.image, r1.json.image, 'même chemin (celui du premier article)');
    assert.equal(r2.json.deja_presente, true);
    assert.equal(gh.appels.filter((a) => a.methode === 'PUT').length, puts, 'aucun nouveau commit');
  });

  test('bibliothèque : images du dépôt avec les articles qui les utilisent', async () => {
    const [r1, r2] = [await envoyer(await png('#445566'), 'partagee'), await envoyer(await png('#778899'), 'seule')];
    const a = (await creer({ slug: 'article-a', titre_fr: 'Article A', image: r1.json.image })).json.article;
    const b = (await creer({ slug: 'article-b', titre_fr: 'Article B', image: r1.json.image })).json.article;
    const c = (await creer({ slug: 'article-c', titre_fr: 'Article C', image: r2.json.image })).json.article;
    const liste = await s.requete('GET', '/api/admin/images', { jeton });
    assert.equal(liste.statut, 200);
    assert.equal(liste.json.source, 'depot');
    assert.equal(liste.json.images.length, 3);
    const partagee = liste.json.images.find((i) => i.image === r1.json.image);
    assert.deepEqual(partagee.utilisee_par.map((u) => u.id).sort(), [a.id, b.id].sort());
    const libre = liste.json.images.find((i) => i.image.includes('premier-article'));
    assert.deepEqual(libre.utilisee_par, []);
    assert.equal(liste.json.images.at(-1).image, libre.image, 'images inutilisées en dernier');
    assert.ok(libre.octets > 0);
    assert.equal((await s.requete('GET', '/api/admin/images')).statut, 401, 'jeton obligatoire');
    s.ids = { a: a.id, b: b.id, c: c.id, partagee: r1.json.image, seule: r2.json.image, libre: libre.image };
  });

  test('suppression d’un article : image gardée si un autre article l’utilise', async () => {
    const r = await s.requete('DELETE', `/api/admin/articles/${s.ids.a}`, { jeton });
    assert.equal(r.statut, 200);
    assert.deepEqual(r.json.image, { chemin: s.ids.partagee, supprimee: false, raison: 'utilisee_ailleurs' });
    assert.ok(gh.fichiers.has(s.ids.partagee));
  });

  test('suppression du dernier article qui l’utilise : image supprimée du dépôt (commit sur main)', async () => {
    const r = await s.requete('DELETE', `/api/admin/articles/${s.ids.b}`, { jeton });
    assert.deepEqual(r.json.image, { chemin: s.ids.partagee, supprimee: true });
    assert.ok(!gh.fichiers.has(s.ids.partagee));
    const sup = gh.supprimes.at(-1);
    assert.equal(sup.chemin, s.ids.partagee);
    assert.equal(sup.branch, 'main');
    assert.equal(sup.author.name, 'Z-Survival admin');
    assert.equal(gh.appels.findLast((x) => x.methode === 'DELETE').auth, `Bearer ${JETON_GITHUB}`);
  });

  test('GitHub en panne : l’article est supprimé quand même, l’image reste (signalée)', async () => {
    gh.mode = 'panne';
    const r = await s.requete('DELETE', `/api/admin/articles/${s.ids.c}`, { jeton });
    gh.mode = 'ok';
    assert.equal(r.statut, 200);
    assert.equal(r.json.supprime, true);
    assert.equal(r.json.image.supprimee, false);
    assert.equal(r.json.image.raison, 'erreur_github');
    assert.ok(!r.texte.includes(JETON_GITHUB));
    assert.equal((await s.requete('GET', `/api/admin/articles/${s.ids.c}`, { jeton })).statut, 404);
  });

  test('bibliothèque : supprimer une image inutilisée ; refus si utilisée ou nom invalide', async () => {
    const d = (await creer({ slug: 'article-d', titre_fr: 'Article D', image: s.ids.seule })).json.article;
    const nom = (chemin) => chemin.slice('img/actus/'.length);
    const utilisee = await s.requete('DELETE', `/api/admin/images/${nom(s.ids.seule)}`, { jeton });
    assert.equal(utilisee.statut, 409);
    assert.ok(gh.fichiers.has(s.ids.seule));
    const libre = await s.requete('DELETE', `/api/admin/images/${nom(s.ids.libre)}`, { jeton });
    assert.equal(libre.statut, 200);
    assert.equal(libre.json.supprimee, true);
    assert.ok(!gh.fichiers.has(s.ids.libre));
    assert.equal((await s.requete('DELETE', '/api/admin/images/..%2Fsecret.webp', { jeton })).statut, 404);
    assert.equal((await s.requete('DELETE', '/api/admin/images/index.html', { jeton })).statut, 404);
    assert.equal((await s.requete('DELETE', `/api/admin/images/${nom(s.ids.libre)}`)).statut, 401);
    await s.requete('DELETE', `/api/admin/articles/${d.id}`, { jeton });
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

  test('suppression d’un article avec image : article supprimé, image signalée « non configuré » ; bibliothèque depuis les articles', async () => {
    const jeton = await s.connecter();
    const a = (await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'avec-image', titre_fr: 'Avec image', image: 'img/actus/ancienne-0123abcd.webp' } })).json.article;
    const liste = await s.requete('GET', '/api/admin/images', { jeton });
    assert.equal(liste.json.source, 'articles');
    assert.deepEqual(liste.json.images.map((i) => i.image), ['img/actus/ancienne-0123abcd.webp']);
    assert.equal((await s.requete('DELETE', '/api/admin/images/ancienne-0123abcd.webp', { jeton })).statut, 503);
    const r = await s.requete('DELETE', `/api/admin/articles/${a.id}`, { jeton });
    assert.equal(r.statut, 200);
    assert.deepEqual(r.json.image, { chemin: 'img/actus/ancienne-0123abcd.webp', supprimee: false, raison: 'non_configure' });
  });
});
