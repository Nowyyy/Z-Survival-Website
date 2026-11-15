// Partitions des trois propositions de musique du site (lot 1b), dans le thème de la musique du menu du jeu
// (Z-Survival, branche dev, data/menu/sons.json, variante C retenue : mi mineur, 96 à la noire ; voir Docs/ref/musique.md).
// Chaque partition donne UN tour (nombre entier de mesures) ; le moteur (moteur.mjs) le rend en boucle parfaite.
// Tout est déterministe : mêmes fichiers à chaque génération.
//
// Écriture : degrés en demi-tons au-dessus de la tonique (null : silence) ; instants en temps (noires) dans la mesure.
// Sections : comme dans le jeu, chacune donne le niveau (0 à 1) de chaque couche ; pendant sa première mesure, les niveaux glissent
// de ceux de la section précédente (la dernière précède la première : aucun à-coup au raccord).
import { frequenceMidi, graineDe, hasard } from './moteur.mjs';

// Construit les événements d'un tour à partir d'une description « à la manière du jeu ».
function composer(p) {
  const spb = 60 / p.bpm;
  const bar = p.temps * spb;
  const total = p.sections.reduce((n, s) => n + s.mesures, 0);
  const ev = [];
  // Place de chaque mesure dans les sections.
  const places = [];
  p.sections.forEach((s, index) => { for (let rang = 0; rang < s.mesures; rang += 1) places.push({ s, index, rang }); });
  const precedente = (index) => p.sections[(index - 1 + p.sections.length) % p.sections.length];
  const niveau = (m, u, c) => {
    const { s, index, rang } = places[m];
    const fin = s.niveaux[c] ?? 0;
    if (rang > 0) return fin;
    const debut = precedente(index).niveaux[c] ?? 0;
    return debut + (fin - debut) * Math.min(1, Math.max(0, u));
  };
  const C = p.couches;
  let numero = 0;
  // tn : instant (dans la mesure, en s) où le niveau est lu (notes longues : le milieu de la mesure).
  const pousser = (couche, m, t, e, tn = t) => {
    const g = e.gain * niveau(m, tn / bar, couche);
    if (g <= 0.001) return;
    numero += 1;
    ev.push({ ...e, t: m * bar + t, gain: g, graine: graineDe(p.id, 'evenement', numero) });
  };
  const choisir = (liste, k) => liste[((k % liste.length) + liste.length) % liste.length];

  for (let m = 0; m < total; m += 1) {
    const { s, rang } = places[m];
    const r = (cle) => hasard(graineDe(p.id, cle, m));
    // Pouls (battement de cœur).
    if (C.pouls && s.pouls) {
      const motif = C.pouls.motifs[choisir(s.pouls, rang)];
      for (const [temps, a] of motif) pousser('pouls', m, temps * spb, { voix: 'pouls', freq: C.pouls.f, gain: C.pouls.gain * a });
    }
    // Ostinato pincé.
    if (C.ostinato && s.ostinato) {
      const motif = C.ostinato.motifs[choisir(s.ostinato, rang)];
      const pas = motif.length === 16 ? 0.25 : motif.length === 8 ? 0.5 : 1;
      motif.forEach((deg, k) => {
        if (deg === null) return;
        const temps = k * pas;
        const accent = Number.isInteger(temps) ? 1 : 0.7;
        pousser('ostinato', m, temps * spb, {
          voix: 'pince', freq: frequenceMidi(p.tonique + C.ostinato.octave + deg), gain: C.ostinato.gain * accent * (pas < 0.5 ? 0.8 : 1),
          d: C.ostinato.d, pan: k % 2 ? 0.22 : -0.22,
        });
      });
    }
    // Nappe : un accord toutes les `mesures` mesures.
    if (C.nappe && s.accords && rang % C.nappe.mesures === 0) {
      const accord = choisir(s.accords, rang / C.nappe.mesures);
      for (const deg of accord) {
        pousser('nappe', m, 0, {
          voix: 'nappe', freq: frequenceMidi(p.tonique + C.nappe.octave + deg), gain: C.nappe.gain / Math.sqrt(accord.length),
          duree: C.nappe.mesures * bar * 1.1, coupure: C.nappe.coupure, tremolo: C.nappe.tremolo,
        }, bar * 0.5);
      }
    }
    // Cloche rare, sur un demi-temps tiré (graine fixe : la même à chaque tour).
    if (C.cloche) {
      const rc = r('cloche');
      if (rc.next() < C.cloche.proba) {
        const quand = Math.floor(rc.next() * p.temps * 2) * 0.5 * spb;
        const deg = C.cloche.notes[Math.floor(rc.next() * C.cloche.notes.length) % C.cloche.notes.length];
        pousser('cloche', m, quand, {
          voix: 'cloche', freq: frequenceMidi(p.tonique + C.cloche.octave + deg), gain: C.cloche.gain * (0.6 + 0.4 * rc.next()),
          d: C.cloche.d, pan: rc.signe() * 0.5,
        });
      }
    }
    // Mélodie (timbre de cloche) : phrases écrites, une liste de notes par mesure.
    if (C.melodie && s.melodie) {
      const notes = choisir(s.melodie, rang);
      notes.forEach(([deg, temps], k) => {
        pousser('melodie', m, temps * spb, {
          voix: 'cloche', freq: frequenceMidi(p.tonique + C.melodie.octave + deg), gain: C.melodie.gain, d: C.melodie.d,
          pan: k % 2 ? 0.18 : -0.12,
        });
      });
    }
    // Anneau de la mélodie de début de manche : figure de quatre coups, un par temps, toutes les deux mesures.
    if (C.anneau && s.anneau && rang % 2 === 0) {
      const figure = C.anneau.figures[choisir(s.anneau, rang / 2)];
      figure.forEach((deg, k) => {
        pousser('anneau', m, (k * p.temps * spb) / figure.length, {
          voix: 'anneau', freq: frequenceMidi(p.tonique + C.anneau.octave + deg), gain: C.anneau.gain, pan: -0.3 + 0.2 * k,
        });
      });
    }
    // Souffle : toutes les `mesures` mesures.
    if (C.souffle && rang % C.souffle.mesures === 0) {
      const rs = r('souffle');
      pousser('souffle', m, 0, {
        voix: 'souffle', duree: C.souffle.mesures * bar, freq: C.souffle.f[0] * (C.souffle.f[1] / C.souffle.f[0]) ** rs.next(), gain: C.souffle.gain,
      }, bar * 0.5);
    }
    // Tic : battue métallique tirée pas à pas.
    if (C.tic) {
      const rt = r('tic');
      for (let k = 0; k * C.tic.pas < p.temps; k += 1) {
        if (rt.next() < C.tic.proba) pousser('tic', m, k * C.tic.pas * spb, { voix: 'tic', gain: C.tic.gain * (0.6 + 0.4 * rt.next()), pan: rt.signe() * 0.6 });
      }
    }
  }
  // Houles et coups sourds (version horreur), placés à des mesures précises : la houle remplit les `longueur` mesures d'avant.
  for (const { mesure, longueur } of p.coups ?? []) {
    const debut = (mesure - longueur + total) % total;
    pousser('houle', debut, 0, { voix: 'houle', duree: longueur * bar, f0: 200, f1: 2500, gain: C.houle.gain });
    pousser('houle', mesure % total, 0.001, { voix: 'coup', freq: 55, freqFin: 45, gain: C.houle.coup });
  }
  // Plaintes (version horreur).
  for (const { mesure, temps, deg, longueur, glisse } of p.plaintes ?? []) {
    pousser('plainte', mesure, temps * spb, {
      voix: 'plainte', freq: frequenceMidi(p.tonique + deg), duree: longueur * spb, glisse, gain: C.plainte.gain, pan: 0.35,
    }, temps * spb);
  }
  return { id: p.id, duree: total * bar, mesures: total, bpm: p.bpm, evenements: ev, bourdon: p.bourdon, effets: p.effets, cible: p.cible };
}

