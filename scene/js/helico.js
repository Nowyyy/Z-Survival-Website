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
  // Retour du propriétaire : « trop de répétition de carrés ». Plus de grille régulière : bandes horizontales de hauteurs variées, chacune
  // coupée en panneaux de largeurs variées et décalés d'une bande à l'autre (comme un revêtement d'appareil), joints fins, rivets sur
  // quelques joints seulement ; grandes nuances de peinture passée, écaillures, suie et rouille. Image raccordable sur ses bords, répétée
  // tous les TUILE (grand) et décalée par pièce (uvMetal) : la répétition ne se voit plus.
  const n = 1024;
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
  // Dessin répété aux bords (image raccordable).
  const partout = (f) => { for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) f(dx, dy); };
  g.fillStyle = '#c4c8cc';
  g.fillRect(0, 0, n, n);
  // Grandes nuances de peinture passée (taches douces claires et sombres).
  for (let i = 0; i < 70; i += 1) {
    const x = rnd() * n;
    const y = rnd() * n;
    const r = 60 + rnd() * 220;
    const clair = rnd() < 0.5;
    const a = 0.05 + rnd() * 0.09;
    partout((dx, dy) => {
      const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      grd.addColorStop(0, clair ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
    });
  }
  // Grain fin.
  const img = g.getImageData(0, 0, n, n);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (rnd() - 0.5) * 12;
    img.data[i] += v;
    img.data[i + 1] += v;
    img.data[i + 2] += v;
  }
  g.putImageData(img, 0, 0);
  // Écaillures : petites plaques de métal à nu, plus claires, au bord sombre.
  for (let i = 0; i < 40; i += 1) {
    const x = rnd() * n;
    const y = rnd() * n;
    const pts = Array.from({ length: 7 }, (_, k) => { const a = (k / 7) * Math.PI * 2; const r = 3 + rnd() * 12; return [Math.cos(a) * r, Math.sin(a) * r * 0.7]; });
    partout((dx, dy) => {
      g.beginPath();
      pts.forEach(([px, py], k) => (k ? g.lineTo(x + dx + px, y + dy + py) : g.moveTo(x + dx + px, y + dy + py)));
      g.closePath();
      g.fillStyle = 'rgba(232,234,236,0.55)';
      g.fill();
      g.strokeStyle = 'rgba(40,36,32,0.35)';
      g.lineWidth = 1;
      g.stroke();
    });
  }
  // Coulures de suie et de rouille (taches allongées vers le bas).
  for (let i = 0; i < 34; i += 1) {
    const x = rnd() * n;
    const y = rnd() * n;
    const w = 8 + rnd() * 50;
    const rouille = rnd() < 0.4;
    const a = 0.2 + rnd() * 0.3;
    partout((dx, dy) => {
      const grd = g.createLinearGradient(x + dx, y + dy, x + dx, y + dy + w * 4);
      grd.addColorStop(0, rouille ? `rgba(95,52,24,${a})` : `rgba(22,22,22,${a})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x + dx - w / 2, y + dy, w, w * 4);
    });
  }
  // Panneaux : bandes de hauteurs variées, découpées en panneaux de largeurs variées, décalés d'une bande à l'autre.
  const rivets = (x0, y0, x1, y1) => {
    const l = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 6; d < l - 3; d += 14) {
      const x = x0 + ((x1 - x0) * d) / l;
      const y = y0 + ((y1 - y0) * d) / l;
      partout((dx, dy) => {
        g.fillStyle = 'rgba(45,45,45,0.7)'; g.beginPath(); g.arc(x + dx, y + dy, 1.8, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(235,235,235,0.45)'; g.beginPath(); g.arc(x + dx - 0.5, y + dy - 0.5, 0.8, 0, Math.PI * 2); g.fill();
      });
    }
  };
  const joint = (x0, y0, x1, y1) => partout((dx, dy) => {
    g.strokeStyle = 'rgba(28,28,28,0.55)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0 + dx, y0 + dy); g.lineTo(x1 + dx, y1 + dy); g.stroke();
    g.strokeStyle = 'rgba(240,240,240,0.18)'; // lèvre claire du panneau voisin
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0 + dx + 1.5, y0 + dy + 1.5); g.lineTo(x1 + dx + 1.5, y1 + dy + 1.5); g.stroke();
  });
  const hauteurs = [];
  for (let reste = n; reste > 0;) {
    const hb = Math.min(reste, reste < 300 ? reste : 170 + Math.floor(rnd() * 200));
    hauteurs.push(hb);
    reste -= hb;
  }
  let y = 0;
  for (const hb of hauteurs) {
    joint(0, y, n, y);
    if (rnd() < 0.6) rivets(0, y + 7, n, y + 7);
    let x = rnd() * n; // départ décalé : les joints verticaux ne s'alignent pas d'une bande à l'autre
    for (let fait = 0; fait < n;) {
      const w = Math.min(n - fait, 190 + rnd() * 330);
      joint(x, y, x, y + hb);
      if (rnd() < 0.35) rivets(x + 7, y, x + 7, y + hb);
      x = (x + w) % n;
      fait += w;
    }
    // Trappe ou plaque de réparation de temps en temps.
    if (rnd() < 0.5) {
      const tw = 40 + rnd() * 70;
      const th = 30 + rnd() * 50;
      const tx = rnd() * (n - tw);
      const ty = y + 20 + rnd() * Math.max(1, hb - th - 40);
      g.strokeStyle = 'rgba(28,28,28,0.5)';
      g.lineWidth = 1.5;
      g.strokeRect(tx, ty, tw, th);
      rivets(tx + 4, ty + 4, tx + tw - 4, ty + 4);
      rivets(tx + 4, ty + th - 4, tx + tw - 4, ty + th - 4);
    }
    y += hb;
  }
  // Rayures claires (métal à nu).
  g.strokeStyle = 'rgba(245,245,245,0.45)';
  g.lineWidth = 1;
  for (let i = 0; i < 110; i += 1) {
    const x0 = rnd() * n;
    const y0 = rnd() * n;
    const a = rnd() * Math.PI;
    const l = 6 + rnd() * 40;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// heli : décor du jeu (layout.decor.helicopter) ; floor : emprise du bâtiment (le cratère n'y entre pas). Renvoie un groupe.
// Reflets du métal (détails) : petite image d'environnement de nuit (ciel bleu-noir, lune, lueur orange du feu), préfiltrée par Three.js.
function environnementNuit(renderer, palette) {
  const env = new THREE.Scene();
  const ciel = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { haut: { value: new THREE.Color(palette.ground) }, bas: { value: new THREE.Color(palette.fog) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 haut; uniform vec3 bas; varying vec3 vP; void main(){ gl_FragColor = vec4(mix(bas, haut, clamp(vP.y * 1.5 + 0.3, 0.0, 1.0)) * 1.6, 1.0); }',
  }));
  const tache = (couleur, force, x, y, z, r) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(couleur).multiplyScalar(force) }));
    m.position.set(x, y, z);
    env.add(m);
  };
  env.add(ciel);
  tache(palette.sun, 3, -40, 50, -60, 9); // lune
  tache(palette.fireEdge, 4, 60, 10, 20, 22); // incendie
  tache(palette.fire, 2.5, -60, 5, 50, 10); // lampes
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}
// Teinte « acier » : la teinte du jeu (olive brûlé, qui faisait bois sous la lumière chaude) désaturée et refroidie vers un gris bleuté.
function teinteAcier(rgb) {
  const l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const acier = [l * 0.92, l * 0.98, l * 1.08];
  return rgb.map((c, i) => c * 0.25 + acier[i] * 0.75);
}

export function creerHelico({ heli: heli0, floor, palette, textures, k = ECHELLE_HELICO, details = false, renderer = null }) {
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
  const metal = details ? new THREE.MeshStandardMaterial({ map: texturePeinteMetal(), vertexColors: true, metalness: 0.7, roughness: 0.42, envMap: renderer ? environnementNuit(renderer, palette) : null, envMapIntensity: 1.1, side: THREE.DoubleSide }) : null;
  if (details) for (const t of all) if (t.region !== 'vitre') t.rgb = teinteAcier(t.rgb);
  const TUILE = 240; // unités du monde par répétition de la tôle (panneaux de 40 à 125 unités de large, bandes de 40 à 90 de haut)
  // Décalage propre à chaque pièce (hachage de son nom) : deux pièces voisines ne montrent pas le même morceau de tôle.
  const decalage = new Map();
  const decalageDe = (id = '') => {
    if (!decalage.has(id)) {
      let x = 2166136261;
      for (const ch of id) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
      decalage.set(id, [((x >>> 0) % 997) / 997, ((x >>> 10) % 991) / 991]);
    }
    return decalage.get(id);
  };
  const uvMetal = (t) => {
    const [du, dv] = decalageDe(t.part);
    return t.p.map((p) => {
      const n = t.n;
      const ax = Math.abs(n[0]) >= Math.abs(n[1]) && Math.abs(n[0]) >= Math.abs(n[2]) ? [2, 1] : Math.abs(n[1]) >= Math.abs(n[2]) ? [0, 2] : [0, 1];
      return [p[ax[0]] / TUILE + du, p[ax[1]] / TUILE + dv];
    });
  };
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
