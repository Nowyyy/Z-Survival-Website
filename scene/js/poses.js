// Poses de la scène, construites à la main (aucune n'existe dans le jeu) : personnage 1 qui vise au loin, personnage 2 qui cloue le
// zombie au sol du pied et le vise vers le bas, zombie à plat ventre (un bras tendu, l'autre qui griffe le sol). Chaque pose est une
// fonction du temps t de la boucle (js/boucle.js) : respiration, armes qui bougent un peu, appui du pied, zombie qui se débat.
// Repère de mise en scène (groupe `stage`) : y vers le haut, +z vers la caméra, +x vers la droite de l'image ; unités du jeu (60 par mètre).
import * as THREE from 'three';
import { bosse, bruit, cycle, onde } from './boucle.js';
import { V, euler, lookQuat, placeBone, pointBone, twoBone, worldPos } from './rig.js';

const UP = V(0, 1, 0);
// Échelle de la mise en scène par rapport au monde du jeu. Dans le jeu, un personnage mesure 60 unités (1 m à l'échelle de la carte : 60 unités
// par mètre) pour des murs de 180 (un étage de 3 m) : vu de face, il aurait l'air d'un enfant. La scène grandit personnages, lampes et
// distances de 1,6 (1,60 m) ; le repère `stage` porte cette échelle, les poses restent en unités des personnages.
export const ECHELLE_SCENE = 1.6;
const ANKLE = 3.5; // hauteur de la cheville au-dessus de la semelle (squelette v2 : 27 - 12 - 11,5)

// Prises de l'arme dans le repère de l'arme (« prop ») : celles du jeu (js/core/pose-v2.js, playerArms).
const GRIP_R = V(0, -2, -3);
const GRIP_L = V(1.5, -1, -0.5);

// Mise en place (repère de la scène) ; réglages modifiables pour retoucher les poses.
export const PLACEMENT = {
  p1: { x: -30, z: 34, cap: 12 }, // personnage 1 : au premier plan à gauche ; cap en degrés (0 = face à la caméra, + = vers la droite de l'image)
  p1Vise: V(330, 64, 900), // point visé par le personnage 1 : au loin, à droite de la caméra
  zombie: { x: 22, z: -18, cap: -30 }, // bassin du zombie ; cap = direction de sa tête (0 : vers la caméra)
  p2: { dx: -12, dz: 3, cap: 28 }, // personnage 2, dans le repère du zombie : à son flanc droit, à hauteur de la taille ; cap ajouté à celui du zombie
};

// Appui du pied du personnage 2 (0 à 1) : il appuie un peu plus deux fois par boucle ; le zombie s'enfonce d'autant.
export const appuiAt = (t) => 0.5 + 0.5 * onde(t, 2, 0.6);

const toWorld = (stage, v) => stage.localToWorld(v.clone());
const dirWorld = (stage, v) => v.clone().transformDirection(stage.matrixWorld);
const capRad = (deg) => (deg * Math.PI) / 180;

// Pied posé : cheville à `ankle` (monde), pied orienté vers `fwd` (monde), semelle sur la normale `normal`.
function leg(p, side, ankle, knee, fwd, normal = UP) {
  const hip = p.bones.get(`hip${side}`);
  const kn = p.bones.get(`knee${side}`);
  const an = p.bones.get(`ankle${side}`);
  twoBone(hip, kn, an.position.clone(), ankle, knee, { bendLocal: V(0, 0, -1) });
  pointBone(an, V(0, 0, 1), fwd.clone().sub(normal.clone().multiplyScalar(fwd.dot(normal))), V(0, 1, 0), normal);
}
// Bras vers une prise (monde), coude vers `elbow` (monde).
function arm(p, side, wrist, elbow, handDir = null, handUp = null) {
  const sh = p.bones.get(`shoulder${side}`);
  const el = p.bones.get(`elbow${side}`);
  const wr = p.bones.get(`wrist${side}`);
  twoBone(sh, el, wr.position.clone(), wrist, elbow, { bendLocal: V(0, 0, 1) });
  if (handDir) pointBone(wr, V(0, -1, 0), handDir, V(0, 0, 1), handUp ?? UP);
}
// Tête (et cou) vers un point : le cou prend `share` de la rotation.
function look(p, target, share = 0.35) {
  const neck = p.bones.get('neck');
  const head = p.bones.get('head');
  const dir = target.clone().sub(worldPos(head));
  const base = new THREE.Vector3(0, 0, 1).transformDirection(neck.parent.matrixWorld);
  const mid = base.clone().lerp(dir.clone().normalize(), share).normalize();
  pointBone(neck, V(0, 0, 1), mid, V(0, 1, 0), UP);
  pointBone(head, V(0, 0, 1), dir, V(0, 1, 0), UP);
}
// Arme tenue à deux mains : bout de l'arme (« prop ») à `at`, canon vers `dir` ; mains sur les prises.
function holdGun(p, at, dir, elbowsOut = 10) {
  const prop = p.bones.get('prop');
  const q = lookQuat(dir, UP);
  placeBone(prop, at, q);
  prop.scale.setScalar(1);
  const tool = p.bones.get('tool');
  if (tool) tool.scale.setScalar(0.001); // marteau du jeu caché (comme playerArms)
  const gR = prop.localToWorld(GRIP_R.clone());
  const gL = prop.localToWorld(GRIP_L.clone());
  const chest = p.bones.get('chest');
  const right = V(-1, 0, 0).transformDirection(chest.matrixWorld);
  const down = V(0, -1, 0).transformDirection(chest.matrixWorld);
  const back = V(0, 0, -1).transformDirection(chest.matrixWorld);
  const elbowR = worldPos(p.bones.get('shoulderR')).add(right.clone().multiplyScalar(elbowsOut)).add(down.clone().multiplyScalar(12)).add(back.clone().multiplyScalar(4));
  const elbowL = worldPos(p.bones.get('shoulderL')).add(right.clone().multiplyScalar(-elbowsOut)).add(down.clone().multiplyScalar(12)).add(back.clone().multiplyScalar(4));
  arm(p, 'R', gR, elbowR, dir, UP);
  arm(p, 'L', gL, elbowL, dir, UP);
}
function placeRoot(p, stage, x, z, cap, y = 0) {
  p.root.position.copy(toWorld(stage, V(x, y, z)));
  const fwdStage = V(Math.sin(capRad(cap)), 0, Math.cos(capRad(cap)));
  const fw = dirWorld(stage, fwdStage);
  p.root.rotation.set(0, Math.atan2(fw.x, fw.z), 0);
  p.root.updateMatrixWorld(true);
}
const local = (p, x, y, z) => p.root.localToWorld(V(x, y, z));

