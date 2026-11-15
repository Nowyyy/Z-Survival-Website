// Poses de la scène, construites à la main (aucune n'existe dans le jeu) : personnage 1 qui vise au loin, personnage 2 qui cloue le
// zombie au sol du pied et le vise vers le bas, zombie à plat ventre (un bras tendu, l'autre qui griffe le sol). Chaque pose est une
// fonction du temps t de la boucle (js/boucle.js) : respiration, armes qui bougent un peu, appui du pied, zombie qui se débat.
// Repère de mise en scène (groupe `stage`) : y vers le haut, +z vers la caméra, +x vers la droite de l'image ; unités du jeu (60 par mètre).
import * as THREE from 'three';
import { DUREE, bruit, cycle, onde } from './boucle.js';
import { V, euler, lookQuat, placeBone, pointBone, twoBone, worldPos } from './rig.js';
import { TIR_P2, oeilFerme, recul } from './tir.js';

const UP = V(0, 1, 0);
// Échelle de la mise en scène par rapport au monde du jeu. Dans le jeu, un personnage mesure 60 unités (1 m à l'échelle de la carte : 60 unités
// par mètre) pour des murs de 180 (un étage de 3 m) : vu de face, il aurait l'air d'un enfant. La scène grandit personnages, lampes et
// distances de 1,6 (1,60 m) ; le repère `stage` porte cette échelle, les poses restent en unités des personnages.
export const ECHELLE_SCENE = 1.6;
const K = ECHELLE_SCENE;
const ANKLE = 3.5; // hauteur de la cheville au-dessus de la semelle (squelette v2 : 27 - 12 - 11,5)
// Les décalages appliqués dans le monde sont en unités des personnages, multipliées par K (échelle de la scène, plus bas).
const P1_ARME = 21; // distance des yeux à l'arme du personnage 1 (bras presque tendus)
const P2_ARME = 21; // distance des épaules à l'arme du personnage 2

// Prises de l'arme dans le repère de l'arme (« prop » : +z le canon, +y le dessus, +x la gauche du tireur). Le jeu (pose-v2.js,
// playerArms) pose les poignets au milieu de l'arme, vu de dessus ça suffit ; de près les mains traversaient la glissière.
// Main droite : poignet derrière la crosse, le poing l'entoure (doigts devant la crosse) ; main gauche : sous le canon, paume vers le
// haut, elle porte l'avant de l'arme (demande du propriétaire).
const GRIP_R = V(0, -2.4, -5.9);
const GRIP_L = V(0.6, -2.5, 0.8);
const HAND_R = { dir: V(0, -0.15, 1), up: V(0, -1, 0) }; // axe du poignet vers les doigts, puis côté des doigts repliés
const HAND_L = { dir: V(-0.12, 0, 1), up: V(0, 1, 0) };

// Mise en place (repère de la scène) ; réglages modifiables pour retoucher les poses.
export const PLACEMENT = {
  p1: { x: -30, z: 34, cap: 12 }, // personnage 1 : au premier plan à gauche ; cap en degrés (0 = face à la caméra, + = vers la droite de l'image)
  p1Vise: V(330, 64, 900), // point visé par le personnage 1 : au loin, à droite de la caméra
  zombie: { x: 22, z: -18, cap: -30 }, // bassin du zombie ; cap = direction de sa tête (0 : vers la caméra)
  spectateur: V(-40, 24, 125), // point vers lequel le zombie tend le bras pour attraper (vers la caméra du cadrage B, à peine au-dessus : le bras se tend vers nous presque à l'horizontale)
  p2: { dx: -12, dz: 3, cap: 28 }, // personnage 2, dans le repère du zombie : à son flanc droit, à hauteur de la taille ; cap ajouté à celui du zombie
};

