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
  DialogueTopic,
  Statement,
  StatementView,
  TopicId,
} from '../data/types';
import type { GameState } from './GameState';

export class DialogueEngine {
  private readonly topicsById = new Map<TopicId, DialogueTopic>();
  private readonly statementsById = new Map<string, Statement>();

  constructor(
    private readonly data: CaseData,
    private readonly state: GameState,
  ) {
    for (const topic of data.topics) this.topicsById.set(topic.id, topic);
    for (const statement of data.statements) this.statementsById.set(statement.id, statement);
  }

  characterSheet(id: CharacterId) {
    return this.data.characters.find((c) => c.id === id) ?? null;
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

    const need = topic.requires;
    if (!need) return true;

    if (need.clues?.some((id) => !this.state.hasClue(id))) return false;
    if (need.facts?.some((id) => !this.state.hasFact(id))) return false;
    if (need.statementsHeard?.some((id) => !this.state.hasHeard(id))) return false;
    if (need.topicsAsked?.some((id) => !this.state.hasAsked(id))) return false;
    if (need.topicsNotAsked?.some((id) => this.state.hasAsked(id))) return false;
    if (need.mood && !need.mood.includes(this.state.moodOf(topic.speaker))) return false;

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
