// Vérification de bout en bout de la page « Armes » de l'admin (lot 6a) : node outils/admin/verifier-armes-admin.mjs
// Banc local (outils/admin/banc.mjs) : copie publiée du site, vrai serveur sur SQLite, API GitHub simulée qui lit et écrit dans la copie.
// - l'écran « Armes » s'ouvre depuis « Pages du site » et lit contenus/armes.json (toutes les armes, cachées par défaut) ;
// - afficher une arme, écrire ses descriptions FR / EN, remplir ses statistiques et les afficher ; « Annuler les changements » ;
// - enregistrer : un commit « Z-Survival admin », le reste du fichier intact ; la section Armes du site (copie servie) montre l'arme, ses
//   textes et ses vraies barres, les autres restent des « ? » ;
// - statistiques affichées sans valeur : refusé côté admin ; fichier modifié ailleurs entre-temps : refus clair, rien d'écrasé ;
// - boutons de 44 px au moins ; rien ne dépasse à 320, 375 et 1440 px ; aucune erreur console.
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

const banc = await demarrerBanc();
const fichier = join(banc.dossierSite, 'contenus', 'armes.json');
const initial = JSON.parse(readFileSync(fichier, 'utf8'));
console.log(`Banc : ${banc.local} ; ${initial.armes.length} armes dans contenus/armes.json`);
const navigateur = await chromium.launch();

async function nouvellePage(largeur = 375, hauteur = 667) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
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
async function ouvrirArmes(page) {
  await page.click('#ouvrir-armes');
  await page.waitForSelector('#ecran-armes:not([hidden]) #armes-liste li');
}
const carte = (id) => `#armes-liste li:has(img[src$="/${id}-mini.webp"])`;

console.log('\n# Ouverture');
const { page, contexte, erreurs } = await nouvellePage();
await connecter(page);
const ordre = await page.$$eval('.admin-pages button', (bs) => bs.map((b) => b.id));
verifier(ordre.at(-1) === 'ouvrir-armes', `« Pages du site » : bouton « Armes » en dernier (${ordre.join(', ')})`);
await ouvrirArmes(page);
const n = await page.$$eval('#armes-liste li', (lis) => lis.length);
verifier(n === initial.armes.length, `armes lues dans contenus/armes.json (${n})`);
const cachees = await page.$$eval('#armes-liste li[data-cache="true"]', (lis) => lis.length);
verifier(cachees === initial.armes.filter((a) => a.prochainement).length, `armes cachées par défaut : ${cachees}`);
verifier(await page.textContent('#armes-statut') === `${initial.armes.filter((a) => !a.prochainement).length} affichée${initial.armes.filter((a) => !a.prochainement).length > 1 ? 's' : ''} sur ${n}`, `statut : « ${await page.textContent('#armes-statut')} »`);
verifier((await page.inputValue(`${carte('kar98k')} textarea[data-cle="description-fr"]`)) === initial.armes.find((a) => a.id === 'kar98k').description.fr, 'descriptions existantes lues');
const menu = await page.$$eval('#armes-chapitres button', (bs) => bs.map((b) => `${b.querySelector('.admin-armes-chapitre-nom').textContent}|${b.querySelector('.admin-armes-chapitre-detail').textContent}|${b.getAttribute('aria-current')}`));
verifier(menu.length === 1 && menu[0].startsWith(`Chapitre 1|${n} armes · `) && menu[0].endsWith('|true'), `menu des chapitres : « Chapitre 1 » choisi (${menu.join(', ')})`);

console.log('\n# Modifications');
await page.click(`${carte('m1911')} input[data-cle="afficher"]`);
verifier(await page.getAttribute(carte('m1911'), 'data-cache') === 'false', 'Colt : « Afficher sur le site » coché');
await page.fill(`${carte('m1911')} textarea[data-cle="description-fr"]`, 'Robuste et précise : l’arme de départ.');
await page.fill(`${carte('m1911')} textarea[data-cle="description-en"]`, 'Sturdy and accurate: the starting sidearm.');
for (const [c, v] of [['degats', '35'], ['cadence', '70'], ['portee', '45'], ['chargeur', '40']]) await page.fill(`${carte('m1911')} input[data-cle="stat-${c}"]`, v);
await page.click(`${carte('m1911')} input[data-cle="statsVisibles"]`);
verifier(await page.textContent('#armes-statut') === 'Non enregistré', 'statut « Non enregistré » dès le premier changement');
// Statistiques affichées sans valeur : refusé avant l'envoi.
await page.click(`${carte('kar98k')} input[data-cle="statsVisibles"]`);
await page.click('#armes-enregistrer');
verifier(await page.isVisible('#erreur-armes') && /Kar98k/.test(await page.textContent('#erreur-armes')), `stats affichées sans valeur : refusé (« ${await page.textContent('#erreur-armes')} »)`);
await page.click(`${carte('kar98k')} input[data-cle="statsVisibles"]`);

