// Adresse du serveur des actualités (lot 3a : Cloud Run, europe-west3). C'est le SEUL endroit du site où elle est écrite :
// pour passer plus tard au nom de domaine du studio, changer cette ligne (sans « / » à la fin).
// La page d'administration la lit aussi ; sa règle de sécurité (Content-Security-Policy, en tête de admin/index.html) doit
// autoriser la même adresse : outils/admin/verifier-actus.mjs échoue si les deux ne correspondent pas (Docs/ref/admin.md).
export const ADRESSE_SERVEUR = 'https://z-survival-serveur-l3ab2tj6vq-ey.a.run.app';
