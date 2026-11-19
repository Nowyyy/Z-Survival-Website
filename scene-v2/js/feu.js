// Flammes et fumée en boucle parfaite. Mêmes shaders et mêmes couleurs que le feu du jeu (copie figée, js/game/fire.js : points en
// mélange additif pour les flammes, fumée en mélange « prémultiplié », jetons --game-fire, --game-fire-edge, --game-smoke), mais
// chaque particule est une fonction du temps de la boucle : sa durée de vie divise DUREE (js/boucle.js), donc la dernière image
// rejoint la première. Aucune horloge, aucun hasard (suite tirée d'un hachage).
import * as THREE from 'three';
import { DUREE } from './boucle.js';

// Shaders de js/game/fire.js (repris tels quels).
const POINT_VERTEX = `
attribute float aSize;
attribute vec4 aColor;
uniform float uScale;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(-mv.z, 1.0);
  gl_Position = projectionMatrix * mv;
}`;
const POINT_FRAGMENT = `
varying vec4 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = vColor.a * smoothstep(1.0, 0.15, d);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb * a, a);
}`;

// Hachage déterministe → [0, 1[.
function hash(a, b = 0, c = 0) {
  let h = Math.imul(a + 1, 2654435761) ^ Math.imul(b + 7, 40503) ^ Math.imul(c + 13, 2246822519);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function points(n, blending, fog = true) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
  const material = new THREE.ShaderMaterial({ vertexShader: POINT_VERTEX, fragmentShader: POINT_FRAGMENT, uniforms: { uScale: { value: 400 } }, transparent: true, depthWrite: false, blending, premultipliedAlpha: true, fog: false });
  const p = new THREE.Points(geometry, material);
  p.frustumCulled = false;
  p.onBeforeRender = (renderer, scene, camera) => {
    const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    material.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov ?? 75) / 2));
  };
  return p;
}

// Feu bouclé. foyers : [Vector3] (points où naissent les flammes) ; spread : étalement autour de chaque foyer ; scale : taille ;
// wind : vent (Vector3, unités par seconde) ; palette : readPalette() du jeu. Options : flames, smoke (nombre de particules), seed.
export function creerFeu({ foyers, spread = 10, scale = 1, wind = new THREE.Vector3(30, 0, 0), palette, flames = 90, smoke = 70, seed = 1, smokeAlpha = 0.42, smokeColor = null }) {
  const group = new THREE.Group();
  group.name = `feu-boucle-${seed}`;
  const core = new THREE.Color(palette.fire);
  const edge = new THREE.Color(palette.fireEdge);
  const smokeCol = new THREE.Color(smokeColor ?? palette.smoke);
  const fl = points(flames, THREE.AdditiveBlending);
  fl.name = 'flammes';
  const sm = points(smoke, THREE.CustomBlending);
  sm.material.blendSrc = THREE.OneFactor;
  sm.material.blendDst = THREE.OneMinusSrcAlphaFactor;
  sm.name = 'fumee';
  sm.renderOrder = 1;
  fl.renderOrder = 2;
  group.add(sm, fl);
  // Chaque particule : k = nombre de vies par boucle (entier), décalage de phase, foyer et départ tirés selon le numéro de vie (mod k).
  const mk = (n, kMin, kMax, salt) => Array.from({ length: n }, (_, i) => ({ k: kMin + Math.floor(hash(i, salt, seed) * (kMax - kMin + 1)), off: hash(i, salt + 1, seed), i }));
  const flameParts = mk(flames, 9, 15, 11); // vies de 0,53 à 0,89 s
  const smokeParts = mk(smoke, 1, 2, 23); // vies de 4 à 8 s
  const tmp = new THREE.Color();
  const start = (p, life, salt) => {
    const f = foyers[Math.floor(hash(p.i, life, salt + seed) * foyers.length) % foyers.length];
    return [f.x + (hash(p.i, life, salt + 2) * 2 - 1) * spread, f.y, f.z + (hash(p.i, life, salt + 3) * 2 - 1) * spread, hash(p.i, life, salt + 4) * Math.PI * 2, hash(p.i, life, salt + 5)];
  };
  const write = (t) => {
    const fp = fl.geometry.attributes.position.array;
    const fs = fl.geometry.attributes.aSize.array;
    const fc = fl.geometry.attributes.aColor.array;
    flameParts.forEach((p, i) => {
      const x = (p.k * t) / DUREE + p.off;
      const life = ((Math.floor(x) % p.k) + p.k) % p.k; // numéro de vie, périodique
      const k = x - Math.floor(x); // âge relatif (0 à 1)
      const age = (k * DUREE) / p.k;
      const [x0, y0, z0, ph, r] = start(p, life, 101);
      const rise = (75 + 55 * r) * scale;
      fp[i * 3] = x0 + Math.sin(ph + age * 9) * 4 * k * scale + wind.x * 0.25 * age * k;
      fp[i * 3 + 1] = y0 + 2 + rise * age;
      fp[i * 3 + 2] = z0 + Math.cos(ph + age * 7) * 3 * k * scale + wind.z * 0.25 * age * k;
      fs[i] = 58 * scale * (1 - k * 0.65) * Math.min(1, k * 8);
      tmp.copy(core).lerp(edge, Math.min(1, k * 1.4));
      fc.set([tmp.r, tmp.g, tmp.b, (1 - k) * 0.9 * Math.min(1, k * 10)], i * 4);
    });
    const sp = sm.geometry.attributes.position.array;
    const ss = sm.geometry.attributes.aSize.array;
    const sc = sm.geometry.attributes.aColor.array;
    smokeParts.forEach((p, i) => {
      const x = (p.k * t) / DUREE + p.off;
      const life = ((Math.floor(x) % p.k) + p.k) % p.k;
      const k = x - Math.floor(x);
      const age = (k * DUREE) / p.k;
      const [x0, y0, z0, ph, r] = start(p, life + 50, 207);
      const rise = (26 + 18 * r) * scale;
      // La fumée monte puis part avec le vent, de plus en plus vite en montant (comme dans le jeu).
      sp[i * 3] = x0 + wind.x * age * age * 0.18 + Math.sin(ph + age * 0.9) * 8 * scale;
      sp[i * 3 + 1] = y0 + 20 * scale + rise * age;
      sp[i * 3 + 2] = z0 + wind.z * age * age * 0.18 + Math.cos(ph + age * 0.7) * 8 * scale;
      ss[i] = (60 + 150 * k) * scale;
      const a = smokeAlpha * Math.min(1, k * 5) * (1 - k);
      sc.set([smokeCol.r, smokeCol.g, smokeCol.b, a], i * 4);
    });
    for (const g of [fl, sm]) for (const name of ['position', 'aSize', 'aColor']) g.geometry.attributes[name].needsUpdate = true;
  };
  return { group, update: write };
}