// Bourdon du jeu : deux dents de scie désaccordées de ±6 cents (une à gauche, une à droite), triangle à la quinte, sinus à l'octave.
const bourdonJeu = (tonique, { gain, quinte, lp, respirations, mix = 1 }) => {
  const f0 = frequenceMidi(tonique);
  return {
    gain: gain * 0.5 * mix, lp, respirations,
    oscillateurs: [
      { forme: 'scie', f: f0 * 2 ** (-6 / 1200), gain: 1, pan: -0.6 },
      { forme: 'scie', f: f0 * 2 ** (6 / 1200), gain: 1, pan: 0.6 },
      { forme: 'triangle', f: f0 * 1.5, gain: quinte * 2, pan: 0 },
      { forme: 'sinus', f: f0 * 2 * 2 ** (3 / 1200), gain: 0.4, pan: 0 },
    ],
  };
};

// Motifs du pouls de la variante C du jeu.
const POULS_C = [[[0, 1], [1.5, 0.5], [2, 0.8]], [[0, 1], [0.75, 0.5], [2, 0.8], [3.5, 0.4]]];

// ---------- M1 : variation proche du menu ----------
// Mêmes timbres, tonalité (mi mineur), tempo (96) et forme que la variante C ; nouveaux motifs d'ostinato et une vraie mélodie
// (timbre de cloche, une octave sous les cloches du jeu) qui pose une phrase, puis sa réponse qui finit sur la tonique.
const M1 = composer({
  id: 'M1', bpm: 96, temps: 4, tonique: 40, cible: -18.5,
  bourdon: bourdonJeu(40, { gain: 0.45, quinte: 0.25, lp: [200, 520], respirations: 3, mix: 0.55 }),
  effets: { echo: { temps: 0.75 * (60 / 96), retour: 0.35, coupure: 1800, niveau: 0.25 }, reverb: { piece: 0.55, amorti: 0.5, niveau: 0.35 } },
  couches: {
    pouls: { f: 62, gain: 0.65, motifs: POULS_C },
    ostinato: {
      octave: 24, gain: 0.3, d: 0.16,
      motifs: [
        [0, 0, 7, 0, 3, 0, 1, 0], // 0 A1
        [0, 0, 7, 0, 6, 0, 3, 1], // 1 A2
        [0, 3, 7, 3, 10, 7, 3, 1], // 2 B1
        [0, 3, 7, 3, 12, 10, 6, 3], // 3 B2
        [0, 12, 0, 10, 0, 7, 0, 6], // 4 C1
        [0, 12, 0, 13, 0, 10, 7, 6], // 5 C2
        [0, null, null, 7, null, null, 6, null], // 6 respiration
        [0, null, 7, null, 3, null, 1, null], // 7 retour
      ],
    },
    nappe: { octave: 24, gain: 0.18, mesures: 2 },
    cloche: { octave: 36, gain: 0.18, proba: 0.3, d: 1.8, notes: [0, 3, 6, 7] },
    melodie: { octave: 24, gain: 0.26, d: 1.4 },
    souffle: { gain: 0.14, mesures: 2, f: [400, 1500] },
    tic: { gain: 0.1, pas: 0.5, proba: 0.7 },
  },
  sections: [
    { mesures: 4, niveaux: { pouls: 0.6, ostinato: 0.4, nappe: 0.5, cloche: 0.5, melodie: 0, souffle: 1, tic: 0.6 },
      pouls: [0], ostinato: [7], accords: [[0, 3, 7], [0, 1, 6]] },
    { mesures: 8, niveaux: { pouls: 1, ostinato: 0.8, nappe: 0, cloche: 0.3, melodie: 0, souffle: 0.4, tic: 1 },
      pouls: [0, 0, 0, 1], ostinato: [0, 0, 0, 1], accords: [[0, 3, 7]] },
    { mesures: 8, niveaux: { pouls: 1, ostinato: 1, nappe: 0.8, cloche: 0.2, melodie: 1, souffle: 0.5, tic: 1 },
      pouls: [0, 1], ostinato: [2, 2, 3, 2], accords: [[0, 3, 7], [0, 1, 6], [-1, 3, 6], [0, 3, 7]],
      melodie: [
        [[7, 0], [6, 1.5], [3, 2]],
        [[1, 0], [0, 2]],
        [[3, 0], [7, 1], [10, 2], [12, 3.5]],
        [[10, 0], [6, 1.5]],
      ] },
    { mesures: 4, niveaux: { pouls: 0, ostinato: 0.5, nappe: 1, cloche: 1, melodie: 0.7, souffle: 1, tic: 0 },
      pouls: [0], ostinato: [6], accords: [[0, 1, 7], [-2, 3, 8]],
      melodie: [[[13, 0], [12, 2]], [], [[10, 0], [7, 2]], []] },
    { mesures: 8, niveaux: { pouls: 1, ostinato: 1, nappe: 0.4, cloche: 0.2, melodie: 1, souffle: 0.4, tic: 0.8 },
      pouls: [1, 0, 1, 1], ostinato: [4, 4, 5, 4], accords: [[0, 3, 7], [0, 1, 6], [-2, 3, 8], [-1, 3, 6]],
      melodie: [
        [[12, 0], [10, 1.5], [7, 2]],
        [[6, 0], [7, 1], [3, 2]],
        [[1, 0], [3, 1.5], [0, 2]],
        [[-1, 0], [0, 2]],
      ] },
    { mesures: 4, niveaux: { pouls: 0.8, ostinato: 0.3, nappe: 0.7, cloche: 0.6, melodie: 0, souffle: 0.8, tic: 0.4 },
      pouls: [0], ostinato: [7], accords: [[0, 3, 7], [-1, 3, 6]] },
  ],
});

