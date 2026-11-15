// Contrôle des entrées : types, longueurs maximales, champs connus seulement.
// Toute entrée refusée renvoie un message clair en français (sans jamais reprendre la valeur reçue).

export const LIMITES = Object.freeze({
  slug: 120,
  titre: 200,
  contenu: 40_000,
  image: 300,
  identifiant: 200,
  motDePasse: 256,
});

export const LANGUES = Object.freeze(['fr', 'en']);
export const STATUTS = Object.freeze(['brouillon', 'publie']);
const MOTIF_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Chemin relatif simple (ex. images/2026/annonce.webp) : pas d'adresse complète, pas de « .. », pas de « / » au début.
const MOTIF_IMAGE = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\/-]+$/;
const MOTIF_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

export class ErreurValidation extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurValidation';
  }
}

export function slugValide(slug) {
  return typeof slug === 'string' && slug.length <= LIMITES.slug && MOTIF_SLUG.test(slug);
}

function texte(valeur, nom, max, { obligatoire = false } = {}) {
  if (typeof valeur !== 'string') throw new ErreurValidation(`« ${nom} » doit être un texte.`);
  if (valeur.length > max) throw new ErreurValidation(`« ${nom} » dépasse ${max} caractères.`);
  if (obligatoire && valeur.trim().length === 0) throw new ErreurValidation(`« ${nom} » est obligatoire.`);
  return valeur;
}

function date(valeur) {
  if (valeur === null) return null;
  if (typeof valeur !== 'string' || !MOTIF_DATE.test(valeur) || Number.isNaN(Date.parse(valeur))) {
    throw new ErreurValidation('« date_publication » doit être une date ISO 8601 (ex. 2026-11-15T14:00:00Z) ou null.');
  }
  return new Date(valeur).toISOString();
}

const CHAMPS_ARTICLE = ['slug', 'statut', 'date_publication', 'titre_fr', 'titre_en', 'contenu_fr', 'contenu_en', 'image'];

/**
 * Valide les champs d'un article. creation=true : slug et titre_fr obligatoires.
 * Renvoie un objet ne contenant que les champs fournis, nettoyés.
 */
export function validerArticle(corps, { creation }) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) throw new ErreurValidation('Objet JSON attendu.');
  const inconnus = Object.keys(corps).filter((k) => !CHAMPS_ARTICLE.includes(k));
  if (inconnus.length > 0) throw new ErreurValidation(`Champ inconnu : ${inconnus.slice(0, 3).map((k) => `« ${String(k).slice(0, 40)} »`).join(', ')}.`);

  const propre = {};
  if (creation || 'slug' in corps) {
    if (!slugValide(corps.slug)) {
      throw new ErreurValidation(`« slug » obligatoire : lettres minuscules, chiffres et tirets (ex. nouvelle-carte), ${LIMITES.slug} caractères au plus.`);
    }
    propre.slug = corps.slug;
  }
  if ('statut' in corps) {
    if (!STATUTS.includes(corps.statut)) throw new ErreurValidation('« statut » doit valoir « brouillon » ou « publie ».');
    propre.statut = corps.statut;
  }
  if ('date_publication' in corps) propre.date_publication = date(corps.date_publication);
  if (creation || 'titre_fr' in corps) propre.titre_fr = texte(corps.titre_fr, 'titre_fr', LIMITES.titre, { obligatoire: true });
  if ('titre_en' in corps) propre.titre_en = texte(corps.titre_en, 'titre_en', LIMITES.titre);
  if ('contenu_fr' in corps) propre.contenu_fr = texte(corps.contenu_fr, 'contenu_fr', LIMITES.contenu);
  if ('contenu_en' in corps) propre.contenu_en = texte(corps.contenu_en, 'contenu_en', LIMITES.contenu);
  if ('image' in corps) {
    const image = texte(corps.image, 'image', LIMITES.image);
    if (image !== '' && !MOTIF_IMAGE.test(image)) throw new ErreurValidation('« image » doit être un chemin relatif simple (ou vide).');
    propre.image = image;
  }
  return propre;
}

// Pages du site modifiables depuis l'administration (lot « À propos ») : clés fixes.
export const PAGES = Object.freeze(['a-propos']);
const CHAMPS_PAGE = ['titre_fr', 'titre_en', 'contenu_fr', 'contenu_en'];
const LIMITE_TITRE_PAGE = 120;
const LIMITE_CONTENU_PAGE = 20_000;

/** Valide le texte d'une page : les quatre champs, titre et texte français obligatoires (l'anglais est facultatif). */
export function validerPage(corps) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) throw new ErreurValidation('Objet JSON attendu.');
  const inconnus = Object.keys(corps).filter((k) => !CHAMPS_PAGE.includes(k));
  if (inconnus.length > 0) throw new ErreurValidation(`Champ inconnu : ${inconnus.slice(0, 3).map((k) => `« ${String(k).slice(0, 40)} »`).join(', ')}.`);
  return {
    titre_fr: texte(corps.titre_fr, 'titre_fr', LIMITE_TITRE_PAGE, { obligatoire: true }).trim(),
    titre_en: texte(corps.titre_en ?? '', 'titre_en', LIMITE_TITRE_PAGE).trim(),
    contenu_fr: texte(corps.contenu_fr, 'contenu_fr', LIMITE_CONTENU_PAGE, { obligatoire: true }),
    contenu_en: texte(corps.contenu_en ?? '', 'contenu_en', LIMITE_CONTENU_PAGE),
  };
}

/** Valide le corps de la connexion. Renvoie { identifiant, motDePasse }. */
export function validerConnexion(corps) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) throw new ErreurValidation('Objet JSON attendu.');
  const { identifiant, mot_de_passe: motDePasse } = corps;
  if (typeof identifiant !== 'string' || typeof motDePasse !== 'string' || identifiant.length === 0 || motDePasse.length === 0) {
    throw new ErreurValidation('« identifiant » et « mot_de_passe » sont obligatoires.');
  }
  if (identifiant.length > LIMITES.identifiant || motDePasse.length > LIMITES.motDePasse) {
    throw new ErreurValidation('Identifiant ou mot de passe trop long.');
  }
  return { identifiant, motDePasse };
}

/** Lit un entier positif dans une chaîne de requête (page=N). */
export function entierPositif(valeur, { defaut, max }) {
  if (valeur === undefined || valeur === '') return defaut;
  if (!/^\d{1,6}$/.test(valeur)) return null;
  const n = Number(valeur);
  return n >= 1 && n <= max ? n : null;
}
