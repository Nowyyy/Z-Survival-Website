// Clip du jeu pour la section À propos (lot 4b) : une boucle de 8 s, le survivant qui tire sur des zombies, tirée du VRAI jeu.
// Usage : node outils/clip-jeu/fabriquer.mjs [--jeu=DOSSIER] [--garder]
//   → img/a-propos/jeu-clip.mp4 (800 × 450, H.264, sans son, 8 s en boucle) et img/a-propos/jeu-clip.webp (affiche).
// Méthode (mode d'emploi : outils/clip-jeu/LISEZMOI.md) :
// 1. Le jeu (dépôt Nowyyy/Z-Survival, branche dev, LECTURE SEULE) est copié dans un dossier temporaire hors de ce dépôt (git clone
//    --depth 1), ou lu dans --jeu=DOSSIER (une copie déjà faite). Rien n'y est modifié.
// 2. Il est servi en local et ouvert dans Chromium sans écran (Playwright), avec son accès de test (?test=1) : graine fixe, aucune vague
//    automatique (?nospawn=1), sans effet VHS (?vhs=0, plus net et plus léger en vidéo), zoom maximal (?zoom=3). Le HUD est masqué.
// 3. L'horloge de la page est celle de Playwright (page.clock) : chaque image avance le jeu d'exactement 1/30 s, quel que soit le temps
//    de rendu (rendu logiciel, environ 1,5 s par image). Les zombies arrivent par petits groupes à des instants fixes. Le survivant marche
//    sur un huit qui revient à son point de départ en 8 s (joystick analogique) ; sa visée est « humaine » : temps de réaction avant de
//    changer de cible, rotation amortie, petit tremblement, regard dans le sens de la marche sans cible (creerPilote). Le tir est celui du
//    jeu (automatique quand un zombie est dans la ligne de visée ; le cône s'élargit quand le joueur bouge).
// 4. Capture de 800 × 450 autour du joueur dans une fenêtre de 1600 × 900 (personnages deux fois plus grands qu'à l'écran entier).
// 5. Boucle : 255 images rendues ; les 15 dernières sont fondues dans les 15 premières (0,5 s), la vidéo commence à l'image 15 : la fin
//    rejoint le début sans saut. Encodage ffmpeg (H.264 High, yuv420p, faststart, sans piste son, métadonnées retirées), léger
//    éclaircissement (le jeu est sombre, la vidéo est petite dans la page).
// Prérequis : Node 18+, Playwright et son Chromium, git, ffmpeg (libx264, libwebp), ImageMagick (composite).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));

export const REGLAGES = Object.freeze({
  depot: 'https://github.com/Nowyyy/Z-Survival.git',
  branche: 'dev',
  adresse: 'jeu.html?test=1&seed=7&nospawn=1&vhs=0&zoom=3',
  fenetre: { width: 1600, height: 900 },
  cadre: { width: 800, height: 450 },
  ips: 30,
  images: 255, // 8,5 s rendues
  fondu: 15, // 0,5 s : les 15 dernières images fondues dans les 15 premières → boucle de 240 images (8 s)
  affiche: 112, // image de l'affiche (dans la boucle) : survivant qui tire
  graine: 7,
  // Pilote (retour du propriétaire : « que le joueur se déplace et que la visée fasse moins automatique ») :
  pilote: {
    // Déplacement : un huit autour d'un point proche du départ, en exactement 8 s (la durée de la boucle : le survivant revient à son
    // point de départ, le raccord reste propre). Commande de joystick analogique (vitesse du jeu : 220 u/s à fond) qui suit le parcours
    // et corrige l'écart (rappel, par seconde). ax, ay : demi-largeur et demi-hauteur du huit, en unités du jeu.
    parcours: { ax: 110, ay: 35, periode: 8, rappel: 4 },
    // Visée « humaine » : rotation amortie vers la cible (pulsation en rad/s, amortissement < 1 : léger dépassement ; vitesse maximale en
    // rad/s), temps de réaction avant de changer de cible après un zombie abattu (en images, tiré au hasard dans l'intervalle), petit
    // tremblement de la main (rad) ; sans cible, le regard suit la direction de marche, avec un tremblement plus large.
    visee: { pulsation: 14, amortissement: 0.65, vitesseMax: 9, reaction: [6, 9], tremblement: 0.05, tremblementLibre: 0.15 },
  },
  // Groupes de zombies : [image, [[dx, dy], …]] en unités du jeu autour du joueur (zones dégagées de la salle de départ).
  vagues: [
    [0, [[200, -40], [180, 70], [-190, -60]]],
    [60, [[-200, 90], [150, -170]]],
    [120, [[-120, -200], [210, 20], [-220, 10]]],
    [180, [[190, -110], [-170, 150]]],
  ],
  encodage: ['-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-preset', 'veryslow', '-crf', '27', '-g', '60', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-threads', '1'],
  filtre: 'eq=gamma=1.15:contrast=1.04:saturation=1.05',
});
const SORTIE = join(RACINE, 'img', 'a-propos');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};
function servir(dossier) {
  const serveur = createServer((req, res) => {
    let chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (chemin.endsWith('/')) chemin += 'index.html';
    const fichier = normalize(join(dossier, chemin));
    if (!fichier.startsWith(dossier) || !existsSync(fichier) || statSync(fichier).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream' });
    createReadStream(fichier).pipe(res);
  });
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok({ base: `http://127.0.0.1:${serveur.address().port}/`, fermer: () => serveur.close() })));
}

