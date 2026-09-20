/* ===================================================================
   src/game/dialogue.ts

   LE MOTEUR DE DIALOGUE.

   Il repond a trois questions, et rien d'autre :
     1. quelles questions ce personnage accepte-t-il d'entendre ?
     2. que repond-il a celle-ci ?
     3. qu'est-ce que cela change dans l'enquete ?

   Il n'importe pas Three.js et ne connait ni l'affichage ni la 3D.

   -------------------------------------------------------------------
   IL NE JUGE JAMAIS
   -------------------------------------------------------------------
   Le moteur enregistre ce qui a ETE DIT. Il ne dit jamais ce qui est
   vrai. La seule fonction qui expose une declaration au reste du jeu
   est toView(), et elle retire le champ truth.
   =================================================================== */

import type {
  CaseData,
  CharacterId,
  Condition,
  ClueEntry,
  ClueId,
  DialogueLine,
  DialogueTopic,
  Evidence,
  FactEntry,
  FactId,
  EvidenceReaction,
  Statement,
  StatementView,
  TopicId,
} from '../data/types';
import { evidenceKey } from '../data/types';
import type { GameState } from './GameState';

/** Ce que l'interface affiche pour un element presentable. */
export interface EvidenceOption {
  evidence: Evidence;
  /** Nom court affiche dans la liste. */
  label: string;
  /** Rubrique affichee a droite : « indice » ou « déclaration ». */
  kind: string;
  /** Deja presente a ce personnage ? On le signale, sans l'interdire. */
  alreadyShown: boolean;
}

/** Ce qu'une presentation a produit. */
export interface ReactionResult {
  lines: DialogueLine[];
  /** false quand c'est la reponse generique : l'element n'evoquait rien. */
  specific: boolean;
}

export class DialogueEngine {
  private readonly topicsById = new Map<TopicId, DialogueTopic>();
  private readonly statementsById = new Map<string, Statement>();
  private readonly cluesById = new Map<string, ClueEntry>();
  private readonly factsById = new Map<string, FactEntry>();

  constructor(
    private readonly data: CaseData,
    private readonly state: GameState,
  ) {
    for (const topic of data.topics) this.topicsById.set(topic.id, topic);
    for (const statement of data.statements) this.statementsById.set(statement.id, statement);
    for (const clue of data.clues) this.cluesById.set(clue.id, clue);
    for (const fact of data.facts) this.factsById.set(fact.id, fact);
  }

  characterSheet(id: CharacterId) {
    return this.data.characters.find((c) => c.id === id) ?? null;
  }

  /**
   * La fiche d'un indice : son nom, son libelle d'action, son texte.
   *
   * C'est par ici que passent desormais TOUS les mots d'un indice, y
   * compris ceux que la scene 3D affichait elle-meme avant la Phase 6A.
   */
  clue(id: ClueId): ClueEntry | null {
    return this.cluesById.get(id) ?? null;
  }

  /**
   * L'enonce d'un fait acquis.
   *
   * Comme pour un indice, le texte est ecrit une seule fois dans les
   * donnees de l'affaire : rien ailleurs ne le recopie.
   */
  fact(id: FactId): FactEntry | null {
    return this.factsById.get(id) ?? null;
  }

  /**
   * Les questions actuellement posables a ce personnage.
   *
   * Une question est ecartee si elle a deja ete posee et qu'elle ne se
   * repose pas, ou si ses conditions ne sont pas satisfaites.
   */
  availableTopics(character: CharacterId): DialogueTopic[] {
    return this.data.topics.filter((topic) => {
      if (topic.speaker !== character) return false;

      const repeatable = topic.once === false;
      if (!repeatable && this.state.hasAsked(topic.id)) return false;

      return this.isAvailable(topic);
    });
  }

  private isAvailable(topic: DialogueTopic): boolean {
    // Une question debloquee par un effet passe outre ses conditions :
    // le personnage a lui-meme ouvert le sujet.
    if (this.state.isUnlocked(topic.id)) return true;
    if (topic.hidden) return false;
    if (!topic.requires) return true;
    return this.meets(topic.requires, topic.speaker);
  }

