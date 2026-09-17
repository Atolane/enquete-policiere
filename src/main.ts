/* ===================================================================
   src/main.ts — POINT D'ENTREE DU JEU

   Ce fichier reste volontairement minuscule : il trouve le canvas,
   charge les assets, puis demarre le jeu. Toute la logique est dans
   src/Game.ts et dans les modules qu'il assemble.
   =================================================================== */

import './ui/styles/main.css';
import { Game } from './Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) {
  throw new Error('Canvas #game-canvas introuvable dans index.html');
}

const game = new Game(canvas);

// "await" au premier niveau du fichier : possible dans un module ES.
// Le jeu ne demarre qu'une fois les modeles telecharges.
try {
  await game.load();
  game.start();
  console.info('[Phase 3] Modeles charges, jeu demarre.');
} catch (error) {
  // Un chemin de fichier errone ou un reseau coupe affiche un message
  // clair au lieu d'une page noire inexplicable.
  game.showLoadingError(error);
}
