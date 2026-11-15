// Section « À propos » : deux blocs modifiables depuis la page d'administration (GET /api/pages/<clé>?lang=…).
// - Bloc du jeu (lot 3e, clé « a-propos-jeu ») : titre et texte ; par défaut about.jeu.titre et about.jeu.texte de js/textes.js.
// - Bloc du studio (clé « a-propos ») : le « titre » est la ligne sous le logo du studio (par défaut « Un jeu de No Way Studio »,
//   studio.signature) et le texte (par défaut about.texte).
// Le grand titre de la section (« À propos » / « About us »), les images, les crédits et l'entrée « 05 » du menu restent fixes.
// Tant que rien n'est enregistré (réponse { page: null }), ou si le serveur ne répond pas, les textes par défaut restent affichés.
// Texte en Markdown sûr (js/markdown.js). Même règle de langue que les actualités : sans version anglaise, le site anglais affiche le
// français avec la mention « (FR) ».
import { ADRESSE_SERVEUR } from './config.js';
import { langue, t } from './i18n.js';
import { rendreMarkdown } from './markdown.js';
import { TEXTES } from './textes.js';

// Un enregistrement fait quand le titre du studio désignait encore le grand titre de la section (« À propos » / « About us ») ne
// remplace pas la ligne sous le logo : la signature par défaut reste affichée.
const ANCIENS_TITRES = new Set([TEXTES.fr.sections.about, TEXTES.en.sections.about]);
export const titreSignature = (titre) => (typeof titre === 'string' && titre.trim() && !ANCIENS_TITRES.has(titre.trim()) ? titre : null);

const DELAI_MS = 15_000;
const BLOCS = [
  {
    cle: 'a-propos-jeu',
    titre: document.getElementById('about-jeu-titre'),
    texte: document.getElementById('about-jeu-texte'),
    titreParDefaut: () => t('about.jeu.titre'),
    texteParDefaut: () => t('about.jeu.texte'),
    titreValable: (titre) => (typeof titre === 'string' && titre.trim() ? titre : null),
  },
  {
    cle: 'a-propos',
    titre: document.getElementById('about-signature'),
    texte: document.getElementById('about-texte'),
    titreParDefaut: () => t('studio.signature'),
    texteParDefaut: () => t('about.texte'),
    titreValable: titreSignature,
  },
].filter((b) => b.titre && b.texte);

const memoire = new Map(); // « clé:langue » → page reçue (ou null : textes par défaut)
const numeros = new Map(); // clé → numéro de la dernière demande (une réponse en retard n'écrase pas une plus récente)

function afficher(bloc, page) {
  const lang = langue();
  const valide = page && typeof page.titre === 'string' && page.titre.trim() && typeof page.contenu === 'string';
  const perso = valide ? bloc.titreValable(page.titre) : null;
  bloc.titre.textContent = perso || bloc.titreParDefaut();
  const corps = valide ? page.contenu : bloc.texteParDefaut();
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
  bloc.texte.replaceChildren(fragment);
  if (perso && page.langue !== lang) bloc.titre.lang = page.langue; else bloc.titre.removeAttribute('lang');
  if (valide && page.langue !== lang) bloc.texte.lang = page.langue; else bloc.texte.removeAttribute('lang');
}

function rendreBloc(bloc) {
  const lang = langue();
  const cle = `${bloc.cle}:${lang}`;
  const n = (numeros.get(bloc.cle) ?? 0) + 1;
  numeros.set(bloc.cle, n);
  afficher(bloc, memoire.get(cle) ?? null);
  if (memoire.has(cle)) return;
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI_MS);
  fetch(`${ADRESSE_SERVEUR}/api/pages/${bloc.cle}?lang=${lang}`, { signal: controle.signal, headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((r) => {
      memoire.set(cle, r?.page ?? null);
      if (numeros.get(bloc.cle) === n) afficher(bloc, memoire.get(cle));
    })
    .catch(() => { /* serveur injoignable : textes par défaut, nouvel essai à la prochaine ouverture */ })
    .finally(() => clearTimeout(minuteur));
}

/** Appelé à l'ouverture et à chaque changement de langue (après js/i18n.js appliquerTextes). */
export function rendreAPropos() {
  BLOCS.forEach(rendreBloc);
}
