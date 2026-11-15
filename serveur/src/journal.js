// Journal au format JSON (une ligne par événement), lu par Cloud Logging.
// Règle : on ne journalise jamais d'en-têtes, de corps de requête, d'adresse IP ni de valeur secrète.
// Par précaution, toute valeur secrète connue est remplacée par « [masqué] » avant l'écriture.

const MASQUE = '[masqué]';

export function creerJournal({ secrets = [], ecrire = (ligne) => process.stdout.write(ligne + '\n') } = {}) {
  // Les plus longues d'abord, pour qu'une valeur contenue dans une autre ne laisse pas de morceau.
  const aMasquer = [...new Set(secrets)].filter((s) => s.length >= 4).sort((a, b) => b.length - a.length);

  function masquer(texte) {
    let resultat = String(texte);
    for (const s of aMasquer) resultat = resultat.split(s).join(MASQUE);
    return resultat;
  }

  function ecrireNiveau(severity, message, champs = {}) {
    const ligne = JSON.stringify({ severity, message, ...champs, horodatage: new Date().toISOString() });
    ecrire(masquer(ligne));
  }

  return {
    masquer,
    info: (message, champs) => ecrireNiveau('INFO', message, champs),
    avertissement: (message, champs) => ecrireNiveau('WARNING', message, champs),
    erreur: (message, champs) => ecrireNiveau('ERROR', message, champs),
  };
}

/** Résumé d'une erreur pour le journal : type, code, début du message (masqué ensuite par le journal). */
export function resumerErreur(err) {
  if (!err || typeof err !== 'object') return { type: typeof err };
  return {
    type: err.name || 'Error',
    code: typeof err.code === 'string' ? err.code : undefined,
    detail: typeof err.message === 'string' ? err.message.slice(0, 300) : undefined,
  };
}
