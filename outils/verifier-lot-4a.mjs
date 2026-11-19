// Vérification du lot 4a (Playwright, Chromium) : node outils/verifier-lot-4a.mjs [--en-ligne] [--sous-dossier]
// Sur une copie exacte de ce que publie .github/workflows/pages.yml, servie à la racine comme sur le domaine (outils/copie-publiee.mjs),
// ou, avec --en-ligne, sur https://zsurvival-game.com/. Contrôles :
// - aperçu de partage : balises Open Graph et Twitter Card (og et twitter identiques ; textes modifiables depuis l'admin, lot 3f), image JPEG 1200 × 630 ;
// - icônes : favicon SVG et ICO, icône Apple, manifeste valide et ses icônes, aux bonnes tailles ; mêmes icônes sur l'admin ;
// - référencement : robots.txt, sitemap.xml, une seule page indexable, canonique identique quelle que soit l'adresse (?lang=…, #…),
//   pas de hreflang, noindex sur toutes les pages de travail, titre et description français (= meta.* de js/textes.js), JSON-LD valide ;
// - téléphone en paysage (667 × 375, 740 × 360, 844 × 390) : le titre ne touche ni « Bientôt disponible » ni la rangée du haut ; taille du
//   titre inchangée en portrait et sur ordinateur ;
// - boutons de l'en-tête et du coin de l'accueil : zone de clic d'au moins 44 × 44 px, sans chevauchement, de 320 à 1440 px ;
// - À propos : bloc du jeu au-dessus du bloc du studio ;
// - aucune erreur console, aucun fichier manquant (375 × 667, 320 × 568, paysages, 1440 × 900).
import { createRequire } from 'node:module';
import { servirCopiePubliee, simulerActualites } from './copie-publiee.mjs';
import { TEXTES } from '../js/textes.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DOMAINE = 'https://zsurvival-game.com/';
const EN_LIGNE = process.argv.includes('--en-ligne');

let reussites = 0;
let echecs = 0;
function verifier(ok, message) {
  if (ok) reussites += 1; else echecs += 1;
  console.log(`${ok ? '  ok ' : '  ÉCHEC'} ${message}`);
}

let base = DOMAINE;
let copie = null;
if (!EN_LIGNE) {
  copie = await servirCopiePubliee();
  base = copie.base;
}
// Adresse publique (absolue, sur le domaine) → adresse servie ici.
const local = (adresse) => (adresse.startsWith(DOMAINE) ? base + adresse.slice(DOMAINE.length) : adresse);

const navigateur = await chromium.launch();

