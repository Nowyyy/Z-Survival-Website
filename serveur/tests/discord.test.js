// Lot 3c : annonce Discord à la première publication d'un article (webhook simulé : aucun appel réseau réel).

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { fabriquer } from './aide.js';
import { corpsBilingue, extrait, texteBrut, titreBilingue, webhookValide } from '../src/discord.js';

// Adresse de webhook tirée au hasard (aucune valeur réelle dans le dépôt).
const JETON_WEBHOOK = randomBytes(40).toString('base64url');
const WEBHOOK = `https://discord.com/api/webhooks/123456789012345678/${JETON_WEBHOOK}`;

/** Discord et site simulés : garde les messages reçus ; `image` : réponse du site pour l'image (200 ou 404). */
function simulateur() {
  const etat = { messages: [], heads: [], reponse: 200, imageEnLigne: true, panne: false };
  etat.fetch = async (adresse, options = {}) => {
    if (options.method === 'HEAD') {
      etat.heads.push(adresse);
      return new Response(null, { status: etat.imageEnLigne ? 200 : 404 });
    }
    if (etat.panne) throw new TypeError('fetch failed');
    let corps;
    let fichiers = 0;
    if (options.body instanceof FormData) {
      corps = JSON.parse(options.body.get('payload_json'));
      fichiers = [...options.body.keys()].filter((k) => k.startsWith('files[')).length;
    } else corps = JSON.parse(options.body);
    etat.messages.push({ adresse, corps, fichiers });
    return new Response(JSON.stringify({ id: '1' }), { status: etat.reponse, headers: { 'Content-Type': 'application/json' } });
  };
  return etat;
}

/** API GitHub simulée : renvoie les octets d'une image du dépôt (lecture « raw »). */
function githubSimule() {
  const appels = [];
  return {
    appels,
    fetch: async (adresse, options = {}) => {
      appels.push({ adresse, accept: options.headers?.Accept });
      if (/\/contents\/img\/actus\/.+\.webp\?ref=main$/.test(adresse)) return new Response(new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]), { status: 200 });
      return new Response('{}', { status: 404 });
    },
  };
}