  /** Les conditions sont les memes pour les questions et les reactions. */
  private meets(need: Condition, character: CharacterId): boolean {
    if (need.clues?.some((id) => !this.state.hasClue(id))) return false;
    if (need.facts?.some((id) => !this.state.hasFact(id))) return false;
    if (need.statementsHeard?.some((id) => !this.state.hasHeard(id))) return false;
    if (need.topicsAsked?.some((id) => !this.state.hasAsked(id))) return false;
    if (need.topicsNotAsked?.some((id) => this.state.hasAsked(id))) return false;
    if (need.mood && !need.mood.includes(this.state.moodOf(character))) return false;
    return true;
  }

  topic(id: TopicId): DialogueTopic | null {
    return this.topicsById.get(id) ?? null;
  }

  /**
   * Enregistre ce qu'une question a produit.
   * A appeler quand la reponse a fini d'etre lue, pas avant : le joueur
   * doit avoir entendu la declaration pour qu'elle compte.
   */
  applyTopic(topic: DialogueTopic): void {
    this.state.markAsked(topic.id);

    for (const id of topic.records ?? []) {
      if (!this.statementsById.has(id)) {
        console.warn(`[dialogue] declaration inconnue : ${id}`);
        continue;
      }
      this.state.hearStatement(id);
    }

    const effects = topic.effects;
    if (!effects) return;

    for (const id of effects.revealFacts ?? []) this.state.learnFact(id);
    for (const id of effects.unlockTopics ?? []) this.state.unlockTopic(id);
    if (effects.setMood) this.state.setMood(topic.speaker, effects.setMood);
  }

  // -----------------------------------------------------------------
  // Presenter un element (Phase 5B)
  // -----------------------------------------------------------------

  /**
   * Ce que l'inspecteur peut brandir : les indices ramasses et les
   * declarations deja entendues.
   *
   * Les elements deja montres a ce personnage restent proposes, mais
   * signales : on n'interdit rien, on evite juste les redites.
   */
  availableEvidence(character: CharacterId): EvidenceOption[] {
    const options: EvidenceOption[] = [];

    for (const id of this.state.data.discoveredClues) {
      const entry = this.cluesById.get(id);
      if (!entry) {
        console.warn(`[enquete] indice "${id}" absent du catalogue de l'affaire`);
      }
      const evidence: Evidence = { kind: 'clue', id };
      options.push({
        evidence,
        label: entry?.name ?? id,
        kind: 'indice',
        alreadyShown: this.state.hasPresented(character, evidenceKey(evidence)),
      });
    }

    for (const id of this.state.data.heardStatements) {
      const statement = this.statementsById.get(id);
      if (!statement) continue;
      const evidence: Evidence = { kind: 'statement', id };
      options.push({
        evidence,
        label: statement.text,
        kind: 'déclaration',
        alreadyShown: this.state.hasPresented(character, evidenceKey(evidence)),
      });
    }

    return options;
  }

  /**
   * Cherche la reaction du personnage a cet element.
   *
   * Renvoie toujours quelque chose : faute de reaction ecrite, c'est la
   * reponse generique du personnage. Aucune combinaison n'est donc
   * obligatoire a l'ecriture.
   */
  react(character: CharacterId, evidence: Evidence): ReactionResult {
    const match = this.findReaction(character, evidence);
    if (match) return { lines: match.lines, specific: true };

    const sheet = this.characterSheet(character);
    return { lines: sheet?.defaultReaction ?? [], specific: false };
  }

  /**
   * Enregistre ce que la presentation a produit.
   * A appeler quand la reaction a fini d'etre lue.
   */
  applyEvidence(character: CharacterId, evidence: Evidence): void {
    this.state.markPresented(character, evidenceKey(evidence));

    const match = this.findReaction(character, evidence);
    if (!match) {
      // Element sans rapport : il se ferme d'un cran. Leger, plafonne,
      // reversible -- et jamais bloquant.
      this.state.closeUp(character);
      return;
    }

    for (const id of match.records ?? []) {
      if (!this.statementsById.has(id)) {
        console.warn(`[dialogue] declaration inconnue : ${id}`);
        continue;
      }
      this.state.hearStatement(id);
    }

    const effects = match.effects;
    if (!effects) return;
    for (const id of effects.revealFacts ?? []) this.state.learnFact(id);
    for (const id of effects.unlockTopics ?? []) this.state.unlockTopic(id);
    if (effects.setMood) this.state.setMood(character, effects.setMood);
  }

