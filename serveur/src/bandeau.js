// Bandeau d'alerte de l'accueil (lot 3d) : messages modifiables depuis la page d'administration.
// Les messages restent dans le fichier du site contenus/bandeau.json (format de Docs/ref/contenus.md, lu par js/accueil-bandeau.js) :
// le serveur le lit et le réécrit dans le dépôt par l'API GitHub (même jeton que les images, GITHUB_JETON_IMAGES), un commit
// « Z-Survival admin » sur main. GitHub Pages republie le site : les nouveaux messages sont en ligne environ une minute plus tard.
// Le site n'a donc pas besoin du serveur pour afficher le bandeau (pas d'attente au réveil du serveur).
// Écriture « optimiste » : l'admin renvoie l'empreinte (sha) du fichier qu'il a lu ; si le fichier a changé entre-temps (autre
// onglet, modification directe sur GitHub), GitHub refuse et le serveur répond 409.
import { AUTEUR, ErreurImage, clientGithub } from './images.js';
import { ErreurValidation } from './validation.js';

export const CHEMIN_BANDEAU = 'contenus/bandeau.json';
export const LIMITES_BANDEAU = Object.freeze({ messages: 30, texte: 160, id: 40 });

const AIDE = 'Messages du bandeau d\'alerte de l\'accueil, modifiés depuis la page d\'administration (Pages du site → Bandeau d\'alerte) '
  + 'ou ici. fr = français (obligatoire), en = anglais (facultatif : sans lui, le français est affiché), "actif": false cache un '
  + 'message sans le supprimer, id unique sans espace. Texte brut seulement (pas de HTML). Format : Docs/ref/contenus.md.';

/** Texte brut sur une ligne : caractères de contrôle retirés, espaces resserrés. */
function texteBrut(valeur) {
  return String(valeur ?? '')
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Identifiant lisible tiré du texte français (« Horde signalée… » → « horde-signalee… »). */
function idDepuis(texte) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, LIMITES_BANDEAU.id).replace(/-+$/, '') || 'message';
}

/**
 * Contrôle la liste envoyée par l'admin. Retour : { messages: [{ id, actif, fr, en }], sha: string|null }.
 * Les identifiants absents, mal formés ou en double sont refaits à partir du texte français.
 */
export function validerBandeau(corps) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) throw new ErreurValidation('Corps attendu : { messages: [...], sha }.');
  const { messages, sha = null } = corps;
  if (!Array.isArray(messages)) throw new ErreurValidation('« messages » doit être une liste.');
  if (messages.length > LIMITES_BANDEAU.messages) throw new ErreurValidation(`${LIMITES_BANDEAU.messages} messages au plus.`);
  if (sha !== null && (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha))) throw new ErreurValidation('« sha » invalide.');
  const vus = new Set();
  const propres = messages.map((m, i) => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) throw new ErreurValidation(`Message ${i + 1} : objet attendu.`);
    const fr = texteBrut(m.fr);
    const en = texteBrut(m.en);
    if (!fr) throw new ErreurValidation(`Message ${i + 1} : le texte français est obligatoire.`);
    if (fr.length > LIMITES_BANDEAU.texte || en.length > LIMITES_BANDEAU.texte) {
      throw new ErreurValidation(`Message ${i + 1} : ${LIMITES_BANDEAU.texte} caractères au plus par langue.`);
    }
    if (m.actif !== undefined && typeof m.actif !== 'boolean') throw new ErreurValidation(`Message ${i + 1} : « actif » doit valoir true ou false.`);
    let id = typeof m.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.id) && m.id.length <= LIMITES_BANDEAU.id ? m.id : idDepuis(fr);
    const base = id;
    for (let n = 2; vus.has(id); n += 1) id = `${base.slice(0, LIMITES_BANDEAU.id - String(n).length - 1)}-${n}`;
    vus.add(id);
    return { id, actif: m.actif !== false, fr, en };
  });
  return { messages: propres, sha };
}

/** Contenu du fichier : en-tête d'aide, puis un message par ligne (comme le fichier écrit à la main, lisible sur GitHub). */
export function fichierBandeau(messages) {
  const j = (v) => JSON.stringify(v);
  const lignes = messages.map((m) => `    { "id": ${j(m.id)}, "actif": ${m.actif ? 'true' : 'false'}, "fr": ${j(m.fr)}, "en": ${j(m.en)} }`);
  return `{\n  "_aide": ${JSON.stringify(AIDE)},\n  "version": 1,\n  "messages": [${lignes.length ? `\n${lignes.join(',\n')}\n  ` : ''}]\n}\n`;
}

/** Messages du fichier (même ceux qui sont cachés), tels quels ; fichier absent : liste vide. Retour : { messages, sha }. */
export async function lireBandeau({ config, fetchGithub }) {
  const gh = clientGithub({ config, fetchGithub });
  const r = await gh.appeler(CHEMIN_BANDEAU, { avecRef: true });
  if (r.status === 404) return { messages: [], sha: null };
  if (r.status !== 200) throw gh.refuse(r.status);
  let doc;
  let sha;
  try {
    const json = await r.json();
    sha = json.sha;
    doc = JSON.parse(Buffer.from(String(json.content ?? ''), 'base64').toString('utf8'));
  } catch {
    throw new ErreurImage(502, 'Le fichier du bandeau est illisible sur GitHub (contenus/bandeau.json) : corrigez-le ou enregistrez une nouvelle liste.');
  }
  const liste = Array.isArray(doc?.messages) ? doc.messages : [];
  const messages = liste.filter((m) => m && typeof m === 'object').map((m) => ({
    id: typeof m.id === 'string' ? m.id : '',
    actif: m.actif !== false,
    fr: typeof m.fr === 'string' ? m.fr : '',
    en: typeof m.en === 'string' ? m.en : '',
  }));
  return { messages, sha: typeof sha === 'string' ? sha : null };
}

/** Écrit la liste (un commit « Z-Survival admin » sur la branche). Retour : { messages, sha (nouveau), commit }. */
export async function ecrireBandeau({ config, fetchGithub, messages, sha }) {
  const gh = clientGithub({ config, fetchGithub });
  const actifs = messages.filter((m) => m.actif).length;
  const r = await gh.appeler(CHEMIN_BANDEAU, {
    methode: 'PUT',
    corps: {
      message: `Bandeau d'alerte modifié : ${messages.length} message${messages.length > 1 ? 's' : ''} (${actifs} affiché${actifs > 1 ? 's' : ''})`,
      content: Buffer.from(fichierBandeau(messages), 'utf8').toString('base64'),
      branch: config.brancheGithub,
      author: AUTEUR,
      committer: AUTEUR,
      ...(sha ? { sha } : {}),
    },
  });
  if (r.status === 409 || r.status === 422) {
    throw new ErreurImage(409, 'Le bandeau a été modifié ailleurs entre-temps (autre onglet ou GitHub). Rechargez-le, puis refaites vos changements.');
  }
  if (r.status !== 200 && r.status !== 201) throw gh.refuse(r.status);
  let json = null;
  try { json = await r.json(); } catch { /* sans corps lisible : sans gravité */ }
  return { messages, sha: json?.content?.sha ?? null, commit: json?.commit?.sha ?? null };
}