// ---------- Outils : dimensions d'images ----------
function dimensionsPng(o) {
  if (o.readUInt32BE(0) !== 0x89504e47) return null;
  return { largeur: o.readUInt32BE(16), hauteur: o.readUInt32BE(20) };
}
function dimensionsJpeg(o) {
  if (o[0] !== 0xff || o[1] !== 0xd8) return null;
  let i = 2;
  while (i < o.length) {
    if (o[i] !== 0xff) return null;
    const m = o[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { hauteur: o.readUInt16BE(i + 5), largeur: o.readUInt16BE(i + 7) };
    i += 2 + o.readUInt16BE(i + 2);
  }
  return null;
}
function imagesIco(o) {
  if (o.readUInt16LE(0) !== 0 || o.readUInt16LE(2) !== 1) return null;
  return Array.from({ length: o.readUInt16LE(4) }, (_, k) => {
    const taille = o.readUInt32LE(6 + 16 * k + 8);
    const debut = o.readUInt32LE(6 + 16 * k + 12);
    return { cote: o[6 + 16 * k] || 256, png: dimensionsPng(o.subarray(debut, debut + taille)) };
  });
}

const contexteRequetes = await navigateur.newContext();
const requete = contexteRequetes.request;
async function lire(adresse) {
  const r = await requete.get(adresse, { maxRedirects: 0 });
  return { statut: r.status(), type: r.headers()['content-type'] ?? '', corps: await r.body() };
}

// ---------- A. Aperçu de partage ----------
console.log('A. Aperçu de partage');
const html = (await lire(base)).corps.toString();
const meta = (attr, nom) => new RegExp(`<meta ${attr}="${nom.replace(/[:.]/g, '\\$&')}" content="([^"]*)">`).exec(html)?.[1];
// Lot 3f : titre et description vivent seulement dans index.html (modifiables depuis l'admin) : og et twitter doivent être identiques.
const P = { titre: meta('property', 'og:title'), description: meta('property', 'og:description'), imageAlt: meta('property', 'og:image:alt') };
verifier(meta('property', 'og:type') === 'website' && meta('property', 'og:site_name') === 'Z-Survival' && meta('property', 'og:locale') === 'fr_FR',
  'og:type website, og:site_name Z-Survival, og:locale fr_FR');
verifier(meta('property', 'og:url') === DOMAINE, `og:url = ${DOMAINE}`);
verifier(meta('property', 'og:title') === P.titre && meta('name', 'twitter:title') === P.titre, `og:title = twitter:title (« ${P.titre} »)`);
verifier(meta('property', 'og:description') === P.description && meta('name', 'twitter:description') === P.description,
  `og:description = twitter:description (${P.description?.length} caractères)`);
verifier(P.titre?.length > 0 && P.description?.length > 0 && P.titre.length <= 90 && P.description.length <= 300, 'titre et description de partage présents (90 et 300 caractères au plus)');
verifier(meta('property', 'og:image:alt') === P.imageAlt && meta('name', 'twitter:image:alt') === P.imageAlt, 'texte de remplacement de l’image identique (og et twitter)');
verifier(meta('name', 'twitter:card') === 'summary_large_image', 'twitter:card summary_large_image');
const ogImage = meta('property', 'og:image');
verifier(ogImage === `${DOMAINE}img/partage.jpg` && meta('name', 'twitter:image') === ogImage && meta('property', 'og:image:secure_url') === ogImage,
  'og:image, og:image:secure_url et twitter:image : adresse absolue https://zsurvival-game.com/img/partage.jpg');
const image = await lire(local(ogImage));
const dim = dimensionsJpeg(image.corps);
verifier(image.statut === 200 && /image\/jpeg/.test(image.type) && dim?.largeur === 1200 && dim?.hauteur === 630,
  `image de partage servie : ${image.type}, ${dim?.largeur} × ${dim?.hauteur}`);
verifier(meta('property', 'og:image:type') === 'image/jpeg' && meta('property', 'og:image:width') === '1200' && meta('property', 'og:image:height') === '630',
  'og:image:type, og:image:width et og:image:height cohérents avec le fichier');
verifier(image.corps.length < 300 * 1024, `image de partage sous 300 Kio (${(image.corps.length / 1024).toFixed(1)} Kio)`);

// ---------- B. Icônes ----------
console.log('B. Icônes');
const liens = [...html.matchAll(/<link rel="([^"]+)" ([^>]*)>/g)].map(([, rel, reste]) => ({ rel, href: /href="([^"]+)"/.exec(reste)?.[1], reste }));
const lien = (rel, filtre = () => true) => liens.find((l) => l.rel === rel && filtre(l));
const svg = lien('icon', (l) => l.reste.includes('image/svg+xml'));
const icoLien = lien('icon', (l) => l.href.endsWith('.ico'));
const apple = lien('apple-touch-icon');
const manifesteLien = lien('manifest');
verifier(svg?.href === 'img/icones/icone.svg' && icoLien?.href === 'favicon.ico' && apple?.href === 'img/icones/icone-180.png' && manifesteLien?.href === 'site.webmanifest',
  'liens : favicon SVG, favicon ICO, icône Apple, manifeste (chemins relatifs)');
const fsvg = await lire(base + svg.href);
verifier(fsvg.statut === 200 && /image\/svg\+xml/.test(fsvg.type) && fsvg.corps.toString().includes('<svg') && !/<script|href="http/.test(fsvg.corps.toString()),
  'favicon SVG servi, sans script ni ressource externe');
