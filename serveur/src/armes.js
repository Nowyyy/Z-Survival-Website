// Armes de la section Armes du site (lot 6a, demande du propriétaire) : réglages modifiables depuis la page d'administration.
// Les armes restent dans le fichier du site contenus/armes.json (format de Docs/ref/armes.md, lu par js/section-armes.js) : le serveur le
// lit et le réécrit dans le dépôt par l'API GitHub (même jeton que les images, GITHUB_JETON_IMAGES), un commit « Z-Survival admin » sur
// main, comme le bandeau d'alerte (bandeau.js). GitHub Pages republie le site environ une minute plus tard.
// L'admin ne règle que quatre choses par arme : affichée ou secrète (« prochainement » : un « ? » à la place de l'arme), descriptions FR et
// EN, statistiques (0 à 100), statistiques affichées ou masquées. Tout le reste du fichier (noms, catégories, familles, ordre, chapitres,
// armes retirées, venus du jeu par outils/armes/copier-armes.mjs) est gardé tel quel.
// Écriture « optimiste » : l'admin renvoie l'empreinte (sha) du fichier qu'il a lu ; si le fichier a changé entre-temps, réponse 409.
import { AUTEUR, ErreurImage, clientGithub } from './images.js';
import { ErreurValidation } from './validation.js';

export const CHEMIN_ARMES = 'contenus/armes.json';
export const STATS_ARMES = Object.freeze(['degats', 'cadence', 'portee', 'chargeur']);
export const LIMITES_ARMES = Object.freeze({ armes: 60, description: 400 });
const MOTIF_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHAPITRES_DEFAUT = [{ id: 1, nom: null }];

/** Texte brut sur une ligne : caractères de contrôle retirés, espaces resserrés. */
function texteBrut(valeur) {
  return String(valeur ?? '')
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Statistiques : null, ou { degats, cadence, portee, chargeur } entiers de 0 à 100 (une valeur absente vaut null). */
function statsPropres(stats, ou) {
  if (stats === null || stats === undefined) return null;
  if (typeof stats !== 'object' || Array.isArray(stats)) throw new ErreurValidation(`${ou} : « stats » doit être un objet ou null.`);
  const r = {};
  for (const cle of STATS_ARMES) {
    const v = stats[cle];
    if (v === null || v === undefined || v === '') { r[cle] = null; continue; }
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 100) throw new ErreurValidation(`${ou} : « ${cle} » doit être un nombre entier de 0 à 100.`);
    r[cle] = v;
  }
  return STATS_ARMES.every((c) => r[c] === null) ? null : r;
}

/**
 * Contrôle les réglages envoyés par l'admin. Retour : { armes: [{ id, prochainement, description: { fr, en }, stats, statsVisibles }], sha }.
 * Seules les armes envoyées changent ; une arme inconnue du fichier est refusée à l'écriture.
 */
export function validerArmes(corps) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) throw new ErreurValidation('Corps attendu : { armes: [...], sha }.');
  const { armes, sha } = corps;
  if (!Array.isArray(armes)) throw new ErreurValidation('« armes » doit être une liste.');
  if (armes.length > LIMITES_ARMES.armes) throw new ErreurValidation(`${LIMITES_ARMES.armes} armes au plus.`);
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) throw new ErreurValidation('« sha » invalide : rechargez la page des armes.');
  const vus = new Set();
  const propres = armes.map((a, i) => {
    if (!a || typeof a !== 'object' || Array.isArray(a)) throw new ErreurValidation(`Arme ${i + 1} : objet attendu.`);
    if (typeof a.id !== 'string' || !MOTIF_ID.test(a.id) || a.id.length > 40) throw new ErreurValidation(`Arme ${i + 1} : identifiant invalide.`);
    if (vus.has(a.id)) throw new ErreurValidation(`Arme « ${a.id} » envoyée deux fois.`);
    vus.add(a.id);
    const ou = `Arme « ${a.id} »`;
    for (const cle of ['prochainement', 'statsVisibles']) {
      if (typeof a[cle] !== 'boolean') throw new ErreurValidation(`${ou} : « ${cle} » doit valoir true ou false.`);
    }
    const d = a.description && typeof a.description === 'object' ? a.description : {};
    const fr = texteBrut(d.fr);
    const en = texteBrut(d.en);
    if (fr.length > LIMITES_ARMES.description || en.length > LIMITES_ARMES.description) {
      throw new ErreurValidation(`${ou} : ${LIMITES_ARMES.description} caractères au plus par description.`);
    }
    const stats = statsPropres(a.stats, ou);
    if (a.statsVisibles && !stats) throw new ErreurValidation(`${ou} : pour afficher les statistiques, remplissez-en au moins une.`);
    return { id: a.id, prochainement: a.prochainement, description: { fr, en }, stats, statsVisibles: a.statsVisibles };
  });
  return { armes: propres, sha };
}

