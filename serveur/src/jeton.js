// Jeton de connexion : signé par HMAC-SHA256 avec la clé de session, valable 2 heures,
// envoyé par le navigateur dans l'en-tête « Authorization: Bearer <jeton> » (pas de cookie :
// le site github.io et le serveur run.app n'ont pas le même domaine).
// Format : v1.<charge_base64url>.<signature_base64url>, charge = { sub: "admin", iat, exp } (en secondes).
// Le jeton ne contient ni l'identifiant ni aucune autre donnée secrète.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const DUREE_JETON_S = 2 * 60 * 60;
const PREFIXE = 'v1';
const LONGUEUR_MAX = 512;
const DECALAGE_TOLERE_S = 60;

/** Clé dérivée pour un usage donné (la clé de session sert à deux choses : jetons et adresses IP hachées). */
export function deriverCle(cleSession, usage) {
  return createHmac('sha256', Buffer.from(cleSession, 'utf8')).update(`z-survival-serveur:${usage}`).digest();
}

function signer(cle, texte) {
  return createHmac('sha256', cle).update(texte).digest();
}

export function creerJeton(cleSession, maintenantMs, dureeS = DUREE_JETON_S) {
  const iat = Math.floor(maintenantMs / 1000);
  const charge = Buffer.from(JSON.stringify({ sub: 'admin', iat, exp: iat + dureeS })).toString('base64url');
  const debut = `${PREFIXE}.${charge}`;
  const signature = signer(deriverCle(cleSession, 'jeton'), debut).toString('base64url');
  return { jeton: `${debut}.${signature}`, expire_le: new Date((iat + dureeS) * 1000).toISOString() };
}

/** Renvoie { valide: true } ou { valide: false, raison } (la raison sert aux tests, elle n'est jamais renvoyée au client). */
export function verifierJeton(cleSession, jeton, maintenantMs) {
  if (typeof jeton !== 'string' || jeton.length === 0 || jeton.length > LONGUEUR_MAX) return { valide: false, raison: 'format' };
  const morceaux = jeton.split('.');
  if (morceaux.length !== 3 || morceaux[0] !== PREFIXE) return { valide: false, raison: 'format' };
  const [prefixe, charge, signature] = morceaux;
  if (!/^[A-Za-z0-9_-]+$/.test(charge) || !/^[A-Za-z0-9_-]+$/.test(signature)) return { valide: false, raison: 'format' };

  const attendue = signer(deriverCle(cleSession, 'jeton'), `${prefixe}.${charge}`);
  const recue = Buffer.from(signature, 'base64url');
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return { valide: false, raison: 'signature' };

  let donnees;
  try {
    donnees = JSON.parse(Buffer.from(charge, 'base64url').toString('utf8'));
  } catch {
    return { valide: false, raison: 'format' };
  }
  const maintenantS = Math.floor(maintenantMs / 1000);
  if (donnees?.sub !== 'admin' || !Number.isInteger(donnees.exp) || !Number.isInteger(donnees.iat)) return { valide: false, raison: 'format' };
  if (donnees.iat > maintenantS + DECALAGE_TOLERE_S) return { valide: false, raison: 'futur' };
  if (donnees.exp - donnees.iat > DUREE_JETON_S) return { valide: false, raison: 'duree' };
  if (donnees.exp <= maintenantS) return { valide: false, raison: 'expire' };
  return { valide: true };
}
