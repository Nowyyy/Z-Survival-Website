// Enrichissements des modèles du jeu pour le plan rapproché (lot 1). Les modèles du jeu sont faits pour la vue de dessus, de loin :
// tête sans visage, pistolet en deux boîtes, sphères à 10 × 7 facettes, textures de 128 px (joueur) ou 256 px (zombies).
// Les fichiers copiés (scene/jeu/) ne sont PAS modifiés : les pièces sont ajoutées à une copie des données en mémoire
// (characters-v2.json, variante « riche »), au chargement de la scène. Liste tenue à jour dans Docs/lots/lot-1.md.
import * as THREE from 'three';
import { createPersoTexture, persoSpec } from '../jeu/js/core/texgen-persos.js';

const R = Math.PI / 2;
const sphere = (id, joint, palette, [rx, ry, rz], offset, extra = {}) => ({ id, joint, kind: 'sphere', dims: { rx, ry, rz, w: 12, h: 8 }, offset, rotation: [0, 0, 0], palette, widen: false, ...extra });
const box = (id, joint, palette, [w, h, d], offset, rotation = [0, 0, 0], extra = {}) => ({ id, joint, kind: 'box', dims: { w, h, d }, offset, rotation, palette, ...extra });

// Visage d'un survivant : yeux (blanc + pupille), sourcils, nez, bouche, mâchoire un peu marquée. Tête du jeu : sphère 4,5 × 4,9 × 4,7
// centrée en (0 ; 4,5 ; 0,2) sur l'articulation « head » ; l'avant est +z.
// colere (personnage 1, retour du propriétaire) : sourcils froncés en V (bouts intérieurs plus bas et rapprochés, bouts extérieurs
// relevés, plus épais) et bouche serrée (plus courte et plus fine).
function visageSurvivant({ colere = false } = {}) {
  const parts = [];
  for (const s of [1, -1]) {
    const x = 1.65 * s;
    parts.push(sphere(`oeilBlanc${s > 0 ? 'L' : 'R'}`, 'head', 'crasse', [0.95, 0.62, 0.45], [x, 5.15, 4.35], { skin: false }));
    parts.push(sphere(`pupille${s > 0 ? 'L' : 'R'}`, 'head', 'sombre', [0.48, 0.48, 0.3], [x, 5.1, 4.72]));
    // Froncés mais au-dessus des yeux : bout intérieur à 5,9 (haut du blanc de l'œil : 5,77), et devant l'œil (face avant à 4,95 ; l'œil
    // dépasse jusqu'à 4,8, la pupille 5,02 mais plus bas) : l'œil ne traverse plus le sourcil (retour du propriétaire).
    if (colere) parts.push(box(`sourcil${s > 0 ? 'L' : 'R'}`, 'head', 'sombre', [2.2, 0.66, 0.7], [1.6 * s, 6.28, 4.6], [0.2, 0, 0.32 * s]));
    else parts.push(box(`sourcil${s > 0 ? 'L' : 'R'}`, 'head', 'sombre', [2.1, 0.55, 0.8], [x, 6.25, 4.25], [0.15, 0, -0.12 * s]));
  }
  parts.push(box('nez', 'head', 'peau', [1.1, 1.9, 1.3], [0, 4.4, 4.75], [-0.25, 0, 0], { skin: true }));
  parts.push(colere ? box('bouche', 'head', 'sombre', [1.5, 0.3, 0.6], [0, 2.8, 4.35]) : box('bouche', 'head', 'sombre', [1.9, 0.38, 0.6], [0, 2.75, 4.35]));
  // (Pas de « menton » ajouté : la bosse sous la bouche a été retirée, retour du propriétaire.)
  return parts;
}
// Paupière gauche du tireur (personnage 1, variante « riche ») : il ferme l'œil gauche pour viser, juste avant le coup de feu, et le
// rouvre après (js/poses.js). La tête du jeu est une seule géométrie : la paupière (couleur peau, avec un trait de cils) est une pièce
// portée par une articulation à elle, « paupiereL », posée au ras du haut de l'œil ; son échelle verticale ferme l'œil (1) ou le laisse
// ouvert (presque 0 : la paupière rentre sous l'arcade).
export const PAUPIERE = { id: 'paupiereL', parent: 'head', offset: [1.65, 5.78, 4.48] };
function paupiere() {
  return [
    sphere('paupiereL', PAUPIERE.id, 'peau', [1.08, 0.7, 0.62], [0, -0.64, 0.02], { skin: true }),
    box('cilsL', PAUPIERE.id, 'sombre', [1.9, 0.24, 0.3], [0, -1.2, 0.58], [0, 0, 0.08]),
  ];
}
// Bouche du zombie, qui s'ouvre quand il tend le bras (retour du propriétaire, js/poses.js) : une cavité sombre arrondie, logée dans le
// visage (seul son devant affleure), portée par une articulation à elle, « boucheZ », placée en son centre ; son échelle l'agrandit en
// suivant la courbe du visage (un rectangle qui s'allonge flotterait devant le menton, la tête du jeu étant une sphère).
export const BOUCHE = { id: 'boucheZ', parent: 'head', offset: [0, 2.3, 3.35] };
// Yeux du zombie (détails : ils se ferment quand la balle le frappe) : les deux globes sont portés par « yeuxZ » ; écrasée, l'articulation ne
// laisse voir que les orbites sombres (yeux fermés).
export const YEUX = { id: 'yeuxZ', parent: 'head', offset: [0, 5.0, 4.62] };
// Squelettes du jeu (copie en mémoire de poses-v2.json) avec les articulations de la paupière et de la bouche ajoutées au squelette v2.
export function enrichirPoses(poses) {
  const p = structuredClone(poses);
  const joints = p.skeletons?.v2?.joints;
  for (const j of [PAUPIERE, BOUCHE, YEUX]) if (Array.isArray(joints) && !joints.some((x) => x.id === j.id)) joints.push({ ...j, range: null });
  return p;
}
// Visage d'un zombie : orbites creuses et sombres, yeux pâles, bouche ouverte, dents.
function visageZombie() {
  const parts = [];
  for (const s of [1, -1]) {
    const x = 1.7 * s;
    parts.push(sphere(`orbite${s > 0 ? 'L' : 'R'}`, 'head', 'sombre', [1.25, 0.95, 0.55], [x, 5.05, 4.2]));
    parts.push(sphere(`oeil${s > 0 ? 'L' : 'R'}`, YEUX.id, 'yeux', [0.5, 0.42, 0.3], [x, 0, 0], { skin: false }));
  }
  parts.push(box('nez', 'head', 'peau', [1.1, 1.6, 1.1], [0, 4.0, 4.7], [-0.2, 0, 0], { skin: true }));
  // Au repos, l'articulation est écrasée (bouche fermée : un trait sombre) ; elle s'agrandit quand il tend le bras (js/poses.js). Les dents
  // du haut sont portées par la même articulation : elles n'apparaissent que bouche ouverte.
  parts.push(sphere('bouche', BOUCHE.id, 'sombre', [1.5, 0.85, 1.3], [0, 0, 0]));
  parts.push(box('dents', BOUCHE.id, 'crasse', [2.1, 0.4, 0.5], [0, 0.5, 1.0], [0.15, 0, 0], { skin: false }));
  return parts;
}
// Pouces (les mains du jeu : une sphère et une boîte de doigts).
const pouce = () => [{ id: 'pouceL', joint: 'wristL', kind: 'capsule', dims: { r: 0.75, h: 3, caps: 2, radial: 8 }, offset: [-1.4, -2.2, 1.5], rotation: [0.6, 0, 0.5], palette: 'peau', mirror: true, skin: true, widen: false }];
// Pistolet : canon, pontet et queue de détente, guidon et hausse, talon de chargeur, flanc de glissière plus sombre (pièce « prop »).
function pistolet() {
  return [
    { id: 'gunCanon', joint: 'prop', kind: 'capsule', dims: { r: 0.75, h: 2.6, caps: 1, radial: 10 }, offset: [0, 0.5, 8.6], rotation: [R, 0, 0], palette: 'sombre', widen: false },
    box('gunPontet', 'prop', 'metal', [0.9, 0.7, 3.4], [0, -2.2, -0.8]),
    box('gunPontetAvant', 'prop', 'metal', [0.9, 2.0, 0.7], [0, -1.6, 0.9]),
    box('gunDetente', 'prop', 'sombre', [0.6, 1.4, 0.5], [0, -1.4, -0.9], [0.3, 0, 0]),
    box('gunGuidon', 'prop', 'sombre', [0.6, 0.9, 0.8], [0, 2.75, 7.2]),
    box('gunHausse', 'prop', 'sombre', [2.4, 0.9, 0.8], [0, 2.75, -5.3]),
    box('gunTalon', 'prop', 'sombre', [3.2, 0.7, 3.6], [0, -6.3, -3.5]),
    box('gunStries', 'prop', 'sombre', [3.36, 1.6, 2.6], [0, 0.9, -4.2]),
  ];
}

