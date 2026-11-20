// Bouton de retour flottant de l'admin (demande du propriétaire) : node outils/admin/verifier-retour.mjs
// Banc local (outils/admin/banc.mjs). Sur chaque écran qui a un bouton « ← Articles » (article, page « À propos », bandeau d'alerte, aperçu
// de partage, armes), à 320, 375 et 1440 px : une fois la page défilée jusqu'en bas, le bouton reste collé juste sous la barre
// « Administration », visible, non recouvert (c'est lui qui reçoit un clic en son centre), et il ramène bien à la liste des articles.
import { createRequire } from 'node:module';
import { demarrerBanc } from './banc.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let echecs = 0;
let reussites = 0;
const verifier = (ok, texte) => {
  if (ok) reussites += 1; else echecs += 1;
  console.log(`${ok ? '  ok ' : 'ÉCHEC'} ${texte}`);
};

const ECRANS = [
  { nom: 'article', ouvrir: '#nouvel-article', ecran: '#ecran-editeur', retour: '#retour-liste' },
  { nom: 'page « À propos »', ouvrir: '#ouvrir-page-a-propos', ecran: '#ecran-page', retour: '#page-retour' },
  { nom: 'bandeau d’alerte', ouvrir: '#ouvrir-bandeau', ecran: '#ecran-bandeau', retour: '#bandeau-retour' },
  { nom: 'aperçu de partage', ouvrir: '#ouvrir-partage', ecran: '#ecran-partage', retour: '#partage-retour' },
  { nom: 'armes', ouvrir: '#ouvrir-armes', ecran: '#ecran-armes', retour: '#armes-retour' },
];

const banc = await demarrerBanc();
const navigateur = await chromium.launch();
for (const [l, h] of [[320, 568], [375, 667], [1440, 900]]) {
  console.log(`\n# ${l} × ${h}`);
  const contexte = await navigateur.newContext({ viewport: { width: l, height: h }, deviceScaleFactor: 1 });
  await banc.brancher(contexte);
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.goto(`${banc.base}admin/`);
  await page.fill('#identifiant', banc.identifiant);
  await page.fill('#mot-de-passe', banc.motDePasse);
  await page.click('#bouton-connexion');
  await page.waitForSelector('#ecran-liste:not([hidden])');
  for (const e of ECRANS) {
    await page.click(e.ouvrir);
    await page.waitForSelector(`${e.ecran}:not([hidden])`);
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    const m = await page.evaluate((sel) => {
      const b = document.querySelector(sel);
      const r = b.getBoundingClientRect();
      const entete = document.querySelector('.admin-entete').getBoundingClientRect();
      const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { defile: window.scrollY, haut: Math.round(r.top), sousEntete: Math.round(entete.bottom), libre: dessus === b || b.contains(dessus) };
    }, e.retour);
    verifier(m.defile > 0 && m.haut >= m.sousEntete && m.haut <= m.sousEntete + 16 && m.libre,
      `${e.nom} : page défilée (${m.defile} px), « ← Articles » collé sous l'en-tête (${m.haut} px, en-tête jusqu'à ${m.sousEntete} px), non recouvert`);
    await page.click(e.retour);
    await page.waitForSelector('#ecran-liste:not([hidden])');
    verifier(true, `${e.nom} : le bouton ramène aux articles`);
  }
  verifier(erreurs.length === 0, `aucune erreur console${erreurs.length ? ` (${erreurs.join(' | ')})` : ''}`);
  await contexte.close();
}
await navigateur.close();
banc.fermer();
console.log(`\n${reussites} vérifications réussies, ${echecs} en échec.`);
process.exitCode = echecs ? 1 : 0;
