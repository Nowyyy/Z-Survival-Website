// Vérification de bout en bout des actualités (lot 3b) : node outils/admin/verifier-actus.mjs [--captures=DOSSIER]
// Banc local (outils/admin/banc.mjs) : le vrai serveur sur une base SQLite en fichier, API GitHub simulée, copie exacte de ce que
// publie pages.yml servie sous /Z-Survival-Website/, appels vers …run.app (js/config.js) redirigés vers le serveur local.
// - Règles fixes : adresse du serveur identique dans js/config.js et la CSP d'admin/index.html ; admin en noindex, non reliée au site.
// - Admin (375 × 667) : réveil du serveur, échec de connexion (même message), connexion, créer, barre de mise en forme, image
//   (aperçu, envoi, commit simulé, EXIF supprimé, refus côté page), aperçu FR/EN, alerte de modifications non enregistrées,
//   publier, modifier, dépublier, supprimer, expiration du jeton (texte gardé), réponse 401, blocage après 5 essais.
//   Mise en page de l'admin à 320 × 568 et 1440 × 900 (aucun débordement).
// - Site (375 × 667, 320 × 568, 1440 × 900, avec et sans mouvement réduit) : liste vide, squelettes, erreur, seuls les publiés,
//   image, article complet et adresse #actu/…, Échap, retour, focus, repli « (FR) », changement de langue, article piégé inerte,
//   bandeau (?bandeau=1) avec le dernier article.
// - Aucune erreur console (hors erreurs HTTP voulues), aucun secret dans le journal du serveur.
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demarrerBanc } from './banc.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = createRequire(join(RACINE, 'serveur', 'package.json'))('sharp');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const CAPTURES = args.captures || join(tmpdir(), 'actus-captures');
mkdirSync(CAPTURES, { recursive: true });

let echecs = 0;
let reussites = 0;
const verifier = (ok, texte) => {
  if (ok) reussites += 1; else echecs += 1;
  console.log(`${ok ? '  ok ' : 'ÉCHEC'} ${texte}`);
};
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

