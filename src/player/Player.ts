/* ===================================================================
   src/player/Player.ts

   Le CORPS du detective : sa position, sa vitesse, sa gravite et ses
   collisions.

   Convention valable pour tout le projet :
   "position" designe les PIEDS du joueur, au sol. Les yeux sont places
   plus haut, a EYE_HEIGHT.

   PHASE 2B : les collisions sont desormais reelles. Le joueur est une
   capsule testee contre la geometrie de collision du lieu (voir
   player/Collider.ts). Le bornage rectangulaire provisoire de la
   Phase 2A a ete supprime.
   =================================================================== */

import * as THREE from 'three';
import type { Input } from '../core/Input';
import type { Collider } from './Collider';
import { FpsCamera } from './FpsCamera';

/** Hauteur totale du joueur, en metres. */
const HEIGHT = 1.75;

/** Hauteur des yeux, en metres. */
const EYE_HEIGHT = 1.65;

/** Rayon de la capsule, en metres : la "largeur d'epaules" du joueur. */
const RADIUS = 0.35;

/** Vitesses en metres par seconde. Volontairement lentes : c'est un jeu
    d'observation, pas un jeu d'action. */
const WALK_SPEED = 1.5;
const RUN_SPEED = 2.7;

/** Gravite, en metres par seconde carree (plus forte que la realite :
    une gravite realiste donne une sensation de flottement). */
const GRAVITY = -20;

/** Vitesse de mise en route / d'arret du deplacement. */
const ACCELERATION = 12;

/** Filet de securite : sous cette altitude, on considere que le joueur
    est passe au travers du decor et on le replace. */
const FALL_LIMIT = -20;

/** Au-dela de cette valeur, la normale d'une surface est consideree comme
    "porteuse" : un sol ou une pente douce, par opposition a un mur.
    0,7 correspond a une inclinaison d'environ 45 degres. */
const GROUND_NORMAL_Y = 0.7;

/** Duree maximale d'un pas de simulation, en secondes (1/60 s).
    Voir l'explication dans update(). */
const MAX_STEP = 1 / 60;

export class Player {
  /** Position des PIEDS. */
  readonly position = new THREE.Vector3();

  /** Vitesse actuelle (x et z horizontaux, y vertical). */
  readonly velocity = new THREE.Vector3();

  readonly look = new FpsCamera();

  /** Le joueur touche-t-il le sol ? */
  grounded = false;

  private collider: Collider | null = null;

  /** Memorise le point d'apparition pour le filet de securite. */
  private readonly spawnPoint = new THREE.Vector3();
  private spawnYaw = 0;

  /* Objets de travail : aucune allocation dans la boucle de jeu. */
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly wish = new THREE.Vector3();
  private readonly capsule = new THREE.Line3();
  private readonly beforeCollision = new THREE.Vector3();
  private readonly correction = new THREE.Vector3();
  private readonly surfaceNormal = new THREE.Vector3();

  setCollider(collider: Collider): void {
    this.collider = collider;
  }

  /** Place le joueur et remet sa vitesse a zero. */
  spawn(position: THREE.Vector3, yaw = 0): void {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.look.yaw = yaw;
    this.look.pitch = 0;
    this.spawnPoint.copy(position);
    this.spawnYaw = yaw;
  }

  /** Position des YEUX, utilisee pour placer la camera. */
  getEyePosition(target: THREE.Vector3): THREE.Vector3 {
    return target.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
  }

  update(deltaTime: number, input: Input, camera: THREE.PerspectiveCamera): void {
    // --- 1. Regard (une seule fois par image) ---------------------
    if (input.isLocked()) {
      const mouse = input.consumeMouseDelta();
      this.look.applyMouseDelta(mouse.x, mouse.y);
    }

    /* --- 2. Simulation en SOUS-PAS -------------------------------
       On ne simule jamais plus de 1/60 s d'un coup.

       Pourquoi : entre deux images, la gravite fait descendre le joueur
       et son avancee le fait penetrer dans les murs. Plus l'image est
       longue, plus cette penetration est profonde, et plus la correction
       de collision devient brutale. Sur une machine lente (20 images par
       seconde), le joueur se bloquait dans l'escalier et tremblait.

       En decoupant le temps ecoule en tranches de 1/60 s, le jeu se
       comporte EXACTEMENT de la meme facon a 20, 60 ou 144 images par
       seconde. deltaTime etant deja plafonne a 0,1 s par le moteur, ce
       sont au maximum 6 tranches. */
    let remaining = deltaTime;
    while (remaining > 0) {
      const step = Math.min(remaining, MAX_STEP);
      this.simulate(step, input);
      remaining -= step;
    }

    // --- 3. Camera ------------------------------------------------
    this.getEyePosition(camera.position);
    this.look.applyTo(camera);
  }

