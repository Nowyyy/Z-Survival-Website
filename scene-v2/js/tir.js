// Coups de feu de la scène v2 (lot 5a ; retours du lot 1 pour la v1) : personnage 1 au Kar98k à TIR (5,2 s), personnage 2 au Colt à TIR_P2.
// Mêmes instants que la v1 (js/accueil-boucle.js) : le site (flash du cadre, coup de feu) n'a rien à changer. Kar98k : la douille sort quand
// la culasse est tirée en arrière (manœuvre du verrou après le tir, clés du jeu), pas au coup de feu ; Colt : au coup de feu.
// (v1) Coup de feu du personnage 1 dans la boucle (retours du lot 1) : un tir par boucle, à TIR secondes. Recul de l'arme (js/poses.js lit
// recul(t)), éclair au canon (couleur du jeu --game-muzzle), éclat de lumière, douille éjectée à droite, petite fumée qui monte.
// Tout est fonction du temps de la boucle (js/boucle.js) : l'effet est terminé bien avant la fin de la boucle.
import * as THREE from 'three';
import { DUREE } from './boucle.js';
import { TEMPS_TIR, TEMPS_TIR_P2 } from '../../js/accueil-boucle.js';

export const TIR = TEMPS_TIR; // instant du coup de feu (5,2 s de la boucle) ; valeur partagée avec la vidéo et le site (js/accueil-boucle.js, lot 2b)
const RECUL = 0.42; // durée du recul (secondes)
const ECLAIR = 0.075; // durée de l'éclair : 2 images à 25 ou 30 images/s

// Œil gauche du tireur : fermé (1) autour du coup, ouvert (0) le reste de la boucle. Il commence à se fermer 0,4 s avant le coup (en 0,1 s)
// et commence à se rouvrir 0,4 s après le coup (en 0,15 s) : réglages du propriétaire (retours du lot 1).
const FERME = { avant: 0.4, apres: 0.4, fermer: 0.1, ouvrir: 0.15 };
export function oeilFerme(t) {
  const d = ((((t - TIR + FERME.avant) % DUREE) + DUREE) % DUREE); // 0 au début de la fermeture
  const total = FERME.avant + FERME.apres;
  const lisse = (k) => k * k * (3 - 2 * k);
  if (d < FERME.fermer) return lisse(d / FERME.fermer);
  if (d < total) return 1;
  if (d < total + FERME.ouvrir) return 1 - lisse((d - total) / FERME.ouvrir);
  return 0;
}
// Prévisualisation des détails (?details=1, retours du propriétaire) : le personnage 2 tire sur le zombie quand il tend le bras.
export const TIR_P2 = TEMPS_TIR_P2; // 2,6 s, valeur partagée (js/accueil-boucle.js)
// Temps écoulé depuis le coup de feu (0 à DUREE), périodique ; instant : celui du tir (personnage 1 par défaut).
const depuis = (t, instant = TIR) => ((((t - instant) % DUREE) + DUREE) % DUREE);
// Recul de 0 à 1 : coup sec (0,03 s) puis retour adouci ; 0 hors du recul.
export function recul(t, instant = TIR) {
  const d = depuis(t, instant);
  if (d >= RECUL) return 0;
  if (d < 0.03) return d / 0.03;
  const k = 1 - (d - 0.03) / (RECUL - 0.03);
  return k * k * (3 - 2 * k);
}

