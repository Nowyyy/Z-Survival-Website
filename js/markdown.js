// Markdown des articles, affiché de façon SÛRE (lot 3b) : petit moteur maison à liste blanche.
// - Blocs : paragraphes, intertitres (#, ## ; ### pour un sous-titre), listes à puces (-, *, +) et numérotées (1. ou 1)) ;
//   sous-liste : la puce précédée de deux espaces (ou d'une tabulation) de plus que celle du dessus, trois niveaux au plus.
// - En ligne : **gras**, *italique* ou _italique_, [texte](https://adresse), \ pour écrire un caractère tel quel.
// - AUCUN HTML : le texte n'est jamais interprété comme du HTML (pas d'innerHTML) ; chaque élément est créé par
//   document.createElement et le texte posé par textContent. « <script> », « onerror=… » restent du texte visible.
// - Liens : http:// et https:// seulement (javascript:, data:, adresses relatives… → le texte seul, sans lien),
//   ouverts dans un nouvel onglet avec rel="noopener noreferrer".
// Utilisé par le site (js/actualites.js) et par l'aperçu de la page d'administration (admin/admin.js).

const MOTIF_TITRE = /^(#{1,6})[ \t]+(.*?)[ \t#]*$/;
const MOTIF_PUCE = /^([ \t]*)[-*+][ \t]+(.*)$/;
const MOTIF_NUMERO = /^([ \t]*)(\d{1,9})[.)][ \t]+(.*)$/;
const NIVEAUX_LISTE = 3; // liste, sous-liste, sous-sous-liste

/** Niveau d'une puce d'après son retrait : deux espaces (ou une tabulation) par niveau. */
function niveauRetrait(retrait) {
  const largeur = [...retrait].reduce((n, c) => n + (c === '\t' ? 2 : 1), 0);
  return Math.min(NIVEAUX_LISTE - 1, Math.floor(largeur / 2));
}
const ECHAPPABLES = '\\`*_{}[]()#+-.!>~|';