  /** Un pas de simulation : deplacement, gravite et collisions. */
  private simulate(deltaTime: number, input: Input): void {
    // --- Direction souhaitee --------------------------------------
    // Calculee a partir du yaw SEUL : on ignore volontairement le pitch,
    // sinon regarder le plafond ferait decoller le joueur.
    const yaw = this.look.yaw;
    this.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    this.wish.set(0, 0, 0);
    if (input.isActive('forward')) this.wish.add(this.forward);
    if (input.isActive('backward')) this.wish.sub(this.forward);
    if (input.isActive('right')) this.wish.add(this.right);
    if (input.isActive('left')) this.wish.sub(this.right);

    // Sans normalisation, aller en diagonale serait 1,41 fois plus rapide.
    if (this.wish.lengthSq() > 0) this.wish.normalize();

    const speed = input.isActive('run') ? RUN_SPEED : WALK_SPEED;

    // --- Acceleration progressive ---------------------------------
    const smoothing = 1 - Math.exp(-ACCELERATION * deltaTime);
    this.velocity.x += (this.wish.x * speed - this.velocity.x) * smoothing;
    this.velocity.z += (this.wish.z * speed - this.velocity.z) * smoothing;

    // --- Gravite --------------------------------------------------
    this.velocity.y += GRAVITY * deltaTime;

    // --- Deplacement ----------------------------------------------
    // Toutes les vitesses sont en unites PAR SECONDE.
    this.position.addScaledVector(this.velocity, deltaTime);

    // --- Collisions -----------------------------------------------
    this.resolveCollisions(deltaTime);
  }

  /**
   * Repousse le joueur hors des murs et du sol, puis corrige sa vitesse.
   *
   * C'est la seule methode qui a change entre la Phase 2A et la 2B :
   * tout le reste du joueur est identique.
   */
  private resolveCollisions(deltaTime: number): void {
    if (!this.collider) {
      this.grounded = false;
      return;
    }

    // Filet de securite : si le joueur est passe sous le decor (bug de
    // geometrie, trou dans un futur modele), on le ramene au depart
    // plutot que de le laisser tomber indefiniment.
    if (this.position.y < FALL_LIMIT) {
      this.spawn(this.spawnPoint, this.spawnYaw);
      return;
    }

    this.beforeCollision.copy(this.position);

    // Axe de la capsule : du centre de la demi-sphere basse au centre de
    // la demi-sphere haute. D'ou les deux decalages d'un rayon.
    this.capsule.start.set(
      this.position.x,
      this.position.y + RADIUS,
      this.position.z,
    );
    this.capsule.end.set(
      this.position.x,
      this.position.y + HEIGHT - RADIUS,
      this.position.z,
    );

    this.collider.resolveCapsule(this.capsule, RADIUS);

    // Le segment a ete repousse : on en deduit la nouvelle position des pieds.
    this.correction.set(
      this.capsule.start.x,
      this.capsule.start.y - RADIUS,
      this.capsule.start.z,
    );
    this.correction.sub(this.beforeCollision);

    const pushLength = this.correction.length();

    if (pushLength < 1e-10) {
      // Aucun contact : le joueur est en l'air (chute ou saut d'une marche).
      this.grounded = false;
      return;
    }

    // On retire un cheveu a la correction. Sans cela, le joueur est
    // repousse pile au contact, penetre a nouveau a l'image suivante,
    // est repousse... et la vue tremble legerement en permanence.
    const offset = Math.max(0, pushLength - 1e-5);
    this.correction.multiplyScalar(offset / pushLength);

    this.surfaceNormal.copy(this.correction).normalize();

    // Sol ou mur ? Si la correction est surtout verticale et depasse ce que
    // la chute de cette image aurait provoque, c'est que le joueur repose
    // sur une surface porteuse.
    this.grounded = this.correction.y > Math.abs(deltaTime * this.velocity.y * 0.25);

    // Sur une surface PORTEUSE (sol plat, pente douce), on ne conserve que
    // la remontee verticale. Sans cela, la poussee qui compense la gravite
    // a aussi une composante horizontale, et le joueur glisserait tout seul
    // le long de la moindre pente, meme a l'arret.
    // Sur un mur ou une marche, la normale est bien plus inclinee : la
    // composante horizontale est conservee, donc le blocage et la montee
    // des marches fonctionnent normalement.
    if (this.grounded && this.surfaceNormal.y > GROUND_NORMAL_Y) {
      this.correction.x = 0;
      this.correction.z = 0;
    }

    this.position.copy(this.beforeCollision).add(this.correction);

    if (this.grounded) {
      // Au sol : on annule seulement la chute. La vitesse horizontale est
      // conservee telle quelle, et c'est ESSENTIEL : c'est la poussee de
      // la surface, image apres image, qui souleve le joueur le long des
      // pentes et par-dessus les marches. Annuler cette vitesse ici
      // reviendrait a supprimer l'elan qui le fait monter -- le joueur
      // resterait bloque devant la premiere marche.
      this.velocity.y = 0;
    } else {
      // En l'air : on retire la part de vitesse qui rentre dans la
      // surface, et uniquement celle-la. La part parallele est conservee,
      // ce qui permet de glisser le long d'un mur au lieu de s'y coller.
      const intoSurface = this.surfaceNormal.dot(this.velocity);
      if (intoSurface < 0) {
        this.velocity.addScaledVector(this.surfaceNormal, -intoSurface);
      }
    }
  }
}