// Bras allongés (survivants) : le jeu a des bras de 19 unités (10 + 9) pour une carrure de 23 ; tenir l'arme à deux mains devant les yeux
// obligeait les bras à rentrer en biais à travers le gilet. Proportions humaines : bras de 22 (11,5 + 10,5), pièces allongées d'autant.
// Torse du jeu sous le gilet (retour du propriétaire : « un trou sous le bras ») : la capsule de la poitrine (5,2 × 1,85 = 9,6 de
// demi-largeur) était plus large que le gilet et son bord arrondi ressortait sur le côté, sous le bras. Elle est rétrécie pour rester
// dedans (cachée par le gilet). demi : demi-largeur intérieure du gilet.
function torseSousGilet(v, demi) {
  const p = v.parts.find((x) => x.id === 'chest');
  if (p?.dims) p.dims = { ...p.dims, sx: Math.min(p.dims.sx ?? 1, (demi - 0.3) / p.dims.r) };
}

function allongerBras(v) {
  v.joints = { ...(v.joints ?? {}), elbowL: [0, -11.5, 0], elbowR: [0, -11.5, 0], wristL: [0, -10.5, 0], wristR: [0, -10.5, 0] };
  for (const p of v.parts) {
    if (p.id === 'upperL') Object.assign(p, { dims: { ...p.dims, h: 12.5 }, offset: [p.offset[0], -5.75, p.offset[2]] });
    if (p.id === 'foreL') Object.assign(p, { dims: { ...p.dims, h: 11.5 }, offset: [p.offset[0], -5.25, p.offset[2]] });
  }
}

