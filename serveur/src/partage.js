// Aperçu de partage du site (lot 3f) : titre et description montrés par Discord, WhatsApp et les réseaux sociaux quand on partage
// https://zsurvival-game.com/, modifiables depuis la page d'administration.
// Les réseaux ne lisent que le HTML (pas le JavaScript) : le texte vit dans les balises Open Graph et Twitter Card d'index.html. Le
// serveur lit index.html dans le dépôt et n'y change que la valeur `content` de quatre balises (og:title, twitter:title, og:description,
// twitter:description), par l'API GitHub (même jeton que les images, GITHUB_JETON_IMAGES) : un commit « Z-Survival admin » sur main.
// GitHub Pages republie le site environ une minute plus tard. Écriture « optimiste » : l'admin renvoie l'empreinte (sha) du fichier lu ;
// si index.html a changé entre-temps, GitHub refuse et le serveur répond 409 (rien n'est écrasé).
import { AUTEUR, ErreurImage, clientGithub } from './images.js';
import { ErreurValidation } from './validation.js';

export const CHEMIN_PAGE = 'index.html';
export const LIMITES_PARTAGE = Object.freeze({ titre: 90, description: 300 });
const BALISES = Object.freeze({
  titre: [['property', 'og:title'], ['name', 'twitter:title']],
  description: [['property', 'og:description'], ['name', 'twitter:description']],
});

const motif = (attr, nom) => new RegExp(`(<meta ${attr}="${nom.replace(/[.:]/g, '\\$&')}" content=")([^"]*)(">)`);
const echapper = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const desechapper = (t) => t.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Texte brut sur une ligne : caractères de contrôle retirés, espaces resserrés. */
function texteBrut(valeur) {
  return String(valeur ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Contrôle le corps envoyé par l'admin. Retour : { titre, description, sha }. */
export function validerPartage(corps) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) throw new ErreurValidation('Corps attendu : { titre, description, sha }.');
  const inconnus = Object.keys(corps).filter((k) => !['titre', 'description', 'sha'].includes(k));
  if (inconnus.length) throw new ErreurValidation(`Champ inconnu : « ${String(inconnus[0]).slice(0, 40)} ».`);
  if (typeof corps.titre !== 'string' || typeof corps.description !== 'string') throw new ErreurValidation('« titre » et « description » sont des textes.');
  const titre = texteBrut(corps.titre);
  const description = texteBrut(corps.description);
  if (!titre || !description) throw new ErreurValidation('Le titre et la description sont obligatoires.');
  if (titre.length > LIMITES_PARTAGE.titre) throw new ErreurValidation(`Titre : ${LIMITES_PARTAGE.titre} caractères au plus.`);
  if (description.length > LIMITES_PARTAGE.description) throw new ErreurValidation(`Description : ${LIMITES_PARTAGE.description} caractères au plus.`);
  const sha = corps.sha ?? null;
  if (sha !== null && (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha))) throw new ErreurValidation('« sha » invalide.');
  return { titre, description, sha };
}

/** Titre et description lus dans le HTML (balises Open Graph) ; null si une balise manque. */
export function extrairePartage(html) {
  const lire = ([attr, nom]) => motif(attr, nom).exec(html)?.[2];
  const titre = lire(BALISES.titre[0]);
  const description = lire(BALISES.description[0]);
  if (titre === undefined || description === undefined) return null;
  return { titre: desechapper(titre), description: desechapper(description) };
}

/** HTML avec les quatre balises remplacées ; erreur si l'une d'elles manque (rien n'est écrit). */
export function remplacerPartage(html, { titre, description }) {
  let sortie = html;
  for (const [cle, valeur] of [['titre', titre], ['description', description]]) {
    for (const [attr, nom] of BALISES[cle]) {
      const m = motif(attr, nom);
      if (!m.test(sortie)) throw new ErreurImage(502, `Balise ${nom} introuvable dans index.html : rien n'a été modifié.`);
      sortie = sortie.replace(m, (_, debut, _ancien, fin) => `${debut}${echapper(valeur)}${fin}`);
    }
  }
  return sortie;
}

async function lireIndex({ config, fetchGithub }) {
  const gh = clientGithub({ config, fetchGithub });
  const r = await gh.appeler(CHEMIN_PAGE, { avecRef: true });
  if (r.status !== 200) throw gh.refuse(r.status);
  let json;
  try { json = await r.json(); } catch { json = null; }
  // Fichiers de plus de 1 Mo : l'API ne renvoie pas le contenu (index.html en est loin).
  if (typeof json?.content !== 'string' || typeof json?.sha !== 'string') throw new ErreurImage(502, 'index.html illisible sur GitHub.');
  return { html: Buffer.from(json.content, 'base64').toString('utf8'), sha: json.sha, gh };
}

/** Titre et description actuels. Retour : { titre, description, sha }. */
export async function lirePartage({ config, fetchGithub }) {
  const { html, sha } = await lireIndex({ config, fetchGithub });
  const p = extrairePartage(html);
  if (!p) throw new ErreurImage(502, 'Balises de partage introuvables dans index.html.');
  return { ...p, sha };
}

/** Écrit le nouveau texte (un commit sur la branche). Retour : { titre, description, sha (nouveau) }. */
export async function ecrirePartage({ config, fetchGithub, titre, description, sha }) {
  const lu = await lireIndex({ config, fetchGithub });
  if (sha && sha !== lu.sha) {
    throw new ErreurImage(409, 'La page a été modifiée entre-temps (mise à jour du site). Rechargez l’aperçu, puis refaites vos changements.');
  }
  const html = remplacerPartage(lu.html, { titre, description });
  if (html === lu.html) return { titre, description, sha: lu.sha };
  const r = await lu.gh.appeler(CHEMIN_PAGE, {
    methode: 'PUT',
    corps: {
      message: 'Aperçu de partage modifié (titre et description)',
      content: Buffer.from(html, 'utf8').toString('base64'),
      branch: config.brancheGithub,
      author: AUTEUR,
      committer: AUTEUR,
      sha: lu.sha,
    },
  });
  if (r.status === 409 || r.status === 422) {
    throw new ErreurImage(409, 'La page a été modifiée entre-temps (mise à jour du site). Rechargez l’aperçu, puis refaites vos changements.');
  }
  if (r.status !== 200 && r.status !== 201) throw lu.gh.refuse(r.status);
  let json = null;
  try { json = await r.json(); } catch { /* sans corps lisible : sans gravité */ }
  return { titre, description, sha: json?.content?.sha ?? null };
}