// --- Personnage 1 : au premier plan, de face, vise au loin (à côté de la caméra) --------------------------------------------------------
export function poseP1(p, stage, t) {
  const P = PLACEMENT.p1;
  p.reset();
  placeRoot(p, stage, P.x, P.z, P.cap);
  const souffle = onde(t, 2); // respiration : 2 cycles par boucle (4 s)
  const derive = bruit(t, 1, 1); // la visée dérive un peu
  const pelvis = p.bones.get('pelvis');
  pelvis.position.y += -2.2 + 0.25 * souffle;
  euler(pelvis, 0.03, -0.12, 0);
  euler(p.bones.get('spine'), 0.06 + 0.012 * souffle, 0.05, 0);
  euler(p.bones.get('chest'), 0.04 + 0.018 * souffle, 0.1, 0);
  p.root.updateMatrixWorld(true);
  // Pieds : gauche un peu devant, droit en arrière (appui de tir).
  leg(p, 'L', local(p, 7, ANKLE, 6), local(p, 9, 16, 30), dirWorld(p.root, V(0.25, 0, 1)));
  leg(p, 'R', local(p, -7.5, ANKLE, -6), local(p, -9, 16, 26), dirWorld(p.root, V(-0.35, 0, 1)));
  // Visée : la tête regarde le point visé, l'arme est tendue devant les yeux, sur l'axe de la visée.
  const vise = toWorld(stage, PLACEMENT.p1Vise).add(V(derive * 6, bruit(t, 2, 1) * 4, 0));
  const head = p.bones.get('head');
  const eye = worldPos(head).add(V(0, 4.5, 0));
  const dir = vise.clone().sub(eye).normalize();
  const at = eye.clone().add(dir.clone().multiplyScalar(15)).add(V(0, -5.5 + 0.35 * souffle, 0));
  holdGun(p, at, vise.clone().sub(at), 7);
  look(p, vise, 0.4);
}

