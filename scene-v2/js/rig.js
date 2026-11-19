// Outils de pose à la main pour les personnages « os rigides » du jeu : orienter un os vers une direction du monde,
// cinématique inverse à deux os (bras, jambes), passage d'une position du monde au repère d'un os parent.
// Les os du jeu sont des THREE.Bone : on écrit leur quaternion (l'ordre d'Euler 'YXZ' du jeu ne sert qu'aux angles saisis).
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const worldPos = (o, out = new THREE.Vector3()) => o.getWorldPosition(out);

// Base orthonormée (x, y, z en colonnes) dont l'axe `dir` (normé) est donné et dont un second axe s'aligne au mieux sur `hint`.
function frame(dir, hint) {
  const f = dir.clone().normalize();
  const u = hint.clone().sub(_c.copy(f).multiplyScalar(hint.dot(f)));
  if (u.lengthSq() < 1e-8) u.set(Math.abs(f.y) < 0.9 ? 0 : 1, Math.abs(f.y) < 0.9 ? 1 : 0, 0).sub(_c.copy(f).multiplyScalar(Math.abs(f.y) < 0.9 ? f.y : f.x));
  u.normalize();
  const s = new THREE.Vector3().crossVectors(f, u);
  return [f, u, s];
}

// Oriente un os : sa direction locale `localDir` (repère de l'os au repos, celui du parent) va sur `worldDir`, et son axe local
// `localUp` va au plus près de `worldUp`. Le quaternion local est écrit (le parent doit être à jour : updateMatrixWorld).
export function pointBone(bone, localDir, worldDir, localUp, worldUp) {
  const [lf, lu, ls] = frame(localDir, localUp);
  const [wf, wu, ws] = frame(worldDir, worldUp);
  const L = new THREE.Matrix4().makeBasis(lf, lu, ls);
  const W = new THREE.Matrix4().makeBasis(wf, wu, ws);
  const qWorld = new THREE.Quaternion().setFromRotationMatrix(W.multiply(L.transpose()));
  bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(qWorld));
  bone.updateMatrixWorld(true);
}

// Cinématique inverse à deux os : upper (épaule / hanche), lower (coude / genou), endLocal = position de l'extrémité (poignet /
// cheville) dans le repère de lower. target : position voulue de l'extrémité (monde) ; pole : point vers lequel plie l'articulation
// du milieu (coude / genou). bendLocal : axe local de lower vers lequel l'extrémité se replie (genou : -z, le tibia part en arrière ;
// coude : +z, l'avant-bras vient devant). Renvoie la distance qui manque si la cible est hors d'atteinte (0 sinon).
export function twoBone(upper, lower, endLocal, target, pole, { bendLocal = V(0, 0, 1) } = {}) {
  upper.parent.updateMatrixWorld(true);
  const S = worldPos(upper, new THREE.Vector3());
  // Longueurs des os dans le monde : le personnage peut être mis à l'échelle (la scène le grandit de 1,6).
  const k = upper.getWorldScale(new THREE.Vector3()).x;
  const a = lower.position.length() * k;
  const b = endLocal.length() * k;
  const toT = target.clone().sub(S);
  const dist = toT.length();
  const d = Math.min(Math.max(dist, Math.abs(a - b) + 1e-3), a + b - 1e-3);
  const dir = toT.clone().normalize();
  const perp = pole.clone().sub(S);
  perp.sub(_a.copy(dir).multiplyScalar(perp.dot(dir)));
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1);
  perp.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const E = S.clone().add(_b.copy(dir).multiplyScalar(a * cosA)).add(_c.copy(perp).multiplyScalar(a * sinA));
  const T = S.clone().add(dir.clone().multiplyScalar(d));
  // Le plan de pliage contient S, E, T : l'axe de repli de lower (bendLocal) doit pointer de E vers le côté de T opposé au coude.
  const upDir = lower.position.clone().normalize();
  const endDir = endLocal.clone().normalize();
  const segU = E.clone().sub(S);
  const segL = T.clone().sub(E);
  const away = perp.clone().negate(); // côté opposé au coude, dans le plan
  // upper : lower.position (local) -> S→E ; l'axe de repli vers `away` projeté.
  pointBone(upper, upDir, segU, bendLocal, away);
  pointBone(lower, endDir, segL, bendLocal, away);
  return Math.max(0, dist - (a + b));
}

// Place un os enfant (par exemple l'arme, « prop ») à une position et une orientation du monde : position et quaternion locaux
// calculés dans le repère du parent. quatWorld : orientation voulue (monde).
export function placeBone(bone, posWorld, quatWorld) {
  bone.parent.updateMatrixWorld(true);
  _m.copy(bone.parent.matrixWorld).invert();
  bone.position.copy(posWorld).applyMatrix4(_m);
  bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(quatWorld));
  bone.updateMatrixWorld(true);
}

// Orientation (monde) d'un objet dont l'axe +z regarde `dir` et dont +y va au plus près de `up`.
export function lookQuat(dir, up = V(0, 1, 0)) {
  const [f, u, s] = frame(dir, up);
  // colonnes : x = u × f (gauche/droite), y = u, z = f
  const x = new THREE.Vector3().crossVectors(u, f);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, u, f));
}

// Angles d'Euler (ordre 'YXZ' du jeu) écrits sur un os.
export function euler(bone, x = 0, y = 0, z = 0) {
  bone.quaternion.setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
}

export { _q as tmpQuat, _v as tmpVec };
