// Avion écrasé de la scène v2 (décor d'époque du jeu, lot 9h du jeu : un P-51 remplace l'hélicoptère). Même principe que l'hélicoptère de la scène
// (js/helico.js) : le modèle du jeu (copie figée, js/core/decor-epoque.js : objet('avion'), atlas d'époque généré en code, teintes dérivées des
// jetons), le cratère et la traînée du jeu (js/core/epaves.js), mais AGRANDI et DÉCALÉ (enrichissement de la scène) pour se lire derrière les
// personnages, à la place de l'hélicoptère, et en flammes (feu en boucle de la scène, js/feu.js). Dans la partie, l'avion fume sans brûler.
import * as THREE from 'three';
import { MATIERES, atlasEpoque, couleursEpoque, objet, regionUv, specCratere } from '../jeu/js/core/decor-epoque.js';
import { craterTriangles, trailTriangles } from '../jeu/js/core/epaves.js';
import { environnementNuit } from './helico.js';

// Échelle (le jeu : 1 ; l'avion du jeu est à 28 unités par mètre, les personnages de la scène sont grandis de 1,6) et décalage de son centre
// (unités du jeu, même décalage que l'hélicoptère de la scène : il ne traverse pas les murs de l'angle du L).
export const AVION = { k: 2.2, decalage: [150, -125], tangage: 7, enfoncement: 10, roulis: 0, lacet: 0 };
// Aile arrachée (retour du propriétaire : « une partie de l'avion sur la partie gauche, vide ») : l'aile gauche du modèle (aile-g), projetée
// loin de l'épave, plantée dans le sol de biais à gauche de l'image (position donnée par js/scene.js, repère de la scène) : inclinaison autour de
// sa corde (degrés), cap (degrés), part enfoncée sous le sol (0 à 1, de sa hauteur une fois inclinée).
export const AILE = { inclinaison: 55, cap: 20, enfouie: 0.28 };
const nombre = (cle, def) => { const v = Number(new URLSearchParams(location.search).get(cle)); return Number.isFinite(v) && new URLSearchParams(location.search).has(cle) ? v : def; };
// Pose d'avion écrasé (enrichissement de la scène ; dans le jeu, vu de dessus, l'avion est posé à plat) : nez planté dans le sol (tangage, en
// degrés, autour du nez ; roulis possible, 0 : aile relevée, elle se lisait comme une planche qui flotte), puis tout l'avion enfoncé dans la terre
// (enfoncement, unités du modèle ; retour du propriétaire : « on dirait qu'il flotte »). Sinon, vu de face et au ras du sol, l'avion n'était qu'un
// long bloc bas derrière les personnages. L'aile arrachée (aile-g) est posée à part (AILE).
const DEG = Math.PI / 180;
function poseEcrase(p, part) {
  if (part === 'aile-g') return [p[0], p[1] - 2, p[2]]; // (aile laissée près de l'épave, si aucune place n'est donnée)
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
  return [x, y - AVION.enfoncement, z];
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
// aile : position (monde) de l'aile arrachée, ou null (elle reste près de l'épave, comme dans le jeu).
export function creerAvion({ epoque, avion, lookup, floor, palette, textures, renderer = null, k = AVION.k, lacet = null, aile = null }) {
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
  // Aile arrachée : recentrée sur son milieu, inclinée autour de sa corde (x), tournée (cap), agrandie, posée à `aile` et enfoncée en partie.
  const aileTris = sansCap.triangles.filter((t) => t.part === 'aile-g');
  const c = [0, 1, 2].map((i) => aileTris.reduce((sum, t) => sum + t.p.reduce((a, q) => a + q[i], 0), 0) / (aileTris.length * 3));
  const ai = nombre('aileinc', AILE.inclinaison) * DEG; // atelier : ?aileinc=, ?ailecap=
  const ac = nombre('ailecap', AILE.cap) * DEG;
  const poseAile = (q) => {
    let [x, y, z] = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
    [y, z] = [y * Math.cos(ai) - z * Math.sin(ai), y * Math.sin(ai) + z * Math.cos(ai)];
    [x, z] = [x * Math.cos(ac) - z * Math.sin(ac), x * Math.sin(ac) + z * Math.cos(ac)];
    return [x * k, y * k, z * k];
  };
  let basAile = Infinity;
  let hautAile = -Infinity;
  for (const t of aileTris) for (const q of t.p) { const y = poseAile(q)[1]; basAile = Math.min(basAile, y); hautAile = Math.max(hautAile, y); }
  const placeAile = (q) => {
    const r = poseAile(q);
    return [aile.x + r[0], r[1] - basAile - AILE.enfouie * (hautAile - basAile), aile.z + r[2]];
  };
  const tris = sansCap.triangles.map((t) => {
    const p = t.p.map((q) => (aile && t.part === 'aile-g' ? placeAile(q) : place(poseEcrase(q, t.part))));
    const n = new THREE.Vector3(...p[1]).sub(new THREE.Vector3(...p[0])).cross(new THREE.Vector3(...p[2]).sub(new THREE.Vector3(...p[0]))).normalize();
    const n0 = aile && t.part === 'aile-g' ? poseAile([t.n[0] + c[0], t.n[1] + c[1], t.n[2] + c[2]]).map((v) => v / k) : tourneN(t.n);
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
  if (aile) group.userData.aile = new THREE.Vector3(aile.x, 0, aile.z);
  // Tôle arrachée qui bat au vent sur l'aile plantée (retour du propriétaire : du mouvement dans la partie gauche) : un volet (aileron) de la
  // couleur de l'avion, accroché par une charnière au BORD de fuite de l'aile et qui pend au-delà : il claque (4 battements par boucle, plus un
  // frémissement, 9 par boucle) sans jamais rentrer dans l'aile (retour : « le clapet traverse l'intérieur de l'aile ») : il tourne autour du bord,
  // l'aile est toute entière de l'autre côté de la charnière, et son angle reste loin du repli (moins de 75°). userData.tole.update(t).
  if (aile && aileTris.length) {
    let haut = null;
    for (const t of aileTris) for (const q of t.p) { const w = placeAile(q); if (!haut || w[1] > haut[1]) haut = w; }
    const centre = new THREE.Vector3(...placeAile(c));
    const envergure = new THREE.Vector3(...haut).sub(centre).normalize();
    const corde = new THREE.Vector3(...placeAile([c[0] + 1, c[1], c[2]])).sub(centre).normalize();
    corde.sub(envergure.clone().multiplyScalar(corde.dot(envergure))).normalize();
    // Bord de fuite : le point de l'aile le plus loin le long de la corde ; la charnière court le long de ce bord.
    let bord = -Infinity;
    for (const t of aileTris) for (const q of t.p) bord = Math.max(bord, new THREE.Vector3(...placeAile(q)).sub(centre).dot(corde));
    const normale = new THREE.Vector3().crossVectors(envergure, corde).normalize();
    const charniere = centre.clone().addScaledVector(corde, bord + 0.3 * k).addScaledVector(envergure, nombre('tolepos', 0.1) * 40 * k);
    const pivot = new THREE.Group();
    pivot.name = 'tole-au-vent';
    pivot.position.copy(charniere);
    pivot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(corde, normale, envergure));
    const pan = new THREE.Mesh(new THREE.BoxGeometry(15 * k, 0.6 * k, 24 * k).translate(7.5 * k, 0, 0), metal);
    const rgb = teinte('avion');
    const nb = pan.geometry.attributes.position.count;
    pan.geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: nb }, () => rgb).flat(), 3));
    const atlasUv = pan.geometry.attributes.uv;
    const r = regionUv('tole', img.width); // région « tôle » de l'atlas d'époque
    for (let i = 0; i < atlasUv.count; i += 1) atlasUv.setXY(i, r.u0 + atlasUv.getX(i) * (r.u1 - r.u0), r.v0 + atlasUv.getY(i) * (r.v1 - r.v0));
    pan.castShadow = true;
    pan.receiveShadow = true;
    pivot.add(pan);
    group.add(pivot);
    const TAU = Math.PI * 2;
    group.userData.tole = {
      pivot,
      update(t) {
        const u = t / 8;
        // Angle autour de la charnière (0 : dans le plan de l'aile, prolongé) : de −1,3 à +0,35 rad, jamais replié vers l'aile.
        const a = -0.5 + 0.7 * Math.sin(TAU * 4 * u) ** 3 + 0.12 * Math.sin(TAU * 9 * u + 0.7);
        pan.rotation.z = a;
      },
    };
  }
  group.userData.centre = at(0, 25, 0);
  return group;
}
