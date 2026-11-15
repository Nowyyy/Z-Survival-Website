// Application HTTP (Hono) : routes publiques, routes d'administration, CORS, en-têtes, erreurs.
// Construite par creerApp() pour pouvoir être testée sans réseau (app.request) sur une base SQLite en fichier.

import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getConnInfo } from '@hono/node-server/conninfo';

import { manquantesAdmin } from './config.js';
import { resumerErreur } from './journal.js';
import { appliquerMigrations, versionMigrations } from './base.js';
import { verifierMotDePasse } from './mot-de-passe.js';
import { creerJeton, verifierJeton } from './jeton.js';
import { hacherIp, reserverTentative, effacerTentatives, nettoyerTentatives } from './limite.js';
import { annoncerArticle } from './discord.js';
import { ecrireBandeau, lireBandeau, validerBandeau } from './bandeau.js';
import { ErreurValidation, LANGUES, PAGES, entierPositif, slugValide, validerArticle, validerConnexion, validerPage } from './validation.js';
import {
  ErreurImage, TAILLE_MAX_IMAGE, COTE_MAX, cheminImage, enregistrerSurGithub, listerSurGithub, nomDansDossier, nomImageValide, preparerImage,
  supprimerSurGithub,
} from './images.js';

// Origine autorisée (CORS) : le site sur son nom de domaine, et elle seule. www.zsurvival-game.com et l'ancienne adresse
// nowyyy.github.io/Z-Survival-Website/ redirigent vers le domaine avant que la page ne s'exécute : elles n'appellent jamais
// le serveur (Docs/ref/nom-de-domaine.md).
export const ORIGINE_SITE = 'https://zsurvival-game.com';
export const ORIGINES_SITE = Object.freeze([ORIGINE_SITE]);
const MOTIF_ORIGINE_LOCALE = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;
const MESSAGE_ECHEC = 'Identifiant ou mot de passe incorrect.';
const PAR_PAGE_PUBLIC = 10;
const PAR_PAGE_ADMIN = 50;
const CACHE_PUBLIC = 'public, max-age=60';
const TAILLE_MAX_CONNEXION = 4 * 1024;
const TAILLE_MAX_ARTICLE = 256 * 1024;
const ADRESSE_SITE = 'https://zsurvival-game.com/';
const COLONNES = 'id, slug, statut, date_publication, titre_fr, titre_en, contenu_fr, contenu_en, image, cree_le, modifie_le, annonce_discord_le';

class ErreurHttp extends Error {
  constructor(statut, message) {
    super(message);
    this.name = 'ErreurHttp';
    this.statut = statut;
  }
}

/** Lignes libSQL → objets simples. */
function enObjets(resultat) {
  return resultat.rows.map((ligne) => Object.fromEntries(resultat.columns.map((col, i) => [col, ligne[i]])));
}

function versPublic(a, lang) {
  const traduit = Boolean(a[`titre_${lang}`]);
  return {
    slug: a.slug,
    date_publication: a.date_publication,
    langue: traduit ? lang : 'fr',
    titre: traduit ? a[`titre_${lang}`] : a.titre_fr,
    contenu: (traduit ? a[`contenu_${lang}`] : '') || a.contenu_fr,
    image: a.image,
  };
}

/** Comparaison de l'identifiant en temps constant (empreintes SHA-256 de même longueur). */
function identifiantsEgaux(recu, attendu) {
  const a = createHash('sha256').update(String(recu), 'utf8').digest();
  const b = createHash('sha256').update(String(attendu), 'utf8').digest();
  return timingSafeEqual(a, b) && attendu.length > 0;
}

async function lireJson(c) {
  const type = c.req.header('Content-Type') ?? '';
  if (!/^application\/json\b/i.test(type)) throw new ErreurHttp(415, 'Corps JSON attendu (Content-Type: application/json).');
  try {
    return await c.req.json();
  } catch {
    throw new ErreurHttp(400, 'Corps de requête illisible (JSON attendu).');
  }
}

