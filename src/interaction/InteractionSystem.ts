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
       mesh.userData.interactable = { kind: 'clue', clueId: 'ashtray' }

   Le systeme ne sait RIEN de l'enquete : il ne connait ni les indices,
   ni les suspects. Il transporte un identifiant sans savoir ce qu'il
   designe. Il se contente de signaler "le joueur vise ceci" et "le
   joueur a clique dessus" ; c'est Game.ts qui decide ce que cela
   signifie et qui va chercher les mots dans le catalogue.

   -------------------------------------------------------------------
   POURQUOI LE PREMIER OBJET TOUCHE, ET PAS "LE PREMIER OBJET
   INTERACTIF TOUCHE"
   -------------------------------------------------------------------
   Si on ne testait que les objets interactifs, on pourrait ramasser un
   indice a travers un mur. En prenant le premier objet rencontre, quel
   qu'il soit, un mur ou une caisse masque naturellement ce qui est
   derriere. C'est plus juste, et c'est gratuit.

   ... a une exception pres : les objets INVISIBLES.

   Contrairement a ce qu'on pourrait croire, le Raycaster de Three.js ne
   tient aucun compte de la propriete "visible" : un objet masque est
   touche comme un autre. Or les decors importes contiennent une forme
   de collision invisible qui enveloppe tout. Sans precaution, ce volume
   serait toujours le premier objet touche et PLUS AUCUN objet ne serait
   observable. On ignore donc les objets invisibles : ils ne sont ni
   cible, ni obstacle au regard.
   =================================================================== */

import * as THREE from 'three';

/**
 * Donnees portees par un objet observable.
 *
 * -------------------------------------------------------------------
 * TROIS SORTES DE CIBLES, ET POURQUOI C'EST UN TYPE UNION
 * -------------------------------------------------------------------
 * Un indice ne porte QUE son identifiant : ses textes sont ecrits dans
 * src/data/, une seule fois. Cette union n'est pas une coquetterie de
 * typage, c'est la garantie mecanique de cette regle -- ecrire le texte
 * d'un indice dans la scene 3D ne compile pas.
 *
 * Un objet ordinaire, lui, porte son propre texte : il n'appartient pas
 * a l'affaire, il n'a donc rien a faire dans son catalogue. Tout n'est
 * pas une preuve.
 *
 * Le systeme ne sait toujours rien de l'enquete : il transporte un
 * identifiant sans savoir ce qu'il designe.
 */
export type Interactable =
  /** Un indice. La scene fournit l'identifiant, le catalogue les mots. */
  | { kind: 'clue'; clueId: string }
  /** Un personnage a interroger. */
  | { kind: 'character'; characterId: string; title: string; prompt: string }
  /** Un objet observable qui n'est pas un indice : il porte ses textes. */
  | { kind: 'prop'; title: string; prompt: string; info: string };

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
    // Les resultats sont deja tries du plus proche au plus lointain.
    const hits = this.raycaster.intersectObjects(this.scene.children, true);

    for (const hit of hits) {
      // Les objets invisibles (formes de collision, ancres) sont
      // transparents pour le regard : on passe au suivant.
      if (!isVisible(hit.object)) continue;

      // Premier objet VISIBLE touche : lui seul compte. S'il n'est pas
      // observable, c'est qu'il masque ce qui se trouve derriere.
      const data = hit.object.userData.interactable;
      return (data as Interactable | undefined) ?? null;
    }

    return null;
  }
}

/**
 * Un objet est reellement visible seulement si lui ET tous ses parents
 * le sont : masquer un groupe masque tout son contenu.
 */
function isVisible(object: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = object;
  while (node) {
    if (!node.visible) return false;
    node = node.parent;
  }
  return true;
}
