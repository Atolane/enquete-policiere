/* ===================================================================
   tests/support/affaire.ts

   FABRIQUE DE DONNEES D'AFFAIRE POUR LES TESTS.

   Le validateur refuse beaucoup de choses, et c'est sa raison d'etre :
   un personnage sans reponse generique, un fait que rien ne revele, un
   personnage sans question de relance. Ecrire ces quatre lignes dans
   chaque test noierait la faute qu'on veut eprouver.

   affaire() rend donc un jeu de donnees MINIMAL ET VALIDE -- zero
   probleme au validateur -- que chaque test abime sur un seul point.
   C'est la seule facon d'affirmer « ce probleme vient de cette faute »
   plutot que « il y a des problemes ».
   =================================================================== */

import type {
  CaseData,
  CharacterSheet,
  ClueEntry,
  ClueRubric,
  DialogueTopic,
  EvidenceReaction,
  FactEntry,
  Statement,
} from '../../src/data/types';

export function personnage(partiel: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id: 'temoin',
    name: 'Un temoin',
    role: 'Passant',
    initialMood: 'neutral',
    defaultReaction: [{ speaker: 'temoin', text: 'Je ne vois pas le rapport.' }],
    ...partiel,
  };
}

/** Question de relance : sans condition et reposable. Le validateur en
    exige une par personnage, faute de quoi le joueur peut se bloquer. */
export function relance(speaker = 'temoin'): DialogueTopic {
  return {
    id: `${speaker}_relance`,
    speaker,
    question: 'Autre chose ?',
    category: 'ouverture',
    once: false,
    lines: [{ speaker, text: 'Non.' }],
  };
}

export function question(partiel: Partial<DialogueTopic> = {}): DialogueTopic {
  return {
    id: 'q1',
    speaker: 'temoin',
    question: 'Ou etiez-vous ?',
    category: 'emploi du temps',
    lines: [{ speaker: 'temoin', text: 'Chez moi.' }],
    ...partiel,
  };
}

export function declaration(partiel: Partial<Statement> = {}): Statement {
  return {
    id: 'd1',
    speaker: 'temoin',
    text: "J'etais chez moi.",
    topic: 'Emploi du temps',
    truth: 'true',
    ...partiel,
  };
}

export function rubrique(partiel: Partial<ClueRubric> = {}): ClueRubric {
  return { id: 'salle', label: 'La salle', ...partiel };
}

export function indice(partiel: Partial<ClueEntry> = {}): ClueEntry {
  return {
    id: 'i1',
    name: 'Un cendrier',
    prompt: 'Examiner le cendrier',
    description: 'Trois megots, deux marques differentes.',
    rubric: 'salle',
    ...partiel,
  };
}

export function fait(partiel: Partial<FactEntry> = {}): FactEntry {
  return { id: 'f1', text: 'Deux personnes ont fume ici.', topic: 'La soiree', ...partiel };
}

export function reaction(partiel: Partial<EvidenceReaction> = {}): EvidenceReaction {
  return {
    character: 'temoin',
    clue: 'i1',
    lines: [{ speaker: 'temoin', text: 'Ce cendrier ne me dit rien.' }],
    ...partiel,
  };
}

/**
 * Une affaire minimale et VALIDE.
 *
 * Le fait f1 doit etre revele par quelque chose, sinon le validateur le
 * signale comme contenu mort : c'est la question q1 qui s'en charge.
 */
export function affaire(partiel: Partial<CaseData> = {}): CaseData {
  return {
    characters: [personnage()],
    topics: [relance(), question({ effects: { revealFacts: ['f1'] } })],
    statements: [declaration()],
    clues: [indice()],
    clueRubrics: [rubrique()],
    facts: [fait()],
    reactions: [reaction()],
    ...partiel,
  };
}
