// Point d'entrée : lit la configuration, ouvre la base, applique les migrations, écoute sur PORT (8080 sur Cloud Run).

import { serve } from '@hono/node-server';
import { lireConfig, valeursSecretes, manquantesAdmin } from './config.js';
import { creerJournal, resumerErreur } from './journal.js';
import { ouvrirBase } from './base.js';
import { creerApp } from './app.js';

const config = lireConfig();
const journal = creerJournal({ secrets: valeursSecretes(config) });

let db = null;
try {
  db = ouvrirBase(config);
} catch (err) {
  journal.erreur('Adresse de base de données illisible', { erreur: resumerErreur(err) });
}
if (!db) journal.avertissement('Base de données non configurée', { variable: 'TURSO_DATABASE_URL' });
const manquantes = manquantesAdmin(config);
if (manquantes.length > 0) journal.avertissement('Administration désactivée : variables manquantes', { variables: manquantes });

const app = creerApp({ config, db, journal });
// Migrations au démarrage ; en cas d'échec (base injoignable), nouvel essai à la requête suivante.
app.preparer().catch(() => {});

const serveur = serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
  journal.info('Serveur démarré', { port: info.port, version: config.version });
});

// Cloud Run envoie SIGTERM avant d'arrêter l'instance.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    journal.info('Arrêt du serveur', { signal });
    serveur.close(() => {
      db?.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
