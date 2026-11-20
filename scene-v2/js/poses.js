// Poses de la scène, construites à la main (aucune n'existe dans le jeu) : personnage 1 qui vise au loin, personnage 2 qui cloue le
// zombie au sol du pied et le vise vers le bas, zombie à plat ventre (un bras tendu, l'autre qui griffe le sol). Chaque pose est une
// fonction du temps t de la boucle (js/boucle.js) : respiration, armes qui bougent un peu, appui du pied, zombie qui se débat.
// Repère de mise en scène (groupe `stage`) : y vers le haut, +z vers la caméra, +x vers la droite de l'image ; unités du jeu (60 par mètre).
import * as THREE from 'three';
import { DUREE, bruit, cycle, onde } from './boucle.js';
import { V, euler, lookQuat, placeBone, pointBone, twoBone, worldPos } from './rig.js';
import { TIR_P2, manoeuvreAt, oeilFerme, recul } from './tir.js';

const UP = V(0, 1, 0);
// Échelle de la mise en scène par rapport au monde du jeu. Dans le jeu, un personnage mesure 60 unités (1 m à l'échelle de la carte : 60 unités
// par mètre) pour des murs de 180 (un étage de 3 m) : vu de face, il aurait l'air d'un enfant. La scène grandit personnages, lampes et
// distances de 1,6 (1,60 m) ; le repère `stage` porte cette échelle, les poses restent en unités des personnages.
export const ECHELLE_SCENE = 1.6;
const K = ECHELLE_SCENE;
const ANKLE = 3.5; // hauteur de la cheville au-dessus de la semelle (squelette v2 : 27 - 12 - 11,5)
// Les décalages appliqués dans le monde sont en unités des personnages, multipliées par K (échelle de la scène, plus bas).
const P2_ARME = 18; // distance des épaules au Colt du personnage 2 (bras presque tendus, vers le bas)

// Prises des armes du jeu (repère de l'arme, js/armes.js : +z la bouche, +y le dessus, +x la gauche du tireur) : position du POIGNET de chaque
// main, axe du poignet vers les doigts (dir) et côté de la paume (up). Réglées à l'œil autour des points de prise du jeu (data/armes/armes.json
// → prises : paume droite sur la poignée, paume gauche sous le fût). La main du jeu : une sphère (centre à 1,6 du poignet) et une boîte de doigts.
export const PRISES = {
  // Colt M1911 tenu à deux mains (personnage 2) : poing droit autour de la poignée, main gauche qui l'enveloppe par-dessous, sur le côté.
  m1911: {
    droite: { at: V(0, -0.75, -3.5), dir: V(0, -0.2, 1), up: V(0, -1, 0) },
    gauche: { at: V(2.1, -1.8, -3.1), dir: V(-0.3, -0.2, 0.93), up: V(-0.7, 0.7, 0) },
  },
  // Kar98k épaulé (personnage 1) : main droite au poignet de la crosse (doigts vers la détente), main gauche sous le garde-main, paume en haut.
  kar98k: {
    droite: { at: V(-2.5, 0.5, -4.0), dir: V(0, -0.5, 0.87), up: V(1, 0, 0) },
    gauche: { at: V(0.04, -2.7, 2.0), dir: V(0.1, 0, 1), up: V(0, 1, 0) },
  },
};
const mainDe = (arme, cote) => PRISES[arme?.id]?.[cote] ?? PRISES.m1911[cote];

