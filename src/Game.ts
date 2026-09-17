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

  /** Compteur d'images par seconde, lisse pour rester lisible. */
  private fps = 60;

  constructor(canvas: HTMLCanvasElement) {
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

    await this.room.load(this.models);

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

  private update(deltaTime: number): void {
    this.player.update(deltaTime, this.input, this.engine.camera);

    // On ne cherche une cible que si le joueur peut reellement agir.
    if (this.mode === 'exploring' && this.input.isLocked()) {
      this.interaction.update();
    }

    // Moyenne glissante : sans lissage, le chiffre serait illisible.
    if (deltaTime > 0) this.fps += (1 / deltaTime - this.fps) * 0.1;
    const p = this.player.position;
    this.hud.setDebug(this.fps, p.x, p.y, p.z, this.player.grounded);

    this.engine.render(this.room.scene);
  }
}