describe('annonce Discord des actualités', () => {
  let s;
  let jeton;
  let d;
  let gh;
  before(async () => {
    d = simulateur();
    gh = githubSimule();
    s = await fabriquer({ env: { DISCORD_WEBHOOK_ACTUS: WEBHOOK }, fetchAnnonce: d.fetch, fetchGithub: gh.fetch });
    jeton = await s.connecter();
  });
  after(async () => { await s.fermer(); });
  beforeEach(() => { d.messages.length = 0; d.heads.length = 0; d.reponse = 200; d.imageEnLigne = true; d.panne = false; });

  const creer = (corps) => s.requete('POST', '/api/admin/articles', { jeton, corps });
  const publier = (id) => s.requete('POST', `/api/admin/articles/${id}/publier`, { jeton });
  const depublier = (id) => s.requete('POST', `/api/admin/articles/${id}/depublier`, { jeton });

  test('brouillon : aucune annonce', async () => {
    const r = await creer({ slug: 'brouillon-seul', titre_fr: 'Brouillon', contenu_fr: 'Texte' });
    assert.equal(r.statut, 201);
    assert.equal(r.json.annonce_discord, undefined);
    assert.equal(d.messages.length, 0);
  });

  test('première publication : un message, carte complète, aucune mention qui notifie', async () => {
    const a = (await creer({
      slug: 'nouvelle-carte',
      titre_fr: 'Nouvelle carte : l’hôpital @everyone',
      titre_en: 'New map: the hospital',
      contenu_fr: '# La nuit tombe\n\nUne **nouvelle carte** arrive, avec un [lien](https://exemple.org) et des zombies plus rapides.',
      image: 'img/actus/nouvelle-carte-0123abcd.webp',
    })).json.article;
    const r = await publier(a.id);
    assert.equal(r.statut, 200);
    assert.deepEqual(r.json.annonce_discord, { envoyee: true });
    assert.equal(r.json.article.annonce_discord_le, '2026-11-15T12:00:00.000Z');
    assert.equal(d.messages.length, 1);
    const { adresse, corps, fichiers } = d.messages[0];
    assert.equal(adresse, `${WEBHOOK}?wait=true`);
    assert.equal(fichiers, 0);
    assert.deepEqual(corps.allowed_mentions, { parse: [] });
    assert.equal(corps.username, 'Z-Survival');
    const e = corps.embeds[0];
    assert.equal(e.title, '🇫🇷 Nouvelle carte : l’hôpital @everyone — 🇬🇧 New map: the hospital');
    assert.equal(e.url, 'https://zsurvival-game.com/#actu/nouvelle-carte');
    assert.equal(e.description, 'La nuit tombe. Une nouvelle carte arrive, avec un lien et des zombies plus rapides.');
    assert.equal(e.image.url, 'https://zsurvival-game.com/img/actus/nouvelle-carte-0123abcd.webp');
    assert.equal(e.timestamp, '2026-11-15T12:00:00.000Z');
    assert.equal(corps.content, '📰 **Nouvelle actualité · New post**');
    assert.ok(!corps.content.includes('http'), 'pas de lien dans la ligne (sinon Discord ajoute un second aperçu)');
    assert.deepEqual(d.heads, ['https://zsurvival-game.com/img/actus/nouvelle-carte-0123abcd.webp']);
  });

  test('republication après dépublication, modifications : jamais de deuxième annonce', async () => {
    const a = (await creer({ slug: 'une-fois', titre_fr: 'Une fois', contenu_fr: 'Texte' })).json.article;
    await publier(a.id);
    assert.equal(d.messages.length, 1);
    assert.equal((await s.requete('PUT', `/api/admin/articles/${a.id}`, { jeton, corps: { titre_fr: 'Une fois (corrigé)' } })).json.annonce_discord, undefined);
    await depublier(a.id);
    const r = await publier(a.id);
    assert.equal(r.json.annonce_discord, undefined);
    assert.equal((await publier(a.id)).json.annonce_discord, undefined);
    assert.equal(d.messages.length, 1);
  });

  test('création directement publiée, et publication par modification : annoncées', async () => {
    const r = await creer({ slug: 'directe', statut: 'publie', titre_fr: 'Directe', contenu_fr: 'Texte' });
    assert.equal(r.statut, 201);
    assert.deepEqual(r.json.annonce_discord, { envoyee: true });
    assert.ok(r.json.article.annonce_discord_le);
    const b = (await creer({ slug: 'par-modification', titre_fr: 'Par modification', contenu_fr: 'Texte' })).json.article;
    const m = await s.requete('PUT', `/api/admin/articles/${b.id}`, { jeton, corps: { statut: 'publie' } });
    assert.deepEqual(m.json.annonce_discord, { envoyee: true });
    assert.equal(d.messages.length, 2);
  });

  test('image pas encore en ligne : lue dans le dépôt et jointe au message', async () => {
    d.imageEnLigne = false;
    const a = (await creer({ slug: 'image-fraiche', titre_fr: 'Image fraîche', contenu_fr: 'Texte', image: 'img/actus/image-fraiche-89abcdef.webp' })).json.article;
    await publier(a.id);
    const { corps, fichiers } = d.messages[0];
    assert.equal(fichiers, 1);
    assert.equal(corps.embeds[0].image.url, 'attachment://actualite.webp');
    assert.ok(gh.appels.some((c) => c.adresse.endsWith('/contents/img/actus/image-fraiche-89abcdef.webp?ref=main') && c.accept === 'application/vnd.github.raw'));
  });

  test('Discord refuse ou ne répond pas : article publié quand même, annonce réessayée à la publication suivante', async () => {
    d.reponse = 500;
    const a = (await creer({ slug: 'discord-en-panne', titre_fr: 'Panne', contenu_fr: 'Texte' })).json.article;
    const r = await publier(a.id);
    assert.equal(r.statut, 200);
    assert.equal(r.json.article.statut, 'publie');
    assert.deepEqual(r.json.annonce_discord, { envoyee: false, raison: 'erreur_discord' });
    assert.equal(r.json.article.annonce_discord_le, null);
    assert.equal((await s.requete('GET', '/api/articles/discord-en-panne')).statut, 200);
    d.reponse = 200;
    d.panne = true;
    await depublier(a.id);
    assert.deepEqual((await publier(a.id)).json.annonce_discord, { envoyee: false, raison: 'erreur_discord' });
    d.panne = false;
    await depublier(a.id);
    assert.deepEqual((await publier(a.id)).json.annonce_discord, { envoyee: true });
  });

  test('l’adresse du webhook n’apparaît jamais : ni dans les réponses, ni dans le journal', async () => {
    const tout = s.lignes.join('\n');
    assert.ok(s.lignes.some((l) => l.includes('Annonce Discord envoyée')));
    assert.ok(!tout.includes(JETON_WEBHOOK));
    assert.ok(!tout.includes('/api/webhooks/'));
    const liste = await s.requete('GET', '/api/admin/articles', { jeton });
    assert.ok(!liste.texte.includes(JETON_WEBHOOK));
    const sante = await s.requete('GET', '/api/sante');
    assert.ok(!sante.texte.includes(JETON_WEBHOOK));
  });

  test('côté public : rien sur l’annonce', async () => {
    const r = await s.requete('GET', '/api/articles/une-fois');
    assert.equal(r.statut, 200);
    assert.equal(r.json.article.annonce_discord_le, undefined);
  });
});

