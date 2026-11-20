// Lot 6a — Rendu d'une arme du jeu pour la section Armes du site (page outils/armes/rendu.html, pilotée par fabriquer-visuels.mjs).
// Vrai modèle 3D du jeu (copie figée armes/jeu/ : pièces en code, atlas des matières, variante retenue par le propriétaire), posé debout
// (pose « caisse » du jeu sans être couché : arme entière, réservoirs du lance-flammes derrière la lance), vu de trois quarts côté droit
// (fenêtre d'éjection, levier), bouche vers la droite. Fond transparent. Éclairage dans l'ambiance du site : lumière principale chaude,
// contre-jour rouge sang (jeton --color-action du site), débouché froid et faible.
// Tout est déterministe (aucun hasard, aucune horloge) : même arme, même taille → même image.
import * as THREE from 'three';
import { geometrie, lirePalette } from '../../armes/jeu/js/armes/rendu.js';
import { genererAtlas } from '../../armes/jeu/js/core/armes/atlas.js';
import { armeParId, lireArmes, lireChoix, maillageArme, varianteDe } from '../../armes/jeu/js/core/armes/armes.js';

// Réglages de la vue (degrés) et de la lumière ; ROUGE = --color-action de css/base.css du site.
export const VUE = { lacet: 22, hauteur: 12, champ: 14, marge: 0.05 };
// Pose du modèle par arme : « caisse » (arme entière, comme posée dans la caisse du jeu, sans être couchée) ; le lance-flammes en « main » :
// réservoirs placés comme portés sur le dos, derrière la lance (en « caisse », ils sont alignés à plat derrière elle).
const POSES = { m2lanceflammes: 'main' };
const ROUGE = 0xd81414;

async function json(chemin) {
  const r = await fetch(chemin);
  if (!r.ok) throw new Error(`${chemin} : ${r.status}`);
  return r.json();
}

