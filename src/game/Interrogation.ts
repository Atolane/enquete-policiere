/* ===================================================================
   src/game/Interrogation.ts

   LE DEROULE D'UN ENTRETIEN.

   Il enchaine les repliques d'une reponse, declenche les gestes du
   personnage au bon moment, puis redonne la main au joueur.

   Il ne connait ni Three.js ni le DOM : il pilote un Character et une
   DialogueUI qu'on lui confie. Cela le rend simple a suivre, et c'est
   ici que viendra se brancher la presentation d'indices en Phase 5B.
   =================================================================== */

import type { DialogueLine, DialogueTopic, Evidence } from '../data/types';
import type { DialogueEngine, EvidenceOption } from './dialogue';
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
  /** Element en cours de presentation, en attente d'enregistrement. */
  private pendingEvidence: Evidence | null = null;
  private step: Step | null = null;

  /**
   * Appele quand une piste vient de s'ouvrir quelque part.
   * @param texte    la phrase a montrer au joueur
   * @param duree_ms combien de temps elle reste lisible
   */
  onLead?: (texte: string, duree_ms: number) => void;

  /* La lecon ne se donne qu'une fois par session. Deliberement en
     memoire et non dans la sauvegarde : elle ne vaut pas un champ de
     plus, et la redonner a quelqu'un qui reprend une partie a peine
     commencee ne coute rien -- alors que la repeter trois fois de
     suite dans la meme conversation serait insupportable. */
  private leconDonnee = false;

  constructor(
    private readonly engine: DialogueEngine,
    private readonly state: GameState,
    private readonly ui: DialogueUI,
  ) {
    this.ui.onChoose = (topic) => this.ask(topic);
    this.ui.onAdvance = () => this.advance();
    this.ui.onOpenEvidence = () => this.showEvidence();
    this.ui.onPresent = (option) => this.present(option);
    this.ui.onBack = () => this.showChoices();
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
    this.pendingEvidence = null;
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
    this.pendingEvidence = null;
    this.topicQueue = [...topic.lines];
    this.advance();
  }

  // --- Presenter un element (Phase 5B) -------------------------------

  private showEvidence(): void {
    if (!this.caseId) return;
    this.step = { kind: 'choices' };
    this.ui.showEvidence(this.engine.availableEvidence(this.caseId));
  }

  /**
   * L'inspecteur brandit quelque chose.
   *
   * Le moteur renvoie toujours une reaction : celle qui est ecrite, ou
   * la reponse generique du personnage. Rien, dans le deroule, ne
   * distingue les deux -- c'est au joueur de juger si ce qu'il vient
   * d'obtenir vaut quelque chose.
   */
  private present(option: EvidenceOption): void {
    if (!this.caseId) return;
    const reaction = this.engine.react(this.caseId, option.evidence);
    this.pendingTopic = null;
    this.pendingEvidence = option.evidence;
    this.topicQueue = [...reaction.lines];
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
    const evidence = this.pendingEvidence;
    this.pendingTopic = null;
    this.pendingEvidence = null;
    this.step = null;

    /* Qui avait deja une piste en attente AVANT que cette reponse
       produise son effet. C'est la seule mesure qui permette ensuite de
       dire qu'il vient de se passer quelque chose -- et elle doit etre
       prise ici, avant showChoices(), qui marque les questions vues et
       effacerait la difference. */
    const avant = new Set(this.engine.leads());
    const rencontres = this.engine.metCount();

    if (evidence && this.caseId) {
      this.engine.applyEvidence(this.caseId, evidence);
      this.refreshMood();
      this.announceLeads(avant, rencontres);
      this.showChoices();
      return;
    }

    if (!topic) {
      this.showChoices();
      return;
    }

    this.engine.applyTopic(topic);

    this.refreshMood();
    this.announceLeads(avant, rencontres);

    if (topic.effects?.endInterrogation) {
      this.ui.onLeave?.();
      return;
    }

    this.showChoices();
  }

  private showChoices(): void {
    if (!this.caseId) return;
    this.step = { kind: 'choices' };

    const topics = this.engine.availableTopics(this.caseId);
    /* On releve les nouveautes AVANT de les marquer vues. L'ordre est
       tout : une question marquee vue n'est plus nouvelle, et les deux
       lignes qui suivent seraient sans effet si elles etaient
       interverties -- sans que rien ne plante, et sans qu'aucun test du
       moteur ne s'en apercoive. */
    const nouveaux = new Set(
      topics.filter((topic) => !this.state.hasSeen(topic.id)).map((topic) => topic.id),
    );
    this.ui.showChoices(
      topics,
      this.engine.availableEvidence(this.caseId).length > 0,
      nouveaux,
    );
    for (const topic of topics) this.state.markSeen(topic.id);
  }

  /**
   * Dit au joueur qu'une piste vient de s'ouvrir, et chez qui.
   *
   * @param avant      qui avait deja une piste en attente avant l'effet
   * @param rencontres combien de personnes le joueur avait deja vues
   */
  private announceLeads(avant: ReadonlySet<string>, rencontres: number): void {
    const nouvelles = this.engine.leads().filter((id) => !avant.has(id));
    if (nouvelles.length === 0) return;

    /* LA PREMIERE FOIS, ON EXPLIQUE LA REGLE PLUTOT QUE DE DONNER UN
       NOM. Un joueur qui ignore encore qu'un entretien peut changer ne
       sait pas quoi faire d'un nom ; il lui faut d'abord savoir que la
       chose existe.

       « Premiere fois » se lit dans l'etat, sans rien memoriser de plus
       que seenTopics : le joueur n'a encore rencontre qu'une seule
       personne. La regle est vraie au rechargement comme en cours de
       partie, et elle ne se redit jamais une fois la deuxieme porte
       poussee. */
    if (rencontres <= 1 && !this.leconDonnee) {
      this.leconDonnee = true;
      this.onLead?.(
        'Ce que vous apprenez peut ouvrir de nouvelles questions. Certaines pistes ' +
          'méritent d’être approfondies auprès des personnes déjà interrogées.',
        /* Trois fois plus long que la phrase courte, donc trois fois
           plus de temps : une consigne qu'on n'a pas le temps de lire
           ne vaut pas mieux que pas de consigne du tout. */
        8000,
      );
      return;
    }

    const sheet = this.engine.characterSheet(nouvelles[0]);
    this.onLead?.(
      `Une nouvelle piste mérite d’être approfondie auprès de ${sheet?.name ?? nouvelles[0]}.`,
      4000,
    );
  }

  /** Reporte sur le modele 3D l'humeur decidee par les donnees. */
  private refreshMood(): void {
    if (!this.caseId || !this.character) return;
    this.character.setMood(this.state.moodOf(this.caseId, this.character.mood));
  }
}
