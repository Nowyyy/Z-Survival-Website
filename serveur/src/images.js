// Images des articles (lot 3b) : contrôle, redimensionnement, conversion en WebP sans métadonnées,
// puis enregistrement dans le dépôt GitHub du site (img/actus/…) par l'API GitHub (« contents »).
// GitHub Pages republie le site après le commit : l'image est en ligne environ une minute plus tard.

import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Peu de mémoire sur Cloud Run (256 Mio) : pas de cache libvips, un seul fil de calcul.
sharp.cache(false);
sharp.concurrency(1);

export const TAILLE_MAX_IMAGE = 8 * 1024 * 1024; // 8 Mo
export const COTE_MAX = 1600;                    // plus grand côté de l'image publiée, en pixels
export const PIXELS_MAX = 36_000_000;            // image d'origine : 36 mégapixels au plus (6000 × 6000)
export const DOSSIER_IMAGES = 'img/actus';
const QUALITE_WEBP = 82;

export const TYPES_IMAGE = Object.freeze({ 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' });

export class ErreurImage extends Error {
  constructor(statut, message) {
    super(message);
    this.name = 'ErreurImage';
    this.statut = statut;
  }
}

/** Format réel d'après les premiers octets (on ne croit pas l'en-tête Content-Type sur parole). */
export function formatReel(octets) {
  if (octets.length >= 3 && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return 'jpeg';
  if (octets.length >= 8 && octets.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (octets.length >= 12 && octets.toString('latin1', 0, 4) === 'RIFF' && octets.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/**
 * Contrôle et transforme l'image reçue.
 * - JPEG, PNG ou WebP seulement (type annoncé ET premiers octets) ;
 * - tournée d'après l'orientation EXIF (photo de téléphone), puis réduite à 1600 px au plus de côté (jamais agrandie) ;
 * - convertie en WebP ; AUCUNE métadonnée gardée (EXIF, position GPS, profil, XMP) : sharp n'en recopie aucune
 *   tant qu'on ne le lui demande pas (withMetadata / keepMetadata ne sont jamais appelés).
 * Retour : { donnees (Buffer WebP), largeur, hauteur, empreinte (8 caractères hexadécimaux) }.
 */
export async function preparerImage(octets, typeAnnonce) {
  const attendu = TYPES_IMAGE[String(typeAnnonce ?? '').split(';')[0].trim().toLowerCase()];
  if (!attendu) throw new ErreurImage(415, 'Format refusé : JPEG, PNG ou WebP seulement.');
  if (octets.length === 0) throw new ErreurImage(400, 'Image vide.');
  if (formatReel(octets) !== attendu) throw new ErreurImage(415, 'Le fichier n’est pas une image JPEG, PNG ou WebP valide.');

  let resultat;
  try {
    const entree = sharp(octets, { limitInputPixels: PIXELS_MAX, failOn: 'error', animated: false });
    const infos = await entree.metadata();
    if (infos.format !== attendu) throw new ErreurImage(415, 'Le fichier n’est pas une image JPEG, PNG ou WebP valide.');
    resultat = await entree
      .rotate() // orientation EXIF appliquée aux pixels (l'EXIF lui-même n'est pas gardé)
      .resize({ width: COTE_MAX, height: COTE_MAX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITE_WEBP, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch (err) {
    if (err instanceof ErreurImage) throw err;
    if (/pixel limit/i.test(String(err?.message))) {
      throw new ErreurImage(413, 'Image trop grande : 36 mégapixels au plus (par exemple 6000 × 6000 pixels).');
    }
    throw new ErreurImage(415, 'Image illisible ou abîmée : JPEG, PNG ou WebP seulement.');
  }
  const empreinte = createHash('sha256').update(resultat.data).digest('hex').slice(0, 8);
  return { donnees: resultat.data, largeur: resultat.info.width, hauteur: resultat.info.height, empreinte };
}

/** Chemin de l'image dans le dépôt (et sur le site) : img/actus/<slug>-<empreinte>.webp */
export function cheminImage(slug, empreinte) {
  return `${DOSSIER_IMAGES}/${slug}-${empreinte}.webp`;
}

export const AUTEUR = Object.freeze({ name: 'Z-Survival admin', email: 'z-survival-admin@nowyyy.github.io' });

// Nom de fichier accepté dans img/actus/ (suppression, bibliothèque) : simple, sans dossier ni « .. ».
const MOTIF_NOM_IMAGE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.(?:webp|jpe?g|png)$/;
export const nomImageValide = (nom) => typeof nom === 'string' && MOTIF_NOM_IMAGE.test(nom) && !nom.includes('..');
/** Chemin img/actus/<nom> si l'image est une image d'article enregistrée par le serveur, sinon null. */
export function nomDansDossier(chemin) {
  const prefixe = `${DOSSIER_IMAGES}/`;
  if (typeof chemin !== 'string' || !chemin.startsWith(prefixe)) return null;
  const nom = chemin.slice(prefixe.length);
  return nomImageValide(nom) ? nom : null;
}

/**
 * Appels à l'API GitHub (« contents ») du dépôt du site. Le jeton n'apparaît jamais dans une erreur :
 * seuls des messages fixes et le code HTTP de GitHub remontent.
 */
export function clientGithub({ config, fetchGithub = fetch }) {
  const [proprietaire, depot] = config.depotGithub.split('/');
  const base = `${config.apiGithub}/repos/${encodeURIComponent(proprietaire)}/${encodeURIComponent(depot)}/contents/`;
  const entetes = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.jetonGithubImages}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'z-survival-serveur',
  };
  const ref = `?ref=${encodeURIComponent(config.brancheGithub)}`;
  async function appeler(chemin, { methode = 'GET', corps, avecRef = false } = {}) {
    try {
      return await fetchGithub(`${base}${chemin}${avecRef ? ref : ''}`, {
        method: methode,
        headers: corps ? { ...entetes, 'Content-Type': 'application/json' } : entetes,
        body: corps ? JSON.stringify(corps) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ErreurImage(502, 'GitHub ne répond pas. Réessayez dans un moment.');
    }
  }
  function refuse(statut) {
    if (statut === 401) return new ErreurImage(502, 'GitHub refuse le jeton des images (expiré ou révoqué ?). Voir Docs/ref/admin.md, « Jeton GitHub ».');
    if (statut === 403 || statut === 404) {
      return new ErreurImage(502, 'Le jeton GitHub des images n’a pas le droit d’écrire dans le dépôt (permission Contents en lecture et écriture).');
    }
    return new ErreurImage(502, `GitHub a refusé l’opération sur l’image (code ${statut}). Réessayez dans un moment.`);
  }
  return { appeler, refuse };
}

/** Images présentes dans img/actus/ du dépôt : [{ nom, chemin, sha, octets }] (dossier absent : liste vide). */
export async function listerSurGithub({ config, fetchGithub }) {
  const gh = clientGithub({ config, fetchGithub });
  const r = await gh.appeler(DOSSIER_IMAGES, { avecRef: true });
  if (r.status === 404) return [];
  if (r.status !== 200) throw gh.refuse(r.status);
  let liste;
  try { liste = await r.json(); } catch { liste = null; }
  if (!Array.isArray(liste)) throw new ErreurImage(502, 'Réponse de GitHub illisible.');
  return liste
    .filter((f) => f?.type === 'file' && nomImageValide(f.name))
    .map((f) => ({ nom: f.name, chemin: `${DOSSIER_IMAGES}/${f.name}`, sha: f.sha, octets: f.size }));
}

/**
 * Enregistre le fichier dans le dépôt par l'API GitHub : un commit sur la branche, auteur « Z-Survival admin ».
 * Rien n'est recommité si la même image est déjà dans img/actus/ (même empreinte SHA-256), même sous le nom d'un autre
 * article : le chemin existant est renvoyé. Retour : { chemin, deja_present, commit }.
 */
export async function enregistrerSurGithub({ config, chemin, empreinte, donnees, fetchGithub }) {
  const gh = clientGithub({ config, fetchGithub });
  const existantes = await listerSurGithub({ config, fetchGithub });
  const identique = existantes.find((f) => f.chemin === chemin || (empreinte && f.nom.endsWith(`-${empreinte}.webp`)));
  if (identique) return { chemin: identique.chemin, deja_present: true, commit: null };

  const reponse = await gh.appeler(chemin, {
    methode: 'PUT',
    corps: { message: `Image d'article : ${chemin}`, content: donnees.toString('base64'), branch: config.brancheGithub, author: AUTEUR, committer: AUTEUR },
  });
  if (reponse.status !== 201 && reponse.status !== 200) {
    // 422 : un fichier du même nom est arrivé entre-temps (même image envoyée deux fois en même temps).
    if (reponse.status === 422) return { chemin, deja_present: true, commit: null };
    throw gh.refuse(reponse.status);
  }
  let commit = null;
  try { commit = (await reponse.json())?.commit?.sha ?? null; } catch { /* réponse sans corps lisible : sans gravité */ }
  return { chemin, deja_present: false, commit };
}

/**
 * Supprime img/actus/<nom> du dépôt (un commit « Z-Survival admin » sur la branche) ; GitHub Pages republie le site sans elle.
 * Déjà absente : rien à faire. Retour : { supprimee: true, deja_absente: boolean }.
 */
export async function supprimerSurGithub({ config, nom, fetchGithub }) {
  if (!nomImageValide(nom)) throw new ErreurImage(400, 'Nom d’image invalide.');
  const gh = clientGithub({ config, fetchGithub });
  const chemin = `${DOSSIER_IMAGES}/${nom}`;
  const lu = await gh.appeler(chemin, { avecRef: true });
  if (lu.status === 404) return { supprimee: true, deja_absente: true };
  if (lu.status !== 200) throw gh.refuse(lu.status);
  let sha = null;
  try { sha = (await lu.json())?.sha ?? null; } catch { /* sans sha : erreur ci-dessous */ }
  if (typeof sha !== 'string') throw new ErreurImage(502, 'Réponse de GitHub illisible.');
  const r = await gh.appeler(chemin, {
    methode: 'DELETE',
    corps: { message: `Image d'article supprimée : ${chemin}`, sha, branch: config.brancheGithub, author: AUTEUR, committer: AUTEUR },
  });
  if (r.status === 404) return { supprimee: true, deja_absente: true };
  if (r.status !== 200) throw gh.refuse(r.status);
  return { supprimee: true, deja_absente: false };
}