// Le zombie tend le bras gauche vers le spectateur pour l'attraper, une seule fois par boucle (retours du lot 1) : 0 = main au sol, 1 = bras
// tendu. Il tend le bras en 0,55 s à partir de 1,0 s, le garde tendu 1,1 s, le ramène en 0,55 s (fini à 3,2 s, loin du coup de feu de 5,2 s).
export const ATTRAPE = { debut: 1.0, tendre: 0.55, tenir: 1.1, revenir: 0.55 };
// Prévisualisation des détails (?details=1) : le personnage 2 lui tire dessus bras tendu (TIR_P2) ; le bras retombe d'un coup (0,18 s).
export const DETAILS = { actif: false };
const ATTRAPE_DETAILS = { debut: 1.0, tendre: 0.55, tenir: TIR_P2 + 0.04 - 1.55, revenir: 0.18 };
export function attrapeAt(t) {
  const A = DETAILS.actif ? ATTRAPE_DETAILS : ATTRAPE;
  const d = (((t - A.debut) % DUREE) + DUREE) % DUREE;
  const { tendre, tenir, revenir } = A;
  if (d < tendre) return d / tendre;
  if (d < tendre + tenir) return 1;
  if (d < tendre + tenir + revenir) return 1 - (d - tendre - tenir) / revenir;
  return 0;
}

// Petite fenêtre temporelle douce : 0 avant a, monte jusqu'à b, 1 jusqu'à c, redescend à 0 en d (secondes de la boucle, a < b < c < d).
function fenetre(t, a, b, c, d) {
  const l = (k) => k * k * (3 - 2 * k);
  if (t <= a || t >= d) return 0;
  if (t < b) return l((t - a) / (b - a));
  if (t <= c) return 1;
  return 1 - l((t - c) / (d - c));
}
// Détails : personnage 1 qui regarde hors champ à sa droite au début ; personnage 2 qui lève la tête vers lui au même moment ;
// impact de la balle du personnage 2 sur le zombie (secousse qui s'amortit).
// Coup d'œil naturel (retour du propriétaire : « trop lisse ») : la tête part vite et dépasse un peu sa cible (aller en aA secondes,
// dépassement amorti), se réajuste une fois pendant la tenue, puis revient vite, en dépassant à peine le point de départ.
// Coup d'œil (retour du propriétaire : « brusque, pas naturel ») : profil à secousse minimale (départ et arrivée en douceur, comme un
// mouvement de tête réel d'environ une demi-seconde), sans dépassement ; pendant la tenue, la tête continue de glisser très lentement
// (quelques pour cent) au lieu de se figer. Valeur continue et dérivée continue partout (aucun à-coup).
const sansSecousse = (k) => k * k * k * (10 + k * (-15 + 6 * k));
function coupDoeil(t, debut, aller, fin, retour) {
  if (t <= debut || t >= fin + retour) return 0;
  let v = 1;
  if (t < debut + aller) v = sansSecousse((t - debut) / aller);
  else if (t > fin) v = 1 - sansSecousse((t - fin) / retour);
  const u = (t - debut) / (fin + retour - debut);
  return v * (0.94 + 0.08 * Math.sin(Math.PI * u));
}
// Détails : le personnage 1 regarde hors champ après son tir (5,95 à 7,8 s : son retour à la normale relance la boucle) ; le personnage 2
// tourne la tête vers lui pendant un moment calme (3,35 à 4,8 s : zombie inerte, aucun tir).
export const regardP1 = (t, retard = 0) => (DETAILS.actif ? coupDoeil(t - retard, 5.95, 0.6, 7.1, 0.7) : 0);
export const regardP2 = (t, retard = 0) => (DETAILS.actif ? coupDoeil(t - retard, 3.35, 0.5, 4.2, 0.6) : 0);
// Zombie touché par la balle du personnage 2 (TIR_P2) : « vie » de 1 à 0 en 0,1 s (la tête tape le sol, les yeux se ferment), inerte,
// puis il se ranime (yeux qui se rouvrent d'un coup à 6,5 s, tête qui se relève jusqu'à 7,5 s) avant la fin de la boucle.
export function vieZombie(t) {
  if (!DETAILS.actif) return 1;
  const l = (k) => k * k * (3 - 2 * k);
  if (t < TIR_P2) return 1;
  if (t < TIR_P2 + 0.1) return 1 - (t - TIR_P2) / 0.1;
  if (t < 6.5) return 0;
  if (t < 7.5) return l((t - 6.5) / 1.0);
  return 1;
}
// Rebond de la tête sur le sol juste après l'impact (amorti, 0,6 s).
export function rebondZombie(t) {
  if (!DETAILS.actif) return 0;
  const d = t - TIR_P2 - 0.1;
  if (d < 0 || d > 0.6) return 0;
  return Math.exp(-d * 8) * Math.sin(d * 28);
}
// Rotations ajoutées à la tête quand il est au tapis (réglées pour que la joue touche le sol sans y entrer).
export const MORT = { cou: 0.72, tete: 0.36, roulis: 0.3 };
export const yeuxZombie = (t) => (DETAILS.actif ? (t >= TIR_P2 + 0.05 && t < 6.5 ? 0.06 : 1) : 1);

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
// Arme tenue à deux mains : origine de l'arme (« prop ») à `at`, canon vers `dir`, `roll` : rotation autour du canon ; mains sur la crosse,
// coudes vers le bas et un peu en dehors (jamais dans le buste).
function holdGun(p, at, dir, { elbowsOut = 5, up = UP } = {}) {
  const prop = p.bones.get('prop');
  const q = lookQuat(dir, up);
  placeBone(prop, at, q);
  prop.scale.setScalar(1);
  const tool = p.bones.get('tool');
  if (tool) tool.scale.setScalar(0.001); // marteau du jeu caché (comme playerArms)
  const toW = (v) => v.clone().applyQuaternion(q);
  const gR = prop.localToWorld(GRIP_R.clone());
  const gL = prop.localToWorld(GRIP_L.clone());
  const chest = p.bones.get('chest');
  const right = V(-1, 0, 0).transformDirection(chest.matrixWorld);
  const down = V(0, -1, 0);
  // Coudes : en avant (vers l'arme), un peu bas et en dehors.
  const fw = dir.clone().normalize();
  const elbowR = worldPos(p.bones.get('shoulderR')).add(right.clone().multiplyScalar(elbowsOut)).add(down.clone().multiplyScalar(8)).add(fw.clone().multiplyScalar(10));
  const elbowL = worldPos(p.bones.get('shoulderL')).add(right.clone().multiplyScalar(-elbowsOut)).add(down.clone().multiplyScalar(8)).add(fw.clone().multiplyScalar(10));
  arm(p, 'R', gR, elbowR, toW(HAND_R.dir), toW(HAND_R.up));
  arm(p, 'L', gL, elbowL, toW(HAND_L.dir), toW(HAND_L.up));
}
// Main qui pointe vers handDir, côté des doigts (z local) vers handUp.
function placeRoot(p, stage, x, z, cap, y = 0) {
  p.root.position.copy(toWorld(stage, V(x, y, z)));
  const fwdStage = V(Math.sin(capRad(cap)), 0, Math.cos(capRad(cap)));
  const fw = dirWorld(stage, fwdStage);
  p.root.rotation.set(0, Math.atan2(fw.x, fw.z), 0);
  p.root.updateMatrixWorld(true);
}
const local = (p, x, y, z) => p.root.localToWorld(V(x, y, z));

