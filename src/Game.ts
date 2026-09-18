/* ===================================================================
   src/Game.ts

   Le chef d'orchestre. Il ne contient AUCUNE logique de gameplay :
   il assemble les modules et les appelle dans le bon ordre a chaque
   image. C'est le fichier a lire pour comprendre comment le jeu est
   branche.

   Ordre de demarrage :
     constructor  -> monte tout ce qui est immediat
     await load() -> telecharge les modeles, puis construit les
                     collisions (qui dependent des modeles charges)
     start()      -> lance la boucle

   Ordre d'une image :
     entrees deja collectees par Input
       -> le joueur se met a jour (regard, deplacement, gravite,
          collisions, camera)
       -> on regarde ce qu'il vise
       -> l'interface se met a jour
       -> on dessine
   =================================================================== */

import * as THREE from 'three';
import { Engine } from './core/Engine';
import { Input } from './core/Input';
import { ModelLibrary } from './core/Loaders';
import { Player } from './player/Player';
import { Collider } from './player/Collider';
import { InteractionSystem } from './interaction/InteractionSystem';
import { TestRoomScene } from './world/scenes/TestRoomScene';
import { buildCollisionGeometry, triangleCount } from './world/collision';
import { Hud } from './ui/Hud';

/**
 * Mode actif du jeu. Un seul a la fois.
 *
 * C'est une variable minuscule mais tres importante : elle evite la
 * categorie de bugs la plus penible d'un jeu a la premiere personne,
 * celle ou l'on marche pendant une conversation ou l'on fait pivoter la
 * camera en cliquant dans un menu. Les modes 'dialogue' et 'notebook'
 * viendront s'ajouter ici plus tard.
 */
type GameMode = 'exploring' | 'examining';

export class Game {
  private readonly engine: Engine;
  private readonly input: Input;
  private readonly player: Player;
  private readonly room: TestRoomScene;
  private readonly models = new ModelLibrary();
  private readonly interaction: InteractionSystem;
  private readonly hud: Hud;

  /* Les collisions ne peuvent etre construites qu'APRES le chargement des
     modeles, puisqu'un decor importe apporte sa propre geometrie solide.
     Ce champ reste donc vide jusqu'a la fin de load(). */
  private collider: Collider | null = null;

  private mode: GameMode = 'exploring';

  /* --- Personnages (Phase 4) ---
     Le nombre est reglable par ?personnages=N dans l'adresse, pour
     pouvoir mesurer le cout sur sa propre machine. */
  private readonly characterCount: number;
  /** Distance au-dela de laquelle un personnage cesse de regarder. */
  private static readonly LOOK_RANGE = 4.5;
  private readonly frustum = new THREE.Frustum();
  private readonly frustumMatrix = new THREE.Matrix4();
  /* Rayon serre autour du corps. Trop large, la sphere engloberait la
     camera quand le joueur est colle au personnage, et celui-ci serait
     considere comme visible alors qu'on lui tourne le dos. */
  private readonly characterSphere = new THREE.Sphere(new THREE.Vector3(), 1.0);
  private readonly eyePosition = new THREE.Vector3();
  private readonly viewDirection = new THREE.Vector3();
  private readonly toCharacter = new THREE.Vector3();
  /** Personnage que le joueur regarde, sinon null. */
  private focused: import('./world/Character').Character | null = null;
  /** Temps processeur passe a animer les personnages, en millisecondes.
      Mesure independante de la carte graphique : c'est le cout reel du
      squelette et du melange d'animations. */
  private characterCostMs = 0;

  /** Compteur d'images par seconde, lisse pour rester lisible. */
  private fps = 60;

  constructor(canvas: HTMLCanvasElement) {
    /* ?personnages=N regle le nombre de mannequins (0 a 8). Sert a mesurer
       leur cout sur sa propre machine : 0 donne la reference sans aucun
       personnage. Absent, la valeur par defaut est 2. */
    const param = new URLSearchParams(window.location.search).get('personnages');
    const requested = param === null ? 2 : Number(param);
    this.characterCount = Number.isFinite(requested)
      ? Math.min(Math.max(Math.trunc(requested), 0), 8)
      : 2;

    this.engine = new Engine(canvas);
    this.input = new Input(canvas);
    this.hud = new Hud();
    this.room = new TestRoomScene();
    this.player = new Player();

    this.player.spawn(this.room.spawn, this.room.spawnYaw);

    this.interaction = new InteractionSystem(this.room.scene, this.engine.camera);
    this.interaction.onTargetChange = (target) => this.hud.setTarget(target?.prompt ?? null);
    this.interaction.onInteract = (target) => this.openInfo(target.title, target.info);

    this.input.onLockChange = (locked) => {
      this.hud.setLocked(locked);
      // Perdre la souris (Echap, Alt+Tab) revient toujours a l'etat neutre.
      if (!locked) this.closeInfo();
    };
    this.input.onClick = () => this.handleClick();

    this.hud.setLocked(this.input.isLocked());
  }

