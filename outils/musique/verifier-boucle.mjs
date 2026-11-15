// Contrôle du raccord des boucles (lot 1b) : node outils/musique/verifier-boucle.mjs [M1 M2 M3]
// Décode chaque MP3 de musique/ avec ffmpeg (flottants, 44,1 kHz, stéréo) et lit ses points de boucle dans musique/boucles.json, puis :
// 1. décalage du décodage : position du début de la boucle retrouvée par corrélation avec le rendu WAV (outils/musique/rendu/),
//    s'il est là ;
// 2. périodicité : la marge d'avant doit reproduire la fin de la boucle et la marge d'après son début (écart en dB sous le signal ;
//    à comparer avec le même calcul décalé de 10 ms, qui donne l'écart entre deux passages sans rapport) ;
// 3. raccord simulé (fin de la boucle puis retour au début, comme AudioBufferSourceNode.loop) : saut d'un échantillon au raccord
//    comparé aux sauts ordinaires du morceau, niveau minimal sur des fenêtres de 5 ms autour du raccord (aucun blanc), et écart avec
//    la suite naturelle du fichier (la marge d'après), qui est ce que le raccord doit faire entendre.
// Sortie : un tableau, et le code de retour 1 si un critère échoue.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const MUSIQUE = join(ICI, '..', '..', 'musique');
const SR = 44100;
const { morceaux } = JSON.parse(readFileSync(join(MUSIQUE, 'boucles.json'), 'utf8'));
const ids = process.argv.slice(2).filter((a) => morceaux[a]);

function decoder(fichier) {
  const brut = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', fichier, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 });
  const x = new Float32Array(brut.buffer, brut.byteOffset, brut.length / 4);
  const n = x.length / 2;
  const G = new Float32Array(n); const D = new Float32Array(n);
  for (let i = 0; i < n; i += 1) { G[i] = x[2 * i]; D[i] = x[2 * i + 1]; }
  return [G, D];
}
function lireWav(fichier) {
  const b = readFileSync(fichier);
  const n = (b.length - 44) / 8;
  const G = new Float32Array(n);
  for (let i = 0; i < n; i += 1) G[i] = b.readFloatLE(44 + i * 8);
  return G;
}
const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));
function efficace(x, a, b) {
  let s = 0;
  for (let i = a; i < b; i += 1) s += x[i] * x[i];
  return Math.sqrt(s / (b - a));
}
// Écart efficace entre x[a..a+n[ et y[b..b+n[.
function ecart(x, a, y, b, n) {
  let s = 0;
  for (let i = 0; i < n; i += 1) { const d = x[a + i] - y[b + i]; s += d * d; }
  return Math.sqrt(s / n);
}

