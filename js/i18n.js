// Application des textes (js/textes.js) au HTML.
// - data-t="cle.sous.cle"       → textContent
// - data-t-aria="cle"            → aria-label
// La langue vient de l'attribut lang de <html> (fr par défaut).
import { TEXTES, LANGUE_PAR_DEFAUT } from './textes.js';

export function langue() {
  const l = document.documentElement.lang;
  return TEXTES[l] ? l : LANGUE_PAR_DEFAUT;
}

function lire(objet, chemin) {
  return chemin.split('.').reduce((o, k) => (o == null ? undefined : o[k]), objet);
}

// Texte d'une clé ; repli sur la langue par défaut, puis sur la clé elle-même (repère visible).
export function t(chemin) {
  const v = lire(TEXTES[langue()], chemin) ?? lire(TEXTES[LANGUE_PAR_DEFAUT], chemin);
  return v ?? chemin;
}

export function appliquerTextes(racine = document) {
  racine.querySelectorAll('[data-t]').forEach((el) => {
    el.textContent = t(el.dataset.t);
  });
  racine.querySelectorAll('[data-t-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.tAria));
  });
}

export function mouvementReduit() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
