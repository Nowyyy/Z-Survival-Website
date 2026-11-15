// Accueil : bandeau d'alerte qui défile en bas (idée « catchy » n° 5, à l'essai). Affiché SEULEMENT avec ?bandeau=1 dans l'adresse
// (l'aperçu scene/apercu.html?bandeau=1 le transmet) : sur le site public, rien ne change tant qu'il n'est pas validé.
// Messages : js/textes.js (accueil.bandeau.messages, fr et en). La piste contient deux fois la liste : le défilement (CSS) boucle sans saut.
// Les lecteurs d'écran lisent la première copie ; la seconde est décorative. Mouvement réduit : pas de défilement (premier message fixe).
import { t } from './i18n.js';

export const BANDEAU_ACTIF = new URLSearchParams(window.location.search).get('bandeau') === '1';

export function construireBandeau() {
  const bandeau = document.querySelector('.accueil-bandeau');
  if (!bandeau || !BANDEAU_ACTIF) return;
  bandeau.hidden = false;
  document.documentElement.classList.add('avec-bandeau');
  const messages = t('accueil.bandeau.messages');
  const liste = Array.isArray(messages) ? messages : [];
  const piste = bandeau.querySelector('.bandeau-piste');
  const copie = (cachee) => {
    const ul = document.createElement('ul');
    ul.className = 'bandeau-liste';
    if (cachee) ul.setAttribute('aria-hidden', 'true');
    for (const m of liste) {
      const li = document.createElement('li');
      li.textContent = m;
      ul.append(li);
    }
    return ul;
  };
  piste.replaceChildren(copie(false), copie(true));
  // Vitesse constante quelle que soit la longueur des messages (environ 70 px par seconde).
  requestAnimationFrame(() => {
    const largeur = piste.firstElementChild?.scrollWidth ?? 0;
    if (largeur > 0) piste.style.setProperty('--bandeau-duree', `${Math.max(12, largeur / 70).toFixed(1)}s`);
  });
}
