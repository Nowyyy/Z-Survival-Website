// Copie figée du coup de feu du jeu (lot 2b). Le jeu Z-Survival n'a aucun fichier audio : ses sons sont calculés en code par
// js/core/synth.js à partir des recettes de data/game/sounds.json. Ce script lit un clone du jeu sur la branche dev (LECTURE SEULE,
// hors de ce dépôt), calcule le son « tir » (catégorie tir, version 1 sur 3) avec le synthétiseur du jeu, sans rien y changer, et
// l'écrit tel quel dans sons/coup-de-feu.wav (PCM 16 bits, mono, 44 100 Hz), avec son origine (commit) dans sons/ORIGINE.json.
// Usage : node outils/sons/copier-tir.mjs <clone du jeu sur dev>
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const jeu = resolve(process.argv[2] ?? '');
const git = (...a) => execFileSync('git', ['-C', jeu, ...a], { encoding: 'utf8' }).trim();
const branche = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branche !== 'dev') throw new Error(`le clone doit être sur la branche dev (il est sur ${branche})`);
if (git('status', '--porcelain')) throw new Error('le clone du jeu a des modifications : il doit rester tel quel');
const commit = git('rev-parse', 'HEAD');
const date = git('log', '-1', '--format=%cI');
const sujet = git('log', '-1', '--format=%s');

const SON = 'tir';
const VERSION = 0; // variante 0 : la première des trois versions du coup de feu du jeu
const { renderSound } = await import(pathToFileURL(join(jeu, 'js/core/synth.js')).href);
const recettes = JSON.parse(readFileSync(join(jeu, 'data/game/sounds.json'), 'utf8')).sounds;
const recette = recettes.find((r) => r.id === SON);
if (!recette) throw new Error(`son « ${SON} » introuvable dans data/game/sounds.json`);
const { samples, sampleRate, peak, duration } = renderSound(recette, VERSION);

// WAV PCM 16 bits mono (lu par tous les navigateurs, decodeAudioData compris).
const n = samples.length;
const wav = Buffer.alloc(44 + n * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 2, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i += 1) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
const fichier = join(RACINE, 'sons', 'coup-de-feu.wav');
writeFileSync(fichier, wav);
const origine = {
  _note: 'Copie figée du coup de feu du jeu Z-Survival (lot 2b). Refaire : node outils/sons/copier-tir.mjs <clone du jeu sur dev>.',
  fichier: 'coup-de-feu.wav',
  role: 'Coup de feu du personnage 1, joué par le site au tir de la vidéo de l’accueil (js/accueil-tir.js), seulement si le son du site est activé.',
  depot: 'Nowyyy/Z-Survival',
  branche,
  commit,
  date,
  sujet,
  source: { recette: `data/game/sounds.json → sounds[id="${SON}"]`, moteur: 'js/core/synth.js (renderSound)', version: VERSION + 1, versions: recette.variants ?? 1 },
  format: { codage: 'PCM 16 bits', canaux: 1, frequence: sampleRate, duree: Number(duration.toFixed(4)), crete: Number(peak.toFixed(4)) },
  sha256: createHash('sha256').update(wav).digest('hex'),
};
writeFileSync(join(RACINE, 'sons', 'ORIGINE.json'), `${JSON.stringify(origine, null, 2)}\n`);
console.log(`sons/coup-de-feu.wav : ${(wav.length / 1024).toFixed(1)} Kio, ${duration.toFixed(3)} s, crête ${peak.toFixed(3)}, commit ${commit.slice(0, 7)}`);
