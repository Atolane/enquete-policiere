/* ===================================================================
   src/main.ts — POINT D'ENTREE DU JEU

   PHASE 1 : ce fichier ne contient volontairement AUCUN gameplay.
   Son unique role est de prouver que la chaine technique fonctionne :
   Vite sert le projet -> TypeScript compile -> Three.js dessine -> le
   navigateur affiche une image animee a 60 images par seconde.

   Le cube qui tourne est un TEMOIN DE BON FONCTIONNEMENT. Il sera
   remplace en Phase 2 par la vraie piece de test et le joueur FPS.
   =================================================================== */

// Importer le CSS depuis TypeScript peut surprendre : c'est Vite qui le
// permet. Il l'injecte pendant le developpement et le regroupe au build.
import './ui/styles/main.css';

// On importe tout Three.js sous le nom "THREE".
import * as THREE from 'three';

// -------------------------------------------------------------------
// 1. Le canvas : la zone de dessin declaree dans index.html
// -------------------------------------------------------------------
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) {
  throw new Error('Canvas #game-canvas introuvable dans index.html');
}

// -------------------------------------------------------------------
// 2. Le renderer : l'objet qui parle a la carte graphique (WebGL)
// -------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

// Sur un ecran haute densite (Retina), le navigateur peut demander un rendu
// 2x ou 3x plus grand, ce qui coute 4x a 9x plus de puissance. On plafonne
// a 1.5 : la difference est a peine visible, le gain de performance est enorme.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

// Gestion correcte des couleurs. Sans ces deux lignes, l'image parait
// delavee et les eclairages sombres (notre cas) sortent mal.
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// -------------------------------------------------------------------
// 3. La scene : le "conteneur" de tout ce qui existe en 3D
// -------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090d);

// -------------------------------------------------------------------
// 4. La camera : le point de vue
//    (75 = champ de vision, puis ratio de l'ecran, puis distances
//     minimale et maximale visibles)
// -------------------------------------------------------------------
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0, 3);

// -------------------------------------------------------------------
// 5. Lumieres : sans lumiere, un materiau realiste reste noir
// -------------------------------------------------------------------
const keyLight = new THREE.DirectionalLight(0xfff0d8, 2.5); // chaude, principale
keyLight.position.set(2, 3, 4);
scene.add(keyLight);

const fillLight = new THREE.AmbientLight(0x3a4a66, 0.6); // froide, tres faible
scene.add(fillLight);

// -------------------------------------------------------------------
// 6. Le cube temoin
//    Un objet 3D = une geometrie (la forme) + un materiau (l'apparence)
// -------------------------------------------------------------------
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x9c7a4a, roughness: 0.6, metalness: 0.1 }),
);
scene.add(cube);

// -------------------------------------------------------------------
// 7. Redimensionnement : garder l'image nette si la fenetre change
// -------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix(); // obligatoire apres avoir change "aspect"
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// -------------------------------------------------------------------
// 8. La boucle de rendu
//    Appelee ~60 fois par seconde par le navigateur.
//    "deltaTime" = temps ecoule depuis la derniere image, en secondes.
//    On l'utilise systematiquement pour que la vitesse du jeu soit la
//    meme sur un ecran 60 Hz et sur un ecran 144 Hz.
// -------------------------------------------------------------------
const clock = new THREE.Clock();

function animate(): void {
  const deltaTime = clock.getDelta();

  cube.rotation.x += deltaTime * 0.4;
  cube.rotation.y += deltaTime * 0.6;

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// Trace de demarrage, visible dans la console du navigateur (touche F12).
console.info('[Phase 1] Three.js', THREE.REVISION, '— socle technique operationnel.');
