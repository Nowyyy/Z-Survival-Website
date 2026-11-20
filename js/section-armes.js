// Lot 6a — Nouvelle section Armes : toutes les armes du jeu, une à la fois (grand visuel, nom, catégorie, description), statistiques
// en « Prochainement » (aucun chiffre), liste de miniatures pour passer de l'une à l'autre.
// Chargé SEULEMENT si l'interrupteur SECTION_ARMES_ACTIVE (js/donnees.js) est allumé, ou avec ?apercu=armes dans l'adresse
// (js/site.js, import dynamique) : interrupteur éteint, ni ce module, ni sa feuille de style (css/section-armes.css), ni les données
// (contenus/armes.json), ni les images (img/armes/) ne sont téléchargés, et la section reste l'encart « Prochainement ».
// Données : contenus/armes.json (noms, catégories, familles, ordre, chapitres, « prochainement », descriptions FR / EN : Docs/ref/armes.md) ;
// libellés fixes : weapons.* de js/textes.js.
// Retours du propriétaire (lot 6a) : familles plus fines qu'« Épaule » ; armes « prochainement » (lance-flammes, Panzerschreck) gardées
// secrètes jusqu'au bout : ni forme, ni nom, ni catégorie, ni description (« ? ? ? », « Arme à venir », grand encart « Prochainement »,
// miniature réduite à un « ? ») et leurs images ne sont jamais téléchargées ; nom en filigrane sur deux lignes au plus, rapetissé pour
// tenir dans le cadre ; noms qui passent à la ligne entre deux mots, jamais au milieu d'un mot ;
// chapitres (le chapitre 1 aujourd'hui) : un sélecteur dans l'en-tête de la section n'affiche que les armes du chapitre choisi.
// Visuels : img/armes/<id>.webp (1200 × 600) et <id>-mini.webp (320 × 160), fabriqués depuis les modèles 3D du jeu (outils/armes/).
// Aucun Three.js ici : seulement des images.
import { langue, mouvementReduit, t } from './i18n.js';

export const SOURCE_ARMES = 'contenus/armes.json';
const FEUILLE = 'css/section-armes.css';
// Ordre de référence des familles (la liste suit l'ordre où chaque famille apparaît dans les armes, rangées par « ordre »).
export const FAMILLES = ['poing', 'carabine', 'pompe', 'mitraillette', 'assaut', 'lourde', 'speciale'];
// Statistiques (0 à 100, réglées depuis la page d'administration). Masquées (statsVisibles faux, ou arme secrète) : barres décoratives,
// identiques pour toutes les armes (elles ne disent rien de l'arme), floutées sous l'encart « Prochainement ».
const STATS = ['degats', 'cadence', 'portee', 'chargeur'];
const BARRES_DECOR = [0.72, 0.48, 0.62, 0.38];
const statsAffichees = (a) => !a.prochainement && a.statsVisibles === true && a.stats && typeof a.stats === 'object'
  && STATS.some((c) => Number.isFinite(a.stats[c]));

const image = (id, mini = false) => `img/armes/${id}${mini ? '-mini' : ''}.webp`;
const deuxChiffres = (n) => String(n).padStart(2, '0');
const remplacer = (texte, valeurs) => texte.replace(/\{(\w+)\}/g, (_, k) => String(valeurs[k] ?? ''));
// Nom posé mot par mot : la ligne ne se coupe qu'entre deux mots (« Lance-flammes » reste entier, « M2 » passe dessous).
function poserNom(element, texte) {
  element.replaceChildren(...String(texte).split(/\s+/).filter(Boolean).flatMap((m, i) => {
    const mot = el('span', 'arsenal-mot', m);
    return i ? [document.createTextNode(' '), mot] : [mot];
  }));
}

function el(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte != null) e.textContent = texte;
  return e;
}

function chargerFeuille() {
  if (document.querySelector(`link[href="${FEUILLE}"]`)) return Promise.resolve();
  return new Promise((ok) => {
    const lien = document.createElement('link');
    lien.rel = 'stylesheet';
    lien.href = FEUILLE;
    lien.onload = ok;
    lien.onerror = ok;
    document.head.append(lien);
  });
}