// Manœuvre du verrou du Kar98k après le tir (scène v2) : clés du jeu (data/game/armes-partie.json → kar98k.manoeuvre : gestes de la main
// [secondes, cible] et verrou [secondes, levier relevé, culasse tirée]), jouées un peu plus lentement que dans la partie (LENT) pour se lire
// dans la vidéo ; la clé 0 (main sur le levier) tombe à TIR + DEPART, une fois le recul fini. Renvoie { main (0 : main sur la crosse, 1 : main
// sur le levier), lift, back } ; hors de la manœuvre : { 0, 0, 0 }. Fini vers 6,6 s, bien avant la fin de la boucle.
export const MANOEUVRE = { depart: 0.62, lent: 1.3 };
const lisseK = (k) => k * k * (3 - 2 * k);
function entreCles(cles, s, i) {
  if (!cles.length) return 0;
  if (s <= cles[0][0]) return cles[0][i];
  for (let j = 1; j < cles.length; j += 1) {
    if (s <= cles[j][0]) {
      const [a, b] = [cles[j - 1], cles[j]];
      return a[i] + (b[i] - a[i]) * lisseK((s - a[0]) / Math.max(1e-6, b[0] - a[0]));
    }
  }
  return cles[cles.length - 1][i];
}
export function manoeuvreAt(t, arme) {
  const def = arme?.manoeuvre;
  if (!def?.cles?.length || !arme.verrou) return { main: 0, lift: 0, back: 0 };
  const s = (depuis(t) - MANOEUVRE.depart) / MANOEUVRE.lent; // secondes du jeu depuis la clé 0
  const mains = def.cles.map(([c, cible]) => [c, cible === 'prise' ? 0 : 1]);
  const verrou = def.verrou ?? [];
  return { main: entreCles(mains, s, 1), lift: entreCles(verrou, s, 1), back: entreCles(verrou, s, 2) };
}
// Fin de la manœuvre du verrou (secondes depuis le tir) : la main droite est revenue à sa place (dernière clé du jeu).
export function finManoeuvre(arme) {
  const c = arme?.manoeuvre?.cles ?? [];
  return c.length ? MANOEUVRE.depart + c[c.length - 1][0] * MANOEUVRE.lent : 0;
}
// Glissière du Colt (pistolet semi-automatique) : au coup de feu elle recule d'un coup (0,05 s), reste un instant en arrière (la douille sort),
// puis revient en avant (0,08 s) en chargeant la cartouche suivante. Un peu plus lent qu'en vrai (quelques centièmes de seconde) pour se voir
// à 30 images par seconde. 0 : en place, 1 : tout en arrière.
export const GLISSIERE = { recul: 0.05, tenue: 0.03, retour: 0.08 };
export function glissiereAt(t, instant = TIR) {
  const d = depuis(t, instant);
  const { recul: a, tenue: b, retour: c } = GLISSIERE;
  if (d < a) return lisseK(d / a);
  if (d < a + b) return 1;
  if (d < a + b + c) return 1 - lisseK((d - a - b) / c);
  return 0;
}

