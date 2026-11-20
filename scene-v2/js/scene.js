// Scène v2 de l'accueil (lot 5a), en coulisses : point d'entrée de scene-v2/index.html. Même mise en scène que la v1 (scene/, lot 1), avec la
// copie fraîche du jeu (scene-v2/jeu/) et ses nouvelles armes : Kar98k pour le personnage 1, Colt M1911 pour le personnage 2 (js/armes.js).
// (v1) Scène de l'accueil (lot 1) : point d'entrée de scene/index.html.
// Paramètres : ?cadrage=A|B|C (caméra), ?format=paysage|portrait (cadre 16:9 ou 9:16), ?t=secondes (image fixe à cet instant),
// ?capture=1&w=…&h=… (rendu à une taille exacte, pour la planche), ?fps=1 (compteur d'images par seconde).
// Mouvement réduit (prefers-reduced-motion) : image fixe.
import * as THREE from 'three';
import { creerAmbiance } from './ambiance.js';
import { DUREE } from './boucle.js';
import { brumeEnBoucle } from './brume.js';
import { CADRAGES, FORMATS } from './cadrages.js';
import { MILITAIRE, enrichirPersonnages, enrichirPoses, peindreBarbe, texturerGilet, texturesFines } from './enrichissements.js';
import { creerFeu } from './feu.js';
import { creerHelico } from './helico.js';
import { creerAvion } from './avion.js';
import { GLISSIERE, TIR, TIR_P2, creerTir, ejectionKar, finManoeuvre, glissiereAt, manoeuvreAt } from './tir.js';
import { chargerArmes, creerFabriqueArmes } from './armes.js';
import { chargerDonnees, construireMonde } from './monde.js';
import { creerKit, posable } from './persos.js';
import { slotsWithEpoch } from '../jeu/js/core/persos-variants.js';
import { ATELIER, DETAILS, ECHELLE_SCENE, FUSIL, PLACEMENT, PRISES, REGARD, TIREUR, regardP1, appuiAt, poseP1, poseP2, poseZombie } from './poses.js';