// Armes lisibles, rangées : par famille (dans l'ordre où chaque famille apparaît), puis par « ordre ». Sans chapitre : chapitre 1.
export function lireArmes(json) {
  const liste = (Array.isArray(json?.armes) ? json.armes : [])
    .filter((a) => a && typeof a.id === 'string' && /^[a-z0-9-]+$/.test(a.id) && typeof a.nom === 'string')
    .map((a, i) => ({
      ...a,
      ordre: Number.isFinite(a.ordre) ? a.ordre : 1000 + i,
      famille: typeof a.famille === 'string' && /^[a-z0-9-]+$/.test(a.famille) ? a.famille : 'speciale',
      chapitres: Array.isArray(a.chapitres) && a.chapitres.some(Number.isInteger) ? a.chapitres.filter(Number.isInteger) : [1],
      prochainement: a.prochainement === true,
    }))
    .sort((a, b) => a.ordre - b.ordre);
  const familles = [...new Set(liste.map((a) => a.famille))];
  return liste.sort((a, b) => familles.indexOf(a.famille) - familles.indexOf(b.famille) || a.ordre - b.ordre);
}

// Chapitres : ceux de la liste « chapitres » du fichier (ordre du fichier, nom facultatif { fr, en }), plus ceux cités par les armes.
export function lireChapitres(json, armes) {
  const declares = (Array.isArray(json?.chapitres) ? json.chapitres : []).filter((c) => Number.isInteger(c?.id));
  const ids = [...new Set([...declares.map((c) => c.id), ...armes.flatMap((a) => a.chapitres)])];
  return ids.filter((id) => armes.some((a) => a.chapitres.includes(id))).map((id) => ({ id, nom: declares.find((c) => c.id === id)?.nom ?? null }));
}
// Largeur d'un mot dans la police des titres, en em (canvas ; avant le chargement de la police : 0,8 em par lettre, large).
let mesureur = null;
function largeurEm(mot) {
  const police = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'sans-serif';
  if (!document.fonts?.check(`100px ${police}`)) return mot.length * 0.8;
  mesureur ??= document.createElement('canvas').getContext('2d');
  mesureur.font = `100px ${police}`;
  return mesureur.measureText(mot).width / 100;
}
const nomChapitre = (c) => (c.nom && (langue() === 'en' ? c.nom.en || c.nom.fr : c.nom.fr || c.nom.en)) || remplacer(t('weapons.chapitre'), { n: c.id });

// Arme « prochainement » : textes neutres (weapons.mystere), rien qui permette de la reconnaître.
const nomDe = (a) => (a.prochainement ? t('weapons.mystere.nom') : langue() === 'en' && a.nomEn ? a.nomEn : a.nom);
const descriptionDe = (a) => (a.prochainement ? t('weapons.mystere.description')
  : (langue() === 'en' ? a.description?.en || a.description?.fr : a.description?.fr || a.description?.en) || '');
function libelle(groupe, cle) {
  const c = `weapons.${groupe}.${cle}`;
  const v = t(c);
  return v === c ? String(cle ?? '').replace(/-/g, ' ') : v;
}
const categorieDe = (a) => (a.prochainement ? t('weapons.mystere.categorie') : libelle('categories', a.categorie));

