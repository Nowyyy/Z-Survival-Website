// Affichage d'un article (lot 3b), commun au site (js/actualites.js) et à l'aperçu de la page d'administration (admin/admin.js) :
// carte de la liste et article complet. Tout est construit en DOM (textContent), le texte par js/markdown.js (liste blanche).
// Les libellés (date, « (FR) »…) viennent de js/textes.js : textes = TEXTES[lang].news.
import { extrait, rendreMarkdown } from './markdown.js';

// Image d'un article : chemin relatif simple dans img/actus/ (même règle que le serveur, sans « .. », sans « / » au début).
const MOTIF_IMAGE = /^img\/actus\/[A-Za-z0-9._-]+\.(?:webp|jpe?g|png)$/;
export const imageValide = (image) => typeof image === 'string' && MOTIF_IMAGE.test(image) && !image.includes('..');

/**
 * Version d'un article complet (tous les champs, page d'administration) dans une langue, exactement comme le serveur la
 * renvoie au public (serveur/src/app.js, versPublic) : sans titre anglais, tout l'article est en français.
 */
export function versionPublique(a, lang) {
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

export function formaterDate(iso, lang, { court = false } = {}) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
      day: 'numeric', month: court ? 'short' : 'long', year: 'numeric', timeZone: 'Europe/Paris',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function el(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte != null) e.textContent = texte;
  return e;
}

/** Date (et « (FR) » si l'article est montré en français sur le site anglais). */
function meta(article, lang, textes, classe, court) {
  const p = el('p', classe);
  if (article.date_publication) {
    const time = el('time', `${classe}-date`, formaterDate(article.date_publication, lang, { court }));
    time.dateTime = article.date_publication;
    p.append(time);
  }
  if (lang !== 'fr' && article.langue === 'fr') {
    const mention = el('span', 'actu-mention-fr', textes.mentionFr);
    mention.title = textes.mentionFrTitre;
    mention.lang = lang;
    const cache = el('span', 'actu-cache', ` ${textes.mentionFrTitre}`);
    mention.append(cache);
    p.append(mention);
  }
  return p;
}

/** Image de l'article ; prefixe : chemin vers la racine du site (« » sur le site, « ../ » depuis admin/). */
function visuel(article, { prefixe = '', classe, source } = {}) {
  const boite = el('div', classe);
  const adresse = source ?? (imageValide(article.image) ? prefixe + article.image : null);
  const vide = () => {
    boite.classList.add(`${classe}-vide`);
    boite.replaceChildren(el('span', `${classe}-z`, 'Z'));
  };
  if (!adresse) {
    vide();
    return boite;
  }
  const img = el('img');
  img.alt = '';
  img.decoding = 'async';
  img.loading = 'lazy';
  // Image tout juste envoyée : GitHub Pages la publie environ une minute après. En attendant, le motif de repli.
  img.addEventListener('error', vide, { once: true });
  img.src = adresse;
  boite.append(img);
  return boite;
}

/** Carte de la liste des actualités (lien vers #actu/<slug>). */
export function construireCarte(article, { lang, textes, prefixe = '', source } = {}) {
  const lien = el('a', 'news-lien');
  lien.href = `#actu/${article.slug}`;
  const corps = el('div', 'news-corps');
  const titre = el('h3', 'news-titre', article.titre);
  if (article.langue !== lang) titre.lang = article.langue;
  const resume = el('p', 'news-resume', extrait(article.contenu));
  if (article.langue !== lang) resume.lang = article.langue;
  corps.append(meta(article, lang, textes, 'news-meta', true), titre, resume);
  lien.append(visuel(article, { prefixe, classe: 'news-visuel', source }), corps);
  return lien;
}

/** Article complet : image, date, titre (h2, id idTitre), texte (titres Markdown à partir de h3). */
export function construireArticle(article, { lang, textes, prefixe = '', source, idTitre = 'actu-titre' } = {}) {
  const fragment = document.createDocumentFragment();
  if (source || imageValide(article.image)) fragment.append(visuel(article, { prefixe, classe: 'actu-image', source }));
  const entete = el('header', 'actu-entete');
  const titre = el('h2', 'actu-titre', article.titre);
  titre.id = idTitre;
  titre.tabIndex = -1;
  entete.append(meta(article, lang, textes, 'actu-meta', false), titre);
  const texte = el('div', 'actu-texte');
  texte.append(rendreMarkdown(article.contenu, { niveauTitre: 3 }));
  if (article.langue !== lang) {
    titre.lang = article.langue;
    texte.lang = article.langue;
  }
  fragment.append(entete, texte);
  return fragment;
}
