// Avion écrasé de la scène v2 (décor d'époque du jeu, lot 9h du jeu : un P-51 remplace l'hélicoptère). Même principe que l'hélicoptère de la scène
// (js/helico.js) : le modèle du jeu (copie figée, js/core/decor-epoque.js : objet('avion'), atlas d'époque généré en code, teintes dérivées des
// jetons), le cratère et la traînée du jeu (js/core/epaves.js), mais AGRANDI et DÉCALÉ (enrichissement de la scène) pour se lire derrière les
// personnages, à la place de l'hélicoptère, et en flammes (feu en boucle de la scène, js/feu.js). Dans la partie, l'avion fume sans brûler.
import * as THREE from 'three';
import { MATIERES, atlasEpoque, couleursEpoque, objet, specCratere } from '../jeu/js/core/decor-epoque.js';
import { craterTriangles, trailTriangles } from '../jeu/js/core/epaves.js';
import { environnementNuit } from './helico.js';

// Échelle (le jeu : 1 ; l'avion du jeu est à 28 unités par mètre, les personnages de la scène sont grandis de 1,6) et décalage de son centre
// (unités du jeu, même décalage que l'hélicoptère de la scène : il ne traverse pas les murs de l'angle du L).
export const AVION = { k: 2.2, decalage: [150, -125], tangage: 11, roulis: 0, lacet: 0 };
// Pose d'avion écrasé (enrichissement de la scène ; dans le jeu, vu de dessus, l'avion est posé à plat) : nez planté dans le sol (tangage, en
// degrés, autour du nez ; roulis possible, 0 : aile relevée, elle se lisait comme une planche qui flotte) ; l’aile arrachée (aile-g) reste au sol. Sinon, vu de
// face et au ras du sol, l'avion n'était qu'un long bloc bas derrière les personnages.
const DEG = Math.PI / 180;
function poseEcrase(p, part) {
  if (part === 'aile-g') return p;
  const t = AVION.tangage * DEG;
  const r = AVION.roulis * DEG;
  // Roulis autour de l'axe du fuselage (x), aile droite (z > 0) vers le haut.
  let [x, y, z] = p;
  [y, z] = [y * Math.cos(r) + z * Math.sin(r), -y * Math.sin(r) + z * Math.cos(r)];
  // Tangage autour du nez (x = 100, au sol) : la queue (x < 0) se relève.
  const dx = x - 100;
  [x, y] = [100 + dx * Math.cos(t) + y * Math.sin(t), -dx * Math.sin(t) + y * Math.cos(t)];
  // Lacet autour du nez (degrés) : oriente l'épave pour la caméra, le nez (et son feu) restant en place.
  const l = AVION.lacet * DEG;
  const ex = x - 100;
  [x, z] = [100 + ex * Math.cos(l) - z * Math.sin(l), ex * Math.sin(l) + z * Math.cos(l)];
  return [x, Math.max(y, p[1] < 0.5 ? 0 : y), z];
}

const camel = (token) => token.replace(/-(\w)/g, (_, ch) => ch.toUpperCase());
function tintOf(palette, token) {
  const value = palette[camel(token)];
  if (!value) return [1, 1, 1];
  const c = new THREE.Color(value);
  return [c.r, c.g, c.b];
}

