/* ===================================================================
   src/Game.ts

   Le chef d'orchestre. Il ne contient AUCUNE logique de gameplay :
   il assemble les modules et les appelle dans le bon ordre a chaque
   image. C'est le fichier a lire pour comprendre comment le jeu est
   branche.

   Ordre d'une image :
     entrees deja collectees par Input
       -> le joueur se met a jour (regard, deplacement, gravite,
          collisions, camera)
       -> l'interface se met a jour
       -> on dessine
   =================================================================== */

import { Engine } from './core/Engine';
import { Input } from './core/Input';
import { Player } from './player/Player';
import { Collider } from './player/Collider';
import { TestRoomScene } from './world/scenes/TestRoomScene';
import { buildCollisionGeometry, triangleCount } from './world/collision';
import { Hud } from './ui/Hud';

export class Game {
  private readonly engine: Engine;
  private readonly input: Input;
  private readonly player: Player;
  private readonly room: TestRoomScene;
  private readonly collider: Collider;
  private readonly hud: Hud;

  /** Compteur d'images par seconde, lisse pour rester lisible. */
  private fps = 60;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas);
    this.input = new Input(canvas);
    this.hud = new Hud();
    this.room = new TestRoomScene();
    this.player = new Player();

    // Collisions : on extrait du decor une geometrie simplifiee, puis on
    // construit l'arbre de recherche une seule fois, au chargement.
    const collisionGeometry = buildCollisionGeometry(this.room.scene);
    this.collider = new Collider(collisionGeometry);
    this.player.setCollider(this.collider);

    console.info(
      `[collisions] ${triangleCount(collisionGeometry)} triangles de collision`,
    );

    this.player.spawn(this.room.spawn, this.room.spawnYaw);

    // L'interface reagit a la prise ou a la perte de la souris.
    this.input.onLockChange = (locked) => this.hud.setLocked(locked);
    this.hud.setLocked(this.input.isLocked());
  }

  start(): void {
    this.engine.run((deltaTime) => this.update(deltaTime));
  }

  stop(): void {
    this.engine.stop();
    this.input.dispose();
    this.collider.dispose();
  }

  private update(deltaTime: number): void {
    this.player.update(deltaTime, this.input, this.engine.camera);

    // Moyenne glissante : sans lissage, le chiffre serait illisible.
    if (deltaTime > 0) this.fps += (1 / deltaTime - this.fps) * 0.1;
    const p = this.player.position;
    this.hud.setDebug(this.fps, p.x, p.y, p.z, this.player.grounded);

    this.engine.render(this.room.scene);
  }
}
