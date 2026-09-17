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

  private readonly clock = new THREE.Clock();
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

    // Ombres douces. Reglage volontairement modeste : l'eclairage final
    // sera travaille bien plus tard.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // fov 70 : un champ de vision un peu large, confortable en vue FPS.
    // 0.1 / 100 = distances minimale et maximale visibles, en metres.
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);

    // Ordre de rotation OBLIGATOIRE pour une camera FPS.
    // 'YXZ' signifie : d'abord tourner la tete horizontalement (Y),
    // ensuite lever/baisser les yeux (X). Avec l'ordre par defaut ('XYZ'),
    // la vue se met a rouler sur le cote des qu'on regarde en hauteur.
    this.camera.rotation.order = 'YXZ';

    this.resize();
    window.addEventListener('resize', this.handleResize);
  }

  /** Demarre la boucle. "update" est appele avant chaque image. */
  run(update: (deltaTime: number) => void): void {
    this.clock.start();
    this.renderer.setAnimationLoop(() => {
      // Si l'onglet passe en arriere-plan, getDelta() peut renvoyer plusieurs
      // secondes au retour. On plafonne a 0.1 s pour eviter que le joueur ne
      // traverse la piece d'un coup.
      const deltaTime = Math.min(this.clock.getDelta(), 0.1);
      update(deltaTime);
    });
  }

  render(scene: THREE.Scene): void {
    this.renderer.render(scene, this.camera);
  }

  stop(): void {
    this.renderer.setAnimationLoop(null);
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