console.log('\n# Enregistrement');
const commitsAvant = banc.github.commits.length;
await page.click('#armes-enregistrer');
await page.waitForFunction(() => document.querySelector('#armes-statut')?.textContent.includes('affichée'));
const doc = JSON.parse(readFileSync(fichier, 'utf8'));
const colt = doc.armes.find((a) => a.id === 'm1911');
verifier(banc.github.commits.length === commitsAvant + 1 && banc.github.commits.at(-1).auteur?.name === 'Z-Survival admin', 'un commit « Z-Survival admin »');
verifier(colt.prochainement === false && colt.statsVisibles === true && JSON.stringify(colt.stats) === '{"degats":35,"cadence":70,"portee":45,"chargeur":40}', 'Colt : affiché, stats enregistrées et affichées');
verifier(colt.description.fr === 'Robuste et précise : l’arme de départ.' && colt.aRelire === false, 'Colt : description enregistrée (et marquée relue)');
verifier(JSON.stringify(doc.armes.filter((a) => a.id !== 'm1911')) === JSON.stringify(initial.armes.filter((a) => a.id !== 'm1911')), 'les autres armes sont intactes');
verifier(JSON.stringify(doc.chapitres) === JSON.stringify(initial.chapitres) && doc._aide === initial._aide, 'en-tête du fichier intact');
verifier(await page.textContent('#armes-statut') === `1 affichée sur ${n}`, `statut après enregistrement : « ${await page.textContent('#armes-statut')} »`);

console.log('\n# Annuler les changements');
await page.fill(`${carte('m1911')} textarea[data-cle="description-fr"]`, 'brouillon');
await page.click('#armes-annuler');
verifier(await page.inputValue(`${carte('m1911')} textarea[data-cle="description-fr"]`) === 'Robuste et précise : l’arme de départ.', 'annuler : retour au texte enregistré');

console.log('\n# Le site');
{
  const { page: site, erreurs: erreursSite } = await nouvellePage(375, 667);
  await site.goto(`${banc.base}?lang=fr&intro=0#weapons`);
  await site.waitForSelector('.arsenal[data-etat="pret"]');
  await site.evaluate(() => document.querySelector('.arsenal-miniature[data-arme="m1911"]').click());
  const vue = await site.evaluate(() => ({
    nom: document.querySelector('.arsenal-nom').textContent,
    description: document.querySelector('.arsenal-description').textContent,
    statsVisibles: document.querySelector('.arsenal').classList.contains('stats-visibles'),
    barre: getComputedStyle(document.querySelector('.arsenal-stat-remplissage')).getPropertyValue('--valeur').trim(),
    autres: [...document.querySelectorAll('.arsenal-miniature')].filter((b) => b.textContent.trim() === '?').length,
  }));
  verifier(vue.nom === 'Colt M1911' && vue.description === 'Robuste et précise : l’arme de départ.', `site : Colt affiché avec sa description (« ${vue.nom} »)`);
  verifier(vue.statsVisibles && vue.barre === '0.35', `site : vraies barres de stats (dégâts ${vue.barre})`);
  verifier(vue.autres === n - 1, `site : les ${n - 1} autres armes restent des « ? »`);
  verifier(erreursSite.length === 0, `site : aucune erreur console${erreursSite.length ? ` (${erreursSite.join(' | ')})` : ''}`);
}

console.log('\n# Conflit');
writeFileSync(fichier, readFileSync(fichier, 'utf8').replace('"ordre": 2,', '"ordre": 2, "x": 1,')); // modification faite ailleurs
await page.click(`${carte('kar98k')} input[data-cle="afficher"]`);
const avantConflit = readFileSync(fichier, 'utf8');
await page.click('#armes-enregistrer');
await page.waitForSelector('#erreur-armes:not([hidden])');
verifier(/modifiées ailleurs/.test(await page.textContent('#erreur-armes')) && readFileSync(fichier, 'utf8') === avantConflit, 'fichier modifié ailleurs : refus clair, rien d’écrasé');
await page.click('#armes-annuler');

