/* ===================================================================
   src/world/collision.ts

   Construit LA GEOMETRIE DE COLLISION d'un lieu : une seule forme,
   invisible, contre laquelle le joueur sera teste.

   Principe, valable aussi pour les vrais decors GLB a venir :
   on ne teste JAMAIS le joueur contre le decor visible (des dizaines
   de milliers de triangles, avec des details inutiles comme les
   moulures ou les pieds de chaise). On assemble une version
   simplifiee, et on ne la dessine pas.

   Un objet participe aux collisions s'il porte le marqueur :
       mesh.userData.collision = true

   Plus tard, avec les decors importes, ce marqueur sera pose
   automatiquement sur le maillage nomme "collision" du fichier GLB.
   =================================================================== */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Parcourt une scene et fusionne tous les maillages marques en UNE seule
 * geometrie exprimee en coordonnees du monde.
 *
 * Fusionner est important : cela donne un seul arbre de recherche (BVH)
 * au lieu d'un par objet, donc un test de collision nettement plus rapide.
 */
export function buildCollisionGeometry(root: THREE.Object3D): THREE.BufferGeometry {
  // Indispensable : sans cela les objets ajoutes recemment n'ont pas encore
  // de matrice monde a jour, et la collision serait decalee.
  root.updateMatrixWorld(true);

  const parts: THREE.BufferGeometry[] = [];

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.userData.collision !== true) return;

    // toNonIndexed() garantit que toutes les geometries ont la meme
    // structure : sans cela, fusionner un modele indexe avec un modele
    // non indexe echoue. C'est une precaution pour les futurs GLB.
    const part = object.geometry.clone().toNonIndexed();

    // On fige la position/rotation/echelle de l'objet dans les sommets :
    // la geometrie obtenue est directement en coordonnees du monde.
    part.applyMatrix4(object.matrixWorld);

    // La collision n'a besoin que des positions. Supprimer les normales,
    // les UV et les couleurs allege l'arbre de recherche et evite les
    // incompatibilites entre geometries.
    for (const name of Object.keys(part.attributes)) {
      if (name !== 'position') part.deleteAttribute(name);
    }
    part.morphAttributes = {};

    parts.push(part);
  });

  if (parts.length === 0) {
    throw new Error(
      'Aucun maillage de collision trouve : marquer les objets solides ' +
        'avec mesh.userData.collision = true',
    );
  }

  const merged = mergeGeometries(parts, false);

  // Les morceaux clones ne servent plus : on libere leur memoire GPU.
  for (const part of parts) part.dispose();

  if (!merged) {
    throw new Error('Echec de la fusion des geometries de collision');
  }

  merged.name = 'collision';
  return merged;
}

/** Nombre de triangles d'une geometrie (utile pour surveiller le budget). */
export function triangleCount(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  return (geometry.index ? geometry.index.count : position.count) / 3;
}
