/* ===================================================================
   src/game/Casebook.ts

   LE DOSSIER D'ENQUETE, cote donnees.

   Ce fichier transforme l'etat de l'enquete en quelque chose qui se lit.
   Il n'importe ni Three.js ni le DOM : il fabrique une VUE, et c'est
   ui/Notebook.ts qui la dessine. Meme separation que Interrogation et
   DialogueUI, qui a tenu sans une retouche sur deux phases.

   -------------------------------------------------------------------
   CE QUE LE DOSSIER NE FAIT PAS -- ET C'EST L'ESSENTIEL
   -------------------------------------------------------------------
   Il ne rapproche rien. Il ne trie rien. Il ne souligne rien.

   La tentation serait grande : on a sous la main les indices, les
   declarations et les heures affirmees ; trois lignes suffiraient a
   signaler au joueur que deux temoignages ne collent pas. Ce serait
   resoudre l'enquete a sa place.

   Le dossier se contente donc de RANGER, dans l'ordre ou le joueur a
   appris les choses :
     - les indices, par rubrique ;
     - les declarations, par personne puis par sujet ;
     - les faits acquis, par rubrique.

   Trois choses n'y figurent pas, volontairement : l'humeur des
   personnages (ce serait un jugement du moteur sur quelqu'un, alors que
   lire les gens est le travail du joueur), les questions deja posees
   (une liste de courses, pas un dossier) et les identifiants techniques.
   Elles restent visibles dans le releve ?etat=1, qui sert aux tests.

   -------------------------------------------------------------------
   LES CHANGEMENTS DE VERSION
   -------------------------------------------------------------------
   Quand un temoin s'est reprise, les deux versions apparaissent dans la
   meme entree, dans l'ordre ou il les a dites. Le dossier dit « il a
   dit ceci, puis il a dit cela » -- ce que le joueur a entendu de ses
   oreilles. Il ne dit jamais laquelle etait fausse : il ne le sait pas,
   et ce n'est pas son travail.
   =================================================================== */

import type { DialogueEngine } from './dialogue';
import type { GameState } from './GameState';

/** Intitule de repli quand un indice cite une rubrique qui n'existe pas. */
const UNFILED = 'Sans rubrique';

/** Une entree du dossier. */
export interface CasebookEntry {
  /** Intitule court : le nom d'un indice, le sujet d'une declaration. */
  label?: string;
  /**
   * Un paragraphe -- ou plusieurs, quand un temoin a change de version.
   * Toujours dans l'ordre ou le joueur les a entendus.
   */
  paragraphs: string[];
}

/** Un regroupement : une rubrique d'indices, ou une personne. */
export interface CasebookSection {
  title: string;
  /** Qualite d'un personnage. Absent pour les autres rubriques. */
  subtitle?: string;
  entries: CasebookEntry[];
}

/** Tout le dossier, pret a etre dessine. */
export interface CasebookView {
  clues: CasebookSection[];
  statements: CasebookSection[];
  facts: CasebookSection[];
  counts: { clues: number; statements: number; facts: number };
}

export class Casebook {
  constructor(
    private readonly dialogue: DialogueEngine,
    private readonly state: GameState,
  ) {}

  build(): CasebookView {
    return {
      clues: this.buildClues(),
      statements: this.buildStatements(),
      facts: this.buildFacts(),
      counts: {
        clues: this.state.data.discoveredClues.length,
        statements: this.state.data.heardStatements.length,
        facts: this.state.data.knownFacts.length,
      },
    };
  }

  /** Les indices ramasses, groupes par rubrique. */
  private buildClues(): CasebookSection[] {
    const sections = new Grouping();

    for (const id of this.state.data.discoveredClues) {
      const entry = this.dialogue.clue(id);
      if (!entry) continue; // deja signale au demarrage par le validateur

      /* Rubrique absente du catalogue : le validateur l'a deja nommee en
         console. On se rabat sur un intitule neutre plutot que d'ecrire
         l'identifiant a l'ecran -- le carnet ne montre jamais de
         plomberie au joueur. L'indice, lui, reste lisible. */
      const rubric = this.dialogue.clueRubric(entry.rubric);
      sections.push(
        entry.rubric,
        rubric?.label ?? UNFILED,
        { label: entry.name, paragraphs: [entry.description] },
      );
    }

    return sections.sections();
  }

  /** Les faits acquis, groupes par rubrique. */
  private buildFacts(): CasebookSection[] {
    const sections = new Grouping();

    for (const id of this.state.data.knownFacts) {
      const entry = this.dialogue.fact(id);
      if (!entry) continue;
      sections.push(entry.topic, entry.topic, { paragraphs: [entry.text] });
    }

    return sections.sections();
  }

  /**
   * Les declarations, par personne.
   *
   * Le travail delicat est ici : recoudre les changements de version.
   * Une declaration qui en remplace une autre (replacesId) ne fait pas
   * une nouvelle entree -- elle s'ajoute a celle qu'elle prolonge. Une
   * reprise de reprise fonctionnerait de la meme facon.
   *
   * Noter ce qui arrive ici : des StatementView. Le champ interne
   * "truth" n'existe pas sur ce type ; le dossier ne pourrait donc pas
   * juger meme s'il le voulait.
   */
  private buildStatements(): CasebookSection[] {
    const sections = new Grouping();
    /** Ou se trouve la declaration d'identifiant X, pour la prolonger. */
    const placed = new Map<string, CasebookEntry>();

    for (const view of this.dialogue.heardStatements()) {
      const sheet = this.dialogue.characterSheet(view.speaker);

      /* Une reprise prolonge l'entree existante -- a condition que le
         joueur ait bien entendu la premiere version. Sinon, elle vaut
         comme une declaration a part entiere : c'est tout ce qu'il a. */
      const previous = view.replacesId ? placed.get(view.replacesId) : undefined;
      if (previous) {
        previous.paragraphs.push(view.text);
        placed.set(view.id, previous);
        continue;
      }

      const entry: CasebookEntry = { label: view.topic, paragraphs: [view.text] };
      const who = sheet?.name ?? view.speaker;
      sections.push(who, who, entry, sheet?.role);
      placed.set(view.id, entry);
    }

    return sections.sections();
  }
}

/**
 * Regroupe des entrees, en conservant l'ordre d'apparition.
 *
 * L'ordre d'apparition est l'ordre dans lequel le joueur a appris les
 * choses. C'est le seul classement du dossier, et il est gratuit : ne
 * rien trier, c'est ne rien suggerer.
 *
 * La CLE et le TITRE sont deux choses distinctes depuis la Phase 7C-2.
 * Les indices se groupent par identifiant de rubrique et s'affichent
 * sous son libelle ; les declarations et les faits, eux, se groupent
 * sous le texte qu'ils affichent, et passent donc la meme valeur aux
 * deux. Grouper par la cle et non par le titre garantit que deux
 * rubriques renommees a l'identique ne fusionnent pas, et que l'ordre
 * de decouverte reste celui de la cle.
 */
class Grouping {
  private readonly order: string[] = [];
  private readonly byKey = new Map<string, CasebookSection>();

  push(key: string, title: string, entry: CasebookEntry, subtitle?: string): void {
    let section = this.byKey.get(key);
    if (!section) {
      section = { title, subtitle, entries: [] };
      this.byKey.set(key, section);
      this.order.push(key);
    }
    section.entries.push(entry);
  }

  sections(): CasebookSection[] {
    return this.order.map((key) => this.byKey.get(key)!);
  }
}
