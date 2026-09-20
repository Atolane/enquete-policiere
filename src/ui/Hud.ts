/* ===================================================================
   src/ui/Hud.ts

   Interface a l'ecran, en HTML/CSS pur (pas de 3D).

   Cinq elements :
     0. l'ECRAN DE CHARGEMENT, affiche pendant le telechargement des
        modeles, avec une barre de progression ;
     1. le panneau "Cliquer pour jouer", tant que la souris n'est pas
        capturee ;
     2. le VISEUR au centre de l'ecran, qui s'ouvre quand on vise un
        objet observable ;
     3. le LIBELLE d'action sous le viseur ("Examiner le cendrier") ;
     4. le PANNEAU D'INFORMATION affiche au clic.

   Le HUD ne decide de rien : il se contente d'afficher ce qu'on lui
   demande. C'est Game qui pilote.
   =================================================================== */

import type * as THREE from 'three';
import type { Character } from '../world/Character';

export class Hud {
  private readonly lockPanel: HTMLDivElement;
  private readonly crosshair: HTMLDivElement;
  private readonly promptLine: HTMLDivElement;
  private readonly infoPanel: HTMLDivElement;
  private readonly infoTitle: HTMLParagraphElement;
  private readonly infoText: HTMLParagraphElement;
  private readonly infoNote: HTMLParagraphElement;
  private readonly debugLine: HTMLDivElement;
  private readonly characterLine: HTMLDivElement;
  private readonly loadingScreen: HTMLDivElement;
  private readonly loadingBar: HTMLDivElement;
  private readonly loadingLabel: HTMLParagraphElement;

