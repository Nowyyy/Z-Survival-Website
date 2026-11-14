// Page principale : sections plein écran (News, Characters, Weapons) avec défilement par section
// (scroll-snap en CSS), navigation qui suit la section affichée, apparition du contenu à l'entrée
// de chaque section, et contenus provisoires générés depuis js/textes.js et js/donnees.js.
import { appliquerTextes, mouvementReduit, t } from './i18n.js';
import { ARMES, LIEN_JEU } from './donnees.js';

const conteneur = document.getElementById('sections');
const sections = [...document.querySelectorAll('.section')];
const liens = [...document.querySelectorAll('.nav-sections a[data-section]')];

function element(balise, classe, texte) {
  const el = document.createElement(balise);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

// ---------- Textes et contenus provisoires ----------

appliquerTextes();
document.title = t('meta.titrePrincipal');
document.querySelector('.bouton-jouer')?.setAttribute('href', LIEN_JEU);

function construireNews() {
  const liste = document.getElementById('news-liste');
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
    boutons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    etiquette.textContent = `${t('characters.zone')} — ${t('commun.aVenir')}`;
    detail.textContent = `${persos[i].nom} · ${persos[i].role}`;
  }
  choisir(0);
}

function construireArmes() {
  const choix = document.getElementById('arme-choix');
  const stats = document.getElementById('arme-stats');
  const etiquette = document.getElementById('arme-etiquette');
  const detail = document.getElementById('arme-detail');
  const cles = Object.keys(ARMES[0].stats);
  const barres = {};
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
    choix.append(b);
    return b;
  });
  function choisir(i) {
    const arme = ARMES[i];
    boutons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    etiquette.textContent = `${t('weapons.zone')} — ${t('commun.aVenir')}`;
    detail.textContent = `${t(`weapons.armes.${arme.id}.nom`)} · ${t(`weapons.armes.${arme.id}.type`)}`;
    cles.forEach((cle) => {
      barres[cle].remplissage.style.setProperty('--valeur', String(arme.stats[cle] / 100));
      barres[cle].valeur.textContent = String(arme.stats[cle]);
    });
  }
  choisir(0);
}

construireNews();
construirePersonnages();
construireArmes();

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
  if (window.location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
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
    allerA(sections.findIndex((s) => s.id === a.dataset.section));
  });
});

// Clavier : flèches, Page précédente / suivante, Début / Fin passent d'une section à l'autre.
document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const cible = e.target;
  if (cible instanceof HTMLElement && cible.closest('input, textarea, select, [contenteditable="true"]')) return;
  const actuel = Math.max(0, indexActif);
  const pas = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key];
  if (pas) { e.preventDefault(); allerA(actuel + pas); }
  else if (e.key === 'Home') { e.preventDefault(); allerA(0); }
  else if (e.key === 'End') { e.preventDefault(); allerA(sections.length - 1); }
});

// Arrivée avec une ancre (main.html#weapons) : aller directement à la section.
const depart = sections.findIndex((s) => `#${s.id}` === window.location.hash);
if (depart > 0) sections[depart].scrollIntoView({ behavior: 'auto', block: 'start' });
activer(Math.max(0, depart));

document.body.classList.add('est-pret');
