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
import { DialogueUI } from './ui/DialogueUI';
import { GameState } from './game/GameState';
import { DialogueEngine, validateCase } from './game/dialogue';
import { Interrogation } from './game/Interrogation';
import { demoCase } from './data/demo/greco';
import type { Character } from './world/Character';

/**
 * Mode actif du jeu. Un seul a la fois.
 *
 * C'est une variable minuscule mais tres importante : elle evite la
 * categorie de bugs la plus penible d'un jeu a la premiere personne,
 * celle ou l'on marche pendant une conversation ou l'on fait pivoter la
 * camera en cliquant dans un menu. Les modes 'dialogue' et 'notebook'
 * viendront s'ajouter ici plus tard.
 */
type GameMode = 'exploring' | 'examining' | 'dialogue';

export class Game {
  private readonly engine: Engine;
  private readonly input: Input;
  private readonly player: Player;
  private readonly room: TestRoomScene;
  private readonly models = new ModelLibrary();
  private readonly interaction: InteractionSystem;
  private readonly hud: Hud;

  /* --- Enquete (Phase 5A) --- */
  private readonly state = new GameState();
  private readonly dialogue: DialogueEngine;
  private readonly dialogueUI = new DialogueUI();
  private readonly interrogation: Interrogation;
  /** Personnage interroge : Game cesse de piloter son etat et son regard. */
  private interviewed: Character | null = null;

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
  private focused: Character | null = null;
  /** Cadrage de l'entretien : point vise par la camera. */
  private readonly framingTarget = new THREE.Vector3();
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

    /* Enquete. Le validateur s'execute au demarrage : une faute de frappe
       dans les donnees est signalee tout de suite, pas en cours de partie. */
    this.dialogue = new DialogueEngine(demoCase, this.state);
    const problems = validateCase(demoCase);
    if (problems.length > 0) {
      console.warn(`[enquete] ${problems.length} probleme(s) dans les donnees :`);
      for (const problem of problems) console.warn(`  - ${problem}`);
    } else {
      console.info(
        `[enquete] donnees validees : ${demoCase.topics.length} questions, ` +
          `${demoCase.statements.length} declarations`,
      );
    }
    this.interrogation = new Interrogation(this.dialogue, this.state, this.dialogueUI);
    this.dialogueUI.onLeave = () => this.endInterrogation();

    this.interaction = new InteractionSystem(this.room.scene, this.engine.camera);
    this.interaction.onTargetChange = (target) => this.hud.setTarget(target?.prompt ?? null);
    this.interaction.onInteract = (target) => {
      // Un personnage s'interroge, un objet s'examine.
      if (target.characterId) this.startInterrogation(target.characterId);
      else this.examine(target);
    };

    this.input.onLockChange = (locked) => {
      // Pendant un entretien, la souris est LIBRE a dessein : le panneau
      // d'accueil ne doit pas s'afficher par-dessus.
      this.hud.setLocked(locked, this.mode === 'dialogue');
      if (!locked && this.mode === 'examining') this.closeInfo();
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
    this.dialogueUI.dispose();
    for (const character of this.room.characters) character.dispose();
    this.collider?.dispose();
    this.models.dispose();
  }

  // -----------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------

  /** Le clic signifie "agir" ou "fermer", selon le mode en cours. */
  private handleClick(): void {
    if (this.mode === 'examining') this.closeInfo();
    else if (this.mode === 'exploring') this.interaction.activate();
    // En mode dialogue la souris est libre : les clics vont au panneau.
  }

  // --- Interrogatoire (Phase 5A) ------------------------------------

