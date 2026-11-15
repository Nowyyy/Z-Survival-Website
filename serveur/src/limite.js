// Limite des tentatives de connexion : 5 échecs par adresse IP en 15 minutes, puis refus temporaire.
// Le compteur est dans la base (le serveur s'endort entre les visites : un compteur en mémoire serait perdu).
// L'adresse IP n'est jamais stockée en clair : on garde son HMAC-SHA256 (clé dérivée de la clé de session),
// impossible à retrouver sans la clé, même en essayant toutes les adresses IPv4.

import { createHmac } from 'node:crypto';
import { deriverCle } from './jeton.js';

export const ECHECS_MAX = 5;
export const FENETRE_MS = 15 * 60 * 1000;
const CONSERVATION_MS = 24 * 60 * 60 * 1000;

export function hacherIp(cleSession, ip) {
  return createHmac('sha256', deriverCle(cleSession, 'ip')).update(String(ip)).digest('base64url');
}

/**
 * Réserve une tentative pour cette adresse, en une seule instruction (pas de course entre requêtes
 * simultanées) : la ligne n'est ajoutée que s'il y a moins de ECHECS_MAX tentatives dans la fenêtre.
 * Renvoie { autorisee: true } ou { autorisee: false, reessayerDansS }.
 */
export async function reserverTentative(db, ipHachee, maintenantMs) {
  const depuis = maintenantMs - FENETRE_MS;
  const r = await db.execute({
    sql: `INSERT INTO tentatives_connexion (ip_hachee, tentee_le)
          SELECT ?, ? WHERE (SELECT COUNT(*) FROM tentatives_connexion WHERE ip_hachee = ? AND tentee_le > ?) < ?`,
    args: [ipHachee, maintenantMs, ipHachee, depuis, ECHECS_MAX],
  });
  if (r.rowsAffected === 1) return { autorisee: true };
  const plusAncienne = await db.execute({
    sql: 'SELECT MIN(tentee_le) AS t FROM tentatives_connexion WHERE ip_hachee = ? AND tentee_le > ?',
    args: [ipHachee, depuis],
  });
  const t = Number(plusAncienne.rows[0]?.t ?? maintenantMs);
  return { autorisee: false, reessayerDansS: Math.max(1, Math.ceil((t + FENETRE_MS - maintenantMs) / 1000)) };
}

/** Connexion réussie : on efface les tentatives de cette adresse. */
export async function effacerTentatives(db, ipHachee) {
  await db.execute({ sql: 'DELETE FROM tentatives_connexion WHERE ip_hachee = ?', args: [ipHachee] });
}

/** Ménage : supprime les tentatives de plus de 24 heures. */
export async function nettoyerTentatives(db, maintenantMs) {
  await db.execute({ sql: 'DELETE FROM tentatives_connexion WHERE tentee_le < ?', args: [maintenantMs - CONSERVATION_MS] });
}
