/* ===================================================================
   src/world/CharacterFactory.ts

   CHARGE LES PERSONNAGES ET FABRIQUE LEURS INSTANCES.

   -------------------------------------------------------------------
   LA BIBLIOTHEQUE D'ANIMATIONS PARTAGEE
   -------------------------------------------------------------------
   Les animations sont dans un fichier SEPARE du personnage :

     models/characters/mannequin.glb    le corps, sans animation
     models/animations/anim_library.glb 14 animations, sans corps

   Au chargement, on prend les clips du second et on les joue sur le
   premier. Three.js branche chaque piste sur l'os portant le meme nom :
   tant que les personnages partagent le meme squelette, un seul jeu
   d'animations les anime tous.

   L'interet est economique. Ici : 110 Ko par personnage + 80 Ko une
   seule fois, au lieu de 464 Ko par personnage. Avec cinq suspects,
   630 Ko au lieu de 2,3 Mo.

   -------------------------------------------------------------------
   SkeletonUtils.clone, ET SURTOUT PAS object.clone()
   -------------------------------------------------------------------
   C'est l'erreur numero un avec les modeles animes dans Three.js.
   Un clone ordinaire copie les maillages mais les laisse pointer vers
   le squelette de l'ORIGINAL : les deux personnages partagent alors les
   memes os, et le second s'affiche en bouillie. SkeletonUtils.clone
   duplique aussi le squelette et refait les liens.
   =================================================================== */

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ModelLibrary } from '../core/Loaders';
import { Character } from './Character';

const CHARACTER_PATH = 'models/characters/mannequin.glb';
const ANIMATIONS_PATH = 'models/animations/anim_library.glb';

/** Taille visee, en metres. Un adulte. */
const TARGET_HEIGHT = 1.75;

/**
 * Direction vers laquelle le modele regarde au repos, dans son repere.
 * C'est une donnee propre a l'asset, comme son echelle : elle se constate,
 * elle ne se devine pas. Mesuree sur mannequin.glb.
 */
const MODEL_FORWARD = new THREE.Vector3(0, 0, 1);

export interface CharacterOptions {
  position: THREE.Vector3;
  /** Orientation en radians autour de l'axe vertical. */
  yaw?: number;
  /** Teinte appliquee, pour distinguer deux instances du meme modele. */
  tint?: THREE.ColorRepresentation;
}

export class CharacterFactory {
  private template: THREE.Object3D | null = null;
  private readonly clips = new Map<string, THREE.AnimationClip>();
  private scale = 1;

  /** Noms des clips disponibles, pour le rapport de chargement. */
  get clipNames(): string[] {
    return [...this.clips.keys()];
  }

  async load(models: ModelLibrary): Promise<void> {
    // Les deux fichiers sont independants : on les telecharge en parallele.
    const [character, animations] = await Promise.all([
      models.load(CHARACTER_PATH),
      models.load(ANIMATIONS_PATH),
    ]);

    this.template = character.scene;

    // LE POINT CLE : les clips viennent de l'AUTRE fichier.
    for (const clip of animations.animations) {
      this.clips.set(clip.name, clip);
    }

    // Mise a l'echelle : mesuree, pas supposee. Le mannequin fait 4,4 m
    // a l'import ; la meme mesure marchera pour n'importe quel modele.
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(this.template).getSize(size);
    this.scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;

    console.info(
      `[personnages] ${this.clips.size} animations chargees depuis ` +
        `${ANIMATIONS_PATH} : ${this.clipNames.join(', ')}`,
    );
    console.info(
      `[personnages] modele ${size.y.toFixed(2)} m a l'import, ` +
        `echelle x${this.scale.toFixed(3)} pour ${TARGET_HEIGHT} m`,
    );
  }

  /** Cree une instance independante du personnage. */
  create(id: string, options: CharacterOptions): Character {
    if (!this.template) {
      throw new Error('CharacterFactory.load() doit etre appele avant create()');
    }

    const root = cloneSkinned(this.template);
    root.name = id;
    root.scale.setScalar(this.scale);
    root.position.copy(options.position);
    root.rotation.y = options.yaw ?? 0;

    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      // Un personnage ne recoit pas d'ombre sur lui-meme : c'est peu
      // visible et cela coute une passe de rendu supplementaire.
      node.receiveShadow = false;
      if (options.tint !== undefined) node.material = tintMaterial(node.material, options.tint);
    });

    return new Character(id, root, this.clips, MODEL_FORWARD);
  }
}

/**
 * Duplique un materiau et le teinte.
 *
 * Le clone est indispensable : les instances issues d'un meme modele
 * partagent leurs materiaux, et teinter l'un teinterait l'autre.
 */
function tintMaterial(
  material: THREE.Material | THREE.Material[],
  tint: THREE.ColorRepresentation,
): THREE.Material | THREE.Material[] {
  const apply = (m: THREE.Material): THREE.Material => {
    const copy = m.clone();
    if ('color' in copy && copy.color instanceof THREE.Color) {
      copy.color.multiply(new THREE.Color(tint));
    }
    return copy;
  };
  return Array.isArray(material) ? material.map(apply) : apply(material);
}
