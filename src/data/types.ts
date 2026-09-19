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

/* ===================================================================
   CE QUE L'ON PEUT PRESENTER (Phase 5B)
   =================================================================== */

/**
 * Un element brandi devant un personnage : un objet trouve sur place,
 * ou les propres mots de quelqu'un.
 */
export type Evidence =
  | { kind: 'clue'; id: ClueId }
  | { kind: 'statement'; id: StatementId };

/** Cle stable d'un element, pour la memoriser dans l'etat. */
export function evidenceKey(evidence: Evidence): string {
  return `${evidence.kind}:${evidence.id}`;
}

/**
 * Fiche d'un indice : TOUT ce que le joueur lit a son sujet.
 *
 * -------------------------------------------------------------------
 * SOURCE UNIQUE DE VERITE (Phase 6A)
 * -------------------------------------------------------------------
 * Ces textes vivaient auparavant dans la scene 3D, en double avec le
 * nom ecrit ici. Deux copies d'une meme chose finissent toujours par
 * diverger -- et c'etait deja arrive.
 *
 * Desormais la scene ne dit plus que « l'indice ashtray se ramasse
 * ici » ; tout le reste est ecrit une seule fois, a cet endroit. C'est
 * ce qui rendra possible des lieux importes depuis Blender : on ne
 * peut pas ecrire une phrase francaise dans un fichier .glb.
 *
 * Regle d'ecriture : une fiche d'indice CONSTATE, elle ne juge pas.
 * « Le combine est decroche » et non « il a donc menti sur l'appel ».
 * C'est au joueur de conclure.
 */
export interface ClueEntry {
  id: ClueId;
  /**
   * Nom de l'indice. Il sert partout : titre de sa fiche quand on
   * l'examine, libelle dans la liste des elements a presenter, et
   * demain rubrique du carnet. Un seul nom, un seul endroit.
   */
  name: string;
  /** Libelle affiche sous le viseur. Ex. : « Examiner le cendrier ». */
  prompt: string;
  /** Ce que l'inspecteur constate en l'examinant. */
  description: string;
}

/**
 * Un FAIT ACQUIS : quelque chose que le dossier tient pour etabli.
 *
 * -------------------------------------------------------------------
 * TROIS CHOSES BIEN DISTINCTES, ET IL FAUT LES GARDER DISTINCTES
 * -------------------------------------------------------------------
 *   un indice       un objet trouve sur place ;
 *   une declaration les mots de quelqu'un -- qui peuvent etre faux ;
 *   un fait         ce que l'enquete a etabli par ailleurs : une
 *                   expertise, un registre, un voisin interroge.
 *
 * Un fait ne vient JAMAIS de la parole d'un suspect. Si un personnage
 * l'affirme, c'est une declaration, pas un fait -- meme s'il dit vrai.
 * Confondre les deux ferait du moteur le juge de la verite, et c'est
 * exactement ce que ce jeu ne fait pas.
 *
 * A quoi cela sert, concretement : un fait ouvre des questions qui
 * n'auraient aucun sens avant lui. On ne demande pas a quelqu'un qui il
 * a appele tant que rien n'etablit qu'un appel a eu lieu.
 *
 * Regle d'ecriture, la meme que pour un indice : un fait CONSTATE.
 * « Un appel est parti de cette ligne apres vingt-deux heures » et non
 * « il a donc menti sur l'heure ». Noter qu'il n'y a ici aucun champ de
 * verite : un fait n'a pas a etre vrai ou faux, il est etabli.
 */
export interface FactEntry {
  id: FactId;
  /** Enonce tel que l'interface l'affichera, a la troisieme personne. */
  text: string;
  /** Rubrique : « La soiree », « La victime »... */
  topic: string;
}

/**
 * Ce qu'un personnage repond quand on lui presente un element precis.
 *
 * Il n'est JAMAIS necessaire d'ecrire toutes les combinaisons : sans
 * reaction specifique, le personnage sert sa reponse generique. Avec
 * 3 suspects et 12 indices, on n'ecrira que la quinzaine qui compte.
 */
export interface EvidenceReaction {
  character: CharacterId;
  /** L'element concerne : un indice OU une declaration, pas les deux. */
  clue?: ClueId;
  statement?: StatementId;
  /**
   * Conditions pour que cette reaction se declenche. Sinon, c'est la
   * reponse generique qui sert. On ne peut pas acculer quelqu'un sur un
   * dementi qu'il n'a pas encore fait.
   */
  requires?: Condition;
  lines: DialogueLine[];
  /** Ce qu'il concede en reagissant. */
  records?: StatementId[];
  effects?: Effect;
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
  /**
   * Question qui n'apparait JAMAIS d'elle-meme : seul un effet
   * (unlockTopics) peut l'ouvrir. C'est le personnage qui a mis le
   * sujet sur la table, pas l'inspecteur.
   */
  hidden?: boolean;
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

  /**
   * Cette declaration en remplace une precedente : le personnage a
   * change de version.
   *
   * Les DEUX versions restent dans l'etat de l'enquete. Le jeu ne dit
   * pas laquelle est vraie -- il se contente de montrer qu'il y en a eu
   * deux, ce que le joueur a de toute facon vu de ses yeux.
   */
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
  /**
   * Identifiant de la declaration que celle-ci remplace, s'il y a lieu.
   *
   * Ce n'est PAS une fuite : c'est un fait que le joueur a constate en
   * direct, pas un jugement. On dit « il a dit autre chose ensuite »,
   * jamais « la premiere version etait fausse ».
   */
  replacesId?: StatementId;
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
  /**
   * Ce qu'il repond quand on lui presente quelque chose qui ne lui
   * evoque rien. C'est ce repli qui rend l'ecriture soutenable.
   */
  defaultReaction: DialogueLine[];
}

/** Tout le contenu d'une affaire. */
export interface CaseData {
  characters: CharacterSheet[];
  topics: DialogueTopic[];
  statements: Statement[];
  clues: ClueEntry[];
  facts: FactEntry[];
  reactions: EvidenceReaction[];
}
