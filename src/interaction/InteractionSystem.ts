/* ===================================================================
   src/interaction/InteractionSystem.ts

   "Qu'est-ce que je regarde, et puis-je agir dessus ?"

   -------------------------------------------------------------------
   LE PRINCIPE
   -------------------------------------------------------------------
   A chaque image, on lance un RAYON depuis le centre de l'ecran, dans
   l'axe du regard, sur une courte distance (2,5 m). Le premier objet
   touche est la cible du joueur.

   On regarde ensuite si cet objet porte des donnees d'interaction :
       mesh.userData.interactable = { id, title, prompt, info }

   Le systeme ne sait RIEN de l'enquete : il ne connait ni les indices,
   ni les suspects. Il se contente de signaler "le joueur vise ceci" et
   "le joueur a clique dessus". C'est le jeu qui decidera plus tard ce
   que cela signifie.

   -------------------------------------------------------------------
   POURQUOI LE PREMIER OBJET TOUCHE, ET PAS "LE PREMIER OBJET
   INTERACTIF TOUCHE"
   -------------------------------------------------------------------
   Si on ne testait que les objets interactifs, on pourrait ramasser un
   indice a travers un mur. En prenant le premier objet rencontre, quel
   qu'il soit, un mur ou une caisse masque naturellement ce qui est
   derriere. C'est plus juste, et c'est gratuit.
   =================================================================== */

import * as THREE from 'three';

/** Donnees portees par un objet observable. */
export interface Interactable {
  /** Identifiant stable, utilise plus tard par l'enquete. */
  id: string;
  /** Titre affiche en haut du panneau d'information. */
  title: string;
  /** Texte affiche sous le viseur. Ex. : "Examiner le cendrier" */
  prompt: string;
  /** Texte affiche au clic. */
  info: string;
}

/** Portee maximale du regard, en metres. */
const REACH = 2.5;

export class InteractionSystem {
  /** Cible actuelle, ou null si le joueur ne vise rien d'interactif. */
  target: Interactable | null = null;

  /** Appele quand la cible change (pour mettre a jour l'interface). */
  onTargetChange: ((target: Interactable | null) => void) | null = null;

  /** Appele quand le joueur agit sur la cible. */
  onInteract: ((target: Interactable) => void) | null = null;

  private readonly raycaster = new THREE.Raycaster();

  /** (0, 0) = le centre exact de l'ecran, la ou se trouve le viseur. */
  private readonly screenCenter = new THREE.Vector2(0, 0);

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.raycaster.far = REACH;
  }

  /** A appeler une fois par image. */
  update(): void {
    const found = this.findTarget();
    if (found === this.target) return; // rien de nouveau : on ne touche pas a l'interface
    this.target = found;
    this.onTargetChange?.(found);
  }

  /** A appeler au clic. Ne fait rien si le joueur ne vise rien. */
  activate(): void {
    if (this.target) this.onInteract?.(this.target);
  }

  /** Oublie la cible (a la perte du controle, par exemple). */
  clear(): void {
    if (this.target === null) return;
    this.target = null;
    this.onTargetChange?.(null);
  }

  private findTarget(): Interactable | null {
    this.raycaster.setFromCamera(this.screenCenter, this.camera);

    // true = on descend aussi dans les enfants des objets.
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    if (hits.length === 0) return null;

    // Seul le PREMIER objet rencontre compte (voir l'explication en tete).
    const data = hits[0].object.userData.interactable;
    return (data as Interactable | undefined) ?? null;
  }
}
