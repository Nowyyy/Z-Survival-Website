// Vérification du lot 3f : node outils/verifier-lot-3f.mjs
// Banc local (outils/admin/banc.mjs) : copie publiée du site servie à la racine, vrai serveur sur SQLite, API GitHub simulée qui lit et écrit
// dans la copie.
// - admin : « Pages du site → Aperçu de partage » lit le titre et la description d'index.html ; aperçu à jour pendant la frappe ; compteurs ;
//   « Annuler » ; enregistrer : un commit « Z-Survival admin », seules les balises og:/twitter: title et description changent, la page servie
//   les montre ; index.html modifié ailleurs entre-temps : refus clair, rien d'écrasé ; titre ou description vides refusés ;
// - site : adresse de contact dans le pied de page (lien mailto, FR et EN) et dans les données structurées du studio ;
// - accueil en portrait : l'encart « Disponible sur navigateur » ne touche pas le titre, avec ou sans marge basse d'écran (iPhone en mode
//   application, simulée par Chromium) ;
// - aucune erreur console ; rien ne dépasse à 320, 375 et 1440 px.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { demarrerBanc } from './admin/banc.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
let echecs = 0;
let reussites = 0;
const verifier = (ok, texte) => { if (ok) reussites += 1; else echecs += 1; console.log(`${ok ? '  ok ' : 'ÉCHEC'} ${texte}`); };

const banc = await demarrerBanc();
const fichierIndex = join(banc.dossierSite, 'index.html');
const meta = (html, attr, nom) => new RegExp(`<meta ${attr}="${nom.replace(/[.:]/g, '\\$&')}" content="([^"]*)">`).exec(html)?.[1];
const initial = readFileSync(fichierIndex, 'utf8');
const navigateur = await chromium.launch();

async function nouvellePage(largeur = 375, hauteur = 667, options = {}) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1, ...options });
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

console.log('\n# Admin : aperçu de partage');
{
  const { page, contexte, erreurs } = await nouvellePage();
  await connecter(page);
  await page.click('#ouvrir-partage');
  await page.waitForSelector('#ecran-partage:not([hidden])');
  const titre0 = meta(initial, 'property', 'og:title');
  const desc0 = meta(initial, 'property', 'og:description');
  verifier(await page.inputValue('#partage_titre') === titre0 && await page.inputValue('#partage_description') === desc0, `lit index.html : « ${titre0} »`);
  verifier(await page.textContent('#partage-apercu-description') === desc0 && /\/ 300$/.test(await page.textContent('#partage-description-compteur')),
    'aperçu et compteur (… / 300)');
  await page.fill('#partage_titre', 'Z-Survival — essai « admin »');
  verifier(await page.textContent('#partage-apercu-titre') === 'Z-Survival — essai « admin »' && await page.textContent('#partage-statut') === 'Non enregistré',
    'aperçu à jour pendant la frappe, statut « Non enregistré »');
  await page.click('#partage-annuler');
  verifier(await page.inputValue('#partage_titre') === titre0, '« Annuler les changements » remet le texte en ligne');
  await page.fill('#partage_description', '   ');
  await page.click('#partage-enregistrer');
  verifier(await page.isVisible('#erreur-partage') && readFileSync(fichierIndex, 'utf8') === initial, 'description vide refusée, rien d’écrit');
  const nouveauTitre = 'Z-Survival — test & « guillemets »';
  const nouvelleDesc = 'Description d’essai : "survivre" < aube.';
  await page.fill('#partage_titre', nouveauTitre);
  await page.fill('#partage_description', nouvelleDesc);
  await page.click('#partage-enregistrer');
  await page.waitForFunction(() => /enregistré/.test(document.getElementById('message').textContent), null, { timeout: 15_000 });
  const apres = readFileSync(fichierIndex, 'utf8');
  verifier(meta(apres, 'property', 'og:title') === 'Z-Survival — test &amp; « guillemets »' && meta(apres, 'name', 'twitter:title') === meta(apres, 'property', 'og:title')
    && meta(apres, 'property', 'og:description') === 'Description d’essai : &quot;survivre&quot; &lt; aube.' && meta(apres, 'name', 'twitter:description') === meta(apres, 'property', 'og:description'),
    'index.html réécrit : og et twitter, texte échappé');
  const lignesAvant = initial.split('\n');
  const changees = apres.split('\n').filter((l, i) => l !== lignesAvant[i]);
  verifier(changees.length === 4, `seules les 4 balises changent (${changees.length} lignes)`);
  const commit = banc.github.commits.at(-1);
  verifier(commit?.chemin === 'index.html' && commit.branche === 'main' && commit.auteur?.name === 'Z-Survival admin', 'un commit « Z-Survival admin » sur main');
  verifier(await page.textContent('#partage-statut') === 'En ligne', 'statut « En ligne » après l’enregistrement');
  // La page servie montre le nouveau texte (comme les réseaux le liront).
  const servie = await (await fetch(banc.base)).text();
  verifier(meta(servie, 'property', 'og:description') === meta(apres, 'property', 'og:description'), 'la page servie porte la nouvelle description');
  // Modifié ailleurs entre-temps : refus clair.
  writeFileSync(fichierIndex, `${apres}\n<!-- modification ailleurs -->\n`);
  await page.fill('#partage_description', 'Autre essai.');
  await page.click('#partage-enregistrer');
  await page.waitForSelector('#erreur-partage:not([hidden])');
  verifier(/modifiée entre-temps/.test(await page.textContent('#erreur-partage')) && readFileSync(fichierIndex, 'utf8').endsWith('<!-- modification ailleurs -->\n'),
    'index.html modifié ailleurs : refus clair, rien d’écrasé');
  writeFileSync(fichierIndex, initial);
  await page.screenshot({ path: '/tmp/partage-admin-375.png', fullPage: true });
  verifier(erreurs.filter((e) => !/409/.test(e)).length === 0, `aucune erreur console (${erreurs.join(' | ')})`);
  await contexte.close();
}
for (const [l, h] of [[320, 568], [1440, 900]]) {
  const v = await nouvellePage(l, h);
  await connecter(v.page);
  await v.page.click('#ouvrir-partage');
  await v.page.waitForSelector('#ecran-partage:not([hidden])');
  const debord = await v.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  verifier(debord <= 0 && v.erreurs.length === 0, `admin ${l} × ${h} : rien ne dépasse, aucune erreur console`);
  await v.contexte.close();
}

