// Clip du jeu pour la section À propos (lot 4b) : une boucle de 8 s, le survivant qui tire sur des zombies, tirée du VRAI jeu.
// Usage : node outils/clip-jeu/fabriquer.mjs [--jeu=DOSSIER] [--garder]
//   → img/a-propos/jeu-clip.mp4 (800 × 450, H.264, sans son, 8 s en boucle) et img/a-propos/jeu-clip.webp (affiche).
// Méthode (mode d'emploi : outils/clip-jeu/LISEZMOI.md) :
// 1. Le jeu (dépôt Nowyyy/Z-Survival, branche dev, LECTURE SEULE) est copié dans un dossier temporaire hors de ce dépôt (git clone
//    --depth 1), ou lu dans --jeu=DOSSIER (une copie déjà faite). Rien n'y est modifié.
// 2. Il est servi en local et ouvert dans Chromium sans écran (Playwright), avec son accès de test (?test=1) : graine fixe, aucune vague
//    automatique (?nospawn=1), sans effet VHS (?vhs=0, plus net et plus léger en vidéo), zoom maximal (?zoom=3). Le HUD est masqué.
// 3. L'horloge de la page est celle de Playwright (page.clock) : chaque image avance le jeu d'exactement 1/30 s, quel que soit le temps
//    de rendu (rendu logiciel, environ 1,5 s par image). Les zombies arrivent par petits groupes à des instants fixes. Le survivant est
//    piloté comme par un joueur (creerPilote) : 8 directions à allure modérée, direction tenue vers là où il n'y a pas de zombie (retour au
//    point de départ en fin de boucle) ; souris (temps de réaction, geste rapide qui dépasse souvent la cible, correction, suivi), toujours
//    sur le zombie le plus proche. Le tir est celui du jeu (automatique quand un zombie est dans la ligne de visée ; le cône s'élargit quand le joueur bouge).
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
    // Retour du propriétaire : « la visée doit mimer des mouvements de souris : rapide mais pas toujours précise » ; déplacement d'un vrai
    // joueur, pas au hasard.
    // Troisième retour : « ça va presque trop vite ; il faut qu'il tienne sa direction, dans une direction où il n'y a pas de zombie,
    // comme pour les éviter, et il tire sur le plus proche à chaque fois ».
    // Déplacement : 8 directions, à `allure` de la vitesse du jeu (220 u/s à fond), tenues `tenue` images (au hasard dans l'intervalle).
    // À chaque décision, la direction qui l'éloigne le plus des zombies (distance au plus proche, depuis le point atteint après `anticipation`
    // secondes) sans sortir de la zone dégagée autour du départ (`zone`, en unités), avec un bonus pour garder la même direction.
    // Changement plus tôt si un zombie se met en travers (`travers` unités devant lui) ou s'il arrive au bord. Il revient à son point de
    // départ dans les `retour` dernières images (la boucle reste propre).
    // Zone dégagée : réunion de rectangles (x et y min/max autour du départ) : la bande où il démarre, et l'espace libre au-dessus, entre
    // les palettes (en haut à gauche) et la caisse (en haut à droite). Une direction est possible si le point atteint après `horizon` s est
    // dans la zone.
    clavier: { allure: 0.6, tenue: [24, 36], anticipation: 0.8, horizon: 0.4, garder: 25, travers: 70, retour: 70, arrivee: 6,
      zone: [{ x: [-230, 110], y: [-55, 45] }, { x: [-60, 110], y: [-140, 45] }] },
    // Visée à la souris : temps de réaction (images, au hasard dans l'intervalle) souris immobile ; geste balistique vers la cible (durée
    // en images selon l'angle à parcourir, profil de vitesse en cloche) qui s'arrête souvent au-delà de la cible (`depassement` : part de
    // l'angle parcouru, au hasard dans l'intervalle ; `sousVisee` : chance de s'arrêter en deçà) avec une erreur (rad) ; correction courte ;
    // puis suivi qui colle au zombie avec un léger retard (`suivi` : part de l'écart rattrapée par image) ; nouveau geste si l'écart
    // dépasse `decroche` (rad). Sans cible : souris immobile.
    souris: { reaction: [4, 7], geste: [4, 7], depassement: [0.06, 0.18], sousVisee: 0.3, erreur: 0.05, correction: 3, suivi: 0.4, decroche: 0.3 },
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
 * Pilote du survivant, comme un joueur au clavier et à la souris. À chaque image : commande de déplacement (8 directions, pleine vitesse ou
 * arrêt) et angle de visée. reglages : REGLAGES.pilote ; depart : position du joueur à l'image 0 ; images : nombre d'images rendues.
 */