// Épaules du zombie (retour du propriétaire : « les bras sont détachés du corps ») : l'articulation de l'épaule du jeu est à 11,5 du centre,
// en dehors du torse (9,6 de demi-largeur) ; bras tendus vers l'avant (à plat ventre), un vide apparaît entre le torse et le haut du bras.
// Une épaule arrondie fait la jonction : portée par le torse (articulation « chest », elle ne tourne pas avec le bras), centrée sur
// l'articulation de l'épaule (chest + [±11,5 ; 8 ; 0]), un peu vers le corps. Le bras tourne autour de ce point : elle couvre la jonction
// quelle que soit sa position.
const epaules = () => [1, -1].map((s) => sphere(`epaule${s > 0 ? 'L' : 'R'}`, 'chest', 'tenue', [3.6, 3.6, 3.4], [10.9 * s, 8, 0], { cloth: true }));

// Sphères plus fines (tête, mains, bottes…) : 20 × 14 facettes au lieu de 10 × 7 ; capsules à 16 côtés.
function lisser(parts) {
  for (const p of parts) {
    if (p.kind === 'sphere' && p.dims && (p.dims.w ?? 0) <= 10) Object.assign(p.dims, { w: 20, h: 14 });
    if (p.kind === 'capsule' && p.dims && (p.dims.radial ?? 0) < 16) p.dims.radial = 16;
  }
}

