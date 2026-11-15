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
  parts.push(sphere('menton', 'head', 'peau', [2.6, 1.6, 1.8], [0, 1.9, 2.9], { skin: true }));
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
// Squelettes du jeu (copie en mémoire de poses-v2.json) avec l'articulation de la paupière ajoutée au squelette v2.
export function enrichirPoses(poses) {
  const p = structuredClone(poses);
  const joints = p.skeletons?.v2?.joints;
  if (Array.isArray(joints) && !joints.some((j) => j.id === PAUPIERE.id)) joints.push({ ...PAUPIERE, range: null });
  return p;
}
// Visage d'un zombie : orbites creuses et sombres, yeux pâles, bouche ouverte, dents.
function visageZombie() {
  const parts = [];
  for (const s of [1, -1]) {
    const x = 1.7 * s;
    parts.push(sphere(`orbite${s > 0 ? 'L' : 'R'}`, 'head', 'sombre', [1.25, 0.95, 0.55], [x, 5.05, 4.2]));
    parts.push(sphere(`oeil${s > 0 ? 'L' : 'R'}`, 'head', 'yeux', [0.5, 0.42, 0.3], [x, 5.0, 4.62], { skin: false }));
  }
  parts.push(box('nez', 'head', 'peau', [1.1, 1.6, 1.1], [0, 4.0, 4.7], [-0.2, 0, 0], { skin: true }));
  parts.push(box('bouche', 'head', 'sombre', [2.6, 1.5, 0.9], [0, 2.3, 4.1], [0.15, 0, 0]));
  parts.push(box('dents', 'head', 'crasse', [2.2, 0.45, 0.5], [0, 2.85, 4.45], [0.15, 0, 0], { skin: false }));
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
function allongerBras(v) {
  v.joints = { ...(v.joints ?? {}), elbowL: [0, -11.5, 0], elbowR: [0, -11.5, 0], wristL: [0, -10.5, 0], wristR: [0, -10.5, 0] };
  for (const p of v.parts) {
    if (p.id === 'upperL') Object.assign(p, { dims: { ...p.dims, h: 12.5 }, offset: [p.offset[0], -5.75, p.offset[2]] });
    if (p.id === 'foreL') Object.assign(p, { dims: { ...p.dims, h: 11.5 }, offset: [p.offset[0], -5.25, p.offset[2]] });
  }
}

// Sphères plus fines (tête, mains, bottes…) : 20 × 14 facettes au lieu de 10 × 7 ; capsules à 16 côtés.
function lisser(parts) {
  for (const p of parts) {
    if (p.kind === 'sphere' && p.dims && (p.dims.w ?? 0) <= 10) Object.assign(p.dims, { w: 20, h: 14 });
    if (p.kind === 'capsule' && p.dims && (p.dims.radial ?? 0) < 16) p.dims.radial = 16;
  }
}

// Copie des données des personnages, enrichie (variantes « riche » du joueur et des zombies).
export function enrichirPersonnages(characters) {
  const c = structuredClone(characters);
  // Joueur : toutes ses variantes (la scène habille le personnage 2 en variante B) ; zombies : la variante « riche ».
  const cibles = c.slots.flatMap((slot) => slot.variants.filter((x) => x.id === 'riche' || (x.kind === 'player' && ['A', 'B', 'C'].includes(x.id))));
  for (const v of cibles) {
    const ids = new Set(v.parts.map((p) => p.id));
    const add = (list) => v.parts.push(...list.filter((p) => !ids.has(p.id)));
    lisser(v.parts);
    if (v.kind === 'player') {
      allongerBras(v);
      add(visageSurvivant({ colere: v.id === 'riche' })); // personnage 1 (variante « riche ») en colère
      if (v.id === 'riche') add(paupiere());
      add(pouce());
      if (ids.has('gunSlide')) add(pistolet());
    } else {
      add(visageZombie());
      add(pouce());
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
