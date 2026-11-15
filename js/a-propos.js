// Section « À propos » : titre et texte modifiables depuis la page d'administration (GET /api/pages/a-propos?lang=…).
// Le « titre » est la ligne sous le logo du studio (par défaut « Un jeu de No Way Studio », studio.signature) ; le grand titre
// de la section (« À propos » / « About us ») et l'entrée « 05 » du menu restent fixes (js/textes.js).
// Tant que rien n'est enregistré (réponse { page: null }), ou si le serveur ne répond pas, les textes par défaut de js/textes.js
// (studio.signature, about.texte) restent affichés. Texte en Markdown sûr (js/markdown.js). Même règle de langue que les
// actualités : sans version anglaise, le site anglais affiche le français avec la mention « (FR) ».
import { ADRESSE_SERVEUR } from './config.js';
import { langue, t } from './i18n.js';
import { rendreMarkdown } from './markdown.js';
import { TEXTES } from './textes.js';

// Un enregistrement fait quand le titre désignait encore le grand titre de la section (« À propos » / « About us ») ne remplace
// pas la ligne sous le logo : la signature par défaut reste affichée.
const ANCIENS_TITRES = new Set([TEXTES.fr.sections.about, TEXTES.en.sections.about]);
export const titreSignature = (titre) => (typeof titre === 'string' && titre.trim() && !ANCIENS_TITRES.has(titre.trim()) ? titre : null);

const DELAI_MS = 15_000;
const titre = document.getElementById('about-signature');
const texte = document.getElementById('about-texte');
const memoire = new Map(); // langue → page reçue (ou null : textes par défaut)
let numero = 0;

function afficher(page) {
  const lang = langue();
  const valide = page && typeof page.titre === 'string' && page.titre.trim() && typeof page.contenu === 'string';
  const perso = valide ? titreSignature(page.titre) : null;
  titre.textContent = perso || t('studio.signature');
  const corps = valide ? page.contenu : t('about.texte');
  const fragment = document.createDocumentFragment();
  if (valide && page.langue !== lang) {
    const mention = document.createElement('p');
    mention.className = 'about-mention';
    const badge = document.createElement('span');
    badge.className = 'actu-mention-fr';
    badge.textContent = t('news.mentionFr');
    badge.title = t('news.mentionFrTitre');
    mention.append(badge);
    fragment.append(mention);
  }
  fragment.append(rendreMarkdown(corps, { niveauTitre: 3 }));
  texte.replaceChildren(fragment);
  if (perso && page.langue !== lang) titre.lang = page.langue; else titre.removeAttribute('lang');
  if (valide && page.langue !== lang) texte.lang = page.langue; else texte.removeAttribute('lang');
}

/** Appelé à l'ouverture et à chaque changement de langue (après js/i18n.js appliquerTextes). */
export function rendreAPropos() {
  const lang = langue();
  const n = ++numero;
  afficher(memoire.get(lang) ?? null);
  if (memoire.has(lang)) return;
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI_MS);
  fetch(`${ADRESSE_SERVEUR}/api/pages/a-propos?lang=${lang}`, { signal: controle.signal, headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((r) => {
      memoire.set(lang, r?.page ?? null);
      if (n === numero) afficher(memoire.get(lang));
    })
    .catch(() => { /* serveur injoignable : textes par défaut, nouvel essai à la prochaine ouverture */ })
    .finally(() => clearTimeout(minuteur));
}