const q = new URLSearchParams(location.search);
const etat = document.getElementById('etat');
const toile = document.getElementById('toile');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Détails (retours du propriétaire, validés : scène des vidéos de l'accueil) : rotor de queue qui tourne, tôle de l'hélicoptère, flamme des
// lampes, regards des personnages, tir du personnage 2 sur le zombie, barbe, gilets texturés. ?details=0 : l'ancienne scène, pour comparer.
const details = q.get('details') !== '0';
// v2 : personnage 1 gaucher, visant à droite de l'écran (retour du propriétaire) ; ?tireur=droitier : épaule droite, visée à gauche.
TIREUR.gaucher = q.get('tireur') !== 'droitier';
DETAILS.actif = details;
const cadrage = CADRAGES[(q.get('cadrage') ?? 'B').toUpperCase()] ? (q.get('cadrage') ?? 'B').toUpperCase() : 'B'; // B : cadrage retenu (retours du lot 1)
// format=plein : la fenêtre entière, comme le serait la vidéo plein écran de l'accueil (réglage paysage ou portrait selon la fenêtre,
// même champ horizontal que l'image de référence 16:9 ou 9:16, jamais de bande noire). Sert à l'aperçu (apercu.html).
const plein = q.get('format') === 'plein';
let format = FORMATS[q.get('format')] ? q.get('format') : 'paysage';
const capture = q.get('capture') === '1';
const nums = (s, def) => (s ? s.split(',').map(Number) : def);

try {
  const renderer = new THREE.WebGLRenderer({ canvas: toile, antialias: true, preserveDrawingBuffer: capture });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const d = await chargerDonnees();
  // Groupe de mise en scène : origine au sol, dans la cour du bâtiment, au nord-est de l'hélicoptère ; +z vers la caméra.
  const [sx, sz, syaw] = nums(q.get('stage'), [2000, 1180, 185]);
  const stage = new THREE.Group();
  stage.position.set(sx, 0, sz);
  stage.rotation.y = (syaw * Math.PI) / 180;
  stage.scale.setScalar(ECHELLE_SCENE);
  stage.updateMatrixWorld(true);
  // Le décor du jeu qui gênerait une des caméras (entre elle et la scène) est retiré.
  const couloirs = Object.values(CADRAGES).flatMap((c) => [c.paysage, c.portrait]).map((v) => [stage.localToWorld(new THREE.Vector3(...v.cam)), stage.localToWorld(new THREE.Vector3(0, 0, -60))]);
  const degage = (x, y) => couloirs.some(([a, b]) => {
    const ab = new THREE.Vector2(b.x - a.x, b.z - a.z);
    const ap = new THREE.Vector2(x - a.x, y - a.z);
    const k = Math.max(0, Math.min(1, ap.dot(ab) / ab.lengthSq()));
    return ap.sub(ab.multiplyScalar(k)).length() < 170;
  });
  const zonesLibres = couloirs.map(([a, b]) => ({ x: Math.min(a.x, b.x) - 60, y: Math.min(a.z, b.z) - 60, w: Math.abs(a.x - b.x) + 120, h: Math.abs(a.z - b.z) + 120 }));
  const m = await construireMonde(d, renderer, { reduced, sansHelico: true, degage, zonesLibres });
  const { world, palette, textures } = m;
  const scene = world.scene;
  scene.add(stage);

  // Hélicoptère agrandi, à la place de celui du jeu, et son incendie.
  // v2 : décor d'époque du jeu : l'avion écrasé (agrandi, en flammes) à la place de l'hélicoptère ; ?decor=avant : l'hélicoptère.
  const heli = m.avion ? creerAvion({ epoque: m.epoque, avion: m.avion, lookup: m.lookup, floor: m.layout.floor, palette, textures, renderer, lacet: q.get('avionlacet') !== null ? Number(q.get('avionlacet')) : null, aile: stage.localToWorld(new THREE.Vector3(...nums(q.get('aile'), [-70, 0, -130]))) }) : creerHelico({ heli: m.helico, floor: m.layout.floor, palette, textures, details, renderer });
  scene.add(heli);
  const feuHelico = creerFeu({ foyers: heli.userData.foyers, spread: 16, scale: 1.1, palette, flames: 140, smoke: 90, seed: 3, wind: new THREE.Vector3(34, 0, 0), smokeColor: palette.smokeLight, smokeAlpha: 0.26 });
  scene.add(feuHelico.group);

  // Personnages : ceux du jeu, enrichis pour le plan rapproché (js/enrichissements.js).
  // v2 : tenues d'époque du jeu (lot 9g du jeu : data/game/persos-epoque.json, choix dans persos-epoque-choix.json), construites par le code du jeu
  // (slotsWithEpoch, niveau complet) : personnage 1 = Survivant (fantassin américain de 1942), personnage 2 = personnage 2 du jeu (parachutiste
  // radio), chacun dans la tenue retenue dans le jeu ; zombie = zombie soldat du marcheur (le jeu mélange les variantes A et B : la scène en montre
  // une, ?zbtenue=variante:tenue pour en essayer une autre). ?tenues=avant : les tenues de la première v2 (survivant tactique, militaire, blouse).
  const avant = q.get('tenues') === 'avant';
  const choixEpoque = d.epoqueChoix?.choix ?? {};
  const premier = (v) => (Array.isArray(v) ? v[0] : v);
  const [zbVariante, zbTenue] = (q.get('zbtenue') ?? `${premier(choixEpoque.marcheur) ?? 'epoque-A'}:soldat`).split(':');
  const EPOQUE = { p1: choixEpoque.survivant ?? 'epoque-A', p2: choixEpoque['personnage-2'] ?? 'para-B', zombie: zbVariante };
  const characters = avant ? d.characters : { ...d.characters, slots: slotsWithEpoch(d.characters.slots, d.epoque) };
  const kit = creerKit(d, m.lookup, enrichirPersonnages(characters, { p1: avant ? 'riche' : EPOQUE.p1 }), enrichirPoses(d.poses), avant ? { joueur: 'riche', marcheur: 'riche' } : { joueur: EPOQUE.p1, marcheur: EPOQUE.zombie });
  const tenue = (slot, variante, id) => Math.max(0, characters.slots.find((x) => x.id === slot)?.variants.find((v) => v.id === variante)?.outfits?.findIndex((o) => o.id === id) ?? 0);
  const tenues = d.epoqueChoix?.tenues ?? {};
  if (avant) texturesFines(kit, [['joueur', 'riche'], ['joueur', MILITAIRE], ['marcheur', 'riche']]);
  else texturesFines(kit, [['joueur', EPOQUE.p1], ['joueur', EPOQUE.p2], ['marcheur', EPOQUE.zombie]], { adoucir: q.get('trame') !== 'jeu' }); // ?trame=jeu : trame du jeu
  const p1 = posable(kit.create('player', 0, avant ? { choice: 'riche', outfit: 0 } : { choice: EPOQUE.p1, outfit: tenue('joueur', EPOQUE.p1, tenues.survivant) }), ECHELLE_SCENE);
  // Personnage 2. Première v2 (?tenues=avant) : militaire construit dans la scène (?p2=civil : variante B du jeu).
  const p2opts = avant ? (q.get('p2') === 'civil' ? { choice: 'B', outfit: 0 } : { choice: MILITAIRE, outfit: 0 }) : { choice: EPOQUE.p2, outfit: tenue('joueur', EPOQUE.p2, tenues['personnage-2']) };
  const p2 = posable(kit.create('player', 0, p2opts), ECHELLE_SCENE);
  PLACEMENT.p1Tete = p1.bones.get('head'); // le personnage 2 lève la tête vers lui (détails)
  // Barbe du personnage 1 (peinte, aucune pièce 3D) : brun très sombre, mélange de --perso-sombre et --perso-cuir.
  if (details) {
    const lin = (tok) => new THREE.Color().setRGB(...m.lookup(tok).map((c) => c / 255), THREE.SRGBColorSpace);
    const brun = lin('--perso-sombre').lerp(lin('--perso-cuir'), 0.25).multiplyScalar(0.7);
    peindreBarbe(p1.char, [brun.r, brun.g, brun.b]);
    // Gilets : texture de tissu à part (toile matelassée pour le personnage 1, nylon à sangles pour le personnage 2), plus celle des vêtements.
    // Personnage 1 : gilet d'une couleur à lui (il avait celle de la chemise sable) : noir (assombri de --perso-sombre) ; ?gilet=olive pour comparer.
    const couleurGilet = q.get('gilet') === 'olive' ? lin('--perso-tissu-olive').lerp(lin('--perso-sombre'), 0.45) : lin('--perso-sombre').multiplyScalar(0.6);
    // (Gilets : tenues de la première v2 seulement ; les tenues d'époque gardent les textures du jeu.)
    if (avant) texturerGilet(p1.char, kit.slotKit('joueur', 'riche').shared.get(0), ['vestA'], { style: 'toile', couleur: [couleurGilet.r, couleurGilet.g, couleurGilet.b] });
    if (avant && q.get('p2') !== 'civil') texturerGilet(p2.char, kit.slotKit('joueur', MILITAIRE).shared.get(0), ['gilet'], { style: 'cordura', teinte: 1 });
  }
  // Armes du jeu (lot 9c du jeu), accrochées à l'os « prop » de chaque personnage : le Kar98k (personnage 1), le Colt M1911 (personnage 2).
  const fabrique = creerFabriqueArmes(await chargerArmes(), renderer);
  const kar = fabrique.creer('kar98k');
  const colt = fabrique.creer('m1911');
  p1.bones.get('prop').add(kar.group);
  REGARD.debutP1 = TIR + finManoeuvre(kar) + REGARD.apresVerrou; // coup d'œil du personnage 1 après le réarmement
  p2.bones.get('prop').add(colt.group);
  const zb = posable(kit.create('zombie', 0, avant ? { outfit: 3, wear: 2 } : { outfit: tenue('marcheur', EPOQUE.zombie, zbTenue), wear: 2 }), ECHELLE_SCENE);
  zb.char.setWound(1);
  for (const p of [p1, p2, zb]) scene.add(p.root);
  // Outil de retouche (?isoler=p1|p2|zb) : un seul personnage visible.
  if (q.get('isoler')) for (const [id, p] of Object.entries({ p1, p2, zb })) p.root.visible = q.get('isoler').split(',').includes(id);

  // Coup de feu du personnage 1 (un par boucle).
  const laiton = new THREE.Color().setRGB(...m.lookup('--perso-casque').map((c) => c / 255), THREE.SRGBColorSpace);
  // Colt (personnage 2, plus bas) : sa douille part vers le bord droit de l'image, tout proche (retour du propriétaire : elle traversait
  // l'image vers la gauche). Kar98k : éclair un peu plus grand ; la douille sort de la fenêtre d'éjection quand la culasse est tirée (manœuvre du verrou).
  const tir = creerTir({ palette, laiton, echelle: ECHELLE_SCENE, arme: kar, ejection: ejectionKar(kar), fenetre: new THREE.Vector3(-0.7, 1.1, -2.2), force: 1.15, camera: () => window.__plan ?? camera, vol: { cote: 180, haut: 70 } });
  scene.add(tir.group);
  // Détails : coup de feu du personnage 2 sur le zombie (TIR_P2).
  const tir2 = details ? creerTir({ palette, laiton, echelle: ECHELLE_SCENE, instant: TIR_P2, lumiereMax: 1100, arme: colt, ejection: GLISSIERE.recul, fenetre: new THREE.Vector3(-0.6, 1.9, 0.6), force: 0.8, camera: () => window.__plan ?? camera, vol: { cote: 250, haut: 120, ecran: 1 } }) : null; // canon vers le bas, tout près de lui : éclat plus faible
  if (tir2) scene.add(tir2.group);

  // Lampe frontale du personnage 2 (variante B du jeu) : un faisceau faible vers la tête du zombie.
  const frontale = new THREE.SpotLight(new THREE.Color().setRGB(...m.lookup('--perso-lampe').map((c) => c / 255), THREE.SRGBColorSpace), 900, 420, 0.38, 0.6, 1.2);
  scene.add(frontale, frontale.target);
  // v2, tenues d'époque : le personnage 2 (parachutiste radio) n'a plus de lampe ; ?frontale=1 la garde (éclairage du zombie).
  if (!avant && q.get('frontale') !== '1') frontale.intensity = 0;

  const ambiance = creerAmbiance({ world, palette, textures, stage, heli, lampes: [{ x: -96, z: -64, cap: 30 }, { x: 104, z: -118, cap: -35 }], fenetres: d.world.windows ?? [], render: m.render, details });
  const brume = brumeEnBoucle(world, { vitesse: 3, force: 1.3 });

  const camera = new THREE.PerspectiveCamera(40, FORMATS[format], 2, 40000);
  const PLACEMENT_BASE = { p1: { ...PLACEMENT.p1 }, zombie: { ...PLACEMENT.zombie }, spectateur: PLACEMENT.spectateur.clone(), p1Vise: PLACEMENT.p1Vise.clone() };
  function placerCamera() {
    if (plein) format = innerWidth < innerHeight ? 'portrait' : 'paysage';
    const c = CADRAGES[cadrage][format];
    // Placement des personnages propre au format (ordinateur : écartés de part et d'autre du titre), sinon celui de poses.js.
    const pl = c.placement ?? {};
    const xz = (v, def) => (v ? (([x, z]) => ({ x, z }))(nums(v)) : def);
    Object.assign(PLACEMENT.p1, PLACEMENT_BASE.p1, pl.p1 ?? {}, xz(q.get('p1'), {}));
    Object.assign(PLACEMENT.zombie, PLACEMENT_BASE.zombie, pl.zombie ?? {}, xz(q.get('zb'), {}));
    // Atelier : point visé par le personnage 1 (?p1vise=x,y,z, repère de la scène).
    PLACEMENT.p1Vise.copy(PLACEMENT_BASE.p1Vise);
    // v2 : orientation et point visé propres au tireur et au format (l'éclair du Kar98k reste dans l'image), js/cadrages.js.
    const tireur = TIREUR.gaucher ? 'gaucher' : 'droitier';
    if (pl.p1Cap?.[tireur] !== undefined) PLACEMENT.p1.cap = pl.p1Cap[tireur];
    if (pl.p1Vise?.[tireur]) PLACEMENT.p1Vise.set(...pl.p1Vise[tireur]);
    if (q.get('p1vise')) PLACEMENT.p1Vise.set(...nums(q.get('p1vise')));
    // Le zombie, et le personnage 2 qui le cloue au sol, sont tournés vers le personnage 1, comme si le zombie rampait vers lui ; il tend
    // le bras vers le personnage 1 (retenu par le propriétaire). ?zombie=face : l'ancienne orientation (vers la caméra), pour comparer.
    PLACEMENT.attrapeDevant = false;
    if (q.get('zombie') !== 'face') {
      const p1 = PLACEMENT.p1;
      const z = PLACEMENT.zombie;
      z.cap = (Math.atan2(p1.x - z.x, p1.z - z.z) * 180) / Math.PI;
      PLACEMENT.attrapeDevant = true;
    }
    const cam = nums(q.get('cam'), c.cam);
    const vise = nums(q.get('vise'), c.vise);
    camera.fov = Number(q.get('fov') ?? c.fov);
    // Plein écran : on garde toujours le champ horizontal du cadrage (personnages entiers en largeur) ; une fenêtre plus étroite que
    // l'image de référence (téléphones récents, environ 9:19,5) montre plus de ciel et de sol, une fenêtre plus large en montre moins.
    const ref = FORMATS[format];
    const asp = innerWidth / innerHeight;
    if (plein) camera.fov = (2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * (ref / asp)) * 180) / Math.PI;
    camera.position.copy(stage.localToWorld(new THREE.Vector3(...cam)));
    camera.lookAt(stage.localToWorld(new THREE.Vector3(...vise)));
    camera.updateProjectionMatrix();
    world.setFog(camera.position.distanceTo(stage.localToWorld(new THREE.Vector3(...vise))) * 1.6);
  }

  // Taille du cadre : au format demandé, le plus grand possible dans la fenêtre (bandes noires autour).
  function taille() {
    const ratio = FORMATS[format];
    let w;
    let h;
    if (capture && q.get('w')) {
      w = Number(q.get('w'));
      h = Number(q.get('h') ?? Math.round(w / ratio));
      renderer.setPixelRatio(1);
    } else if (plein) {
      w = innerWidth;
      h = innerHeight;
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    } else {
      w = innerWidth;
      h = innerHeight;
      if (w / h > ratio) w = Math.round(h * ratio);
      else h = Math.round(w / ratio);
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    }
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function poser(t) {
    const appui = appuiAt(t);
    poseP1(p1, stage, t, kar);
    poseZombie(zb, stage, t, appui);
    zb.root.updateMatrixWorld(true);
    poseP2(p2, zb, stage, t, appui, colt);
  }
  function dessiner(t) {
    const u = ((t % DUREE) + DUREE) % DUREE;
    poser(u);
    feuHelico.update(u);
    tir.update(u, p1.bones.get('prop'), ECHELLE_SCENE);
    tir2?.update(u, p2.bones.get('prop'), ECHELLE_SCENE);
    colt.glissiere?.poser(details ? glissiereAt(u, TIR_P2) : 0); // glissière du Colt qui recule au tir
    // Rotor de queue : un tour par boucle (au ralenti), boucle parfaite.
    if (heli.userData.rotor) heli.userData.rotor.pivot.quaternion.setFromAxisAngle(heli.userData.rotor.axe, (2 * Math.PI * u) / DUREE);
    p2.bones.get('head').localToWorld(q.get('p2') === 'civil' ? frontale.position.set(0, 7, 5) : frontale.position.set(-5.2, 7.3, 2.4)); // lampe frontale ou lampe du casque
    zb.bones.get('head').getWorldPosition(frontale.target.position);
    ambiance.update(u);
    brume.update(u);
    renderer.render(scene, window.__plan ?? camera);
  }

  placerCamera();
  taille();
  // Outil de mise en place (?plan=x0,z0,x1,z1) : vue de dessus orthographique du monde, la scène et la caméra marquées.
  if (q.get('plan')) {
    const [x0, z0, x1, z1] = nums(q.get('plan'));
    const ortho = new THREE.OrthographicCamera(x0, x1, -z0, -z1, 1, 5000);
    ortho.position.set(0, 3000, 0);
    ortho.up.set(0, 0, -1);
    ortho.lookAt(0, 0, 0);
    ortho.left = x0; ortho.right = x1; ortho.top = -z0; ortho.bottom = -z1;
    ortho.updateProjectionMatrix();
    const mark = (v, c) => { const s2 = new THREE.Mesh(new THREE.SphereGeometry(18), new THREE.MeshBasicMaterial({ color: c, fog: false })); s2.position.copy(v).setY(400); scene.add(s2); };
    mark(stage.position, 0xff0000);
    mark(camera.position, 0x00ff00);
    mark(camera.position.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(300)), 0x0088ff);
    scene.fog.near = 1e6; scene.fog.far = 2e6;
    Object.assign(camera, {});
    window.__plan = ortho;
  }
  addEventListener('resize', () => {
    placerCamera();
    taille();
    dessiner(tNow);
  });
  // Les matières sont compilées avant la première image.
  renderer.compile(scene, camera);

  const fixe = q.get('t') !== null ? Number(q.get('t')) : reduced ? 0 : null;
  let tNow = fixe ?? 0;
  const fps = { frames: 0, since: performance.now(), value: 0 };
  const badge = q.get('fps') === '1' ? etat : null;
  dessiner(tNow);
  if (fixe === null && !capture) {
    const t0 = performance.now();
    const loop = (now) => {
      tNow = ((((now - t0) / 1000) % DUREE) + DUREE) % DUREE; // l'horodatage de la 1re image peut précéder t0 : jamais négatif
      dessiner(tNow);
      fps.frames += 1;
      if (now - fps.since >= 1000) {
        fps.value = (fps.frames * 1000) / (now - fps.since);
        fps.frames = 0;
        fps.since = now;
        if (badge) badge.textContent = `${fps.value.toFixed(1)} images/s`;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  etat.hidden = badge === null;
  if (badge) badge.textContent = '…';
  window.__scene = {
    ready: true,
    duree: DUREE,
    cadrage,
    format,
    // Rendu à l'instant t (secondes de la boucle), puis image du cadre (type : image/png ou image/webp).
    image(t, type = 'image/webp', qualite = 0.9) {
      tNow = t;
      dessiner(t);
      return toile.toDataURL(type, qualite);
    },
    rendre(t) {
      tNow = t;
      dessiner(t);
    },
    // Temps de la boucle de l'image affichée, et instant du coup de feu (aperçu : flash du cadre de l'accueil).
    temps: () => tNow,
    tir: TIR,
    tirs: details ? [TIR, TIR_P2] : [TIR], // détails : le tir du personnage 2 fait aussi flasher le cadre
    fps: () => fps.value,
    // v2 (contrôle, scene-v2/outils/verifier.mjs) : éclair visible au canon de chaque tireur [personnage 1, personnage 2] à l'image affichée.
    eclairs: () => [tir, tir2].map((x) => Boolean(x?.group.children[0].visible)),
    atelier: { p1, p2, zb, stage, THREE, kar, colt, ATELIER, FUSIL, PRISES, manoeuvreAt, tir, tir2, camera, regardP1 },
    armes: { p1: { id: kar.id, nom: kar.nom, variante: kar.variante, triangles: kar.triangles }, p2: { id: colt.id, nom: colt.nom, variante: colt.variante, triangles: colt.triangles } },
    decor: { avion: Boolean(m.avion), retiresEpoque: m.retiresEpoque ?? [] },
    info: () => ({ cadrage, format, duree: DUREE, taille: [toile.width, toile.height], triangles: renderer.info.render.triangles, appels: renderer.info.render.calls }),
  };
} catch (e) {
  etat.textContent = `Erreur : ${e.message}`;
  window.__sceneError = String(e?.stack ?? e);
  throw e;
}
