/* ===================================================================
   src/main.ts — POINT D'ENTREE DU JEU

   Ce fichier reste volontairement minuscule : il ne fait que trouver le
   canvas et demarrer le jeu. Toute la logique est dans src/Game.ts et
   dans les modules qu'il assemble.
   =================================================================== */

import './ui/styles/main.css';
import { Game } from './Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) {
  throw new Error('Canvas #game-canvas introuvable dans index.html');
}

const game = new Game(canvas);
game.start();

console.info('[Phase 2A] Socle FPS demarre. Cliquer sur la page pour jouer.');
