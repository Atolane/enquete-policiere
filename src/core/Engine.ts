/* ===================================================================
   src/core/Engine.ts

   Le "moteur" : tout ce qui est purement technique et qui ne connait
   RIEN du jeu (ni joueur, ni enquete, ni piece de test).

   Ses trois responsabilites :
     1. creer et configurer le renderer WebGL + la camera
     2. tenir la boucle de rendu et fournir un deltaTime fiable
     3. s'adapter quand la fenetre change de taille
   =================================================================== */

import * as THREE from 'three';

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;

  /* THREE.Timer remplace THREE.Clock, desormais deprecie.
     Avantage concret : connect(document) utilise l'API Page Visibility,
     donc revenir sur l'onglet apres plusieurs minutes ne produit pas un
     deltaTime gigantesque. Notre plafond a 0,1 s reste comme second
     filet de securite (changement d'onglet non detecte, machine gelee). */
  private readonly timer = new THREE.Timer();
  private readonly handleResize = () => this.resize();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

    // Plafonne le rendu sur les ecrans haute densite : au-dela de 1.5 le cout
    // grimpe au carre pour une difference a peine visible.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    // Gestion correcte des couleurs (sinon l'image parait delavee).
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Ombres. Reglage volontairement modeste : l'eclairage final sera
    // travaille bien plus tard.
    // PCFSoftShadowMap a ete retire de Three.js : il etait silencieusement
    // remplace par PCFShadowMap avec un avertissement dans la console. On
    // demande donc directement PCFShadowMap.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // fov 70 : un champ de vision un peu large, confortable en vue FPS.
    // 0.1 / 100 = distances minimale et maximale visibles, en metres.
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);

    // Ordre de rotation OBLIGATOIRE pour une camera FPS.
    // 'YXZ' signifie : d'abord tourner la tete horizontalement (Y),
    // ensuite lever/baisser les yeux (X). Avec l'ordre par defaut ('XYZ'),
    // la vue se met a rouler sur le cote des qu'on regarde en hauteur.
    this.camera.rotation.order = 'YXZ';

    this.timer.connect(document);

    this.resize();
    window.addEventListener('resize', this.handleResize);
  }

  /** Demarre la boucle. "update" est appele avant chaque image. */
  run(update: (deltaTime: number) => void): void {
    this.renderer.setAnimationLoop(() => {
      this.timer.update();
      // Plafond de securite : si une image dure anormalement longtemps,
      // le joueur ne doit pas traverser la piece d'un coup.
      const deltaTime = Math.min(this.timer.getDelta(), 0.1);
      update(deltaTime);
    });
  }

  render(scene: THREE.Scene): void {
    this.renderer.render(scene, this.camera);
  }

  stop(): void {
    this.renderer.setAnimationLoop(null);
    this.timer.disconnect();
    window.removeEventListener('resize', this.handleResize);
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix(); // obligatoire apres avoir change aspect
    this.renderer.setSize(width, height);
  }
}
