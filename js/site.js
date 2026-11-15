// Page unique du site : accueil plein écran (image animée à venir), puis les sections News, Characters,
// Weapons et About us. Défilement qui s'arrête sur chaque section (scroll-snap en CSS), « En savoir plus » qui
// descend vers News (on peut remonter vers l'accueil), navigation qui suit la section affichée,
// apparition du contenu à l'entrée de chaque section, menus de langue (Français / English) sur l'accueil et dans l'en-tête.
import { appliquerTextes, changerLangue, langue, langueInitiale, mouvementReduit, t } from './i18n.js';
import { ARMES } from './donnees.js';
import { poserLogo } from './logo.js';
import { installerFlashTir } from './accueil-tir.js';
import { lancerEntree } from './accueil-entree.js';

document.documentElement.lang = langueInitiale();

const conteneur = document.getElementById('sections');
const sections = [...document.querySelectorAll('.section')];
const liens = [...document.querySelectorAll('.nav-sections a[data-section]')];
const indexDe = (id) => sections.findIndex((s) => s.id === id);

function element(balise, classe, texte) {
  const el = document.createElement(balise);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

// ---------- Contenus provisoires (reconstruits à chaque changement de langue) ----------

const choix = { perso: 0, arme: 0 };

function construireNews() {
  const liste = document.getElementById('news-liste');
  liste.replaceChildren();
  t('news.cartes').forEach((carte, i) => {
    const li = element('li', 'news-carte revele');
    li.style.setProperty('--i', String(2 + i));
    const visuel = element('div', 'news-visuel emplacement');
    visuel.append(element('span', 'marque-provisoire', t('commun.provisoire')));
    const corps = element('div', 'news-corps');
    const meta = element('p', 'news-meta');
    meta.append(element('span', 'news-categorie', carte.categorie), element('time', 'news-date', carte.date));
    corps.append(meta, element('h3', 'news-titre', carte.titre), element('p', 'news-resume', carte.resume));
    li.append(visuel, corps);
    liste.append(li);
  });
}

function construirePersonnages() {
  const liste = document.getElementById('perso-miniatures');
  const etiquette = document.getElementById('perso-etiquette');
  const detail = document.getElementById('perso-detail');
  const persos = t('characters.personnages');
  liste.replaceChildren();
  const boutons = persos.map((p, i) => {
    const li = element('li');
    const b = element('button', 'perso-miniature');
    b.type = 'button';
    b.append(element('span', 'perso-miniature-num', String(i + 1).padStart(2, '0')), element('span', 'perso-miniature-nom', p.nom));
    b.addEventListener('click', () => choisir(i));
    li.append(b);
    liste.append(li);
    return b;
  });
  function choisir(i) {
    choix.perso = i;
    boutons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    etiquette.textContent = `${t('characters.zone')} — ${t('commun.aVenir')}`;
    detail.textContent = `${persos[i].nom} · ${persos[i].role}`;
  }
  choisir(choix.perso);
}

function construireArmes() {
  const groupe = document.getElementById('arme-choix');
  const stats = document.getElementById('arme-stats');
  const etiquette = document.getElementById('arme-etiquette');
  const detail = document.getElementById('arme-detail');
  const cles = Object.keys(ARMES[0].stats);
  const barres = {};
  groupe.replaceChildren();
  stats.replaceChildren();
  cles.forEach((cle) => {
    const ligne = element('div', 'arme-stat');
    const valeur = element('span', 'arme-stat-valeur');
    const barre = element('span', 'arme-stat-barre');
    const remplissage = element('span', 'arme-stat-remplissage');
    barre.append(remplissage);
    const dd = element('dd');
    dd.append(barre, valeur);
    ligne.append(element('dt', 'arme-stat-nom', t(`weapons.stats.${cle}`)), dd);
    stats.append(ligne);
    barres[cle] = { remplissage, valeur };
  });
  const boutons = ARMES.map((arme, i) => {
    const b = element('button', 'arme-bouton', t(`weapons.armes.${arme.id}.nom`));
    b.type = 'button';
    b.addEventListener('click', () => choisir(i));
    groupe.append(b);
    return b;
  });
  function choisir(i) {
    choix.arme = i;
    const arme = ARMES[i];
    boutons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    etiquette.textContent = `${t('weapons.zone')} — ${t('commun.aVenir')}`;
    detail.textContent = `${t(`weapons.armes.${arme.id}.nom`)} · ${t(`weapons.armes.${arme.id}.type`)}`;
    cles.forEach((cle) => {
      barres[cle].remplissage.style.setProperty('--valeur', String(arme.stats[cle] / 100));
      barres[cle].valeur.textContent = String(arme.stats[cle]);
    });
  }
  choisir(choix.arme);
}

function construireCredits() {
  const dl = document.getElementById('about-credits');
  dl.replaceChildren();
  t('about.credits').forEach((c) => {
    const ligne = element('div', 'about-credit');
    ligne.append(element('dt', 'about-credit-titre', c.titre), element('dd', 'about-credit-noms', c.noms.join(', ')));
    dl.append(ligne);
  });
}

// ---------- Menus de langue (globe de l'accueil et globe de l'en-tête) ----------

const menusLangue = [...document.querySelectorAll('.langue')].map((bloc) => ({
  bloc,
  bouton: bloc.querySelector('.langue-bouton'),
  menu: bloc.querySelector('.langue-menu'),
  choix: [...bloc.querySelectorAll('.langue-choix')],
}));
const menuOuvert = () => menusLangue.find((m) => !m.menu.hidden) ?? null;

function ouvrirMenuLangue(m, ouvrir) {
  m.menu.hidden = !ouvrir;
  m.bouton.setAttribute('aria-expanded', String(ouvrir));
  if (ouvrir) (m.choix.find((b) => b.dataset.langue === langue()) ?? m.choix[0]).focus();
}
const fermerMenusLangue = () => menusLangue.forEach((m) => { if (!m.menu.hidden) ouvrirMenuLangue(m, false); });

menusLangue.forEach((m) => {
  m.bouton.addEventListener('click', () => {
    const ouvrir = m.menu.hidden;
    fermerMenusLangue();
    ouvrirMenuLangue(m, ouvrir);
  });
  m.choix.forEach((b) => {
    b.addEventListener('click', () => {
      changerLangue(b.dataset.langue);
      rendre();
      ouvrirMenuLangue(m, false);
      m.bouton.focus();
    });
  });
});
document.addEventListener('click', (e) => {
  const m = menuOuvert();
  if (m && !m.bloc.contains(e.target)) ouvrirMenuLangue(m, false);
});

function majLangue() {
  menusLangue.forEach((m) => {
    m.bloc.querySelector('.langue-code').textContent = langue().toUpperCase();
    m.choix.forEach((b) => b.setAttribute('aria-current', String(b.dataset.langue === langue())));
  });
}

// ---------- Rendu des textes ----------

function rendre() {
  appliquerTextes();
  poserLogo(document.querySelector('.accueil-titre'), t('accueil.titre'));
  // Logo du jeu dans l'en-tête : remonte à l'accueil ; garde son nom accessible.
  const logo = document.querySelector('.entete-logo');
  poserLogo(logo, t('accueil.titre'));
  logo.setAttribute('aria-label', t('commun.accueilAria'));
  construireNews();
  construirePersonnages();
  construireArmes();
  construireCredits();
  majLangue();
}

rendre();

// ---------- About us : logo animé du studio (sans son), rejoué à chaque arrivée sur la section ----------
// L'animation (CSS dans le SVG) ne repart que si l'image est rechargée : chaque arrivée lui donne donc une
// adresse neuve (Blob). Mouvement réduit : logo fixe. Tant que l'animation n'est pas chargée : logo fixe.
const logoAbout = document.querySelector('.about-logo');
const SRC_LOGO_FIXE = logoAbout.getAttribute('src');
let svgAnime = null;
let urlAnime = null;
let lectures = 0;

function chargerLogoAnime() {
  svgAnime ??= fetch('img/no-way-studio-anime.svg')
    .then((r) => (r.ok ? r.text() : ''))
    .catch(() => '');
  return svgAnime;
}

async function jouerLogoStudio() {
  if (mouvementReduit()) { logoAbout.src = SRC_LOGO_FIXE; return; }
  const texte = await chargerLogoAnime();
  if (!texte) return;
  const ancienne = urlAnime;
  urlAnime = URL.createObjectURL(new Blob([texte], { type: 'image/svg+xml' }));
  logoAbout.src = urlAnime;
  logoAbout.dataset.lectures = String(++lectures);
  if (ancienne) URL.revokeObjectURL(ancienne);
}

let dansAbout = false;
// Joué quand About us occupe 30 % de l'écran ; prêt à rejouer une fois la section sortie (moins de 5 % visible :
// une section collée au bord de l'écran compte encore comme « en intersection », avec une surface nulle).
new IntersectionObserver(([e]) => {
  if (e.intersectionRatio >= 0.3 && !dansAbout) { dansAbout = true; jouerLogoStudio(); }
  else if (e.intersectionRatio < 0.05) dansAbout = false;
}, { root: conteneur, threshold: [0, 0.05, 0.3] }).observe(document.getElementById('about'));
chargerLogoAnime();

// ---------- Section affichée : navigation + apparition ----------

let indexActif = -1;

function activer(index) {
  if (index === indexActif || index < 0) return;
  indexActif = index;
  const id = sections[index].id;
  liens.forEach((a) => {
    if (a.dataset.section === id) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
  document.body.dataset.section = id;
  fermerMenusLangue();
  // Adresse partageable : #news, #weapons… ; rien pour l'accueil.
  const voulu = id === 'accueil' ? '' : `#${id}`;
  if (window.location.hash !== voulu) history.replaceState(null, '', `${window.location.pathname}${window.location.search}${voulu}`);
}

// Une section est « affichée » quand elle occupe plus de la moitié du conteneur.
const observateur = new IntersectionObserver((entrees) => {
  entrees.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('est-visible');
      if (e.intersectionRatio >= 0.5) activer(sections.indexOf(e.target));
    }
  });
}, { root: conteneur, threshold: [0.15, 0.5] });
sections.forEach((s) => observateur.observe(s));

