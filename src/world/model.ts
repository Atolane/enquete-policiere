/* ===================================================================
   src/world/model.ts

   CONVENTIONS D'INTEGRATION DES MODELES

   Un fichier .glb arrive "brut". Ce module lui applique les regles du
   projet pour qu'il devienne utilisable : ombres, collisions, points
   d'ancrage. C'est le contrat entre le modeleur (Blender) et le code.

   -------------------------------------------------------------------
   LES REGLES, A RESPECTER DANS BLENDER
   -------------------------------------------------------------------
   1. 1 unite = 1 METRE. Axe Y vers le haut. Origine au sol.
   2. Un maillage nomme "collision" (ou commencant par "collision")
      definit la forme SOLIDE du modele. Il est invisible en jeu et
      doit rester tres simple : quelques centaines de triangles.
      Sans lui, le modele est purement decoratif et se traverse.
   3. Un objet vide nomme "anchor_<nom>" definit un POINT D'ANCRAGE :
      ou apparait le joueur, ou se tient un personnage, ou se pose un
      indice. Le code lit ces positions au lieu de les ecrire en dur,
      ce qui permet de deplacer un element dans Blender sans toucher
      une ligne de TypeScript.
   4. Tout le reste est du decor visible : il projette et recoit les
      ombres.
   =================================================================== */

import * as THREE from 'three';

export interface PreparedModel {
  /** L'objet a ajouter a la scene. */
  root: THREE.Object3D;
  /** Points d'ancrage trouves, par nom (sans le prefixe "anchor_"). */
  anchors: Map<string, THREE.Vector3>;
  /** Nombre de maillages de collision trouves dans le fichier. */
  collisionMeshCount: number;
  /** Nombre de triangles visibles. */
  triangles: number;
  /** Encombrement reel du modele, en metres. */
  size: THREE.Vector3;
}

/** Applique les conventions du projet a un modele fraichement charge. */
export function prepareModel(root: THREE.Object3D): PreparedModel {
  const anchors = new Map<string, THREE.Vector3>();
  let collisionMeshCount = 0;
  let triangles = 0;

  // Les positions des ancres doivent etre lues en coordonnees du monde.
  root.updateMatrixWorld(true);

  // On collecte d'abord, on modifie ensuite : modifier pendant un
  // traverse() donne des resultats imprevisibles.
  const nodes: THREE.Object3D[] = [];
  root.traverse((node) => nodes.push(node));

  for (const node of nodes) {
    const name = node.name.toLowerCase();

    // --- Point d'ancrage ---
    if (name.startsWith('anchor_')) {
      const position = new THREE.Vector3();
      node.getWorldPosition(position);
      anchors.set(name.slice('anchor_'.length), position);
      node.visible = false;
      continue;
    }

    if (!(node instanceof THREE.Mesh)) continue;

    // --- Maillage de collision ---
    if (name.startsWith('collision')) {
      node.visible = false;
      node.castShadow = false;
      node.receiveShadow = false;
      node.userData.collision = true; // <- lu par buildCollisionGeometry()
      collisionMeshCount++;
      continue;
    }

    // --- Decor visible ---
    node.castShadow = true;
    node.receiveShadow = true;
    triangles += countTriangles(node.geometry);
  }

  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(root).getSize(size);

  return { root, anchors, collisionMeshCount, triangles, size };
}

/**
 * Affiche dans la console ce que contient reellement un modele.
 *
 * Tres utile : c'est ce controle qui revele les mauvaises surprises d'un
 * asset telecharge (echelle absurde, trop de triangles, pas de maillage
 * de collision) avant qu'elles ne coutent des heures.
 */
export function logModelReport(name: string, model: PreparedModel): void {
  const s = model.size;
  const parts = [
    `${model.triangles.toLocaleString('fr-FR')} triangles`,
    `${s.x.toFixed(2)} x ${s.y.toFixed(2)} x ${s.z.toFixed(2)} m`,
    model.collisionMeshCount > 0
      ? `${model.collisionMeshCount} maillage(s) de collision`
      : 'aucun maillage de collision',
    model.anchors.size > 0 ? `${model.anchors.size} ancre(s)` : 'aucune ancre',
  ];
  console.info(`[modele] ${name} — ${parts.join(' | ')}`);

  // Garde-fou sur l'echelle : un modele telecharge est tres souvent
  // exprime dans une autre unite que le metre.
  if (s.y > 12 || (s.y > 0 && s.y < 0.02)) {
    console.warn(
      `[modele] ${name} : hauteur de ${s.y.toFixed(2)} m, probablement pas a l'echelle. ` +
        'Rappel : 1 unite = 1 metre.',
    );
  }
}

function countTriangles(geometry: THREE.BufferGeometry | undefined): number {
  if (!geometry) return 0;
  const position = geometry.getAttribute('position');
  if (!position) return 0;
  return Math.floor((geometry.index ? geometry.index.count : position.count) / 3);
}