console.log('\n# Chapitres');
{
  // Un deuxième chapitre (« La ville ») avec le Kar98k seul, écrit dans le fichier du banc.
  const doc2 = JSON.parse(readFileSync(fichier, 'utf8'));
  doc2.chapitres = [{ id: 1, nom: null }, { id: 2, nom: { fr: 'La ville', en: 'The city' } }];
  doc2.armes.find((a) => a.id === 'kar98k').chapitres = [2];
  writeFileSync(fichier, JSON.stringify(doc2, null, 2));
  for (const [l, h] of [[1440, 900], [375, 667]]) {
    const { page: p, contexte: c, erreurs: e } = await nouvellePage(l, h);
    await connecter(p);
    await ouvrirArmes(p);
    const etat = async () => p.evaluate(() => ({
      menu: [...document.querySelectorAll('#armes-chapitres button')].map((b) => [b.querySelector('.admin-armes-chapitre-nom').textContent, b.getAttribute('aria-current')]),
      titre: document.querySelector('#armes-chapitre-titre').textContent,
      cartes: [...document.querySelectorAll('#armes-liste li img')].map((i) => i.src.split('/').pop().replace('-mini.webp', '')),
    }));
    let v = await etat();
    verifier(JSON.stringify(v.menu) === JSON.stringify([['Chapitre 1', null], ['La ville', 'true']]) && v.titre === 'La ville' && JSON.stringify(v.cartes) === '["kar98k"]',
      `${l} px : deux chapitres ; le dernier (« La ville ») choisi d'abord, avec ses seules armes (${v.cartes.join(', ')})`);
    await p.click('#armes-chapitres button[data-chapitre="1"]');
    v = await etat();
    verifier(v.titre === 'Chapitre 1' && v.cartes.length === n - 1 && !v.cartes.includes('kar98k'), `${l} px : « Chapitre 1 » : ses ${v.cartes.length} armes, sans le Kar98k`);
    if (l === 1440) {
      await p.click('#armes-tout-afficher');
      const docVu = await p.evaluate(() => [...document.querySelectorAll('#armes-liste li')].every((li) => li.dataset.cache === 'false'));
      await p.click('#armes-chapitres button[data-chapitre="2"]');
      const kar = await p.getAttribute('#armes-liste li', 'data-cache');
      verifier(docVu && kar === 'true', '« Tout afficher » ne touche que le chapitre affiché');
      const detail = await p.textContent('#armes-chapitres button[data-chapitre="1"] .admin-armes-chapitre-detail');
      verifier(detail === `${n - 1} armes · ${n - 1} affichées`, `compteur du chapitre suivi en direct (« ${detail} »)`);
    }
    const place = await p.evaluate(() => {
      const nav = document.querySelector('.admin-armes-chapitres').getBoundingClientRect();
      const liste = document.querySelector('#armes-liste').getBoundingClientRect();
      return { gauche: nav.right <= liste.left, dessus: nav.bottom <= liste.top, deborde: document.documentElement.scrollWidth > innerWidth };
    });
    verifier(l === 1440 ? place.gauche : place.dessus && !place.deborde, `${l} px : menu des chapitres ${l === 1440 ? 'à gauche des armes' : 'au-dessus des armes, rien ne dépasse'}`);
    verifier(e.length === 0, `${l} px : aucune erreur console${e.length ? ` (${e.join(' | ')})` : ''}`);
    await c.close();
  }
}

console.log('\n# Mise en page');
for (const [l, h] of [[320, 568], [375, 667], [1440, 900]]) {
  const { page: p, contexte: c } = await nouvellePage(l, h);
  await connecter(p);
  await ouvrirArmes(p);
  const m = await p.evaluate(() => ({
    deborde: document.documentElement.scrollWidth > innerWidth,
    petits: [...document.querySelectorAll('#ecran-armes button, #ecran-armes .admin-interrupteur, #ecran-armes input[type="number"]')]
      .filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).length,
  }));
  verifier(!m.deborde && m.petits === 0, `${l} × ${h} : rien ne dépasse, zones de toucher de 44 px (${m.petits} trop petite(s))`);
  if (process.env.CAPTURES) await p.screenshot({ path: `${process.env.CAPTURES}/admin-armes-${l}.png`, fullPage: l !== 1440 ? false : false });
  await c.close();
}
const erreursAdmin = erreurs.filter((e) => !/status of 409/.test(e)); // la réponse 409 du test de conflit est voulue
verifier(erreursAdmin.length === 0, `admin : aucune erreur console${erreursAdmin.length ? ` (${erreursAdmin.join(' | ')})` : ''}`);
await contexte.close();

const journal = banc.journalServeur.join('\n');
verifier(banc.secrets.every((x) => !journal.includes(x)), 'aucun secret dans le journal du serveur');
await navigateur.close();
banc.fermer();
console.log(`\n${reussites} vérifications réussies, ${echecs} en échec.`);
process.exitCode = echecs ? 1 : 0;