// Installe la section dans <section id="weapons"> ; renvoie { majLangue() } (textes à refaire au changement de langue).
export async function installerSectionArmes(section) {
  const interieur = section.querySelector('.section-interieur');
  section.classList.remove('est-a-venir');
  section.classList.add('section-arsenal');
  interieur.querySelectorAll(':scope > :not(.section-entete)').forEach((n) => n.remove());

  const corps = el('div', 'arsenal');
  corps.dataset.etat = 'chargement';
  interieur.append(corps);
  let toutes = [];
  let chapitres = [];
  try {
    const [r] = await Promise.all([fetch(SOURCE_ARMES, { cache: 'no-cache' }), chargerFeuille()]);
    if (!r.ok) throw new Error(String(r.status));
    const json = await r.json();
    toutes = lireArmes(json);
    chapitres = lireChapitres(json, toutes);
    if (!toutes.length) throw new Error('aucune arme');
  } catch {
    await chargerFeuille();
    corps.dataset.etat = 'erreur';
    const p = el('p', 'arsenal-erreur revele', t('weapons.erreur'));
    p.dataset.t = 'weapons.erreur';
    corps.append(p);
    return { majLangue() { p.textContent = t('weapons.erreur'); } };
  }
  corps.dataset.etat = 'pret';
  // Chapitre affiché : le dernier de la liste (le chapitre 1 aujourd'hui) ; armes = celles de ce chapitre.
  let chapitre = chapitres[chapitres.length - 1];
  let armes = toutes.filter((a) => a.chapitres.includes(chapitre.id));

  // --- Chapitres : sélecteur dans l'en-tête de la section (un seul chapitre aujourd'hui, prêt pour les suivants) ---
  const entete = interieur.querySelector('.section-entete');
  const choixChapitres = el('div', 'arsenal-chapitres');
  choixChapitres.setAttribute('role', 'group');
  const boutonsChapitres = chapitres.map((c) => {
    const b = el('button', 'arsenal-chapitre');
    b.type = 'button';
    b.dataset.chapitre = String(c.id);
    b.addEventListener('click', () => changerChapitre(c));
    choixChapitres.append(b);
    return b;
  });
  entete.append(choixChapitres);

  // --- Scène : grand visuel (nom en filigrane derrière, halo rouge), flèches posées sur ses bords ---
  const scene = el('div', 'arsenal-scene revele');
  scene.style.setProperty('--i', '1');
  const filigrane = el('span', 'arsenal-filigrane');
  filigrane.setAttribute('aria-hidden', 'true');
  const filigraneTexte = el('span', 'arsenal-filigrane-texte');
  filigrane.append(filigraneTexte);
  const cadre = el('div', 'arsenal-cadre');
  const visuel = el('img', 'arsenal-visuel');
  visuel.width = 1200;
  visuel.height = 600;
  visuel.decoding = 'async';
  visuel.loading = 'lazy';
  const tamponScene = el('span', 'arsenal-scene-tampon'); // armes « prochainement » : encart posé sur la silhouette
  tamponScene.setAttribute('aria-hidden', 'true');
  cadre.append(visuel, tamponScene);
  const fleches = [-1, 1].map((sens) => {
    const b = el('button', `news-fleche arsenal-fleche arsenal-fleche-${sens < 0 ? 'precedente' : 'suivante'}`);
    b.type = 'button';
    b.dataset.sens = String(sens);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${sens < 0 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}"/></svg>`;
    b.addEventListener('click', () => choisir(courant + sens, { focus: false }));
    return b;
  });
  scene.append(filigrane, cadre, ...fleches);

  // --- Carte d'infos : catégorie, nom, compteur, description ---
  const infos = el('div', 'arsenal-infos revele');
  infos.style.setProperty('--i', '2');
  const ligne = el('p', 'arsenal-ligne');
  const categorie = el('span', 'arsenal-categorie');
  const compteur = el('span', 'arsenal-compteur');
  compteur.setAttribute('aria-hidden', 'true');
  ligne.append(categorie, compteur);
  const nom = el('h3', 'arsenal-nom');
  const description = el('p', 'arsenal-description');
  const annonce = el('p', 'actu-cache');
  annonce.setAttribute('aria-live', 'polite');
  infos.append(ligne, nom, description, annonce);

  // --- Statistiques : barres floutées, sans aucun chiffre, sous l'encart « Prochainement » ---
  const stats = el('div', 'arsenal-stats revele');
  stats.style.setProperty('--i', '3');
  const statsTitre = el('p', 'arsenal-stats-titre');
  const grille = el('div', 'arsenal-stats-grille');
  grille.setAttribute('aria-hidden', 'true');
  const libelles = STATS.map((cle, i) => {
    const l = el('span', 'arsenal-stat-nom');
    const barre = el('span', 'arsenal-stat-barre');
    const remplissage = el('span', 'arsenal-stat-remplissage');
    remplissage.style.setProperty('--valeur', String(BARRES_DECOR[i]));
    barre.append(remplissage);
    const ligneStat = el('span', 'arsenal-stat');
    ligneStat.append(l, barre);
    grille.append(ligneStat);
    return { cle, l, remplissage, decor: BARRES_DECOR[i] };
  });
  const tampon = el('span', 'arsenal-stats-tampon');
  const statsCachees = el('span', 'actu-cache');
  stats.append(statsTitre, grille, tampon, statsCachees);

  const fiche = el('div', 'arsenal-fiche');
  fiche.append(infos, stats);

  // --- Miniatures, rangées par famille (refaites au changement de chapitre) ---
  const liste = el('div', 'arsenal-liste revele');
  liste.style.setProperty('--i', '4');
  let titresFamilles = [];
  let boutons = [];
  function construireListe() {
    liste.replaceChildren();
    titresFamilles = [];
    boutons = [];
    const familles = [...new Set(armes.map((a) => a.famille))];
    familles.forEach((f) => {
      const groupe = el('div', 'arsenal-groupe');
      const titre = el('span', 'arsenal-groupe-nom');
      titre.id = `arsenal-famille-${f}`;
      titresFamilles.push({ f, titre });
      const ul = el('ul', 'arsenal-groupe-armes');
      ul.setAttribute('aria-labelledby', titre.id);
      armes.forEach((a, i) => {
        if (a.famille !== f) return;
        const li = el('li');
        const b = el('button', 'arsenal-miniature');
        b.type = 'button';
        b.dataset.arme = a.id;
        if (a.prochainement) {
          // Arme à venir : juste un « ? » (ni image, ni nom).
          b.classList.add('est-prochainement');
          const mystere = el('span', 'arsenal-miniature-mystere', '?');
          mystere.setAttribute('aria-hidden', 'true');
          b.append(mystere);
        } else {
          const img = el('img', 'arsenal-miniature-image');
          img.src = image(a.id, true);
          img.alt = '';
          img.width = 320;
          img.height = 160;
          img.loading = 'lazy';
          img.decoding = 'async';
          b.append(img, el('span', 'arsenal-miniature-nom'));
        }
        b.addEventListener('click', () => choisir(i, { focus: false }));
        li.append(b);
        ul.append(li);
        boutons[i] = b;
      });
      groupe.append(titre, ul);
      liste.append(groupe);
    });
  }
  construireListe();
  corps.append(scene, fiche, liste);

  function changerChapitre(c) {
    if (c.id === chapitre.id) return;
    chapitre = c;
    armes = toutes.filter((a) => a.chapitres.includes(c.id));
    construireListe();
    courant = -1;
    choisir(0, { premiere: true });
    majLangue();
  }

  // Glisser du doigt sur le grand visuel : arme précédente / suivante (le défilement vertical des sections reste au navigateur).
  let depart = null;
  cadre.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') depart = { x: e.clientX, y: e.clientY }; });
  cadre.addEventListener('pointerup', (e) => {
    if (!depart) return;
    const dx = e.clientX - depart.x;
    const dy = e.clientY - depart.y;
    depart = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) choisir(courant + (dx < 0 ? 1 : -1), { focus: false });
  });
  cadre.addEventListener('pointercancel', () => { depart = null; });

  // Clavier : ← → changent d'arme quand la section Armes est affichée (les flèches ↑ ↓ restent au défilement des sections, js/site.js).
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    if (document.body.dataset.section !== 'weapons' || document.getElementById('actu-vue')?.open) return;
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"], .langue-menu')) return;
    e.preventDefault();
    const dansListe = liste.contains(document.activeElement);
    choisir(courant + (e.key === 'ArrowRight' ? 1 : -1), { focus: dansListe });
  });

  let courant = -1;
  let jeton = 0;
  // Fait défiler la liste (horizontalement seulement : jamais la page) pour montrer la miniature choisie.
  function montrerMiniature(b) {
    const lb = liste.getBoundingClientRect();
    const bb = b.getBoundingClientRect();
    const marge = 24;
    let dx = 0;
    if (bb.left < lb.left + marge) dx = bb.left - lb.left - marge;
    else if (bb.right > lb.right - marge) dx = bb.right - lb.right + marge;
    if (dx) liste.scrollBy({ left: dx, behavior: mouvementReduit() ? 'auto' : 'smooth' });
  }

  function textes() {
    const a = armes[courant];
    const n = nomDe(a);
    categorie.textContent = categorieDe(a);
    compteur.textContent = `${deuxChiffres(courant + 1)} / ${deuxChiffres(armes.length)}`;
    poserNom(nom, n);
    // Filigrane : deux lignes au plus, coupé entre deux mots ; sa taille (css/section-armes.css, unités du cadre) suit la largeur du mot le
    // plus long, mesurée dans la police des titres.
    const motsFiligrane = a.prochainement ? ['?'] : n.split(/\s+/);
    poserNom(filigraneTexte, motsFiligrane.join(' '));
    filigraneTexte.style.setProperty('--largeur-em', String(Math.max(...motsFiligrane.map(largeurEm)).toFixed(3)));
    description.textContent = descriptionDe(a);
    tamponScene.textContent = t('commun.comingSoon');
    // Statistiques : vraies barres si elles sont affichées, sinon barres décoratives sous « Prochainement ».
    const vraies = statsAffichees(a);
    corps.classList.toggle('stats-visibles', vraies);
    libelles.forEach(({ cle, remplissage, decor }) => {
      const v = vraies ? a.stats[cle] : null;
      remplissage.style.setProperty('--valeur', String(vraies ? (Number.isFinite(v) ? v / 100 : 0) : decor));
    });
    statsCachees.textContent = vraies
      ? STATS.filter((c) => Number.isFinite(a.stats[c])).map((c) => remplacer(t('weapons.statSur'), { nom: t(`weapons.stats.${c}`), n: a.stats[c] })).join(', ')
      : t('weapons.statsCachees');
    visuel.alt = a.prochainement ? '' : remplacer(t('weapons.visuelAlt'), { nom: n });
    annonce.textContent = `${remplacer(t('weapons.position'), { n: courant + 1, total: armes.length })} : ${n}, ${categorieDe(a)}${a.prochainement ? `, ${t('commun.comingSoon')}` : ''}`;
  }

  function choisir(i, { focus = false, premiere = false } = {}) {
    const j = (i + armes.length) % armes.length;
    if (j === courant && !premiere) return;
    const sens = courant < 0 ? 0 : Math.sign(i - courant) || 1;
    courant = j;
    const a = armes[j];
    boutons.forEach((b, k) => {
      b.setAttribute('aria-pressed', String(k === j));
      b.tabIndex = k === j ? 0 : -1;
    });
    corps.classList.toggle('est-prochainement', a.prochainement); // avant textes() : le filigrane se mesure avec sa taille
    textes();
    if (premiere) annonce.textContent = '';
    // Entrée animée sobre : l'image arrive du côté du changement, le texte remonte (rien en mouvement réduit).
    const n = ++jeton;
    corps.dataset.arme = a.id;
    corps.style.setProperty('--sens', String(sens));
    if (!premiere && !mouvementReduit()) {
      corps.classList.remove('arsenal-change');
      void corps.offsetWidth;
      corps.classList.add('arsenal-change');
    }
    if (a.prochainement) {
      visuel.removeAttribute('src'); // arme à venir : son image n'est jamais téléchargée
      visuel.hidden = true;
    } else {
      visuel.hidden = false;
      visuel.classList.add('arsenal-visuel-attente');
      visuel.onload = () => { if (n === jeton) visuel.classList.remove('arsenal-visuel-attente'); };
      visuel.src = image(a.id);
      if (visuel.complete) visuel.classList.remove('arsenal-visuel-attente');
    }
    montrerMiniature(boutons[j]);
    if (focus) boutons[j].focus({ preventScroll: true });
    // Les voisines se chargent en avance, une fois l'image affichée.
    if (!premiere) [j + 1, j - 1].map((k) => armes[(k + armes.length) % armes.length]).filter((v) => !v.prochainement).forEach((v) => { new Image().src = image(v.id); });
  }
  corps.addEventListener('animationend', (e) => { if (e.animationName === 'arsenal-entree-visuel') corps.classList.remove('arsenal-change'); });

  // Liste au clavier : flèches entre les miniatures (une seule miniature dans l'ordre de tabulation, celle de l'arme choisie).
  liste.addEventListener('keydown', (e) => {
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      choisir(e.key === 'Home' ? 0 : armes.length - 1, { focus: true });
    }
  });

  function majLangue() {
    statsTitre.textContent = t('weapons.statsTitre');
    tampon.textContent = t('commun.comingSoon');
    libelles.forEach(({ cle, l }) => { l.textContent = t(`weapons.stats.${cle}`); });
    titresFamilles.forEach(({ f, titre }) => { titre.textContent = libelle('familles', f); });
    choixChapitres.setAttribute('aria-label', t('weapons.chapitres'));
    boutonsChapitres.forEach((b, i) => {
      b.textContent = nomChapitre(chapitres[i]);
      b.setAttribute('aria-pressed', String(chapitres[i].id === chapitre.id));
    });
    liste.setAttribute('aria-label', t('weapons.liste2'));
    fleches[0].setAttribute('aria-label', t('weapons.precedente'));
    fleches[1].setAttribute('aria-label', t('weapons.suivante'));
    boutons.forEach((b, i) => {
      const a = armes[i];
      const n = b.querySelector('.arsenal-miniature-nom');
      if (n) poserNom(n, nomDe(a));
      b.setAttribute('aria-label', a.prochainement ? `${categorieDe(a)} — ${t('commun.comingSoon')}` : `${nomDe(a)} — ${categorieDe(a)}`);
    });
    textes();
    annonce.textContent = '';
  }

  choisir(0, { premiere: true });
  majLangue();
  // Police des titres chargée : la largeur du filigrane est remesurée.
  const police = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim();
  document.fonts?.load(`100px ${police}`).then(() => textes()).catch(() => {});
  return { majLangue };
}
