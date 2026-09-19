/* ===================================================================
   src/ui/StateReport.ts

   LE RELEVE D'ETAT — un instrument de controle, pas le carnet.

   -------------------------------------------------------------------
   A QUOI IL SERT, ET A QUOI IL NE SERT PAS
   -------------------------------------------------------------------
   Il affiche le contenu brut de l'etat de l'enquete : ce qui a ete
   ramasse, entendu, appris, demande. Il repond a une question que rien
   ne permettait de verifier jusqu'ici autrement qu'en ouvrant la
   console : "est-ce que ce que je viens de faire a bien ete
   enregistre ?"

   Il est cache derriere ?etat=1, comme ?personnages=N l'est deja. Sans
   ce parametre, il n'existe pas : ni element dans la page, ni calcul.

   Ce N'EST PAS le carnet de police. Le carnet sera un vrai objet de
   jeu (Phase 7) : consultable a la demande, mis en page, regroupe par
   rubriques, et il mettra le jeu en pause. Celui-ci est un affichage de
   controle, volontairement laid, qui ne prend aucun clic et aucune
   touche. Quand le carnet arrivera, ce fichier pourra disparaitre sans
   que rien d'autre ne bouge -- c'est pour cela qu'il est seul dans son
   fichier.

   -------------------------------------------------------------------
   LA REGLE ABSOLUE S'APPLIQUE ICI AUSSI
   -------------------------------------------------------------------
   Le releve ne recoit que des donnees deja filtrees : des noms
   d'indices et des StatementView. Il ne voit aucun Statement complet,
   donc aucun champ "truth". Quand un personnage a change de version,
   les deux versions sont listees, et RIEN ne dit laquelle etait fausse.
   =================================================================== */

/** Ce que le releve a le droit de voir. Aucun champ interne. */
export interface StateSnapshot {
  clues: { id: string; name: string }[];
  statements: { id: string; text: string; replacesId?: string }[];
  /** Identifiants bruts : leurs libelles viendront avec la Phase 6B. */
  facts: string[];
  askedTopics: string[];
  moods: { character: string; mood: string }[];
}

export class StateReport {
  private readonly panel: HTMLDivElement;

  constructor() {
    const layer = document.querySelector<HTMLDivElement>('#ui-layer');
    if (!layer) throw new Error('Couche #ui-layer introuvable dans index.html');

    this.panel = document.createElement('div');
    this.panel.id = 'state-report';
    layer.appendChild(this.panel);
  }

  /** Redessine tout. L'etat est minuscule : inutile de faire plus fin. */
  show(snapshot: StateSnapshot): void {
    const blocks = [
      section(
        `Indices (${snapshot.clues.length})`,
        snapshot.clues.map((c) => `${c.id} — ${c.name}`),
      ),
      section(
        `Déclarations entendues (${snapshot.statements.length})`,
        snapshot.statements.map((s) =>
          s.replacesId ? `${s.id} (remplace ${s.replacesId}) — ${s.text}` : `${s.id} — ${s.text}`,
        ),
      ),
      section(`Faits acquis (${snapshot.facts.length})`, snapshot.facts),
      section(`Questions posées (${snapshot.askedTopics.length})`, snapshot.askedTopics),
      section(
        `Humeurs (${snapshot.moods.length})`,
        snapshot.moods.map((m) => `${m.character} : ${m.mood}`),
      ),
    ];

    this.panel.replaceChildren(...blocks);
  }

  dispose(): void {
    this.panel.remove();
  }
}

/**
 * Une rubrique du releve.
 *
 * On passe par textContent et non par innerHTML : les textes affiches
 * viennent des donnees de l'affaire, et un jour d'un fichier de
 * sauvegarde. Aucun d'eux n'a a etre interprete comme du HTML.
 */
function section(title: string, lines: string[]): HTMLDivElement {
  const block = document.createElement('div');
  block.className = 'state-block';

  const heading = document.createElement('p');
  heading.className = 'state-heading';
  heading.textContent = title;
  block.appendChild(heading);

  if (lines.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'state-empty';
    empty.textContent = '(rien)';
    block.appendChild(empty);
    return block;
  }

  const list = document.createElement('ul');
  list.className = 'state-list';
  for (const line of lines) {
    const item = document.createElement('li');
    item.textContent = line;
    list.appendChild(item);
  }
  block.appendChild(list);

  return block;
}
