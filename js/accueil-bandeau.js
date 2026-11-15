// Accueil : bandeau d'alerte qui défile en bas (idée « catchy » n° 5). Affiché seulement avec ?bandeau=1 dans l'adresse (l'aperçu
// scene/apercu.html?bandeau=1 le transmet) tant que le propriétaire ne l'a pas mis en service sur le site public.
// Messages : SOURCE_BANDEAU (aujourd'hui le fichier contenus/bandeau.json, modifiable sans toucher au code ; demain l'adresse de l'API de
// l'interface d'administration, même format : Docs/ref/contenus.md). Format : { messages: [{ id, actif, fr, en }] }, texte brut seulement.
// La piste contient deux fois la liste : le défilement (CSS) boucle sans saut. Les lecteurs d'écran lisent la première copie ; la seconde est
// décorative. Mouvement réduit : pas de défilement. Source illisible ou aucun message actif : pas de bandeau.
// Lot 3b : le titre du dernier article publié passe en tête du bandeau, avec un lien vers l'article (#actu/<slug>), quand il y en a un.
import { langue, t } from './i18n.js';

export const BANDEAU_ACTIF = new URLSearchParams(window.location.search).get('bandeau') === '1';
export const SOURCE_BANDEAU = 'contenus/bandeau.json';

// Messages valides de la source (chargée une seule fois) : { id, fr, en } avec au moins le français.
export function messagesValides(doc) {
  const liste = Array.isArray(doc?.messages) ? doc.messages : [];
  return liste.filter((m) => m && m.actif !== false && typeof m.fr === 'string' && m.fr.trim()).map((m) => ({ id: String(m.id ?? ''), fr: m.fr.trim(), en: typeof m.en === 'string' && m.en.trim() ? m.en.trim() : m.fr.trim() }));
}

let chargement = null;
// Dernier article publié (js/actualites.js) : { slug, titre, langue } ou null.
let derniereActu = null;

/** Appelé par js/actualites.js quand la liste des articles est connue (ou en erreur : null). */
export function poserDerniereActu(article) {
  const nouvelle = article ? { slug: article.slug, titre: article.titre, langue: article.langue } : null;
  if (JSON.stringify(nouvelle) === JSON.stringify(derniereActu)) return;
  derniereActu = nouvelle;
  construireBandeau();
}
function charger() {
  chargement ??= fetch(SOURCE_BANDEAU, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then(messagesValides).catch(() => []);
  return chargement;
}

function retirer(bandeau) {
  bandeau.hidden = true;
  document.documentElement.classList.remove('avec-bandeau');
}

// Appelé à chaque rendu des textes (ouverture, changement de langue).
export function construireBandeau() {
  const bandeau = document.querySelector('.accueil-bandeau');
  if (!bandeau || !BANDEAU_ACTIF) return;
  // Place réservée tout de suite (le logo et le bouton ne sautent pas quand les messages arrivent) ; retirée si la source est vide.
  document.documentElement.classList.add('avec-bandeau');
  charger().then((liste) => {
    const messages = derniereActu ? [{ actu: derniereActu }, ...liste] : liste;
    if (!messages.length) {
      retirer(bandeau);
      return;
    }
    const cle = langue() === 'en' ? 'en' : 'fr';
    const piste = bandeau.querySelector('.bandeau-piste');
    const copie = (cachee) => {
      const ul = document.createElement('ul');
      ul.className = 'bandeau-liste';
      if (cachee) ul.setAttribute('aria-hidden', 'true');
      for (const m of messages) {
        const li = document.createElement('li');
        if (m.actu) {
          li.className = 'bandeau-actu';
          const a = document.createElement('a');
          a.href = `#actu/${m.actu.slug}`;
          a.textContent = `${t('news.bandeau')} : ${m.actu.titre}`;
          if (m.actu.langue !== langue()) a.lang = m.actu.langue;
          if (cachee) a.tabIndex = -1;
          li.append(a);
        } else li.textContent = m[cle];
        ul.append(li);
      }
      return ul;
    };
    piste.replaceChildren(copie(false), copie(true));
    bandeau.hidden = false;
    // Vitesse constante quelle que soit la longueur des messages (environ 70 px par seconde).
    requestAnimationFrame(() => {
      const largeur = piste.firstElementChild?.scrollWidth ?? 0;
      if (largeur > 0) piste.style.setProperty('--bandeau-duree', `${Math.max(12, largeur / 70).toFixed(1)}s`);
    });
  });
}
