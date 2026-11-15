// Coup de feu du personnage 1 dans la boucle (retours du lot 1) : un tir par boucle, à TIR secondes. Recul de l'arme (js/poses.js lit
// recul(t)), éclair au canon (couleur du jeu --game-muzzle), éclat de lumière, douille éjectée à droite, petite fumée qui monte.
// Tout est fonction du temps de la boucle (js/boucle.js) : l'effet est terminé bien avant la fin de la boucle.
import * as THREE from 'three';
import { DUREE } from './boucle.js';

export const TIR = 5.2; // instant du coup de feu (secondes de la boucle)
const RECUL = 0.42; // durée du recul (secondes)
const ECLAIR = 0.075; // durée de l'éclair : 2 images à 25 ou 30 images/s

// Œil gauche du tireur : fermé (1) un peu avant le coup et pendant le recul, ouvert (0) le reste de la boucle. Il se ferme en 0,12 s
// à 0,6 s du coup (il cale sa visée), se rouvre en 0,15 s une fois le recul et la fumée passés.
const FERME = { avant: 0.6, apres: 0.75, fermer: 0.12, ouvrir: 0.15 };
export function oeilFerme(t) {
  const d = ((((t - TIR + FERME.avant) % DUREE) + DUREE) % DUREE); // 0 au début de la fermeture
  const total = FERME.avant + FERME.apres;
  const lisse = (k) => k * k * (3 - 2 * k);
  if (d < FERME.fermer) return lisse(d / FERME.fermer);
  if (d < total) return 1;
  if (d < total + FERME.ouvrir) return 1 - lisse((d - total) / FERME.ouvrir);
  return 0;
}
// Temps écoulé depuis le coup de feu (0 à DUREE), périodique.
const depuis = (t) => ((((t - TIR) % DUREE) + DUREE) % DUREE);
// Recul de 0 à 1 : coup sec (0,03 s) puis retour adouci ; 0 hors du recul.
export function recul(t) {
  const d = depuis(t);
  if (d >= RECUL) return 0;
  if (d < 0.03) return d / 0.03;
  const k = 1 - (d - 0.03) / (RECUL - 0.03);
  return k * k * (3 - 2 * k);
}

// Texture d'éclat radial (générée, aucune image).
function eclat(rayons = 7) {
  const n = 128;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const dx = (x + 0.5) / n - 0.5;
      const dy = (y + 0.5) / n - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      const a = Math.atan2(dy, dx);
      const star = 0.55 + 0.45 * Math.abs(Math.cos(a * rayons * 0.5)) ** 6;
      const v = Math.max(0, 1 - r / star) ** 1.6;
      const i = (y * n + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * Math.min(1, v * 1.4));
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// Dégradé allongé pour la flamme du canon (le long de +y du plan).
function jet() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(32, 128);
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const u = (x + 0.5) / 32 - 0.5;
      const v = (y + 0.5) / 128;
      const w = 0.5 * (1 - v) ** 0.7;
      const a = Math.max(0, 1 - Math.abs(u) / Math.max(1e-3, w)) * (1 - v) ** 0.5;
      const i = (y * 32 + x) * 4;
      img.data.set([255, 255, 255, Math.round(255 * a)], i);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// palette : readPalette() ; laiton : couleur de la douille ; echelle : celle de la mise en scène (stage).
export function creerTir({ palette, laiton, echelle = 1 }) {
  const group = new THREE.Group();
  group.name = 'tir';
  const muzzle = new THREE.Color(palette.muzzle);
  const add = (map) => ({ map, color: muzzle, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const etoile = new THREE.Sprite(new THREE.SpriteMaterial(add(eclat())));
  const flamme = new THREE.Group();
  const jetTex = jet();
  for (let i = 0; i < 2; i += 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ ...add(jetTex), side: THREE.DoubleSide }));
    m.rotation.y = (i * Math.PI) / 2;
    flamme.add(m);
  }
  const lumiere = new THREE.PointLight(muzzle, 0, 500 * echelle, 1.4);
  const douille = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.5, 10).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: laiton }));
  douille.castShadow = true;
  // Fumée du canon : quelques bouffées (points du feu, mélange prémultiplié).
  const fumee = new THREE.Sprite(new THREE.SpriteMaterial({ map: eclat(0), color: new THREE.Color(palette.smokeLight), transparent: true, depthWrite: false, opacity: 0, fog: false }));
  group.add(etoile, flamme, lumiere, douille, fumee);
  const tip = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const upV = new THREE.Vector3();
  const side = new THREE.Vector3();
  const q = new THREE.Quaternion();
  return {
    group,
    // prop : os de l'arme du personnage 1 (après la pose) ; k : échelle du personnage (unités du monde par unité du personnage).
    update(t, prop, k = echelle) {
      const d = depuis(t);
      prop.updateMatrixWorld(true);
      prop.getWorldQuaternion(q);
      fwd.set(0, 0, 1).applyQuaternion(q);
      upV.set(0, 1, 0).applyQuaternion(q);
      side.set(-1, 0, 0).applyQuaternion(q); // droite du tireur : la douille part de ce côté
      tip.set(0, 0.6, 10.3).applyMatrix4(prop.matrixWorld);
      const on = d < ECLAIR;
      const f = on ? 1 - d / ECLAIR : 0;
      etoile.visible = on;
      flamme.visible = on;
      if (on) {
        etoile.position.copy(tip).addScaledVector(fwd, 2.5 * k);
        etoile.scale.setScalar((9 + 4 * f) * k);
        etoile.material.rotation = 0.6;
        flamme.position.copy(tip);
        flamme.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fwd);
        flamme.scale.set(6 * k, (9 + 4 * f) * k, 6 * k); // courte : longue, elle passait pour un trait de laser
      }
      lumiere.position.copy(tip).addScaledVector(fwd, 4 * k);
      lumiere.intensity = d < 0.12 ? 3200 * (1 - d / 0.12) ** 2 : 0;
      // Douille : éjectée vers la droite et vers le haut, retombe en 0,55 s, puis disparaît (au sol, hors de vue de la boucle).
      const vol = d - 0.02;
      douille.visible = vol > 0 && vol < 0.55;
      if (douille.visible) {
        douille.position.set(0, 0.8, -1.5).applyMatrix4(prop.matrixWorld);
        douille.position.addScaledVector(side, 38 * vol * k).addScaledVector(upV, (30 * vol - 60 * vol * vol) * k).addScaledVector(fwd, -6 * vol * k);
        douille.rotation.set(vol * 30, vol * 21, 0);
        douille.scale.setScalar(k);
      }
      // Fumée : une bouffée claire qui monte et s'étale pendant 1,4 s.
      const fu = d - 0.03;
      fumee.visible = fu > 0 && fu < 1.4;
      if (fumee.visible) {
        const u = fu / 1.4;
        fumee.position.copy(tip).addScaledVector(fwd, (3 + 6 * u) * k).add(new THREE.Vector3(0, 10 * u * k, 0));
        fumee.scale.setScalar((5 + 14 * u) * k);
        fumee.material.opacity = 0.32 * Math.min(1, u * 8) * (1 - u) ** 1.5;
      }
    },
  };
}