const limiteCorps = (maxSize) =>
  bodyLimit({ maxSize, onError: (c) => c.json({ erreur: `Corps de requête trop gros (${Math.round(maxSize / 1024)} Kio au plus).` }, 413) });

/**
 * @param {object} options
 * @param {object} options.config     configuration (lireConfig)
 * @param {object|null} options.db    client libSQL (ou null si aucune base n'est configurée)
 * @param {object} options.journal    journal (creerJournal)
 * @param {() => number} [options.maintenant]  horloge en millisecondes (remplaçable dans les tests)
 * @param {typeof fetch} [options.fetchGithub]  appels à l'API GitHub (remplaçable dans les tests : API simulée)
 * @param {typeof fetch} [options.fetchAnnonce] appels au webhook Discord et au site (lot 3c ; remplaçable dans les tests)
 */
export function creerApp({ config, db, journal, maintenant = () => Date.now(), fetchGithub = (...a) => fetch(...a), fetchAnnonce = (...a) => fetch(...a) }) {
  const app = new Hono();

  // --- Migrations : appliquées au démarrage (preparer), réessayées à la requête suivante en cas d'échec. ---
  let preparation = null;
  function preparer() {
    if (!db) return Promise.reject(new ErreurHttp(503, 'Base de données non configurée.'));
    if (!preparation) {
      preparation = appliquerMigrations(db)
        .then((version) => {
          journal.info('Migrations à jour', { version });
          return version;
        })
        .catch((err) => {
          preparation = null;
          journal.erreur('Migrations impossibles', { erreur: resumerErreur(err) });
          throw new ErreurHttp(503, 'Base de données indisponible.');
        });
    }
    return preparation;
  }
  app.preparer = preparer;

  function origineAutorisee(origine) {
    return ORIGINES_SITE.includes(origine) || (config.originesLocales && MOTIF_ORIGINE_LOCALE.test(origine));
  }

  function adresseIp(c) {
    // Sur Cloud Run, le frontal de Google AJOUTE l'adresse du client à la fin de X-Forwarded-For :
    // les valeurs placées avant peuvent venir du client lui-même, on prend donc la dernière.
    const dernierRelais = () => {
      const valeurs = (c.req.header('X-Forwarded-For') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      return valeurs.length > 0 ? valeurs[valeurs.length - 1].slice(0, 100) : null;
    };
    if (config.production) return dernierRelais() ?? 'inconnue';
    try {
      const adresse = getConnInfo(c).remote.address;
      if (adresse) return adresse;
    } catch { /* pas de connexion réseau (tests par app.request) */ }
    return dernierRelais() ?? 'inconnue';
  }

  // --- Journal des requêtes (méthode, chemin, statut, durée : jamais d'en-tête, de corps ni d'adresse IP). ---
  app.use('*', async (c, next) => {
    const debut = performance.now();
    await next();
    journal.info('Requête', {
      methode: c.req.method,
      chemin: c.req.path.slice(0, 200),
      statut: c.res.status,
      duree_ms: Math.round(performance.now() - debut),
    });
  });

  // --- En-têtes de sécurité (réponses JSON uniquement). ---
  app.use('*', async (c, next) => {
    await next();
    const h = c.res.headers;
    h.set('X-Content-Type-Options', 'nosniff');
    h.set('Referrer-Policy', 'no-referrer');
    h.set('X-Frame-Options', 'DENY');
    h.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    h.set('Strict-Transport-Security', 'max-age=31536000');
    if (!h.has('Cache-Control')) h.set('Cache-Control', 'no-store');
  });

  // --- CORS : seule l'origine du site (plus localhost hors production). ---
  app.use('*', async (c, next) => {
    const origine = c.req.header('Origin');
    const autorisee = origine !== undefined && origineAutorisee(origine);

    if (c.req.method === 'OPTIONS') {
      if (!autorisee) return c.body(null, 403, { Vary: 'Origin' });
      return c.body(null, 204, {
        'Access-Control-Allow-Origin': origine,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin',
      });
    }
    // Un navigateur d'une autre origine ne peut rien faire côté administration (lecture publique : sans effet).
    if (origine !== undefined && !autorisee && c.req.path.startsWith('/api/admin/')) {
      return c.json({ erreur: 'Origine non autorisée.' }, 403, { Vary: 'Origin' });
    }
    await next();
    c.res.headers.append('Vary', 'Origin');
    if (autorisee) c.res.headers.set('Access-Control-Allow-Origin', origine);
  });

  // --- Santé : la base répond-elle, quelle version des migrations ? ---
  app.get('/api/sante', async (c) => {
    let connectee = false;
    let version = null;
    try {
      await preparer();
      await db.execute('SELECT 1');
      version = await versionMigrations(db);
      connectee = true;
    } catch (err) {
      if (!(err instanceof ErreurHttp)) journal.avertissement('Base injoignable', { erreur: resumerErreur(err) });
    }
    return c.json(
      { ok: connectee, base: connectee ? 'connectée' : 'non connectée', version_migrations: version, version_serveur: config.version },
      connectee ? 200 : 503,
      { 'Cache-Control': 'no-store' },
    );
  });

  // Toutes les autres routes /api ont besoin de la base à jour.
  app.use('/api/*', async (c, next) => {
    if (c.req.path !== '/api/sante') await preparer();
    await next();
  });

  // --- Routes publiques : articles PUBLIÉS seulement. ---
  app.get('/api/articles', async (c) => {
    const lang = c.req.query('lang') ?? 'fr';
    if (!LANGUES.includes(lang)) throw new ErreurHttp(400, '« lang » doit valoir « fr » ou « en ».');
    const page = entierPositif(c.req.query('page'), { defaut: 1, max: 10_000 });
    if (page === null) throw new ErreurHttp(400, '« page » doit être un entier à partir de 1.');

    const total = Number((await db.execute("SELECT COUNT(*) AS n FROM articles WHERE statut = 'publie'")).rows[0].n);
    const lignes = enObjets(
      await db.execute({
        sql: `SELECT ${COLONNES} FROM articles WHERE statut = 'publie'
              ORDER BY date_publication DESC, id DESC LIMIT ? OFFSET ?`,
        args: [PAR_PAGE_PUBLIC, (page - 1) * PAR_PAGE_PUBLIC],
      }),
    );
    return c.json(
      { lang, page, par_page: PAR_PAGE_PUBLIC, total, pages: Math.ceil(total / PAR_PAGE_PUBLIC), articles: lignes.map((a) => versPublic(a, lang)) },
      200,
      { 'Cache-Control': CACHE_PUBLIC },
    );
  });

  app.get('/api/articles/:slug', async (c) => {
    const lang = c.req.query('lang') ?? 'fr';
    if (!LANGUES.includes(lang)) throw new ErreurHttp(400, '« lang » doit valoir « fr » ou « en ».');
    const slug = c.req.param('slug');
    if (!slugValide(slug)) throw new ErreurHttp(404, 'Article introuvable.');
    const [article] = enObjets(
      await db.execute({ sql: `SELECT ${COLONNES} FROM articles WHERE slug = ? AND statut = 'publie'`, args: [slug] }),
    );
    if (!article) throw new ErreurHttp(404, 'Article introuvable.');
    return c.json({ article: versPublic(article, lang) }, 200, { 'Cache-Control': CACHE_PUBLIC });
  });

  // --- Pages du site modifiables (page « À propos ») : { page: null } tant que rien n'est enregistré (le site garde alors
  // ses textes par défaut). Même règle de langue que les articles : sans titre anglais, tout est en français.
  function pageValide(c) {
    const cle = c.req.param('cle');
    if (!PAGES.includes(cle)) throw new ErreurHttp(404, 'Page introuvable.');
    return cle;
  }
  async function lirePage(cle) {
    const [page] = enObjets(await db.execute({
      sql: 'SELECT cle, titre_fr, titre_en, contenu_fr, contenu_en, modifie_le FROM pages WHERE cle = ?', args: [cle],
    }));
    return page ?? null;
  }
  app.get('/api/pages/:cle', async (c) => {
    const cle = pageValide(c);
    const lang = c.req.query('lang') ?? 'fr';
    if (!LANGUES.includes(lang)) throw new ErreurHttp(400, '« lang » doit valoir « fr » ou « en ».');
    const p = await lirePage(cle);
    if (!p) return c.json({ page: null }, 200, { 'Cache-Control': CACHE_PUBLIC });
    const traduit = Boolean(p[`titre_${lang}`]);
    return c.json({
      page: {
        cle,
        langue: traduit ? lang : 'fr',
        titre: traduit ? p[`titre_${lang}`] : p.titre_fr,
        contenu: (traduit ? p[`contenu_${lang}`] : '') || p.contenu_fr,
        modifie_le: p.modifie_le,
      },
    }, 200, { 'Cache-Control': CACHE_PUBLIC });
  });

  // --- Administration : configuration complète et jeton obligatoires (sauf pour se connecter). ---
  app.use('/api/admin/*', async (c, next) => {
    if (manquantesAdmin(config).length > 0) throw new ErreurHttp(503, 'Administration pas encore configurée.');
    if (c.req.path === '/api/admin/connexion') return next();
    const m = /^Bearer ([A-Za-z0-9._-]{1,512})$/.exec(c.req.header('Authorization') ?? '');
    if (!m || !verifierJeton(config.cleSession, m[1], maintenant()).valide) {
      return c.json({ erreur: 'Connexion requise.' }, 401, { 'WWW-Authenticate': 'Bearer' });
    }
    await next();
  });

  app.post('/api/admin/connexion', limiteCorps(TAILLE_MAX_CONNEXION), async (c) => {
    const { identifiant, motDePasse } = validerConnexion(await lireJson(c));
    const ipHachee = hacherIp(config.cleSession, adresseIp(c));
    const instant = maintenant();

    const reservation = await reserverTentative(db, ipHachee, instant);
    if (!reservation.autorisee) {
      journal.avertissement('Connexion bloquée (trop de tentatives)');
      return c.json({ erreur: 'Trop de tentatives. Réessayez dans quelques minutes.' }, 429, { 'Retry-After': String(reservation.reessayerDansS) });
    }

    // Les deux vérifications sont toujours faites (même durée, même message, que l'erreur vienne de l'un ou de l'autre).
    const [identifiantOk, motDePasseOk] = await Promise.all([
      identifiantsEgaux(identifiant, config.adminIdentifiant),
      verifierMotDePasse(motDePasse, config.adminEmpreinte),
    ]);
    if (!(identifiantOk && motDePasseOk)) {
      journal.avertissement('Connexion refusée');
      return c.json({ erreur: MESSAGE_ECHEC }, 401);
    }
    await effacerTentatives(db, ipHachee);
    await nettoyerTentatives(db, instant);
    journal.info('Connexion réussie');
    return c.json(creerJeton(config.cleSession, instant));
  });

  function idValide(c) {
    const id = c.req.param('id');
    if (!/^\d{1,12}$/.test(id)) throw new ErreurHttp(404, 'Article introuvable.');
    return Number(id);
  }

  async function lireArticle(id) {
    const [article] = enObjets(await db.execute({ sql: `SELECT ${COLONNES} FROM articles WHERE id = ?`, args: [id] }));
    if (!article) throw new ErreurHttp(404, 'Article introuvable.');
    return article;
  }

  async function slugLibre(slug, saufId = null) {
    const r = await db.execute({ sql: 'SELECT id FROM articles WHERE slug = ? AND id IS NOT ?', args: [slug, saufId] });
    if (r.rows.length > 0) throw new ErreurHttp(409, 'Ce slug est déjà utilisé par un autre article.');
  }

  /** Règles d'un article publié : titre et contenu français, date de publication (maintenant si absente). */
  function completerPublication(article, instantIso) {
    if (article.statut !== 'publie') return article;
    if (!article.titre_fr.trim() || !article.contenu_fr.trim()) {
      throw new ErreurValidation('Pour publier, « titre_fr » et « contenu_fr » sont obligatoires.');
    }
    return { ...article, date_publication: article.date_publication ?? instantIso };
  }

  async function enregistrer(article) {
    try {
      await db.execute({
        sql: `UPDATE articles SET slug = ?, statut = ?, date_publication = ?, titre_fr = ?, titre_en = ?,
              contenu_fr = ?, contenu_en = ?, image = ?, modifie_le = ? WHERE id = ?`,
        args: [article.slug, article.statut, article.date_publication, article.titre_fr, article.titre_en,
          article.contenu_fr, article.contenu_en, article.image, article.modifie_le, article.id],
      });
    } catch (err) {
      if (/UNIQUE/i.test(String(err?.message))) throw new ErreurHttp(409, 'Ce slug est déjà utilisé par un autre article.');
      throw err;
    }
    return lireArticle(article.id);
  }

  /**
   * Lot 3c : annonce Discord à la première publication. `avant` : article avant l'opération (null à la création).
   * Seulement si l'article devient public et n'a jamais été annoncé ; la date d'annonce n'est notée qu'en cas de succès.
   * Retour : null si rien n'était à annoncer, sinon { envoyee, raison? } (jamais d'adresse ni de secret).
   */
  async function annoncerSiBesoin(avant, apres) {
    if (apres.statut !== 'publie' || avant?.statut === 'publie' || apres.annonce_discord_le) return null;
    const resultat = await annoncerArticle({ config, article: apres, journal, fetchAnnonce, fetchGithub });
    if (resultat.envoyee) {
      await db.execute({ sql: 'UPDATE articles SET annonce_discord_le = ? WHERE id = ?', args: [new Date(maintenant()).toISOString(), apres.id] });
    }
    return { envoyee: resultat.envoyee, ...(resultat.raison ? { raison: resultat.raison } : {}) };
  }

  app.get('/api/admin/articles', async (c) => {
    const page = entierPositif(c.req.query('page'), { defaut: 1, max: 10_000 });
    if (page === null) throw new ErreurHttp(400, '« page » doit être un entier à partir de 1.');
    const total = Number((await db.execute('SELECT COUNT(*) AS n FROM articles')).rows[0].n);
    const articles = enObjets(
      await db.execute({
        sql: `SELECT ${COLONNES} FROM articles ORDER BY COALESCE(date_publication, cree_le) DESC, id DESC LIMIT ? OFFSET ?`,
        args: [PAR_PAGE_ADMIN, (page - 1) * PAR_PAGE_ADMIN],
      }),
    );
    return c.json({ page, par_page: PAR_PAGE_ADMIN, total, pages: Math.ceil(total / PAR_PAGE_ADMIN), articles });
  });

  app.get('/api/admin/articles/:id', async (c) => c.json({ article: await lireArticle(idValide(c)) }));

  app.post('/api/admin/articles', limiteCorps(TAILLE_MAX_ARTICLE), async (c) => {
    const champs = validerArticle(await lireJson(c), { creation: true });
    const instantIso = new Date(maintenant()).toISOString();
    const article = completerPublication(
      { statut: 'brouillon', date_publication: null, titre_en: '', contenu_fr: '', contenu_en: '', image: '', ...champs },
      instantIso,
    );
    await slugLibre(article.slug);
    let r;
    try {
      r = await db.execute({
        sql: `INSERT INTO articles (slug, statut, date_publication, titre_fr, titre_en, contenu_fr, contenu_en, image, cree_le, modifie_le)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [article.slug, article.statut, article.date_publication, article.titre_fr, article.titre_en,
          article.contenu_fr, article.contenu_en, article.image, instantIso, instantIso],
      });
    } catch (err) {
      if (/UNIQUE/i.test(String(err?.message))) throw new ErreurHttp(409, 'Ce slug est déjà utilisé par un autre article.');
      throw err;
    }
    journal.info('Article créé', { id: Number(r.lastInsertRowid) });
    const cree = await lireArticle(Number(r.lastInsertRowid));
    const annonce = await annoncerSiBesoin(null, cree);
    return c.json({ article: annonce?.envoyee ? await lireArticle(cree.id) : cree, ...(annonce ? { annonce_discord: annonce } : {}) }, 201);
  });

  app.put('/api/admin/articles/:id', limiteCorps(TAILLE_MAX_ARTICLE), async (c) => {
    const id = idValide(c);
    const champs = validerArticle(await lireJson(c), { creation: false });
    if (Object.keys(champs).length === 0) throw new ErreurValidation('Aucun champ à modifier.');
    const actuel = await lireArticle(id);
    const instantIso = new Date(maintenant()).toISOString();
    if (champs.slug !== undefined) await slugLibre(champs.slug, id);
    const article = completerPublication({ ...actuel, ...champs, modifie_le: instantIso }, instantIso);
    journal.info('Article modifié', { id });
    const enregistre = await enregistrer(article);
    const annonce = await annoncerSiBesoin(actuel, enregistre);
    return c.json({ article: annonce?.envoyee ? await lireArticle(id) : enregistre, ...(annonce ? { annonce_discord: annonce } : {}) });
  });

  /** Articles qui utilisent une image (chemin img/actus/…). */
  async function articlesAvecImage(chemin) {
    return enObjets(await db.execute({ sql: 'SELECT id, titre_fr, statut FROM articles WHERE image = ? ORDER BY id', args: [chemin] }));
  }

  // Suppression d'un article : son image (img/actus/…) est aussi supprimée du dépôt, sauf si un autre article l'utilise.
  // L'article est supprimé d'abord ; si l'image ne peut pas l'être (jeton absent, GitHub en panne), elle reste dans la
  // bibliothèque de l'admin, d'où on peut la supprimer plus tard. Réponse : { supprime, id, image: null | { chemin, supprimee, raison? } }.
  app.delete('/api/admin/articles/:id', async (c) => {
    const id = idValide(c);
    const [avant] = enObjets(await db.execute({ sql: 'SELECT image FROM articles WHERE id = ?', args: [id] }));
    const r = await db.execute({ sql: 'DELETE FROM articles WHERE id = ?', args: [id] });
    if (r.rowsAffected === 0) throw new ErreurHttp(404, 'Article introuvable.');
    journal.info('Article supprimé', { id });
    let image = null;
    const nom = nomDansDossier(avant?.image);
    if (nom) {
      image = { chemin: avant.image, supprimee: false };
      if ((await articlesAvecImage(avant.image)).length > 0) image.raison = 'utilisee_ailleurs';
      else if (!config.jetonGithubImages) image.raison = 'non_configure';
      else {
        try {
          await supprimerSurGithub({ config, nom, fetchGithub });
          image.supprimee = true;
          journal.info('Image supprimée', { chemin: avant.image });
        } catch (err) {
          image.raison = 'erreur_github';
          image.message = err instanceof ErreurImage ? err.message : 'Erreur inattendue.';
          journal.avertissement('Image non supprimée', { chemin: avant.image, erreur: resumerErreur(err) });
        }
      }
    }
    return c.json({ supprime: true, id, image });
  });

  app.post('/api/admin/articles/:id/publier', async (c) => {
    const id = idValide(c);
    const instantIso = new Date(maintenant()).toISOString();
    const actuel = await lireArticle(id);
    const article = completerPublication({ ...actuel, statut: 'publie', modifie_le: instantIso }, instantIso);
    journal.info('Article publié', { id });
    const enregistre = await enregistrer(article);
    const annonce = await annoncerSiBesoin(actuel, enregistre);
    return c.json({ article: annonce?.envoyee ? await lireArticle(id) : enregistre, ...(annonce ? { annonce_discord: annonce } : {}) });
  });

  app.post('/api/admin/articles/:id/depublier', async (c) => {
    const id = idValide(c);
    const instantIso = new Date(maintenant()).toISOString();
    const article = { ...(await lireArticle(id)), statut: 'brouillon', modifie_le: instantIso };
    journal.info('Article dépublié', { id });
    return c.json({ article: await enregistrer(article) });
  });

  // --- Image d'un article (lot 3b) : JPEG, PNG ou WebP de 8 Mo au plus, corps brut (Content-Type: image/…).
  // Réduite à 1600 px, convertie en WebP sans métadonnées, puis enregistrée dans le dépôt du site (img/actus/…) par un commit
  // sur main : GitHub Pages republie le site, l'image est en ligne environ une minute plus tard.
  // Sans le secret GITHUB_JETON_IMAGES : 503 clair, et tout le reste fonctionne.
  app.post(
    '/api/admin/images',
    async (c, next) => {
      if (!config.jetonGithubImages) {
        throw new ErreurHttp(503, 'Envoi d’images pas encore configuré (jeton GitHub des images absent). L’article peut être enregistré sans image.');
      }
      const slug = c.req.query('slug') ?? '';
      if (!slugValide(slug)) throw new ErreurValidation('« slug » de l’article obligatoire (lettres minuscules, chiffres et tirets) pour nommer l’image.');
      await next();
    },
    bodyLimit({ maxSize: TAILLE_MAX_IMAGE, onError: (c) => c.json({ erreur: 'Image trop lourde : 8 Mo au plus.' }, 413) }),
    async (c) => {
      const slug = c.req.query('slug');
      const octets = Buffer.from(await c.req.arrayBuffer());
      const image = await preparerImage(octets, c.req.header('Content-Type'));
      const chemin = cheminImage(slug, image.empreinte);
      const envoi = await enregistrerSurGithub({ config, chemin, empreinte: image.empreinte, donnees: image.donnees, fetchGithub });
      journal.info('Image enregistrée', { chemin: envoi.chemin, octets: image.donnees.length, deja_presente: envoi.deja_present });
      return c.json({
        image: envoi.chemin,
        adresse: ADRESSE_SITE + envoi.chemin,
        largeur: image.largeur,
        hauteur: image.hauteur,
        cote_max: COTE_MAX,
        octets: image.donnees.length,
        deja_presente: envoi.deja_present,
        commit: envoi.commit,
      }, envoi.deja_present ? 200 : 201);
    },
  );

  // --- Bibliothèque des images (lot 3b) : images de img/actus/ (lues dans le dépôt), avec les articles qui les utilisent,
  // pour en réutiliser une sans la republier. Sans jeton GitHub : seulement les images connues des articles.
  app.get('/api/admin/images', async (c) => {
    const usages = enObjets(await db.execute(
      "SELECT image, id, titre_fr, statut, COALESCE(date_publication, modifie_le) AS quand FROM articles WHERE image <> '' ORDER BY quand DESC, id DESC",
    ));
    let source = 'depot';
    let fichiers;
    if (config.jetonGithubImages) {
      fichiers = (await listerSurGithub({ config, fetchGithub })).map((f) => ({ chemin: f.chemin, octets: f.octets }));
    } else {
      source = 'articles';
      fichiers = [...new Set(usages.map((u) => u.image).filter((i) => nomDansDossier(i)))].map((chemin) => ({ chemin, octets: null }));
    }
    const images = fichiers.map((f) => {
      const par = usages.filter((u) => u.image === f.chemin);
      return { image: f.chemin, octets: f.octets, utilisee_par: par.map(({ id, titre_fr, statut }) => ({ id, titre_fr, statut })), quand: par[0]?.quand ?? '' };
    });
    // Images des articles les plus récents d'abord, puis les images inutilisées (par nom).
    images.sort((a, b) => (b.quand.localeCompare(a.quand)) || a.image.localeCompare(b.image));
    return c.json({ source, images: images.map(({ quand, ...reste }) => reste) });
  });

  // Supprime une image INUTILISÉE de la bibliothèque (commit sur main) ; 409 si un article l'utilise.
  app.delete('/api/admin/images/:nom', async (c) => {
    const nom = c.req.param('nom');
    if (!nomImageValide(nom)) throw new ErreurHttp(404, 'Image introuvable.');
    if (!config.jetonGithubImages) {
      throw new ErreurHttp(503, 'Suppression d’images pas encore configurée (jeton GitHub des images absent).');
    }
    const chemin = `img/actus/${nom}`;
    const par = await articlesAvecImage(chemin);
    if (par.length > 0) {
      throw new ErreurHttp(409, `Image utilisée par ${par.length > 1 ? `${par.length} articles` : 'un article'} : retirez-la d’abord de ${par.length > 1 ? 'ces articles' : 'cet article'}.`);
    }
    const r = await supprimerSurGithub({ config, nom, fetchGithub });
    journal.info('Image supprimée', { chemin });
    return c.json({ image: chemin, supprimee: true, deja_absente: r.deja_absente });
  });

  // --- Pages du site (administration) : lecture de tous les champs, enregistrement (création ou remplacement). ---
  app.get('/api/admin/pages/:cle', async (c) => c.json({ page: await lirePage(pageValide(c)) }));

  app.put('/api/admin/pages/:cle', limiteCorps(TAILLE_MAX_ARTICLE), async (c) => {
    const cle = pageValide(c);
    const p = validerPage(await lireJson(c));
    const instantIso = new Date(maintenant()).toISOString();
    await db.execute({
      sql: `INSERT INTO pages (cle, titre_fr, titre_en, contenu_fr, contenu_en, modifie_le) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (cle) DO UPDATE SET titre_fr = excluded.titre_fr, titre_en = excluded.titre_en,
            contenu_fr = excluded.contenu_fr, contenu_en = excluded.contenu_en, modifie_le = excluded.modifie_le`,
      args: [cle, p.titre_fr, p.titre_en, p.contenu_fr, p.contenu_en, instantIso],
    });
    journal.info('Page enregistrée', { cle });
    return c.json({ page: await lirePage(cle) });
  });

  // --- Introuvable et erreurs. ---
  // --- Bandeau d'alerte de l'accueil (lot 3d) : messages de contenus/bandeau.json, lus et réécrits dans le dépôt par l'API GitHub
  // (même jeton que les images). Sans jeton : 503 clair, le reste fonctionne.
  const bandeauConfigure = () => {
    if (!config.jetonGithubImages) {
      throw new ErreurHttp(503, 'Modification du bandeau pas encore configurée (jeton GitHub absent : voir Docs/ref/admin.md, « Jeton GitHub »).');
    }
  };
  app.get('/api/admin/bandeau', async (c) => {
    bandeauConfigure();
    return c.json(await lireBandeau({ config, fetchGithub }), 200, { 'Cache-Control': 'no-store' });
  });
  app.put('/api/admin/bandeau', limiteCorps(64 * 1024), async (c) => {
    bandeauConfigure();
    const { messages, sha } = validerBandeau(await lireJson(c));
    const r = await ecrireBandeau({ config, fetchGithub, messages, sha });
    journal.info('Bandeau modifié', { messages: messages.length, affiches: messages.filter((m) => m.actif).length });
    return c.json({ messages: r.messages, sha: r.sha });
  });

  app.notFound((c) => c.json({ erreur: 'Introuvable.' }, 404));

  app.onError((err, c) => {
    if (err instanceof ErreurValidation) return c.json({ erreur: err.message }, 400);
    if (err instanceof ErreurHttp || err instanceof ErreurImage) return c.json({ erreur: err.message }, err.statut);
    journal.erreur('Erreur interne', { chemin: c.req.path.slice(0, 200), erreur: resumerErreur(err) });
    return c.json({ erreur: 'Erreur interne du serveur.' }, 500);
  });

  return app;
}
