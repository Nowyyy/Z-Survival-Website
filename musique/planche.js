// Planche d'écoute de la musique du site (lot 1b). Page de travail, en français, non reliée au site (noindex).
// Lecture par Web Audio (comme prévu au lot 2, Docs/ref/musique.md) : chaque MP3 est décodé une fois, puis joué en boucle sans blanc
// (AudioBufferSourceNode.loop, loopStart / loopEnd lus dans boucles.json). Un seul morceau joue à la fois.
// « Écouter le raccord » : les 5 dernières secondes de la boucle, le retour au début, puis 5 s du début, et arrêt en fondu.
// État pour les tests : window.__planche.etat().

const TEXTES = {
  surtitre: 'Z-Survival · lot 1b',
  titre: 'Planche d’écoute',
  provisoire: 'Page de travail provisoire, non reliée au site',
  intro: 'Trois propositions de musique pour le site, dans le thème de la musique du menu du jeu. Chacune tourne en boucle. M2 a été retenue pour le site (intégration au lot 2).',
  conseils: [
    'Casque ou écouteurs conseillés : les basses ne passent pas dans le haut-parleur d’un téléphone.',
    '« Écouter le raccord » joue les 5 dernières secondes, puis enchaîne sur le début : on ne doit entendre ni blanc ni saut.',
    'Un seul morceau joue à la fois ; Pause garde la position.',
  ],
  pied: 'Musique générée par du code (outils/musique/ du dépôt), fichiers MP3 dans musique/. Aucune musique n’est encore jouée sur le site : l’intégration se fera au lot 2.',
  retenu: 'Retenue',
  lecture: 'Lecture',
  pause: 'Pause',
  raccord: 'Écouter le raccord',
  chargement: 'Chargement…',
  infos: (m) => `Boucle de ${duree(m.dureeBoucle)} · ${m.mesures} mesures à ${m.bpm} à la noire · MP3 ${(m.octets / 1048576).toFixed(2).replace('.', ',')} Mo`,
  tour: (n) => `tour ${n}`,
  avantRaccord: (s) => `Fin de la boucle : retour au début dans ${s} s…`,
  apresRaccord: 'Retour au début : raccord passé.',
  finRaccord: 'Fin de l’essai du raccord.',
  enPause: 'En pause.',
  erreurChargement: (nom) => `Impossible de charger ${nom}.`,
  erreurAudio: 'Ce navigateur ne permet pas la lecture Web Audio.',
  erreurListe: 'Impossible de lire la liste des morceaux (boucles.json).',
};

const RACCORD_AVANT = 5;
const RACCORD_APRES = 5;
const FONDU = 0.04;

