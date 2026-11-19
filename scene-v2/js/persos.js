// Personnages de la scène v2 (lot 5a) : ceux du jeu (copie figée scene-v2/jeu/, js/game/character-v2.js, variante « riche » de la table des choix),
// construits par le kit du jeu. Les poses de la scène ne passent pas par les animations du jeu : chaque articulation est
// placée à la main (js/poses.js) ; on lit et on écrit directement les os (Bone) du personnage.
import * as THREE from 'three';
import { createV2Kit } from '../jeu/js/game/character-v2.js';

// d : données du jeu (chargerDonnees) ; lookup : jetons de couleur ; characters : données des personnages (éventuellement enrichies).
export function creerKit(d, lookup, characters, poses = d.poses) {
  const slots = { joueur: 'riche', marcheur: 'riche', petit: 'riche', voute: 'riche', grand: 'riche' };
  for (const [id, c] of Object.entries(d.choix?.persos ?? {})) if (c?.variante) slots[id] = c.variante;
  // Réglages de la table des choix (persos-choix.json), comme choiceOptions de js/game/persos-runtime.js du jeu ; la tenue est choisie par la scène.
  const table = d.choix?.persos ?? {};
  const of = (key) => Object.fromEntries(Object.entries(table).filter(([, c]) => c?.[key] !== undefined).map(([slot, c]) => [slot, c[key]]));
  const opts = { macros: of('macros'), animMacros: of('animation'), styleAnim: of('style') };
  // corps: null : le « corps long » du jeu (lot 9e du jeu : épaules à 9, bras × 1,2) n'est pas pris ; la scène garde les épaules d'avant (11,5)
  // et ses propres bras allongés (22, js/enrichissements.js, presque la longueur du corps long : 22,8) : ses poses de près en dépendent.
  // sansPistolet : l'ancien pistolet du joueur (deux boîtes) est retiré ; les armes du jeu sont accrochées à l'os « prop » (js/armes.js).
  return createV2Kit({ characters, poses, lookup, choice: 'riche', styleOf: slots, ...opts, zombieIds: d.variants.zombie.variants.map((v) => v.id), seed: 7, wear: () => 1, corps: null, sansPistolet: true });
}

// Personnage posable : { root, bones: Map(id -> Bone), rest: Map(id -> position de repos), char (personnage du kit) }.
export function posable(char, echelle = 1) {
  char.root.scale.multiplyScalar(echelle);
  const bones = new Map();
  char.root.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
  const rest = new Map([...bones].map(([id, b]) => [id, b.position.clone()]));
  // Tous les personnages de la scène portent leur ombre (le jeu ne l'a que par un proxy grossier).
  char.body.castShadow = true;
  char.body.receiveShadow = true;
  if (char.shadow) char.shadow.visible = false;
  char.body.frustumCulled = false;
  return {
    char,
    root: char.root,
    bones,
    rest,
    // Remet toutes les articulations au repos (angles nuls, positions d'origine, échelles 1).
    reset() {
      for (const [id, b] of bones) {
        b.quaternion.identity();
        b.position.copy(rest.get(id));
        b.scale.setScalar(1);
      }
    },
  };
}