// Instant (secondes depuis le tir) où la culasse arrive en arrière : la douille sort.
export function ejectionKar(arme) {
  const v = arme?.manoeuvre?.verrou ?? [];
  const k = v.find((c) => c[2] >= 1);
  return k ? MANOEUVRE.depart + k[0] * MANOEUVRE.lent : 0.02;
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
// arme (scène v2, js/armes.js) : bout du canon (pointe), douille (dimensions du jeu), instant de l'éjection (secondes depuis le tir), et
// fenêtre d'éjection (repère de l'arme) ; force : taille de l'éclair (1 : celle de la v1).
// Douille (retour du propriétaire) : elle vole jusqu'à SORTIR DE L'IMAGE (jamais de disparition en l'air) : vitesse d'éjection vers le côté de
// l'arme et vers le bord de l'image de ce côté, vers le haut, puis pesanteur ; cachée dès qu'elle est hors du champ de la caméra, ou au plus tard
// VOL_MAX après l'éjection (et toujours avant la fin de la boucle : la boucle reste parfaite). Vitesses en unités du personnage par seconde.
const DOUILLE = { cote: 150, haut: 125, arriere: 25, pesanteur: 320, volMax: 1.8 };
export function creerTir({ palette, laiton, echelle = 1, instant = TIR, lumiereMax = 3200, arme = null, ejection = 0.02, fenetre = null, force = 1, camera = null, vol: volDouille = {} }) {
  const J = { ...DOUILLE, ...volDouille }; // vitesses de la douille propres à l'arme
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
  // Douille : proportions du jeu (data/game/armes-partie.json → douille : largeur, hauteur, longueur), à une taille lisible de près (au moins
  // 2,1 de long : celle du Colt, à l'échelle, se perdait), couchée en travers de l'arme ; laiton qui accroche un peu la lumière (lisible la nuit).
  const [dl, , dL] = arme?.douille ?? [0.9, 0.9, 1.5];
  const longueur = Math.max(2.1, 0.66 * dL);
  const rayon = Math.max(0.5, (0.5 * longueur * dl) / dL);
  const douille = new THREE.Mesh(new THREE.CylinderGeometry(rayon, rayon, longueur, 10).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: laiton, emissive: laiton.clone().multiplyScalar(0.35) }));
  douille.castShadow = true;
  // Fumée du canon : quelques bouffées (points du feu, mélange prémultiplié).
  const fumee = new THREE.Sprite(new THREE.SpriteMaterial({ map: eclat(0), color: new THREE.Color(palette.smokeLight), transparent: true, depthWrite: false, opacity: 0, fog: false }));
  group.add(etoile, flamme, lumiere, douille, fumee);
  const tip = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const upV = new THREE.Vector3();
  const side = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const depart = new THREE.Vector3();
  const vitesse = new THREE.Vector3();
  const droiteCam = new THREE.Vector3();
  const champ = new THREE.Frustum();
  const pm = new THREE.Matrix4();
  // Durée de vol permise : jamais au-delà de la fin de la boucle (la douille n'est plus là au retour à 0 s).
  const volMax = Math.min(J.volMax, DUREE - ((instant + ejection) % DUREE) - 0.05);
  return {
    group,
    // prop : os de l'arme du personnage 1 (après la pose) ; k : échelle du personnage (unités du monde par unité du personnage).
    update(t, prop, k = echelle) {
      const d = depuis(t, instant);
      prop.updateMatrixWorld(true);
      prop.getWorldQuaternion(q);
      fwd.set(0, 0, 1).applyQuaternion(q);
      upV.set(0, 1, 0).applyQuaternion(q);
      side.set(-1, 0, 0).applyQuaternion(q); // droite du tireur : la douille part de ce côté
      tip.copy(arme?.pointe ?? new THREE.Vector3(0, 0.6, 10.3)).applyMatrix4(prop.matrixWorld);
      const on = d < ECLAIR;
      const f = on ? 1 - d / ECLAIR : 0;
      etoile.visible = on;
      flamme.visible = on;
      if (on) {
        etoile.position.copy(tip).addScaledVector(fwd, 2.5 * k);
        etoile.scale.setScalar((9 + 4 * f) * k * force);
        etoile.material.rotation = 0.6;
        flamme.position.copy(tip);
        flamme.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fwd);
        flamme.scale.set(6 * k * force, (9 + 4 * f) * k * force, 6 * k * force); // courte : longue, elle passait pour un trait de laser
      }
      lumiere.position.copy(tip).addScaledVector(fwd, 4 * k);
      lumiere.intensity = d < 0.12 ? lumiereMax * (1 - d / 0.12) ** 2 : 0;
      // Douille : éjectée de la fenêtre de l'arme, vers le côté droit de l'arme et le bord de l'image de ce côté, vers le haut ; elle retombe
      // (pesanteur) et vole jusqu'à sortir de l'image.
      const vol = d - ejection;
      const cam = typeof camera === 'function' ? camera() : camera; // caméra de l'image (champ de vue)
      douille.visible = vol > 0 && vol < volMax;
      if (douille.visible) {
        depart.copy(fenetre ?? new THREE.Vector3(0, 0.8, -1.5)).applyMatrix4(prop.matrixWorld);
        vitesse.copy(side);
        if (cam) {
          droiteCam.set(1, 0, 0).applyQuaternion(cam.quaternion);
          // J.ecran (facultatif) : bord de l'image imposé (1 : droite, −1 : gauche) ; sinon celui du côté de la fenêtre d'éjection.
          const bord = J.ecran ?? (side.dot(droiteCam) >= 0 ? 1 : -1);
          if (J.ecran) vitesse.multiplyScalar(0.25);
          vitesse.addScaledVector(droiteCam, 1.1 * bord).setY(0).normalize();
        }
        douille.position.copy(depart).addScaledVector(vitesse, J.cote * vol * k).addScaledVector(fwd, -J.arriere * vol * k);
        douille.position.y += (J.haut * vol - 0.5 * J.pesanteur * vol * vol) * k;
        douille.rotation.set(vol * 30, vol * 21, 0);
        douille.scale.setScalar(k);
        if (cam) {
          cam.updateMatrixWorld();
          champ.setFromProjectionMatrix(pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
          douille.visible = champ.containsPoint(douille.position) || vol < 0.05;
        }
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