// ---------- Règles fixes ----------
console.log('\n# Règles fixes');
const htmlAdmin = readFileSync(join(RACINE, 'admin', 'index.html'), 'utf8');
const { ADRESSE_SERVEUR } = await import(join(RACINE, 'js', 'config.js'));
const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(htmlAdmin)?.[1] ?? '';
const connect = /connect-src ([^;]+)/.exec(csp)?.[1].trim();
verifier(connect === new URL(ADRESSE_SERVEUR).origin, `CSP de l'admin : connect-src = adresse de js/config.js (${connect})`);
verifier(/script-src 'self';/.test(csp) && /default-src 'none'/.test(csp) && !/unsafe/.test(csp), 'CSP de l’admin : scripts du site seulement, rien d’« unsafe »');
verifier(/<meta name="robots" content="noindex, nofollow">/.test(htmlAdmin), 'admin en noindex');
const siteTextes = ['index.html', 'main.html', ...['site.js', 'actualites.js', 'textes.js', 'article.js'].map((f) => join('js', f))].map((f) => readFileSync(join(RACINE, f), 'utf8')).join('\n');
verifier(!/(?:href|src)=["'][^"']*admin/.test(siteTextes) && !/['"`][^'"`\n]*admin\/[^'"`\n]*['"`]/.test(siteTextes.replace(/\/\/.*$/gm, '')), 'aucun lien du site vers admin/');
verifier(!/(?:src|href)="\//.test(htmlAdmin), 'admin : aucun chemin qui commence par « / »');
const adresses = [...siteTextes.matchAll(/https:\/\/[a-z0-9-]+\.a\.run\.app/g)].length + (readFileSync(join(RACINE, 'js', 'config.js'), 'utf8').match(/run\.app/g) ?? []).length;
verifier(adresses === 1, 'adresse du serveur écrite une seule fois côté site (js/config.js)');

// ---------- Banc ----------
const banc = await demarrerBanc();
console.log(`\nBanc : ${banc.commande} ; serveur local ${banc.local} ; appels ${banc.ADRESSE_SERVEUR} redirigés`);
const navigateur = await chromium.launch();

/** Nouvelle page branchée sur le banc ; erreurs console relevées (HTTP voulues filtrées par « permis »). */
async function nouvellePage({ largeur = 375, hauteur = 667, reduit = false, brancher = {}, horloge = false } = {}) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, reducedMotion: reduit ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  await banc.brancher(contexte, brancher);
  const page = await contexte.newPage();
  if (horloge) await page.clock.install();
  const suivi = { erreurs: [], dialogues: [], reponses: [] };
  page.on('console', (m) => { if (m.type() === 'error') suivi.erreurs.push(m.text()); });
  page.on('pageerror', (e) => suivi.erreurs.push(`exception : ${e.message}`));
  page.on('requestfailed', (r) => { if (!r.url().startsWith(ADRESSE_SERVEUR)) suivi.erreurs.push(`requête échouée : ${r.url()}`); });
  page.on('response', (r) => { if (r.status() === 404 && !r.url().startsWith(ADRESSE_SERVEUR)) suivi.erreurs.push(`fichier manquant : ${r.url()}`); });
  page.on('dialog', async (d) => {
    suivi.dialogues.push({ type: d.type(), message: d.message() });
    const r = suivi.reponses.shift();
    if (d.type() === 'beforeunload') await d.dismiss();
    else if (r === false) await d.dismiss();
    else await d.accept(typeof r === 'string' ? r : undefined);
  });
  const erreursInattendues = (permis = []) => suivi.erreurs.filter((e) => !permis.some((p) => p.test(e)));
  return { contexte, page, suivi, erreursInattendues };
}
const HTTP_VOULU = [/Failed to load resource: the server responded with a status of (401|429|404)/];
const RESEAU_COUPE = [/Failed to load resource: net::ERR_CONNECTION_REFUSED/];

const debordement = (page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

// ---------- Site : liste vide (base neuve) ----------
console.log('\n# Site : aucun article');
{
  const { page, contexte, erreursInattendues } = await nouvellePage();
  await page.goto(`${banc.base}?lang=fr#news`);
  await page.waitForSelector('#news-etat[data-etat="vide"]', { timeout: 8000 }).catch(() => {});
  const texte = await page.textContent('#news-etat');
  verifier(/Radio silencieuse/.test(texte) && /Aucune transmission/.test(texte), `liste vide : message d'attente (« ${texte.trim().slice(0, 60)}… »)`);
  verifier(await page.locator('.news-carte').count() === 0, 'liste vide : aucune carte');
  await page.goto(`${banc.base}?lang=en#news`);
  await page.waitForSelector('#news-etat[data-etat="vide"]');
  verifier(/Radio silence/.test(await page.textContent('#news-etat')), 'liste vide en anglais : « Radio silence »');
  verifier(erreursInattendues().length === 0, `aucune erreur console (${erreursInattendues().join(' | ')})`);
  await contexte.close();
}

// ---------- Admin ----------
console.log('\n# Admin (375 × 667)');
const photo = await sharp({ create: { width: 3024, height: 4032, channels: 3, background: { r: 90, g: 30, b: 25 } } })
  .jpeg({ quality: 70 })
  .withExif({ IFD0: { Make: 'TelephoneDuProprietaire', ImageDescription: 'Maison-Secrete' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '48/1 51/1 24/1', GPSLongitudeRef: 'E', GPSLongitude: '2/1 21/1 3/1' } })
  .toBuffer();
let slugPrincipal = '';
let imagePrincipale = '';
{
  const { page, contexte, suivi, erreursInattendues } = await nouvellePage({ brancher: { lenteur: (u) => (u.pathname === '/api/sante' ? 1500 : 0) } });
  await page.goto(`${banc.base}admin/`);
  await page.waitForTimeout(900);
  verifier(await page.isVisible('#reveil') && /Connexion au serveur/.test(await page.textContent('#reveil')), 'réveil du serveur : « Connexion au serveur… » affiché pendant l’attente');
  await page.waitForSelector('#reveil', { state: 'hidden', timeout: 5000 });
  verifier(true, 'réveil : le message disparaît quand le serveur répond');
  await page.screenshot({ path: join(CAPTURES, 'admin-connexion-375.png') });

  // Échecs : même message pour l'identifiant et pour le mot de passe.
  await page.fill('#identifiant', banc.identifiant);
  await page.fill('#mot-de-passe', 'mauvais-mot-de-passe');
  await page.click('#bouton-connexion');
  await page.waitForSelector('#erreur-connexion:not([hidden])');
  const m1 = await page.textContent('#erreur-connexion');
  await page.fill('#identifiant', 'inconnu');
  await page.fill('#mot-de-passe', banc.motDePasse);
  await page.click('#bouton-connexion');
  await page.waitForFunction(() => document.getElementById('bouton-connexion').disabled === false);
  const m2 = await page.textContent('#erreur-connexion');
  verifier(m1 === m2 && m1 === 'Identifiant ou mot de passe incorrect.', `échec : même message pour identifiant et mot de passe (« ${m1} »)`);
  verifier(await page.inputValue('#mot-de-passe') === '', 'échec : mot de passe effacé');

  await page.fill('#identifiant', banc.identifiant);
  await page.fill('#mot-de-passe', banc.motDePasse);
  await page.click('#bouton-connexion');
  await page.waitForSelector('#ecran-liste:not([hidden])');
  verifier(true, 'connexion réussie : liste des articles');
  const stockee = await page.evaluate(() => JSON.parse(sessionStorage.getItem('z-survival-admin.session')));
  verifier(typeof stockee?.jeton === 'string' && Math.abs(stockee.fin - Date.now() - 2 * 3600e3) < 60e3, 'jeton gardé en sessionStorage, fin dans 2 heures (horloge de l’appareil)');
  verifier(await page.isVisible('#liste-vide'), 'liste vide : message « Aucun article »');

  // Création : titre → slug, barre de mise en forme.
  await page.click('#nouvel-article');
  await page.fill('#titre_fr', 'Nouvelle carte : l’hôpital !');
  slugPrincipal = await page.inputValue('#slug');
  verifier(slugPrincipal === 'nouvelle-carte-l-hopital', `slug calculé depuis le titre FR (${slugPrincipal})`);
  await page.fill('#contenu_fr', 'Intro');
  await page.focus('#contenu_fr');
  await page.evaluate(() => { const z = document.getElementById('contenu_fr'); z.setSelectionRange(0, 5); });
  await page.click('#panneau-fr [data-format=gras]');
  await page.evaluate(() => { const z = document.getElementById('contenu_fr'); z.setSelectionRange(z.value.length, z.value.length); });
  await page.keyboard.type('\nmot');
  await page.evaluate(() => { const z = document.getElementById('contenu_fr'); z.setSelectionRange(z.value.length - 3, z.value.length); });
  await page.click('#panneau-fr [data-format=italique]');
  await page.evaluate(() => { const z = document.getElementById('contenu_fr'); z.setSelectionRange(z.value.length, z.value.length); });
  await page.keyboard.type('\nIntertitre');
  await page.click('#panneau-fr [data-format=titre]');
  await page.evaluate(() => { const z = document.getElementById('contenu_fr'); z.setSelectionRange(z.value.length, z.value.length); });
  await page.keyboard.type('\nplanches\nclous');
  await page.evaluate(() => { const z = document.getElementById('contenu_fr'); z.setSelectionRange(z.value.lastIndexOf('planches'), z.value.length); });
  await page.click('#panneau-fr [data-format=liste]');
  await page.evaluate(() => { const z = document.getElementById('contenu_fr'); z.setSelectionRange(z.value.length, z.value.length); });
  await page.keyboard.type('\n\nVoir le ');
  suivi.reponses.push('https://example.org/guide');
  await page.click('#panneau-fr [data-format=lien]');
  const texte = await page.inputValue('#contenu_fr');
  verifier(texte === '**Intro**\n*mot*\n## Intertitre\n- planches\n- clous\n\nVoir le [texte du lien](https://example.org/guide)',
    `barre de mise en forme : gras, italique, titre, liste, lien (${JSON.stringify(texte)})`);
  const tailles = await page.$$eval('#panneau-fr .admin-outils button', (l) => l.map((b) => Math.min(b.offsetWidth, b.offsetHeight)));
  verifier(tailles.every((t) => t >= 44), `boutons de mise en forme utilisables au pouce (≥ 44 px : ${tailles.join(', ')})`);

  // Enregistrer en brouillon.
  await page.click('#bouton-enregistrer');
  await page.waitForFunction(() => document.getElementById('statut-article').dataset.statut === 'brouillon');
  verifier(true, 'enregistré en brouillon (statut « Brouillon »)');
  verifier((await banc.api('GET', '/api/articles?lang=fr')).json.total === 0, 'brouillon invisible côté public');

  // Image : refus côté page (mauvais type, trop lourde), puis vraie photo.
  await page.setInputFiles('#image-fichier', { name: 'anim.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await page.waitForSelector('#message:not([hidden])');
  verifier(/JPEG, PNG ou WebP/.test(await page.textContent('#message')), 'image : mauvais type refusé par la page');
  await page.setInputFiles('#image-fichier', { name: 'enorme.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(8 * 1024 * 1024 + 10) });
  await page.waitForFunction(() => /trop lourde/.test(document.getElementById('message').textContent));
  verifier(true, 'image : plus de 8 Mo refusée par la page');
  await page.setInputFiles('#image-fichier', { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: photo });
  await page.waitForSelector('#image-apercu:not([hidden])');
  verifier((await page.getAttribute('#image-apercu', 'src')).startsWith('blob:'), 'image : aperçu de la photo choisie');
  verifier(await page.isVisible('#image-envoyer'), 'image : bouton « Envoyer l’image »');
  await page.click('#image-envoyer');
  await page.waitForFunction(() => /Image envoyée/.test(document.getElementById('image-etat').textContent), null, { timeout: 15000 });
  const etatImage = await page.textContent('#image-etat');
  verifier(/1200 × 1600/.test(etatImage) && /environ une minute/.test(etatImage), `image envoyée, délai de publication annoncé (« ${etatImage.slice(0, 90)}… »)`);
  const commit = banc.github.commits.at(-1);
  imagePrincipale = commit?.chemin ?? '';
  verifier(/^img\/actus\/nouvelle-carte-l-hopital-[0-9a-f]{8}\.webp$/.test(imagePrincipale) && commit.branche === 'main' && commit.auteur?.name === 'Z-Survival admin' && commit.depot === 'Nowyyy/Z-Survival-Website',
    `commit simulé : ${commit?.depot} ${commit?.branche} ${imagePrincipale} (auteur ${commit?.auteur?.name})`);
  const publie = readFileSync(join(banc.dossierSite, imagePrincipale));
  const infos = await sharp(publie).metadata();
  verifier(infos.format === 'webp' && infos.exif === undefined && !publie.includes(Buffer.from('Maison-Secrete')) && !publie.includes(Buffer.from('TelephoneDuProprietaire')),
    'image publiée : WebP, aucune métadonnée (EXIF, GPS, appareil)');
  verifier(await page.isVisible('#image-retirer') && /Remplacer/.test(await page.textContent('#image-choisir')), 'image : « Remplacer » et « Retirer » proposés');

  // Alerte de modifications non enregistrées (image ajoutée, pas encore enregistrée).
  suivi.reponses.push(false);
  await page.click('#retour-liste');
  verifier(suivi.dialogues.at(-1)?.type === 'confirm' && /pas enregistrées/.test(suivi.dialogues.at(-1).message) && await page.isVisible('#ecran-editeur'),
    'modifications non enregistrées : confirmation avant de quitter, on reste dans l’éditeur si on refuse');

  // Aperçu FR puis EN (sans anglais : version française + « (FR) »).
  await page.click('#bouton-apercu');
  await page.waitForSelector('#apercu[open]');
  verifier(await page.textContent('#apercu-article .actu-titre') === 'Nouvelle carte : l’hôpital !' && await page.locator('#apercu-article .actu-texte strong').count() === 1,
    'aperçu FR : titre et texte mis en forme');
  verifier(await page.locator('#apercu-article .actu-texte h3').textContent() === 'Intertitre' && await page.locator('#apercu-article .actu-texte li').count() === 2, 'aperçu : intertitre et liste');
  await page.screenshot({ path: join(CAPTURES, 'admin-apercu-fr-375.png') });
  await page.click('[data-apercu=en]');
  verifier(await page.isVisible('#apercu-article .actu-mention-fr') && /\(FR\)/.test(await page.textContent('#apercu-carte')), 'aperçu EN sans anglais : version française avec « (FR) »');
  await page.click('#apercu-fermer');
  await page.click('#onglet-en');
  await page.fill('#titre_en', 'New map: the hospital!');
  await page.fill('#contenu_en', 'The **hospital** is open.');
  await page.click('#bouton-apercu');
  await page.click('[data-apercu=en]');
  verifier(await page.textContent('#apercu-article .actu-titre') === 'New map: the hospital!' && !(await page.isVisible('#apercu-article .actu-mention-fr')), 'aperçu EN avec anglais');
  await page.screenshot({ path: join(CAPTURES, 'admin-apercu-en-375.png') });
  await page.click('#apercu-fermer');

  await page.screenshot({ path: join(CAPTURES, 'admin-editeur-375.png'), fullPage: true });

  // Publier.
  await page.click('#bouton-publier');
  await page.waitForFunction(() => document.getElementById('statut-article').dataset.statut === 'publie');
  const pub = (await banc.api('GET', '/api/articles?lang=en')).json;
  verifier(pub.total === 1 && pub.articles[0].titre === 'New map: the hospital!' && pub.articles[0].image === imagePrincipale, 'publié : visible côté public (FR et EN, image)');
  verifier(await page.isVisible('#bouton-depublier') && !(await page.isVisible('#bouton-publier')), 'publié : « Dépublier » remplace « Publier »');

  // Modifier un article publié.
  await page.click('#onglet-fr');
  await page.fill('#titre_fr', 'Nouvelle carte : l’hôpital (mise à jour)');
  verifier(await page.inputValue('#slug') === slugPrincipal, 'article existant : le slug ne suit plus le titre');
  await page.click('#bouton-enregistrer');
  await page.waitForFunction(() => /en ligne/.test(document.getElementById('message').textContent));
  verifier((await banc.api('GET', `/api/articles/${slugPrincipal}?lang=fr`)).json.article.titre === 'Nouvelle carte : l’hôpital (mise à jour)', 'modification d’un article publié : en ligne');

  // Dépublier puis republier.
  suivi.reponses.push(true);
  await page.click('#bouton-depublier');
  await page.waitForFunction(() => document.getElementById('statut-article').dataset.statut === 'brouillon');
  verifier((await banc.api('GET', '/api/articles?lang=fr')).json.total === 0, 'dépublié : invisible côté public');
  await page.click('#bouton-publier');
  await page.waitForFunction(() => document.getElementById('statut-article').dataset.statut === 'publie');
  verifier((await banc.api('GET', '/api/articles?lang=fr')).json.total === 1, 'republié');

  // Liste : du plus récent au plus ancien, avec le statut.
  await page.click('#retour-liste');
  await page.waitForSelector('.admin-article');
  await page.click('#nouvel-article');
  await page.fill('#titre_fr', 'Article à supprimer');
  await page.click('#bouton-enregistrer');
  await page.waitForFunction(() => document.getElementById('statut-article').dataset.statut === 'brouillon');
  await page.click('#retour-liste');
  await page.waitForFunction(() => document.querySelectorAll('.admin-article').length === 2);
  const lignes = await page.$$eval('.admin-article', (l) => l.map((b) => `${b.querySelector('.admin-article-titre').textContent} [${b.querySelector('.admin-statut').textContent}]`));
  verifier(lignes[0] === 'Article à supprimer [Brouillon]' && lignes[1].endsWith('[Publié]'), `liste avec statuts, plus récent d’abord (${lignes.join(' ; ')})`);
  await page.screenshot({ path: join(CAPTURES, 'admin-liste-375.png') });

  // Supprimer (avec confirmation ; refus d'abord).
  await page.click('.admin-article >> nth=0');
  await page.waitForSelector('#zone-suppression:not([hidden])');
  suivi.reponses.push(false);
  await page.click('#bouton-supprimer');
  verifier(/définitivement/.test(suivi.dialogues.at(-1).message) && await page.isVisible('#ecran-editeur'), 'supprimer : confirmation demandée (refus : rien ne change)');
  suivi.reponses.push(true);
  await page.click('#bouton-supprimer');
  await page.waitForFunction(() => !document.getElementById('ecran-liste').hidden && document.querySelectorAll('.admin-article').length === 1);
  verifier(true, 'supprimer : article supprimé, retour à la liste');

  // Bibliothèque : réutiliser l'image déjà envoyée (rien n'est republié).
  const commitsAvant = banc.github.commits.length;
  await page.click('#nouvel-article');
  await page.fill('#titre_fr', 'Article qui réutilise l’image');
  await page.click('#image-bibliotheque');
  await page.waitForSelector('#bibliotheque[open] .admin-vignette');
  const vignettes = await page.$$eval('.admin-vignette', (l) => l.map((v) => v.querySelector('.admin-vignette-usage').textContent));
  verifier(vignettes.length === 1 && /^Utilisée par : Nouvelle carte/.test(vignettes[0]), `bibliothèque : image déjà envoyée, avec l’article qui l’utilise (« ${vignettes[0]} »)`);
  verifier(await page.locator('.admin-vignette .admin-bouton-danger').count() === 0, 'bibliothèque : pas de « Supprimer » pour une image utilisée');
  await page.screenshot({ path: join(CAPTURES, 'admin-bibliotheque-375.png') });
  await page.click('.admin-vignette .bouton-principal');
  await page.waitForSelector('#bibliotheque[open]', { state: 'detached' });
  verifier(/rien n’est republié/.test(await page.textContent('#image-etat')) && await page.isVisible('#image-apercu'), 'bibliothèque : image reprise, aperçu affiché, « rien n’est republié »');
  await page.click('#bouton-enregistrer');
  await page.waitForFunction(() => document.getElementById('statut-article').dataset.statut === 'brouillon');
  const reutilise = (await banc.api('GET', '/api/admin/articles', { jeton: await banc.connecter() })).json.articles.find((a) => a.slug === 'article-qui-reutilise-l-image');
  verifier(reutilise?.image === imagePrincipale && banc.github.commits.length === commitsAvant, 'image réutilisée enregistrée dans l’article, aucun nouveau commit');

  // La même photo envoyée de nouveau pour un autre article : le fichier existant est repris.
  await page.setInputFiles('#image-fichier', { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: photo });
  await page.click('#image-envoyer');
  await page.waitForFunction(() => /Image envoyée/.test(document.getElementById('image-etat').textContent), null, { timeout: 15000 });
  verifier(banc.github.commits.length === commitsAvant, 'même photo envoyée pour un autre article : fichier existant repris, aucun nouveau commit');

  // Supprimer cet article : l'image est gardée (l'article principal l'utilise).
  suivi.reponses.push(true);
  await page.click('#bouton-supprimer');
  verifier(/Son image sera aussi supprimée/.test(suivi.dialogues.at(-1).message), 'confirmation de suppression : l’image partira aussi (sauf si partagée)');
  await page.waitForFunction(() => /gardée : un autre article/.test(document.getElementById('message').textContent), null, { timeout: 8000 }).catch(() => {});
  verifier(/gardée : un autre article/.test(await page.textContent('#message')) && existsSync(join(banc.dossierSite, imagePrincipale)) && banc.github.suppressions.length === 0,
    `article supprimé, image gardée car partagée (« ${(await page.textContent('#message')).trim()} »)`);

  // Réponse 401 du serveur : déconnexion propre.
  await page.route(`${ADRESSE_SERVEUR}/api/admin/articles?*`, (r) => r.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"erreur":"Connexion requise."}' }), { times: 1 });
  await page.click('#actualiser');
  await page.waitForSelector('#ecran-connexion:not([hidden])');
  verifier(/Reconnectez-vous/.test(await page.textContent('#erreur-connexion')) && await page.evaluate(() => sessionStorage.getItem('z-survival-admin.session')) === null,
    'réponse 401 : retour à l’écran de connexion, jeton effacé');
  verifier(erreursInattendues(HTTP_VOULU).length === 0, `admin : aucune erreur console inattendue (${erreursInattendues(HTTP_VOULU).join(' | ')})`);
  await contexte.close();
}

// Alerte du navigateur en quittant la page avec des modifications (beforeunload).
{
  const { page, contexte, suivi } = await nouvellePage();
  await page.goto(`${banc.base}admin/`);
  await page.fill('#identifiant', banc.identifiant);
  await page.fill('#mot-de-passe', banc.motDePasse);
  await page.click('#bouton-connexion');
  await page.click('#nouvel-article');
  await page.fill('#titre_fr', 'Brouillon pas enregistré');
  await page.close({ runBeforeUnload: true });
  await pause(500);
  verifier(suivi.dialogues.some((d) => d.type === 'beforeunload'), 'quitter la page avec des modifications : alerte du navigateur');
  await contexte.close();
}

// Expiration du jeton (2 heures) : horloge simulée ; le texte non enregistré revient après la reconnexion.
{
  const { page, contexte } = await nouvellePage({ horloge: true });
  await page.goto(`${banc.base}admin/`);
  await page.fill('#identifiant', banc.identifiant);
  await page.fill('#mot-de-passe', banc.motDePasse);
  await page.click('#bouton-connexion');
  await page.waitForSelector('#ecran-liste:not([hidden])');
  await page.click('#nouvel-article');
  await page.fill('#titre_fr', 'Texte écrit avant l’expiration');
  await page.clock.fastForward('02:00:30');
  await page.waitForSelector('#ecran-connexion:not([hidden])');
  const raison = await page.textContent('#erreur-connexion');
  verifier(/Session expirée/.test(raison) && /gardé/.test(raison), `jeton expiré : retour à la connexion, texte gardé (« ${raison} »)`);
  await page.clock.resume();
  await page.fill('#mot-de-passe', banc.motDePasse);
  await page.click('#bouton-connexion');
  await page.waitForSelector('#ecran-editeur:not([hidden])');
  verifier(await page.inputValue('#titre_fr') === 'Texte écrit avant l’expiration', 'après reconnexion : le texte non enregistré est rouvert');
  await contexte.close();
}

// Mise en page de l'admin à d'autres tailles.
for (const [largeur, hauteur, reduit] of [[320, 568, false], [1440, 900, false], [375, 667, true]]) {
  const { page, contexte, erreursInattendues } = await nouvellePage({ largeur, hauteur, reduit });
  await page.goto(`${banc.base}admin/`);
  verifier(!(await debordement(page)), `admin ${largeur} × ${hauteur}${reduit ? ' (mouvement réduit)' : ''} : connexion sans débordement`);
  await page.fill('#identifiant', banc.identifiant);
  await page.fill('#mot-de-passe', banc.motDePasse);
  await page.click('#bouton-connexion');
  await page.click('.admin-article >> nth=0');
  await page.waitForSelector('#ecran-editeur:not([hidden])');
  await pause(300);
  verifier(!(await debordement(page)), `admin ${largeur} × ${hauteur} : éditeur sans débordement`);
  await page.screenshot({ path: join(CAPTURES, `admin-editeur-${largeur}${reduit ? '-reduit' : ''}.png`) });
  verifier(erreursInattendues(HTTP_VOULU).length === 0, `admin ${largeur} × ${hauteur} : aucune erreur console (${erreursInattendues(HTTP_VOULU).join(' | ')})`);
  await contexte.close();
}

// ---------- Données du site : un article FR seulement, un article piégé, un brouillon ----------
const jeton = await banc.connecter();
const creer = async (corps, publier = true) => {
  const r = await banc.api('POST', '/api/admin/articles', { jeton, corps });
  if (publier) await banc.api('POST', `/api/admin/articles/${r.json.article.id}/publier`, { jeton });
  return r.json.article;
};
await creer({ slug: 'seulement-en-francais', titre_fr: 'Seulement en français', contenu_fr: 'Texte **français** seulement.', date_publication: '2026-11-10T10:00:00Z' });
await creer({
  slug: 'article-piege', date_publication: '2026-11-01T10:00:00Z',
  titre_fr: 'Piège <img src=x onerror="window.__pirate=1">',
  contenu_fr: '<script>window.__pirate=2</script>\n\n<img src=x onerror="window.__pirate=3">\n\n[clic](javascript:window.__pirate=4) [data](data:text/html,<script>parent.__pirate=5</script>) [ok](https://example.org)\n\n**<b onmouseover="window.__pirate=6">gras</b>**',
});
await creer({ slug: 'brouillon-cache', titre_fr: 'Brouillon caché', contenu_fr: 'Rien.' }, false);

// ---------- Site ----------
for (const [largeur, hauteur] of [[375, 667], [320, 568], [1440, 900]]) {
  for (const reduit of [false, true]) {
    const nom = `${largeur} × ${hauteur}${reduit ? ', mouvement réduit' : ''}`;
    console.log(`\n# Site (${nom})`);
    const { page, contexte, erreursInattendues } = await nouvellePage({ largeur, hauteur, reduit, brancher: { lenteur: (u) => (u.pathname === '/api/articles' ? 1200 : 0) } });
    await page.goto(`${banc.base}?lang=fr#news`);
    await page.waitForSelector('.news-squelette', { timeout: 3000 }).catch(() => {});
    verifier(await page.locator('.news-squelette').count() === 3 && await page.getAttribute('#news-liste', 'aria-busy') === 'true', 'chargement : 3 cartes squelettes');
    if (largeur === 375 && !reduit) await page.screenshot({ path: join(CAPTURES, 'site-squelettes-375.png') });
    await page.waitForSelector('.news-lien');
    const titres = await page.$$eval('.news-titre', (l) => l.map((e) => e.textContent));
    verifier(titres.length === 3 && titres[0].startsWith('Nouvelle carte') && titres[1] === 'Seulement en français' && titres[2].startsWith('Piège') && !titres.includes('Brouillon caché'),
      `seuls les articles publiés, du plus récent au plus ancien (${titres.length})`);
    await page.waitForFunction(() => document.querySelector('.news-visuel img')?.complete, null, { timeout: 5000 }).catch(() => {});
    const img = await page.$eval('.news-visuel img', (i) => ({ largeur: i.naturalWidth, src: i.getAttribute('src') })).catch(() => null);
    verifier(img?.largeur === 1200 && img.src === imagePrincipale, `carte : image de l'article (${img?.src})`);
    verifier(await page.locator('.news-visuel-vide').count() === 2, 'carte sans image : motif de repli (Z rouge)');
    verifier(!(await debordement(page)), 'section Actualités sans débordement horizontal');
    await page.waitForTimeout(reduit ? 100 : 900);
    await page.screenshot({ path: join(CAPTURES, `site-actus-${largeur}${reduit ? '-reduit' : ''}.png`) });

    // Article complet : ouverture, adresse, focus, Échap.
    await page.click('.news-lien >> nth=0');
    await page.waitForSelector('#actu-vue[open]');
    verifier(await page.evaluate(() => location.hash) === `#actu/${slugPrincipal}`, `toucher une carte : article complet, adresse #actu/${slugPrincipal}`);
    verifier(await page.evaluate(() => document.getElementById('actu-vue').contains(document.activeElement)), 'focus dans la fenêtre de l’article');
    verifier(await page.locator('#actu-article .actu-texte li').count() === 2 && await page.locator('#actu-article .actu-texte a[rel="noopener noreferrer"][target="_blank"]').count() === 1,
      'article complet : Markdown mis en forme, lien sûr (noopener noreferrer)');
    await page.waitForTimeout(reduit ? 50 : 400);
    const boite = await page.$eval('#actu-vue', (d) => { const r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; });
    verifier(boite, 'fenêtre de l’article dans l’écran');
    await page.screenshot({ path: join(CAPTURES, `site-article-${largeur}${reduit ? '-reduit' : ''}.png`) });
    await page.keyboard.press('ArrowDown');
    verifier(await page.evaluate(() => document.body.dataset.section) === 'news', 'flèches dans l’article : les sections ne bougent pas');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#actu-vue[open]', { state: 'detached' });
    await page.waitForFunction(() => location.hash === '#news', null, { timeout: 3000 }).catch(() => {});
    verifier(await page.evaluate(() => location.hash) === '#news', 'Échap : fenêtre fermée, retour à #news');
    await page.waitForFunction(() => document.activeElement?.classList.contains('news-lien'), null, { timeout: 1500 }).catch(() => {});
    verifier(await page.evaluate(() => document.activeElement?.getAttribute('href') === document.querySelector('.news-lien').getAttribute('href')), 'focus rendu à la carte');

    // Retour du navigateur.
    await page.click('.news-lien >> nth=1');
    await page.waitForSelector('#actu-vue[open]');
    await page.goBack();
    await page.waitForSelector('#actu-vue[open]', { state: 'detached' });
    verifier(await page.evaluate(() => location.hash) === '#news' && await page.evaluate(() => document.body.dataset.section) === 'news', 'retour du navigateur : fenêtre fermée, on reste sur Actualités');
    await page.goForward();
    await page.waitForSelector('#actu-vue[open]');
    verifier(await page.textContent('#actu-article .actu-titre') === 'Seulement en français', 'avance du navigateur : l’article revient');
    await page.click('.actu-fermer');
    await page.waitForSelector('#actu-vue[open]', { state: 'detached' });

    // Article piégé : rien ne s'exécute.
    await page.click('.news-lien >> nth=2');
    await page.waitForSelector('#actu-vue[open]');
    await page.hover('#actu-article .actu-texte strong').catch(() => {});
    await pause(300);
    const piege = await page.evaluate(() => ({
      pirate: window.__pirate ?? null,
      scripts: document.querySelectorAll('#actu-article script, .news-liste script').length,
      images: document.querySelectorAll('#actu-article .actu-texte img, .news-titre img').length,
      gestionnaires: [...document.querySelectorAll('#actu-article *')].filter((e) => [...e.attributes].some((a) => a.name.startsWith('on'))).length,
      liens: [...document.querySelectorAll('#actu-article a')].map((a) => a.href),
    }));
    verifier(piege.pirate === null && piege.scripts === 0 && piege.images === 0 && piege.gestionnaires === 0, 'article piégé : aucun script, aucune image, aucun gestionnaire, rien d’exécuté');
    verifier(piege.liens.length === 1 && piege.liens[0] === 'https://example.org/', `article piégé : seul le lien https reste (${piege.liens.join(', ')})`);
    await page.keyboard.press('Escape');

    // Anglais : les actualités suivent ; sans anglais → français avec « (FR) ».
    await page.click('.entete .langue-bouton');
    await page.click('.entete .langue-choix[data-langue=en]');
    await page.waitForFunction(() => document.querySelector('.news-titre')?.textContent === 'New map: the hospital!', null, { timeout: 8000 }).catch(() => {});
    const titresEn = await page.$$eval('.news-titre', (l) => l.map((e) => e.textContent));
    verifier(titresEn[0] === 'New map: the hospital!', 'changement de langue : les actualités passent en anglais');
    const mention = await page.$$eval('.news-carte', (l) => l.map((c) => Boolean(c.querySelector('.actu-mention-fr'))));
    verifier(mention.join() === 'false,true,true', 'site anglais : « (FR) » sur les articles sans version anglaise');
    verifier(await page.getAttribute('.news-carte >> nth=1 >> .news-titre', 'lang') === 'fr', 'titre français marqué lang="fr" sur le site anglais');
    if (largeur === 375 && !reduit) await page.screenshot({ path: join(CAPTURES, 'site-actus-en-375.png') });
    verifier(erreursInattendues().length === 0, `aucune erreur console, aucun fichier manquant (${erreursInattendues().join(' | ')})`);
    await contexte.close();
  }
}

console.log('\n# Site : adresse partageable, erreur, bandeau');
{
  // Ouverture directe d'une adresse d'article : section Actualités, article ouvert, pas d'entrée de l'accueil.
  const { page, contexte, erreursInattendues } = await nouvellePage();
  await page.goto(`${banc.base}?lang=en#actu/seulement-en-francais`);
  await page.waitForSelector('#actu-vue[open] .actu-titre');
  verifier(await page.textContent('#actu-article .actu-titre') === 'Seulement en français' && await page.isVisible('#actu-article .actu-mention-fr'),
    'adresse #actu/… ouverte directement : article affiché (repli FR avec « (FR) » sur le site anglais)');
  verifier(await page.evaluate(() => document.body.dataset.section) === 'news' && !(await page.evaluate(() => document.documentElement.classList.contains('entree-accueil'))),
    'adresse #actu/… : section Actualités dessous, pas d’entrée de l’accueil');
  verifier(await page.evaluate(() => location.hash) === '#actu/seulement-en-francais', 'adresse #actu/… gardée');
  await page.click('.actu-fermer');
  await page.waitForFunction(() => location.hash === '#news', null, { timeout: 3000 }).catch(() => {});
  verifier(await page.evaluate(() => location.hash) === '#news', 'fermeture : adresse #news');
  await page.goto(`${banc.base}?lang=fr#actu/n-existe-pas`);
  await page.waitForFunction(() => /n’existe pas/.test(document.querySelector('#actu-vue[open] .actu-message')?.textContent), null, { timeout: 8000 }).catch(() => {});
  verifier(/n’existe pas/.test(await page.textContent('.actu-message')), 'article inconnu : message clair');
  verifier(erreursInattendues(HTTP_VOULU).length === 0, `aucune erreur console (${erreursInattendues(HTTP_VOULU).join(' | ')})`);
  await contexte.close();
}
{
  // Serveur injoignable : message sobre, le reste du site fonctionne.
  const { page, contexte, erreursInattendues } = await nouvellePage({ brancher: { coupe: () => true } });
  await page.goto(`${banc.base}?lang=fr#news`);
  await page.waitForSelector('#news-etat[data-etat="erreur"]');
  verifier(await page.textContent('#news-etat') === 'Actualités indisponibles pour le moment.', 'serveur injoignable : « Actualités indisponibles pour le moment »');
  await page.click('.nav-sections a[data-section=weapons]');
  await page.waitForFunction(() => document.body.dataset.section === 'weapons');
  verifier(true, 'serveur injoignable : la navigation fonctionne');
  await page.screenshot({ path: join(CAPTURES, 'site-erreur-375.png') });
  verifier(erreursInattendues(RESEAU_COUPE).length === 0, `aucune autre erreur console (${erreursInattendues(RESEAU_COUPE).join(' | ')})`);
  await contexte.close();
}
{
  // Bandeau d'alerte (?bandeau=1) : le dernier article publié en tête, avec un lien vers l'article.
  const { page, contexte, erreursInattendues } = await nouvellePage();
  await page.goto(`${banc.base}?bandeau=1&lang=fr`);
  await page.waitForSelector('.bandeau-actu a');
  const lien = await page.$eval('.bandeau-liste:not([aria-hidden]) li:first-child a', (a) => ({ href: a.getAttribute('href'), texte: a.textContent }));
  verifier(lien.href === `#actu/${slugPrincipal}` && /^Dernière transmission : Nouvelle carte/.test(lien.texte), `bandeau : dernier article en tête (« ${lien.texte} »)`);
  await page.$eval('.bandeau-liste:not([aria-hidden]) .bandeau-actu a', (a) => a.click());
  await page.waitForSelector('#actu-vue[open]');
  verifier(await page.evaluate(() => location.hash) === `#actu/${slugPrincipal}`, 'bandeau : le lien ouvre l’article');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#actu-vue[open]', { state: 'detached' });
  await page.waitForFunction(() => location.hash === '', null, { timeout: 3000 }).catch(() => {});
  verifier(await page.evaluate(() => location.hash) === '' && await page.evaluate(() => document.body.dataset.section) === 'accueil', 'bandeau : fermeture, retour à l’accueil');
  verifier(erreursInattendues().length === 0, `aucune erreur console (${erreursInattendues().join(' | ')})`);
  await contexte.close();
}

// ---------- Images : suppression avec l'article, image inutilisée supprimée depuis la bibliothèque ----------
console.log('\n# Admin : suppression des images');
{
  const { page, contexte, suivi, erreursInattendues } = await nouvellePage();
  await page.goto(`${banc.base}admin/`);
  await page.fill('#identifiant', banc.identifiant);
  await page.fill('#mot-de-passe', banc.motDePasse);
  await page.click('#bouton-connexion');
  await page.waitForSelector('.admin-article');
  // Une image envoyée puis retirée de son article : « Inutilisée » dans la bibliothèque, supprimable.
  await page.click('#nouvel-article');
  await page.fill('#titre_fr', 'Image orpheline');
  const autre = await sharp({ create: { width: 800, height: 450, channels: 3, background: '#224466' } }).png().toBuffer();
  await page.setInputFiles('#image-fichier', { name: 'autre.png', mimeType: 'image/png', buffer: autre });
  await page.click('#image-envoyer');
  await page.waitForFunction(() => /Image envoyée/.test(document.getElementById('image-etat').textContent), null, { timeout: 15000 });
  const orpheline = banc.github.commits.at(-1).chemin;
  await page.click('#image-retirer');
  await page.click('#bouton-enregistrer');
  await page.waitForFunction(() => document.getElementById('statut-article').dataset.statut === 'brouillon');
  await page.click('#image-bibliotheque');
  await page.waitForFunction(() => document.querySelectorAll('#bibliotheque[open] .admin-vignette').length === 2);
  const libre = page.locator('.admin-vignette', { hasText: 'Inutilisée' });
  verifier(await libre.count() === 1 && await libre.locator('.admin-bouton-danger').count() === 1, 'bibliothèque : image inutilisée signalée, avec « Supprimer »');
  suivi.reponses.push(true);
  await libre.locator('.admin-bouton-danger').click();
  await page.waitForFunction(() => document.querySelectorAll('#bibliotheque .admin-vignette').length === 1, null, { timeout: 8000 }).catch(() => {});
  verifier(!existsSync(join(banc.dossierSite, orpheline)) && banc.github.suppressions.at(-1)?.chemin === orpheline && banc.github.suppressions.at(-1)?.auteur?.name === 'Z-Survival admin',
    `image inutilisée supprimée du dépôt (commit simulé sur ${banc.github.suppressions.at(-1)?.branche}, ${orpheline})`);
  await page.click('#bibliotheque-fermer');
  suivi.reponses.push(true);
  await page.click('#bouton-supprimer');
  await page.waitForSelector('#ecran-liste:not([hidden])');

  // Supprimer l'article principal (seul à utiliser son image) : l'image est supprimée du dépôt.
  await page.locator('.admin-article', { hasText: 'Nouvelle carte' }).click();
  await page.waitForSelector('#zone-suppression:not([hidden])');
  suivi.reponses.push(true);
  await page.click('#bouton-supprimer');
  await page.waitForFunction(() => /image est supprimée du dépôt/.test(document.getElementById('message').textContent), null, { timeout: 8000 }).catch(() => {});
  verifier(/image est supprimée du dépôt/.test(await page.textContent('#message')) && !existsSync(join(banc.dossierSite, imagePrincipale)) && banc.github.suppressions.at(-1)?.chemin === imagePrincipale,
    `suppression de l’article : son image est supprimée du dépôt (« ${(await page.textContent('#message')).trim()} »)`);
  verifier((await banc.api('GET', '/api/articles?lang=fr')).json.articles.every((a) => a.slug !== slugPrincipal), 'article supprimé : plus visible côté public');
  verifier(erreursInattendues(HTTP_VOULU).length === 0, `aucune erreur console inattendue (${erreursInattendues(HTTP_VOULU).join(' | ')})`);
  await contexte.close();
}

// ---------- Blocage après 5 essais (en dernier : il bloque l'adresse locale 15 minutes) ----------
console.log('\n# Admin : blocage');
{
  const { page, contexte, erreursInattendues } = await nouvellePage();
  await page.goto(`${banc.base}admin/`);
  let message = '';
  for (let i = 0; i < 6; i += 1) {
    await page.fill('#identifiant', banc.identifiant);
    await page.fill('#mot-de-passe', `faux-${i}`);
    await page.click('#bouton-connexion');
    await page.waitForFunction(() => document.getElementById('bouton-connexion').disabled === false);
    message = await page.textContent('#erreur-connexion');
  }
  verifier(/bloquée pendant environ \d+ minutes?/.test(message) && /tout seul/.test(message), `blocage après 5 essais expliqué (« ${message} »)`);
  await page.screenshot({ path: join(CAPTURES, 'admin-blocage-375.png') });
  verifier(erreursInattendues(HTTP_VOULU).length === 0, 'aucune erreur console inattendue');
  await contexte.close();
}

// ---------- Secrets ----------
const journal = banc.journalServeur.join('\n');
verifier(banc.secrets.every((s) => !journal.includes(s)) && !journal.includes(banc.identifiant), 'journal du serveur : aucun secret (mot de passe, clé, empreinte, jeton GitHub, identifiant)');
verifier(banc.github.commits.length >= 2 && banc.github.suppressions.length === 2, `commits simulés : ${banc.github.commits.length} envois, ${banc.github.suppressions.length} suppressions`);

await navigateur.close();
banc.fermer();
console.log(`\n${reussites} vérifications réussies, ${echecs} en échec. Captures : ${CAPTURES}`);
process.exit(echecs ? 1 : 0);