let echec = false;
const lignes = [];
for (const id of ids.length ? ids : Object.keys(morceaux)) {
  const m = morceaux[id];
  const [G, D] = decoder(join(MUSIQUE, m.fichier));
  const P = Math.round(m.debutBoucle * SR);
  const N = Math.round(m.dureeBoucle * SR);
  const res = { id, echantillons: G.length, attendus: Math.round(m.dureeFichier * SR) };

  // 1. Décalage du décodage par rapport au rendu (corrélation sur 1 s au milieu, décalages de -3000 à +3000).
  const fWav = join(ICI, 'rendu', `${id}.wav`);
  res.decalage = 'sans WAV';
  if (existsSync(fWav)) {
    const ref = lireWav(fWav);
    const a = P + Math.round(N / 2);
    let meilleur = 0; let mini = Infinity;
    for (let k = -3000; k <= 3000; k += 1) {
      const e = ecart(ref, a, G, a + k, 4410);
      if (e < mini) { mini = e; meilleur = k; }
    }
    res.decalage = meilleur;
    res.fideliteMp3 = db(mini / efficace(ref, a, a + 4410));
  }

  // 2. Périodicité du fichier décodé (sur 0,9 s de chaque marge, loin des bords du fichier).
  const n = Math.round(0.9 * SR);
  const avant = Math.round(0.05 * SR);
  let eAvant = 0; let eApres = 0; let eTemoin = 0; let niveau = 0;
  for (const x of [G, D]) {
    eAvant += ecart(x, avant, x, avant + N, n) ** 2;
    eApres += ecart(x, P + N, x, P, n) ** 2;
    eTemoin += ecart(x, P + N, x, P + 441, n) ** 2;
    niveau += efficace(x, P, P + n) ** 2;
  }
  res.periodicite = db(Math.sqrt((eAvant + eApres) / 2 / niveau));
  res.temoin = db(Math.sqrt(eTemoin / niveau));

  // 3. Raccord simulé : y = boucle[N - 2 s .. N[ puis boucle[0 .. 2 s[ (indices du fichier : P + …).
  const T = 2 * SR;
  let sautRaccord = 0; let sautP999 = 0; let minFenetre = Infinity; let medFenetre = 0; let eSuite = 0; let nSuite = 0;
  for (const x of [G, D]) {
    const y = new Float32Array(2 * T);
    for (let i = 0; i < T; i += 1) { y[i] = x[P + N - T + i]; y[T + i] = x[P + i]; }
    sautRaccord = Math.max(sautRaccord, Math.abs(y[T] - y[T - 1]));
    const sauts = [];
    for (let i = P + 1; i < P + N; i += 7) sauts.push(Math.abs(x[i] - x[i - 1]));
    sauts.sort((u, v) => u - v);
    sautP999 = Math.max(sautP999, sauts[Math.floor(sauts.length * 0.999)]);
    const w = Math.round(0.005 * SR);
    const fen = [];
    for (let i = T - Math.round(0.25 * SR); i < T + Math.round(0.25 * SR); i += w) fen.push(efficace(y, i, i + w));
    minFenetre = Math.min(minFenetre, ...fen);
    const tout = [];
    for (let i = P; i + w < P + N; i += w * 10) tout.push(efficace(x, i, i + w));
    tout.sort((u, v) => u - v);
    medFenetre += tout[Math.floor(tout.length / 2)] / 2;
    // Suite naturelle : x[P + N - T .. P + N + T[ (la marge d'après prolonge la boucle), sur ±0,9 s autour du raccord.
    eSuite += ecart(y, T - n, x, P + N - n, 2 * n) ** 2;
    nSuite += efficace(x, P + N - n, P + N + n) ** 2;
  }
  res.saut = sautRaccord;
  res.sautP999 = sautP999;
  res.blanc = db(minFenetre / medFenetre);
  res.suite = db(Math.sqrt(eSuite / nSuite));

  const ok = res.echantillons >= res.attendus - 2000 && res.periodicite < -15 && res.periodicite < res.temoin - 10
    && res.saut <= res.sautP999 * 1.5 && res.blanc > -30 && res.suite < -15;
  res.ok = ok;
  if (!ok) echec = true;
  lignes.push(res);
}

const f = (x, d = 1) => (typeof x === 'number' ? x.toFixed(d) : x);
console.log('| Morceau | Échantillons décodés / attendus | Décalage du décodage | Fidélité MP3 | Périodicité des marges | Témoin décalé de 10 ms | Saut au raccord / sauts ordinaires (99,9 %) | Fenêtre de 5 ms la plus faible au raccord | Écart avec la suite naturelle | Verdict |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of lignes) {
  console.log(`| ${r.id} | ${r.echantillons} / ${r.attendus} | ${r.decalage} éch. | ${f(r.fideliteMp3)} dB | ${f(r.periodicite)} dB | ${f(r.temoin)} dB | ${f(r.saut, 4)} / ${f(r.sautP999, 4)} | ${f(r.blanc)} dB sous la médiane | ${f(r.suite)} dB | ${r.ok ? 'OK' : 'ÉCHEC'} |`);
}
process.exit(echec ? 1 : 0);
