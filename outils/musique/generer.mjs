// Génère les propositions de musique du site (lot 1b) : node outils/musique/generer.mjs [M1 M2 M3]
// Rendu hors ligne (moteur.mjs, partitions.mjs) → WAV flottant dans outils/musique/rendu/ (non versionné) → MP3 dans musique/
// (ffmpeg, libmp3lame, 128 kb/s constant, 44,1 kHz stéréo) → musique/boucles.json (points de boucle, durées, tailles).
// Vérifie au passage que le rendu est périodique : la marge d'avant doit être la fin de la boucle, la marge d'après son début.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, rendre, wav } from './moteur.mjs';
import { PIECES } from './partitions.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, '..', '..');
const RENDU = join(ICI, 'rendu');
const SORTIE = join(RACINE, 'musique');
const DEBIT = '128k';
const MAX_OCTETS = 2 * 1024 * 1024;

mkdirSync(RENDU, { recursive: true });
mkdirSync(SORTIE, { recursive: true });

const demandes = process.argv.slice(2).filter((a) => PIECES[a]);
const ids = demandes.length ? demandes : Object.keys(PIECES);
const cheminBoucles = join(SORTIE, 'boucles.json');
let boucles = {};
try { boucles = JSON.parse(readFileSync(cheminBoucles, 'utf8')).morceaux ?? {}; } catch { /* premier passage */ }

for (const id of ids) {
  const piece = PIECES[id];
  const t0 = Date.now();
  const r = rendre(piece);
  // Périodicité exacte du rendu (avant compression).
  let ecart = 0;
  let crete = 0;
  let somme = 0;
  for (let i = 0; i < r.marge; i += 1) {
    for (const x of [r.G, r.D]) {
      ecart = Math.max(ecart, Math.abs(x[i] - x[i + r.echantillonsBoucle]), Math.abs(x[r.marge + r.echantillonsBoucle + i] - x[r.marge + i]));
    }
  }
  for (let i = r.marge; i < r.marge + r.echantillonsBoucle; i += 1) {
    crete = Math.max(crete, Math.abs(r.G[i]), Math.abs(r.D[i]));
    somme += r.G[i] ** 2 + r.D[i] ** 2;
  }
  const efficace = 20 * Math.log10(Math.sqrt(somme / (2 * r.echantillonsBoucle)));
  if (ecart > 1e-4) throw new Error(`${id} : rendu non périodique (écart ${ecart})`);
  const fWav = join(RENDU, `${id}.wav`);
  writeFileSync(fWav, wav(r.G, r.D));
  const fMp3 = join(SORTIE, `${id}.mp3`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', fWav, '-c:a', 'libmp3lame', '-b:a', DEBIT, '-ar', String(SR), '-ac', '2',
    '-metadata', `title=Z-Survival — ${piece.nom}`, '-metadata', 'artist=No Way Studio', '-metadata', 'comment=Généré par outils/musique (lot 1b)', fMp3]);
  const octets = statSync(fMp3).size;
  if (octets > MAX_OCTETS) throw new Error(`${id} : ${octets} octets, au-delà de 2 Mo`);
  boucles[id] = {
    fichier: `${id}.mp3`, nom: piece.nom, description: piece.description,
    debutBoucle: r.debutBoucle, finBoucle: r.finBoucle, dureeBoucle: piece.duree, dureeFichier: r.G.length / SR,
    bpm: piece.bpm, mesures: piece.mesures, octets, ...(piece.retenu ? { retenu: true } : {}),
  };
  console.log(`${id} : boucle ${piece.duree} s (${piece.mesures} mesures à ${piece.bpm}), ${piece.evenements.length} événements par tour, `
    + `écart de périodicité ${ecart.toExponential(1)}, crête ${(20 * Math.log10(crete)).toFixed(1)} dBFS, efficace ${efficace.toFixed(1)} dBFS, `
    + `limiteur actif ${(r.mesures.limiteur * 100).toFixed(1)} % du temps (au plus -${r.mesures.reductionMax.toFixed(1)} dB), MP3 ${(octets / 1024 / 1024).toFixed(2)} Mo, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

const ordre = Object.keys(PIECES).filter((k) => boucles[k]);
writeFileSync(cheminBoucles, `${JSON.stringify({
  _note: 'Généré par outils/musique/generer.mjs (lot 1b). Lecture sans blanc : Web Audio, AudioBufferSourceNode.loop = true, loopStart = debutBoucle, loopEnd = finBoucle (secondes). Chaque fichier a 1 s de marge avant et après la boucle (contenu identique à la fin et au début de la boucle).',
  morceaux: Object.fromEntries(ordre.map((k) => [k, boucles[k]])),
}, null, 2)}\n`);