  private findReaction(character: CharacterId, evidence: Evidence): EvidenceReaction | null {
    for (const reaction of this.data.reactions) {
      if (reaction.character !== character) continue;
      if (evidence.kind === 'clue' && reaction.clue !== evidence.id) continue;
      if (evidence.kind === 'statement' && reaction.statement !== evidence.id) continue;
      if (reaction.requires && !this.meets(reaction.requires, character)) continue;
      return reaction;
    }
    return null;
  }

  /**
   * Les declarations entendues, telles que l'interface a le droit de les
   * voir. C'est LE point de passage oblige : le champ truth est retire
   * ici, et un Statement complet ne sort jamais du moteur.
   */
  heardStatements(character?: CharacterId): StatementView[] {
    const views: StatementView[] = [];
    for (const id of this.state.data.heardStatements) {
      const statement = this.statementsById.get(id);
      if (!statement) continue;
      if (character && statement.speaker !== character) continue;
      views.push(toView(statement));
    }
    return views;
  }
}

/** Retire tout ce que le joueur n'a pas le droit de savoir. */
export function toView(statement: Statement): StatementView {
  return {
    id: statement.id,
    speaker: statement.speaker,
    text: statement.text,
    topic: statement.topic,
    claimedTime: statement.claimedTime,
    replacesId: statement.supersedes,
  };
}

/* ===================================================================
   VALIDATION DES DONNEES

   Executee au demarrage en developpement. Elle attrape les fautes de
   frappe et les impasses avant qu'elles ne deviennent des bugs
   incomprehensibles en cours de partie.
   =================================================================== */