const sha256 = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
/** Luminosité moyenne d'une image (0 à 1), par ImageMagick. */
const luminosite = (f) => Number(execFileSync('convert', [f, '-colorspace', 'Gray', '-format', '%[fx:mean]', 'info:']).toString());
// Image « éteinte » : quand la caméra bouge, la carte d'ombres du soleil du jeu (qui suit la caméra) rate parfois une ou deux images : une
// grande bande d'ombre couvre la scène, qui perd jusqu'à la moitié de sa lumière, puis tout revient. Repérée après le rendu : luminosité
// sous 85 % de la médiane de ses 8 voisines (4 de chaque côté). Seules les séries courtes (3 images au plus) sont réparées.
const SEUIL_ETEINTE = 0.85;
const SERIE_MAX = 3;

/** Hasard déterministe (mulberry32) : même graine, mêmes tirages. */
function hasard(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const enrouler = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Pilote du survivant : renvoie à chaque image la commande de déplacement (joystick, longueur ≤ 1) et l'angle de visée.
 * reglages : REGLAGES.pilote ; depart : position du joueur à l'image 0 (le huit commence et finit là).
 */
export function creerPilote(reglages, graine, depart) {
  const { parcours: P, visee: V } = reglages;
  const alea = hasard(graine * 7919 + 13);
  const phases = [alea(), alea(), alea()].map((u) => u * Math.PI * 2);
  const omega = (2 * Math.PI) / P.periode;
  const point = (t) => ({ x: depart.x - P.ax * Math.sin(omega * t), y: depart.y - P.ay * Math.sin(2 * omega * t) });
  const vitesse = (t) => ({ x: -P.ax * omega * Math.cos(omega * t), y: -2 * P.ay * omega * Math.cos(2 * omega * t) });
  const tremble = (t, amplitude) => amplitude * (0.6 * Math.sin(1.7 * t + phases[0]) + 0.3 * Math.sin(4.3 * t + phases[1]) + 0.1 * Math.sin(9.1 * t + phases[2]));
  let angle = null;
  let rotation = 0;
  let cible = null;
  let attente = null;
  return {
    commande(t, dt, etat) {
      // Déplacement : vitesse du parcours + rappel vers le point du parcours, ramenés à un joystick (220 u/s à fond).
      const voulu = point(t + dt);
      const v = vitesse(t + dt);
      const vx = v.x + P.rappel * (voulu.x - etat.x);
      const vy = v.y + P.rappel * (voulu.y - etat.y);
      const norme = Math.hypot(vx, vy) / 220;
      const move = norme > 1 ? { x: vx / 220 / norme, y: vy / 220 / norme } : { x: vx / 220, y: vy / 220 };

      // Cible : gardée tant qu'elle vit ; après sa chute, un temps de réaction, puis le zombie le plus proche.
      const vivante = etat.zombies.find((z) => z.id === cible);
      if (!vivante && etat.zombies.length) {
        if (cible === null) attente = 0;
        else if (attente === null) attente = V.reaction[0] + Math.floor(alea() * (V.reaction[1] - V.reaction[0] + 1));
        if (attente <= 0) {
          const proche = [...etat.zombies].sort((a, b) => Math.hypot(a.x - etat.x, a.y - etat.y) - Math.hypot(b.x - etat.x, b.y - etat.y))[0];
          cible = proche.id;
          attente = null;
        } else attente -= 1;
      }
      const z = etat.zombies.find((q) => q.id === cible);
      const marche = Math.atan2(v.y, v.x);
      const voulue = z ? Math.atan2(z.y - etat.y, z.x - etat.x) + tremble(t, V.tremblement) : marche + tremble(t, V.tremblementLibre);
      if (angle === null) angle = voulue;
      // Rotation amortie (ressort) : accélère, peut dépasser un peu la cible, vitesse limitée.
      const ecart = enrouler(voulue - angle);
      rotation += (V.pulsation * V.pulsation * ecart - 2 * V.amortissement * V.pulsation * rotation) * dt;
      rotation = Math.max(-V.vitesseMax, Math.min(V.vitesseMax, rotation));
      angle = enrouler(angle + rotation * dt);
      return { move, angle };
    },
  };
}

async function rendre(dossierJeu, dossierImages) {
  const R = REGLAGES;
  const site = await servir(dossierJeu);
  const navigateur = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await navigateur.newPage({ viewport: R.fenetre, deviceScaleFactor: 1 });
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    await page.clock.install();
    await page.goto(site.base + R.adresse);
    await page.waitForFunction(() => (window.__zs?.getState()?.time ?? 0) > 0.05 || document.getElementById('game-error')?.hidden === false, null, { timeout: 120_000 });
    if (await page.locator('#game-error').isVisible()) throw new Error('le jeu signale que WebGL est indisponible');
    await page.addStyleTag({ content: '#hud, #btn-pause, .hud { display: none !important; }' });
    await page.clock.pauseAt(Date.now() + 3_600_000);
    const depart = await page.evaluate((graine) => { window.__zs.setSeed(graine); const s = window.__zs.getState(); return { ...s.player, ecran: s.playerScreen }; }, R.graine);
    const cx = Math.round(depart.ecran.x * R.fenetre.width);
    const cy = Math.round(depart.ecran.y * R.fenetre.height);
    const cadre = {
      x: Math.max(0, Math.min(R.fenetre.width - R.cadre.width, cx - R.cadre.width / 2)),
      y: Math.max(0, Math.min(R.fenetre.height - R.cadre.height, cy - R.cadre.height / 2)),
      ...R.cadre,
    };
    const debut = Date.now();
    const pilote = creerPilote(R.pilote, R.graine, depart);
    for (let k = 0; k < R.images; k += 1) {
      for (const [image, groupe] of R.vagues) {
        if (image === k) await page.evaluate(([g, x, y]) => g.forEach(([dx, dy]) => window.__zs.spawnEnemy(x + dx, y + dy)), [groupe, depart.x, depart.y]);
      }
      const etat = await page.evaluate(() => {
        const s = window.__zs.getState();
        return { x: s.player.x, y: s.player.y, zombies: s.enemies.filter((e) => e.health > 0).map((e, i) => ({ id: e.id ?? i, x: e.x, y: e.y })) };
      });
      const { move, angle } = pilote.commande(k / R.ips, 1 / R.ips, etat);
      await page.evaluate(([m, a]) => window.__zs.setInput({ move: m, aim: { angle: a } }), [move, angle]);
      await page.clock.runFor(1000 / R.ips);
      await page.screenshot({ path: join(dossierImages, `r${String(k).padStart(4, '0')}.png`), clip: cadre });
      if (k % 30 === 29) process.stdout.write(`   ${k + 1}/${R.images} images (${Math.round((Date.now() - debut) / 1000)} s)\n`);
    }
    const fin = await page.evaluate(() => { const s = window.__zs.getState(); return { temps: s.time, tues: s.kills, vie: s.player.health }; });
    if (erreurs.length) throw new Error(`erreurs dans la page : ${erreurs.slice(0, 3).join(' | ')}`);
    // Repérage des images éteintes, puis réparation : chacune est remplacée par le mélange des images saines qui l'entourent (interpolation).
    const nom = (i) => join(dossierImages, `r${String(i).padStart(4, '0')}.png`);
    const lums = Array.from({ length: R.images }, (_, i) => luminosite(nom(i)));
    const mediane = (l) => [...l].sort((x, y) => x - y)[Math.floor(l.length / 2)];
    let eteintes = lums.flatMap((l, i) => {
      const voisines = [...lums.slice(Math.max(0, i - 4), i), ...lums.slice(i + 1, i + 5)];
      return l < SEUIL_ETEINTE * mediane(voisines) ? [i] : [];
    });
    const series = [];
    for (const k of eteintes) { if (series.length && series.at(-1).at(-1) === k - 1) series.at(-1).push(k); else series.push([k]); }
    const longues = series.filter((sr) => sr.length > SERIE_MAX);
    if (longues.length) process.stdout.write(`   ⚠ assombrissements trop longs pour être réparés (laissés tels quels) : ${longues.map((sr) => `${sr[0]}–${sr.at(-1)}`).join(', ')}\n`);
    eteintes = series.filter((sr) => sr.length <= SERIE_MAX).flat();
    for (const k of eteintes) {
      let a = k - 1;
      while (eteintes.includes(a)) a -= 1;
      let b = k + 1;
      while (eteintes.includes(b)) b += 1;
      if (a < 0 || b >= R.images) { writeFileSync(nom(k), readFileSync(nom(a < 0 ? b : a))); continue; }
      execFileSync('composite', ['-blend', String(Math.round(((b - k) / (b - a)) * 100)), nom(a), nom(b), nom(k)]);
    }
    if (eteintes.length) process.stdout.write(`   images éteintes réparées : ${eteintes.join(', ')}\n`);
    return { ...fin, cadre, eteintes };
  } finally {
    await navigateur.close();
    site.fermer();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const R = REGLAGES;
  const travail = mkdtempSync(join(tmpdir(), 'zs-clip-'));
  let dossierJeu = typeof args.jeu === 'string' ? args.jeu : null;
  if (!dossierJeu) {
    dossierJeu = join(travail, 'jeu');
    console.log(`Copie du jeu (${R.depot}, branche ${R.branche}, lecture seule) dans ${dossierJeu}`);
    execFileSync('git', ['clone', '-q', '--depth', '1', '-b', R.branche, R.depot, dossierJeu], { stdio: 'inherit' });
  }
  const commitJeu = execFileSync('git', ['-C', dossierJeu, 'rev-parse', '--short', 'HEAD']).toString().trim();
  const images = join(travail, 'images');
  mkdirSync(images, { recursive: true });
  mkdirSync(SORTIE, { recursive: true });
  console.log(`Rendu de ${R.images} images (jeu @ ${commitJeu})…`);
  const bilan = await rendre(dossierJeu, images);
  console.log(`   ${bilan.tues} zombies tués, vie ${bilan.vie}, ${bilan.temps.toFixed(2)} s de jeu`);

  // Boucle : vidéo = images 15 à 254 ; les 15 dernières (240 à 254) sont fondues vers les images 0 à 14.
  const boucle = join(travail, 'boucle');
  mkdirSync(boucle, { recursive: true });
  const n = R.images - R.fondu; // 240
  for (let i = 0; i < n; i += 1) {
    const source = join(images, `r${String(i + R.fondu).padStart(4, '0')}.png`);
    const cible = join(boucle, `b${String(i).padStart(4, '0')}.png`);
    const j = i - (n - R.fondu); // 0 à 14 pour les 15 dernières
    if (j < 0) writeFileSync(cible, readFileSync(source));
    else {
      const part = Math.round(((j + 1) / (R.fondu + 1)) * 100); // part de l'image de début (6 % à 94 %)
      execFileSync('composite', ['-blend', String(part), join(images, `r${String(j).padStart(4, '0')}.png`), source, cible]);
    }
  }
  const mp4 = join(SORTIE, 'jeu-clip.mp4');
  const webp = join(SORTIE, 'jeu-clip.webp');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(R.ips), '-i', join(boucle, 'b%04d.png'), '-vf', R.filtre, ...R.encodage, mp4]);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(boucle, `b${String(R.affiche).padStart(4, '0')}.png`), '-vf', R.filtre,
    '-c:v', 'libwebp', '-quality', '80', '-map_metadata', '-1', webp]);
  const fabrication = {
    jeu: { depot: R.depot, branche: R.branche, commit: commitJeu },
    reglages: { adresse: R.adresse, fenetre: R.fenetre, cadre: bilan.cadre, ips: R.ips, images: R.images, fondu: R.fondu, affiche: R.affiche, vagues: R.vagues, pilote: R.pilote },
    rendu: { zombies_tues: bilan.tues, vie: bilan.vie, images_eteintes_reparees: bilan.eteintes },
    fichiers: Object.fromEntries([mp4, webp].map((f) => [f.slice(RACINE.length + 1), { octets: statSync(f).size, sha256: sha256(f) }])),
  };
  writeFileSync(join(SORTIE, 'fabrication.json'), `${JSON.stringify(fabrication, null, 2)}\n`);
  for (const [f, i] of Object.entries(fabrication.fichiers)) console.log(`${f} : ${(i.octets / 1024).toFixed(0)} Kio`);
  if (!args.garder) rmSync(travail, { recursive: true, force: true });
  else console.log(`Images gardées dans ${travail}`);
}
