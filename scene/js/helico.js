// Hélicoptère écrasé de la scène : le modèle du jeu (copie figée, js/core/epaves.js : helicopterModel, craterTriangles,
// trailTriangles), même texture d'atlas et mêmes teintes que js/game/world.js (addHelicopter), mais AGRANDI (enrichissement de la
// scène) : dans le jeu, l'hélicoptère n'est pas plus haut qu'un personnage, ce qui se voit dès qu'on le filme de face.
import * as THREE from 'three';
import { craterTriangles, helicopterModel, trailTriangles } from '../jeu/js/core/epaves.js';

// Échelle de l'hélicoptère (le jeu : 1) et décalage de son centre (unités du jeu) pour qu'agrandi il ne traverse pas les murs de l'angle du L.
export const HELICO = { k: 2.4, decalage: [150, -125] };
export const ECHELLE_HELICO = HELICO.k;
const DEG = Math.PI / 180;

const camel = (token) => token.replace(/-(\w)/g, (_, ch) => ch.toUpperCase());
function tintOf(palette, token) {
  const value = palette[camel(token)];
  if (!value) return [1, 1, 1];
  const c = new THREE.Color(value);
  return [c.r, c.g, c.b];
}

// Triangles en coordonnées de scène : modèle agrandi, puis cap et position (comme placeHelicopter du jeu).
function placed(spec, k) {
  const a = spec.heading * DEG;
  const rot = (p) => [p[0] * Math.cos(a) - p[2] * Math.sin(a), p[1], p[0] * Math.sin(a) + p[2] * Math.cos(a)];
  return helicopterModel().triangles.map((t) => {
    const p = t.p.map((v) => {
      const r = rot([v[0] * k, v[1] * k, v[2] * k]);
      return [r[0] + spec.x, r[1], r[2] + spec.y];
    });
    return { ...t, p, n: rot(t.n) };
  });
}

function mesh(tris, material, uvOf) {
  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  for (const t of tris) {
    const uvs = uvOf(t);
    for (let i = 0; i < 3; i += 1) {
      pos.push(...t.p[i]);
      nor.push(...t.n);
      uv.push(...uvs[i]);
      col.push(...t.rgb);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return new THREE.Mesh(g, material);
}

// heli : décor du jeu (layout.decor.helicopter) ; floor : emprise du bâtiment (le cratère n'y entre pas). Renvoie un groupe.
export function creerHelico({ heli: heli0, floor, palette, textures, k = ECHELLE_HELICO }) {
  const heli = { ...heli0, x: heli0.x + HELICO.decalage[0], y: heli0.y + HELICO.decalage[1] };
  const group = new THREE.Group();
  group.name = 'helicoptere-scene';
  const atlas = new THREE.MeshLambertMaterial({ map: textures.texture('atlas-props'), vertexColors: true, side: THREE.DoubleSide });
  const tris = placed(heli, k);
  const byPart = new Map();
  for (const t of tris) {
    if (!byPart.has(t.part)) byPart.set(t.part, []);
    byPart.get(t.part).push(t);
  }
  const all = [];
  for (const list of byPart.values()) {
    const r = textures.region('atlas-props', list[0].region);
    const lo = [Infinity, Infinity, Infinity];
    for (const t of list) for (const p of t.p) for (let i = 0; i < 3; i += 1) lo[i] = Math.min(lo[i], p[i]);
    const span = Math.max(1, r.scale);
    const rgb = tintOf(palette, list[0].tint);
    for (const t of list) {
      t.rgb = rgb;
      t.uvs = t.p.map((p) => {
        const n = t.n;
        const ax = Math.abs(n[0]) >= Math.abs(n[1]) && Math.abs(n[0]) >= Math.abs(n[2]) ? [2, 1] : Math.abs(n[1]) >= Math.abs(n[2]) ? [0, 2] : [0, 1];
        // Texture répétée à l'échelle du jeu (les motifs gardent leur taille) mais repliée dans la région de l'atlas.
        const fa = ((p[ax[0]] - lo[ax[0]]) / span) % 1;
        const fc = ((p[ax[1]] - lo[ax[1]]) / span) % 1;
        return [r.u0 + fa * (r.u1 - r.u0), r.v0 + fc * (r.v1 - r.v0)];
      });
      all.push(t);
    }
  }
  const body = mesh(all, atlas, (t) => t.uvs);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  // Cratère et traînée de glissade, agrandis d'autant ; terre du jeu (texture « sol-exterieur » répétée), teintée.
  const spec = { ...heli, crater: { rx: heli.crater.rx * k * 0.8, ry: heli.crater.ry * k * 0.8 }, trail: { length: heli.trail.length * k * 0.8, width: heli.trail.width * k * 0.8 } };
  const soil = textures.repeat('sol-exterieur');
  const scars = [...craterTriangles(spec, floor ?? []), ...trailTriangles(spec, floor ?? [])].map((t) => ({ ...t, rgb: tintOf(palette, t.tint) }));
  const ground = mesh(scars, new THREE.MeshLambertMaterial({ map: textures.texture('sol-exterieur'), vertexColors: true }), (t) => t.p.map((q) => [q[0] / soil, q[2] / soil]));
  ground.receiveShadow = true;
  ground.position.y = 0.3;
  group.add(ground);
  // Points utiles : foyers des flammes (moteur au-dessus du fuselage, arrière de la cabine), en coordonnées de scène.
  const a = heli.heading * DEG;
  const at = (x, y, z) => new THREE.Vector3(heli.x + (x * Math.cos(a) - z * Math.sin(a)) * k, y * k, heli.y + (x * Math.sin(a) + z * Math.cos(a)) * k);
  group.userData.foyers = [at(-6, 50, 0), at(14, 44, -8), at(-30, 38, 10)];
  group.userData.centre = at(0, 30, 0);
  return group;
}
