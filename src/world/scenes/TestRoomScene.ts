/* ===================================================================
   src/world/scenes/TestRoomScene.ts

   PIECE DE TEST TEMPORAIRE ("graybox").

   Uniquement des primitives Three.js. Elle sera entierement supprimee
   et remplacee par les vrais decors 1948 charges en GLB.
   Ne pas y investir de travail de decoration.

   PHASE 2B : la piece contient desormais de quoi EPROUVER les
   collisions, et pas seulement des murs plats :
     - un escalier de 5 marches (montee automatique par la capsule)
     - une rampe inclinee (marche en pente)
     - un passage etroit de 90 cm (largeur du joueur : 70 cm)
     - des caisses et un pilier (contour d'obstacles isoles)

   Tout objet solide porte le marqueur userData.collision = true,
   lu par world/collision.ts.
   =================================================================== */

import * as THREE from 'three';
import type { Interactable } from '../../interaction/InteractionSystem';

/** Cote interieur de la piece, en metres (12 x 12 m). */
const ROOM_SIZE = 12;
const WALL_HEIGHT = 3.2;
const WALL_THICKNESS = 0.25;

/** Escalier : hauteur et profondeur d'une marche, en metres.
    17 cm est la hauteur reelle d'une marche d'habitation. */
const STEP_RISE = 0.17;
const STEP_DEPTH = 0.32;
const STEP_COUNT = 5;
const PLATFORM_HEIGHT = STEP_RISE * STEP_COUNT; // 0,85 m

export class TestRoomScene {
  readonly scene = new THREE.Scene();

  /** Position d'apparition du joueur (aux pieds). */
  readonly spawn = new THREE.Vector3(0, 0, 4);

  /** Orientation initiale du regard, en radians (0 = vers le fond, -Z). */
  readonly spawnYaw = 0;

