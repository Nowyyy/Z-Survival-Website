// Section Actualités (lot 3b) : articles PUBLIÉS lus sur le serveur (GET /api/articles?lang=…), en cartes ; un toucher ouvre
// l'article complet dans une fenêtre (dialog), sans quitter la page, à l'adresse partageable #actu/<slug>.
// - Chargement : cartes squelettes. Erreur ou serveur injoignable : message sobre, le reste du site continue normalement.
//   Aucun article : message d'attente dans le ton du jeu.
// - Langue : les actualités suivent (sans version anglaise, le français s'affiche avec la mention « (FR) »).
// - Fenêtre de l'article : retour en arrière propre (historique), Échap ou ✕ pour fermer, focus rendu à la carte.
// - Le serveur s'endort quand personne ne l'appelle : le premier appel peut prendre quelques secondes (cartes squelettes).
// Adresse du serveur : js/config.js (un seul endroit). Textes : js/textes.js (news.*).
import { ADRESSE_SERVEUR } from './config.js';
import { langue, t } from './i18n.js';
import { construireArticle, construireCarte } from './article.js';
import { poserDerniereActu } from './accueil-bandeau.js';

const DELAI_MS = 15_000;
const SQUELETTES = 3;
const MOTIF_ADRESSE = /^#actu\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** Slug demandé par l'adresse (#actu/<slug>), ou null. */
export function slugDeLAdresse(hash = window.location.hash) {
  return MOTIF_ADRESSE.exec(hash)?.[1] ?? null;
}

class ErreurServeur extends Error {
  constructor(statut) {
    super(`HTTP ${statut}`);
    this.statut = statut;
  }
}

async function lire(chemin) {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI_MS);
  try {
    const r = await fetch(`${ADRESSE_SERVEUR}${chemin}`, { signal: controle.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new ErreurServeur(r.status);
    return await r.json();
  } finally {
    clearTimeout(minuteur);
  }
}

const textes = () => t('news');

// ---------- Liste ----------

const liste = document.getElementById('news-liste');
const etat = document.getElementById('news-etat');
const boutonPlus = document.getElementById('news-plus');
// Par langue : { articles, page, pages } (chargé une fois par visite et par langue ; le serveur garde aussi 60 s en cache).
const memoire = new Map();
let numeroRendu = 0;

function element(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte != null) e.textContent = texte;
  return e;
}

function montrerEtat(type) {
  etat.replaceChildren();
  etat.dataset.etat = type ?? '';
  etat.hidden = !type;
  if (type === 'vide') {
    etat.append(element('span', 'news-etat-titre', t('news.vide.titre')), element('span', 'news-etat-texte', t('news.vide.texte')));
  } else if (type === 'erreur') {
    etat.append(element('span', 'news-etat-texte', t('news.indisponible')));
  }
}

function squelettes() {
  liste.setAttribute('aria-busy', 'true');
  liste.replaceChildren(...Array.from({ length: SQUELETTES }, (_, i) => {
    const li = element('li', 'news-carte news-squelette revele');
    li.style.setProperty('--i', String(2 + i));
    li.setAttribute('aria-hidden', 'true');
    li.append(element('div', 'news-visuel'), element('div', 'news-corps'));
    li.lastChild.append(element('span', 'squelette-ligne squelette-court'), element('span', 'squelette-ligne'), element('span', 'squelette-ligne'));
    return li;
  }));
  // Texte lu par les lecteurs d'écran pendant le chargement (les squelettes sont décoratifs).
  etat.hidden = false;
  etat.dataset.etat = 'chargement';
  etat.replaceChildren(element('span', 'actu-cache', t('news.chargement')));
}

function cartes(articles, depuis = 0) {
  const lang = langue();
  return articles.slice(depuis).map((a, i) => {
    const li = element('li', 'news-carte revele');
    li.style.setProperty('--i', String(2 + Math.min(i, 4)));
    li.append(construireCarte(a, { lang, textes: textes() }));
    return li;
  });
}

