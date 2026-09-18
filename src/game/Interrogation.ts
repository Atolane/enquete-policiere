/* ===================================================================
   src/game/Interrogation.ts

   LE DEROULE D'UN ENTRETIEN.

   Il enchaine les repliques d'une reponse, declenche les gestes du
   personnage au bon moment, puis redonne la main au joueur.

   Il ne connait ni Three.js ni le DOM : il pilote un Character et une
   DialogueUI qu'on lui confie. Cela le rend simple a suivre, et c'est
   ici que viendra se brancher la presentation d'indices en Phase 5B.
   =================================================================== */

import type { DialogueLine, DialogueTopic } from '../data/types';
import type { DialogueEngine } from './dialogue';
import type { GameState } from './GameState';
import type { Character } from '../world/Character';
import type { DialogueUI } from '../ui/DialogueUI';

type Step =
  | { kind: 'pause'; remaining: number; line: DialogueLine }
  | { kind: 'line'; line: DialogueLine }
  | { kind: 'choices' };

export class Interrogation {
  /* Deux identites, a ne pas confondre :
       caseId    identifiant du personnage DANS L'AFFAIRE ('greco')
       character l'instance 3D qui l'incarne ('mannequin_A')
     Un meme role pourra demain etre joue par un autre modele, et le
     meme modele servir a plusieurs roles. */
  caseId: string | null = null;
  /** Personnage interroge, ou null si aucun entretien en cours. */
  character: Character | null = null;

  private topicQueue: DialogueLine[] = [];
  private pendingTopic: DialogueTopic | null = null;
  private step: Step | null = null;

  constructor(
    private readonly engine: DialogueEngine,
    private readonly state: GameState,
    private readonly ui: DialogueUI,
  ) {
    this.ui.onChoose = (topic) => this.ask(topic);
    this.ui.onAdvance = () => this.advance();
  }

  get isActive(): boolean {
    return this.character !== null;
  }

  /**
   * Ouvre un entretien.
   * @param caseId    identifiant du personnage dans l'affaire
   * @param character l'instance 3D qui l'incarne
   */
  start(caseId: string, character: Character): boolean {
    const sheet = this.engine.characterSheet(caseId);
    if (!sheet) {
      console.warn(`[enquete] aucune fiche pour le personnage "${caseId}"`);
      return false;
    }

    this.caseId = caseId;
    this.character = character;
    character.setMood(this.state.moodOf(caseId, sheet.initialMood));
    this.ui.open(sheet.name, sheet.role);
    this.showChoices();
    return true;
  }

  stop(): void {
    this.caseId = null;
    this.character = null;
    this.pendingTopic = null;
    this.topicQueue = [];
    this.step = null;
    this.ui.close();
  }

  /** A appeler a chaque image pendant l'entretien. */
  update(deltaTime: number): void {
    if (!this.isActive) return;
    this.ui.update(deltaTime);

    if (this.step?.kind === 'pause') {
      this.step.remaining -= deltaTime;
      if (this.step.remaining <= 0) this.playLine(this.step.line);
    }
  }

  // -----------------------------------------------------------------

  private ask(topic: DialogueTopic): void {
    this.pendingTopic = topic;
    this.topicQueue = [...topic.lines];
    this.advance();
  }

  /** Passe a la replique suivante, ou rend la main au joueur. */
  private advance(): void {
    // Un clic pendant la frappe affiche la replique en entier.
    if (this.step?.kind === 'line' && !this.ui.isLineComplete) {
      this.ui.completeLine();
      return;
    }
    if (this.step?.kind === 'pause') return; // on laisse le silence durer

    const next = this.topicQueue.shift();
    if (!next) {
      this.finishTopic();
      return;
    }

    if (next.pause && next.pause > 0) {
      this.step = { kind: 'pause', remaining: next.pause, line: next };
      this.ui.showPause();
      return;
    }

    this.playLine(next);
  }

  private playLine(line: DialogueLine): void {
    this.step = { kind: 'line', line };
    this.ui.showLine(line);
    // Le geste part en meme temps que la replique : il accompagne la
    // parole, il ne la precede pas.
    if (line.beat && this.character) this.character.playBeat(line.beat);
  }

  /**
   * La reponse est terminee : on enregistre ce qu'elle a produit.
   *
   * L'enregistrement se fait MAINTENANT et pas au moment du choix : le
   * joueur doit avoir reellement entendu la declaration pour qu'elle
   * compte comme entendue.
   */
  private finishTopic(): void {
    const topic = this.pendingTopic;
    this.pendingTopic = null;
    this.step = null;
    if (!topic) {
      this.showChoices();
      return;
    }

    this.engine.applyTopic(topic);

    // L'humeur decidee par les donnees est reportee sur le modele 3D.
    if (this.caseId && this.character) {
      this.character.setMood(this.state.moodOf(this.caseId, this.character.mood));
    }

    if (topic.effects?.endInterrogation) {
      this.ui.onLeave?.();
      return;
    }

    this.showChoices();
  }

  private showChoices(): void {
    if (!this.caseId) return;
    this.step = { kind: 'choices' };
    this.ui.showChoices(this.engine.availableTopics(this.caseId));
  }
}
