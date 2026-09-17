/* ===================================================================
   src/player/Collider.ts

   COLLISIONS : on empeche une capsule (le joueur) de penetrer dans la
   geometrie du decor.

   -------------------------------------------------------------------
   POURQUOI UNE CAPSULE ?
   -------------------------------------------------------------------
   Une capsule est un cylindre termine par deux demi-spheres. C'est la
   forme standard pour un personnage, pour trois raisons :
     - elle ne se coince pas dans les angles (pas de coins saillants) ;
     - sa base arrondie glisse naturellement sur les petites marches et
       les pentes, sans code special ;
     - le test "distance entre un segment et un triangle" est simple
       et rapide.
   On la represente par son AXE (un segment) et un RAYON.

   -------------------------------------------------------------------
   POURQUOI three-mesh-bvh ?
   -------------------------------------------------------------------
   Tester la capsule contre les milliers de triangles du decor a chaque
   image serait beaucoup trop lent. Un BVH (Bounding Volume Hierarchy)
   est un arbre de boites englobantes : on ecarte d'un coup des milliers
   de triangles trop eloignes et on n'examine que la poignee de triangles
   reellement proches du joueur.

   C'est la seule dependance externe du projet en dehors de Three.js.

   -------------------------------------------------------------------
   L'ALGORITHME, EN UNE PHRASE
   -------------------------------------------------------------------
   Pour chaque triangle proche : si le point du triangle le plus proche
   de l'axe de la capsule est a une distance inferieure au rayon, c'est
   qu'il y a penetration -> on repousse la capsule juste ce qu'il faut,
   dans la direction qui l'ecarte du triangle.
   =================================================================== */

import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

export class Collider {
  private readonly bvh: MeshBVH;
  private readonly geometry: THREE.BufferGeometry;

  /* Objets de travail crees une fois pour toutes : dans du code appele
     60 fois par seconde, allouer des vecteurs provoque des micro-saccades
     quand le ramasse-miettes du navigateur se declenche. */
  private readonly searchBox = new THREE.Box3();
  private readonly trianglePoint = new THREE.Vector3();
  private readonly capsulePoint = new THREE.Vector3();
  private readonly pushDirection = new THREE.Vector3();

  /**
   * @param geometry geometrie de collision, deja exprimee en coordonnees
   *                 du monde (voir world/collision.ts).
   */
  constructor(geometry: THREE.BufferGeometry) {
    this.geometry = geometry;
    // Construction de l'arbre : fait une seule fois, au chargement du lieu.
    this.bvh = new MeshBVH(geometry);
  }

  /**
   * Repousse la capsule hors de la geometrie.
   *
   * @param segment axe de la capsule, en coordonnees du monde.
   *                MODIFIE SUR PLACE : apres l'appel il contient la
   *                position corrigee.
   * @param radius  rayon de la capsule.
   */
  resolveCapsule(segment: THREE.Line3, radius: number): void {
    // Zone de recherche : la boite englobant la capsule, elargie du rayon.
    // Tout ce qui est en dehors est ignore sans le moindre calcul.
    this.searchBox.makeEmpty();
    this.searchBox.expandByPoint(segment.start);
    this.searchBox.expandByPoint(segment.end);
    this.searchBox.min.addScalar(-radius);
    this.searchBox.max.addScalar(radius);

    this.bvh.shapecast({
      // Faut-il descendre dans cette branche de l'arbre ?
      intersectsBounds: (box) => box.intersectsBox(this.searchBox),

      // Appele pour chaque triangle reellement proche.
      intersectsTriangle: (triangle) => {
        const distance = triangle.closestPointToSegment(
          segment,
          this.trianglePoint, // point le plus proche SUR LE TRIANGLE
          this.capsulePoint, // point le plus proche SUR L'AXE de la capsule
        );

        if (distance >= radius) return; // pas de contact

        const depth = radius - distance;
        this.pushDirection.subVectors(this.capsulePoint, this.trianglePoint);

        if (this.pushDirection.lengthSq() < 1e-12) {
          // Cas limite : l'axe passe exactement par le triangle. La
          // direction est alors indefinie, on utilise la normale du
          // triangle pour ressortir du bon cote.
          triangle.getNormal(this.pushDirection);
        } else {
          this.pushDirection.normalize();
        }

        // On deplace la capsule entiere. Les triangles suivants seront
        // testes contre cette nouvelle position : les contacts multiples
        // (un angle de mur, une marche) se resolvent ainsi naturellement.
        segment.start.addScaledVector(this.pushDirection, depth);
        segment.end.addScaledVector(this.pushDirection, depth);
      },
    });
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