const fico = await lire(base + icoLien.href);
const entrees = imagesIco(fico.corps);
verifier(fico.statut === 200 && entrees?.map((e) => `${e.cote}:${e.png?.largeur}`).join(',') === '16:16,32:32,48:48', `favicon.ico : ${entrees?.map((e) => e.cote).join(', ')} px`);
const fapple = await lire(base + apple.href);
verifier(fapple.statut === 200 && dimensionsPng(fapple.corps)?.largeur === 180 && dimensionsPng(fapple.corps)?.hauteur === 180, 'icône Apple 180 × 180');
const meta2 = (nom) => new RegExp(`<meta name="${nom}" content="([^"]*)">`).exec(html)?.[1];
verifier(meta2('theme-color') === '#050505', 'theme-color #050505');
const fman = await lire(base + manifesteLien.href);
let manifeste = null;
try { manifeste = JSON.parse(fman.corps.toString()); } catch { /* invalide */ }
verifier(fman.statut === 200 && manifeste && manifeste.name === 'Z-Survival' && manifeste.short_name && manifeste.start_url === './'
  && manifeste.background_color === '#050505' && manifeste.theme_color === '#050505', 'manifeste : JSON valide, nom, start_url relatif, couleurs #050505');
for (const ic of manifeste?.icons ?? []) {
  const f = await lire(new URL(ic.src, base + manifesteLien.href).href);
  if (ic.type === 'image/svg+xml') { verifier(f.statut === 200 && f.corps.toString().includes('<svg'), `manifeste : ${ic.src} (${ic.purpose})`); continue; }
  const d = dimensionsPng(f.corps);
  verifier(f.statut === 200 && `${d?.largeur}x${d?.hauteur}` === ic.sizes, `manifeste : ${ic.src} ${ic.sizes} (${ic.purpose})`);
}
verifier(['192x192', '512x512'].every((s) => manifeste?.icons.some((i) => i.sizes === s && i.purpose === 'any')) && manifeste?.icons.some((i) => i.purpose === 'maskable'),
  'manifeste : icônes 192 et 512 px, et une icône masquable');
const htmlAdmin = (await lire(`${base}admin/`)).corps.toString();
for (const href of ['../favicon.ico', '../img/icones/icone.svg', '../img/icones/icone-180.png']) {
  const f = await lire(new URL(href, `${base}admin/`).href);
  verifier(htmlAdmin.includes(`href="${href}"`) && f.statut === 200, `admin : icône ${href}`);
}