/** Adresse de lien acceptée (http ou https, absolue), ou null. */
export function lienSur(adresse) {
  const brute = String(adresse).trim();
  if (!/^https?:\/\//i.test(brute) || /[\s\u0000-\u001f\u007f]/.test(brute)) return null;
  try {
    const url = new URL(brute);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Découpe le texte en blocs : { type: 'titre', niveau, texte } | { type: 'liste', ordonnee, depart, elements } | { type: 'para', texte }.
 * Élément de liste : { texte, niveau (0 = liste, 1 = sous-liste…), ordonnee, numero }.
 */
function blocs(source) {
  const lignes = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const resultat = [];
  let para = null;
  let liste = null;
  const fermer = () => { para = null; liste = null; };
  for (const ligne of lignes) {
    if (!ligne.trim()) { fermer(); continue; }
    const titre = MOTIF_TITRE.exec(ligne);
    if (titre) {
      fermer();
      resultat.push({ type: 'titre', niveau: titre[1].length, texte: titre[2] });
      continue;
    }
    const puce = MOTIF_PUCE.exec(ligne);
    const numero = puce ? null : MOTIF_NUMERO.exec(ligne);
    if (puce || numero) {
      const ordonnee = Boolean(numero);
      // Un niveau de plus que l'élément du dessus au plus ; le premier élément d'une liste est au niveau 0.
      const precedent = liste?.elements.at(-1);
      let niveau = precedent ? Math.min(niveauRetrait((puce ?? numero)[1]), precedent.niveau + 1) : 0;
      // Puce de premier niveau d'une autre sorte (puces ↔ numéros) : nouvelle liste.
      if (!liste || (niveau === 0 && liste.ordonnee !== ordonnee)) {
        para = null;
        niveau = 0;
        liste = { type: 'liste', ordonnee, depart: ordonnee ? Number(numero[2]) : 1, elements: [] };
        resultat.push(liste);
      }
      liste.elements.push({ texte: puce ? puce[2] : numero[3], niveau, ordonnee, numero: ordonnee ? Number(numero[2]) : 1 });
      continue;
    }
    if (liste) {
      // Ligne qui suit un élément de liste sans puce : elle le continue.
      liste.elements.at(-1).texte += ` ${ligne.trim()}`;
      continue;
    }
    if (para) para.texte += ` ${ligne.trim()}`;
    else {
      para = { type: 'para', texte: ligne.trim() };
      resultat.push(para);
    }
  }
  return resultat;
}

/**
 * Analyse en ligne → arbre { t: 'texte'|'gras'|'italique'|'lien', valeur?, enfants?, href? }.
 * Recherche des délimiteurs mémorisée : le temps reste proportionnel à la longueur du texte, même piégé.
 */
function enLigne(texte, avecLiens = true) {
  const s = String(texte);
  const noeuds = [];
  let tampon = '';
  const memoire = new Map();
  // Prochaine fin possible pour « motif » à partir de « depuis » ; « _ » ne ferme pas devant une lettre (nom_de_fichier).
  const trouver = (motif, depuis) => {
    let p = s.indexOf(motif, depuis);
    while (motif === '_' && p !== -1 && /[\p{L}\p{N}]/u.test(s[p + 1] ?? '')) p = s.indexOf(motif, p + 1);
    return p;
  };
  const chercher = (motif, depuis) => {
    const m = memoire.get(motif);
    if (m && depuis >= m.depuis && (m.position === -1 || m.position >= depuis)) return m.position;
    const position = trouver(motif, depuis);
    memoire.set(motif, { depuis, position });
    return position;
  };
  const vider = () => {
    if (tampon) noeuds.push({ t: 'texte', valeur: tampon });
    tampon = '';
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length && ECHAPPABLES.includes(s[i + 1])) {
      tampon += s[i + 1];
      i += 2;
      continue;
    }
    if (c === '[' && avecLiens) {
      const fin = chercher(']', i + 1);
      if (fin > i + 1 && s[fin + 1] === '(') {
        let ferme = chercher(')', fin + 2);
        // Parenthèses équilibrées dans l'adresse (https://fr.wikipedia.org/wiki/Z_(lettre)) ; 20 au plus.
        for (let n = 0; n < 20 && ferme !== -1; n += 1) {
          const adresse = s.slice(fin + 2, ferme);
          if ((adresse.match(/\(/g) ?? []).length <= (adresse.match(/\)/g) ?? []).length) break;
          ferme = s.indexOf(')', ferme + 1);
        }
        if (ferme > fin + 2) {
          vider();
          const etiquette = enLigne(s.slice(i + 1, fin), false);
          const href = lienSur(s.slice(fin + 2, ferme));
          if (href) noeuds.push({ t: 'lien', href, enfants: etiquette });
          else noeuds.push(...etiquette); // lien refusé : on garde seulement son texte
          i = ferme + 1;
          continue;
        }
      }
    }
    if (c === '*' && s[i + 1] === '*') {
      const fin = chercher('**', i + 2);
      if (fin > i + 2) {
        vider();
        noeuds.push({ t: 'gras', enfants: enLigne(s.slice(i + 2, fin), avecLiens) });
        i = fin + 2;
        continue;
      }
    }
    if ((c === '*' || c === '_') && s[i + 1] !== c) {
      // « _ » au milieu d'un mot (nom_de_fichier) n'est pas de l'italique.
      const debutMot = c === '_' && i > 0 && /[\p{L}\p{N}]/u.test(s[i - 1]);
      if (!debutMot && s[i + 1] !== undefined && s[i + 1] !== ' ') {
        const fin = chercher(c, i + 1);
        if (fin > i + 1 && s[fin - 1] !== ' ') {
          vider();
          noeuds.push({ t: 'italique', enfants: enLigne(s.slice(i + 1, fin), avecLiens) });
          i = fin + 1;
          continue;
        }
      }
    }
    tampon += c;
    i += 1;
  }
  vider();
  return noeuds;
}

function versDom(noeuds, doc) {
  const fragment = doc.createDocumentFragment();
  for (const n of noeuds) {
    if (n.t === 'texte') {
      fragment.append(doc.createTextNode(n.valeur));
      continue;
    }
    const balise = { gras: 'strong', italique: 'em', lien: 'a' }[n.t];
    const el = doc.createElement(balise);
    if (n.t === 'lien') {
      el.href = n.href;
      el.target = '_blank';
      el.rel = 'noopener noreferrer';
    }
    el.append(versDom(n.enfants, doc));
    fragment.append(el);
  }
  return fragment;
}

/**
 * Markdown → fragment DOM sûr. niveauTitre : balise des titres « # » et « ## » (3 = <h3>, le titre de l'article étant le <h2>) ;
 * « ### » descend d'un niveau, et ainsi de suite (h6 au plus).
 */
export function rendreMarkdown(source, { niveauTitre = 3, doc = document } = {}) {
  const fragment = doc.createDocumentFragment();
  for (const b of blocs(source)) {
    if (b.type === 'titre') {
      const el = doc.createElement(`h${Math.min(6, niveauTitre + Math.max(0, b.niveau - 2))}`);
      el.append(versDom(enLigne(b.texte), doc));
      fragment.append(el);
    } else if (b.type === 'liste') {
      const el = doc.createElement(b.ordonnee ? 'ol' : 'ul');
      if (b.ordonnee && b.depart !== 1) el.start = b.depart;
      // Pile des listes ouvertes : [liste, sous-liste, …] ; une sous-liste se range dans le dernier élément du niveau du dessus.
      const pile = [el];
      let dernier = null;
      for (const element of b.elements) {
        while (pile.length - 1 > element.niveau) pile.pop();
        if (element.niveau > pile.length - 1 && dernier) {
          const sous = doc.createElement(element.ordonnee ? 'ol' : 'ul');
          if (element.ordonnee && element.numero !== 1) sous.start = element.numero;
          dernier.append(sous);
          pile.push(sous);
        }
        const li = doc.createElement('li');
        li.append(versDom(enLigne(element.texte), doc));
        pile.at(-1).append(li);
        dernier = li;
      }
      fragment.append(el);
    } else {
      const p = doc.createElement('p');
      p.append(versDom(enLigne(b.texte), doc));
      fragment.append(p);
    }
  }
  return fragment;
}

function texteDe(noeuds) {
  return noeuds.map((n) => (n.t === 'texte' ? n.valeur : texteDe(n.enfants))).join('');
}

/** Texte brut (sans mise en forme) du début de l'article, coupé proprement à « max » caractères. */
export function extrait(source, max = 160) {
  // Les intertitres ne font pas partie de l'extrait (sauf s'il n'y a qu'eux).
  const tous = blocs(source);
  const corps = tous.some((b) => b.type !== 'titre') ? tous.filter((b) => b.type !== 'titre') : tous;
  const texte = corps
    .flatMap((b) => (b.type === 'liste' ? b.elements.map((e) => e.texte) : [b.texte]))
    .map((t) => texteDe(enLigne(t)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max + 1);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > max * 0.6 ? coupe.slice(0, espace) : texte.slice(0, max)).replace(/[\s.,;:!?…-]+$/, '')}…`;
}