/**
 * Contenu du fichier, à l'identique de outils/armes/copier-armes.mjs (ecrireSite) : une arme par bloc, champs sur une ligne, description
 * dessous. Les deux écrivent donc le même fichier (vérifié par tests/armes.test.js sur contenus/armes.json).
 */
export function fichierArmes(doc) {
  const ligne = (a) => {
    const { description, ...reste } = a;
    const tete = Object.entries(reste).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ');
    return `    {\n      ${tete},\n      "description": {\n        "fr": ${JSON.stringify(description?.fr ?? '')},\n        "en": ${JSON.stringify(description?.en ?? '')}\n      }\n    }`;
  };
  const chapitres = (doc.chapitres ?? CHAPITRES_DEFAUT).map((c) => `    ${JSON.stringify(c).replace(/,"/g, ', "').replace(/":/g, '": ')}`).join(',\n');
  const retirees = Array.isArray(doc.retirees) ? doc.retirees : [];
  return `{\n  "_aide": ${JSON.stringify(doc._aide ?? '')},\n  "version": ${doc.version ?? 1},\n  "chapitres": [\n${chapitres}\n  ],\n  "armes": [\n${doc.armes.map(ligne).join(',\n')}\n  ],\n  "retirees": [${retirees.length ? `\n${retirees.map(ligne).join(',\n')}\n  ` : ''}]\n}\n`;
}

/** Fichier tel qu'il est sur GitHub : { doc, sha }. */
async function lireFichier(gh) {
  const r = await gh.appeler(CHEMIN_ARMES, { avecRef: true });
  if (r.status === 404) throw new ErreurImage(404, 'Le fichier des armes est introuvable sur GitHub (contenus/armes.json).');
  if (r.status !== 200) throw gh.refuse(r.status);
  try {
    const json = await r.json();
    const doc = JSON.parse(Buffer.from(String(json.content ?? ''), 'base64').toString('utf8'));
    if (!doc || !Array.isArray(doc.armes)) throw new Error('armes absentes');
    return { doc, sha: typeof json.sha === 'string' ? json.sha : null };
  } catch {
    throw new ErreurImage(502, 'Le fichier des armes est illisible sur GitHub (contenus/armes.json) : corrigez-le d’abord.');
  }
}

/** Vue de l'admin : ce qu'il faut pour reconnaître et régler chaque arme (dans l'ordre du fichier). */
function vueAdmin(doc) {
  return doc.armes.filter((a) => a && typeof a.id === 'string').map((a) => ({
    id: a.id,
    nom: typeof a.nom === 'string' ? a.nom : a.id,
    nomEn: typeof a.nomEn === 'string' ? a.nomEn : null,
    categorie: typeof a.categorie === 'string' ? a.categorie : '',
    famille: typeof a.famille === 'string' ? a.famille : '',
    ordre: Number.isFinite(a.ordre) ? a.ordre : null,
    chapitres: Array.isArray(a.chapitres) && a.chapitres.some(Number.isInteger) ? a.chapitres.filter(Number.isInteger) : [1],
    prochainement: a.prochainement === true,
    description: { fr: typeof a.description?.fr === 'string' ? a.description.fr : '', en: typeof a.description?.en === 'string' ? a.description.en : '' },
    stats: (() => { try { return statsPropres(a.stats, a.id); } catch { return null; } })(),
    statsVisibles: a.statsVisibles === true,
  }));
}

