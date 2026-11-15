// Langue et textes du site (js/textes.js).
// - data-t="cle.sous.cle"       → textContent
// - data-t-aria="cle"            → aria-label
// - data-t-alt="cle"             → alt (images)
// La langue courante est l'attribut lang de <html>. Le choix du visiteur (globe) est gardé dans son navigateur
// (localStorage, simple confort). Sans choix : langue du navigateur — français pour les visiteurs francophones,
// anglais pour tous les autres. Aucun service extérieur n'est appelé (pas de géolocalisation).
import { TEXTES, LANGUE_PAR_DEFAUT, LANGUES } from './textes.js';

const CLE_STOCKAGE = 'z-survival-site.langue';

export function langue() {
  const l = document.documentElement.lang;
  return TEXTES[l] ? l : LANGUE_PAR_DEFAUT;
}

// Langue du navigateur : français si le français vient avant l'anglais dans les langues préférées du visiteur
// (fr-FR, fr-CA, fr-BE, ou nl-BE puis fr-BE…), anglais sinon (y compris pour les autres langues).
export function langueDuNavigateur(preferees) {
  for (const code of preferees ?? []) {
    const l = String(code).toLowerCase().split('-')[0];
    if (l === 'fr') return 'fr';
    if (l === 'en') return 'en';
  }
  return 'en';
}

function languesDuNavigateur() {
  try {
    const liste = navigator.languages?.length ? navigator.languages : [navigator.language];
    return liste.filter(Boolean);
  } catch { return []; }
}

// Langue au chargement : ?lang=en dans l'adresse, sinon le dernier choix du visiteur, sinon la langue du navigateur.
export function langueInitiale() {
  try {
    const demandee = new URLSearchParams(window.location.search).get('lang');
    if (LANGUES.includes(demandee)) return demandee;
  } catch { /* adresse illisible : on ignore */ }
  try {
    const gardee = window.localStorage.getItem(CLE_STOCKAGE);
    if (LANGUES.includes(gardee)) return gardee;
  } catch { /* stockage indisponible */ }
  return langueDuNavigateur(languesDuNavigateur());
}

export function changerLangue(l) {
  if (!LANGUES.includes(l)) return;
  document.documentElement.lang = l;
  try { window.localStorage.setItem(CLE_STOCKAGE, l); } catch { /* stockage indisponible */ }
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
  racine.querySelectorAll('[data-t-alt]').forEach((el) => {
    el.setAttribute('alt', t(el.dataset.tAlt));
  });
  document.title = t('meta.titre');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
}

export function mouvementReduit() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