  /**
   * Telecharge les modeles 3D puis prepare ce qui en depend.
   * A appeler une fois, avant start().
   */
  async load(): Promise<void> {
    this.models.onProgress = (ratio, label) => this.hud.setLoadingProgress(ratio, label);
    this.hud.setLoadingProgress(0, '');

    await this.room.load(this.models, this.characterCount);

    /* Les collisions sont construites MAINTENANT, et pas avant : la
       geometrie solide apportee par les modeles importes doit y figurer.
       C'est le seul changement d'ordre qu'impose le chargement d'assets. */
    const collisionGeometry = buildCollisionGeometry(this.room.scene);
    this.collider = new Collider(collisionGeometry);
    this.player.setCollider(this.collider);
    console.info(`[collisions] ${triangleCount(collisionGeometry)} triangles de collision`);

    this.hud.setLoadingProgress(1, '');
    this.hud.hideLoading();
  }

  /** Affiche un message lisible plutot qu'un ecran noir en cas d'echec. */
  showLoadingError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[chargement]', error);
    this.hud.showLoadingError(message);
  }

  start(): void {
    this.engine.run((deltaTime) => this.update(deltaTime));
  }

  stop(): void {
    this.engine.stop();
    this.input.dispose();
    for (const character of this.room.characters) character.dispose();
    this.collider?.dispose();
    this.models.dispose();
  }

  // -----------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------

  /** Le clic signifie "agir" ou "fermer", selon le mode en cours. */
  private handleClick(): void {
    if (this.mode === 'examining') {
      this.closeInfo();
    } else {
      this.interaction.activate();
    }
  }

  private openInfo(title: string, text: string): void {
    this.mode = 'examining';
    // On suspend les commandes plutot que de liberer la souris : cela evite
    // au joueur de devoir recliquer, et le delai d'une seconde que Chrome
    // impose avant de rendre le controle apres un Echap.
    this.input.setEnabled(false);
    this.interaction.clear();
    this.hud.showInfo(title, text);
  }

  private closeInfo(): void {
    if (this.mode !== 'examining') return;
    this.mode = 'exploring';
    this.input.setEnabled(true);
    this.hud.hideInfo();
  }

  // -----------------------------------------------------------------
  // Boucle
  // -----------------------------------------------------------------

  /**
   * Met a jour les personnages.
   *
   * Deux economies importantes :
   *  - un personnage hors du champ de vision n'est pas anime du tout.
   *    La deformation d'un maillage par son squelette est le poste le
   *    plus couteux, et elle est inutile si personne ne le voit ;
   *  - un personnage trop eloigne ne tourne pas la tete.
   */
  private updateCharacters(deltaTime: number): void {
    const started = performance.now();
    const camera = this.engine.camera;
    this.frustumMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.frustumMatrix);
    this.player.getEyePosition(this.eyePosition);
    camera.getWorldDirection(this.viewDirection);

    /* On retient le personnage que le joueur REGARDE, pas le plus proche :
       la ligne de controle suit ainsi celui qu'on observe, meme en
       s'en eloignant. */
    this.focused = null;
    let bestAlignment = Math.cos(THREE.MathUtils.degToRad(50));

    for (const character of this.room.characters) {
      this.characterSphere.center.copy(character.root.position);
      this.characterSphere.center.y += 0.9; // centre du corps, pas les pieds
      const visible = this.frustum.intersectsSphere(this.characterSphere);

      const distance = character.root.position.distanceTo(this.eyePosition);
      const near = distance <= Game.LOOK_RANGE;

      // Le personnage suit le joueur des yeux quand il est proche, et
      // passe en posture attentive. C'est le seul "comportement" de cette
      // phase : aucun dialogue, aucune logique d'enquete.
      character.lookAt(near ? this.eyePosition : null);
      character.setState(near ? 'attentive' : 'idle');

      character.update(deltaTime, visible);

      this.toCharacter.copy(character.root.position).setY(this.eyePosition.y)
        .sub(this.eyePosition);
      if (this.toCharacter.lengthSq() > 1e-6) {
        const alignment = this.toCharacter.normalize().dot(this.viewDirection);
        if (alignment > bestAlignment) {
          bestAlignment = alignment;
          this.focused = character;
        }
      }
    }

    // Moyenne glissante : la valeur brute varie trop pour etre lue.
    this.characterCostMs += (performance.now() - started - this.characterCostMs) * 0.1;
  }

  private update(deltaTime: number): void {
    this.player.update(deltaTime, this.input, this.engine.camera);
    this.updateCharacters(deltaTime);

    // On ne cherche une cible que si le joueur peut reellement agir.
    if (this.mode === 'exploring' && this.input.isLocked()) {
      this.interaction.update();
    }

    // Moyenne glissante : sans lissage, le chiffre serait illisible.
    if (deltaTime > 0) this.fps += (1 / deltaTime - this.fps) * 0.1;
    const p = this.player.position;
    this.hud.setDebug(this.fps, p.x, p.y, p.z, this.player.grounded);
    this.hud.setCharacterDebug(
      this.room.characters, this.eyePosition, this.focused, this.characterCostMs);

    this.engine.render(this.room.scene);
  }
}