// Mise en place (repère de la scène) ; réglages modifiables pour retoucher les poses.
export const PLACEMENT = {
  p1: { x: -30, z: 34, cap: -6 }, // personnage 1 : au premier plan à gauche ; cap en degrés (0 = face à la caméra, + = vers la droite de l'image)
  // Point visé par le personnage 1. v2 (Kar98k) : au loin, à GAUCHE de la caméra (v1, au pistolet : à droite, V(330, 64, 900)). Épaulé à droite et
  // visant à droite de la caméra basse du cadrage B, sa main droite et son bras cachaient son visage (et l'œil qu'il ferme pour tirer) ; visant
  // à gauche, la caméra voit son visage, le fusil passe derrière. Réglé par format dans js/cadrages.js (placement.p1Vise : la bouche et l'éclair
  // restent dans l'image) ; ?p1vise=330,64,900 : l'ancienne direction, pour comparer.
  p1Vise: V(-650, 0, 900),
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
// Détails : le personnage 1 regarde hors champ après son tir (5,8 à 7,65 s : son retour à la normale relance la boucle) ; le personnage 2
// tourne la tête vers lui pendant un moment calme (4,35 à 6,6 s : zombie inerte ; il regarde encore le personnage 1 quand celui-ci tire).
// v2 (retour du propriétaire) : le personnage 1 tourne la tête APRÈS avoir fini de manœuvrer le verrou, un court instant après
// (REGARD.apresVerrou) ; même coup d’œil que la v1 (aller 0,6 s, tenue 0,55 s, retour 0,7 s). Il déborde sur le début de la boucle suivante
// (fin vers 0,7 s) : la fonction est périodique, la boucle reste parfaite. debutP1 est calculé par js/scene.js (fin de la manœuvre du jeu).
export const REGARD = { apresVerrou: 0.25, debutP1: 5.8 };
const coupDoeilBoucle = (t, debut, aller, tenue, retour) => coupDoeil(debut + ((((t - debut) % DUREE) + DUREE) % DUREE), debut, aller, debut + aller + tenue, retour);
export const regardP1 = (t, retard = 0) => (DETAILS.actif ? coupDoeilBoucle(t - retard, REGARD.debutP1, 0.6, 0.55, 0.7) : 0);
export const regardP2 = (t, retard = 0) => (DETAILS.actif ? coupDoeil(t - retard, 4.35, 0.5, 6.0, 0.6) : 0);
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
// Arme de poing tenue à deux mains (Colt du personnage 2) : origine de l'arme (« prop ») à `at`, canon vers `dir` ; mains aux prises de
// l'arme (PRISES), coudes vers le bas et un peu en dehors (jamais dans le buste).
function holdGun(p, at, dir, { arme, elbowsOut = 5, up = UP } = {}) {
  const prop = p.bones.get('prop');
  const q = lookQuat(dir, up);
  placeBone(prop, at, q);
  prop.scale.setScalar(1);
  const tool = p.bones.get('tool');
  if (tool) tool.scale.setScalar(0.001); // marteau du jeu caché (comme playerArms)
  const toW = (v) => v.clone().applyQuaternion(q);
  const R = mainDe(arme, 'droite');
  const L = mainDe(arme, 'gauche');
  const gR = prop.localToWorld(R.at.clone());
  const gL = prop.localToWorld(L.at.clone());
  const chest = p.bones.get('chest');
  const right = V(-1, 0, 0).transformDirection(chest.matrixWorld);
  const down = V(0, -1, 0);
  // Coudes : en avant (vers l'arme), un peu bas et en dehors.
  const fw = dir.clone().normalize();
  const elbowR = worldPos(p.bones.get('shoulderR')).add(right.clone().multiplyScalar(elbowsOut)).add(down.clone().multiplyScalar(8)).add(fw.clone().multiplyScalar(10));
  const elbowL = worldPos(p.bones.get('shoulderL')).add(right.clone().multiplyScalar(-elbowsOut)).add(down.clone().multiplyScalar(8)).add(fw.clone().multiplyScalar(10));
  arm(p, 'R', gR, elbowR, toW(R.dir), toW(R.up));
  arm(p, 'L', gL, elbowL, toW(L.dir), toW(L.up));
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

// --- Personnage 1 : au premier plan, tir à genou au Kar98k (scène v2), vise au loin à côté de la caméra -----------------------------
// Jambes comme en v1 : genou droit au sol, orteils repliés derrière ; pied gauche à plat devant, genou levé. Buste un peu de biais (comme la
// pose de tenue du jeu : torse tourné de 15°), crosse au creux de l'épaule, joue posée sur la crosse (tête penchée vers la crosse, œil sur la
// ligne de mire), main de tir au poignet de la crosse, autre main sous le garde-main. L'autre œil se ferme pour le tir seulement (js/tir.js).
// Au tir (5,2 s) : recul dans l'épaule, canon qui se relève ; puis la main droite manœuvre le verrou (levier relevé, culasse tirée : la douille
// sort, repoussée, levier rabattu) et revient à sa place (js/tir.js).
// GAUCHER (par défaut, retour du propriétaire) : il vise à DROITE de notre écran, comme le pistolet de la v1 ; crosse à l'épaule gauche, œil
// droit fermé ; vue de la caméra basse du cadrage B, son visage reste devant le fusil. Le verrou du Kar98k est à droite : c'est la main droite
// (sous le garde-main) qui le manœuvre. ?tireur=droitier : épaule droite, visée à gauche de l'écran (première version du lot 5a).
export const TIREUR = { gaucher: true };
const GENOU = { bassin: 16.4, genouD: [-6.2, -5], chevilleD: [-6.4, 7.7, -15.6], piedG: [6.5, 13.5] };
export const FUSIL = {
  lacet: 0.3, // le fusil vise 17° à gauche de l'avant du buste (buste de biais)
  cou: 0.38, // cou penché vers l'avant (tête avancée au-dessus de la crosse)
  tete: 0.18, // tête baissée par rapport à la ligne de mire (il regarde par en dessous des sourcils)
  joue: 0.36, // tête penchée vers la droite : la joue sur la crosse
  oeil: V(0, 2.4, -4.2), // point de l'arme où se place l'œil droit : sur la ligne de mire, en arrière de la hausse
  cant: 0.04, // fusil à peine incliné vers la droite
  epaule: V(-5.2, 11.5, 6.0), // creux de l'épaule droite (repère de l'os chest) : la plaque de couche y est ramenée le long du canon
  haussement: 1.8, // épaule droite relevée (coude levé, comme un tireur au fusil)
};
const OEIL_D = V(-1.65, 5.15, 4.35); // œil droit dans le repère de la tête (js/enrichissements.js)

// Le buste tourne autour de l'axe vertical pour que son avant soit à `cap` (radians, angle du monde) : rotation appliquée à l'os chest.
function tournerBuste(p, cap) {
  const chest = p.bones.get('chest');
  chest.updateMatrixWorld(true);
  const f = V(0, 0, 1).transformDirection(chest.matrixWorld);
  const d = cap - Math.atan2(f.x, f.z);
  const qw = chest.getWorldQuaternion(new THREE.Quaternion());
  const qp = chest.parent.getWorldQuaternion(new THREE.Quaternion());
  chest.quaternion.copy(qp.invert().multiply(new THREE.Quaternion().setFromAxisAngle(UP, d).multiply(qw)));
  chest.updateMatrixWorld(true);
}

export function poseP1(p, stage, t, arme = null) {
  const P = PLACEMENT.p1;
  const g = TIREUR.gaucher ? -1 : 1; // miroir gauche / droite (repères du personnage et de l'arme : +x vers sa gauche)
  const mx = (v) => V(g * v.x, v.y, v.z);
  const OEIL = mx(OEIL_D); // œil qui vise : le droit (droitier) ou le gauche (gaucher)
  p.reset();
  placeRoot(p, stage, P.x, P.z, P.cap);
  const kp = p.root.scale.x; // unités du monde par unité du personnage
  const souffle = onde(t, 2); // respiration : 2 cycles par boucle (4 s)
  const derive = bruit(t, 1, 1); // la visée dérive un peu
  const r = recul(t); // coup de feu (js/tir.js) : 1 au départ du coup, puis retour
  const pelvis = p.bones.get('pelvis');
  pelvis.position.set(0, GENOU.bassin + 0.2 * souffle - 0.3 * r, -2);
  euler(pelvis, 0.05, -0.18, 0);
  euler(p.bones.get('spine'), 0.1 + 0.012 * souffle, 0.08, 0);
  euler(p.bones.get('chest'), 0.1 + 0.018 * souffle, 0.12, -0.04);
  p.root.updateMatrixWorld(true);
  // Jambe gauche : pied à plat devant, genou levé vers l'avant.
  leg(p, 'L', local(p, GENOU.piedG[0], ANKLE, GENOU.piedG[1]), local(p, 8, 40, 26), dirWorld(p.root, V(0.15, 0, 1)));
  // Jambe droite : genou posé au sol, tibia couché vers l'arrière, orteils repliés (pointe du pied au sol, talon en l'air).
  const [kx, kz] = GENOU.genouD;
  leg(p, 'R', local(p, ...GENOU.chevilleD), local(p, kx, -8, kz + 6), dirWorld(p.root, V(0, -1, -0.35)), dirWorld(p.root, V(0, 0.25, 1)));
  const vise = toWorld(stage, PLACEMENT.p1Vise).add(V(derive * 6 * K, bruit(t, 2, 1) * 4 * K, 0));
  if (!arme) return;
  // Buste de biais : son avant à 17° de la visée, du côté de l'épaule de tir ; au tir, il part un peu en arrière (le recul passe par l'épaule).
  const chest = p.bones.get('chest');
  const v0 = vise.clone().sub(worldPos(chest));
  tournerBuste(p, Math.atan2(v0.x, v0.z) - g * FUSIL.lacet);
  chest.rotateX(-0.06 * r);
  chest.updateMatrixWorld(true);
  // Tête : cou penché vers l'avant, tête dans l'axe de la visée, penchée vers la crosse (joue sur la crosse).
  const neck = p.bones.get('neck');
  const head = p.bones.get('head');
  p.bones.get(g > 0 ? 'shoulderR' : 'shoulderL').position.y += FUSIL.haussement;
  euler(neck, FUSIL.cou, g * 0.5 * FUSIL.lacet, -g * 0.2);
  neck.updateMatrixWorld(true);
  let f = vise.clone().sub(head.localToWorld(OEIL.clone())).normalize();
  const poserTete = () => {
    const cote = f.clone().cross(UP).normalize(); // droite de la visée
    const avant = f.clone().applyAxisAngle(cote, -FUSIL.tete); // tête un peu baissée
    pointBone(head, V(0, 0, 1), avant, V(0, 1, 0), UP.clone().applyAxisAngle(avant, g * FUSIL.joue)); // g > 0 : le haut de la tête part vers sa droite
  };
  for (let i = 0; i < 2; i += 1) {
    poserTete();
    f = vise.clone().sub(head.localToWorld(OEIL.clone())).normalize();
  }
  poserTete();
  const qTeteVisee = head.quaternion.clone();
  const qCouVisee = neck.quaternion.clone();
  // Fusil : ligne de mire qui passe par l'œil droit, vers le point visé ; puis glissé le long du canon pour que la plaque de couche arrive
  // au creux de l'épaule (le recul le repousse un peu en arrière et relève le canon, autour de la crosse).
  const oeil = head.localToWorld(OEIL.clone());
  const Q = lookQuat(f, UP.clone().applyAxisAngle(f, g * FUSIL.cant));
  const O = oeil.clone().sub(FUSIL.oeil.clone().multiplyScalar(kp).applyQuaternion(Q));
  const crosse = arme.prises.crosse.clone().multiplyScalar(kp);
  const B = O.clone().add(crosse.clone().applyQuaternion(Q));
  const creux = chest.localToWorld(mx(FUSIL.epaule));
  const glisse = Math.max(-6 * kp, Math.min(6 * kp, creux.clone().sub(B).dot(f)));
  O.addScaledVector(f, glisse - 0.9 * r * kp);
  if (r > 0) {
    const butt = O.clone().add(crosse.clone().applyQuaternion(Q));
    const axe = V(1, 0, 0).applyQuaternion(Q);
    const qr = new THREE.Quaternion().setFromAxisAngle(axe, -0.16 * r);
    O.sub(butt).applyQuaternion(qr).add(butt);
    Q.premultiply(qr);
  }
  const prop = p.bones.get('prop');
  placeBone(prop, O, Q);
  prop.scale.setScalar(1);
  const tool = p.bones.get('tool');
  if (tool) tool.scale.setScalar(0.001);
  // Mains : main de tir au poignet de la crosse, l'autre sous le garde-main (prises du droitier, en miroir pour le gaucher) ; pendant la
  // manœuvre, la main droite va au levier du verrou (à droite de l'arme).
  const toW = (v) => v.clone().applyQuaternion(Q);
  const miroir = (h) => ({ at: mx(h.at), dir: mx(h.dir), up: mx(h.up) });
  const tir = miroir(mainDe(arme, 'droite'));
  const appui = miroir(mainDe(arme, 'gauche'));
  const R = g > 0 ? tir : appui;
  const L = g > 0 ? appui : tir;
  const m = manoeuvreAt(t, arme);
  arme.verrou?.poser(m.lift, m.back);
  let wR = prop.localToWorld(R.at.clone());
  let dirR = toW(R.dir);
  let upR = toW(R.up);
  if (arme.verrou && m.main > 0) {
    // La main droite va saisir la boule du levier (paume dessous, doigts autour) et la suit.
    const boule = arme.verrou.boule(m.lift, m.back);
    const wB = prop.localToWorld(boule.clone().add(V(-0.9, -2.1, -1.0)));
    const lisse = m.main * m.main * (3 - 2 * m.main);
    wR = wR.lerp(wB, lisse);
    dirR = dirR.lerp(toW(V(0.35, 0.55, 0.75)), lisse).normalize();
    upR = upR.lerp(toW(V(0.5, 0.2, -0.3)), lisse).normalize();
  }
  const right = V(-1, 0, 0).transformDirection(chest.matrixWorld);
  const cote = right.clone().multiplyScalar(g); // côté de l'épaule de tir
  // Coude de tir écarté mais pas levé (il ne passe pas devant le visage, vu de la caméra basse du cadrage B) ; coude d'appui sous le fusil.
  const epTir = worldPos(p.bones.get(g > 0 ? 'shoulderR' : 'shoulderL'));
  const epAppui = worldPos(p.bones.get(g > 0 ? 'shoulderL' : 'shoulderR'));
  const coudeTir = epTir.addScaledVector(cote, 7 * kp).add(V(0, -9 * kp, 0)).addScaledVector(f, -1 * kp);
  const coudeAppui = epAppui.add(V(0, -14 * kp, 0)).addScaledVector(f, 6 * kp).addScaledVector(cote, -2 * kp);
  const coudeR = g > 0 ? coudeTir : coudeAppui;
  const coudeL = g > 0 ? coudeAppui : coudeTir;
  if (m.main > 0 && g < 0) coudeR.add(V(0, -3 * kp, 0)).addScaledVector(f, -4 * kp); // gaucher : le bras d'appui recule vers le levier
  arm(p, 'R', wR, coudeR, dirR, upR);
  arm(p, 'L', prop.localToWorld(L.at.clone()), coudeL, toW(L.dir), toW(L.up));
  // Détails : après son tir, il tourne la tête vers sa droite (notre gauche), comme pour regarder hors champ, puis revient à la visée
  // (la joue quitte la crosse pendant ce coup d'œil). La tête mène, le cou suit avec un léger retard (0,08 s).
  const rp1 = regardP1(t);
  if (rp1 > 0) {
    const cou1 = regardP1(t, 0.08);
    look(p, vise.clone().lerp(toWorld(stage, V(-420, 55, 110)), rp1), 0.4 + 0.25 * Math.max(0, cou1));
    head.rotateZ(0.08 * rp1);
    neck.quaternion.slerpQuaternions(qCouVisee, neck.quaternion.clone(), Math.min(1, cou1 * 1.2));
    head.quaternion.slerpQuaternions(qTeteVisee, head.quaternion.clone(), Math.min(1, rp1 * 1.2));
    head.updateMatrixWorld(true);
  }
  // L'œil qui ne vise pas (le gauche du droitier, le droit du gaucher) : fermé seulement pour le tir (js/tir.js) ; l'autre paupière reste
  // rentrée sous l'arcade.
  const ferme = p.bones.get(g > 0 ? 'paupiereL' : 'paupiereR');
  const ouverte = p.bones.get(g > 0 ? 'paupiereR' : 'paupiereL');
  if (ferme) ferme.scale.set(1, Math.max(0.001, oeilFerme(t)), 1);
  if (ouverte) ouverte.scale.set(1, 0.001, 1);
  // Atelier : écart entre la plaque de couche et le creux de l'épaule (unités du personnage).
  ATELIER.crosse = chest.worldToLocal(O.clone().add(crosse.clone().applyQuaternion(Q))).sub(mx(FUSIL.epaule));
  ATELIER.glisse = glisse / kp;
}
export const ATELIER = { crosse: null };

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
export function poseP2(p, z, stage, t, appui, arme = null) {
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
  holdGun(p, at, visee, { arme, elbowsOut: 7, up: V(0, 0, 1).transformDirection(p.root.matrixWorld) });
  const rp2 = regardP2(t);
  const cou2 = regardP2(t, 0.08);
  look(p, rp2 !== 0 ? tete.clone().lerp(worldPos(PLACEMENT.p1Tete ?? p.bones.get('head')), rp2) : tete, 0.5 + 0.3 * Math.max(0, cou2));
}