function afficherListe(donnees) {
  liste.removeAttribute('aria-busy');
  liste.replaceChildren(...cartes(donnees.articles));
  montrerEtat(donnees.articles.length === 0 ? 'vide' : null);
  boutonPlus.hidden = donnees.page >= donnees.pages;
}

/** (Re)construit la section dans la langue du site : appelé à l'ouverture et à chaque changement de langue. */
export function rendreActualites() {
  const lang = langue();
  const numero = ++numeroRendu;
  boutonPlus.textContent = t('news.plus');
  const connu = memoire.get(lang);
  if (connu) {
    afficherListe(connu);
    poserDerniereActu(connu.articles[0] ?? null);
  } else {
    boutonPlus.hidden = true;
    squelettes();
    lire(`/api/articles?lang=${lang}&page=1`)
      .then((r) => {
        const donnees = { articles: Array.isArray(r.articles) ? r.articles : [], page: r.page ?? 1, pages: r.pages ?? 1 };
        memoire.set(lang, donnees);
        if (numero !== numeroRendu) return;
        afficherListe(donnees);
        poserDerniereActu(donnees.articles[0] ?? null);
      })
      .catch(() => {
        if (numero !== numeroRendu) return;
        liste.removeAttribute('aria-busy');
        liste.replaceChildren();
        montrerEtat('erreur');
        poserDerniereActu(null);
      });
  }
  if (dialogue.open && slugOuvert) remplirArticle(slugOuvert);
}

boutonPlus.addEventListener('click', async () => {
  const lang = langue();
  const donnees = memoire.get(lang);
  if (!donnees || boutonPlus.disabled) return;
  boutonPlus.disabled = true;
  try {
    const r = await lire(`/api/articles?lang=${lang}&page=${donnees.page + 1}`);
    const avant = donnees.articles.length;
    donnees.articles.push(...(r.articles ?? []));
    donnees.page = r.page;
    donnees.pages = r.pages;
    if (lang !== langue()) return;
    const nouvelles = cartes(donnees.articles, avant);
    liste.append(...nouvelles);
    nouvelles[0]?.querySelector('a')?.focus({ preventScroll: false });
    boutonPlus.hidden = donnees.page >= donnees.pages;
  } catch {
    // Échec : le bouton reste là pour réessayer.
  } finally {
    boutonPlus.disabled = false;
  }
});

// ---------- Article complet (fenêtre) ----------

const dialogue = document.getElementById('actu-vue');
const contenu = document.getElementById('actu-article');
const boutonFermer = dialogue.querySelector('.actu-fermer');
let slugOuvert = null;
let entreeAjoutee = false;     // l'ouverture a ajouté une entrée à l'historique (retour = history.back())
let fermetureParHistorique = false;
let focusAvant = null;
let focusEnAttente = null;     // focus à rendre après le retour dans l'historique (la navigation vers #news le déplace)
let numeroArticle = 0;

function message(texte) {
  const p = element('p', 'actu-message', texte);
  p.id = 'actu-titre';
  p.tabIndex = -1;
  contenu.replaceChildren(p);
}

function remplirArticle(slug) {
  const lang = langue();
  const numero = ++numeroArticle;
  const montrer = (article) => {
    if (numero !== numeroArticle) return;
    contenu.replaceChildren(construireArticle(article, { lang, textes: textes() }));
    contenu.lang = lang;
    dialogue.scrollTop = 0;
  };
  const connu = memoire.get(lang)?.articles.find((a) => a.slug === slug);
  if (connu) {
    montrer(connu);
    return;
  }
  message(t('news.chargementArticle'));
  lire(`/api/articles/${slug}?lang=${lang}`)
    .then((r) => montrer(r.article))
    .catch((err) => {
      if (numero === numeroArticle) message(err instanceof ErreurServeur && err.statut === 404 ? t('news.introuvable') : t('news.articleIndisponible'));
    });
}

