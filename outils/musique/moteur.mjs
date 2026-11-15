// Moteur de synthèse hors ligne de la musique du site (lot 1b). Aucune dépendance : Node seul.
// Reprend les timbres de la musique du menu du jeu (Z-Survival, branche dev, js/menu/sons/musique.js : bourdon, pouls, ostinato pincé,
// nappe, cloche, souffle, tic, écho) et ceux de la mélodie de début de manche (data/game/sounds.json, « vague-annonce » : anneau de
// cloche, houle de bruit rose, coup sourd), recalculés échantillon par échantillon, en stéréo.
//
// Boucle parfaite (sans blanc ni saut) :
// - une partition donne les événements d'UN tour (durée L, nombre entier de mesures) ; le même tour est rejoué trois fois de suite ;
// - les sons continus (bourdon) ont une fréquence arrondie à un nombre entier de périodes par tour, et leur phase se calcule à partir
//   de l'indice de l'échantillon modulo le tour (exacte, sans dérive) ; leurs modulations ont une période qui divise le tour ;
// - le bruit de chaque événement est tiré d'une graine propre à l'événement (identique d'un tour à l'autre) ;
// - les effets à mémoire (écho, réverbération, filtres, limiteur) tournent sur tout le rendu : passé le premier tour, la sortie est
//   périodique. Le fichier final est découpé dans le deuxième tour, avec une marge d'une seconde de chaque côté.

export const SR = 44100;
export const frequenceMidi = (m) => 440 * 2 ** ((m - 69) / 12);
const DEUX_PI = 2 * Math.PI;