// ---------- C. Référencement ----------
console.log('C. Référencement');
const robots = await lire(`${base}robots.txt`);
const txt = robots.corps.toString();
verifier(robots.statut === 200 && /text\/plain/.test(robots.type), 'robots.txt servi (text/plain)');
verifier(/^User-agent: \*$/m.test(txt) && /^Allow: \/$/m.test(txt), 'robots.txt : tout autorisé par défaut (page et fichiers utilisés)');
for (const chemin of ['/admin/', '/scene/', '/musique/planche.html', '/outils/', '/main.html']) verifier(txt.split('\n').includes(`Disallow: ${chemin}`), `robots.txt : Disallow ${chemin}`);
verifier(!/^Disallow: \/(css|js|img|fonts|musique|sons|contenus)\/?$/m.test(txt), 'robots.txt : css, js, img, fonts, musique, sons, contenus non interdits');
verifier(txt.includes(`Sitemap: ${DOMAINE}sitemap.xml`), 'robots.txt : indique le sitemap');
const plan = await lire(`${base}sitemap.xml`);
const locs = [...plan.corps.toString().matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
verifier(plan.statut === 200 && /xml/.test(plan.type) && plan.corps.toString().includes('http://www.sitemaps.org/schemas/sitemap/0.9') && locs.join() === DOMAINE,
  `sitemap.xml servi, une seule adresse : ${locs.join(', ')}`);
// Pages de travail : noindex. Liste : toutes les pages HTML publiées (copie locale) ; en ligne, la liste connue.
const pagesTravail = ['admin/', 'main.html', 'musique/planche.html', 'scene/index.html', 'scene/apercu.html', 'scene/planche.html', 'scene-v2/index.html', 'scene-v2/apercu.html', 'scene-v2/planche.html'];
if (copie) {
  const { readdirSync, statSync } = await import('node:fs');
  const { join, relative } = await import('node:path');
  const toutes = [];
  const parcourir = (d) => readdirSync(d).forEach((f) => { const c = join(d, f); if (statSync(c).isDirectory()) parcourir(c); else if (f.endsWith('.html')) toutes.push(relative(copie.dossier, c)); });
  parcourir(copie.dossier);
  const attendues = new Set(['index.html', ...pagesTravail.map((p) => (p.endsWith('/') ? `${p}index.html` : p))]);
  verifier(toutes.every((p) => attendues.has(p)) && toutes.length === attendues.size, `pages HTML publiées : ${toutes.sort().join(', ')}`);
}
for (const p of pagesTravail) {
  const corps = (await lire(base + p)).corps.toString();
  verifier(/<meta name="robots" content="noindex[^"]*">/.test(corps), `${p} : noindex`);
}
verifier(!/noindex/.test(html) && meta2('robots') === 'index, follow, max-image-preview:large', 'page par défaut : aucun noindex (robots « index, follow »)');
verifier(new RegExp(`<title>${TEXTES.fr.meta.titre}</title>`).test(html) && meta2('description') === TEXTES.fr.meta.description,
  `titre et description du HTML en français, = meta.* de js/textes.js (« ${TEXTES.fr.meta.titre} », ${TEXTES.fr.meta.description.length} caractères)`);
verifier(!/hreflang/.test(html), 'pas de hreflang');
const blocJsonLd = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
let ld = null;
try { ld = JSON.parse(blocJsonLd); } catch { /* invalide */ }
const types = ld?.['@graph']?.map((n) => n['@type']) ?? [];
verifier(ld?.['@context'] === 'https://schema.org' && types.includes('VideoGame') && types.includes('Organization'), `JSON-LD valide : ${types.join(', ')}`);
const jeu = ld?.['@graph']?.find((n) => n['@type'] === 'VideoGame');
const studio = ld?.['@graph']?.find((n) => n['@type'] === 'Organization');
verifier(jeu?.name === 'Z-Survival' && /navigateur/i.test(jeu?.gamePlatform) && jeu?.creativeWorkStatus === 'À venir' && jeu?.publisher?.['@id'] === studio?.['@id'],
  'JSON-LD : VideoGame Z-Survival, sur navigateur, à venir, édité par le studio');
verifier(!/aggregateRating|"review"|"offers"|"price|datePublished|releaseDate/.test(blocJsonLd), 'JSON-LD : ni note, ni avis, ni prix, ni date de sortie');
const logo = await lire(local(studio?.logo?.url ?? ''));
verifier(studio?.name === 'No Way Studio' && logo.statut === 200 && dimensionsPng(logo.corps)?.largeur === studio.logo.width && dimensionsPng(logo.corps)?.hauteur === studio.logo.height,
  `JSON-LD : Organization No Way Studio, logo PNG servi (${studio?.logo?.width} × ${studio?.logo?.height})`);
verifier(local(jeu?.image ?? '') === base + 'img/partage.jpg', 'JSON-LD : image du jeu = image de partage');

// ---------- Navigateur : canonique, paysage, zones de clic, À propos, console ----------
const erreurs = [];
async function ouvrir(largeur, hauteur, suffixe = '', options = {}) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, reducedMotion: 'reduce', ...options });
  const page = await contexte.newPage();
  if (copie) await simulerActualites(page);
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(`${largeur}×${hauteur} ${suffixe} : ${m.text()}`); });
  page.on('pageerror', (e) => erreurs.push(`${largeur}×${hauteur} ${suffixe} : ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) erreurs.push(`${largeur}×${hauteur} ${suffixe} : ${r.status()} ${r.url()}`); });
  await page.goto(base + suffixe);
  await page.waitForTimeout(900);
  return { page, contexte };
}

console.log('C. Canonique selon l’adresse');
const canoniques = new Set();
for (const suffixe of ['', '?lang=fr', '?lang=en', '#news', '#about', '#actu/un-article', '?lang=en#weapons']) {
  const { page, contexte } = await ouvrir(375, 667, suffixe);
  const c = await page.evaluate(() => [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute('href')));
  const robotsMeta = await page.evaluate(() => [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.content).join());
  verifier(c.length === 1 && c[0] === DOMAINE && !/noindex/.test(robotsMeta), `« ${suffixe || '/'} » : un seul canonique ${c.join()}, indexable`);
  canoniques.add(c.join());
  await contexte.close();
}
verifier(canoniques.size === 1, 'canonique identique pour toutes les adresses');

console.log('D. Téléphone en paysage : titre');
const boite = (page, s) => page.evaluate((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r && { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, s);
const coupe = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
for (const [l, h] of [[667, 375], [740, 360], [844, 390]]) {
  for (const lang of ['fr', 'en']) {
    const { page, contexte } = await ouvrir(l, h, `?lang=${lang}`);
    const z = await boite(page, '.accueil-titre .logo-z');
    const reste = await boite(page, '.accueil-titre .logo-reste');
    const titre = { l: Math.min(z.l, reste.l), t: Math.min(z.t, reste.t), r: Math.max(z.r, reste.r), b: Math.max(z.b, reste.b) };
    const rangee = await boite(page, '.accueil-reglages');
    const bientot = await boite(page, '.accueil-reglages .bouton-bientot');
    const studioLogo = await boite(page, '.accueil-studio');
    const sous = await boite(page, '.accueil-sous-titre');
    const ecart = Math.round(titre.t - Math.max(rangee.b, studioLogo.b));
    verifier(!coupe(titre, bientot) && !coupe(titre, rangee) && !coupe(titre, studioLogo) && titre.t >= rangee.b + 8 && !coupe(titre, sous),
      `${l} × ${h} ${lang} : titre sous la rangée du haut (écart ${ecart} px), sans toucher « Bientôt disponible », le logo du studio ni l’accroche`);
    await contexte.close();
  }
}
for (const [l, h, attendu] of [[375, 667, 52.5], [320, 568, 44.8], [1440, 900, 104]]) {
  const { page, contexte } = await ouvrir(l, h);
  const taille = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.accueil-titre')).fontSize));
  verifier(Math.abs(taille - attendu) < 0.1, `${l} × ${h} : taille du titre inchangée (${taille} px)`);
  await contexte.close();
}

console.log('D. Zones de clic des boutons (en-tête et coin de l’accueil), 320 à 1440 px');
const largeurs = [320, 340, 360, 375, 390, 414, 420, 480, 599, 600, 768, 899, 900, 1024, 1280, 1440];
for (const lang of ['fr', 'en']) {
  for (const [ou, suffixe] of [['entete', '#news'], ['accueil', '']]) {
    const problemes = [];
    for (const l of largeurs) {
      const { page, contexte } = await ouvrir(l, l >= 900 ? 900 : 700, `?lang=${lang}${suffixe}`);
      const r = await page.evaluate((ouCtl) => {
        const racine = document.querySelector(ouCtl === 'entete' ? '.entete' : '.accueil-reglages');
        const ctrls = [...racine.querySelectorAll('a, button')].filter((e) => e.getClientRects().length);
        const pb = [];
        for (const e of ctrls) {
          const b = e.getBoundingClientRect();
          const cx = b.left + b.width / 2;
          const cy = b.top + b.height / 2;
          let rate = 0;
          // Le carré de 44 × 44 centré sur le bouton doit être entièrement à lui (aucun voisin, rien par-dessus).
          for (let dx = -21.5; dx <= 21.5; dx += 1) for (let dy = -21.5; dy <= 21.5; dy += 1) {
            if (document.elementFromPoint(cx + dx, cy + dy)?.closest('a, button') !== e) rate += 1;
          }
          if (rate) pb.push(`${e.className.split(' ')[0]} (${rate} points)`);
        }
        // Aucun chevauchement visible entre les éléments de la rangée, tous dans l'écran.
        const vis = [...racine.querySelectorAll(ouCtl === 'entete' ? '.entete-studio, .entete-logo, .bouton-bientot, .discord-lien, .son-bouton, .langue-bouton' : '.bouton-bientot, .discord-lien, .son-bouton, .langue-bouton')]
          .filter((e) => e.getClientRects().length).map((e) => [e.className.split(' ')[0], e.getBoundingClientRect()]);
        vis.forEach(([n, a], i) => {
          if (a.left < 0 || a.right > innerWidth) pb.push(`${n} hors de l'écran`);
          vis.slice(i + 1).forEach(([m, c]) => { if (a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom && c.top < a.bottom) pb.push(`${n}/${m} se chevauchent`); });
        });
        return { pb, n: ctrls.length };
      }, ou);
      if (r.pb.length || r.n < 3) problemes.push(`${l} px : ${r.pb.join(', ') || `${r.n} boutons`}`);
      await contexte.close();
    }
    verifier(!problemes.length, `${ou} ${lang} : zones de clic ≥ 44 × 44 px, sans chevauchement, à ${largeurs.length} largeurs${problemes.length ? ` — ${problemes.join(' ; ')}` : ''}`);
  }
}