console.log('\n# Site : contact dans le pied de page');
for (const [l, h, lang] of [[375, 667, 'fr'], [1440, 900, 'en'], [320, 568, 'fr']]) {
  const v = await nouvellePage(l, h, { reducedMotion: 'reduce' });
  await v.page.goto(`${banc.base}?lang=${lang}#about`);
  await v.page.waitForTimeout(900);
  const r = await v.page.evaluate(() => {
    const a = document.querySelector('.pied-contact a');
    const ld = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'].find((n) => n['@type'] === 'Organization');
    return { href: a?.getAttribute('href'), texte: a?.textContent, libelle: document.querySelector('.pied-contact span').textContent, ld: ld.email, debord: document.documentElement.scrollWidth - innerWidth };
  });
  verifier(r.href === 'mailto:contact@zsurvival-game.com' && r.texte === 'contact@zsurvival-game.com' && r.libelle === (lang === 'fr' ? 'Contact :' : 'Contact:') && r.ld === 'contact@zsurvival-game.com' && r.debord <= 0,
    `${l} × ${h} ${lang} : « ${r.libelle} ${r.texte} » (mailto), e-mail du studio dans le JSON-LD, rien ne dépasse`);
  verifier(v.erreurs.length === 0, `aucune erreur console (${v.erreurs.join(' | ')})`);
  await v.contexte.close();
}

console.log('\n# Accueil en portrait : encart et titre, avec ou sans marge basse (iPhone en mode application)');
for (const [l, h, bas, haut] of [[430, 932, 34, 59], [430, 932, 0, 0], [393, 852, 34, 59], [390, 844, 34, 47], [375, 667, 0, 0], [320, 568, 0, 0]]) {
  for (const lang of ['fr', 'en']) {
    const v = await nouvellePage(l, h, { reducedMotion: 'reduce' });
    const cdp = await v.contexte.newCDPSession(v.page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: haut, bottom: bas, left: 0, right: 0 } });
    await v.page.goto(`${banc.base}?lang=${lang}`);
    await v.page.waitForTimeout(1000);
    const r = await v.page.evaluate(() => {
      const b = (s) => document.querySelector(s).getBoundingClientRect();
      return { encart: b('.accueil-plateforme').bottom, titre: Math.min(b('.accueil-titre .logo-z').top, b('.accueil-titre .logo-reste').top) };
    });
    verifier(r.titre - r.encart >= 6, `${l} × ${h}, marge basse ${bas} px, ${lang} : ${Math.round(r.titre - r.encart)} px entre l’encart et le titre`);
    await v.contexte.close();
  }
}

await navigateur.close();
banc.fermer();
console.log(`\n${reussites} vérifications réussies, ${echecs} en échec.`);
process.exit(echecs ? 1 : 0);