/** Ouvre l'article ; pousser : ajoute #actu/<slug> à l'historique (le retour en arrière refermera la fenêtre). */
export function ouvrirArticle(slug, { pousser = true, depuis = null } = {}) {
  const adresse = `${window.location.pathname}${window.location.search}#actu/${slug}`;
  if (pousser && slugDeLAdresse() !== slug) {
    history.pushState({ actu: slug }, '', adresse);
    entreeAjoutee = true;
  } else if (slugDeLAdresse() !== slug) {
    history.replaceState(history.state, '', adresse);
  }
  slugOuvert = slug;
  remplirArticle(slug);
  if (!dialogue.open) {
    // Élément qui recevra le focus à la fermeture : le lien touché, sinon l'élément actif, sinon la carte de l'article.
    const actif = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    focusAvant = depuis ?? actif ?? document.querySelector(`.news-lien[href="#actu/${slug}"]`);
    dialogue.showModal();
    document.documentElement.classList.add('actu-ouverte');
  }
  boutonFermer.focus();
}

function fermerArticle() {
  if (dialogue.open) dialogue.close();
}

dialogue.addEventListener('close', () => {
  document.documentElement.classList.remove('actu-ouverte');
  slugOuvert = null;
  numeroArticle += 1;
  // Focus rendu à la carte (ou au lien) qui a ouvert l'article ; sinon au titre de la section.
  const retour = focusAvant?.isConnected ? focusAvant : document.getElementById('titre-news');
  if (retour === document.getElementById('titre-news')) retour.tabIndex = -1;
  focusAvant = null;
  retour?.focus({ preventScroll: true });
  if (!fermetureParHistorique) {
    if (entreeAjoutee) {
      focusEnAttente = retour;
      history.back();
      setTimeout(() => { rendreFocus(); focusEnAttente = null; }, 400);
    } else history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}#news`);
  }
  entreeAjoutee = false;
  fermetureParHistorique = false;
});

// La navigation vers #news (retour) peut déplacer le focus après « popstate » : il est rendu à « popstate », à « hashchange »
// et une dernière fois 400 ms plus tard si personne ne l'a pris entre-temps.
function rendreFocus() {
  if (!focusEnAttente || dialogue.open) return;
  const actif = document.activeElement;
  if (!actif || actif === document.body || actif === focusEnAttente) focusEnAttente.focus({ preventScroll: true });
}
window.addEventListener('hashchange', () => requestAnimationFrame(rendreFocus));
// Échap : fermeture (gérée par le navigateur pour <dialog>, on garde la même suite que le bouton ✕).
dialogue.addEventListener('cancel', (e) => {
  e.preventDefault();
  fermerArticle();
});
boutonFermer.addEventListener('click', fermerArticle);
// Toucher en dehors du panneau (sur le fond assombri) : fermeture.
dialogue.addEventListener('click', (e) => {
  if (e.target === dialogue) fermerArticle();
});

// Tous les liens vers #actu/<slug> (cartes, bandeau d'alerte) ouvrent la fenêtre.
document.addEventListener('click', (e) => {
  const a = e.target instanceof Element ? e.target.closest('a[href^="#actu/"]') : null;
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const slug = slugDeLAdresse(a.getAttribute('href'));
  if (!slug) return;
  e.preventDefault();
  ouvrirArticle(slug, { pousser: true, depuis: a });
});

// Retour / avance du navigateur.
window.addEventListener('popstate', () => {
  const slug = slugDeLAdresse();
  if (slug) {
    // Entrée ajoutée par nous (avance après un retour) : la fermeture refera un retour.
    entreeAjoutee = Boolean(history.state?.actu);
    ouvrirArticle(slug, { pousser: false });
  } else if (dialogue.open) {
    fermetureParHistorique = true;
    fermerArticle();
  } else requestAnimationFrame(rendreFocus);
});