// Personnage 2 en militaire (retour du propriétaire), au style différent du personnage 1 (casquette, gilet sable, sac à dos) : casque rond
// avec rebord, jugulaires, lunettes relevées et petite lampe sur le côté ; gilet pare-balles sombre avec trois porte-chargeurs et une radio ;
// sac d'hydratation plat ; gants ; treillis kaki et olive. Variante « militaire » construite à partir de la variante « riche » du jeu.
export const MILITAIRE = 'militaire';
function militaire(riche) {
  const m = structuredClone(riche);
  m.id = MILITAIRE;
  m.label = 'Militaire (scène de l’accueil)';
  m.parts = m.parts
    .filter((p) => !['cap', 'capBrim', 'vestA', 'pack'].includes(p.id))
    .map((p) => (['handL', 'fingersL'].includes(p.id) ? { ...p, palette: 'sombre', skin: false } : p)); // gants
  const taper = (id, joint, palette, d, offset) => ({ id, joint, kind: 'taper', dims: { sides: 14, ...d }, offset, rotation: [0, 0, 0], palette });
  m.parts.push(
    sphere('casque', 'head', 'accent', [5.5, 2.9, 5.6], [0, 7.6, -0.2]),
    taper('casqueBord', 'head', 'accent', { r0: 5.75, r1: 5.55, h: 0.8, sx: 1, sz: 1.04 }, [0, 6.75, -0.2]),
    box('jugulaireL', 'head', 'sombre', [0.45, 3.8, 0.6], [4.35, 4.7, 0.9], [0.25, 0, 0], { mirror: true }),
    box('lunettesBande', 'head', 'sombre', [8.4, 1.1, 0.8], [0, 8.1, 4.75], [-0.35, 0, 0]),
    box('lunettesVerreL', 'head', 'metal', [2.0, 1.3, 0.7], [1.3, 8.1, 5.15], [-0.35, 0, 0], { mirror: true }),
    { ...box('lampeCasque', 'head', 'lampe', [1.4, 1.1, 1.3], [-5.15, 7.3, 1.6]), material: 'glow' },
    box('gilet', 'chest', 'accent', [16, 10.8, 12.8], [0, 4.2, 0]),
    ...[-4.3, 0, 4.3].map((x, i) => box(`chargeur${i + 1}`, 'chest', 'sac', [2.8, 3.6, 1.6], [x, 1.9, 7.1])),
    box('radio', 'chest', 'sombre', [2.4, 4, 1.8], [5.6, 7.7, 6.8]),
    box('hydratation', 'chest', 'accent', [9, 10, 3.6], [0, 4, -7.9]),
  );
  m.outfits = [{ id: 'treillis', label: 'treillis', palette: { tenue: '--perso-tissu-kaki', pantalon: '--perso-tissu-olive', accent: '--perso-sombre' } }];
  m.flags = { ...(m.flags ?? {}), militaireScene: true };
  return m;
}

// Copie des données des personnages, enrichie (variantes « riche » du joueur et des zombies).
export function enrichirPersonnages(characters) {
  const c = structuredClone(characters);
  const joueur = c.slots.find((x) => x.id === 'joueur');
  const riche = joueur?.variants.find((x) => x.id === 'riche');
  if (riche && !joueur.variants.some((x) => x.id === MILITAIRE)) joueur.variants.push(militaire(riche));
  // Joueur : toutes ses variantes (dont « militaire », le personnage 2) ; zombies : la variante « riche ».
  const cibles = c.slots.flatMap((slot) => slot.variants.filter((x) => x.id === 'riche' || (x.kind === 'player' && ['A', 'B', 'C', MILITAIRE].includes(x.id))));
  for (const v of cibles) {
    const ids = new Set(v.parts.map((p) => p.id));
    const add = (list) => v.parts.push(...list.filter((p) => !ids.has(p.id)));
    // Lambeaux de tissu plats du jeu (pièces « quad » : carrés sans épaisseur, au coude, au ventre, au dos, aux hanches), lisibles vus de
    // dessus mais qui flottent comme des carrés vus de près (retour du propriétaire : « le carré qui dépasse du coude ») : retirés.
    v.parts = v.parts.filter((p) => p.kind !== 'quad');
    lisser(v.parts);
    if (v.kind === 'player') {
      allongerBras(v);
      if (v.id === 'riche') torseSousGilet(v, 17.5 / 2); // gilet du jeu (vestA, 17,5 de large)
      if (v.id === MILITAIRE) torseSousGilet(v, 16 / 2); // gilet pare-balles (16 de large)
      add(visageSurvivant({ colere: v.id === 'riche' })); // personnage 1 (variante « riche ») en colère
      if (v.id === 'riche') add(paupiere());
      add(pouce());
      if (v.id === MILITAIRE) for (const p of v.parts) if (p.id === 'pouceL') Object.assign(p, { palette: 'sombre', skin: false }); // gants
      if (ids.has('gunSlide')) add(pistolet());
    } else {
      add(visageZombie());
      add(pouce());
      add(epaules());
    }
    v.flags = { ...(v.flags ?? {}), enrichiScene: true };
  }
  return c;
}

// Textures des personnages en 512 px (le jeu : 128 px pour le joueur, 256 px pour les zombies) : même motif, même disposition,
// plus net de près. Appelé avant la création des personnages (les tuiles de blessure clonent cette texture).
export function texturesFines(kit, slots) {
  for (const [slotId, choice] of slots) {
    const k = kit.slotKit(slotId, choice);
    const base = k.woundAt(0).map;
    const tex = createPersoTexture(persoSpec({ ...k.spec, size: 512 }));
    base.image = { data: new Uint8Array(tex.data.buffer), width: tex.width, height: tex.height };
    base.anisotropy = 8;
    base.needsUpdate = true;
  }
}
export { THREE };

