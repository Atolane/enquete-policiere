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

  /** Appele a chaque modification. L'interface s'y branche. */
  onChange: (() => void) | null = null;

  constructor(data: InvestigationState = createState()) {
    this.data = data;
  }

  // --- Lecture ------------------------------------------------------

  hasClue(id: ClueId): boolean {
    return this.data.discoveredClues.includes(id);
  }

  hasFact(id: FactId): boolean {
    return this.data.knownFacts.includes(id);
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

  setMood(character: CharacterId, mood: Mood): void {
    if (this.data.moods[character] === mood) return;
    this.data.moods[character] = mood;
    this.onChange?.();
  }

  /** Ajoute un identifiant s'il n'y est pas deja. Renvoie true si ajoute. */
  private push(
    key: 'discoveredClues' | 'heardStatements' | 'knownFacts' | 'askedTopics' | 'unlockedTopics',
    id: string,
  ): boolean {
    const list = this.data[key];
    if (list.includes(id)) return false;
    list.push(id);
    this.onChange?.();
    return true;
  }
}