// --- Zombie : à plat ventre, bras gauche tendu vers l'avant, bras droit qui griffe le sol ; il se débat sous le pied -------------------
export function poseZombie(z, stage, t, appui) {
  const P = PLACEMENT.zombie;
  z.reset();
  placeRoot(z, stage, P.x, P.z, P.cap);
  const debat = bruit(t, 5, 2); // se débat (rythme irrégulier mais périodique)
  const pelvis = z.bones.get('pelvis');
  // Couché : le bassin bascule de 90° vers l'avant (le ventre au sol, la tête vers +z du personnage).
  pelvis.position.set(0, 6.2 - 0.6 * appui, 0);
  euler(pelvis, Math.PI / 2 - 0.04, 0.04 * debat, 0.05 * debat);
  euler(z.bones.get('spine'), -0.12 + 0.05 * debat, 0.06 * debat, 0);
  euler(z.bones.get('chest'), -0.1 - 0.12 * appui + 0.04 * onde(t, 4), 0.08 * debat, 0.04 * debat);
  // La tête se relève vers l'avant, tournée vers la caméra, et secouée.
  euler(z.bones.get('neck'), -0.55 + 0.05 * onde(t, 4, 0.2), 0.25 + 0.08 * debat, 0);
  euler(z.bones.get('head'), -0.35 + 0.06 * onde(t, 8, 0.1), 0.2 + 0.1 * bruit(t, 9, 3), 0.1 * debat);
  z.root.updateMatrixWorld(true);
  // Jambes : allongées derrière, pointes de pied au sol, une jambe qui gigote.
  const kick = onde(t, 4, 0.3);
  const lAnkle = local(z, 7.5, 4.2 + 2.5 * Math.max(0, kick), -21 + 1.5 * Math.max(0, kick));
  const rAnkle = local(z, -8, 4, -22);
  const toes = dirWorld(z.root, V(0, -1, -0.25));
  const shinUp = dirWorld(z.root, V(0, 0.15, 1));
  leg(z, 'L', lAnkle, local(z, 9, -20, -11), toes, shinUp);
  leg(z, 'R', rAnkle, local(z, -9, -20, -11), toes, shinUp);
  // Bras gauche tendu loin devant (main à plat qui tâtonne) ; bras droit qui griffe : la main racle le sol vers le corps (4 fois par boucle).
  const reach = onde(t, 2, 0.15);
  arm(z, 'L', local(z, 11, 2.4, 37 + 1.5 * reach), local(z, 20, 12, 28), dirWorld(z.root, V(0.1, -0.25, 1)), dirWorld(z.root, V(0, 1, 0)));
  const g = cycle(t, 4);
  // Griffe : la main avance au-dessus du sol (25 % du cycle), se pose, puis racle vers l'arrière (75 %).
  const rake = g < 0.25 ? g / 0.25 : 1 - (g - 0.25) / 0.75;
  const lift = g < 0.25 ? Math.sin(Math.PI * (g / 0.25)) * 3.5 : 0;
  const s = rake * rake * (3 - 2 * rake);
  arm(z, 'R', local(z, -17, 2.2 + lift, 27 - 15 * s), local(z, -30, 14, 16), dirWorld(z.root, V(-0.2, -0.6, 0.8)), dirWorld(z.root, V(0, 1, 0)));
}

// --- Personnage 2 : un pied sur le dos du zombie, le vise vers le bas ---------------------------------------------------------------
export function poseP2(p, z, stage, t, appui) {
  const P = PLACEMENT.p2;
  const Z = PLACEMENT.zombie;
  p.reset();
  const souffle = onde(t, 2, 0.35);
  const a = capRad(Z.cap);
  placeRoot(p, stage, Z.x + P.dx * Math.cos(a) + P.dz * Math.sin(a), Z.z - P.dx * Math.sin(a) + P.dz * Math.cos(a), Z.cap + P.cap);
  const pelvis = p.bones.get('pelvis');
  // Poids du corps vers l'avant : bassin avancé et un peu bas, buste penché vers le zombie.
  pelvis.position.add(V(0, -3.2 - 0.6 * appui + 0.2 * souffle, 3));
  euler(pelvis, 0.12, 0.25, 0);
  euler(p.bones.get('spine'), 0.22 + 0.03 * appui + 0.01 * souffle, -0.1, 0);
  euler(p.bones.get('chest'), 0.2 + 0.015 * souffle, -0.12, 0);
  p.root.updateMatrixWorld(true);
  // Pied sur le dos : cheville posée sur l'omoplate du zombie (point de son torse, suivi à chaque image).
  const chestZ = z.bones.get('chest');
  const dos = chestZ.localToWorld(V(1, 3, -6.2 - 0.3 * appui)); // dessus du dos (l'arrière du torse, qui regarde le ciel)
  const dosUp = V(0, 0, -1).transformDirection(chestZ.matrixWorld);
  const pied = dos.clone().add(dosUp.clone().multiplyScalar(ANKLE));
  leg(p, 'L', pied, local(p, 10, 34, 34), dirWorld(p.root, V(-0.1, 0, 1)), dosUp);
  // Jambe d'appui : pied droit au sol, en arrière.
  leg(p, 'R', local(p, -7, ANKLE, -9), local(p, -9, 14, 22), dirWorld(p.root, V(-0.3, 0, 1)));
  // Visée vers le bas : canon pointé sur la tête du zombie.
  const tete = worldPos(z.bones.get('head')).add(V(0, 3, 0));
  const chest = p.bones.get('chest');
  const epaules = worldPos(chest).add(V(0, 8, 0));
  const dir = tete.clone().sub(epaules).normalize();
  const at = epaules.clone().add(dir.clone().multiplyScalar(17 + 0.5 * appui)).add(V(0, 0.3 * souffle, 0));
  holdGun(p, at, tete.clone().sub(at), 9);
  look(p, tete, 0.5);
}