// --- Personnage 1 : au premier plan, tir à genou (position militaire), vise au loin à côté de la caméra ------------------------------
// Genou droit au sol, orteils repliés derrière ; pied gauche à plat devant, genou levé ; buste droit, un peu penché vers l'avant ; œil
// gauche fermé pour le tir seulement (js/enrichissements.js, js/tir.js). Retours du lot 1 : debout, son arme sortait du haut du cadre.
const GENOU = { bassin: 16.4, genouD: [-6.2, -5], chevilleD: [-6.4, 7.7, -15.6], piedG: [6.5, 13.5] };
export function poseP1(p, stage, t) {
  const P = PLACEMENT.p1;
  p.reset();
  placeRoot(p, stage, P.x, P.z, P.cap);
  const souffle = onde(t, 2); // respiration : 2 cycles par boucle (4 s)
  const derive = bruit(t, 1, 1); // la visée dérive un peu
  const r = recul(t); // coup de feu (js/tir.js) : 1 au départ du coup, puis retour
  const pelvis = p.bones.get('pelvis');
  pelvis.position.set(0, GENOU.bassin + 0.2 * souffle - 0.3 * r, -2);
  euler(pelvis, 0.05, -0.18, 0);
  euler(p.bones.get('spine'), 0.1 + 0.012 * souffle, 0.08, 0);
  euler(p.bones.get('chest'), 0.06 + 0.018 * souffle - 0.07 * r, 0.12, 0);
  p.root.updateMatrixWorld(true);
  // Jambe gauche : pied à plat devant, genou levé vers l'avant.
  leg(p, 'L', local(p, GENOU.piedG[0], ANKLE, GENOU.piedG[1]), local(p, 8, 40, 26), dirWorld(p.root, V(0.15, 0, 1)));
  // Jambe droite : genou posé au sol, tibia couché vers l'arrière, orteils repliés (pointe du pied au sol, talon en l'air).
  const [kx, kz] = GENOU.genouD;
  leg(p, 'R', local(p, ...GENOU.chevilleD), local(p, kx, -8, kz + 6), dirWorld(p.root, V(0, -1, -0.35)), dirWorld(p.root, V(0, 0.25, 1)));
  // Visée : la tête regarde le point visé, l'arme est tendue devant les yeux, sur l'axe de la visée.
  const vise = toWorld(stage, PLACEMENT.p1Vise).add(V(derive * 6 * K, bruit(t, 2, 1) * 4 * K, 0));
  const head = p.bones.get('head');
  const eye = worldPos(head).add(V(0, 4.5 * K, 0));
  const dir = vise.clone().sub(eye).normalize();
  // Ligne de mire à hauteur des yeux (le dessus de la glissière est 2,4 au-dessus de l'origine de l'arme) ; au coup de feu, l'arme
  // recule, remonte et se cabre, les bras suivent.
  const at = eye.clone().add(dir.clone().multiplyScalar((P1_ARME - 2.6 * r) * K)).add(V(0, (-3.2 + 0.35 * souffle + 1.2 * r) * K, 0));
  const aim = vise.clone().sub(at).normalize().add(V(0, 0.32 * r, 0));
  holdGun(p, at, aim, { elbowsOut: 5 });
  // Détails : au début de la boucle, il tourne la tête vers sa droite (notre gauche), comme pour regarder hors champ, puis revient à sa cible.
  // La tête mène, le cou suit avec un léger retard (0,08 s) ; un peu d'inclinaison pendant le coup d'œil.
  const rp1 = regardP1(t);
  const cou1 = regardP1(t, 0.08);
  look(p, rp1 !== 0 ? vise.clone().lerp(toWorld(stage, V(-420, 55, 110)), rp1) : vise, 0.4 + 0.25 * Math.max(0, cou1));
  if (rp1 !== 0) p.bones.get('head').rotateZ(0.08 * rp1);
  // Œil gauche : fermé seulement pour le tir (js/tir.js).
  const lid = p.bones.get('paupiereL');
  if (lid) lid.scale.set(1, Math.max(0.001, oeilFerme(t)), 1);
}

