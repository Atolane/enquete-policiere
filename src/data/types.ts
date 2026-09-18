/* ===================================================================
   src/data/types.ts

   LE FORMAT DANS LEQUEL L'AFFAIRE SERA ECRITE.

   Ce fichier ne contient aucune donnee : seulement les formes que
   prendront les questions, les temoignages et les reactions. C'est le
   contrat entre l'auteur de l'enquete et le moteur.

   -------------------------------------------------------------------
   REGLE ABSOLUE DU PROJET
   -------------------------------------------------------------------
   Le champ Statement.truth dit si une declaration est vraie. Il est
   STRICTEMENT INTERNE : il sert au moteur (pour valider, en Phase 8,
   une contradiction que LE JOUEUR aura proposee), et il ne doit jamais
   atteindre l'ecran.

   La garantie n'est pas une convention mais une frontiere de type :
   l'interface ne recoit jamais un Statement, elle recoit un
   StatementView, qui ne possede pas ce champ.
   =================================================================== */

/* --- Identifiants -------------------------------------------------
   De simples chaines. Un validateur verifie au demarrage que tout
   identifiant reference existe reellement : une faute de frappe est
   signalee immediatement, avec le nom du fautif. */
export type CharacterId = string;
export type ClueId = string;
export type TopicId = string;
export type StatementId = string;
export type FactId = string;

/** Geste ponctuel joue pendant une replique, puis relache. */
export type Beat = 'agree' | 'deny' | 'dismiss' | 'think';

/** Attitude persistante d'un personnage pendant l'entretien. */
export type Mood = 'neutral' | 'guarded' | 'nervous' | 'hostile';

/** Une replique. */
export interface DialogueLine {
  /** 'detective' pour le joueur, sinon l'identifiant du personnage. */
  speaker: 'detective' | CharacterId;
  text: string;
  /** Geste joue au moment de la replique. */
  beat?: Beat;
  /** Hesitation avant de repondre, en secondes. Un silence en dit long. */
  pause?: number;
}

/**
 * Conditions d'apparition d'une question.
 * TOUTES les conditions listees doivent etre satisfaites.
 */
export interface Condition {
  clues?: ClueId[];
  facts?: FactId[];
  topicsAsked?: TopicId[];
  topicsNotAsked?: TopicId[];
  statementsHeard?: StatementId[];
  /** Il ne dira cela que s'il est deja dans l'une de ces humeurs. */
  mood?: Mood[];
}

/** Ce qu'une question change dans l'etat de l'enquete. */
export interface Effect {
  revealFacts?: FactId[];
  /** Rend disponibles des questions qui ne l'etaient pas. */
  unlockTopics?: TopicId[];
  setMood?: Mood;
  /** Le personnage met fin a l'entretien. */
  endInterrogation?: boolean;
}

/** Une question posable a un personnage. */
export interface DialogueTopic {
  id: TopicId;
  speaker: CharacterId;
  /** Ce que l'inspecteur demande, tel qu'affiche dans la liste. */
  question: string;
  /** Regroupement affiche dans la liste. */
  category: 'ouverture' | 'emploi du temps' | 'les gens' | 'les faits' | 'pression';
  requires?: Condition;
  lines: DialogueLine[];
  /** Ce que le personnage affirme en repondant. */
  records?: StatementId[];
  effects?: Effect;
  /**
   * La question disparait-elle une fois posee ? Vrai par defaut.
   * Une esquive ou un refus se met a false : le joueur doit pouvoir
   * reessayer plus tard, quand le personnage sera moins sur de lui.
   */
  once?: boolean;
}

/**
 * Une declaration faite par un personnage.
 *
 * C'est la brique de l'enquete : le carnet listera ces declarations,
 * et c'est en les comparant entre elles et avec les indices que le
 * joueur trouvera les contradictions -- lui-meme, pas le jeu.
 */
export interface Statement {
  id: StatementId;
  speaker: CharacterId;
  /** Texte a la premiere personne, tel que le carnet l'affichera. */
  text: string;
  /** Rubrique : « Emploi du temps », « La victime »... */
  topic: string;
  /** Heure affirmee, ex. '21:30'. Servira a la chronologie. */
  claimedTime?: string;

  /** INTERNE. Jamais affiche, jamais transmis a l'interface. */
  truth: 'true' | 'false' | 'partial';

  /** Phase 5B : cette declaration en remplace une precedente. */
  supersedes?: StatementId;
}

/**
 * Ce que l'interface a le droit de voir d'une declaration.
 * Noter l'absence de "truth" : c'est la garantie, par le type.
 */
export interface StatementView {
  id: StatementId;
  speaker: CharacterId;
  text: string;
  topic: string;
  claimedTime?: string;
}

/** Fiche d'un personnage interrogeable. */
export interface CharacterSheet {
  id: CharacterId;
  /** Nom affiche en tete du panneau d'interrogatoire. */
  name: string;
  /** Qualite : « gerant du restaurant », « serveuse »... */
  role: string;
  /** Humeur au tout premier entretien. */
  initialMood: Mood;
}

/** Tout le contenu d'une affaire. */
export interface CaseData {
  characters: CharacterSheet[];
  topics: DialogueTopic[];
  statements: Statement[];
}
