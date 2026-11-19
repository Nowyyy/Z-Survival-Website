// Armes de la scène v2 (lot 5a) : les modèles du jeu (lot 9c du jeu : js/core/armes/, data/armes/armes.json), construits par le code du
// jeu copié tel quel dans scene-v2/jeu/ (aucune retouche), avec la variante retenue par le propriétaire du jeu (data/armes/armes-choix.json)
// et l'atlas commun des armes (généré en code, couleurs --arm-* de css/armes.css). Personnage 1 : Kar98k ; personnage 2 : Colt M1911.
// Différences avec la partie (vue de dessus, de loin) : pas d'élargissement « vue de dessus » (echelle.largeur, enJeu) : la scène est vue de
// près ; tout le reste (tailles, épaisseurs, pièces, verrou animé, bretelle déviée de la pose de tenue) vient du jeu.
// Repère d'une arme (unités du jeu, celles du personnage) : +z vers la bouche, +y vers le haut, +x la gauche du tireur.
import * as THREE from 'three';
import { armeParId, avecEchelle, echelleJeu, lireArmes, lireChoix, maillageArme, varianteDe } from '../jeu/js/core/armes/armes.js';
import { genererAtlas } from '../jeu/js/core/armes/atlas.js';
import { paletteArmes } from '../jeu/js/core/armes/partie.js';
import { json } from './monde.js';

async function texte(chemin) {
  const r = await fetch(chemin);
  if (!r.ok) throw new Error(`${chemin} : ${r.status}`);
  return r.text();
}

// Données des armes : { donnees, choix, poses (data/armes/poses.json), partie (data/game/armes-partie.json), palette }.
export async function chargerArmes() {
  const [armesJson, choixJson, poses, partie, css] = await Promise.all([
    json('jeu/data/armes/armes.json'), json('jeu/data/armes/armes-choix.json'), json('jeu/data/armes/poses.json'),
    json('jeu/data/game/armes-partie.json'), texte('jeu/css/armes.css'),
  ]);
  const base = lireArmes(armesJson);
  const choix = lireChoix(base, choixJson);
  return { donnees: avecEchelle(base, choix.echelle), choix, poses, partie, palette: paletteArmes(css) };
}

// Bout du canon (repère de l'arme) : le point le plus avancé près de l'axe (même règle que pointeCanon du jeu, js/core/armes/tenue-jeu.js).
function pointe(positions) {
  let best = [0, 0, 0];
  for (let i = 0; i + 2 < positions.length; i += 3) {
    if (Math.abs(positions[i + 1]) > 4 || Math.abs(positions[i]) > 4) continue;
    if (positions[i + 2] > best[2]) best = [positions[i], positions[i + 1], positions[i + 2]];
  }
  return new THREE.Vector3(...best);
}

function geometrie(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
  g.computeBoundingSphere();
  return g;
}

// Fabrique des armes : creer(id) → { id, group (à accrocher à l'os « prop »), pointe (bout du canon), prises { droite, gauche, crosse }
// (points du jeu, mm → unités), verrou (Kar98k : { mesh, axe, angle, course, levier }, sinon null), manoeuvre (clés du jeu, ou null) }.
export function creerFabriqueArmes(armes, renderer) {
  const img = genererAtlas(armes.palette);
  const atlas = new THREE.DataTexture(img.data, img.width, img.height, THREE.RGBAFormat);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  atlas.needsUpdate = true;
  // Matière : celle du jeu (Lambert, atlas et couleurs de sommet).
  const materiau = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
  return {
    materiau,
    creer(id) {
      const { donnees, choix, poses, partie } = armes;
      const arme = armeParId(donnees, id);
      if (!arme) throw new Error(`arme absente du jeu : ${id}`);
      const v = varianteDe(arme, choix.variantes?.[id]);
      const bretelle = poses?.armes?.[id]?.modes?.['deux-mains']?.arme?.bretelle; // bretelle déviée contre le bras (pose de tenue du jeu)
      const opts = { pose: 'main', ...(Array.isArray(bretelle) ? { bretelle } : {}) };
      const entiere = maillageArme(donnees, arme, v, opts);
      const mv = maillageArme(donnees, arme, v, { ...opts, verrou: true });
      const avecVerrou = mv.positions.length > 0;
      const group = new THREE.Group();
      group.name = `arme-${id}`;
      const corps = new THREE.Mesh(geometrie(avecVerrou ? maillageArme(donnees, arme, v, { ...opts, verrou: 'sans' }) : entiere), materiau);
      corps.castShadow = true;
      corps.receiveShadow = true;
      group.add(corps);
      const k = echelleJeu(donnees, arme); // unités du jeu par millimètre
      const mm = (p) => (Array.isArray(p) ? new THREE.Vector3(p[0] * k, p[1] * k, p[2] * k) : null);
      const table = partie?.armes?.[id] ?? {};
      let verrou = null;
      if (avecVerrou) {
        // Verrou (Kar98k) : maillage enfant, levier relevé autour de l'axe de la culasse, culasse tirée en arrière (comme js/game/character-v2.js).
        const mesh = new THREE.Mesh(geometrie(mv), materiau);
        mesh.castShadow = true;
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
        const lev = table.levier ?? {};
        verrou = {
          mesh,
          axe: mm(lev.verrou?.axe ?? [0, 32, 0]),
          angle: ((lev.verrou?.angle ?? -80) * Math.PI) / 180,
          course: lev.course ?? 6,
          levier: mm(lev.pos ?? [-58, -3, -45]), // boule du levier, verrou fermé
          poser(lift, back) {
            const m = new THREE.Matrix4().makeTranslation(0, 0, -this.course * back);
            m.multiply(new THREE.Matrix4().makeTranslation(this.axe.x, this.axe.y, this.axe.z));
            m.multiply(new THREE.Matrix4().makeRotationZ(this.angle * lift));
            m.multiply(new THREE.Matrix4().makeTranslation(-this.axe.x, -this.axe.y, -this.axe.z));
            this.mesh.matrix.copy(m);
            this.mesh.matrixWorldNeedsUpdate = true;
          },
          // Boule du levier (repère de l'arme) pour un état du verrou.
          boule(lift, back, out = new THREE.Vector3()) {
            const r = this.levier.clone().sub(this.axe);
            const a = this.angle * lift;
            out.set(this.axe.x + r.x * Math.cos(a) - r.y * Math.sin(a), this.axe.y + r.x * Math.sin(a) + r.y * Math.cos(a), this.levier.z - this.course * back);
            return out;
          },
        };
        verrou.poser(0, 0);
      }
      return {
        id,
        nom: arme.nom,
        variante: v.id,
        group,
        corps,
        pointe: pointe(entiere.positions),
        bornes: entiere.bornes,
        prises: { droite: mm(arme.prises.droite), gauche: mm(arme.prises.gauche), crosse: mm(arme.prises.crosse) },
        verrou,
        manoeuvre: table.manoeuvre ?? null,
        douille: table.douille ?? [1, 1, 2.4],
        triangles: entiere.triangles,
      };
    },
  };
}