// ---------- M2 : version ambiante et discrète ----------
// Même tonalité, tempo de 60, presque sans rythme : bourdon plus sombre, nappes longues, cloches lentes, battement de cœur lointain,
// ostinato en noires seulement au milieu ; plus d'espace (réverbération), aucune battue métallique.
const M2 = composer({
  id: 'M2', bpm: 60, temps: 4, tonique: 40, cible: -20,
  bourdon: bourdonJeu(40, { gain: 0.5, quinte: 0.15, lp: [140, 340], respirations: 2, mix: 0.6 }),
  effets: { echo: { temps: 0.75, retour: 0.4, coupure: 1500, niveau: 0.3 }, reverb: { piece: 0.82, amorti: 0.55, niveau: 0.55 } },
  couches: {
    pouls: { f: 52, gain: 0.55, motifs: [[[0, 1]], [[0, 1], [0.6, 0.45]]] },
    ostinato: { octave: 24, gain: 0.24, d: 0.45, motifs: [[0, null, 7, null], [0, null, 3, null], [null, 7, null, 6], [0, 3, null, 1]] },
    nappe: { octave: 24, gain: 0.26, mesures: 2, coupure: 1100 },
    cloche: { octave: 36, gain: 0.2, proba: 0.45, d: 3, notes: [0, 1, 6, 7, 10] },
    melodie: { octave: 24, gain: 0.17, d: 2.5 },
    souffle: { gain: 0.2, mesures: 2, f: [250, 900] },
  },
  sections: [
    { mesures: 6, niveaux: { pouls: 0, ostinato: 0, nappe: 0.7, cloche: 0.7, melodie: 0, souffle: 1 },
      accords: [[0, 3, 7], [0, 1, 7], [0, 3, 7]] },
    { mesures: 6, niveaux: { pouls: 0.6, ostinato: 0, nappe: 1, cloche: 0.6, melodie: 0.8, souffle: 0.6 },
      pouls: [0, 0, 1], accords: [[0, 3, 7], [-2, 3, 8], [0, 1, 6]],
      melodie: [[[7, 0], [6, 2]], [[3, 0]], [[1, 0], [0, 2]], [], [[3, 0], [7, 2]], [[6, 0]]] },
    { mesures: 6, niveaux: { pouls: 0.7, ostinato: 0.7, nappe: 0.7, cloche: 0.4, melodie: 0.6, souffle: 0.5 },
      pouls: [1, 0], ostinato: [0, 1, 2, 3, 0, 2], accords: [[0, 3, 7], [0, 3, 6], [-1, 3, 6]],
      melodie: [[[12, 0]], [[10, 0], [7, 2]], [[6, 0]], [[3, 0], [1, 2]], [[0, 0]], []] },
    { mesures: 6, niveaux: { pouls: 0.2, ostinato: 0.2, nappe: 1, cloche: 0.8, melodie: 0, souffle: 0.9 },
      pouls: [0], ostinato: [2, 3], accords: [[0, 1, 7], [0, 3, 7], [0, 6, 13]] },
  ],
});

