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

const AUTEUR = Object.freeze({ name: 'Z-Survival admin', email: 'z-survival-admin@nowyyy.github.io' });

/**
 * Enregistre le fichier dans le dépôt par l'API GitHub : un commit sur la branche, auteur « Z-Survival admin ».
 * Si le même fichier existe déjà (même image envoyée deux fois : même empreinte, donc même chemin), rien n'est recommité.
 * Le jeton n'apparaît jamais dans une erreur : seuls des messages fixes et le code HTTP de GitHub remontent.
 * Retour : { deja_present: boolean, commit: sha|null }.
 */
export async function enregistrerSurGithub({ config, chemin, donnees, fetchGithub = fetch }) {
  const [proprietaire, depot] = config.depotGithub.split('/');
  const adresse = `${config.apiGithub}/repos/${encodeURIComponent(proprietaire)}/${encodeURIComponent(depot)}/contents/${chemin}`;
  const entetes = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.jetonGithubImages}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'z-survival-serveur',
  };
  const appeler = async (options) => {
    try {
      return await fetchGithub(options.url, { ...options, signal: AbortSignal.timeout(20_000) });
    } catch {
      throw new ErreurImage(502, 'GitHub ne répond pas. Réessayez dans un moment.');
    }
  };
  const refuse = (statut) => {
    if (statut === 401) return new ErreurImage(502, 'GitHub refuse le jeton des images (expiré ou révoqué ?). Voir Docs/ref/admin.md, « Jeton GitHub ».');
    if (statut === 403 || statut === 404) {
      return new ErreurImage(502, 'Le jeton GitHub des images n’a pas le droit d’écrire dans le dépôt (permission Contents en lecture et écriture).');
    }
    return new ErreurImage(502, `GitHub a refusé l’envoi de l’image (code ${statut}). Réessayez dans un moment.`);
  };

  const existant = await appeler({ url: `${adresse}?ref=${encodeURIComponent(config.brancheGithub)}`, method: 'GET', headers: entetes });
  if (existant.status === 200) return { deja_present: true, commit: null };
  if (existant.status !== 404) throw refuse(existant.status);

  const reponse = await appeler({
    url: adresse,
    method: 'PUT',
    headers: { ...entetes, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Image d'article : ${chemin}`,
      content: donnees.toString('base64'),
      branch: config.brancheGithub,
      author: AUTEUR,
      committer: AUTEUR,
    }),
  });
  if (reponse.status !== 201 && reponse.status !== 200) {
    // 422 : un fichier du même nom est arrivé entre-temps (même image envoyée deux fois en même temps).
    if (reponse.status === 422) return { deja_present: true, commit: null };
    throw refuse(reponse.status);
  }
  let commit = null;
  try { commit = (await reponse.json())?.commit?.sha ?? null; } catch { /* réponse sans corps lisible : sans gravité */ }
  return { deja_present: false, commit };
}
