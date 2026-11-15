// Vérification de bout en bout du bandeau d'alerte dans l'admin (lot 3d) : node outils/admin/verifier-bandeau.mjs
// Banc local (outils/admin/banc.mjs) : copie publiée du site, vrai serveur sur SQLite, API GitHub simulée qui lit et écrit dans la copie.
// - l'écran « Bandeau d'alerte » s'ouvre depuis « Pages du site », sous « À propos », et lit contenus/bandeau.json ;
// - modifier un texte, cacher un message, changer l'ordre, supprimer, ajouter ; aperçu FR / EN ; « Annuler les changements » ;
// - enregistrer : un commit « Z-Survival admin » sur main, fichier au format du site ; l'accueil (copie servie) affiche les nouveaux messages ;
// - fichier modifié ailleurs entre-temps : enregistrement refusé avec un message clair, rien d'écrasé ;
// - texte français vide refusé côté admin ; boutons de 44 px au moins ; rien ne dépasse à 320, 375 et 1440 px ; aucune erreur console.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { demarrerBanc } from './banc.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let echecs = 0;
let reussites = 0;
const verifier = (ok, texte) => {
  if (ok) reussites += 1; else echecs += 1;
  console.log(`${ok ? '  ok ' : 'ÉCHEC'} ${texte}`);
};
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

const banc = await demarrerBanc();
const fichier = join(banc.dossierSite, 'contenus', 'bandeau.json');
const initial = JSON.parse(readFileSync(fichier, 'utf8')).messages;
console.log(`Banc : ${banc.local} ; ${initial.length} messages dans contenus/bandeau.json`);
const navigateur = await chromium.launch();

async function nouvellePage(largeur = 375, hauteur = 667) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1 });
  await banc.brancher(contexte);
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(`exception : ${e.message}`));
  page.on('dialog', (d) => d.accept());
  return { page, contexte, erreurs };
}
async function connecter(page) {
  await page.goto(`${banc.base}admin/`);
  await page.fill('#identifiant', banc.identifiant);
  await page.fill('#mot-de-passe', banc.motDePasse);
  await page.click('#bouton-connexion');
  await page.waitForSelector('#ecran-liste:not([hidden])');
}
const textesListe = (page) => page.$$eval('#bandeau-liste li', (lis) => lis.map((li) => ({
  fr: li.querySelector('input[data-cle="fr"]').value, en: li.querySelector('input[data-cle="en"]').value, actif: li.querySelector('input[data-cle="actif"]').checked,
})));
const apercu = (page) => page.$$eval('#bandeau-apercu-liste li', (lis) => lis.map((li) => li.textContent));

console.log('\n# Ouverture');
const { page, contexte, erreurs } = await nouvellePage();
await connecter(page);
const ordre = await page.$$eval('.admin-pages button', (bs) => bs.map((b) => b.id));
verifier(ordre.join() === 'ouvrir-page-a-propos,ouvrir-bandeau', `« Pages du site » : « À propos » puis « Bandeau d’alerte » (${ordre.join(', ')})`);
await page.click('#ouvrir-bandeau');
await page.waitForSelector('#ecran-bandeau:not([hidden])');
let liste = await textesListe(page);
verifier(JSON.stringify(liste.map((m) => m.fr)) === JSON.stringify(initial.map((m) => m.fr)), `messages lus dans contenus/bandeau.json (${liste.length})`);
verifier(await page.textContent('#bandeau-statut') === `${initial.length} messages · ${initial.filter((m) => m.actif !== false).length} affichés`, `statut : « ${await page.textContent('#bandeau-statut')} »`);
let ap = await apercu(page);
verifier(ap[0].startsWith('Dernière transmission') && ap.length === initial.length + 1, 'aperçu FR : dernier article en tête, puis les messages affichés');
await page.click('[data-apercu-bandeau="en"]');
ap = await apercu(page);
verifier(ap[1] === initial[0].en && (await page.textContent('#bandeau-apercu-titre')) === 'Alert', `aperçu EN : textes anglais (« ${ap[1]} »)`);
await page.click('[data-apercu-bandeau="fr"]');