// ---------- M3 : version tendue, plus horreur (esprit de la mélodie de début de manche) ----------
// La (comme la mélodie de manche : bourdon de 55 et 55,8 Hz qui bat lentement), 100 à la noire (un temps = 0,6 s, l'écart des
// coups de cloche de la mélodie de manche) ; ses figures de quatre coups (la, si♭, mi, mi♭ et leurs variantes) reviennent comme un
// leitmotiv ; cœur qui bat plus vite, ostinato chromatique jusqu'aux doubles croches, nappe battue (trémolo), houles de bruit rose qui
// montent vers un coup sourd, plaintes qui glissent vers le bas. Légère saturation.
const M3 = composer({
  id: 'M3', bpm: 100, temps: 4, tonique: 33, cible: -18,
  bourdon: {
    gain: 0.19, lp: [180, 460], respirations: 4,
    oscillateurs: [
      { forme: 'scie', f: 55, gain: 1, pan: -0.5 },
      { forme: 'scie', f: 55.8, gain: 1, pan: 0.5 },
      { forme: 'sinus', f: 110, gain: 0.35, pan: 0 },
    ],
  },
  effets: { echo: { temps: 0.75 * 0.6, retour: 0.38, coupure: 1800, niveau: 0.25 }, reverb: { piece: 0.6, amorti: 0.45, niveau: 0.45 }, saturation: 1.6 },
  couches: {
    pouls: {
      f: 50, gain: 0.95,
      motifs: [
        [[0, 1], [0.4, 0.6], [2, 1], [2.4, 0.6]],
        [[0, 1], [0.4, 0.6], [1, 0.8], [1.4, 0.5], [2, 1], [2.4, 0.6], [3, 0.8], [3.4, 0.5]],
      ],
    },
    ostinato: {
      octave: 24, gain: 0.26, d: 0.14,
      motifs: [
        [0, 1, 0, 1, 0, 6, 0, 7], // 0
        [0, 1, 0, 6, 7, 6, 1, 0], // 1
        [0, 0, 1, 0, 0, 0, 6, 0, 0, 0, 7, 0, 6, 0, 1, 0], // 2 doubles croches
        [0, null, null, 1, null, null, 6, null], // 3 clairsemé
      ],
    },
    nappe: { octave: 12, gain: 0.22, mesures: 2, coupure: 900, tremolo: { f: 100 / 60 * 4, prof: 0.6 } },
    cloche: { octave: 36, gain: 0.14, proba: 0.2, d: 1.8, notes: [0, 1, 6] },
    anneau: { octave: 24, gain: 0.32, figures: [[0, 1, 7, 6], [-1, -2, 4, 5], [8, 7, 1, 2]] },
    souffle: { gain: 0.16, mesures: 2, f: [300, 1200] },
    tic: { gain: 0.09, pas: 0.25, proba: 0.45 },
    houle: { gain: 1, coup: 1.4 },
    plainte: { gain: 0.14 },
  },
  sections: [
    { mesures: 4, niveaux: { pouls: 0, ostinato: 0, nappe: 0.3, cloche: 0.5, anneau: 1, souffle: 1, tic: 0.4, houle: 0, plainte: 0 },
      accords: [[0, 1, 6]], anneau: [0, 1] },
    { mesures: 8, niveaux: { pouls: 1, ostinato: 0.8, nappe: 0, cloche: 0.3, anneau: 0.5, souffle: 0.4, tic: 0.8, houle: 1, plainte: 0 },
      pouls: [0], ostinato: [0, 0, 0, 1], accords: [[0, 1, 6]], anneau: [0, 1, 0, 2] },
    { mesures: 8, niveaux: { pouls: 1, ostinato: 1, nappe: 0.8, cloche: 0.2, anneau: 0.6, souffle: 0.5, tic: 1, houle: 1, plainte: 0.6 },
      pouls: [0, 0, 1, 0], ostinato: [0, 1, 0, 1], accords: [[0, 1, 6], [-1, 0, 6], [0, 1, 7], [1, 6, 7]], anneau: [2, 0, 1, 0] },
    { mesures: 4, niveaux: { pouls: 0, ostinato: 0.4, nappe: 1, cloche: 0.6, anneau: 1, souffle: 1, tic: 0, houle: 1, plainte: 1 },
      ostinato: [3], accords: [[0, 1, 6], [-2, 1, 6]], anneau: [1, 2] },
    { mesures: 12, niveaux: { pouls: 1, ostinato: 1, nappe: 0.6, cloche: 0.2, anneau: 0.7, souffle: 0.4, tic: 1, houle: 1, plainte: 0.6 },
      pouls: [1], ostinato: [1, 2, 1, 2], accords: [[0, 1, 6], [0, 1, 7], [-1, 0, 6], [1, 6, 7], [0, 6, 7], [0, 1, 6]], anneau: [0, 2, 1] },
    { mesures: 4, niveaux: { pouls: 0.5, ostinato: 0.3, nappe: 0.5, cloche: 0.5, anneau: 0.8, souffle: 0.9, tic: 0.3, houle: 0, plainte: 0 },
      pouls: [0], ostinato: [3], accords: [[0, 1, 6], [0, 6, 7]], anneau: [0, 1] },
  ],
  // Coups sourds : fins de phrase (la houle occupe les 2 mesures d'avant ; la dernière, plus longue).
  coups: [{ mesure: 12, longueur: 2 }, { mesure: 20, longueur: 2 }, { mesure: 24, longueur: 2 }, { mesure: 32, longueur: 2 }, { mesure: 36, longueur: 4 }],
  plaintes: [
    { mesure: 14, temps: 0, deg: 43, longueur: 8, glisse: -1 },
    { mesure: 21, temps: 0, deg: 42, longueur: 10, glisse: -2 },
    { mesure: 28, temps: 2, deg: 43, longueur: 8, glisse: -1 },
  ],
});

export const PIECES = {
  M1: { ...M1, nom: 'M1 — Variation du menu', description: 'Mêmes timbres, même tonalité (mi mineur) et même tempo (96) que la musique du menu du jeu, avec de nouveaux motifs et une mélodie de cloche.' },
  M2: { ...M2, nom: 'M2 — Ambiante', description: 'Version plus lente (60) et discrète, pensée comme fond sonore de navigation : nappes, cloches lointaines, battement de cœur sourd.' },
  M3: { ...M3, nom: 'M3 — Tension', description: 'Version plus tendue, côté horreur : figures de la mélodie de début de manche, cœur qui s’emballe, houles de bruit et coups sourds.' },
};
