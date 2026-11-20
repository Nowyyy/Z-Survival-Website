// Monde de la scène : le monde du jeu tel quel (copie figée scene/jeu/, js/game/world.js : sol, bâtiment « Nacht der Untoten »,
// décor extérieur, hélicoptère écrasé), construit comme dans js/game/main.js et js/game/game.js du jeu, sans la partie (ni zombies
// du jeu, ni joueur, ni interface). Les chemins des données partent de la page (scene/index.html) : préfixe « jeu/ ».
import { buildLayouts } from '../jeu/js/core/layout.js';
import { windowsWithGaps } from '../jeu/js/core/layout.js';
import { parseZones, zonesToWorld } from '../jeu/js/core/zones.js';
import { createWindowsState, windowGeometries } from '../jeu/js/core/windows.js';
import { createThreeTextures, generateTextureData } from '../jeu/js/game/textures.js';
import { createTokenLookup, readPalette } from '../jeu/js/game/palette.js';
import { buildWorld } from '../jeu/js/game/world.js';

const CARTE = 'jeu/data/game/maps/rez-de-chaussee';
export async function json(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} : ${r.status}`);
  return r.json();
}

// Données du jeu dont la scène a besoin (mêmes fichiers que le jeu).
export async function chargerDonnees() {
  const [world, decor, zones, etage, decorInterieur, mobilier, feux, render, texturesCfg, camera, windows, characters, poses, choix, variants, lampes, epoque, epoqueChoix] = await Promise.all([
    json(`${CARTE}/world.json`), json(`${CARTE}/decor.json`), json(`${CARTE}/zones.json`), json(`${CARTE}/etage.world.json`),
    json(`${CARTE}/decor-interieur.world.json`), json(`${CARTE}/mobilier.world.json`), json(`${CARTE}/feux.json`),
    json('jeu/data/game/render.json'), json('jeu/data/game/textures.json'), json('jeu/data/game/camera.json'), json('jeu/data/game/windows.json'),
    json('jeu/data/game/characters-v2.json'), json('jeu/data/game/poses-v2.json'), json('jeu/data/game/persos-choix.json'),
    json('jeu/data/game/zombie-variants.json'), json(`${CARTE}/lampes.world.json`),
    json('jeu/data/game/persos-epoque.json'), json('jeu/data/game/persos-epoque-choix.json'), // v2 : tenues d'époque du jeu (lot 9g du jeu)
  ]);
  // v2 : le décor extérieur d'époque du jeu (lot 9h du jeu : avion P-51 à la place de l'hélicoptère, jeeps à la place des voitures) n'est pas
  // encore pris par la scène : clé « epoque » retirée, comme le réglage ?test=1&decor=avant du jeu (js/game/main.js) : décor d'avant.
  delete decor.epoque;
  return { world, decor, zones, etage, decorInterieur, mobilier, feux, render, texturesCfg, camera, windows, characters, poses, choix, variants, lampes, epoque, epoqueChoix };
}

// Construit le monde du jeu. reduced : mouvement réduit (le jeu fige alors feux et brume).
export async function construireMonde(d, renderer, { reduced = false, sansHelico = false, degage = null, zonesLibres = [] } = {}) {
  const palette = readPalette();
  const lookup = createTokenLookup();
  const render = { ...d.render };
  render.decorInterieur = d.decorInterieur?.items ?? [];
  render.mobilier = d.mobilier?.pieces ?? null;
  render.ceilingWalls = render.ceilingWalls === true;
  render.detailDoors = true;
  render.seeThrough = null; // pas de mur percé : il n'y a pas de joueur à montrer à travers les murs
  render.feux = d.feux?.feux ?? [];
  render.reducedMotion = reduced;
  const textureData = await generateTextureData(d.texturesCfg.textures, { lookup, detail: true, sliceMs: 1e9 });
  const textures = createThreeTextures(textureData, renderer);
  const zones = zonesToWorld(parseZones(d.zones), d.world.transform);
  const layouts = buildLayouts({ rdc: { world: d.world, decor: d.decor }, etage: { world: d.etage }, zones }, { empty: false, slack: d.camera.slack });
  const layout = layouts.rdc;
  // La scène dessine son propre hélicoptère (agrandi, js/helico.js) : celui du jeu est retiré du décor avant la construction.
  const helico = layout.decor?.helicopter ?? null;
  if (sansHelico && layout.decor) layout.decor = { ...layout.decor, helicopter: null };
  // Décor dégagé entre les caméras et la scène (degage(x, y) vrai : retiré) : voitures, arbres, buissons, lampadaires, barrières du jeu.
  if (degage && layout.decor) {
    const centre = (o) => (Number.isFinite(o.w) ? [o.x + o.w / 2, o.y + (o.h ?? 0) / 2] : [o.x, o.y]);
    const keep = (list) => (Array.isArray(list) ? list.filter((o) => !degage(...centre(o))) : list);
    layout.decor = { ...layout.decor, cars: keep(layout.decor.cars), trees: keep(layout.decor.trees), bushes: keep(layout.decor.bushes), lamps: keep(layout.decor.lamps), fences: keep(layout.decor.fences) };
  }
  // Décor « vivant » du jeu (flaques, gravats, arbres morts…, js/core/decor-vivant.js) : rien dans les zones libres (rectangles { x, y, w, h }),
  // par la liste keepOut que le jeu utilise déjà pour les épaves.
  if (zonesLibres.length && layout.decor) layout.decor = { ...layout.decor, keepOut: [...(layout.decor.keepOut ?? []), ...zonesLibres] };
  const geoms = layouts.floors.flatMap((f) => windowGeometries(windowsWithGaps(layouts[f]), d.windows).map((g) => ({ ...g, floor: f })));
  const world = buildWorld({ palette, layout, layouts, render, textures, windowGeoms: geoms, windowsCfg: d.windows, seed: 1, closedDoors: (layouts.doors ?? []).map((x) => x.id), stairs: layouts.multi ? layouts.stairs : [] });
  // Planches clouées sur toutes les fenêtres (état de départ d'une partie).
  if (world.windowMeshes) world.windowMeshes.sync(createWindowsState(geoms, d.windows));
  world.showFloor('rdc');
  // Feux du jeu (caisses, bidons, voiture) : leurs particules avancent avec le temps de jeu, sans boucle. La scène les cache et
  // dessine ses propres feux en boucle (js/feu.js).
  world.scene.traverse((o) => { if (o.isGroup && /^feu-|^fumee-/.test(o.name)) o.visible = false; });
  return { world, palette, lookup, render, layout, layouts, textures, helico };
}