// Barbe du personnage 1 (retour du propriétaire : « juste une texture, pas d'élément 3D ») : peinte dans les couleurs des sommets de la
// tête (le modèle du jeu n'a qu'une texture de détail commune à toute la peau) : mâchoire, menton, moustache et favoris assombris par une
// barbe de quelques jours, d'intensité irrégulière (hachage par sommet), fondue sur ses bords. char : personnage du kit (char.body) ;
// rgb : couleur de la barbe en [r, g, b] linéaires. La géométrie modifiée n'est utilisée que par ce personnage (variante « riche »).
export function peindreBarbe(char, rgb) {
  const mesh = char.body;
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const col = g.attributes.color;
  const si = g.attributes.skinIndex;
  const iTete = mesh.skeleton.bones.findIndex((b) => b.name === 'head');
  if (iTete < 0 || !col) return;
  // Centre de la tête au repos : position de repos de l'articulation (inverse de sa matrice de liaison) + décalage de la sphère.
  const repos = mesh.skeleton.boneInverses[iTete].clone().invert();
  const centre = new THREE.Vector3(0, 4.5, 0.2).applyMatrix4(repos);
  const v = new THREE.Vector3();
  const hache = (i) => {
    let h = Math.imul(i + 11, 2654435761);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  };
  const fond = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
  const nouvelle = new Float32Array(col.array);
  for (let i = 0; i < pos.count; i += 1) {
    if (si.getX(i) !== iTete) continue;
    v.fromBufferAttribute(pos, i).sub(centre);
    const d = Math.hypot(v.x / 4.5, v.y / 4.9, v.z / 4.7);
    if (d < 0.9 || d > 1.12 || v.z < -0.6) continue; // seulement la surface de la tête, de face et de côté
    const ax = Math.abs(v.x);
    const machoire = (1 - fond(v.y, -1.6, -0.9)) * fond(v.z, -0.6, 0.8); // bas du visage, sous la bouche, et le long de la mâchoire
    const favoris = ax > 3.3 && v.z > 0.9 ? 1 - fond(v.y, -0.6, 0.6) : 0; // joues et favoris, devant les oreilles
    const moustache = ax < 1.7 && v.z > 3.4 && v.y > -1.65 && v.y < -0.95 ? 1 : 0;
    const k = Math.max(machoire, favoris, moustache);
    if (k <= 0) continue;
    const f = k * (0.55 + 0.35 * hache(i));
    for (let c = 0; c < 3; c += 1) nouvelle[i * 3 + c] = col.array[i * 3 + c] * (1 - f) + rgb[c] * f;
  }
  g.setAttribute('color', new THREE.BufferAttribute(nouvelle, 3));
}