  private readonly materials = {
    floor: new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.85 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x6b6459, roughness: 0.9 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x7d5a44, roughness: 0.9 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x33302b, roughness: 1 }),
    crate: new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 0.7 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x5c564d, roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6f4f38, roughness: 0.6 }),
    test: new THREE.MeshStandardMaterial({ color: 0x5f7360, roughness: 0.8 }),
    // Les objets observables sont plus clairs : reperables sans etre signales
    // par une fleche ou une aura, ce qui casserait l'ambiance.
    object: new THREE.MeshStandardMaterial({ color: 0xcfc4ab, roughness: 0.5 }),
  };

  constructor() {
    this.buildLighting();
    this.buildRoom();
    this.buildProps();
    this.buildCollisionTests();
    this.buildExaminables();
  }

  /**
   * Ajoute un objet SOLIDE : visible, projetant une ombre, et pris en
   * compte par les collisions.
   */
  private addSolid(mesh: THREE.Mesh): THREE.Mesh {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.collision = true; // <- lu par buildCollisionGeometry()
    this.scene.add(mesh);
    return mesh;
  }

  /** Raccourci : une boite solide. */
  private addBox(
    size: [number, number, number],
    position: [number, number, number],
    material: THREE.Material,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    return this.addSolid(mesh);
  }

  // -----------------------------------------------------------------
  // Eclairage : volontairement neutre et lisible.
  // L'ambiance film noir sera travaillee bien plus tard (Phase 13).
  // -----------------------------------------------------------------
  private buildLighting(): void {
    this.scene.background = new THREE.Color(0x10141b);
    this.scene.fog = new THREE.Fog(0x10141b, 8, 30);
    this.scene.add(new THREE.HemisphereLight(0x8fa5c0, 0x2a2622, 0.65));

    const key = new THREE.DirectionalLight(0xfff2dc, 2.2);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);

    // Cadrage serre de la camera d'ombre : une ombre sur un cadrage trop
    // large est a la fois floue et plus couteuse.
    const s = ROOM_SIZE / 2 + 1;
    key.shadow.camera.left = -s;
    key.shadow.camera.right = s;
    key.shadow.camera.top = s;
    key.shadow.camera.bottom = -s;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 25;
    key.shadow.bias = -0.0005;
    this.scene.add(key);

    // Deux appoints, un par moitie de piece : le graybox doit rester
    // LISIBLE pour pouvoir tester. L'ambiance viendra bien plus tard.
    const lampWest = new THREE.PointLight(0xffb267, 12, 9, 2);
    lampWest.position.set(-4, 2.4, -4);
    this.scene.add(lampWest);

    const lampEast = new THREE.PointLight(0xa8c4e0, 10, 10, 2);
    lampEast.position.set(4, 2.6, 3);
    this.scene.add(lampEast);
  }

  // -----------------------------------------------------------------
  // Sol, murs, plafond
  // -----------------------------------------------------------------
  private buildRoom(): void {
    const half = ROOM_SIZE / 2;

    // --- Sol ---
    // Un PlaneGeometry est cree verticalement : il faut le coucher.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
      this.materials.floor,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.collision = true;
    this.scene.add(floor);

    // --- Plafond ---
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
      this.materials.ceiling,
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_HEIGHT;
    ceiling.userData.collision = true;
    this.scene.add(ceiling);

    // --- 4 murs ---
    const offset = half + WALL_THICKNESS / 2;
    const long = ROOM_SIZE + WALL_THICKNESS * 2;
    // Le mur nord est d'une couleur differente : repere d'orientation.
    this.addBox([long, WALL_HEIGHT, WALL_THICKNESS], [0, WALL_HEIGHT / 2, -offset], this.materials.accent);
    this.addBox([long, WALL_HEIGHT, WALL_THICKNESS], [0, WALL_HEIGHT / 2, offset], this.materials.wall);
    this.addBox([WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE], [-offset, WALL_HEIGHT / 2, 0], this.materials.wall);
    this.addBox([WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE], [offset, WALL_HEIGHT / 2, 0], this.materials.wall);
  }

  // -----------------------------------------------------------------
  // Objets isoles : servent a verifier qu'on les contourne au lieu de
  // les traverser, et a juger des distances.
  // -----------------------------------------------------------------
  private buildProps(): void {
    // Regroupees cote est : l'acces a l'escalier reste degage.
    this.addBox([0.9, 0.9, 0.9], [2.0, 0.45, -4.5], this.materials.crate);
    this.addBox([0.6, 0.6, 0.6], [2.9, 0.3, -4.0], this.materials.crate);
    this.addBox([1.4, 1.4, 1.4], [3.5, 0.7, -2.0], this.materials.crate);

    // Pilier : repere vertical utile pour juger de la hauteur des yeux.
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, WALL_HEIGHT, 16),
      this.materials.stone,
    );
    pillar.position.set(4.8, WALL_HEIGHT / 2, -4.6);
    this.addSolid(pillar);

    // Table a 0,75 m : reference d'echelle (hauteur reelle d'une table).
    this.addBox([1.6, 0.08, 0.9], [-4.5, 0.75, 3.5], this.materials.wood);
  }

  // -----------------------------------------------------------------
  // Geometrie dediee au test des collisions (Phase 2B)
  // -----------------------------------------------------------------
  private buildCollisionTests(): void {
    const m = this.materials.test;

    // --- 1. Passage etroit, face au point d'apparition ---
    // Ouverture de 90 cm pour un joueur large de 70 cm : il doit passer
    // sans se coincer, mais en frottant s'il arrive de travers.
    this.addBox([2.55, 1.3, 0.6], [-1.72, 0.65, 1.5], m);
    this.addBox([2.55, 1.3, 0.6], [1.72, 0.65, 1.5], m);

    // --- 2. Escalier de 5 marches, cote ouest ---
    // Chaque marche est une boite partant du sol : la marche n devient
    // donc un bloc de hauteur n x STEP_RISE.
    for (let i = 0; i < STEP_COUNT; i++) {
      const height = STEP_RISE * (i + 1);
      const x = -2.0 - i * STEP_DEPTH;
      this.addBox([STEP_DEPTH, height, 1.8], [x, height / 2, -3.0], m);
    }

    // Plateforme d'arrivee, contre le mur ouest.
    const platformMinX = -2.0 - STEP_COUNT * STEP_DEPTH - STEP_DEPTH / 2;
    const platformWidth = platformMinX + 6;
    this.addBox(
      [platformWidth, PLATFORM_HEIGHT, 3.2],
      [platformMinX - platformWidth / 2, PLATFORM_HEIGHT / 2, -3.0],
      m,
    );

    // --- 3. Rampe inclinee, cote est ---
    // Environ 13 degres : le joueur doit la monter sans ralentir, et la
    // redescendre sans "sauter" au bord.
    const rampRise = 0.7;
    const rampRun = 3.0;
    const rampAngle = Math.atan2(rampRise, rampRun);
    const rampLength = Math.hypot(rampRise, rampRun);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampLength, 0.14, 1.8), m);
    ramp.position.set(3.3, rampRise / 2, 3.6);
    ramp.rotation.z = rampAngle; // le cote +X monte
    this.addSolid(ramp);

    // Palier en haut de la rampe.
    this.addBox([1.6, rampRise, 1.8], [5.1, rampRise / 2, 3.6], m);
  }

  // -----------------------------------------------------------------
  // Objets observables (Phase 2C)
  // -----------------------------------------------------------------

  /** Rend un objet observable : il porte ses donnees dans userData. */
  private makeExaminable(mesh: THREE.Mesh, data: Interactable): THREE.Mesh {
    mesh.castShadow = true;
    mesh.userData.interactable = data; // <- lu par InteractionSystem
    this.scene.add(mesh);
    return mesh;
  }

  private buildExaminables(): void {
    // --- 1. Un cendrier, pose sur la table ---
    const ashtray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.08, 0.04, 20),
      this.materials.object,
    );
    ashtray.position.set(-4.5, 0.81, 3.5);
    this.makeExaminable(ashtray, {
      id: 'ashtray',
      title: 'Cendrier',
      prompt: 'Examiner le cendrier',
      info:
        'Un mégot taché de rouge à lèvres, écrasé récemment. ' +
        'Quelqu\u2019un est resté ici après la fermeture.',
    });

    // --- 2. Un document, pose sur la grande caisse ---
    const document = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.015, 0.22),
      this.materials.object,
    );
    document.position.set(3.5, 1.41, -2.0);
    document.rotation.y = 0.3;
    this.makeExaminable(document, {
      id: 'report',
      title: 'Rapport dactylographié',
      prompt: 'Lire le document',
      info:
        'Un rapport daté du 12 novembre 1948. ' +
        'Le nom du signataire a été soigneusement découpé au rasoir.',
    });

    // --- 3. Un telephone, sur la plateforme en haut de l'escalier ---
    const phoneBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.09, 0.16),
      this.materials.object,
    );
    phoneBase.position.set(-4.7, 0.9, -3.0);
    const handset = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.035, 0.18, 4, 10),
      this.materials.object,
    );
    handset.rotation.z = Math.PI / 2;
    handset.position.set(0, 0.08, 0);
    phoneBase.add(handset); // l'ecouteur suit le socle
    this.makeExaminable(phoneBase, {
      id: 'phone',
      title: 'Téléphone',
      prompt: 'Examiner le téléphone',
      info:
        'Le combiné est décroché et posé de travers. ' +
        'La ligne est muette : quelqu\u2019un a appelé, puis n\u2019a pas raccroché.',
    });
    // L'ecouteur est un enfant : on lui donne les memes donnees pour que
    // viser l'un ou l'autre revienne au meme.
    handset.userData.interactable = phoneBase.userData.interactable;
    handset.castShadow = true;
  }
}

/* -------------------------------------------------------------------
   OBJETS OBSERVABLES (Phase 2C)

   Trois objets pour verifier le systeme d'interaction. Les formes sont
   des primitives et les textes sont des ESPACES RESERVES : ils seront
   remplaces par les vrais indices de l'affaire, ecrits en Phase 9.

   Ils ne portent PAS userData.collision : on peut s'en approcher de
   tout pres, ce qui est necessaire pour les examiner.
   ------------------------------------------------------------------- */
