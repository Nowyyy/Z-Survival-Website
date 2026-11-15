// Annonce Discord des actualités (lot 3c) : à la PREMIÈRE publication d'un article, un message part dans un salon Discord
// par un webhook (adresse secrète DISCORD_WEBHOOK_ACTUS, rangée dans Google Secret Manager par installer-gcp.sh --discord).
// Message : une ligne « Nouvelle actualité », puis une carte (embed) avec le titre français, un extrait du texte, l'image de
// l'article et le lien vers l'article sur le site (https://zsurvival-game.com/#actu/<slug>).
// Règles :
// - l'adresse du webhook ne quitte jamais le serveur : ni dans les réponses, ni dans le journal (masquée), ni dans les erreurs ;
// - aucune mention ne notifie qui que ce soit (allowed_mentions vide) : un « @everyone » dans un titre reste du texte ;
// - un échec de Discord n'empêche jamais la publication (l'article est publié, l'échec est noté dans le journal).

export const ADRESSE_SITE = 'https://zsurvival-game.com/';
const COULEUR = 0xd81414; // --color-action (rouge sang du jeu)
const MOTIF_WEBHOOK = /^https:\/\/(?:discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d{5,25}\/[A-Za-z0-9_-]{20,200}$/;
const LONGUEUR_EXTRAIT = 280;
const DELAI_MS = 8_000;

/** Adresse de webhook Discord valable (forme seulement) ? */
export function webhookValide(adresse) {
  return typeof adresse === 'string' && MOTIF_WEBHOOK.test(adresse);
}

/** Texte brut d'un contenu Markdown (js/markdown.js du site) : sans titres, gras, italique ni adresses de liens. */
export function texteBrut(markdown) {
  return String(markdown ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrait d'au plus `max` caractères, coupé à un mot, avec « … ». */
export function extrait(markdown, max = LONGUEUR_EXTRAIT) {
  const t = texteBrut(markdown);
  if (t.length <= max) return t;
  const coupe = t.slice(0, max - 1);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > max * 0.6 ? coupe.slice(0, espace) : coupe).replace(/[\s,;:.!?-]+$/, '')}…`;
}

export const adresseArticle = (slug) => `${ADRESSE_SITE}#actu/${encodeURIComponent(slug)}`;

/**
 * Image de l'article pour la carte : l'adresse publique si elle est déjà en ligne ; sinon (image envoyée à l'instant, GitHub Pages
 * ne l'a pas encore republiée), le fichier lu dans le dépôt par l'API GitHub, joint au message. Rien si aucune des deux ne marche.
 * Retour : { url } | { fichier: { nom, type, octets } } | null.
 */
async function imageDeLArticle({ image, config, fetchAnnonce, fetchGithub }) {
  if (!/^img\/actus\/[a-z0-9-]+\.(?:webp|png|jpe?g)$/.test(image ?? '')) return null;
  const publique = ADRESSE_SITE + image;
  try {
    const r = await fetchAnnonce(publique, { method: 'HEAD', signal: AbortSignal.timeout(4_000) });
    if (r.ok) return { url: publique };
  } catch { /* site injoignable : on essaie le dépôt */ }
  try {
    const [proprietaire, depot] = config.depotGithub.split('/');
    const entetes = { Accept: 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'z-survival-serveur' };
    if (config.jetonGithubImages) entetes.Authorization = `Bearer ${config.jetonGithubImages}`;
    const r = await fetchGithub(
      `${config.apiGithub}/repos/${encodeURIComponent(proprietaire)}/${encodeURIComponent(depot)}/contents/${image}?ref=${encodeURIComponent(config.brancheGithub)}`,
      { headers: entetes, signal: AbortSignal.timeout(8_000) },
    );
    if (!r.ok) return null;
    const octets = new Uint8Array(await r.arrayBuffer());
    if (octets.length === 0 || octets.length > 8 * 1024 * 1024) return null;
    const ext = image.split('.').pop();
    const type = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }[ext];
    return { fichier: { nom: `actualite.${ext}`, type, octets } };
  } catch {
    return null;
  }
}

/** Contenu JSON du message Discord pour un article (sans l'image). */
export function messageArticle(article) {
  const embed = {
    title: String(article.titre_fr).slice(0, 256),
    url: adresseArticle(article.slug),
    description: extrait(article.contenu_fr),
    color: COULEUR,
    footer: { text: 'Z-Survival — Actualités' },
  };
  if (article.date_publication) embed.timestamp = article.date_publication;
  return {
    username: 'Z-Survival',
    avatar_url: `${ADRESSE_SITE}img/icones/icone-512.png`,
    content: `📰 **Nouvelle actualité sur Z-Survival** : ${adresseArticle(article.slug)}`,
    embeds: [embed],
    allowed_mentions: { parse: [] },
  };
}

/**
 * Envoie l'annonce d'un article publié. Ne lève jamais d'exception.
 * Retour : { envoyee: true } | { envoyee: false, raison: 'non_configure' | 'webhook_invalide' | 'erreur_discord', code? }.
 */
export async function annoncerArticle({ config, article, journal, fetchAnnonce = (...a) => fetch(...a), fetchGithub = (...a) => fetch(...a) }) {
  if (!config.webhookDiscordActus) return { envoyee: false, raison: 'non_configure' };
  if (!webhookValide(config.webhookDiscordActus)) {
    journal.avertissement('Annonce Discord impossible : adresse du webhook mal formée (DISCORD_WEBHOOK_ACTUS)', { id: article.id });
    return { envoyee: false, raison: 'webhook_invalide' };
  }
  const message = messageArticle(article);
  const image = await imageDeLArticle({ image: article.image, config, fetchAnnonce, fetchGithub });
  let corps;
  let entetes = {};
  if (image?.url) message.embeds[0].image = { url: image.url };
  if (image?.fichier) {
    message.embeds[0].image = { url: `attachment://${image.fichier.nom}` };
    message.attachments = [{ id: 0, filename: image.fichier.nom }];
    corps = new FormData();
    corps.append('payload_json', JSON.stringify(message));
    corps.append('files[0]', new Blob([image.fichier.octets], { type: image.fichier.type }), image.fichier.nom);
  } else {
    corps = JSON.stringify(message);
    entetes = { 'Content-Type': 'application/json' };
  }
  try {
    const r = await fetchAnnonce(`${config.webhookDiscordActus}?wait=true`, {
      method: 'POST',
      headers: { ...entetes, 'User-Agent': 'z-survival-serveur' },
      body: corps,
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (!r.ok) {
      journal.avertissement('Annonce Discord refusée', { id: article.id, code: r.status });
      return { envoyee: false, raison: 'erreur_discord', code: r.status };
    }
    journal.info('Annonce Discord envoyée', { id: article.id, image: image ? (image.url ? 'adresse' : 'jointe') : 'aucune' });
    return { envoyee: true };
  } catch (err) {
    journal.avertissement('Annonce Discord : Discord ne répond pas', { id: article.id, type: err?.name ?? 'Error' });
    return { envoyee: false, raison: 'erreur_discord' };
  }
}