// ---------- Hasard à graine (mêmes fonctions que js/core/musique-menu.js du jeu : FNV-1a et mulberry32) ----------
export function graineDe(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    h = Math.imul(h ^ 0x2f, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
export function hasard(graine) {
  let s = graine >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, signe: () => next() * 2 - 1 };
}

// ---------- Filtre biquadratique (formules RBJ) ----------
export class Biquad {
  constructor(type, f, q = 0.707) {
    this.type = type;
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
    this.regler(f, q);
  }
  regler(f, q = this.q) {
    this.q = q;
    const w = (DEUX_PI * Math.min(Math.max(f, 10), SR * 0.45)) / SR;
    const cw = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    let b0; let b1; let b2;
    if (this.type === 'passe-bas') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
    else if (this.type === 'passe-haut') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; } // passe-bande, gain de 0 dB au sommet
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * cw) / a0; this.a2 = (1 - a) / a0;
  }
  pas(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// ---------- Formes d'onde ----------
// Dent de scie à bande limitée (polyBLEP), phase dans [0, 1[, dt = incrément de phase par échantillon.
function blep(ph, dt) {
  if (ph < dt) { const x = ph / dt; return x + x - x * x - 1; }
  if (ph > 1 - dt) { const x = (ph - 1) / dt; return x * x + x + x + 1; }
  return 0;
}
const scie = (ph, dt) => 2 * ph - 1 - blep(ph, dt);
const triangle = (ph) => 4 * Math.abs(ph - 0.5) - 1;

// Bruit blanc à graine, et bruit rose (filtre de Paul Kellet).
function bruitBlanc(n, graine) {
  const r = hasard(graine);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i += 1) x[i] = r.signe();
  return x;
}
function bruitRose(n, graine) {
  const w = bruitBlanc(n, graine);
  let b0 = 0; let b1 = 0; let b2 = 0; let b3 = 0; let b4 = 0; let b5 = 0; let b6 = 0;
  for (let i = 0; i < n; i += 1) {
    const x = w[i];
    b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
    w[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
    b6 = x * 0.115926;
  }
  return w;
}

// Enveloppe « Web Audio » du jeu : montée exponentielle de 0,0001 au pic en `attaque`, puis descente exponentielle vers 0,0001 à `fin`.
function envExp(t, pic, attaque, fin) {
  if (t < attaque) return 1e-4 * (pic / 1e-4) ** (t / attaque);
  if (t >= fin) return 0;
  return pic * (1e-4 / pic) ** ((t - attaque) / Math.max(1e-4, fin - attaque));
}
// Panoramique à puissance constante (p de -1, gauche, à 1, droite).
export function panoramique(p) {
  const a = ((Math.max(-1, Math.min(1, p)) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

// ---------- Voix : chacune rend un son stéréo [G, D] (Float32Array) à partir de son instant de départ ----------
function mono(n, f) {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i += 1) x[i] = f(i / SR, i);
  return x;
}
function enStereo(x, pan) {
  const [g, d] = panoramique(pan ?? 0);
  const G = new Float32Array(x.length); const D = new Float32Array(x.length);
  for (let i = 0; i < x.length; i += 1) { G[i] = x[i] * g; D[i] = x[i] * d; }
  return [G, D];
}

const VOIX = {
  // Battement de cœur grave (pouls du jeu) : sinus à chute de hauteur, doublé d'un triangle à l'octave.
  pouls(e) {
    const dur = e.duree ?? 0.3;
    const n = Math.round((dur + 0.02) * SR);
    let ph1 = 0; let ph2 = 0;
    const x = mono(n, (t) => {
      const f1 = e.freq * 3.2 * (1 / 3.2) ** Math.min(1, t / 0.05);
      const f2 = e.freq * 6 * (1 / 3) ** Math.min(1, t / 0.04);
      ph1 = (ph1 + f1 / SR) % 1; ph2 = (ph2 + f2 / SR) % 1;
      return (Math.sin(DEUX_PI * ph1) + 0.35 * triangle(ph2)) * envExp(t, e.gain, 0.005, dur);
    });
    return enStereo(x, e.pan);
  },
  // Ostinato pincé : triangle dans un passe-bas qui se referme.
  pince(e) {
    const dur = e.d * 4;
    const n = Math.round((dur + 0.02) * SR);
    const f = new Biquad('passe-bas', Math.min(8000, e.freq * 5), 0.8);
    const fa = Math.min(8000, e.freq * 5); const fb = Math.max(200, e.freq * 1.3); const tf = Math.max(0.05, e.d * 2);
    const x = mono(n, (t, i) => {
      if (i % 16 === 0) f.regler(fa * (fb / fa) ** Math.min(1, t / tf));
      return f.pas(triangle((e.freq * t) % 1)) * envExp(t, e.gain, 0.004, dur);
    });
    return enStereo(x, e.pan);
  },
  // Nappe : deux dents de scie désaccordées (±7 cents, une à gauche, une à droite), passe-bas, fondu d'entrée et de sortie.
  // tremolo (facultatif) : { f (Hz), prof (0 à 1) } : amplitude battue (version horreur).
  nappe(e) {
    const dur = e.duree;
    const n = Math.round(dur * SR);
    const fc = Math.min(e.coupure ?? 1400, e.freq * 4);
    const out = [];
    for (const cents of [-7, 7]) {
      const fr = e.freq * 2 ** (cents / 1200);
      const dt = fr / SR;
      const f = new Biquad('passe-bas', fc, 0.7);
      out.push(mono(n, (t) => {
        const u = t / dur;
        const env = u < 0.4 ? u / 0.4 : (1 - u) / 0.6;
        const trem = e.tremolo ? 1 - e.tremolo.prof * (0.5 - 0.5 * Math.cos(DEUX_PI * e.tremolo.f * t)) : 1;
        return f.pas(scie((fr * t) % 1, dt)) * env * e.gain * 0.5 * trem;
      }));
    }
    const [gG, dG] = panoramique(-0.55); const [gD, dD] = panoramique(0.55);
    const G = new Float32Array(n); const D = new Float32Array(n);
    for (let i = 0; i < n; i += 1) { G[i] = out[0][i] * gG + out[1][i] * gD; D[i] = out[0][i] * dG + out[1][i] * dD; }
    return [G, D];
  },
  // Cloche : partiels inharmoniques 1 · 2,76 · 5,4 ; chacun s'éteint plus vite que le précédent.
  cloche(e) {
    const dur = e.d * 3;
    const n = Math.round(dur * SR);
    const partiels = e.partiels ?? [[1, 1], [2.76, 0.4], [5.4, 0.2]];
    const x = mono(n, (t) => {
      let s = 0;
      partiels.forEach(([r, a], k) => {
        const fr = e.freq * r;
        if (fr < SR * 0.45) s += a * Math.sin(DEUX_PI * fr * t) * Math.exp((-t * 9.2) / (dur / (1 + k)));
      });
      return s * e.gain * Math.min(1, t / 0.003);
    });
    return enStereo(x, e.pan);
  },
  // Anneau de la mélodie de début de manche (« vague-annonce » du jeu) : partiels avec leur propre durée, doublés d'une copie
  // légèrement désaccordée (battement).
  anneau(e) {
    const dur = e.duree ?? 1.5;
    const n = Math.round(dur * SR);
    const partiels = e.partiels ?? [[1, 1, 0.5], [2.76, 0.5, 0.34], [5.4, 0.28, 0.2], [8.9, 0.14, 0.12]];
    const x = mono(n, (t) => {
      let s = 0;
      for (const [r, a, dec] of partiels) {
        const fr = e.freq * r;
        if (fr * 1.01 < SR * 0.45) s += a * Math.exp(-t / dec) * 0.5 * (Math.sin(DEUX_PI * fr * t) + Math.sin(DEUX_PI * fr * (1 + (e.desaccord ?? 0.0087)) * t));
      }
      const fin = Math.min(1, (dur - t) / 0.05);
      return s * e.gain * Math.min(1, t / 0.002) * fin;
    });
    return enStereo(x, e.pan);
  },
  // Souffle : bruit dans un passe-bande, qui enfle et retombe (deux bruits indépendants à gauche et à droite).
  souffle(e) {
    const dur = e.duree;
    const n = Math.round(dur * SR);
    const res = [];
    for (const c of [0, 1]) {
      const b = bruitBlanc(n, e.graine + c);
      const f = new Biquad('passe-bande', e.freq, 1.2);
      res.push(mono(n, (t, i) => {
        const u = t / dur;
        return f.pas(b[i]) * e.gain * (u < 0.45 ? u / 0.45 : (1 - u) / 0.55);
      }));
    }
    return res;
  },
  // Tic métallique : bruit passe-haut très court.
  tic(e) {
    const dur = 0.05;
    const n = Math.round(dur * SR);
    const b = bruitBlanc(n, e.graine);
    const f = new Biquad('passe-haut', 5000, 0.7);
    return enStereo(mono(n, (t, i) => f.pas(b[i]) * envExp(t, e.gain, 0.002, dur)), e.pan);
  },
  // Houle : bruit rose dans un passe-bande qui monte (200 → 2 500 Hz), le niveau monte jusqu'au bout puis tombe en 50 ms.
  houle(e) {
    const dur = e.duree;
    const n = Math.round((dur + 0.05) * SR);
    const res = [];
    for (const c of [0, 1]) {
      const b = bruitRose(n, e.graine + c);
      const f = new Biquad('passe-bande', e.f0, 1.2);
      res.push(mono(n, (t, i) => {
        if (i % 16 === 0) f.regler(e.f0 * (e.f1 / e.f0) ** Math.min(1, t / dur));
        const env = t < dur ? (t / dur) ** 2 : Math.max(0, 1 - (t - dur) / 0.05);
        return f.pas(b[i]) * e.gain * env;
      }));
    }
    return res;
  },
  // Coup sourd de la fin de la mélodie de manche : sinus 55 → 45 Hz à décroissance rapide, et claquement de bruit aigu.
  coup(e) {
    const dur = 0.9;
    const n = Math.round(dur * SR);
    const b = bruitBlanc(n, e.graine);
    const f = new Biquad('passe-haut', 3000, 0.7);
    let ph = 0;
    const x = mono(n, (t, i) => {
      const fr = e.freq * (e.freqFin / e.freq) ** Math.min(1, t / 0.6);
      ph = (ph + fr / SR) % 1;
      const boom = Math.sin(DEUX_PI * ph) * Math.min(1, t / 0.003) * Math.exp(-t / 0.28) * Math.min(1, (dur - t) / 0.1);
      const clac = t < 0.15 ? f.pas(b[i]) * Math.exp(-t / 0.035) * Math.min(1, (0.15 - t) / 0.02) * 0.18 : 0;
      return (boom + clac) * e.gain;
    });
    return enStereo(x, 0);
  },
  // Plainte : triangle aigu qui glisse lentement vers le bas avec un vibrato, fondu en cloche (version horreur).
  plainte(e) {
    const dur = e.duree;
    const n = Math.round(dur * SR);
    let ph = 0;
    const f = new Biquad('passe-bas', e.freq * 3, 0.7);
    const x = mono(n, (t) => {
      const u = t / dur;
      const fr = e.freq * 2 ** ((e.glisse * u) / 12) * 2 ** ((0.15 * Math.sin(DEUX_PI * 5.2 * t) * Math.min(1, t / 1)) / 12);
      ph = (ph + fr / SR) % 1;
      return f.pas(triangle(ph)) * e.gain * Math.sin(Math.PI * u) ** 2;
    });
    return enStereo(x, e.pan);
  },
};

// Envois par voix : [direct, écho, réverbération].
const ENVOIS = {
  pouls: [1, 0, 0.1], pince: [1, 1, 0.3], nappe: [1, 0, 0.4], cloche: [1, 1, 0.6], souffle: [1, 0, 0.3], tic: [1, 1, 0.2],
  anneau: [1, 0.6, 0.7], houle: [1, 0, 0.4], coup: [1, 0, 0.5], plainte: [1, 1, 0.6],
};

// ---------- Effets ----------
// Écho en ping-pong : retard de `temps` s, réinjection `retour` à travers un passe-bas.
function echo(entG, entD, temps, retour, coupure) {
  const n = entG.length;
  const D = Math.round(temps * SR);
  const lg = new Float32Array(n); const ld = new Float32Array(n);
  const outG = new Float32Array(n); const outD = new Float32Array(n);
  const fg = new Biquad('passe-bas', coupure, 0.707); const fd = new Biquad('passe-bas', coupure, 0.707);
  for (let i = 0; i < n; i += 1) {
    const a = i >= D ? lg[i - D] : 0;
    const b = i >= D ? ld[i - D] : 0;
    outG[i] = a; outD[i] = b;
    lg[i] = (entG[i] + entD[i]) * 0.5 + retour * fd.pas(b);
    ld[i] = retour * fg.pas(a);
  }
  return [outG, outD];
}
// Réverbération de type Freeverb (8 filtres en peigne amortis et 4 passe-tout par canal, canal droit décalé).
function reverb(entG, entD, piece, amorti) {
  const n = entG.length;
  const peignes = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const passeTout = [556, 441, 341, 225];
  const fb = piece * 0.28 + 0.7;
  const sorties = [];
  const hp = [new Biquad('passe-haut', 180, 0.707), new Biquad('passe-haut', 180, 0.707)];
  for (const [c, ent] of [[0, entG], [1, entD]]) {
    const ecart = c === 0 ? 0 : 23;
    const x = new Float32Array(n);
    for (let i = 0; i < n; i += 1) x[i] = hp[c].pas(ent[i]) * 0.015;
    const y = new Float32Array(n);
    for (const l0 of peignes) {
      const l = l0 + ecart;
      const buf = new Float32Array(l);
      let k = 0; let mem = 0;
      for (let i = 0; i < n; i += 1) {
        const s = buf[k];
        mem = s * (1 - amorti) + mem * amorti;
        buf[k] = x[i] + mem * fb;
        y[i] += s;
        k = k + 1 === l ? 0 : k + 1;
      }
    }
    for (const l0 of passeTout) {
      const l = l0 + ecart;
      const buf = new Float32Array(l);
      let k = 0;
      for (let i = 0; i < n; i += 1) {
        const b = buf[k];
        const v = y[i];
        buf[k] = v + b * 0.5;
        y[i] = b - v;
        k = k + 1 === l ? 0 : k + 1;
      }
    }
    sorties.push(y);
  }
  return sorties;
}
// Limiteur de crête stéréo à anticipation (5 ms), retour en `relache` s : gain lissé, jamais au-dessus du plafond.
function limiteur(G, D, plafond, relache = 0.15) {
  const n = G.length;
  const la = Math.round(0.005 * SR);
  const voulu = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const p = Math.max(Math.abs(G[i]), Math.abs(D[i]));
    voulu[i] = p > plafond ? plafond / p : 1;
  }
  // Minimum glissant sur [i, i + la] (file monotone).
  const mini = new Float32Array(n);
  const file = new Int32Array(n + la + 1); let tete = 0; let queue = 0;
  for (let j = 0; j < n + la; j += 1) {
    if (j < n) {
      while (queue > tete && voulu[file[queue - 1]] >= voulu[j]) queue -= 1;
      file[queue++] = j;
    }
    const i = j - la;
    if (i >= 0) {
      while (file[tete] < i) tete += 1;
      mini[i] = voulu[file[tete]];
    }
  }
  const k = 1 - Math.exp(-1 / (relache * SR));
  let h = 1;
  const lisse = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    h = mini[i] < h ? mini[i] : h + (mini[i] - h) * k;
    lisse[i] = h;
  }
  // Moyenne glissante sur la fenêtre d'anticipation : montée douce, toujours sous le gain voulu.
  let somme = 0;
  let reduites = 0;
  let plusBas = 1;
  for (let i = 0; i < n; i += 1) {
    somme += lisse[i];
    if (i >= la) somme -= lisse[i - la];
    const g = somme / Math.min(i + 1, la);
    if (g < 0.999) reduites += 1;
    plusBas = Math.min(plusBas, g);
    G[i] *= g; D[i] *= g;
  }
  return { part: reduites / n, reductionMax: -20 * Math.log10(plusBas) };
}

// Sonie approchée (LUFS, UIT-R BS.1770 sans portes) de [debut, fin[ : pondération K (plateau aigu de +4 dB, passe-haut RLB).
export function sonie(G, D, debut, fin) {
  let somme = 0;
  for (const x of [G, D]) {
    const plateau = new Plateau(1681.97, 4, 0.7072);
    const rlb = new Biquad('passe-haut', 38.135, 0.5003);
    for (let i = 0; i < fin; i += 1) {
      const y = rlb.pas(plateau.pas(x[i]));
      if (i >= debut) somme += y * y;
    }
  }
  return -0.691 + 10 * Math.log10(somme / (fin - debut));
}
class Plateau extends Biquad {
  constructor(f, gainDb, q) {
    super('passe-bas', f, q);
    const A = 10 ** (gainDb / 40);
    const w = (DEUX_PI * f) / SR;
    const cw = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    const r = 2 * Math.sqrt(A) * a;
    const a0 = (A + 1) - (A - 1) * cw + r;
    this.b0 = (A * ((A + 1) + (A - 1) * cw + r)) / a0;
    this.b1 = (-2 * A * ((A - 1) + (A + 1) * cw)) / a0;
    this.b2 = (A * ((A + 1) + (A - 1) * cw - r)) / a0;
    this.a1 = (2 * ((A - 1) - (A + 1) * cw)) / a0;
    this.a2 = ((A + 1) - (A - 1) * cw - r) / a0;
  }
}

// ---------- Rendu d'une pièce ----------
// piece : { id, duree (s, tour), evenements (liste d'un tour : { voix, t, … }), bourdon, effets, cible (LUFS) }.
// Retour : { G, D (Float32Array du fichier : marge + tour + marge), debutBoucle, finBoucle (s), mesures }.
export function rendre(piece, { marge = 1 } = {}) {
  const N = Math.round(piece.duree * SR);
  if (Math.abs(N - piece.duree * SR) > 1e-6) throw new Error(`${piece.id} : la durée du tour doit tomber sur un échantillon entier`);
  const P = Math.round(marge * SR);
  const R = 2 * N + P;
  const bus = { direct: [new Float32Array(R), new Float32Array(R)], echo: [new Float32Array(R), new Float32Array(R)], rev: [new Float32Array(R), new Float32Array(R)] };

  // Bourdon continu : oscillateurs à nombre entier de périodes par tour, phase exacte ; passe-bas qui respire.
  const B = piece.bourdon;
  if (B) {
    const oscs = B.oscillateurs.map((o) => {
      const k = Math.max(1, Math.round(o.f * piece.duree));
      return { ...o, k, dt: k / N, pan: panoramique(o.pan ?? 0) };
    });
    const filtres = [new Biquad('passe-bas', B.lp[0], 0.9), new Biquad('passe-bas', B.lp[0], 0.9)];
    for (let i = 0; i < R; i += 1) {
      const m = i % N;
      if (i % 16 === 0) {
        const x = 0.5 - 0.5 * Math.cos((DEUX_PI * B.respirations * m) / N);
        const fc = B.lp[0] + (B.lp[1] - B.lp[0]) * x;
        filtres[0].regler(fc); filtres[1].regler(fc);
      }
      let sg = 0; let sd = 0;
      for (const o of oscs) {
        const ph = ((o.k * m) % N) / N;
        const v = o.forme === 'scie' ? scie(ph, o.dt) : o.forme === 'triangle' ? triangle(ph) : Math.sin(DEUX_PI * ph);
        sg += v * o.gain * o.pan[0]; sd += v * o.gain * o.pan[1];
      }
      const g = filtres[0].pas(sg) * B.gain; const d = filtres[1].pas(sd) * B.gain;
      bus.direct[0][i] += g; bus.direct[1][i] += d;
      bus.rev[0][i] += g * 0.15; bus.rev[1][i] += d * 0.15;
    }
  }

  // Événements : le même tour, trois fois (tours 0, 1, 2), coupés à la fin du rendu.
  const rendus = piece.evenements.map((e) => {
    const voix = VOIX[e.voix];
    if (!voix) throw new Error(`voix inconnue : ${e.voix}`);
    return { e, son: voix(e) };
  });
  for (let tour = 0; tour < 3; tour += 1) {
    for (const { e, son } of rendus) {
      const i0 = Math.round((tour * piece.duree + e.t) * SR);
      if (i0 >= R) continue;
      const [dir, ech, rev] = ENVOIS[e.voix];
      const [G, D] = son;
      const fin = Math.min(G.length, R - i0);
      for (let i = 0; i < fin; i += 1) {
        const g = G[i]; const d = D[i];
        const j = i0 + i;
        bus.direct[0][j] += g * dir; bus.direct[1][j] += d * dir;
        if (ech) { bus.echo[0][j] += g * ech; bus.echo[1][j] += d * ech; }
        if (rev) { bus.rev[0][j] += g * rev; bus.rev[1][j] += d * rev; }
      }
    }
  }

  // Effets et mélange.
  const E = piece.effets;
  const [eG, eD] = echo(bus.echo[0], bus.echo[1], E.echo.temps, E.echo.retour, E.echo.coupure);
  for (let i = 0; i < R; i += 1) { bus.rev[0][i] += eG[i] * E.echo.niveau * 0.5; bus.rev[1][i] += eD[i] * E.echo.niveau * 0.5; }
  const [rG, rD] = reverb(bus.rev[0], bus.rev[1], E.reverb.piece, E.reverb.amorti);
  const G = new Float32Array(R); const D = new Float32Array(R);
  const hp = [new Biquad('passe-haut', 28, 0.707), new Biquad('passe-haut', 28, 0.707)];
  for (let i = 0; i < R; i += 1) {
    let g = bus.direct[0][i] + eG[i] * E.echo.niveau + rG[i] * E.reverb.niveau;
    let d = bus.direct[1][i] + eD[i] * E.echo.niveau + rD[i] * E.reverb.niveau;
    if (E.saturation) { const s = E.saturation; g = Math.tanh(g * s) / s; d = Math.tanh(d * s) / s; }
    G[i] = hp[0].pas(g); D[i] = hp[1].pas(d);
  }

  // Niveau : sonie mesurée sur un tour (le deuxième), gain fixe vers la cible (LUFS), puis limiteur à -1,5 dBFS.
  const gain = 10 ** ((piece.cible - sonie(G, D, N, 2 * N)) / 20);
  for (let i = 0; i < R; i += 1) { G[i] *= gain; D[i] *= gain; }
  const lim = limiteur(G, D, 10 ** (-1.5 / 20));

  // Découpe : [N - P, 2N + P[ ; la boucle est [P, P + N[.
  const debut = N - P;
  return {
    G: G.slice(debut, 2 * N + P), D: D.slice(debut, 2 * N + P),
    debutBoucle: P / SR, finBoucle: (P + N) / SR, echantillonsBoucle: N, marge: P,
    mesures: { gain, limiteur: lim.part, reductionMax: lim.reductionMax },
  };
}

// ---------- Fichiers WAV (flottants 32 bits, stéréo) ----------
export function wav(G, D) {
  const n = G.length;
  const buf = Buffer.alloc(44 + n * 8);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 8, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 8, 28); buf.writeUInt16LE(8, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i += 1) { buf.writeFloatLE(G[i], 44 + i * 8); buf.writeFloatLE(D[i], 48 + i * 8); }
  return buf;
}