export function validateCase(data: CaseData): string[] {
  const problems: string[] = [];
  const characters = new Set(data.characters.map((c) => c.id));
  const topics = new Set(data.topics.map((t) => t.id));
  const statements = new Set(data.statements.map((s) => s.id));

  const seenTopics = new Set<string>();
  for (const topic of data.topics) {
    if (seenTopics.has(topic.id)) problems.push(`question en double : ${topic.id}`);
    seenTopics.add(topic.id);

    if (!characters.has(topic.speaker)) {
      problems.push(`${topic.id} : personnage inconnu "${topic.speaker}"`);
    }
    for (const id of topic.records ?? []) {
      if (!statements.has(id)) problems.push(`${topic.id} : declaration inconnue "${id}"`);
    }
    for (const id of topic.effects?.unlockTopics ?? []) {
      if (!topics.has(id)) problems.push(`${topic.id} : question a debloquer inconnue "${id}"`);
    }
    for (const id of topic.requires?.topicsAsked ?? []) {
      if (!topics.has(id)) problems.push(`${topic.id} : prerequis inconnu "${id}"`);
    }
    for (const id of topic.requires?.statementsHeard ?? []) {
      if (!statements.has(id)) problems.push(`${topic.id} : declaration requise inconnue "${id}"`);
    }
    if (topic.lines.length === 0) problems.push(`${topic.id} : aucune replique`);
    if (topic.lines.length > 5) {
      problems.push(`${topic.id} : ${topic.lines.length} repliques, c'est trop long a lire`);
    }
    for (const line of topic.lines) {
      if (line.speaker !== 'detective' && !characters.has(line.speaker)) {
        problems.push(`${topic.id} : locuteur inconnu "${line.speaker}"`);
      }
      if (line.text.length > 220) {
        problems.push(`${topic.id} : replique de ${line.text.length} signes, c'est trop long`);
      }
    }
  }

  for (const statement of data.statements) {
    if (!characters.has(statement.speaker)) {
      problems.push(`declaration ${statement.id} : personnage inconnu "${statement.speaker}"`);
    }
    if (statement.supersedes && !statements.has(statement.supersedes)) {
      problems.push(
        `declaration ${statement.id} : remplace une declaration inconnue ` +
          `"${statement.supersedes}"`,
      );
    }
    if (statement.supersedes === statement.id) {
      problems.push(`declaration ${statement.id} : se remplace elle-meme`);
    }
  }

  // --- Indices et reactions (Phase 5B, etendu en 6A) ---
  const clues = new Set(data.clues.map((c) => c.id));

  const seenClues = new Set<string>();
  for (const clue of data.clues) {
    if (seenClues.has(clue.id)) problems.push(`indice en double : ${clue.id}`);
    seenClues.add(clue.id);

    /* Depuis la Phase 6A ces trois textes sont la SEULE source : s'ils
       manquent, le joueur voit un libelle vide, sans autre indication. */
    if (clue.name.trim() === '') problems.push(`indice ${clue.id} : aucun nom`);
    if (clue.prompt.trim() === '') {
      problems.push(`indice ${clue.id} : aucun libelle d'action (ex. « Examiner le cendrier »)`);
    }
    if (clue.description.trim() === '') {
      problems.push(`indice ${clue.id} : aucune description a lire`);
    }
    if (clue.topic.trim() === '') {
      problems.push(`indice ${clue.id} : aucune rubrique pour le carnet`);
    }
    if (clue.description.length > 320) {
      problems.push(
        `indice ${clue.id} : description de ${clue.description.length} signes, ` +
          "c'est trop long pour une fiche lue debout dans une piece",
      );
    }
  }
  for (const character of data.characters) {
    if (character.defaultReaction.length === 0) {
      problems.push(
        `${character.id} : aucune reponse generique. Sans elle, presenter un ` +
          'element sans rapport ne produirait rien du tout.',
      );
    }
  }
  // --- Faits acquis (Phase 6B) ---
  const facts = new Set(data.facts.map((f) => f.id));

  const seenFacts = new Set<string>();
  for (const fact of data.facts) {
    if (seenFacts.has(fact.id)) problems.push(`fait en double : ${fact.id}`);
    seenFacts.add(fact.id);
    if (fact.text.trim() === '') problems.push(`fait ${fact.id} : aucun enonce`);
    if (fact.topic.trim() === '') problems.push(`fait ${fact.id} : aucune rubrique`);
  }

  /* Les faits cites par les questions et par les reactions doivent
     exister. Sans ce controle, un "revealFacts" mal orthographie
     enregistre un fait fantome, et la question qui l'attend ne s'ouvre
     JAMAIS -- sans le moindre message. C'est la faute la plus couteuse
     du lot, parce qu'elle ressemble a un choix de conception. */
  for (const topic of data.topics) {
    checkFacts(`${topic.id}`, topic.effects?.revealFacts, topic.requires?.facts, facts, problems);
  }
  for (const [index, reaction] of data.reactions.entries()) {
    const where = `reaction ${index + 1} (${reaction.character})`;
    checkFacts(where, reaction.effects?.revealFacts, reaction.requires?.facts, facts, problems);
  }

  /* Un fait que rien ne revele jamais est du contenu mort, exactement
     comme une question masquee que rien ne debloque. Pire : il bloque
     silencieusement toutes les questions qui l'attendent. */
  const revealable = new Set<string>();
  for (const topic of data.topics) {
    for (const id of topic.effects?.revealFacts ?? []) revealable.add(id);
  }
  for (const reaction of data.reactions) {
    for (const id of reaction.effects?.revealFacts ?? []) revealable.add(id);
  }
  for (const fact of data.facts) {
    if (!revealable.has(fact.id)) {
      problems.push(`fait "${fact.id}" : rien ne le revele jamais`);
    }
  }

  for (const [index, reaction] of data.reactions.entries()) {
    const where = `reaction ${index + 1} (${reaction.character})`;
    if (!characters.has(reaction.character)) {
      problems.push(`${where} : personnage inconnu`);
    }
    if (!reaction.clue && !reaction.statement) {
      problems.push(`${where} : ne designe ni indice ni declaration`);
    }
    if (reaction.clue && reaction.statement) {
      problems.push(`${where} : designe a la fois un indice et une declaration`);
    }
    if (reaction.clue && !clues.has(reaction.clue)) {
      problems.push(`${where} : indice inconnu "${reaction.clue}"`);
    }
    if (reaction.statement && !statements.has(reaction.statement)) {
      problems.push(`${where} : declaration inconnue "${reaction.statement}"`);
    }
    for (const id of reaction.records ?? []) {
      if (!statements.has(id)) problems.push(`${where} : declaration inconnue "${id}"`);
    }
    for (const id of reaction.effects?.unlockTopics ?? []) {
      if (!topics.has(id)) problems.push(`${where} : question a debloquer inconnue "${id}"`);
    }
    if (reaction.lines.length === 0) problems.push(`${where} : aucune replique`);
  }

  /* Une question masquee qu'aucune reaction ni aucun effet n'ouvre
     jamais est du contenu mort : le joueur ne la verra pas. */
  const unlockable = new Set<string>();
  for (const topic of data.topics) {
    for (const id of topic.effects?.unlockTopics ?? []) unlockable.add(id);
  }
  for (const reaction of data.reactions) {
    for (const id of reaction.effects?.unlockTopics ?? []) unlockable.add(id);
  }
  for (const topic of data.topics) {
    if (topic.hidden && !unlockable.has(topic.id)) {
      problems.push(`${topic.id} : masquee, mais rien ne la debloque jamais`);
    }
  }

  /* Garde-fou contre l'impasse : chaque personnage doit conserver EN
     PERMANENCE au moins une question posable sans condition. Sans cela,
     un joueur peut se retrouver devant un suspect muet sans comprendre
     pourquoi, et abandonner. */
  for (const character of data.characters) {
    const alwaysAvailable = data.topics.some(
      (t) => t.speaker === character.id && !t.requires && t.once === false,
    );
    if (!alwaysAvailable) {
      problems.push(
        `${character.id} : aucune question de relance permanente ` +
          '(sans condition et reposable). Le joueur pourrait se bloquer.',
      );
    }
  }

  return problems;
}