/**
 * Chapitres pour le menu de l'admin : ceux de la liste « chapitres » du fichier (ordre du fichier, nom facultatif { fr, en }), plus ceux
 * cités par les armes ; chacun avec le nombre d'armes qu'il contient. → [{ id, nom, armes }]
 */
function chapitresAdmin(doc, armes) {
  const declares = (Array.isArray(doc.chapitres) ? doc.chapitres : []).filter((c) => Number.isInteger(c?.id));
  const ids = [...new Set([...declares.map((c) => c.id), ...armes.flatMap((a) => a.chapitres)])];
  return ids.map((id) => {
    const nom = declares.find((c) => c.id === id)?.nom;
    const propre = nom && typeof nom === 'object' ? { fr: typeof nom.fr === 'string' ? nom.fr : '', en: typeof nom.en === 'string' ? nom.en : '' } : null;
    return { id, nom: propre, armes: armes.filter((a) => a.chapitres.includes(id)).length };
  });
}

/** Armes du fichier pour l'admin. Retour : { armes, chapitres, sha }. */
export async function lireArmes({ config, fetchGithub }) {
  const gh = clientGithub({ config, fetchGithub });
  const { doc, sha } = await lireFichier(gh);
  const armes = vueAdmin(doc);
  return { armes, chapitres: chapitresAdmin(doc, armes), sha };
}

/** Applique les réglages au fichier (relu sur GitHub) et l'écrit : un commit « Z-Survival admin ». Retour : { armes, chapitres, sha, commit }. */
export async function ecrireArmes({ config, fetchGithub, armes, sha }) {
  const gh = clientGithub({ config, fetchGithub });
  const { doc, sha: actuel } = await lireFichier(gh);
  const conflit = () => new ErreurImage(409, 'Les armes ont été modifiées ailleurs entre-temps (autre onglet, GitHub ou relevé du jeu). Rechargez la page, puis refaites vos changements.');
  if (actuel !== sha) throw conflit();
  const parId = new Map(doc.armes.map((a) => [a?.id, a]));
  for (const r of armes) if (!parId.has(r.id)) throw new ErreurValidation(`Arme inconnue : « ${r.id} ».`);
  for (const r of armes) {
    const a = parId.get(r.id);
    const ancienne = { fr: a.description?.fr ?? '', en: a.description?.en ?? '' };
    a.prochainement = r.prochainement;
    a.stats = r.stats;
    a.statsVisibles = r.statsVisibles;
    if (ancienne.fr !== r.description.fr || ancienne.en !== r.description.en) a.aRelire = false; // relue (ou écrite) par le propriétaire
    a.description = r.description;
  }
  const affichees = doc.armes.filter((a) => a.prochainement !== true).length;
  const rep = await gh.appeler(CHEMIN_ARMES, {
    methode: 'PUT',
    corps: {
      message: `Armes modifiées : ${affichees} affichée${affichees > 1 ? 's' : ''} sur ${doc.armes.length}`,
      content: Buffer.from(fichierArmes(doc), 'utf8').toString('base64'),
      branch: config.brancheGithub,
      author: AUTEUR,
      committer: AUTEUR,
      sha,
    },
  });
  if (rep.status === 409 || rep.status === 422) throw conflit();
  if (rep.status !== 200 && rep.status !== 201) throw gh.refuse(rep.status);
  let json = null;
  try { json = await rep.json(); } catch { /* sans corps lisible : sans gravité */ }
  const vue = vueAdmin(doc);
  return { armes: vue, chapitres: chapitresAdmin(doc, vue), sha: json?.content?.sha ?? null, commit: json?.commit?.sha ?? null };
}
