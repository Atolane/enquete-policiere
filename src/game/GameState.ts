/* ===================================================================
   src/game/GameState.ts

   L'ETAT DE L'ENQUETE.

   Ce fichier n'importe PAS Three.js, et ne le fera jamais. C'est la
   frontiere la plus importante du projet : l'etat de l'enquete ne
   contient que des identifiants, des booleens et des chaines.

   Deux consequences directes :
     - la sauvegarde de la Phase 7 sera un JSON.stringify de cet objet ;
     - la logique de l'enquete est verifiable sans lancer la 3D.
   =================================================================== */

import type { CharacterId, ClueId, FactId, Mood, StatementId, TopicId } from '../data/types';

/** Version du format, pour ignorer proprement une vieille sauvegarde. */
export const STATE_VERSION = 1;

export interface InvestigationState {
  version: number;
  discoveredClues: ClueId[];
  heardStatements: StatementId[];
  knownFacts: FactId[];
  askedTopics: TopicId[];
  /** Questions rendues disponibles par un effet de dialogue. */
  unlockedTopics: TopicId[];
  /**
   * Questions que le joueur a VU proposer, qu'il les ait posees ou non.
   *
   * Sert a une seule chose : distinguer « je ne l'ai pas encore posee »
   * de « je ne l'avais encore jamais vue ». Sans cette liste, le jeu ne
   * peut pas marquer une question comme nouvelle, ni dire chez qui
   * quelque chose a bouge -- il ne saurait que designer tous ceux qui
   * ont encore une question disponible, c'est-a-dire presque tout le
   * monde, presque tout le temps.
   *
   * Ajoutee apres coup : une sauvegarde ecrite avant son existence se
   * relit sans erreur et repart avec une liste vide (voir save.ts).
   */
  seenTopics: TopicId[];
  /** Elements deja presentes, sous la forme « personnage|kind:id ». */
  presentedEvidence: string[];
  moods: Record<CharacterId, Mood>;
}

export function createState(): InvestigationState {
  return {
    version: STATE_VERSION,
    discoveredClues: [],
    heardStatements: [],
    knownFacts: [],
    askedTopics: [],
    unlockedTopics: [],
    seenTopics: [],
    presentedEvidence: [],
    moods: {},
  };
}

/**
 * L'etat, plus les quelques operations qui ont le droit de le modifier.
 *
 * Passer par cette classe plutot que de toucher aux tableaux permet
 * deux choses : ne jamais enregistrer deux fois la meme chose, et
 * prevenir le reste du jeu quand quelque chose change.
 */
export class GameState {
  readonly data: InvestigationState;

  /**
   * Abonnes prevenus a chaque modification reelle de l'etat.
   *
   * -------------------------------------------------------------------
   * POURQUOI UNE LISTE, ET NON UN SEUL RAPPEL
   * -------------------------------------------------------------------
   * C'etait un seul rappel jusqu'a la Phase 7A, et un seul lecteur en
   * avait besoin : le releve ?etat=1. Le carnet en a besoin aussi. Avec
   * un champ unique, le second branchement aurait ECRASE le premier --
   * sans erreur, sans avertissement, et personne n'aurait vu que le
   * releve avait cesse de se mettre a jour.
   *
   * On passe donc par subscribe(), qui rend une fonction de
   * desabonnement. Deux lecteurs, deux abonnements, aucun conflit.
   */
  private readonly listeners = new Set<() => void>();

  constructor(data: InvestigationState = createState()) {
    this.data = data;
  }

  /**
   * Ecoute les modifications de l'etat.
   * @returns la fonction a appeler pour se desabonner.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Previent tout le monde. L'ordre des abonnes n'a aucune importance. */
  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  // --- Lecture ------------------------------------------------------

  hasClue(id: ClueId): boolean {
    return this.data.discoveredClues.includes(id);
  }

  hasFact(id: FactId): boolean {
    return this.data.knownFacts.includes(id);
  }

  /** Cette question a-t-elle deja ete proposee au joueur ? */
  hasSeen(id: TopicId): boolean {
    return this.data.seenTopics.includes(id);
  }

  hasHeard(id: StatementId): boolean {
    return this.data.heardStatements.includes(id);
  }

  hasAsked(id: TopicId): boolean {
    return this.data.askedTopics.includes(id);
  }

  isUnlocked(id: TopicId): boolean {
    return this.data.unlockedTopics.includes(id);
  }

  hasPresented(character: CharacterId, key: string): boolean {
    return this.data.presentedEvidence.includes(`${character}|${key}`);
  }

  moodOf(character: CharacterId, fallback: Mood = 'neutral'): Mood {
    return this.data.moods[character] ?? fallback;
  }

  // --- Ecriture -----------------------------------------------------

  discoverClue(id: ClueId): boolean {
    return this.push('discoveredClues', id);
  }

  hearStatement(id: StatementId): boolean {
    return this.push('heardStatements', id);
  }

  learnFact(id: FactId): boolean {
    return this.push('knownFacts', id);
  }

  markAsked(id: TopicId): boolean {
    return this.push('askedTopics', id);
  }

  unlockTopic(id: TopicId): boolean {
    return this.push('unlockedTopics', id);
  }

  /** Note qu'une question a ete PROPOSEE au joueur, posee ou non. */
  markSeen(id: TopicId): boolean {
    return this.push('seenTopics', id);
  }

  markPresented(character: CharacterId, key: string): boolean {
    return this.push('presentedEvidence', `${character}|${key}`);
  }

  /**
   * Ferme le personnage d'un cran : c'est le cout d'une preuve brandie
   * a tort.
   *
   * Volontairement LEGER, PLAFONNE et REVERSIBLE :
   *  - il ne va jamais au-dela de « guarded » ;
   *  - il ne touche pas a une humeur deja chargee (nervous, hostile),
   *    qui dit autre chose ;
   *  - une reaction reussie repose ensuite l'humeur ou elle veut.
   * Aucune question ne disparait, aucune piste ne se ferme : se tromper
   * doit couter quelque chose, jamais bloquer l'enquete.
   */
  closeUp(character: CharacterId): void {
    if (this.moodOf(character) === 'neutral') this.setMood(character, 'guarded');
  }

  setMood(character: CharacterId, mood: Mood): void {
    if (this.data.moods[character] === mood) return;
    this.data.moods[character] = mood;
    this.notify();
  }

  /** Ajoute un identifiant s'il n'y est pas deja. Renvoie true si ajoute. */
  private push(
    key: 'discoveredClues' | 'heardStatements' | 'knownFacts' | 'askedTopics'
      | 'unlockedTopics' | 'seenTopics' | 'presentedEvidence',
    id: string,
  ): boolean {
    const list = this.data[key];
    if (list.includes(id)) return false;
    list.push(id);
    this.notify();
    return true;
  }
}