export function creerPilote(reglages, graine, depart, images) {
  const { clavier: C, souris: S } = reglages;
  const alea = hasard(graine * 7919 + 13);
  const entre = ([a, b]) => a + alea() * (b - a);
  const entier = ([a, b]) => a + Math.floor(alea() * (b - a + 1));
  const cloche = (u) => u * u * u * (10 - 15 * u + 6 * u * u); // profil « minimum de secousse » : vitesse en cloche
  const DIAG = Math.SQRT1_2;
  const directions = [[1, 0], [DIAG, DIAG], [0, 1], [-DIAG, DIAG], [-1, 0], [-DIAG, -DIAG], [0, -1], [DIAG, -DIAG]];
  const versTouches = (vx, vy) => {
    if (Math.hypot(vx, vy) < 1e-6) return { x: 0, y: 0 };
    const i = ((Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) % 8) + 8) % 8;
    return { x: directions[i][0], y: directions[i][1] };
  };
  // Clavier
  let touches = { x: 0, y: 0 };
  let tenue = 0;
  // Souris
  let angle = null;
  let cible = null;
  let phase = 'repos'; // repos → reaction → geste → correction → suivi
  let compteur = 0;
  let geste = null; // { de, vers, duree }
  // ---- Souris ----
  function viser(t, etat, proches) {
      const angleVers = (z) => Math.atan2(z.y - etat.y, z.x - etat.x);
      if (angle === null) angle = proches[0] ? angleVers(proches[0]) + 0.5 : 0;
      let z = etat.zombies.find((q) => q.id === cible);
      if (!z && phase !== 'reaction') {
        if (proches.length) { cible = proches[0].id; z = proches[0]; phase = 'reaction'; compteur = entier(S.reaction); }
        else phase = 'repos';
      }
      if (phase === 'reaction') {
        compteur -= 1;
        if (!z) { // la cible visée au départ de la réaction est déjà tombée (un autre tir) : on reprend la plus proche
          if (proches.length) { cible = proches[0].id; z = proches[0]; } else phase = 'repos';
        }
        if (phase === 'reaction' && compteur <= 0) phase = 'lancer';
      }
      // Toujours le plus proche : si un autre zombie devient nettement plus proche que la cible suivie, on change (geste rapide).
      if (phase === 'suivi' && z && proches[0] && proches[0].id !== cible
        && Math.hypot(proches[0].x - etat.x, proches[0].y - etat.y) < 0.85 * Math.hypot(z.x - etat.x, z.y - etat.y)) {
        cible = proches[0].id;
        z = proches[0];
        phase = 'lancer';
      }
      if (phase === 'suivi' && z) {
        const ecart = enrouler(angleVers(z) - angle);
        if (Math.abs(ecart) > S.decroche) phase = 'lancer';
        else angle = enrouler(angle + S.suivi * ecart);
      }
      if (phase === 'lancer' && z) {
        // Geste balistique : durée selon l'angle à parcourir, arrêt au-delà (le plus souvent) ou en deçà de la cible, avec une erreur.
        const ecart = enrouler(angleVers(z) - angle);
        const duree = Math.round(S.geste[0] + (S.geste[1] - S.geste[0]) * Math.min(1, Math.abs(ecart) / Math.PI));
        const part = (alea() < S.sousVisee ? -1 : 1) * entre(S.depassement);
        geste = { de: angle, vers: angle + ecart * (1 + part) + (alea() * 2 - 1) * S.erreur, duree };
        phase = 'geste';
        compteur = 0;
      }
      if (phase === 'geste' && geste) {
        compteur += 1;
        angle = enrouler(geste.de + (geste.vers - geste.de) * cloche(Math.min(1, compteur / geste.duree)));
        if (compteur >= geste.duree) {
          phase = 'correction';
          compteur = 0;
          geste = { de: angle, vers: angle, duree: S.correction };
        }
      } else if (phase === 'correction' && z) {
        compteur += 1;
        if (compteur === 1) geste.vers = angle + enrouler(angleVers(z) - angle) + (alea() * 2 - 1) * S.erreur * 0.25;
        angle = enrouler(geste.de + (geste.vers - geste.de) * cloche(Math.min(1, compteur / geste.duree)));
        if (compteur >= geste.duree) phase = 'suivi';
      }
    return angle;
  }
  return {
    commande(t, dt, etat, k) {
      const proches = [...etat.zombies].sort((a, b) => Math.hypot(a.x - etat.x, a.y - etat.y) - Math.hypot(b.x - etat.x, b.y - etat.y));
      // ---- Clavier : direction tenue, vers là où il n'y a pas de zombie ----
      const rx = etat.x - depart.x;
      const ry = etat.y - depart.y;
      const vitesse = 220 * C.allure;
      const dansZone = (x, y, marge) => C.zone.some((r) => x >= r.x[0] + marge && x <= r.x[1] - marge && y >= r.y[0] + marge && y <= r.y[1] - marge);
      tenue -= 1;
      if (k >= images - C.retour) {
        // Fin de boucle : retour au point de départ (8 directions), puis approche fine (joystick relâché peu à peu) jusqu'à s'y arrêter.
        const reste = Math.hypot(rx, ry);
        if (reste > C.arrivee * 2) touches = versTouches(-rx, -ry);
        else if (reste > 0.5) {
          const f = Math.min(1, reste / (220 * C.allure * dt)) / reste;
          return { move: { x: -rx * f * C.allure, y: -ry * f * C.allure }, angle: viser(t, etat, proches) };
        } else touches = { x: 0, y: 0 };
      } else {
        const enMarche = touches.x !== 0 || touches.y !== 0;
        // Un zombie en travers (devant lui, tout près) ou le bord de la zone tout proche : nouvelle décision tout de suite.
        const enTravers = enMarche && proches.some((q) => {
          const dx = q.x - etat.x;
          const dy = q.y - etat.y;
          return Math.hypot(dx, dy) < C.travers && dx * touches.x + dy * touches.y > 0;
        });
        const auBord = enMarche && !dansZone(rx + touches.x * vitesse * 0.3, ry + touches.y * vitesse * 0.3, 0);
        if (tenue <= 0 || enTravers || auBord) {
          const portee = vitesse * C.anticipation;
          let meilleure = null;
          for (const [dx, dy] of directions) {
            if (!dansZone(rx + dx * vitesse * C.horizon, ry + dy * vitesse * C.horizon, 10)) continue;
            const px = rx + dx * portee;
            const py = ry + dy * portee;
            const libre = proches.length ? Math.min(...proches.map((q) => Math.hypot(q.x - depart.x - px, q.y - depart.y - py))) : 1000;
            const score = libre + (dx === touches.x && dy === touches.y ? C.garder : 0);
            if (!meilleure || score > meilleure.score) meilleure = { x: dx, y: dy, score };
          }
          // Aucune direction possible à cette distance (coin) : vers le centre de la zone.
          touches = meilleure ?? versTouches((C.zone[0].x[0] + C.zone[0].x[1]) / 2 - rx, (C.zone[0].y[0] + C.zone[0].y[1]) / 2 - ry);
          tenue = entier(C.tenue);
        }
      }
      const move = { x: touches.x * C.allure, y: touches.y * C.allure };
      return { move, angle: viser(t, etat, proches) };
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
    const pilote = creerPilote(R.pilote, R.graine, depart, R.images);
    for (let k = 0; k < R.images; k += 1) {
      for (const [image, groupe] of R.vagues) {
        if (image === k) await page.evaluate(([g, x, y]) => g.forEach(([dx, dy]) => window.__zs.spawnEnemy(x + dx, y + dy)), [groupe, depart.x, depart.y]);
      }
      const etat = await page.evaluate(() => {
        const s = window.__zs.getState();
        return { x: s.player.x, y: s.player.y, zombies: s.enemies.filter((e) => e.health > 0).map((e, i) => ({ id: e.id ?? i, x: e.x, y: e.y })) };
      });
      const { move, angle } = pilote.commande(k / R.ips, 1 / R.ips, etat, k);
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
