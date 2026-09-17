/* ===================================================================
   src/ui/Hud.ts

   Interface minimale de la Phase 2A, en HTML/CSS pur (pas de 3D).

   Deux elements :
     1. un panneau "Cliquer pour jouer" + rappel des touches, affiche
        tant que la souris n'est pas capturee ;
     2. un petit affichage de controle (images par seconde, position)
        qui sert uniquement a verifier la Phase 2A. Il disparaitra.
   =================================================================== */

export class Hud {
  private readonly lockPanel: HTMLDivElement;
  private readonly debugLine: HTMLDivElement;

  constructor() {
    const layer = document.querySelector<HTMLDivElement>('#ui-layer');
    if (!layer) throw new Error('Couche #ui-layer introuvable dans index.html');

    this.lockPanel = document.createElement('div');
    this.lockPanel.id = 'lock-panel';
    this.lockPanel.innerHTML = `
      <p class="lock-title">Cliquer pour prendre le contrôle</p>
      <ul class="lock-keys">
        <li><b>Z Q S D</b> ou <b>W A S D</b> — se déplacer</li>
        <li><b>Souris</b> — regarder autour de soi</li>
        <li><b>Maj</b> — marcher plus vite</li>
        <li><b>Échap</b> — libérer la souris</li>
      </ul>
    `;
    layer.appendChild(this.lockPanel);

    this.debugLine = document.createElement('div');
    this.debugLine.id = 'debug-line';
    layer.appendChild(this.debugLine);
  }

  /** Affiche ou masque le panneau selon l'etat du Pointer Lock. */
  setLocked(locked: boolean): void {
    this.lockPanel.classList.toggle('is-hidden', locked);
  }

  /** Ligne de controle temporaire. */
  setDebug(fps: number, x: number, y: number, z: number, grounded: boolean): void {
    this.debugLine.textContent =
      `${fps.toFixed(0)} img/s` +
      ` | x ${x.toFixed(2)}  y ${y.toFixed(2)}  z ${z.toFixed(2)}` +
      ` | ${grounded ? 'au sol' : 'en l’air'}`;
  }
}