// --- Zombie : à plat ventre, bras gauche tendu vers l'avant, bras droit qui griffe le sol ; il se débat sous le pied -------------------
export function poseZombie(z, stage, t, appui) {
  const P = PLACEMENT.zombie;
  z.reset();
  placeRoot(z, stage, P.x, P.z, P.cap);
  const vie = vieZombie(t); // détails : 0 quand la balle du personnage 2 l'a mis au tapis
  const debat = bruit(t, 5, 2) * (0.15 + 0.85 * vie); // se débat (rythme irrégulier mais périodique) ; à peine quand il est inerte
  const pelvis = z.bones.get('pelvis');
  // Couché : le bassin bascule de 90° vers l'avant (le ventre au sol, la tête vers +z du personnage).
  pelvis.position.set(0, 7.6 - 0.6 * appui, 0);
  euler(pelvis, Math.PI / 2 - 0.04, 0.04 * debat, 0.05 * debat);
  euler(z.bones.get('spine'), 0.08 + 0.04 * debat, 0.06 * debat, 0);
  const att = attrapeAt(t); // bras tendu vers le spectateur (0 à 1)
  const mort = 1 - vie; // tête au sol
  const rebond = rebondZombie(t);
  // Quand il tend le bras, il soulève un peu le haut du corps et tourne l'épaule vers le spectateur.
  euler(z.bones.get('chest'), 0.0 + 0.03 * appui + 0.025 * onde(t, 4) - 0.18 * att, 0.08 * debat + 0.15 * att, 0.04 * debat - 0.14 * att);
  // La tête se relève vers l'avant, tournée vers la caméra, et secouée.
  // Touché (détails) : la tête retombe, joue contre le sol, et rebondit une fois.
  euler(z.bones.get('neck'), -0.85 + 0.05 * onde(t, 4, 0.2) * vie - 0.1 * att + MORT.cou * mort - 0.12 * rebond, 0.25 + 0.08 * debat - 0.15 * mort, 0.3 * mort);
  euler(z.bones.get('head'), -0.45 + 0.06 * onde(t, 8, 0.1) * vie + MORT.tete * mort, 0.2 + 0.1 * bruit(t, 9, 3) * vie + 0.35 * mort, 0.1 * debat + MORT.roulis * mort);
  // Au tapis : la joue reste posée au sol quels que soient les petits mouvements du corps (le soldat appuie plus ou moins) : le cou est
  // corrigé pour que le centre de la tête soit à 5,12 au-dessus du sol (le bas de la tête est 5,09 sous son centre). Deux corrections de
  // Newton, pondérées par « mort » (aucun effet quand il est vivant).
  if (mort > 0) {
    const neck = z.bones.get('neck');
    const centre = () => { z.root.updateMatrixWorld(true); return z.bones.get('head').localToWorld(V(0, 4.6, 0.2)).y; };
    for (let i = 0; i < 2; i += 1) {
      const y0 = centre();
      neck.rotateX(0.02);
      const pente = (centre() - y0) / 0.02;
      neck.rotateX(-0.02);
      if (Math.abs(pente) < 1e-6) break;
      neck.rotateX(Math.max(-0.4, Math.min(0.4, (-(y0 - 5.12 * K) / pente) * mort)));
    }
  }
  const yeux = z.bones.get('yeuxZ');
  if (yeux) yeux.scale.set(1, yeuxZombie(t), 1);
  z.root.updateMatrixWorld(true);
  // Jambes : allongées derrière, pointes de pied au sol, une jambe qui gigote.
  const kick = onde(t, 4, 0.3) * vie;
  // Pointes de pied posées au sol, talons en l'air : chevilles à la hauteur du pied (7,4), genoux à peine fléchis vers le sol.
  const lAnkle = local(z, 7.5, 7.4 + 2.5 * Math.max(0, kick), -21 + 1.5 * Math.max(0, kick));
  const rAnkle = local(z, -8, 7.4, -22);
  const toes = dirWorld(z.root, V(0, -1, -0.25));
  const shinUp = dirWorld(z.root, V(0, 0.15, 1));
  leg(z, 'L', lAnkle, local(z, 9, -6, -11), toes, shinUp);
  leg(z, 'R', rAnkle, local(z, -9, -6, -11), toes, shinUp);
  // Bras gauche tendu loin devant (main à plat qui tâtonne) ; bras droit qui griffe : la main racle le sol vers le corps (4 fois par boucle).
  const reach = onde(t, 2, 0.15) * vie;
  // Mains au-dessus du sol : poignet à 3,8, main à plat (doigts vers l'avant, paume vers le sol), coude relevé.
  // Par moment (attrapeAt), ce bras se lève et se tend vers le spectateur, doigts devant, comme pour l'attraper.
  const solMain = local(z, 11, 3.8, 36 + 1.5 * reach);
  const sh = worldPos(z.bones.get('shoulderL'));
  // Vers le spectateur (point de PLACEMENT.spectateur), ou, zombie tourné vers le personnage 1 (PLACEMENT.attrapeDevant), droit devant lui,
  // un peu en dehors et presque à l'horizontale (bras qui rampe vers lui, pas levé) : le bras ne passe pas devant son visage.
  const versSpect = PLACEMENT.attrapeDevant ? dirWorld(z.root, V(0.3, 0.02, 1)).normalize() : toWorld(stage, PLACEMENT.spectateur).sub(sh).normalize();
  const tendue = sh.clone().add(versSpect.clone().multiplyScalar(20.5 * K)); // bras presque tendu (22 au plus)
  const lisse = att * att * (3 - 2 * att);
  const mainL = solMain.clone().lerp(tendue, lisse);
  const coudeL = local(z, 20, 16, 26).lerp(sh.clone().add(versSpect.clone().multiplyScalar(10 * K)).add(V(0, 6 * K, 0)), lisse);
  const doigts = dirWorld(z.root, V(0.08, -0.06, 1)).lerp(versSpect, lisse).normalize();
  arm(z, 'L', mainL, coudeL, doigts, dirWorld(z.root, V(0, -1, 0)));
  // Bouche : fermée au repos, elle s'ouvre quand il tend le bras (et claque un peu des dents pendant qu'il le garde tendu).
  const bouche = z.bones.get('boucheZ');
  // Fermée au repos (retour du propriétaire) : écrasée à 12 % (un trait sombre) ; grande ouverte bras tendu.
  if (bouche) bouche.scale.set(1 + 0.15 * lisse, 0.12 + lisse * (1.88 + 0.15 * onde(t, 16)), 1);
  const g = cycle(t, 4);
  // Griffe : la main se lève et avance (25 % du cycle), se pose loin devant, puis racle le sol en revenant vers le corps (75 %).
  // Le coude reste toujours du même côté, en dehors et au-dessus du bras (point de pliage qui suit la main) : avant, fixe, il faisait
  // basculer le coude d'un côté à l'autre à chaque coup (retour du propriétaire : « le bras se désaxe »).
  const rake = g < 0.25 ? g / 0.25 : 1 - (g - 0.25) / 0.75;
  const lift = (g < 0.25 ? Math.sin(Math.PI * (g / 0.25)) * 3.5 : 0) * vie;
  const s = rake * rake * (3 - 2 * rake) * vie + 0.5 * (1 - vie); // inerte : la main reste posée
  // La main va de l'aplomb de l'épaule (z 23, l'épaule est à z ≈ 21) à 14 unités devant ; le coude reste à peu près à hauteur d'épaule,
  // sur le côté : avant (retour du propriétaire, « l'articulation de l'épaule est étrange »), la main reculait derrière l'épaule et le
  // coude montait au-dessus, comme quelqu'un qui pousse sur ses bras.
  const mainZ = 23 + 13 * s;
  arm(z, 'R', local(z, -17, 3.8 + lift, mainZ), local(z, -29, 9, mainZ - 5), dirWorld(z.root, V(-0.15, -0.12 - 0.25 * s, 1)), dirWorld(z.root, V(0, -1, 0)));
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
  const pied = dos.clone().add(dosUp.clone().multiplyScalar((ANKLE - 0.8) * K));
  leg(p, 'L', pied, local(p, 10, 34, 34), dirWorld(p.root, V(-0.1, 0, 1)), dosUp);
  // Jambe d'appui : pied droit au sol, en arrière.
  leg(p, 'R', local(p, -7, ANKLE, -7), local(p, -9, 14, 22), dirWorld(p.root, V(-0.3, 0, 1)));
  // Visée vers le bas : canon pointé sur la tête du zombie.
  const tete = worldPos(z.bones.get('head')).add(V(0, 3 * K, 0));
  const chest = p.bones.get('chest');
  const epaules = worldPos(chest).add(V(0, 8 * K, 0));
  const dir = tete.clone().sub(epaules).normalize();
  // Détails : il tire sur le zombie à TIR_P2 (recul de l'arme), et lève la tête vers le personnage 1 au début de la boucle.
  const r2 = DETAILS.actif ? recul(t, TIR_P2) : 0;
  const at = epaules.clone().add(dir.clone().multiplyScalar((P2_ARME + 0.5 * appui - 2.4 * r2) * K)).add(V(0, (0.3 * souffle + 1.6 * r2) * K, 0));
  const visee = tete.clone().sub(at).normalize().add(V(0, 0.35 * r2, 0));
  holdGun(p, at, visee, { elbowsOut: 7, up: V(0, 0, 1).transformDirection(p.root.matrixWorld) });
  const rp2 = regardP2(t);
  const cou2 = regardP2(t, 0.08);
  look(p, rp2 !== 0 ? tete.clone().lerp(worldPos(PLACEMENT.p1Tete ?? p.bones.get('head')), rp2) : tete, 0.5 + 0.3 * Math.max(0, cou2));
}
