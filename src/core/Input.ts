/* ===================================================================
   src/core/Input.ts

   Centralise TOUTES les entrees du joueur : clavier, souris, Pointer Lock.
   Aucun autre fichier ne doit ajouter d'ecouteur d'evenement clavier :
   on passe toujours par ici.

   -------------------------------------------------------------------
   POURQUOI ZQSD *ET* WASD FONCTIONNENT SANS RIEN FAIRE DE SPECIAL
   -------------------------------------------------------------------
   On lit "event.code" et non "event.key".

   - event.key  = le CARACTERE produit. Il depend de la disposition du
                  clavier : 'z' sur un AZERTY, 'w' sur un QWERTY.
   - event.code = la POSITION PHYSIQUE de la touche, toujours nommee
                  d'apres un clavier QWERTY, quelle que soit la
                  disposition reelle.

   Consequence : la touche en haut a gauche du bloc de deplacement
   renvoie 'KeyW' dans les deux cas. Un joueur francais appuie sur Z,
   un joueur americain appuie sur W, et le code recoit 'KeyW'.

   Une seule table de correspondance couvre donc ZQSD et WASD, sans
   detection de langue et sans reglage. C'est aussi la methode utilisee
   par les vrais jeux.
   =================================================================== */

/** Les actions du jeu, independantes des touches physiques. */
export type InputAction = 'forward' | 'backward' | 'left' | 'right' | 'run';

/** Une action peut etre declenchee par plusieurs touches. */
const KEY_BINDINGS: Record<string, InputAction> = {
  // Bloc principal : Z/W (AZERTY/QWERTY), Q/A, S, D
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'left',
  KeyD: 'right',

  // Fleches directionnelles, en complement
  ArrowUp: 'forward',
  ArrowDown: 'backward',
  ArrowLeft: 'left',
  ArrowRight: 'right',

  // Marche rapide
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

export class Input {
  /** Actions actuellement maintenues. */
  private readonly active = new Set<InputAction>();

  /** Mouvement de souris accumule depuis la derniere image, en pixels. */
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;

  /** La souris est-elle capturee par le jeu ? */
  private locked = false;

  /** Les commandes de deplacement repondent-elles ?
      Mises en pause pendant la lecture d'une information. */
  private enabled = true;

  /** Appele quand le Pointer Lock est pris ou perdu (pour l'interface). */
  onLockChange: ((locked: boolean) => void) | null = null;

  /** Appele quand le joueur clique ALORS QUE la souris est deja capturee.
      Le tout premier clic, celui qui capture la souris, ne le declenche
      pas : sinon on activerait un objet en reprenant simplement la main. */
  onClick: (() => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('click', this.handleCanvasClick);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  isActive(action: InputAction): boolean {
    return this.enabled && this.active.has(action);
  }

  /**
   * Suspend ou retablit les commandes de deplacement et de regard.
   *
   * Les touches enfoncees restent memorisees : si le joueur maintient Z
   * pendant qu'il lit une information, il repart bien en avant a la
   * fermeture, sans avoir a relacher la touche.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      // On jette le mouvement de souris accumule, sinon la vue ferait un
      // bond au moment ou l'on rend la main au joueur.
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
    }
  }

  /**
   * Redemande la capture de la souris.
   *
   * Extrait du gestionnaire de clic en Phase 7B : le carnet rend la
   * souris en s'ouvrant (il faut pouvoir y cliquer et y faire defiler) et
   * la reprend en se refermant, sans obliger le joueur a recliquer.
   *
   * Le Pointer Lock exige un geste explicite de l'utilisateur : un appui
   * sur une touche en est un, le chargement de la page n'en est pas un.
   *
   * @returns une promesse TOUJOURS resolue, accordee ou refusee. Elle
   *   permet a l'appelant d'attendre l'issue sans avoir a la traiter :
   *   le carnet s'en sert pour ne pas faire clignoter le panneau
   *   d'accueil pendant les ~50 ms que prend le verrouillage.
   */
  requestLock(): Promise<void> {
    try {
      const request = this.canvas.requestPointerLock() as unknown;
      /* Les navigateurs recents renvoient une promesse ; les anciens ne
         renvoient rien. Chrome refuse le verrouillage pendant ~1 s apres
         un appui sur Echap : ce refus n'est pas une erreur, le panneau
         d'accueil reapparait et l'utilisateur recliquera. */
      if (request instanceof Promise) return request.catch(() => undefined);
      return Promise.resolve();
    } catch {
      /* navigateur sans Pointer Lock */
      return Promise.resolve();
    }
  }

  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Renvoie le mouvement de souris accumule ET le remet a zero.
   * A appeler exactement une fois par image.
   */
  consumeMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('click', this.handleCanvasClick);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  // ---------------------------------------------------------------
  // Gestionnaires d'evenements
  // (ecrits comme des proprietes flechees pour que "this" reste
  //  l'objet Input, et pour pouvoir les retirer dans dispose())
  // ---------------------------------------------------------------

  private handleKeyDown = (event: KeyboardEvent): void => {
    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    this.active.add(action);
    // Empeche la page de defiler quand on utilise les fleches.
    event.preventDefault();
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_BINDINGS[event.code];
    if (action) this.active.delete(action);
  };

  /**
   * IMPORTANT : si la fenetre perd le focus (Alt+Tab) pendant qu'une touche
   * est enfoncee, le "keyup" n'arrive jamais et le joueur avancerait tout
   * seul indefiniment. On vide donc tout des que le focus est perdu.
   */
  private handleBlur = (): void => {
    this.active.clear();
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.locked || !this.enabled) return;
    // movementX/Y : deplacement RELATIF depuis le dernier evenement.
    // C'est la seule mesure utilisable quand le curseur est capture,
    // puisqu'il n'a plus de position a l'ecran.
    this.mouseDeltaX += event.movementX;
    this.mouseDeltaY += event.movementY;
  };

  private handleCanvasClick = (): void => {
    if (this.locked) {
      // Souris deja capturee : le clic est une action de jeu.
      this.onClick?.();
      return;
    }

    /* Commandes suspendues : on ne reprend PAS la souris. Sans cela,
       cliquer a cote du panneau d'interrogatoire ferait disparaitre le
       curseur, et le joueur ne pourrait plus choisir sa question. */
    if (!this.enabled) return;
    this.requestLock();
  };

  private handlePointerLockChange = (): void => {
    this.locked = document.pointerLockElement === this.canvas;
    // Meme precaution que pour blur : on ne garde pas de touche "collee".
    if (!this.locked) this.active.clear();
    this.onLockChange?.(this.locked);
  };
}
