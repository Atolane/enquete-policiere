/* ===================================================================
   src/player/FpsCamera.ts

   Le REGARD du joueur, et rien d'autre. Cette classe ne gere ni la
   position, ni les deplacements : elle ne connait que deux angles.

     - yaw   : rotation gauche/droite (autour de l'axe vertical Y)
     - pitch : lever/baisser les yeux  (autour de l'axe horizontal X)

   Le "yaw" est aussi utilise par Player pour savoir dans quelle
   direction avancer : on marche dans la direction du regard horizontal.
   =================================================================== */

import * as THREE from 'three';

/** Radians de rotation par pixel de souris. */
const DEFAULT_SENSITIVITY = 0.0022;

/** On ne peut pas lever les yeux au-dela de 88 degres (sinon la vue se retourne). */
const MAX_PITCH = THREE.MathUtils.degToRad(88);

export class FpsCamera {
  yaw = 0;
  pitch = 0;
  sensitivity = DEFAULT_SENSITIVITY;

  /** Applique un mouvement de souris, en pixels. */
  applyMouseDelta(deltaX: number, deltaY: number): void {
    // Signes negatifs : deplacer la souris a droite doit faire tourner la
    // tete vers la droite, ce qui correspond a un yaw qui DIMINUE dans le
    // repere de Three.js.
    this.yaw -= deltaX * this.sensitivity;
    this.pitch -= deltaY * this.sensitivity;

    // Bornage vertical : indispensable, sinon on fait des saltos.
    this.pitch = THREE.MathUtils.clamp(this.pitch, -MAX_PITCH, MAX_PITCH);
  }

  /** Recopie les angles dans la vraie camera Three.js. */
  applyTo(camera: THREE.PerspectiveCamera): void {
    // Fonctionne parce que Engine a defini camera.rotation.order = 'YXZ'.
    camera.rotation.y = this.yaw;
    camera.rotation.x = this.pitch;
    camera.rotation.z = 0;
  }
}