/**
 * Controle croise entre la scene 3D et le catalogue des indices.
 *
 * -------------------------------------------------------------------
 * POURQUOI CE CONTROLE EST SEPARE DE validateCase()
 * -------------------------------------------------------------------
 * validateCase() ne voit que les donnees de l'affaire ; il ne peut pas
 * savoir quels objets ont ete places dans le decor. Le rapprochement
 * demande les deux cotes, et c'est Game.ts, seul, qui les voit tous les
 * deux.
 *
 * La frontiere tient quand meme : ce qui traverse est un simple tableau
 * de chaines, jamais un objet Three.js. Ce fichier n'importe toujours
 * pas la 3D, et ne l'importera jamais.
 *
 * Les deux fautes attrapees sont celles qui, jusqu'a la Phase 6A,
 * passaient en silence :
 *   - un objet du decor qui designe un indice qui n'existe pas :
 *     le joueur le ramasse et ne peut jamais le presenter ;
 *   - un indice ecrit mais qu'aucun objet ne permet de trouver :
 *     du contenu mort, et peut-etre une enquete insoluble.
 *
 * @param idsInScene les identifiants d'indices reellement poses dans le
 *   decor, tels que la scene les rapporte.
 */
/**
 * Controle les faits cites par une question ou une reaction.
 *
 * Les deux sens comptent : celui qu'elle REVELE et celui qu'elle
 * EXIGE. Un fait exige qui n'existe pas rend la question inatteignable ;
 * un fait revele qui n'existe pas enregistre un fantome.
 */
function checkFacts(
  where: string,
  revealed: string[] | undefined,
  required: string[] | undefined,
  known: Set<string>,
  problems: string[],
): void {
  for (const id of revealed ?? []) {
    if (!known.has(id)) problems.push(`${where} : fait a reveler inconnu "${id}"`);
  }
  for (const id of required ?? []) {
    if (!known.has(id)) problems.push(`${where} : fait requis inconnu "${id}"`);
  }
}

export function validateSceneClues(data: CaseData, idsInScene: string[]): string[] {
  const problems: string[] = [];
  const catalogue = new Set(data.clues.map((c) => c.id));
  const placed = new Set(idsInScene);

  for (const id of placed) {
    if (!catalogue.has(id)) {
      problems.push(
        `decor : un objet designe l'indice "${id}", absent du catalogue de l'affaire`,
      );
    }
  }
  for (const id of catalogue) {
    if (!placed.has(id)) {
      problems.push(`indice "${id}" : aucun objet du decor ne permet de le trouver`);
    }
  }

  return problems;
}