function allerA(index) {
  const i = Math.max(0, Math.min(sections.length - 1, index));
  sections[i].scrollIntoView({ behavior: mouvementReduit() ? 'auto' : 'smooth', block: 'start' });
}

liens.forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    allerA(indexDe(a.dataset.section));
  });
});

// « En savoir plus » (et la flèche dessous) descend vers News ; le logo de l'en-tête remonte à l'accueil.
document.querySelectorAll('.accueil-entrer, .accueil-fleche').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  allerA(indexDe('news'));
}));
document.querySelector('.entete-logo').addEventListener('click', (e) => {
  e.preventDefault();
  allerA(indexDe('accueil'));
});

// Clavier : flèches, Page précédente / suivante, Début / Fin passent d'une section à l'autre.
// Menu de langue ouvert : flèches entre les langues, Échap le referme.
document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const m = menuOuvert();
  if (m) {
    if (e.key === 'Escape') { e.preventDefault(); ouvrirMenuLangue(m, false); m.bouton.focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = m.choix.indexOf(document.activeElement);
      m.choix[(i + (e.key === 'ArrowDown' ? 1 : -1) + m.choix.length) % m.choix.length].focus();
      return;
    }
  }
  const cible = e.target;
  if (cible instanceof HTMLElement && cible.closest('input, textarea, select, [contenteditable="true"]')) return;
  const actuel = Math.max(0, indexActif);
  const pas = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key];
  if (pas) { e.preventDefault(); allerA(actuel + pas); }
  else if (e.key === 'Home') { e.preventDefault(); allerA(0); }
  else if (e.key === 'End') { e.preventDefault(); allerA(sections.length - 1); }
});

// Arrivée avec une ancre (#weapons…) : aller directement à la section ; sinon l'accueil.
const depart = indexDe(window.location.hash.slice(1));
if (depart > 0) sections[depart].scrollIntoView({ behavior: 'auto', block: 'start' });
activer(Math.max(0, depart));

// Entrée en scène de l'accueil (js/accueil-entree.js) : seulement si la page s'ouvre sur l'accueil.
if (depart <= 0) lancerEntree(sections[0]);
// Flash du cadre de l'accueil au coup de feu de l'image animée (js/accueil-tir.js).
installerFlashTir(document.getElementById('accueil'));

document.body.classList.add('est-pret');
