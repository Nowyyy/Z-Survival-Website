// Empreinte du mot de passe administrateur : PBKDF2-SHA256, 600 000 itérations, sel aléatoire de 16 octets.
// Format : pbkdf2$600000$<sel_base64>$<empreinte_base64> (même format que le script d'installation Google Cloud).
// Le mot de passe en clair n'est jamais stocké.

import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

export const ITERATIONS = 600_000;
const ITERATIONS_MIN = 100_000;
const ITERATIONS_MAX = 10_000_000;
const LONGUEUR_EMPREINTE = 32;
export const MDP_LONGUEUR_MAX = 256;

export async function calculerEmpreinte(motDePasse, { iterations = ITERATIONS, sel = randomBytes(16) } = {}) {
  if (typeof motDePasse !== 'string' || motDePasse.length === 0) throw new TypeError('Mot de passe vide.');
  const empreinte = await pbkdf2Async(Buffer.from(motDePasse, 'utf8'), sel, iterations, LONGUEUR_EMPREINTE, 'sha256');
  return `pbkdf2$${iterations}$${sel.toString('base64')}$${empreinte.toString('base64')}`;
}

/** Découpe une empreinte stockée ; renvoie null si le format est invalide. */
export function lireEmpreinte(texte) {
  if (typeof texte !== 'string') return null;
  const morceaux = texte.trim().split('$');
  if (morceaux.length !== 4 || morceaux[0] !== 'pbkdf2') return null;
  if (!/^\d+$/.test(morceaux[1])) return null;
  const iterations = Number(morceaux[1]);
  if (iterations < ITERATIONS_MIN || iterations > ITERATIONS_MAX) return null;
  const sel = Buffer.from(morceaux[2], 'base64');
  const empreinte = Buffer.from(morceaux[3], 'base64');
  if (sel.length < 8 || empreinte.length < 16 || empreinte.length > 64) return null;
  return { iterations, sel, empreinte };
}

/**
 * Vérifie un mot de passe contre une empreinte stockée. Comparaison en temps constant.
 * Avec une empreinte invalide, le calcul est fait quand même (même durée) et le résultat est false.
 */
export async function verifierMotDePasse(motDePasse, empreinteStockee) {
  const lue = lireEmpreinte(empreinteStockee);
  const mdp = typeof motDePasse === 'string' ? motDePasse.slice(0, MDP_LONGUEUR_MAX) : '';
  const iterations = lue?.iterations ?? ITERATIONS;
  const sel = lue?.sel ?? randomBytes(16);
  const attendue = lue?.empreinte ?? randomBytes(LONGUEUR_EMPREINTE);
  const calculee = await pbkdf2Async(Buffer.from(mdp, 'utf8'), sel, iterations, attendue.length, 'sha256');
  const egales = timingSafeEqual(calculee, attendue);
  return Boolean(lue) && mdp.length > 0 && egales;
}
