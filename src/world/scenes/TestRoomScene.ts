/* ===================================================================
   src/world/scenes/TestRoomScene.ts

   PIECE DE TEST TEMPORAIRE ("graybox").

   Uniquement des primitives Three.js : elle sert a valider les
   deplacements, le regard et la gravite. Elle sera entierement
   supprimee et remplacee par les vrais decors 1948 charges en GLB.
   Ne pas y investir de travail de decoration.

   Elle expose trois informations dont le joueur a besoin :
     - spawn     : ou apparaitre
     - floorY    : la hauteur du sol
     - halfSize  : la demi-largeur de la piece (limites temporaires)
   =================================================================== */

import * as THREE from 'three';

/** Cote interieur de la piece, en metres (12 x 12 m). */
const ROOM_SIZE = 12;
const WALL_HEIGHT = 3.2;
const WALL_THICKNESS = 0.25;

export class TestRoomScene {
  readonly scene = new THREE.Scene();

  /** Position d'apparition du joueur (aux pieds). */
  readonly spawn = new THREE.Vector3(0, 0, 4);

  /** Orientation initiale du regard, en radians (0 = vers le fond, -Z). */
  readonly spawnYaw = 0;

  readonly floorY = 0;
  readonly halfSize = ROOM_SIZE / 2;

  constructor() {
    this.buildLighting();
    this.buildRoom();
    this.buildProps();
  }

  // -----------------------------------------------------------------
  // Eclairage : volontairement neutre et lisible.
  // L'ambiance film noir sera travaillee bien plus tard (Phase 13).
  // -----------------------------------------------------------------
  private buildLighting(): void {
    this.scene.background = new THREE.Color(0x10141b);

    // Brouillard tres leger : donne un peu de profondeur sans gener.
    this.scene.fog = new THREE.Fog(0x10141b, 8, 30);

    // Lumiere d'ambiance : evite les noirs absolus.
    this.scene.add(new THREE.HemisphereLight(0x8fa5c0, 0x2a2622, 0.55));

    // Lumiere principale, la seule a projeter des ombres.
    const key = new THREE.DirectionalLight(0xfff2dc, 2.2);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);

    // Cadrer la camera d'ombre au plus juste autour de la piece : une ombre
    // sur un cadrage trop large est a la fois floue et plus couteuse.
    const s = this.halfSize + 1;
    key.shadow.camera.left = -s;
    key.shadow.camera.right = s;
    key.shadow.camera.top = s;
    key.shadow.camera.bottom = -s;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 25;
    key.shadow.bias = -0.0005; // corrige les rayures d'ombre sur le sol
    this.scene.add(key);

    // Petit appoint chaud dans un coin : sert de repere visuel pour
    // verifier qu'on se deplace bien dans la piece.
    const lamp = new THREE.PointLight(0xffb267, 12, 9, 2);
    lamp.position.set(-4, 2.4, -4);
    this.scene.add(lamp);
  }

  // -----------------------------------------------------------------
  // Sol, murs, plafond
  // -----------------------------------------------------------------
  private buildRoom(): void {
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4640,
      roughness: 0.85,
    });
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x6b6459,
      roughness: 0.9,
    });
    // Un mur d'une couleur differente donne un point de repere pour verifier
    // l'orientation quand on tourne la tete.
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0x7d5a44,
      roughness: 0.9,
    });
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      color: 0x33302b,
      roughness: 1,
    });

    // --- Sol ---
    // Un PlaneGeometry est cree verticalement : il faut le coucher en le
    // tournant de -90 degres autour de l'axe X.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
      floorMaterial,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = this.floorY;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // --- Plafond ---
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
      ceilingMaterial,
    );
    ceiling.rotation.x = Math.PI / 2; // retourne vers le bas
    ceiling.position.y = WALL_HEIGHT;
    this.scene.add(ceiling);

    // --- 4 murs ---
    // On les place juste a l'exterieur de la surface du sol.
    const half = this.halfSize;
    const offset = half + WALL_THICKNESS / 2;
    const walls: Array<{ size: [number, number, number]; pos: [number, number, number]; accent?: boolean }> = [
      { size: [ROOM_SIZE + WALL_THICKNESS * 2, WALL_HEIGHT, WALL_THICKNESS], pos: [0, WALL_HEIGHT / 2, -offset], accent: true }, // nord
      { size: [ROOM_SIZE + WALL_THICKNESS * 2, WALL_HEIGHT, WALL_THICKNESS], pos: [0, WALL_HEIGHT / 2, offset] },                 // sud
      { size: [WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE], pos: [-offset, WALL_HEIGHT / 2, 0] },                                     // ouest
      { size: [WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE], pos: [offset, WALL_HEIGHT / 2, 0] },                                      // est
    ];

    for (const wall of walls) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(...wall.size),
        wall.accent ? accentMaterial : wallMaterial,
      );
      mesh.position.set(...wall.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  // -----------------------------------------------------------------
  // Quelques volumes pour juger des distances et de la vitesse.
  // ATTENTION : ils se traversent encore (pas de vraies collisions en 2A).
  // -----------------------------------------------------------------
  private buildProps(): void {
    const material = new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 0.7 });

    // Trois "caisses" de tailles differentes.
    const crates: Array<{ size: number; pos: [number, number, number] }> = [
      { size: 0.9, pos: [-2.5, 0.45, -2.0] },
      { size: 0.6, pos: [-1.8, 0.3, -3.1] },
      { size: 1.4, pos: [3.2, 0.7, -1.5] },
    ];
    for (const crate of crates) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(crate.size, crate.size, crate.size), material);
      mesh.position.set(...crate.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }

    // Un pilier : repere vertical tres utile pour juger de la hauteur des yeux.
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, WALL_HEIGHT, 16),
      new THREE.MeshStandardMaterial({ color: 0x5c564d, roughness: 0.95 }),
    );
    pillar.position.set(1.5, WALL_HEIGHT / 2, 2.0);
    pillar.castShadow = true;
    this.scene.add(pillar);

    // Une "table" basse : sert de reference d'echelle (0,75 m de haut,
    // hauteur reelle d'une table).
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.08, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x6f4f38, roughness: 0.6 }),
    );
    table.position.set(-3.5, 0.75, 2.5);
    table.castShadow = true;
    table.receiveShadow = true;
    this.scene.add(table);
  }
}
