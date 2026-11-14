// Page d'accueil : textes, puis petite transition de sortie vers la page principale (coupée en mouvement réduit).
import { appliquerTextes, mouvementReduit, t } from './i18n.js';

appliquerTextes();
document.title = t('meta.titreAccueil');
document.body.classList.add('est-pret');

const entrer = document.querySelector('.accueil-entrer');
entrer?.addEventListener('click', (e) => {
  if (mouvementReduit() || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  document.body.classList.add('est-en-sortie');
  window.setTimeout(() => { window.location.href = entrer.getAttribute('href'); }, 350);
});

// Retour arrière depuis la page principale : la page peut revenir du cache, sans la classe de sortie.
window.addEventListener('pageshow', () => document.body.classList.remove('est-en-sortie'));
