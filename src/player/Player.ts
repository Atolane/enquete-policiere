/* ===================================================================
   src/player/Player.ts

   Le CORPS du detective : sa position, sa vitesse, sa gravite.

   Convention importante et valable pour tout le projet :
   "position" designe les PIEDS du joueur, au sol. Les yeux sont places
   plus haut, a EYE_HEIGHT. Cette convention evite une foule d'erreurs
   de calcul plus tard (poser le joueur a un endroit du decor, monter
   une marche, etc.).

   PHASE 2A : pas de vraies collisions. Le joueur est simplement garde a
   l'interieur d'un rectangle (voir setBounds). Le systeme definitif
   (capsule + three-mesh-bvh contre un maillage de collision) viendra a
   l'etape suivante et remplacera uniquement la methode collide().
   =================================================================== */

import * as THREE from 'three';
import type { Input } from '../core/Input';
import { FpsCamera } from './FpsCamera';

/** Hauteur des yeux, en metres. Un adulte d'environ 1,78 m. */
const EYE_HEIGHT = 1.65;

/** Rayon du joueur, en metres : sert a ne pas coller le nez aux murs. */
const RADIUS = 0.35;

/** Vitesses en metres par seconde. Volontairement lentes : c'est un jeu
    d'observation, pas un jeu d'action. */
const WALK_SPEED = 1.5;
const RUN_SPEED = 2.7;

/** Gravite, en metres par seconde carree (plus forte que la realite :
    une gravite realiste donne une sensation de flottement). */
const GRAVITY = -20;

/** Vitesse de mise en route / d'arret du deplacement. Plus la valeur est
    grande, plus le demarrage est sec. */
const ACCELERATION = 12;

export class Player {
  /** Position des PIEDS. */
  readonly position = new THREE.Vector3();

  /** Vitesse actuelle (x et z horizontaux, y vertical). */
  readonly velocity = new THREE.Vector3();

  readonly look = new FpsCamera();

  /** Le joueur touche-t-il le sol ? */
  grounded = false;

  /** Hauteur du sol de la piece. Remplacera plus tard un vrai test de terrain. */
  private floorY = 0;

  /** Limite rectangulaire temporaire (demi-cote de la piece, en metres). */
  private boundsHalfSize = Infinity;

  /** Vecteurs de travail, crees une fois pour ne rien allouer chaque image. */
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly wish = new THREE.Vector3();

  /** Place le joueur et remet sa vitesse a zero. */
  spawn(position: THREE.Vector3, yaw = 0): void {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.look.yaw = yaw;
    this.look.pitch = 0;
  }

  setFloorY(y: number): void {
    this.floorY = y;
  }

  /** TEMPORAIRE (Phase 2A) : empeche de sortir de la piece de test. */
  setBounds(halfSize: number): void {
    this.boundsHalfSize = halfSize;
  }

  /** Position des YEUX, utilisee pour placer la camera. */
  getEyePosition(target: THREE.Vector3): THREE.Vector3 {
    return target.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
  }

  update(deltaTime: number, input: Input, camera: THREE.PerspectiveCamera): void {
    // --- 1. Regard ------------------------------------------------
    // On ne lit la souris que si elle est capturee, sinon le moindre
    // mouvement hors du jeu ferait pivoter la vue.
    if (input.isLocked()) {
      const mouse = input.consumeMouseDelta();
      this.look.applyMouseDelta(mouse.x, mouse.y);
    }

    // --- 2. Direction souhaitee -----------------------------------
    // On calcule "devant" et "a droite" a partir du yaw SEUL : on ignore
    // volontairement le pitch, sinon regarder le plafond ferait decoller
    // le joueur.
    const yaw = this.look.yaw;
    this.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    this.wish.set(0, 0, 0);
    if (input.isActive('forward')) this.wish.add(this.forward);
    if (input.isActive('backward')) this.wish.sub(this.forward);
    if (input.isActive('right')) this.wish.add(this.right);
    if (input.isActive('left')) this.wish.sub(this.right);

    // Normaliser est indispensable : sans cela, avancer ET aller a droite
    // en meme temps donnerait une vitesse 1,41 fois plus grande.
    if (this.wish.lengthSq() > 0) this.wish.normalize();

    const speed = input.isActive('run') ? RUN_SPEED : WALK_SPEED;

    // --- 3. Acceleration progressive ------------------------------
    // Lissage exponentiel : donne un demarrage et un arret souples, et
    // reste correct quel que soit le nombre d'images par seconde.
    const smoothing = 1 - Math.exp(-ACCELERATION * deltaTime);
    this.velocity.x += (this.wish.x * speed - this.velocity.x) * smoothing;
    this.velocity.z += (this.wish.z * speed - this.velocity.z) * smoothing;

    // --- 4. Gravite -----------------------------------------------
    this.velocity.y += GRAVITY * deltaTime;

    // --- 5. Deplacement -------------------------------------------
    // Toutes les vitesses sont en unites PAR SECONDE : les multiplier par
    // deltaTime rend le jeu identique a 30, 60 ou 144 images par seconde.
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    this.collide();

    // --- 6. Camera ------------------------------------------------
    this.getEyePosition(camera.position);
    this.look.applyTo(camera);
  }

  /**
   * Resolution des collisions.
   * PHASE 2A : version minimale (sol + rectangle). C'est cette methode,
   * et elle seule, que le vrai systeme de collision remplacera.
   */
  private collide(): void {
    // Sol : on ne descend jamais sous le plancher.
    if (this.position.y <= this.floorY) {
      this.position.y = this.floorY;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // Murs : simple bornage sur les deux axes horizontaux.
    const limit = this.boundsHalfSize - RADIUS;
    if (Number.isFinite(limit)) {
      this.position.x = THREE.MathUtils.clamp(this.position.x, -limit, limit);
      this.position.z = THREE.MathUtils.clamp(this.position.z, -limit, limit);
    }
  }
}