console.log('\n# Modifications');
await page.fill('#bandeau-liste li[data-index="0"] input[data-cle="fr"]', 'Horde signalée près du supermarché');
await page.fill('#bandeau-liste li[data-index="0"] input[data-cle="en"]', 'Horde reported near the supermarket');
await page.click('#bandeau-liste li[data-index="1"] input[data-cle="actif"]');
verifier(await page.getAttribute('#bandeau-liste li[data-index="1"]', 'data-cache') === 'true', 'message caché : carte atténuée');
verifier(await page.textContent('#bandeau-statut') === 'Non enregistré', 'statut « Non enregistré » dès le premier changement');
await page.click('#bandeau-liste li[data-index="2"] [data-action="monter"]');
liste = await textesListe(page);
verifier(liste[1].fr === initial[2].fr && liste[2].fr === initial[1].fr, 'monter : le message 3 passe en 2');
verifier(await page.evaluate(() => document.activeElement?.dataset.action === 'monter'), 'le focus suit le bouton après le déplacement');
await page.click(`#bandeau-liste li[data-index="${initial.length - 1}"] [data-action="supprimer"]`);
verifier((await textesListe(page)).length === initial.length - 1, 'supprimer : un message de moins');
await page.click('#bandeau-ajouter');
verifier(await page.evaluate(() => document.activeElement?.dataset.cle === 'fr'), 'ajouter : le curseur est dans le nouveau champ français');
await page.click('#bandeau-enregistrer');
verifier(/Message \d+ : le texte français est obligatoire/.test(await page.textContent('#erreur-bandeau')), 'nouveau message vide : enregistrement refusé avec un message clair');
await page.keyboard.type('Ravitaillement largué au nord');
ap = await apercu(page);
verifier(ap.includes('Ravitaillement largué au nord') && !ap.includes(initial[1].fr), 'aperçu à jour : nouveau message présent, message caché absent');
await page.click('[data-apercu-bandeau="en"]');
ap = await apercu(page);
verifier(ap.includes('Ravitaillement largué au nord'), 'aperçu EN : message sans anglais affiché en français');
await page.click('[data-apercu-bandeau="fr"]');

console.log('\n# Mise en page (375 px)');
const mesures = await page.evaluate(() => {
  const trop = [...document.querySelectorAll('#ecran-bandeau button, #ecran-bandeau input[type="checkbox"]')].filter((e) => e.getClientRects().length)
    .map((e) => (e.type === 'checkbox' ? e.closest('label') : e)).filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.textContent.trim() || e.id);
  return { trop, debord: document.documentElement.scrollWidth - innerWidth };
});
verifier(mesures.trop.length === 0, `boutons et cases de 44 px de haut au moins (${mesures.trop.join(', ') || 'tous'})`);
verifier(mesures.debord <= 0, 'aucun défilement horizontal');

console.log('\n# Enregistrement');
const commitsAvant = banc.github.commits.length;
await page.click('#bandeau-enregistrer');
await page.waitForFunction(() => document.getElementById('bandeau-statut').textContent.includes('affiché'), null, { timeout: 15000 });
const commit = banc.github.commits.at(-1);
verifier(banc.github.commits.length === commitsAvant + 1 && commit.chemin === 'contenus/bandeau.json' && commit.branche === 'main' && commit.auteur?.name === 'Z-Survival admin',
  `un commit « Z-Survival admin » sur main (${commit?.message})`);
const ecrit = JSON.parse(readFileSync(fichier, 'utf8'));
verifier(ecrit.version === 1 && ecrit.messages.length === initial.length && ecrit.messages[0].fr === 'Horde signalée près du supermarché'
  && ecrit.messages[0].id === initial[0].id && ecrit.messages.at(-1).id === 'ravitaillement-largue-au-nord' && ecrit.messages.find((m) => m.fr === initial[1].fr)?.actif === false,
  'fichier écrit au format du site (identifiants gardés, nouveau message identifié, message caché « actif »: false)');
