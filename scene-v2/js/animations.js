// Animations du décor d'époque de la scène v2 (retours du propriétaire : « avant, le rotor de l'hélicoptère tournait ; là, il n'y a plus rien ») :
// braises et étincelles qui montent du feu de l'avion, faisceau du projecteur du jeu qui balaie le ciel, parachute du jeu dont la voilure ondule
// au vent. Tout est fonction du temps de la boucle (js/boucle.js) : chaque mouvement fait un nombre entier de cycles par boucle de 8 s (aucune
// horloge, aucun hasard) ; la dernière image rejoint la première. (La tôle qui bat au vent est sur l'aile arrachée : js/avion.js.)
import * as THREE from 'three';
import { atlasEpoque, couleursEpoque, MATIERES, objet } from '../jeu/js/core/decor-epoque.js';
import { DUREE, cycle, onde } from './boucle.js';

const TAU = Math.PI * 2;
// Hachage entier → [0, 1[ (déterministe).
const h = (i, s = 0) => {
  let x = Math.imul(i + 1, 2654435761) ^ Math.imul(s + 7, 40503);
  x = Math.imul(x ^ (x >>> 15), 2246822519);
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
};

function tacheRonde(n = 64) {
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const g = c.getContext('2d');
  const d = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  d.addColorStop(0, 'rgba(255,255,255,1)');
  d.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  d.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = d;
  g.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- Braises et étincelles ---------------------------------------------------------------------------------------------------------------------
// foyers : points du feu (monde) ; chaque braise vit 8 / m secondes (m entier de 3 à 7), monte en tournoyant, poussée par le vent, rougit puis
// s'éteint ; quelques étincelles plus vives et plus rapides. k : échelle (unités du monde par unité du jeu).
export function creerBraises({ foyers, palette, n = 130, k = 1.6, vent = new THREE.Vector3(30, 0, 0) }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const taille = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('taille', new THREE.BufferAttribute(taille, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: { carte: { value: tacheRonde() }, echelle: { value: 900 } },
    vertexShader: `attribute float taille; varying vec3 vC; uniform float echelle;
      void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = taille * echelle / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'uniform sampler2D carte; varying vec3 vC; void main(){ vec4 t = texture2D(carte, gl_PointCoord); gl_FragColor = vec4(vC * t.a, t.a); }',
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.name = 'braises';
  const chaud = new THREE.Color(palette.fire);
  const bord = new THREE.Color(palette.fireEdge);
  const tmp = new THREE.Color();
  return {
    group: pts,
    update(t) {
      for (let i = 0; i < n; i += 1) {
        const etincelle = i % 6 === 0;
        const m = etincelle ? 7 : 3 + (i % 4); // vies de 8/7 à 8/3 s
        const u = cycle(t, m, h(i, 1)); // 0 à 1 sur la vie de la braise
        const vie = m * Math.floor((m * t) / DUREE + h(i, 1)); // numéro de vie (change le point de départ)
        const f = foyers[(i + vie) % foyers.length];
        const a = TAU * h(i + vie * 13, 2);
        const r = (6 + 10 * h(i + vie * 7, 3)) * k;
        const monte = (etincelle ? 190 : 120) * k * u * (0.8 + 0.4 * h(i, 4));
        const tour = TAU * (1.5 * u + h(i, 5));
        const x = f.x + Math.cos(a) * r + Math.cos(tour) * 5 * k * u + vent.x * u * 0.6 * k;
        const z = f.z + Math.sin(a) * r + Math.sin(tour) * 5 * k * u + vent.z * u * 0.6 * k;
        pos.set([x, f.y + monte, z], i * 3);
        // Couleur : du blanc-jaune du cœur au rouge du bord, puis éteinte (fondu au départ et à la fin de la vie).
        const eclat = Math.min(1, u * 10) * (1 - u) ** (etincelle ? 2 : 1.3);
        tmp.copy(chaud).lerp(bord, Math.min(1, u * 1.6)).multiplyScalar(eclat * (etincelle ? 3.2 : 2.4));
        col.set([tmp.r, tmp.g, tmp.b], i * 3);
        taille[i] = (etincelle ? 4 : 6) * k * (1 - 0.5 * u);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.attributes.taille.needsUpdate = true;
    },
  };
}

// --- Faisceau du projecteur -------------------------------------------------------------------------------------------------------------------
// origine : pied du faisceau (monde : la lentille du projecteur du jeu) ; il balaie le ciel, un aller-retour par boucle ; cône de lumière
// additif, plus dense près de la source, qui s'estompe au loin et sur ses bords. capMilieu : direction moyenne (radians, angle du monde).
export function creerFaisceau({ origine, capMilieu, palette, longueur = 4200, ouverture = 0.07, elevation = 0.5, amplitude = 0.42 }) {
  const geo = new THREE.CylinderGeometry(longueur * Math.tan(ouverture), 6, longueur, 32, 1, true).translate(0, longueur / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { couleur: { value: new THREE.Color(palette.sun).lerp(new THREE.Color(1, 1, 1), 0.4) }, longueur: { value: longueur }, force: { value: 0.32 } },
    vertexShader: 'varying float vH; varying vec3 vN; varying vec3 vV; void main(){ vH = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 couleur; uniform float longueur; uniform float force; varying float vH; varying vec3 vN; varying vec3 vV;
      void main(){ float d = clamp(vH / longueur, 0.0, 1.0); float bords = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float a = force * bords * pow(1.0 - d, 1.4) * smoothstep(0.0, 0.02, d); gl_FragColor = vec4(couleur * a, a); }`,
  });
  const cone = new THREE.Mesh(geo, mat);
  cone.frustumCulled = false;
  cone.renderOrder = 2;
  const pivot = new THREE.Group();
  pivot.name = 'faisceau-projecteur';
  pivot.position.copy(origine);
  pivot.add(cone);
  // Éclat de la lentille.
  const lueur = new THREE.Sprite(new THREE.SpriteMaterial({ map: tacheRonde(), color: mat.uniforms.couleur.value, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  lueur.scale.setScalar(70);
  pivot.add(lueur);
  return {
    group: pivot,
    update(t) {
      const cap = capMilieu + amplitude * onde(t, 1, 0.1); // un aller-retour par boucle
      const elev = elevation + 0.08 * onde(t, 2, 0.3); // il monte et descend un peu
      // Le cône (axe +y) pointe vers (cap, élévation).
      const dir = new THREE.Vector3(Math.sin(cap) * Math.cos(elev), Math.sin(elev), Math.cos(cap) * Math.cos(elev));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    },
  };
}

// --- Parachute ---------------------------------------------------------------------------------------------------------------------------------
// Modèle du jeu (voilure étalée sur un arbre mort, suspentes, harnais : objet('parachute')), même atlas et mêmes teintes que le décor d'époque,
// replacé dans la scène (position, cap, échelle) ; la voilure (soie) ondule : vagues qui la traversent (2 et 3 cycles par boucle), plus fortes
// au bord qu'au sommet (accroché à l'arbre).
export function creerParachute({ epoque, lookup, position, cap = 0, k = 1.6 }) {
  const couleurs = couleursEpoque(epoque.couleurs, lookup);
  const lin = (rgb) => {
    const c = new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
    return [c.r, c.g, c.b];
  };
  const teinte = (m) => {
    const cle = MATIERES[m]?.teinte;
    return cle && cle !== 'neutre' && couleurs[cle] ? lin(couleurs[cle]) : [1, 1, 1];
  };
  const o = objet('parachute', 'deploye', { id: 'parachute-scene', x: 0, y: 0, cap: 0 });
  const tris = o.triangles;
  const n = tris.length * 3;
  const base = new Float32Array(n * 3);
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const col = new Float32Array(n * 3);
  const soie = new Uint8Array(n);
  tris.forEach((t, i) => {
    const rgb = teinte(t.mat);
    for (let j = 0; j < 3; j += 1) {
      const v = i * 3 + j;
      base.set(t.p[j], v * 3);
      nor.set(t.n, v * 3);
      uv.set(t.uv?.[j] ?? [0, 0], v * 2);
      col.set(rgb, v * 3);
      soie[v] = t.mat === 'soie' ? 1 : 0;
    }
  });
  pos.set(base);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const img = atlasEpoque({ couleurs });
  const tex = new THREE.DataTexture(new Uint8Array(img.data.buffer), img.width, img.height, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.name = 'parachute-scene';
  mesh.position.copy(position);
  mesh.rotation.y = cap;
  mesh.scale.setScalar(k);
  return {
    group: mesh,
    update(t) {
      for (let v = 0; v < n; v += 1) {
        if (!soie[v]) continue;
        const x = base[v * 3];
        const y = base[v * 3 + 1];
        const z = base[v * 3 + 2];
        const r = Math.hypot(x, z); // distance au sommet (accroché à l'arbre)
        const bord = Math.min(1, Math.max(0, (r - 6) / 45));
        const vague = 0.65 * Math.sin(TAU * (2 * t / DUREE) - x * 0.09) + 0.35 * Math.sin(TAU * (3 * t / DUREE) - z * 0.12 + 1.3);
        pos[v * 3 + 1] = y + vague * 5.5 * bord;
        pos[v * 3] = x + vague * 1.5 * bord;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}
