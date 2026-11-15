// Accueil : bandeau d'alerte qui défile en bas (idée « catchy » n° 5). Affiché seulement avec ?bandeau=1 dans l'adresse (l'aperçu
// scene/apercu.html?bandeau=1 le transmet) tant que le propriétaire ne l'a pas mis en service sur le site public.
// Messages : SOURCE_BANDEAU (aujourd'hui le fichier contenus/bandeau.json, modifiable sans toucher au code ; demain l'adresse de l'API de
// l'interface d'administration, même format : Docs/ref/contenus.md). Format : { messages: [{ id, actif, fr, en }] }, texte brut seulement.
// La piste contient deux fois la liste : le défilement (CSS) boucle sans saut. Les lecteurs d'écran lisent la première copie ; la seconde est
// décorative. Mouvement réduit : pas de défilement. Source illisible ou aucun message actif : pas de bandeau.
import { langue } from './i18n.js';

export const BANDEAU_ACTIF = new URLSearchParams(window.location.search).get('bandeau') === '1';
export const SOURCE_BANDEAU = 'contenus/bandeau.json';

// Messages valides de la source (chargée une seule fois) : { id, fr, en } avec au moins le français.
export function messagesValides(doc) {
  const liste = Array.isArray(doc?.messages) ? doc.messages : [];
  return liste.filter((m) => m && m.actif !== false && typeof m.fr === 'string' && m.fr.trim()).map((m) => ({ id: String(m.id ?? ''), fr: m.fr.trim(), en: typeof m.en === 'string' && m.en.trim() ? m.en.trim() : m.fr.trim() }));
}

let chargement = null;
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
  charger().then((messages) => {
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
        li.textContent = m[cle];
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
