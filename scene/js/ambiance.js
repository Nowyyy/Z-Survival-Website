// Ambiance de nuit de la scène : lune (la lumière directionnelle du jeu, rabattue en clair de lune bleuté, venue de l'arrière),
// lumière ambiante baissée, ciel en dégradé et disque de lune, lueur chaude des flammes de l'hélicoptère, lampes à huile du jeu
// (copie figée, js/game/lamps.js : createLampMeshes) sur des piquets, chacune avec sa lumière qui vacille. Couleurs : jetons du jeu
// (css/tokens.css, palette.js) ; vacillements périodiques (js/boucle.js).
import * as THREE from 'three';
import { createLampMeshes } from '../jeu/js/game/lamps.js';
import { bruit, onde } from './boucle.js';

export const REGLAGES = {
  ambiante: 0.32, // le jeu : 2,3 (vue de dessus, sans lumières d'appoint)
  lune: 2.6, // le jeu : 3,5
  luneDir: new THREE.Vector3(-0.4, 0.24, -0.88), // vers la lune, repère de la scène : basse, derrière, à gauche (visible dans le plan large)
  feuHelico: 2400, // intensité de la lueur des flammes
  lampe: 700,
  appoint: 520,
};

// Ciel : dôme en dégradé (brume à l'horizon, presque noir au zénith), sans brouillard.
function ciel(palette) {
  const g = new THREE.SphereGeometry(15000, 32, 16);
  const m = new THREE.ShaderMaterial({
    uniforms: { uHorizon: { value: new THREE.Color(palette.fog) }, uZenith: { value: new THREE.Color(palette.ground) }, uGlow: { value: new THREE.Color(palette.fireEdge) }, uGlowDir: { value: new THREE.Vector3(1, 0, 0) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uGlow; uniform vec3 uGlowDir; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(uHorizon, uZenith, pow(h, 0.45));
        float g = max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), uGlowDir)); c += uGlow * 0.10 * pow(g, 6.0) * (1.0 - smoothstep(0.0, 0.35, h));
        gl_FragColor = vec4(c, 1.0); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'ciel';
  mesh.renderOrder = -10;
  return mesh;
}

// Disque de lune et son halo (sans brouillard), posés loin dans la direction de la lune.
function lune(palette) {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(260, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.sun).multiplyScalar(1.15), fog: false, depthWrite: false }));
  const halo = new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(palette.sun) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = 0.22 * pow(max(0.0, 1.0 - d), 2.5); gl_FragColor = vec4(uColor * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  halo.position.z = -1;
  halo.renderOrder = -8;
  disc.renderOrder = -7;
  group.add(halo, disc);
  group.name = 'lune';
  return group;
}

// Étoiles : points fixes sur la voûte (hachage déterministe), sans brouillard, plus nombreuses vers le zénith.
function etoiles(palette, n = 700) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const base = new THREE.Color(palette.sun);
  let h = 12345;
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  for (let i = 0; i < n; i += 1) {
    const az = rnd() * Math.PI * 2;
    const el = Math.asin(0.08 + 0.92 * Math.sqrt(rnd()));
    pos.set([Math.cos(el) * Math.cos(az) * 14000, Math.sin(el) * 14000, Math.cos(el) * Math.sin(az) * 14000], i * 3);
    const k = 0.25 + 0.75 * rnd() ** 3;
    col.set([base.r * k, base.g * k, base.b * k], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
  p.renderOrder = -9;
  p.name = 'etoiles';
  return p;
}

// Piquet de bois planté au sol avec une lampe à huile du jeu accrochée dessus (support « mur » : la plaque contre le piquet).
function piquet(textures, x, z, hauteur = 58) {
  const r = textures.region('atlas-props', 'bois-sombre');
  const g = new THREE.BoxGeometry(5, hauteur, 5);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0) * 0.2, r.v0 + uv.getY(i) * (r.v1 - r.v0));
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: textures.texture('atlas-props') }));
  mesh.position.set(x, hauteur / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Lueur chaude derrière les planches des fenêtres du bâtiment (des lampes à huile allumées à l'intérieur) : un plan émissif dans
// l'ouverture, en retrait dans l'épaisseur du mur ; les planches du jeu, devant, le découpent. fenetres : world.json (side, x, y).
function lueursFenetres(fenetres, palette, render, taille = 72) {
  const group = new THREE.Group();
  group.name = 'lueurs-fenetres';
  const out = { nord: [0, -1], sud: [0, 1], est: [1, 0], ouest: [-1, 0] };
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.lampLight).multiplyScalar(0.75), side: THREE.FrontSide });
  const h = render.lintelBottom - render.sillHeight;
  for (const f of fenetres) {
    const n = out[f.side];
    if (!n) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(taille - 6, h - 2), mat);
    m.position.set(f.x - n[0] * 22, render.sillHeight + h / 2, f.y - n[1] * 22);
    m.lookAt(m.position.x + n[0], m.position.y, m.position.z + n[1]);
    group.add(m);
  }
  return group;
}