  /* Le viseur depend de DEUX conditions : avoir le controle de la souris,
     et ne pas etre en train de lire une fiche. Les suivre separement et
     laisser chaque methode toucher la classe CSS menait a des etats
     incoherents (le viseur restait masque apres la fermeture d'une fiche).
     On memorise donc l'etat, et une seule methode decide de l'affichage. */
  private locked = false;
  private infoVisible = false;
  private inDialogue = false;
  private inNotebook = false;

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
        <li><b>Clic</b> — examiner ce que l'on regarde</li>
        <li><b>Échap</b> — libérer la souris</li>
      </ul>
    `;
    layer.appendChild(this.lockPanel);

    this.crosshair = document.createElement('div');
    this.crosshair.id = 'crosshair';
    layer.appendChild(this.crosshair);

    this.promptLine = document.createElement('div');
    this.promptLine.id = 'prompt-line';
    this.promptLine.classList.add('is-hidden'); // rien a annoncer au demarrage
    layer.appendChild(this.promptLine);

    this.infoPanel = document.createElement('div');
    this.infoPanel.id = 'info-panel';
    this.infoPanel.classList.add('is-hidden');
    this.infoTitle = document.createElement('p');
    this.infoTitle.className = 'info-title';
    this.infoText = document.createElement('p');
    this.infoText.className = 'info-text';
    /* Mention d'enregistrement (Phase 6A) : elle ne s'affiche que pour un
       objet qui est un indice. Un objet ordinaire n'en porte pas, et
       c'est ainsi que le joueur distingue les deux. */
    this.infoNote = document.createElement('p');
    this.infoNote.className = 'info-note';
    this.infoNote.classList.add('is-hidden');
    const infoHint = document.createElement('p');
    infoHint.className = 'info-hint';
    infoHint.textContent = 'Clic ou Échap pour fermer';
    this.infoPanel.append(this.infoTitle, this.infoText, this.infoNote, infoHint);
    layer.appendChild(this.infoPanel);

    this.debugLine = document.createElement('div');
    this.debugLine.id = 'debug-line';
    layer.appendChild(this.debugLine);

    this.characterLine = document.createElement('div');
    this.characterLine.id = 'debug-characters';
    layer.appendChild(this.characterLine);

    // Ecran de chargement : cree en dernier pour passer au-dessus du reste.
    this.loadingScreen = document.createElement('div');
    this.loadingScreen.id = 'loading-screen';
    const loadingTitle = document.createElement('p');
    loadingTitle.className = 'loading-title';
    loadingTitle.textContent = 'Chargement';
    this.loadingLabel = document.createElement('p');
    this.loadingLabel.className = 'loading-label';
    const track = document.createElement('div');
    track.className = 'loading-track';
    this.loadingBar = document.createElement('div');
    this.loadingBar.className = 'loading-bar';
    track.appendChild(this.loadingBar);
    this.loadingScreen.append(loadingTitle, track, this.loadingLabel);
    layer.appendChild(this.loadingScreen);
  }

  // ---------------------------------------------------------------
  // Chargement
  // ---------------------------------------------------------------

  setLoadingProgress(ratio: number, label = ''): void {
    this.loadingBar.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
    this.loadingLabel.textContent = label;
  }

  hideLoading(): void {
    this.loadingScreen.classList.add('is-hidden');
  }

  /**
   * Remplace l'ecran de chargement par un message d'erreur lisible.
   *
   * Sans cela, un simple chemin de fichier errone donnerait une page
   * noire sans explication, ce qui est le pire cas pour diagnostiquer.
   */
  showLoadingError(message: string): void {
    this.loadingScreen.classList.remove('is-hidden');
    this.loadingScreen.classList.add('is-error');
    this.loadingScreen.innerHTML = `
      <p class="loading-title">Chargement impossible</p>
      <p class="loading-error"></p>
      <p class="loading-label">Vérifiez la console du navigateur (F12) pour le détail.</p>
    `;
    const target = this.loadingScreen.querySelector('.loading-error');
    if (target) target.textContent = message;
  }

  /**
   * Affiche ou masque le panneau d'accueil selon l'etat du Pointer Lock.
   *
   * @param inDialogue pendant un entretien la souris est libre A DESSEIN :
   *                   le panneau « cliquer pour prendre le controle »
   *                   n'a alors aucun sens et masquerait les questions.
   */
  setLocked(locked: boolean, inDialogue = false): void {
    this.locked = locked;
    this.inDialogue = inDialogue;
    this.refreshOverlays();
  }

  /**
   * Le carnet est-il ouvert ? (Phase 7A)
   *
   * Comme pour le reste, on ne touche a aucune classe ici : on note
   * l'etat et on laisse refreshOverlays() decider. La Phase 2C a coute
   * une regression du viseur precisement parce que deux endroits
   * differents manipulaient sa classe.
   */
  setNotebookOpen(open: boolean): void {
    this.inNotebook = open;
    this.refreshOverlays();
  }

  /** Seul endroit qui decide de la visibilite du viseur ET du panneau. */
  private refreshOverlays(): void {
    this.lockPanel.classList.toggle(
      'is-hidden',
      this.locked || this.inDialogue || this.inNotebook,
    );
    this.refreshCrosshair();
  }

  /**
   * Met a jour le viseur et le libelle d'action.
   * @param prompt texte a afficher, ou null si le joueur ne vise rien.
   */
  setTarget(prompt: string | null): void {
    this.crosshair.classList.toggle('is-active', prompt !== null);
    this.promptLine.textContent = prompt ?? '';
    this.promptLine.classList.toggle('is-hidden', prompt === null || this.infoVisible);
  }

  /**
   * @param note mention d'enregistrement, ou null pour un objet qui
   *   n'est pas un indice.
   */
  showInfo(title: string, text: string, note: string | null = null): void {
    this.infoTitle.textContent = title;
    this.infoText.textContent = text;
    this.infoNote.textContent = note ?? '';
    this.infoNote.classList.toggle('is-hidden', note === null);
    this.infoVisible = true;
    this.infoPanel.classList.remove('is-hidden');
    // Pendant la lecture, ni viseur ni libelle : ils distrairaient.
    this.promptLine.classList.add('is-hidden');
    this.refreshCrosshair();
  }

  hideInfo(): void {
    this.infoVisible = false;
    this.infoPanel.classList.add('is-hidden');
    this.refreshCrosshair();
  }

  isInfoVisible(): boolean {
    return this.infoVisible;
  }

  /** Seul endroit qui decide si le viseur est visible. */
  private refreshCrosshair(): void {
    this.crosshair.classList.toggle(
      'is-hidden',
      !this.locked || this.infoVisible || this.inDialogue || this.inNotebook,
    );
    // Le libelle d'action n'a rien a annoncer derriere le carnet.
    if (this.inNotebook) this.promptLine.classList.add('is-hidden');
  }

  /**
   * Seconde ligne de controle : l'etat des personnages.
   *
   * Elle existe pour que le comportement soit MESURABLE et non pas
   * seulement "visiblement correct" : etat courant, nombre d'animations
   * en fondu, angle reel du regard et nombre de personnages animes.
   * Elle disparaitra avec les autres reperes de developpement.
   */
  setCharacterDebug(
    characters: readonly Character[],
    eye: THREE.Vector3,
    focused: Character | null = null,
    costMs = 0,
  ): void {
    if (characters.length === 0) {
      this.characterLine.textContent = '';
      return;
    }

    // On detaille celui qu'on regarde, a defaut le plus proche.
    let nearest = characters[0];
    let best = Infinity;
    let animated = 0;
    for (const character of characters) {
      if (character.animated) animated++;
      const d = character.root.position.distanceTo(eye);
      if (d < best) {
        best = d;
        nearest = character;
      }
    }

    if (focused) nearest = focused;

    this.characterLine.textContent =
      `pnj ${nearest.id} | ${nearest.state}/${nearest.mood}` +
      ` | clip ${nearest.currentClip} t=${nearest.currentTime.toFixed(2)}` +
      ` | fondu ${nearest.blending}` +
      ` | tete ${nearest.lookAngleDeg.toFixed(0)}° (rot ${nearest.appliedYawDeg.toFixed(0)}°${nearest.gazeAverted ? ' fuyant' : ''})` +
      ` | animes ${animated}/${characters.length}` +
      ` | dist ${best.toFixed(1)} m` +
      ` | cpu ${costMs.toFixed(2)} ms`;
  }

  /**
   * Ligne de controle technique. Temporaire.
   *
   * Le CAP (orientation du regard) y figure parce que la camera n'est pas
   * toujours pilotee par le joueur : un cadrage d'entretien la deplace.
   * Sans cette valeur affichee, impossible de savoir ou l'on regarde
   * reellement -- ni de le verifier automatiquement.
   */
  setDebug(
    fps: number, x: number, y: number, z: number, grounded: boolean,
    yawDeg = 0, pitchDeg = 0,
  ): void {
    this.debugLine.textContent =
      `${fps.toFixed(0)} img/s` +
      ` | x ${x.toFixed(2)}  y ${y.toFixed(2)}  z ${z.toFixed(2)}` +
      ` | cap ${yawDeg.toFixed(1)}° ${pitchDeg.toFixed(1)}°` +
      ` | ${grounded ? 'au sol' : 'en l’air'}`;
  }
}