describe('annonce Discord : non configurée ou mal configurée', () => {
  test('sans webhook : publication normale, raison « non_configure », aucun appel', async () => {
    const s = await fabriquer(); // fetchAnnonce par défaut : tout appel ferait échouer le test
    try {
      const jeton = await s.connecter();
      const a = (await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'sans-discord', titre_fr: 'Sans', contenu_fr: 'Texte' } })).json.article;
      const r = await s.requete('POST', `/api/admin/articles/${a.id}/publier`, { jeton });
      assert.equal(r.statut, 200);
      assert.deepEqual(r.json.annonce_discord, { envoyee: false, raison: 'non_configure' });
      assert.equal(r.json.article.annonce_discord_le, null);
    } finally { await s.fermer(); }
  });

  test('adresse mal formée : aucun appel, avertissement sans la valeur', async () => {
    const mauvaise = `https://exemple.org/hook/${randomBytes(20).toString('hex')}`;
    const s = await fabriquer({ env: { DISCORD_WEBHOOK_ACTUS: mauvaise } });
    try {
      const jeton = await s.connecter();
      const a = (await s.requete('POST', '/api/admin/articles', { jeton, corps: { slug: 'mal-forme', titre_fr: 'Mal', contenu_fr: 'Texte' } })).json.article;
      const r = await s.requete('POST', `/api/admin/articles/${a.id}/publier`, { jeton });
      assert.deepEqual(r.json.annonce_discord, { envoyee: false, raison: 'webhook_invalide' });
      assert.ok(s.lignes.some((l) => l.includes('mal formée')));
      assert.ok(!s.lignes.join('\n').includes(mauvaise.split('/').pop()));
    } finally { await s.fermer(); }
  });
});

describe('annonce Discord : outils', () => {
  test('forme du webhook', () => {
    assert.ok(webhookValide(WEBHOOK));
    assert.ok(webhookValide(`https://discordapp.com/api/webhooks/1234567890/${JETON_WEBHOOK}`));
    for (const v of ['', 'http://discord.com/api/webhooks/1234567890/abc', `https://discord.com.exemple.org/api/webhooks/1234567890/${JETON_WEBHOOK}`,
      `https://discord.com/api/webhooks/1234567890/${JETON_WEBHOOK}?x=1`, null]) assert.ok(!webhookValide(v), String(v));
  });

  test('titre bilingue : drapeaux, français seul sans anglais, 256 caractères au plus', () => {
    assert.equal(titreBilingue({ titre_fr: 'Bonjour', titre_en: 'Hello' }), '🇫🇷 Bonjour — 🇬🇧 Hello');
    assert.equal(titreBilingue({ titre_fr: 'Bonjour', titre_en: '' }), '🇫🇷 Bonjour');
    assert.equal(titreBilingue({ titre_fr: 'Bonjour', titre_en: '   ' }), '🇫🇷 Bonjour');
    const long = titreBilingue({ titre_fr: 'é'.repeat(200), titre_en: 'e'.repeat(200) });
    assert.ok(long.length <= 256 && long.includes(' — 🇬🇧 ') && long.endsWith('…'), long.length);
    assert.ok(titreBilingue({ titre_fr: 'é'.repeat(300) }).length <= 256);
  });

  test('corps bilingue : début du français puis de l’anglais, chacun avec son drapeau', () => {
    assert.equal(corpsBilingue({ titre_en: 'Hello', contenu_fr: '# Titre\nBonjour à tous.', contenu_en: '# Title\nHello everyone.' }),
      '🇫🇷 Titre. Bonjour à tous.\n\n🇬🇧 Title. Hello everyone.');
    assert.equal(corpsBilingue({ titre_en: '', contenu_fr: 'Bonjour.', contenu_en: 'Hello.' }), 'Bonjour.'); // pas de version anglaise publiée
    assert.equal(corpsBilingue({ titre_en: 'Hello', contenu_fr: 'Bonjour.', contenu_en: '' }), 'Bonjour.');
    const long = corpsBilingue({ titre_en: 'x', contenu_fr: 'mot '.repeat(100), contenu_en: 'word '.repeat(100) });
    const [fr, en] = long.split('\n\n');
    assert.ok(fr.startsWith('🇫🇷 ') && en.startsWith('🇬🇧 ') && fr.length <= 204 && en.length <= 204 && fr.endsWith('…') && en.endsWith('…'));
  });

  test('texte brut et extrait', () => {
    assert.equal(texteBrut('## Titre\n- **un** point\n> cité\n[lien](https://a.b) `code`'), 'Titre. un point. cité lien code');
    assert.equal(texteBrut('# Déjà ponctué !\nUne phrase\ncoupée en deux.'), 'Déjà ponctué ! Une phrase coupée en deux.');
    const long = 'mot '.repeat(200);
    const e = extrait(long, 50);
    assert.ok(e.length <= 50 && e.endsWith('…'), e);
    assert.equal(extrait('court'), 'court');
  });
});
