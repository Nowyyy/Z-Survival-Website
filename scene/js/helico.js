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

// Tôle peinte générée en code (aucune image, détails ?details=1 : « l'hélicoptère a l'air en bois ») : gris neutre multiplié par la teinte
// de chaque pièce (jetons du jeu) ; panneaux rivetés, rayures claires, coulures de suie et de rouille. 512 px, répétée.
function texturePeinteMetal() {
  const n = 512;
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const g = c.getContext('2d');
  let h = 977;
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  g.fillStyle = '#b8b8b8';
  g.fillRect(0, 0, n, n);
  const img = g.getImageData(0, 0, n, n);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (rnd() - 0.5) * 18;
    img.data[i] += v;
    img.data[i + 1] += v;
    img.data[i + 2] += v;
  }
  g.putImageData(img, 0, 0);
  // Coulures de suie et de rouille (taches allongées vers le bas).
  for (let i = 0; i < 26; i += 1) {
    const x = rnd() * n;
    const y = rnd() * n;
    const w = 10 + rnd() * 40;
    const grd = g.createLinearGradient(x, y, x, y + w * 3);
    const rouille = rnd() < 0.4;
    grd.addColorStop(0, rouille ? 'rgba(90,50,25,0.45)' : 'rgba(20,20,20,0.5)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - w / 2, y, w, w * 3);
  }
  // Panneaux : joints sombres et rivets.
  g.strokeStyle = 'rgba(30,30,30,0.85)';
  g.lineWidth = 3;
  for (let k = 0; k <= n; k += 128) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k, n); g.stroke();
    g.beginPath(); g.moveTo(0, k); g.lineTo(n, k); g.stroke();
  }
  for (let k = 0; k <= n; k += 128) {
    for (let j = 8; j < n; j += 16) {
      for (const [x, y] of [[k + 7, j], [j, k + 7]]) {
        g.fillStyle = 'rgba(40,40,40,0.9)'; g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(235,235,235,0.6)'; g.beginPath(); g.arc(x - 0.6, y - 0.6, 1, 0, Math.PI * 2); g.fill();
      }
    }
  }
  // Rayures claires (métal à nu).
  g.strokeStyle = 'rgba(245,245,245,0.55)';
  g.lineWidth = 1;
  for (let i = 0; i < 60; i += 1) {
    const x = rnd() * n;
    const y = rnd() * n;
    const a = rnd() * Math.PI;
    const l = 6 + rnd() * 30;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// heli : décor du jeu (layout.decor.helicopter) ; floor : emprise du bâtiment (le cratère n'y entre pas). Renvoie un groupe.
export function creerHelico({ heli: heli0, floor, palette, textures, k = ECHELLE_HELICO, details = false }) {
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
  // Détails (?details=1) : tôle peinte (texture générée) au lieu de la région de l'atlas du jeu, sauf la verrière ; rotor de queue à part,
  // qui tourne lentement autour de son moyeu (group.userData.rotor).
  const rotorIds = new Set(['rotor-queue-1', 'rotor-queue-2']);
  const metal = details ? new THREE.MeshStandardMaterial({ map: texturePeinteMetal(), vertexColors: true, metalness: 0.35, roughness: 0.62, side: THREE.DoubleSide }) : null;
  const TUILE = 70; // unités du monde par répétition de la tôle (panneaux d'environ 17 unités)
  const uvMetal = (t) => t.p.map((p) => {
    const n = t.n;
    const ax = Math.abs(n[0]) >= Math.abs(n[1]) && Math.abs(n[0]) >= Math.abs(n[2]) ? [2, 1] : Math.abs(n[1]) >= Math.abs(n[2]) ? [0, 2] : [0, 1];
    return [p[ax[0]] / TUILE, p[ax[1]] / TUILE];
  });
  const ajouter = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  if (!details) ajouter(mesh(all, atlas, (t) => t.uvs));
  else {
    ajouter(mesh(all.filter((t) => t.region === 'vitre'), atlas, (t) => t.uvs));
    ajouter(mesh(all.filter((t) => t.region !== 'vitre' && !rotorIds.has(t.part)), metal, uvMetal));
    // Rotor de queue : moyeu = centre de ses sommets ; axe = normale de sa plus grande face.
    const rot = all.filter((t) => rotorIds.has(t.part));
    if (rot.length) {
      const c = new THREE.Vector3();
      let nb = 0;
      let best = 0;
      const axe = new THREE.Vector3(0, 0, 1);
      for (const t of rot) {
        for (const q of t.p) { c.add(new THREE.Vector3(...q)); nb += 1; }
        const a = new THREE.Vector3(...t.p[1]).sub(new THREE.Vector3(...t.p[0])).cross(new THREE.Vector3(...t.p[2]).sub(new THREE.Vector3(...t.p[0]))).length();
        if (a > best) { best = a; axe.set(...t.n).normalize(); }
      }
      c.divideScalar(nb);
      const local = rot.map((t) => ({ ...t, p: t.p.map((q) => [q[0] - c.x, q[1] - c.y, q[2] - c.z]) }));
      const m = ajouter(mesh(local, metal, uvMetal));
      const pivot = new THREE.Group();
      pivot.position.copy(c);
      pivot.add(m);
      group.add(pivot);
      group.userData.rotor = { pivot, axe };
    }
  }
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