// Détails (retour du propriétaire : « une texture différente aux gilets qu'aux vêtements ») : les triangles du gilet sont sortis du corps
// et rendus par un second maillage articulé sur le même squelette, avec sa propre texture de tissu générée en code (le corps garde la
// texture du jeu). style : 'toile' (personnage 1 : toile de coton serrée, coutures piquées) ou 'cordura' (personnage 2 : nylon épais à
// sangles horizontales du gilet pare-balles). shared : géométrie partagée de la tenue (kit.slotKit(...).shared.get(tenue)) ; ids : débuts
// des identifiants des pièces du gilet ; teinte : facteur sur leur couleur.
function textureGilet(style) {
  const n = 256;
  const toile = document.createElement('canvas');
  toile.width = n;
  toile.height = n;
  const g = toile.getContext('2d');
  let graine = style === 'toile' ? 7 : 19;
  const hasard = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
  g.fillStyle = '#e6e6e6';
  g.fillRect(0, 0, n, n);
  // Trame : fils fins croisés, légèrement irréguliers.
  const pas = style === 'toile' ? 3 : 4;
  for (let i = 0; i < n; i += pas) {
    g.fillStyle = `rgba(0,0,0,${0.05 + 0.06 * hasard()})`;
    g.fillRect(0, i, n, 1);
    g.fillStyle = `rgba(255,255,255,${0.04 + 0.05 * hasard()})`;
    g.fillRect(i, 0, 1, n);
  }
  // Grain : petites taches claires et sombres.
  for (let i = 0; i < 2600; i += 1) {
    g.fillStyle = hasard() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
    g.fillRect(hasard() * n, hasard() * n, 1 + hasard() * 2, 1 + hasard() * 2);
  }
  const piqure = (x0, y0, x1, y1) => {
    g.strokeStyle = 'rgba(30,24,16,0.6)';
    g.lineWidth = 1.5;
    g.setLineDash([5, 4]);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.setLineDash([]);
  };
  if (style === 'toile') {
    // Panneaux matelassés : coutures piquées et léger relief entre elles.
    for (let y = 0; y < n; y += 64) {
      const d = g.createLinearGradient(0, y, 0, y + 64);
      d.addColorStop(0, 'rgba(0,0,0,0.16)');
      d.addColorStop(0.25, 'rgba(255,255,255,0.05)');
      d.addColorStop(0.8, 'rgba(0,0,0,0)');
      d.addColorStop(1, 'rgba(0,0,0,0.12)');
      g.fillStyle = d;
      g.fillRect(0, y, n, 64);
      piqure(0, y + 3, n, y + 3);
    }
    piqure(n / 2, 0, n / 2, n);
  } else {
    // Sangles horizontales (porte-équipement), cousues par des points d'arrêt réguliers.
    for (let y = 16; y < n; y += 64) {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(0, y, n, 22);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, y, n, 2);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(0, y + 22, n, 2);
      for (let x = 0; x < n; x += 32) {
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x, y, 3, 22);
      }
    }
  }
  const tex = new THREE.CanvasTexture(toile);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function texturerGilet(char, shared, ids, { style = 'toile', teinte = 1, tuile = 9 } = {}) {
  const corps = char.body;
  const g = corps.geometry;
  if (!shared || g.index) return null;
  const tris = [];
  shared.triParts.forEach((pi, t) => { const id = shared.parts[pi]?.id ?? ''; if (ids.some((x) => id.startsWith(x))) tris.push(t); });
  if (!tris.length) return null;
  const geo = new THREE.BufferGeometry();
  for (const nom of ['position', 'normal', 'color', 'skinIndex', 'skinWeight']) {
    const a = g.getAttribute(nom);
    const out = new a.array.constructor(tris.length * 3 * a.itemSize);
    tris.forEach((t, j) => out.set(a.array.subarray(t * 3 * a.itemSize, (t + 1) * 3 * a.itemSize), j * 3 * a.itemSize));
    if (nom === 'color') for (let i = 0; i < out.length; i += 1) out[i] *= teinte;
    geo.setAttribute(nom, new THREE.BufferAttribute(out, a.itemSize));
  }
  // Coordonnées de texture planes, face par face (axe dominant de la normale), en unités du personnage : bandes horizontales sur les côtés.
  const p = geo.attributes.position.array;
  const nrm = geo.attributes.normal.array;
  const uv = new Float32Array(tris.length * 3 * 2);
  for (let j = 0; j < tris.length; j += 1) {
    const b = j * 9;
    const nx = Math.abs(nrm[b] + nrm[b + 3] + nrm[b + 6]);
    const ny = Math.abs(nrm[b + 1] + nrm[b + 4] + nrm[b + 7]);
    const nz = Math.abs(nrm[b + 2] + nrm[b + 5] + nrm[b + 8]);
    for (let v = 0; v < 3; v += 1) {
      const [x, y, z] = [p[b + v * 3], p[b + v * 3 + 1], p[b + v * 3 + 2]];
      const [u, w] = ny >= nx && ny >= nz ? [x, z] : nx >= nz ? [z, y] : [x, y];
      uv[(j * 3 + v) * 2] = u / tuile;
      uv[(j * 3 + v) * 2 + 1] = w / tuile;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  // Le corps ne dessine plus ces triangles (ramenés à un point).
  const pos = g.getAttribute('position').clone();
  for (const t of tris) for (let v = 1; v < 3; v += 1) for (let c = 0; c < 3; c += 1) pos.array[(t * 3 + v) * 3 + c] = pos.array[t * 9 + c];
  g.setAttribute('position', pos);
  const gilet = new THREE.SkinnedMesh(geo, new THREE.MeshLambertMaterial({ map: textureGilet(style), vertexColors: true }));
  gilet.name = 'gilet-detail';
  gilet.bindMode = corps.bindMode;
  gilet.position.copy(corps.position);
  gilet.quaternion.copy(corps.quaternion);
  gilet.scale.copy(corps.scale);
  corps.parent.add(gilet);
  gilet.bind(corps.skeleton, corps.bindMatrix);
  gilet.castShadow = corps.castShadow;
  gilet.receiveShadow = corps.receiveShadow;
  gilet.frustumCulled = false;
  return gilet;
}