function geometrie(tris) {
  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  for (const t of tris) {
    for (let i = 0; i < 3; i += 1) {
      pos.push(...t.p[i]);
      nor.push(...t.n);
      uv.push(...(t.uv?.[i] ?? [0, 0]));
      col.push(...t.rgb);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// epoque : section « epoque » du décor du jeu (decor.json) ; avion : son objet « avion » ; lookup : jetons de couleur ; floor : emprise du bâtiment.
// Renvoie un groupe, avec userData.foyers (flammes) et userData.centre, comme l'hélicoptère.
export function creerAvion({ epoque, avion, lookup, floor, palette, textures, renderer = null, k = AVION.k, lacet = null }) {
  if (lacet !== null) AVION.lacet = lacet; // atelier : ?avionlacet=degrés
  const spec = avion.spec;
  const x0 = spec.x + AVION.decalage[0];
  const z0 = spec.y + AVION.decalage[1];
  const group = new THREE.Group();
  group.name = 'avion-scene';
  // Couleurs et atlas du décor d'époque, comme js/game/world.js (teinte de la matière × atlas).
  const couleurs = couleursEpoque(epoque.couleurs, lookup);
  const lin = (rgb) => {
    const c = new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
    return [c.r, c.g, c.b];
  };
  const teinte = (mat) => {
    const cle = MATIERES[mat]?.teinte;
    return cle && cle !== 'neutre' && couleurs[cle] ? lin(couleurs[cle]) : [1, 1, 1];
  };
  // Modèle du jeu posé à l'origine avec son cap, puis agrandi et placé.
  const modele = objet('avion', avion.variante, { id: 'avion', x: 0, y: 0, cap: spec.cap ?? 0 });
  const sansCap = objet('avion', avion.variante, { id: 'ref', x: 0, y: 0, cap: 0 });
  // Rotation du cap telle que le jeu l'applique (déduite d'un sommet du modèle posé sans cap et avec cap).
  const ref = sansCap.triangles[0].p[0];
  const tourne = modele.triangles[0].p[0];
  const theta = Math.atan2(tourne[2], tourne[0]) - Math.atan2(ref[2], ref[0]);
  const place = (q) => {
    const c = Math.cos(theta);
    const s2 = Math.sin(theta);
    return [x0 + (q[0] * c - q[2] * s2) * k, q[1] * k, z0 + (q[0] * s2 + q[2] * c) * k];
  };
  const tourneN = (n) => [n[0] * Math.cos(theta) - n[2] * Math.sin(theta), n[1], n[0] * Math.sin(theta) + n[2] * Math.cos(theta)];
  // Modèle sans cap, posé en avion écrasé, puis cap, échelle et place ; normales recalculées.
  const tris = sansCap.triangles.map((t) => {
    const p = t.p.map((q) => place(poseEcrase(q, t.part)));
    const n = new THREE.Vector3(...p[1]).sub(new THREE.Vector3(...p[0])).cross(new THREE.Vector3(...p[2]).sub(new THREE.Vector3(...p[0]))).normalize();
    const n0 = tourneN(t.n);
    if (n.dot(new THREE.Vector3(...n0)) < 0) n.negate();
    return { ...t, p, n: [n.x, n.y, n.z], rgb: teinte(t.mat) };
  });
  const img = atlasEpoque({ couleurs });
  const tex = new THREE.DataTexture(new Uint8Array(img.data.buffer), img.width, img.height, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  // Tôle légèrement métallique (reflets de la petite image d'environnement de nuit de l'hélicoptère) ; verrière et marquages mats.
  const metal = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, metalness: 0.55, roughness: 0.5, envMap: renderer ? environnementNuit(renderer, palette) : null, envMapIntensity: 1, side: THREE.DoubleSide });
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide });
  const metalliques = new Set(['avion', 'acier', 'olive', 'brule']);
  for (const [liste, m] of [[tris.filter((t) => metalliques.has(t.mat)), metal], [tris.filter((t) => !metalliques.has(t.mat)), mat]]) {
    if (!liste.length) continue;
    const mesh = new THREE.Mesh(geometrie(liste), m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // Cratère et traînée du jeu, agrandis d'autant (comme l'hélicoptère de la scène).
  const h = specCratere({ ...avion, spec: { ...spec, x: x0, y: z0 } });
  const sc = { ...h, crater: { rx: h.crater.rx * k * 0.8, ry: h.crater.ry * k * 0.8 }, trail: { length: h.trail.length * k * 0.8, width: h.trail.width * k * 0.8 } };
  const soil = textures.repeat('sol-exterieur');
  const scars = [...craterTriangles(sc, floor ?? []), ...trailTriangles(sc, floor ?? [])].map((t) => ({ ...t, rgb: tintOf(palette, t.tint), uv: t.p.map((q) => [q[0] / soil, q[2] / soil]) }));
  const ground = new THREE.Mesh(geometrie(scars), new THREE.MeshLambertMaterial({ map: textures.texture('sol-exterieur'), vertexColors: true }));
  ground.receiveShadow = true;
  ground.position.y = 0.3;
  group.add(ground);
  // Foyers des flammes (moteur à l'avant, emplanture de l'aile arrachée, poste de pilotage) et centre, en coordonnées de scène.
  const at = (x, y, z) => new THREE.Vector3(...place(poseEcrase([x, y, z], 'fuselage')));
  group.userData.foyers = [at(82, 32, 0), at(10, 9, -36), at(-5, 38, 0)];
  group.userData.centre = at(0, 25, 0);
  return group;
}
