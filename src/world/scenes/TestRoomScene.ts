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

   PHASE 3 : la piece charge en plus un VRAI modele GLB (un appareil
   photo sur trepied) pour valider le pipeline d'assets de bout en bout.

   PHASE 4 : elle accueille des personnages animes, mannequins d'essai
   destines a valider la chaine technique. Leur nombre peut etre change
   par le parametre d'adresse ?personnages=N, pour mesurer le cout.

   Tout objet solide porte le marqueur userData.collision = true,
   lu par world/collision.ts.
   =================================================================== */

import * as THREE from 'three';
import type { Interactable } from '../../interaction/InteractionSystem';
import type { ModelLibrary } from '../../core/Loaders';
import { prepareModel, logModelReport } from '../model';
import { CharacterFactory } from '../CharacterFactory';
import type { Character } from '../Character';

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

  /** Personnages presents, dans l'ordre de placement. */
  readonly characters: Character[] = [];

  /** Qui incarne qui : identifiant d'affaire -> instance 3D. */
  readonly suspects = new Map<string, Character>();

  private readonly characterFactory = new CharacterFactory();

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
   * Charge les modeles 3D de la piece.
   *
   * Separe du constructeur parce qu'un telechargement prend du temps :
   * le constructeur monte la partie immediate, load() attend le reste.
   * C'est ce decoupage qui permet d'afficher un ecran de chargement.
   */
  async load(models: ModelLibrary, characterCount = 2): Promise<void> {
    await Promise.all([
      this.loadCamera(models),
      this.loadCharacters(models, characterCount),
    ]);
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

  /**
   * Les indices que cette scene permet reellement de trouver.
   *
   * C'est le seul renseignement que le decor doit au reste du jeu pour
   * que le controle croise du demarrage puisse avoir lieu. On renvoie un
   * simple tableau de chaines : la frontiere tient, aucun objet Three.js
   * ne passe vers game/.
   *
   * A appeler APRES load() : les modeles importes posent leurs propres
   * objets observables, et l'appareil photo en est un.
   */
  clueIdsInScene(): string[] {
    const found = new Set<string>();
    this.scene.traverse((node) => {
      const data = node.userData.interactable as Interactable | undefined;
      if (data?.kind === 'clue') found.add(data.clueId);
    });
    return [...found];
  }

  private buildExaminables(): void {
    // --- 1. Un cendrier, pose sur la table ---
    const ashtray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.08, 0.04, 20),
      this.materials.object,
    );
    ashtray.position.set(-4.5, 0.81, 3.5);
    // Rien d'autre que l'identifiant : les mots sont dans src/data/.
    this.makeExaminable(ashtray, { kind: 'clue', clueId: 'verre_renverse' });

    // --- 2. Un document, pose sur la grande caisse ---
    const document = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.015, 0.22),
      this.materials.object,
    );
    document.position.set(3.5, 1.41, -2.0);
    document.rotation.y = 0.3;
    this.makeExaminable(document, { kind: 'clue', clueId: 'livres_comptes' });

    /* Un registre, sur la meme caisse. Ecarte de 45 cm des livres :
       assez pour que le viseur distingue les deux sans que le joueur
       ait a se contorsionner. */
    const ledger = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.04, 0.34),
      this.materials.object,
    );
    ledger.position.set(3.5, 1.43, -2.45);
    ledger.rotation.y = -0.18;
    this.makeExaminable(ledger, { kind: 'clue', clueId: 'registre_livraisons' });

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
    this.makeExaminable(phoneBase, { kind: 'clue', clueId: 'combine_decroche' });
    // L'ecouteur est un enfant : on lui donne les memes donnees pour que
    // viser l'un ou l'autre revienne au meme.
    handset.userData.interactable = phoneBase.userData.interactable;
    handset.castShadow = true;
  }

  // -----------------------------------------------------------------
  // Modele GLB reel (Phase 3)
  // -----------------------------------------------------------------

  private async loadCamera(models: ModelLibrary): Promise<void> {
    const gltf = await models.load('models/props/antique_camera.glb');
    const model = prepareModel(gltf.scene);

    // Le rapport s'affiche dans la console : c'est notre garde-fou sur
    // l'echelle, le nombre de triangles et la presence de collisions.
    logModelReport('antique_camera.glb', model);

    /* MISE A L'ECHELLE.
       Ce modele fait 7,2 m de haut a l'import : il ne respecte pas notre
       convention "1 unite = 1 metre". Un appareil sur trepied mesure
       environ 1,55 m, d'ou ce facteur.

       C'est une EXCEPTION, pas la regle : pour nos propres assets, la
       mise a l'echelle se fait dans Blender avant l'export, afin que le
       code ne porte aucun nombre magique. On l'accepte ici parce que le
       modele vient d'une bibliotheque externe. */
    const TARGET_HEIGHT = 1.55;
    const scale = TARGET_HEIGHT / model.size.y;

    const root = model.root;
    root.scale.setScalar(scale);
    root.rotation.y = -0.5;
    root.position.set(-2.1, 0, 2.6);
    this.scene.add(root);

    // L'objet devient observable : on pose les donnees sur chacun de ses
    // maillages, puisque c'est le maillage touche par le rayon qui compte.
    /* L'appareil n'appartient pas a l'affaire : un photographe de presse
       l'a laisse la. Il porte donc ses propres mots plutot qu'un
       identifiant du catalogue -- tout n'est pas une preuve. */
    const data: Interactable = {
      kind: 'prop',
      title: 'Un appareil de presse',
      prompt: 'Examiner l\u2019appareil',
      info:
        'Un Speed Graphic sur trepied, plaque encore dans le dos. Un photographe '
        + 'de presse est passe avant vous, et il est reparti sans son materiel.',
    };
    root.traverse((node) => {
      if (node instanceof THREE.Mesh) node.userData.interactable = data;
    });

    /* COLLISION.
       Ce modele ne contient pas de maillage nomme "collision" : c'est le
       cas de la plupart des assets telechargés. On lui fabrique donc une
       forme solide simple, calculee depuis son encombrement reel.

       Pour nos propres decors, cette forme sera modelisee dans Blender
       et importee avec le fichier : c'est la regle decrite dans
       world/model.ts. On ne met JAMAIS la geometrie visible dans les
       collisions, elle est bien trop detaillee. */
    this.addCollisionProxy(root);
  }

  // -----------------------------------------------------------------
  // Personnages (Phase 4)
  // -----------------------------------------------------------------

  /** Emplacements possibles : position, orientation et teinte. */
  private static readonly CHARACTER_SPOTS: Array<{
    pos: [number, number, number];
    yaw: number;
    tint: number;
    label: string;
  }> = [
    /* Tous dans la bande degagee au centre de la piece (z entre -1 et 1) :
       ailleurs, l'escalier, la rampe, les caisses ou les blocs du passage
       masqueraient les personnages. Les deux premiers sont separes de plus
       de 6 m et tournes vers l'entree : un personnage qui vous tourne le
       dos ne peut pas vous suivre des yeux, ce qui rendrait la phase
       intestable. Les quatre premiers portent un temoin (voir TEMOINS) ;
       au-dela, ce sont des mannequins de mesure (?personnages=N). */
    { pos: [-3.2, 0, -0.2], yaw: 1.08, tint: 0xffffff, label: 'Mannequin A' },
    { pos: [3.2, 0, -0.2], yaw: -1.08, tint: 0xd6a97a, label: 'Mannequin B' },
    /* Le troisieme emplacement a ete recule en Phase 9 (tranche 3) :
       il porte maintenant un temoin, et non plus un mannequin de
       mesure. A (-1,6 ; -0,6) il touchait presque le premier, et le
       viseur hesitait entre les deux. Au fond de la piece, face a
       l'entree, il est degage de tous les cotes. */
    { pos: [0, 0, -3.6], yaw: Math.PI, tint: 0x9fb4c8, label: 'Mannequin C' },
    /* Le quatrieme emplacement, deplace en Phase 9 (tranche 4), pour
       la meme raison que le troisieme : a (1,6 ; -0,6) il etait a 1,7 m
       du deuxieme et le viseur hesitait. Contre le mur est, en avant de
       la rampe, il est seul. */
    { pos: [4.8, 0, 2.2], yaw: 1.14, tint: 0xc0c0a8, label: 'Mannequin D' },
    { pos: [-4.6, 0, 0.6], yaw: 1.3, tint: 0xbba0c4, label: 'Mannequin E' },
    { pos: [4.6, 0, 0.6], yaw: -1.3, tint: 0xa8c4a0, label: 'Mannequin F' },
    { pos: [-0.6, 0, -1.6], yaw: 0.25, tint: 0xd0b8a0, label: 'Mannequin G' },
    { pos: [0.8, 0, -1.6], yaw: -0.25, tint: 0xa0a8d0, label: 'Mannequin H' },
  ];

  /* Qui incarne qui, dans l'ordre des emplacements ci-dessus. Un
     emplacement sans temoin reste un mannequin de mesure. */
  /* Combien de personnages la piece place par defaut : exactement le
     nombre de temoins. Game s'en sert au lieu d'un 2 ecrit a la main,
     qui avait deja laisse un temoin hors de la scene le jour ou il est
     entre dans l'affaire. */
  static temoinCount(): number {
    return TestRoomScene.TEMOINS.length;
  }

  private static readonly TEMOINS: Array<{ id: string; nom: string }> = [
    { id: 'nino', nom: 'Nino Restivo' },
    { id: 'enzo', nom: 'Enzo Carbone' },
    { id: 'rosa', nom: 'Rosa Vitale' },
    { id: 'aldo', nom: 'Aldo Maglione' },
  ];

  private async loadCharacters(models: ModelLibrary, count: number): Promise<void> {
    if (count <= 0) return; // reference de mesure : aucun personnage
    await this.characterFactory.load(models);

    const spots = TestRoomScene.CHARACTER_SPOTS.slice(0, count);
    for (const [index, spot] of spots.entries()) {
      const id = String.fromCharCode(65 + index); // A, B, C...
      const character = this.characterFactory.create(`mannequin_${id}`, {
        position: new THREE.Vector3(...spot.pos),
        yaw: spot.yaw,
        tint: spot.tint,
      });

      /* Les premiers mannequins portent les temoins de l'affaire (voir
         src/data/cases/dernier-service.ts). Au-dela, ils restent muets :
         ils ne servent qu'aux mesures de performance. */
      const temoin = TestRoomScene.TEMOINS[index];
      const data: Interactable = temoin
        ? {
            kind: 'character',
            characterId: temoin.id, // identifiant DANS L'AFFAIRE
            title: temoin.nom,
            prompt: `Interroger ${temoin.nom}`,
          }
        : {
            /* Un mannequin de mesure n'appartient pas a l'affaire : il
               porte donc son propre texte, il n'a rien a faire dans le
               catalogue des indices. */
            kind: 'prop',
            title: spot.label,
            prompt: `Observer ${spot.label}`,
            info:
              'Mannequin d\u2019essai. Il ne participe pas à l\u2019enquête : ' +
              'il ne sert qu\u2019aux mesures de performance.',
          };
      character.root.traverse((node) => {
        if (node instanceof THREE.Mesh) node.userData.interactable = data;
      });

      this.scene.add(character.root);
      this.characters.push(character);
      if (temoin) this.suspects.set(temoin.id, character);

      // Un personnage occupe l'espace : boite de collision invisible,
      // etroite, autour de son axe. La geometrie du personnage lui-meme
      // ne doit JAMAIS servir aux collisions, elle est bien trop detaillee
      // et elle bouge a chaque image.
      this.addCharacterCollider(spot.pos);
    }

    console.info(`[personnages] ${this.characters.length} instance(s) placee(s)`);
  }

  /** Cylindre de collision invisible autour d'un personnage. */
  private addCharacterCollider(position: [number, number, number]): void {
    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 1.75, 10),
      new THREE.MeshBasicMaterial(),
    );
    proxy.position.set(position[0], 1.75 / 2, position[2]);
    proxy.visible = false;
    proxy.userData.collision = true;
    this.scene.add(proxy);
  }

  /** Fabrique une boite de collision invisible autour d'un objet. */
  private addCollisionProxy(target: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(target);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Retrecie horizontalement : un trepied est surtout du vide, et une
    // boite pleine donnerait l'impression de heurter de l'air.
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(size.x * 0.45, size.y, size.z * 0.45),
      new THREE.MeshBasicMaterial(),
    );
    proxy.position.set(center.x, box.min.y + size.y / 2, center.z);
    proxy.visible = false;
    proxy.userData.collision = true;
    this.scene.add(proxy);
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