  private startInterrogation(caseId: string): void {
    const character = this.room.suspects.get(caseId);
    if (!character) {
      console.warn(`[enquete] aucun modele n'incarne "${caseId}"`);
      return;
    }
    if (!this.interrogation.start(caseId, character)) return;

    this.mode = 'dialogue';
    this.interviewed = character;
    this.interaction.clear();
    this.input.setEnabled(false);

    /* On libere la souris : choisir une question au curseur est plus
       naturel qu'a l'aveugle. La sortie est PROGRAMMEE et non declenchee
       par Echap, ce qui evite le delai d'une seconde impose par Chrome
       avant de pouvoir reprendre le controle. */
    document.exitPointerLock();
    this.hud.setLocked(false, true);
  }

  private endInterrogation(): void {
    if (this.mode !== 'dialogue') return;
    this.interrogation.stop();
    this.mode = 'exploring';
    this.interviewed = null;
    this.input.setEnabled(true);
    this.hud.setLocked(this.input.isLocked(), false);
  }

  /**
   * Oriente doucement la camera vers le visage du personnage.
   *
   * On agit sur les angles du joueur plutot que sur la camera elle-meme :
   * Player les applique ensuite comme d'habitude. Aucun systeme ne se
   * bat avec un autre, et le joueur retrouve exactement sa vue a la fin.
   */
  private updateFraming(deltaTime: number): void {
    if (!this.interviewed) return;

    this.framingTarget.copy(this.interviewed.root.position);
    this.framingTarget.y += 1.45; // hauteur du visage
    this.player.getEyePosition(this.eyePosition);

    const dx = this.framingTarget.x - this.eyePosition.x;
    const dy = this.framingTarget.y - this.eyePosition.y;
    const dz = this.framingTarget.z - this.eyePosition.z;
    const targetYaw = Math.atan2(-dx, -dz);
    const targetPitch = Math.atan2(dy, Math.hypot(dx, dz));

    const k = 1 - Math.exp(-6 * deltaTime);
    const look = this.player.look;
    // Ecart ramene dans [-PI, PI] : sans cela la camera ferait le tour
    // du monde a l'envers quand le personnage est derriere le joueur.
    const delta = Math.atan2(Math.sin(targetYaw - look.yaw), Math.cos(targetYaw - look.yaw));
    look.yaw += delta * k;
    look.pitch += (targetPitch - look.pitch) * k;
  }

  /** Examen d'un objet : affiche sa fiche, et l'enregistre s'il est un indice. */
  private examine(target: { title: string; info: string; clueId?: string }): void {
    if (target.clueId && this.state.discoverClue(target.clueId)) {
      console.info(`[enquete] indice decouvert : ${target.clueId}`);
    }
    this.openInfo(target.title, target.info);
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
      /* Le personnage interroge est pilote par l'entretien : il regarde
         toujours le joueur et reste en posture d'entretien, quelle que
         soit la distance. Game ne lui impose plus rien. */
      if (character === this.interviewed) {
        character.lookAt(this.eyePosition);
        character.setState('attentive');
      } else {
        character.lookAt(near ? this.eyePosition : null);
        character.setState(near ? 'attentive' : 'idle');
      }

      character.update(deltaTime, visible || character === this.interviewed);

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
    if (this.mode === 'dialogue') this.updateFraming(deltaTime);
    this.updateCharacters(deltaTime);
    this.interrogation.update(deltaTime);

    // On ne cherche une cible que si le joueur peut reellement agir.
    if (this.mode === 'exploring' && this.input.isLocked()) {
      this.interaction.update();
    }

    // Moyenne glissante : sans lissage, le chiffre serait illisible.
    if (deltaTime > 0) this.fps += (1 / deltaTime - this.fps) * 0.1;
    const p = this.player.position;
    this.hud.setDebug(
      this.fps, p.x, p.y, p.z, this.player.grounded,
      THREE.MathUtils.radToDeg(this.player.look.yaw),
      THREE.MathUtils.radToDeg(this.player.look.pitch),
    );
    this.hud.setCharacterDebug(
      this.room.characters, this.eyePosition, this.focused, this.characterCostMs);

    this.engine.render(this.room.scene);
  }
}
