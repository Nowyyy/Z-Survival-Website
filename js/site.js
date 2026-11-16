// Page unique du site : accueil plein écran (vidéo en boucle de la scène, lot 2b), puis les sections News, Characters,
// Weapons et About us. Défilement qui s'arrête sur chaque section (scroll-snap en CSS), « En savoir plus » qui
// descend vers News (on peut remonter vers l'accueil), navigation qui suit la section affichée,
// apparition du contenu à l'entrée de chaque section, menus de langue (Français / English) sur l'accueil et dans l'en-tête.
import { appliquerTextes, changerLangue, langue, langueInitiale, mouvementReduit, t } from './i18n.js';
import { ARMES } from './donnees.js';
import { poserLogo } from './logo.js';
import { installerTir, suivreVideo } from './accueil-tir.js';
import { installerVideo } from './accueil-video.js';
import { lancerEntree } from './accueil-entree.js';
import { taperAccroche } from './accueil-accroche.js';
import { construireBandeau } from './accueil-bandeau.js';
import { ouvrirArticle, rendreActualites, slugDeLAdresse } from './actualites.js';
import { rendreAPropos } from './a-propos.js';
import { installerClipJeu } from './a-propos-clip.js';

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

// ---------- Contenus provisoires (reconstruits à chaque changement de langue) ; les actualités : js/actualites.js ----------

const choix = { perso: 0, arme: 0 };

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
  rendreActualites();
  construirePersonnages();
  construireArmes();
  rendreAPropos();
  construireBandeau();
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
installerClipJeu({ racine: conteneur }); // lot 4b : clip du jeu dans le bloc du jeu d’À propos

// ---------- À propos sur téléphone : carrousel horizontal (le jeu, puis le studio), comme les actualités ----------
// Position « 01 / 02 », barre de progression et flèches ; caché quand les deux blocs tiennent sans glisser (ordinateur).
(function carrouselAPropos() {
  const blocs = document.querySelector('.about-blocs');
  const nav = document.getElementById('about-carrousel');
  const position = document.getElementById('about-position');
  const total = document.getElementById('about-total');
  const barre = document.getElementById('about-progression-barre');
  const fleches = [...nav.querySelectorAll('.news-fleche')];
  const items = [...blocs.children];
  const deuxChiffres = (n) => String(n).padStart(2, '0');
  let demande = 0;
  const gauche = () => blocs.getBoundingClientRect().left + parseFloat(getComputedStyle(blocs).paddingLeft);
  function indexCourant() {
    if (blocs.scrollLeft >= blocs.scrollWidth - blocs.clientWidth - 2) return items.length - 1;
    const g = gauche();
    let meilleur = 0;
    items.forEach((c, i) => {
      if (Math.abs(c.getBoundingClientRect().left - g) < Math.abs(items[meilleur].getBoundingClientRect().left - g)) meilleur = i;
    });
    return meilleur;
  }
  function maj() {
    demande = 0;
    const utile = items.length > 1 && blocs.scrollWidth > blocs.clientWidth + 2;
    nav.hidden = !utile;
    if (!utile) return;
    const i = indexCourant();
    position.textContent = deuxChiffres(i + 1);
    total.textContent = deuxChiffres(items.length);
    barre.style.setProperty('--part', String((i + 1) / items.length));
    fleches[0].disabled = blocs.scrollLeft <= 2;
    fleches[1].disabled = blocs.scrollLeft >= blocs.scrollWidth - blocs.clientWidth - 2;
  }
  const demander = () => { if (!demande) demande = requestAnimationFrame(maj); };
  blocs.addEventListener('scroll', demander, { passive: true });
  window.addEventListener('resize', demander);
  new ResizeObserver(demander).observe(blocs);
  fleches.forEach((b) => b.addEventListener('click', () => {
    const cible = items[Math.max(0, Math.min(items.length - 1, indexCourant() + Number(b.dataset.sens)))];
    blocs.scrollBy({ left: cible.getBoundingClientRect().left - gauche(), behavior: mouvementReduit() ? 'auto' : 'smooth' });
  }));
  demander();
})();

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
  // Adresse partageable : #news, #weapons… ; rien pour l'accueil. Article ouvert (#actu/<slug>, js/actualites.js) : adresse gardée.
  const voulu = id === 'accueil' ? '' : `#${id}`;
  if (window.location.hash !== voulu && !slugDeLAdresse()) history.replaceState(null, '', `${window.location.pathname}${window.location.search}${voulu}`);
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

// Défile dans la section affichée, vers le bas (sens 1) ou le haut (-1), sans dépasser son bord ; faux s'il n'y a plus rien à défiler.
function defilerDansSection(sens, part) {
  const s = sections[Math.max(0, indexActif)];
  const b = s.getBoundingClientRect();
  const h = conteneur.clientHeight;
  const reste = sens > 0 ? b.bottom - h : -b.top;
  if (reste <= 2) return false;
  conteneur.scrollBy({ top: sens * Math.min(reste, Math.round(h * part)), behavior: mouvementReduit() ? 'auto' : 'smooth' });
  return true;
}