console.log('F. À propos : le jeu au-dessus du studio (grand écran), à sa gauche dans un carrousel (téléphone, écran bas)');
for (const [l, h] of [[375, 667], [1366, 768], [1440, 900]]) {
  for (const lang of ['fr', 'en']) {
    const { page, contexte } = await ouvrir(l, h, `?lang=${lang}#about`);
    // Carrousel sur téléphone et sur un écran d'ordinateur bas (860 px ou moins), blocs l'un sous l'autre au-delà.
    const telephone = l < 900 || h <= 860;
    const r = await page.evaluate((telephone) => {
      const blocs = [...document.querySelectorAll('#about .about-corps')];
      const jeu = document.querySelector('.about-corps-jeu');
      const studioBloc = document.querySelector('.about-corps-studio');
      const a = jeu?.getBoundingClientRect();
      const b = studioBloc?.getBoundingClientRect();
      const section = document.getElementById('about');
      return {
        n: blocs.length,
        ordre: a && b && (telephone ? a.right <= b.left : a.bottom <= b.top),
        // Carrousel : la section tient dans l'écran (pas de défilement vertical), position « 01 / 02 » montrée.
        tient: !telephone || (section.offsetHeight <= innerHeight + 1 && !document.getElementById('about-carrousel').hidden),
        titre: jeu?.querySelector('.about-signature')?.textContent,
        texte: jeu?.querySelector('.about-paragraphe')?.textContent,
        alt: jeu?.querySelector('img')?.alt,
        image: jeu?.querySelector('img')?.complete && jeu.querySelector('img').naturalWidth > 0,
        studio: studioBloc?.querySelector('#about-signature') && studioBloc.querySelector('#about-texte') && studioBloc.querySelector('.about-logo') ? 1 : 0,
      };
    }, telephone);
    const J = TEXTES[lang].about.jeu;
    verifier(r.n === 2 && r.ordre && r.tient && r.titre === J.titre && r.texte === J.texte && r.alt === J.imageAlt && r.studio === 1,
      `${l} × ${h} ${lang} : deux blocs, « ${r.titre} » ${telephone ? 'à gauche du studio (carrousel, section qui tient dans l’écran)' : 'au-dessus du studio'} (titre, texte et logo du studio en place)`);
    if (!EN_LIGNE || r.image) verifier(r.image, `${l} × ${h} ${lang} : image du jeu chargée`);
    await contexte.close();
  }
}

console.log('E. Console et fichiers, aux tailles du lot');
for (const [l, h] of [[375, 667], [320, 568], [667, 375], [740, 360], [844, 390], [1440, 900]]) {
  const { page, contexte } = await ouvrir(l, h, '', { reducedMotion: 'no-preference' });
  await page.waitForTimeout(1500);
  for (const s of ['#news', '#characters', '#weapons', '#about']) { await page.evaluate((id) => { location.hash = id; }, s); await page.waitForTimeout(500); }
  await contexte.close();
}
verifier(!erreurs.length, `aucune erreur console, aucun fichier manquant${erreurs.length ? ` — ${[...new Set(erreurs)].slice(0, 8).join(' | ')}` : ''}`);

await navigateur.close();
copie?.fermer();
console.log(`\n${reussites} réussies, ${echecs} en échec${EN_LIGNE ? ' (en ligne, https://zsurvival-game.com/)' : ''}.`);
process.exit(echecs ? 1 : 0);
