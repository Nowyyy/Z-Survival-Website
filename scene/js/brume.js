// Brume en boucle parfaite : les nappes de brume du jeu (copie figée, js/game/mist.js : même bruit, même masque autour du bâtiment,
// même couleur --game-fog) reçoivent un shader dont la dérive boucle sur DUREE : deux tirages du même bruit, décalés d'une boucle de
// vent, fondus l'un dans l'autre (au début et à la fin de la boucle, c'est exactement le même tirage).
import * as THREE from 'three';
import { DUREE } from './boucle.js';

const FRAGMENT = `
uniform sampler2D uMask;
uniform vec3 uColor;
uniform float uLoop;
uniform float uPeriod;
uniform float uStrength;
uniform float uScale;
uniform vec2 uWind;
uniform float uFloor;
uniform float uContrast;
varying vec2 vUv;
varying vec2 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
  return v;
}
float field(float tm) {
  vec2 p = vWorld / uScale + uWind * tm;
  return fbm(p + 0.35 * vec2(fbm(p * 0.7 + tm * 0.03), fbm(p * 0.7 - tm * 0.02)));
}
void main() {
  float m = texture2D(uMask, vUv).a;
  float n = mix(field(uLoop * uPeriod), field((uLoop - 1.0) * uPeriod), uLoop);
  float wisps = smoothstep(0.5 - uContrast, 0.5 + uContrast, n);
  float a = uStrength * m * mix(uFloor, 1.0, wisps);
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
}`;

// Remplace le shader des nappes du monde ; vitesse : multiplie la dérive du jeu (plus visible de près) ; force : opacité.
export function brumeEnBoucle(world, { vitesse = 3, force = 1, hauteurs = [5, 10] } = {}) {
  const nappes = [];
  world.scene.traverse((o) => {
    if (o.isMesh && o.material?.isShaderMaterial && o.material.uniforms?.uMask && o.material.uniforms?.uTime) nappes.push(o);
  });
  for (const o of nappes) {
    // Le « mur de brume » du jeu (nappe « brume », à 110 de haut) ferme la vue de dessus ; vu du sol c'est un plafond plat : retiré.
    if (o.name === 'brume') {
      o.visible = false;
      o.userData.retire = true;
      continue;
    }
    // Nappes du jeu à 14 et 46 de haut : la caméra basse (contre-plongée) passerait dessous. Elles sont abaissées au ras du sol.
    const rang = Number(/brume-basse-(\d+)/.exec(o.name)?.[1] ?? 1) - 1;
    const y0 = o.geometry.attributes.position.getY(0);
    if (Number.isFinite(hauteurs[rang])) o.position.y = hauteurs[rang] - y0;
    const u = o.material.uniforms;
    const mat = new THREE.ShaderMaterial({
      vertexShader: o.material.vertexShader,
      fragmentShader: FRAGMENT,
      uniforms: {
        uMask: u.uMask, uColor: u.uColor, uStrength: { value: u.uStrength.value * force }, uScale: u.uScale, uFloor: u.uFloor, uContrast: u.uContrast,
        uWind: { value: u.uWind.value.clone().multiplyScalar(vitesse) }, uLoop: { value: 0 }, uPeriod: { value: DUREE },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    o.material.dispose();
    o.material = mat;
  }
  const gardees = nappes.filter((o) => !o.userData.retire);
  return {
    nappes: gardees,
    update(t) {
      const f = (((t / DUREE) % 1) + 1) % 1;
      for (const o of gardees) o.material.uniforms.uLoop.value = f;
    },
  };
}