verifier(/en ligne|une minute/.test(await page.textContent('#message')), `message de confirmation (« ${(await page.textContent('#message')).trim()} »)`);
verifier(await page.textContent('#bandeau-statut') === `${initial.length} messages · ${initial.length - 1} affichés`, 'statut revenu à « enregistré »');

console.log('\n# Accueil (copie servie, comme GitHub Pages après republication)');
{
  const site = await nouvellePage(1440, 900);
  await site.page.goto(`${banc.base}?bandeau=1&lang=fr`);
  await site.page.waitForSelector('.accueil-bandeau:not([hidden]) .bandeau-liste li', { timeout: 15000 });
  const textes = await site.page.$$eval('.bandeau-liste:not([aria-hidden]) li', (lis) => lis.map((li) => li.textContent));
  verifier(textes.includes('Horde signalée près du supermarché') && textes.includes('Ravitaillement largué au nord') && !textes.includes(initial[1].fr),
    'l’accueil affiche les nouveaux messages, sans le message caché');
  await site.contexte.close();
}

console.log('\n# Modifié ailleurs entre-temps');
await page.fill('#bandeau-liste li[data-index="0"] input[data-cle="fr"]', 'Version de l’onglet');
const brut = readFileSync(fichier, 'utf8');
writeFileSync(fichier, brut.replace('Horde signalée près du supermarché', 'Modifié sur GitHub'));
const nbCommits = banc.github.commits.length;
await page.click('#bandeau-enregistrer');
await page.waitForSelector('#erreur-bandeau:not([hidden])');
verifier(/modifié ailleurs/.test(await page.textContent('#erreur-bandeau')) && banc.github.commits.length === nbCommits && readFileSync(fichier, 'utf8').includes('Modifié sur GitHub'),
  'enregistrement refusé, message clair, rien d’écrasé');
await page.click('#bandeau-annuler');
liste = await textesListe(page);
verifier(liste[0].fr === 'Horde signalée près du supermarché' && await page.textContent('#bandeau-statut') !== 'Non enregistré', '« Annuler les changements » revient à la dernière version enregistrée');
await page.click('#bandeau-retour');
await page.click('#ouvrir-bandeau');
await page.waitForSelector('#ecran-bandeau:not([hidden])');
verifier((await textesListe(page))[0].fr === 'Modifié sur GitHub', 'rouvrir le bandeau relit la version de GitHub');
verifier(erreurs.filter((e) => !/409/.test(e)).length === 0, `aucune erreur console inattendue (${erreurs.join(' | ')})`);
await contexte.close();

console.log('\n# Largeurs');
for (const [l, h] of [[320, 568], [1440, 900]]) {
  const v = await nouvellePage(l, h);
  await connecter(v.page);
  await v.page.click('#ouvrir-bandeau');
  await v.page.waitForSelector('#ecran-bandeau:not([hidden])');
  const r = await v.page.evaluate(() => ({
    debord: document.documentElement.scrollWidth - innerWidth,
    chevauchent: [...document.querySelectorAll('.admin-bandeau-outils')].some((o) => {
      const r = [...o.children].map((e) => e.getBoundingClientRect());
      return r.some((a, i) => r.slice(i + 1).some((b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5));
    }),
    surDeuxLignes: [...document.querySelectorAll('.admin-bandeau-outils .admin-bouton')].some((b) => b.getBoundingClientRect().height > 50),
  }));
  verifier(r.debord <= 0 && !r.chevauchent && !r.surDeuxLignes, `${l} × ${h} : rien ne dépasse, boutons Monter / Descendre / Supprimer sans chevauchement, chacun sur une ligne`);
  await v.page.screenshot({ path: `/tmp/bandeau-admin-${l}.png`, fullPage: true });
  verifier(v.erreurs.length === 0, `${l} × ${h} : aucune erreur console`);
  await v.contexte.close();
}

await navigateur.close();
banc.fermer();
console.log(`\n${reussites} vérifications réussies, ${echecs} en échec.`);
process.exit(echecs ? 1 : 0);
