// Lecture de la configuration (variables d'environnement).
// Les secrets arrivent de Google Secret Manager sous forme de variables d'environnement (Cloud Run).
// Ce fichier ne contient AUCUNE valeur : seulement des noms.

/** Noms des variables secrètes (voir Docs/ref/serveur.md, « Secrets »). */
export const NOMS_SECRETS = Object.freeze([
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'ADMIN_IDENTIFIANT',
  'ADMIN_EMPREINTE',
  'CLE_SESSION',
  'GITHUB_JETON_IMAGES',
  'DISCORD_WEBHOOK_ACTUS',
]);

export function lireConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  return Object.freeze({
    port: Number.parseInt(env.PORT ?? '', 10) || 8080,
    production,
    urlBase: env.TURSO_DATABASE_URL ?? '',
    jetonBase: env.TURSO_AUTH_TOKEN ?? '',
    adminIdentifiant: env.ADMIN_IDENTIFIANT ?? '',
    adminEmpreinte: env.ADMIN_EMPREINTE ?? '',
    cleSession: env.CLE_SESSION ?? '',
    // Images des articles (lot 3b) : jeton GitHub (secret, facultatif : sans lui, seul l'envoi d'images est refusé),
    // dépôt et branche où l'image est enregistrée (non secrets). GITHUB_API ne sert qu'aux tests (API GitHub simulée).
    jetonGithubImages: env.GITHUB_JETON_IMAGES ?? '',
    depotGithub: env.GITHUB_DEPOT || 'Nowyyy/Z-Survival-Website',
    brancheGithub: env.GITHUB_BRANCHE || 'main',
    apiGithub: (env.GITHUB_API || 'https://api.github.com').replace(/\/+$/, ''),
    // Annonce des actualités sur Discord (lot 3c) : adresse du webhook du salon (secret, facultatif : sans elle, pas d'annonce).
    webhookDiscordActus: (env.DISCORD_WEBHOOK_ACTUS ?? '').trim(),
    // Origines http://localhost:* et http://127.0.0.1:* : autorisées hors production (tests locaux),
    // et en production seulement si ORIGINES_LOCALES=1.
    originesLocales: env.ORIGINES_LOCALES !== undefined ? env.ORIGINES_LOCALES === '1' : !production,
    version: env.VERSION_SERVEUR || 'locale',
  });
}

/** Valeurs secrètes de la configuration, pour les masquer dans les journaux. */
export function valeursSecretes(config) {
  const valeurs = [config.jetonBase, config.adminIdentifiant, config.adminEmpreinte, config.cleSession, config.jetonGithubImages];
  // Webhook Discord : l'adresse entière et sa partie secrète (le dernier morceau, qui suffit pour écrire dans le salon).
  if (config.webhookDiscordActus) valeurs.push(config.webhookDiscordActus, config.webhookDiscordActus.split('/').pop());
  if (config.urlBase && !config.urlBase.startsWith('file:')) {
    valeurs.push(config.urlBase);
    try {
      const hote = new URL(config.urlBase).hostname;
      if (hote) valeurs.push(hote);
    } catch { /* adresse illisible : la valeur entière est déjà masquée */ }
  }
  return valeurs.filter((v) => typeof v === 'string' && v.length > 0);
}

/** Noms des variables manquantes pour la partie administration (jamais leurs valeurs). */
export function manquantesAdmin(config) {
  const manquantes = [];
  if (!config.adminIdentifiant) manquantes.push('ADMIN_IDENTIFIANT');
  if (!config.adminEmpreinte) manquantes.push('ADMIN_EMPREINTE');
  if (config.cleSession.length < 32) manquantes.push('CLE_SESSION');
  return manquantes;
}