// ---------- Molette (ordinateur) : une section par geste, toujours dans le sens de la molette ----------
// Retour du propriétaire : la molette vers le haut ramenait parfois vers le bas. Avec l'aimantation stricte, un cran donné pendant que la
// page se cale encore sur une section (passage rapide de Personnages à Actualités, puis cran vers le haut pour l'accueil) faisait choisir au
// navigateur la section la plus proche, parfois celle d'en dessous. Le script prend donc la molette en main : un geste va à la section
// voisine dans son sens, comptée depuis la section visée si la page est encore en mouvement. Un geste = des crans rapprochés (ou l'élan
// d'un pavé tactile) fait un pas ; une molette tournée sans pause en refait un toutes les 450 ms environ, l'élan d'un pavé tactile non. Une section plus haute que l'écran est d'abord
// parcourue (comme au clavier). Molette horizontale (carrousels) et zoom (Ctrl) : laissés au navigateur.
const SEUIL_MOLETTE = 40; // px cumulés pour déclencher un pas (un cran de souris suffit ; quelques événements d'un pavé tactile)
const PAUSE_MOLETTE = 160; // ms sans molette : le geste suivant peut partir
const REPRISE_MOLETTE = 450; // ms : molette tournée sans pause, un nouveau pas (crans francs seulement, pas l'élan d'un pavé tactile)
const CRAN_FRANC = 50; // px : un cran de souris (l'élan d'un pavé tactile retombe vite sous ce seuil)
let dernierPasMolette = 0;
let cibleMolette = null; // section visée par le dernier pas, tant que la page bouge
let cumulMolette = 0;
let sensMolette = 0;
let verrouMolette = false;
let finGesteMolette = 0;
let finMouvement = 0;
function pasMolette(sens) {
  if (cibleMolette === null && defilerDansSection(sens, 0.6)) return;
  const depart = cibleMolette ?? Math.max(0, indexActif);
  const suivante = Math.max(0, Math.min(sections.length - 1, depart + sens));
  if (suivante === depart) return;
  cibleMolette = suivante;
  allerA(suivante);
  // Filet : si la page ne bouge pas (déjà sur place), la section visée est oubliée au bout d'une seconde.
  clearTimeout(finMouvement);
  finMouvement = setTimeout(() => { cibleMolette = null; }, 1000);
}
conteneur.addEventListener('wheel', (e) => {
  if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || !e.deltaY) return;
  if (document.getElementById('actu-vue').open) return;
  e.preventDefault();
  const sens = e.deltaY > 0 ? 1 : -1;
  const px = Math.abs(e.deltaY) * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? conteneur.clientHeight : 1);
  if (sens !== sensMolette) { sensMolette = sens; cumulMolette = 0; verrouMolette = false; }
  clearTimeout(finGesteMolette);
  finGesteMolette = setTimeout(() => { verrouMolette = false; cumulMolette = 0; }, PAUSE_MOLETTE);
  if (verrouMolette && !(px >= CRAN_FRANC && e.timeStamp - dernierPasMolette >= REPRISE_MOLETTE)) return;
  if (verrouMolette) cumulMolette = SEUIL_MOLETTE;
  cumulMolette += px;
  if (cumulMolette < SEUIL_MOLETTE) return;
  cumulMolette = 0;
  verrouMolette = true;
  dernierPasMolette = e.timeStamp;
  pasMolette(sens);
}, { passive: false });
// La page s'est arrêtée : la section visée est atteinte (ou le défilement a été repris autrement).
conteneur.addEventListener('scroll', () => {
  clearTimeout(finMouvement);
  finMouvement = setTimeout(() => { cibleMolette = null; }, 150);
}, { passive: true });

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
// Bouton vivant (css/accueil.css) : au toucher (téléphone), coup de pinceau et coulure, comme au survol sur ordinateur.
const boutonEntrer = document.querySelector('.accueil-entrer');
let toucheMinuteur = 0;
boutonEntrer.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || mouvementReduit()) return;
  boutonEntrer.classList.remove('est-touche');
  void boutonEntrer.offsetWidth;
  boutonEntrer.classList.add('est-touche');
  clearTimeout(toucheMinuteur);
  toucheMinuteur = setTimeout(() => boutonEntrer.classList.remove('est-touche'), 1200);
});
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
  // Article ouvert : les flèches font défiler l'article, pas les sections.
  if (document.getElementById('actu-vue').open) return;
  const actuel = Math.max(0, indexActif);
  const pas = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key];
  // Section plus haute que l'écran (À propos) : on la parcourt d'abord, puis on passe à la section voisine.
  if (pas && defilerDansSection(pas, e.key.startsWith('Page') ? 0.85 : 0.4)) { e.preventDefault(); return; }
  if (pas) { e.preventDefault(); allerA(actuel + pas); }
  else if (e.key === 'Home') { e.preventDefault(); allerA(0); }
  else if (e.key === 'End') { e.preventDefault(); allerA(sections.length - 1); }
});

// Arrivée avec une ancre (#weapons…) : aller directement à la section ; sinon l'accueil.
// Adresse d'un article (#actu/<slug>) : section Actualités, article ouvert par-dessus.
const slugDepart = slugDeLAdresse();
const depart = slugDepart ? indexDe('news') : indexDe(window.location.hash.slice(1));
if (depart > 0) sections[depart].scrollIntoView({ behavior: 'auto', block: 'start' });
activer(Math.max(0, depart));
if (slugDepart) ouvrirArticle(slugDepart, { pousser: false });

// Entrée en scène de l'accueil (js/accueil-entree.js) : première visite de la session, seulement si la page s'ouvre sur l'accueil.
// Accroche « radio de survie » (js/accueil-accroche.js) : elle s'écrit pendant l'entrée, de son apparition (0,65 s) à la fin (1,45 s) ;
// si le visiteur passe l'entrée, elle s'écrit d'un coup.
let finirAccroche = () => {};
const entree = lancerEntree(depart <= 0, () => finirAccroche());
if (entree) finirAccroche = taperAccroche(document.querySelector('.accueil-sous-titre'), 650, 800);
// Vidéo en boucle de l'accueil (js/accueil-video.js) et tir synchronisé : flash du cadre, coup de feu (js/accueil-tir.js).
const accueil = document.getElementById('accueil');
installerTir(accueil);
const video = installerVideo(accueil.querySelector('.accueil-video'), accueil);
if (video) suivreVideo(video);

document.body.classList.add('est-pret');