// world : monde du jeu ; stage : groupe de mise en scène ; heli : groupe de l'hélicoptère (foyers) ; lampes : [{ x, z, cap }] (repère de la scène).
export function creerAmbiance({ world, palette, textures, stage, heli, lampes = [], fenetres = [], render = null }) {
  const scene = world.scene;
  let ambient = null;
  let sun = null;
  scene.traverse((o) => {
    if (o.isAmbientLight) ambient = o;
    if (o.isDirectionalLight) sun = o;
  });
  ambient.intensity = REGLAGES.ambiante;
  // Clair de lune : la lumière du jeu, venue de derrière la scène (contre-jour : silhouettes découpées), ombres resserrées sur la scène.
  const centre = stage.localToWorld(new THREE.Vector3(0, 0, -40));
  const dirW = REGLAGES.luneDir.clone().transformDirection(stage.matrixWorld).normalize();
  sun.intensity = REGLAGES.lune;
  sun.position.copy(centre).add(dirW.clone().multiplyScalar(1600));
  sun.target.position.copy(centre);
  sun.target.updateMatrixWorld();
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 200, far: 3500 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.4;
  sun.shadow.map?.dispose();
  sun.shadow.map = null;

  const sky = ciel(palette);
  sky.position.copy(centre);
  scene.add(sky);
  const stars = etoiles(palette);
  stars.position.copy(centre);
  scene.add(stars);
  const moon = lune(palette);
  moon.position.copy(centre).add(dirW.clone().multiplyScalar(11000));
  moon.lookAt(centre);
  scene.add(moon);
  if (render) scene.add(lueursFenetres(fenetres, palette, render));
  // Lueur chaude de l'incendie sur l'horizon, du côté de l'hélicoptère.
  const toHeli = heli.userData.centre.clone().sub(centre).setY(0).normalize();
  sky.material.uniforms.uGlowDir.value.copy(toHeli);

  // Flammes de l'hélicoptère : deux lumières ponctuelles qui vacillent (déphasées).
  const fireCol = new THREE.Color(palette.fireEdge).lerp(new THREE.Color(palette.fire), 0.35);
  const feux = heli.userData.foyers.slice(0, 2).map((f, i) => {
    const l = new THREE.PointLight(fireCol, REGLAGES.feuHelico, 1600, 1.15);
    l.position.copy(f).add(new THREE.Vector3(0, 30, 0));
    l.castShadow = i === 0;
    if (l.castShadow) {
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.camera.near = 10;
      l.shadow.camera.far = 1600;
      l.shadow.bias = -0.002;
    }
    scene.add(l);
    return l;
  });

  // Lampes à huile sur piquets, avec leur lumière.
  const lampGroup = new THREE.Group();
  lampGroup.name = 'lampes-scene';
  // Lampes et piquets dans le repère de la scène (ils prennent son échelle, comme les personnages).
  stage.add(lampGroup);
  const lampData = lampes.map((L, i) => {
    const n = { x: Math.sin((L.cap * Math.PI) / 180), y: Math.cos((L.cap * Math.PI) / 180) };
    lampGroup.add(piquet(textures, L.x - n.x * 2.5, L.z - n.y * 2.5));
    return { id: `lampe-scene-${i}`, floor: 'rdc', support: 'mur', x: L.x, y: L.z, n, hauteur: 46 };
  });
  const lampMeshes = createLampMeshes({ groups: { rdc: lampGroup }, lamps: lampData, palette, floors: ['rdc'] });
  for (const mesh of lampMeshes.meshes) mesh.material.side = THREE.DoubleSide; // vues d'en bas : les dessous omis par le jeu ne laissent pas de trou
  lampMeshes.cull?.(null);
  const lampCol = new THREE.Color(palette.lampLight);
  const lampLights = lampData.map((l) => {
    const light = new THREE.PointLight(lampCol, REGLAGES.lampe, 600, 1.3);
    light.position.copy(stage.localToWorld(new THREE.Vector3(l.x + l.n.x * 15.5, l.hauteur + 12, l.y + l.n.y * 15.5)));
    scene.add(light);
    return light;
  });

  // Appoint chaud, hors champ, devant à gauche (une lampe posée au sol hors du cadre) : les visages ne sont pas que des silhouettes.
  const appoint = new THREE.PointLight(lampCol, REGLAGES.appoint, 900, 1.2);
  appoint.position.copy(stage.localToWorld(new THREE.Vector3(-80, 22, 120)));
  scene.add(appoint);

  return {
    sky,
    moon,
    feux,
    lampLights,
    update(t) {
      feux.forEach((l, i) => { l.intensity = REGLAGES.feuHelico * (1 + 0.16 * bruit(t, 30 + i, 5) + 0.06 * onde(t, 23, i * 0.3)); });
      appoint.intensity = REGLAGES.appoint * (1 + 0.06 * bruit(t, 50, 3));
      lampLights.forEach((l, i) => { l.intensity = REGLAGES.lampe * (1 + 0.07 * bruit(t, 40 + i, 3) + 0.03 * onde(t, 17, i * 0.4)); });
    },
  };
}