async function demarrer() {
  const donnees = lireArmes(await json('../../armes/jeu/data/armes/armes.json'));
  const choix = lireChoix(donnees, await json('../../armes/jeu/data/armes/armes-choix.json'));
  const atlasImg = genererAtlas(lirePalette());
  const atlas = new THREE.DataTexture(atlasImg.data, atlasImg.width, atlasImg.height, THREE.RGBAFormat);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.anisotropy = 8;
  atlas.needsUpdate = true;
  // Matière : l'atlas et les couleurs de sommet du jeu ; un peu de brillance pour accrocher les lumières (le jeu, vu de loin, est mat).
  const materiau = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.52, metalness: 0.28 });

  const toile = document.getElementById('toile');
  const rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true, preserveDrawingBuffer: true });
  rendu.setClearColor(0x000000, 0);
  rendu.outputColorSpace = THREE.SRGBColorSpace;
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = 1.35;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcfd6e0, 0x1a0606, 0.8));
  const cle = new THREE.DirectionalLight(0xfff0dc, 3.8); // principale : en haut, devant, à gauche de la caméra
  const contre = new THREE.DirectionalLight(ROUGE, 4.5); // contre-jour rouge : derrière, en haut à droite
  const debouche = new THREE.DirectionalLight(0x9fb8d8, 0.7); // débouché froid : en bas
  const face = new THREE.DirectionalLight(0xffe6cc, 1.1); // appoint de face, chaud
  scene.add(cle, contre, debouche, face, cle.target, contre.target, debouche.target, face.target);
  const camera = new THREE.PerspectiveCamera(VUE.champ, 2, 1, 10000);

  // Rend l'arme `id` à la taille l × h (pixels) dans la toile.
  function rendre(id, l, h) {
    const arme = armeParId(donnees, id);
    if (!arme) throw new Error(`arme inconnue : ${id}`);
    const v = varianteDe(arme, choix.variantes[id]);
    const m = maillageArme(donnees, arme, v, { pose: POSES[id] ?? 'caisse', echelle: 1 }); // en millimètres
    const g = geometrie(m);
    const maille = new THREE.Mesh(g, materiau);
    const centre = new THREE.Vector3(...[0, 1, 2].map((c) => (m.bornes.min[c] + m.bornes.max[c]) / 2));
    maille.position.copy(centre).negate();
    scene.add(maille);

    // Direction de la caméra : côté droit de l'arme (−x), un peu vers la bouche (+z) et au-dessus.
    const a = THREE.MathUtils.degToRad(VUE.lacet);
    const e = THREE.MathUtils.degToRad(VUE.hauteur);
    const dir = new THREE.Vector3(-Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).normalize();
    camera.aspect = l / h;
    const taille = Math.max(...[0, 1, 2].map((c) => m.bornes.max[c] - m.bornes.min[c]));
    let distance = taille * 3;
    const cible = new THREE.Vector3();
    // Part de l'image occupée : 1 pour les armes longues ; les armes courtes (Colt) un peu plus petites, pour garder une idée de leur taille.
    const part = Math.min(1, 0.6 + 0.4 * (arme.longueurReelle || 1000) / 1000);
    // Cadrage : l'arme remplit l'image (marge VUE.marge), centrée ; trois passes suffisent (perspective faible).
    const p = new THREE.Vector3();
    const pos = g.getAttribute('position');
    for (let passe = 0; passe < 4; passe += 1) {
      camera.position.copy(cible).addScaledVector(dir, distance);
      camera.up.set(0, 1, 0);
      camera.lookAt(cible);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
      for (let i = 0; i < pos.count; i += 1) {
        p.fromBufferAttribute(pos, i).sub(centre).project(camera);
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      }
      // Recentre (dans le plan de l'image), puis ajuste la distance pour remplir 1 − 2 × marge de l'image.
      const droite = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const haut = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const demiH = Math.tan(THREE.MathUtils.degToRad(VUE.champ / 2)) * distance;
      cible.addScaledVector(droite, ((x0 + x1) / 2) * demiH * camera.aspect).addScaledVector(haut, ((y0 + y1) / 2) * demiH);
      const remplissage = Math.max((x1 - x0) / 2, (y1 - y0) / 2);
      distance *= remplissage / ((1 - 2 * VUE.marge) * part);
    }
    camera.position.copy(cible).addScaledVector(dir, distance);
    camera.lookAt(cible);
    camera.near = distance / 20;
    camera.far = distance * 20;
    camera.updateProjectionMatrix();

    // Lumières attachées au cadre de la caméra (même éclairage pour toutes les armes).
    const droite = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const haut = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const place = (lumiere, d, x, y) => {
      lumiere.position.copy(cible).addScaledVector(dir, d * taille).addScaledVector(droite, x * taille).addScaledVector(haut, y * taille);
      lumiere.target.position.copy(cible);
    };
    place(cle, 1, -0.9, 1.4);
    place(contre, -1, 1.1, 0.9);
    place(debouche, 0.6, 0.4, -1.2);
    place(face, 1, 0.3, 0.2);

    rendu.setPixelRatio(1);
    rendu.setSize(l, h, false);
    rendu.render(scene, camera);
    scene.remove(maille);
    g.dispose();
  }

  // Réduit le dernier rendu à l × h (moitiés successives : réduction propre) et l'encode en WebP avec transparence (adresse data:).
  function encoder(l, h, qualite) {
    let source = toile;
    let sl = toile.width;
    let sh = toile.height;
    while (sl / 2 >= l) {
      const c = document.createElement('canvas');
      c.width = Math.round(sl / 2);
      c.height = Math.round(sh / 2);
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true;
      x.imageSmoothingQuality = 'high';
      x.drawImage(source, 0, 0, c.width, c.height);
      source = c;
      sl = c.width;
      sh = c.height;
    }
    const fin = document.createElement('canvas');
    fin.width = l;
    fin.height = h;
    const x = fin.getContext('2d');
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(source, 0, 0, l, h);
    return fin.toDataURL('image/webp', qualite);
  }

  window.__armes = { pret: true, ids: donnees.armes.map((x) => x.id), vue: VUE, poses: POSES, rendre, encoder, ecarts: [...donnees.ecarts, ...choix.ecarts] };
}

demarrer().catch((e) => { window.__armesErreur = String(e?.stack ?? e); });