const duree = (s) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`;
const horloge = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const ICONES = {
  lecture: '<svg class="bouton-icone" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>',
  pause: '<svg class="bouton-icone" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>',
  raccord: '<svg class="bouton-icone" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2a6 6 0 1 0 6 6h-2a4 4 0 1 1-4-4v2.5L11.5 3 8 0z"/></svg>',
};

let ctx = null;
let morceaux = {};
const cartes = new Map(); // id → { el, boutonLecture, boutonRaccord, barre, temps, statut, position }
const tampons = new Map(); // id → Promise<AudioBuffer>
let courant = null; // { id, source, gain, departCtx, departPos, mode, arret }
let image = 0;

function remplirTextes() {
  for (const el of document.querySelectorAll('[data-texte]')) el.textContent = TEXTES[el.dataset.texte];
  for (const el of document.querySelectorAll('[data-liste]')) {
    for (const t of TEXTES[el.dataset.liste]) {
      const li = document.createElement('li');
      li.textContent = t;
      el.append(li);
    }
  }
}

function montrerErreur(texte) {
  const el = document.getElementById('erreur');
  el.textContent = texte;
  el.hidden = false;
}

// Contexte audio : créé et relancé dans le geste (exigence de Safari iOS). Sur iPhone, `playback` fait entendre la planche même
// commutateur silencieux enclenché (Safari 17 et plus).
function contexte() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error(TEXTES.erreurAudio);
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* sans effet */ }
    ctx = new AC();
  }
  if (ctx.state !== 'running') ctx.resume();
  return ctx;
}

function charger(id) {
  if (!tampons.has(id)) {
    const m = morceaux[id];
    const p = fetch(m.fichier)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.arrayBuffer();
      })
      .then((octets) => new Promise((ok, ko) => { ctx.decodeAudioData(octets, ok, ko); }));
    p.catch(() => tampons.delete(id));
    tampons.set(id, p);
  }
  return tampons.get(id);
}

// Position dans le fichier (s), ramenée dans la boucle ; et numéro du tour.
function positionCourante() {
  if (!courant || !courant.source) return null;
  const m = morceaux[courant.id];
  const L = m.finBoucle - m.debutBoucle;
  let pos = courant.departPos + (ctx.currentTime - courant.departCtx);
  let tours = 0;
  if (pos >= m.finBoucle) {
    tours = Math.floor((pos - m.debutBoucle) / L);
    pos = m.debutBoucle + ((pos - m.debutBoucle) % L);
  }
  return { pos, tours };
}

function arreterCourant({ garder = true } = {}) {
  if (!courant) return;
  const { id, source, gain } = courant;
  const carte = cartes.get(id);
  const p = positionCourante();
  if (garder && p && courant.mode === 'lecture') carte.position = p.pos;
  if (courant.mode === 'raccord') carte.position = null;
  carte.statut.textContent = courant.mode === 'raccord' ? (courant.source ? TEXTES.finRaccord : '') : (carte.position != null ? TEXTES.enPause : '');
  if (source) {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + FONDU);
    source.stop(t + FONDU + 0.01);
  }
  courant = null;
  majCarte(id, 'pause');
}

async function jouer(id, mode) {
  let c;
  try { c = contexte(); } catch (e) { montrerErreur(e.message); return; }
  const deja = courant && courant.id === id && courant.mode === mode;
  arreterCourant();
  if (deja && mode === 'lecture') return; // second clic sur Lecture : pause
  const m = morceaux[id];
  const carte = cartes.get(id);
  const jeton = {};
  courant = { id, mode, source: null, jeton };
  majCarte(id, 'chargement');
  let tampon;
  try {
    tampon = await charger(id);
  } catch {
    if (courant?.jeton === jeton) courant = null;
    majCarte(id, 'pause');
    montrerErreur(TEXTES.erreurChargement(m.fichier));
    return;
  }
  if (courant?.jeton !== jeton) return; // un autre morceau a été demandé pendant le chargement
  const source = c.createBufferSource();
  source.buffer = tampon;
  source.loop = true;
  source.loopStart = m.debutBoucle;
  source.loopEnd = m.finBoucle;
  const gain = c.createGain();
  source.connect(gain).connect(c.destination);
  const depart = mode === 'raccord' ? m.finBoucle - RACCORD_AVANT : (carte.position ?? m.debutBoucle);
  const t = c.currentTime + 0.02;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(1, t + FONDU);
  source.start(t, depart);
  Object.assign(courant, { source, gain, departCtx: t, departPos: depart });
  if (mode === 'raccord') courant.arret = t + RACCORD_AVANT + RACCORD_APRES;
  majCarte(id, mode);
  boucleAffichage();
}

function majCarte(id, etat) {
  const carte = cartes.get(id);
  carte.el.dataset.etat = etat;
  const joue = etat === 'lecture';
  carte.boutonLecture.innerHTML = `${joue ? ICONES.pause : ICONES.lecture}<span>${joue ? TEXTES.pause : TEXTES.lecture}</span>`;
  carte.boutonLecture.setAttribute('aria-pressed', String(joue));
  carte.boutonRaccord.setAttribute('aria-pressed', String(etat === 'raccord'));
  carte.boutonLecture.disabled = etat === 'chargement';
  carte.boutonRaccord.disabled = etat === 'chargement';
  if (etat === 'chargement') carte.statut.textContent = TEXTES.chargement;
  else if (etat === 'lecture') carte.statut.textContent = '';
  afficherPosition(id);
}

function afficherPosition(id) {
  const carte = cartes.get(id);
  const m = morceaux[id];
  const L = m.finBoucle - m.debutBoucle;
  let pos = carte.position ?? m.debutBoucle;
  let tours = 0;
  if (courant?.id === id && courant.source) ({ pos, tours } = positionCourante());
  const dans = Math.min(L, Math.max(0, pos - m.debutBoucle));
  carte.barreRemplie.style.width = `${(dans / L) * 100}%`;
  carte.barre.setAttribute('aria-valuenow', String(Math.round(dans)));
  carte.temps.textContent = `${horloge(dans)} / ${horloge(L)}`;
  carte.tours.textContent = courant?.id === id && courant.source ? TEXTES.tour(tours + 1) : '';
}

function boucleAffichage() {
  cancelAnimationFrame(image);
  const pas = () => {
    if (!courant || !courant.source) return;
    const { id, mode } = courant;
    const carte = cartes.get(id);
    if (mode === 'raccord') {
      const m = morceaux[id];
      const reste = m.finBoucle - (courant.departPos + (ctx.currentTime - courant.departCtx));
      const texte = reste > 0 ? TEXTES.avantRaccord(Math.ceil(reste)) : TEXTES.apresRaccord;
      if (carte.statut.textContent !== texte) carte.statut.textContent = texte;
      if (ctx.currentTime >= courant.arret) {
        arreterCourant();
        return;
      }
    }
    afficherPosition(id);
    image = requestAnimationFrame(pas);
  };
  image = requestAnimationFrame(pas);
}

function creerCarte(id, m) {
  const el = document.createElement('article');
  el.className = 'morceau';
  el.id = `morceau-${id}`;
  el.dataset.etat = 'pause';
  const [code, ...reste] = m.nom.split(' — ');
  el.innerHTML = `
    <div class="morceau-tete"><span class="morceau-code"></span><h2 class="morceau-nom"></h2></div>
    <p class="morceau-description"></p>
    <p class="morceau-infos"></p>
    <div class="morceau-boutons">
      <button type="button" class="bouton bouton-principal" data-action="lecture" aria-pressed="false"></button>
      <button type="button" class="bouton bouton-secondaire" data-action="raccord" aria-pressed="false">${ICONES.raccord}<span></span></button>
    </div>
    <div class="morceau-barre" role="progressbar" aria-valuemin="0"><div class="morceau-barre-remplie"></div></div>
    <div class="morceau-ligne"><span class="morceau-temps"></span><span class="morceau-tours"></span></div>
    <p class="morceau-statut" aria-live="polite"></p>`;
  el.querySelector('.morceau-code').textContent = code;
  if (m.retenu) {
    el.dataset.retenu = '1';
    const marque = document.createElement('span');
    marque.className = 'morceau-retenu';
    marque.textContent = TEXTES.retenu;
    el.querySelector('.morceau-tete').append(marque);
  }
  el.querySelector('.morceau-nom').textContent = reste.join(' — ') || m.nom;
  el.querySelector('.morceau-description').textContent = m.description;
  el.querySelector('.morceau-infos').textContent = TEXTES.infos(m);
  el.querySelector('[data-action="raccord"] span').textContent = TEXTES.raccord;
  const barre = el.querySelector('.morceau-barre');
  barre.setAttribute('aria-valuemax', String(Math.round(m.dureeBoucle)));
  barre.setAttribute('aria-label', `${code} : position dans la boucle`);
  const carte = {
    el, barre, barreRemplie: el.querySelector('.morceau-barre-remplie'),
    boutonLecture: el.querySelector('[data-action="lecture"]'), boutonRaccord: el.querySelector('[data-action="raccord"]'),
    temps: el.querySelector('.morceau-temps'), tours: el.querySelector('.morceau-tours'), statut: el.querySelector('.morceau-statut'),
    position: null,
  };
  carte.boutonLecture.setAttribute('aria-label', `${TEXTES.lecture} / ${TEXTES.pause} : ${code}`);
  carte.boutonRaccord.setAttribute('aria-label', `${TEXTES.raccord} : ${code}`);
  carte.boutonLecture.addEventListener('click', () => jouer(id, 'lecture'));
  carte.boutonRaccord.addEventListener('click', () => jouer(id, 'raccord'));
  cartes.set(id, carte);
  majCarte(id, 'pause');
  return el;
}

async function demarrer() {
  remplirTextes();
  try {
    const r = await fetch('boucles.json');
    if (!r.ok) throw new Error(String(r.status));
    morceaux = (await r.json()).morceaux;
  } catch {
    montrerErreur(TEXTES.erreurListe);
    return;
  }
  const liste = document.getElementById('morceaux');
  for (const [id, m] of Object.entries(morceaux)) liste.append(creerCarte(id, m));
  document.documentElement.dataset.pret = '1';
  // Onglet caché : pause (la position est gardée).
  document.addEventListener('visibilitychange', () => { if (document.hidden) arreterCourant(); });
}

window.__planche = {
  etat: () => ({
    contexte: ctx?.state ?? null,
    courant: courant ? { id: courant.id, mode: courant.mode, pret: Boolean(courant.source), ...(courant.source ? positionCourante() : {}) } : null,
    charges: [...tampons.keys()],
  }),
};

demarrer();
