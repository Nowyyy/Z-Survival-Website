// Temps de la boucle : toute la scène est une fonction du temps t (secondes), périodique de période DUREE.
// Chaque mouvement utilise une fréquence entière de tours par boucle (n / DUREE) : la dernière image rejoint la première.
import { DUREE_BOUCLE } from '../../js/accueil-boucle.js';

export const DUREE = DUREE_BOUCLE; // secondes (8 : lot 1) ; valeur partagée avec la vidéo et le site (js/accueil-boucle.js, lot 2b)
const TAU = Math.PI * 2;

// Onde sinusoïdale qui fait n tours par boucle (n entier), décalée de `phase` (en tours).
export const onde = (t, n = 1, phase = 0) => Math.sin(TAU * ((n * t) / DUREE + phase));
// Même onde ramenée entre 0 et 1.
export const onde01 = (t, n = 1, phase = 0) => 0.5 + 0.5 * onde(t, n, phase);
// Phase (0 à 1) d'un cycle qui fait n tours par boucle.
export const cycle = (t, n = 1, phase = 0) => {
  const x = (n * t) / DUREE + phase;
  return x - Math.floor(x);
};
// Impulsion douce (0 → 1 → 0) centrée sur `at` (phase 0 à 1) d'un cycle, de demi-largeur w (en phase) ; périodique.
export const bosse = (p, at, w) => {
  let d = Math.abs(p - at);
  d = Math.min(d, 1 - d);
  if (d >= w) return 0;
  const k = 1 - d / w;
  return k * k * (3 - 2 * k);
};
// Bruit lisse périodique : somme de quelques ondes entières (déterministe, sans hasard).
export const bruit = (t, graine = 0, n0 = 2) => (onde(t, n0, graine * 0.137) * 0.5 + onde(t, n0 * 2 + 1, graine * 0.311) * 0.3 + onde(t, n0 * 3 + 2, graine * 0.523) * 0.2);
