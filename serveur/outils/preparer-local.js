// Prépare un fichier .env.local pour lancer le serveur EN LOCAL (jamais pour Cloud Run) :
// base SQLite en fichier, identifiant et mot de passe d'essai tapés au clavier (mot de passe masqué),
// empreinte PBKDF2 calculée ici, clé de session tirée au hasard.
// .env.local est ignoré par git (serveur/.gitignore) : il ne part jamais dans le dépôt.
//
// Usage : npm run preparer-local

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { calculerEmpreinte } from '../src/mot-de-passe.js';

const FICHIER = new URL('../.env.local', import.meta.url);

function demander(question, { masque = false } = {}) {
  return new Promise((resoudre) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (masque) {
      // On n'affiche pas les caractères tapés.
      rl._writeToOutput = (texte) => {
        if (texte.includes(question)) process.stdout.write(texte);
      };
    }
    rl.question(question, (reponse) => {
      rl.close();
      if (masque) process.stdout.write('\n');
      resoudre(reponse);
    });
  });
}

if (existsSync(FICHIER)) {
  const r = await demander('.env.local existe déjà. Le remplacer ? (o/N) ');
  if (!/^o(ui)?$/i.test(r.trim())) {
    console.log('Rien changé.');
    process.exit(0);
  }
}

const identifiant = (await demander('Identifiant d’essai (local) : ')).trim();
const mdp1 = await demander('Mot de passe d’essai (local, masqué) : ', { masque: true });
const mdp2 = await demander('Encore une fois : ', { masque: true });
if (!identifiant || !mdp1) {
  console.error('Identifiant et mot de passe obligatoires.');
  process.exit(1);
}
if (mdp1 !== mdp2) {
  console.error('Les deux mots de passe sont différents.');
  process.exit(1);
}

const empreinte = await calculerEmpreinte(mdp1);
await mkdir(new URL('../donnees/', import.meta.url), { recursive: true });
const contenu = [
  '# Fichier LOCAL (ignoré par git). Ne sert qu’à « npm run dev ».',
  'TURSO_DATABASE_URL=file:donnees/local.db',
  `ADMIN_IDENTIFIANT=${identifiant}`,
  `ADMIN_EMPREINTE=${empreinte}`,
  `CLE_SESSION=${randomBytes(32).toString('base64')}`,
  'PORT=8080',
  '',
].join('\n');
await writeFile(FICHIER, contenu, { mode: 0o600 });
console.log('.env.local créé. Lancer : npm run dev');
