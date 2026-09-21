/* ===================================================================
   src/ui/DialogueUI.ts

   LE PANNEAU D'INTERROGATOIRE, en HTML/CSS.

   Il affiche des repliques, puis une liste de questions. Il ne decide
   de rien : c'est Game qui lui dit quoi montrer.

   -------------------------------------------------------------------
   CE QU'IL NE RECOIT JAMAIS
   -------------------------------------------------------------------
   Ce fichier n'importe pas le type Statement, et n'en manipule aucun.
   Il ne voit que des DialogueTopic (une question, des repliques) : le
   champ truth n'a donc aucun chemin possible jusqu'a l'ecran.
   =================================================================== */

import type { DialogueLine, DialogueTopic } from '../data/types';
import type { EvidenceOption } from '../game/dialogue';

/** Vitesse de l'effet de frappe, en signes par seconde. */
const TYPING_SPEED = 55;

export class DialogueUI {
  private readonly panel: HTMLDivElement;
  private readonly speakerName: HTMLParagraphElement;
  private readonly speakerRole: HTMLParagraphElement;
  private readonly lineBox: HTMLParagraphElement;
  private readonly choiceList: HTMLDivElement;
  private readonly hint: HTMLParagraphElement;

  /** Appele quand le joueur choisit une question. */
  onChoose: ((topic: DialogueTopic) => void) | null = null;
  /** Appele quand le joueur met fin a l'entretien. */
  onLeave: (() => void) | null = null;
  /** Appele quand le joueur veut brandir quelque chose. */
  onOpenEvidence: (() => void) | null = null;
  /** Appele quand il a choisi l'element a presenter. */
  onPresent: ((option: EvidenceOption) => void) | null = null;
  /** Appele quand il renonce et revient aux questions. */
  onBack: (() => void) | null = null;
  /** Appele quand le joueur avance dans les repliques. */
  onAdvance: (() => void) | null = null;

  /** Vrai quand le carnet est ouvert par-dessus : voir setSuspended(). */
  private suspended = false;
  private choices: DialogueTopic[] = [];
  private evidence: EvidenceOption[] = [];
  private typing: { full: string; shown: number; elapsed: number } | null = null;

  constructor() {
    const layer = document.querySelector<HTMLDivElement>('#ui-layer');
    if (!layer) throw new Error('Couche #ui-layer introuvable dans index.html');

    this.panel = document.createElement('div');
    this.panel.id = 'dialogue-panel';
    this.panel.classList.add('is-hidden');

    const header = document.createElement('div');
    header.className = 'dialogue-header';
    this.speakerName = document.createElement('p');
    this.speakerName.className = 'dialogue-name';
    this.speakerRole = document.createElement('p');
    this.speakerRole.className = 'dialogue-role';
    header.append(this.speakerName, this.speakerRole);

    this.lineBox = document.createElement('p');
    this.lineBox.id = 'dialogue-line';

    this.choiceList = document.createElement('div');
    this.choiceList.id = 'dialogue-choices';

    this.hint = document.createElement('p');
    this.hint.className = 'dialogue-hint';

    this.panel.append(header, this.lineBox, this.choiceList, this.hint);
    layer.appendChild(this.panel);

    // Le panneau gere ses propres touches : c'est de l'interface, pas
    // des commandes de jeu. Les chiffres 1-9 choisissent une question.
    window.addEventListener('keydown', this.handleKey);
    // Cliquer n'importe ou dans le panneau fait avancer la replique.
    this.panel.addEventListener('click', this.handlePanelClick);
  }

  get isOpen(): boolean {
    return !this.panel.classList.contains('is-hidden');
  }

  /**
   * Met le clavier et les clics de l'entretien EN SOMMEIL (Phase 7A).
   *
   * Le carnet peut s'ouvrir par-dessus un entretien. Sans ce sommeil,
   * Echap serait recu ici -- cet ecouteur est installe avant celui de
   * Game -- et mettrait fin a l'entretien alors que le joueur voulait
   * seulement refermer son carnet. Les touches 1-9 et P poseraient des
   * questions derriere le carnet, sans que rien ne l'explique.
   *
   * Le panneau reste VISIBLE : le joueur doit voir qu'il est toujours en
   * entretien. Il est simplement sourd et aveugle le temps de la
   * consultation.
   */
  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
  }

  open(name: string, role: string): void {
    this.speakerName.textContent = name;
    this.speakerRole.textContent = role;
    this.lineBox.textContent = '';
    this.choiceList.replaceChildren();
    this.hint.textContent = '';
    this.panel.classList.remove('is-hidden');
  }

  close(): void {
    this.panel.classList.add('is-hidden');
    this.typing = null;
    this.choices = [];
    this.evidence = [];
    this.choiceList.replaceChildren();
  }

  /** Affiche une replique, avec effet de frappe. */
  showLine(line: DialogueLine): void {
    this.choiceList.replaceChildren();
    this.choices = [];
    this.evidence = [];
    this.lineBox.dataset.speaker = line.speaker === 'detective' ? 'detective' : 'character';
    this.lineBox.textContent = '';
    this.typing = { full: line.text, shown: 0, elapsed: 0 };
    this.hint.textContent = 'Clic pour continuer';
  }

  /** Avance l'effet de frappe. A appeler a chaque image. */
  update(deltaTime: number): void {
    if (!this.typing) return;
    this.typing.elapsed += deltaTime;
    const target = Math.min(
      this.typing.full.length,
      Math.floor(this.typing.elapsed * TYPING_SPEED),
    );
    if (target === this.typing.shown) return;
    this.typing.shown = target;
    this.lineBox.textContent = this.typing.full.slice(0, target);
    if (target >= this.typing.full.length) this.typing = null;
  }

  /** La replique est-elle entierement affichee ? */
  get isLineComplete(): boolean {
    return this.typing === null;
  }

  /** Affiche immediatement la replique en entier. */
  completeLine(): void {
    if (!this.typing) return;
    this.lineBox.textContent = this.typing.full;
    this.typing = null;
  }

  /** Affiche un silence : le personnage marque un temps avant de repondre. */
  showPause(): void {
    this.choiceList.replaceChildren();
    this.choices = [];
    this.evidence = [];
    this.lineBox.dataset.speaker = 'character';
    this.lineBox.textContent = '…';
    this.typing = null;
    this.hint.textContent = '';
  }

  /**
   * Affiche la liste des questions disponibles.
   *
   * @param nouveaux les identifiants que le joueur n'avait encore
   *   jamais vus proposes. Ils portent une marque -- rien de plus : la
   *   marque dit « celle-la est apparue depuis la derniere fois », elle
   *   ne dit pas qu'il faut la poser.
   */
  showChoices(topics: DialogueTopic[], canPresent = false, nouveaux: ReadonlySet<string> = new Set()): void {
    this.choices = topics;
    this.evidence = [];
    this.typing = null;
    this.lineBox.textContent = '';
    this.hint.textContent = canPresent
      ? 'Touches 1 à 9 · P pour présenter · Échap pour terminer'
      : 'Touches 1 à 9 · Échap pour terminer';

    const list = document.createElement('div');
    list.className = 'dialogue-choice-list';

    topics.forEach((topic, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dialogue-choice';
      button.dataset.topic = topic.id;

      const key = document.createElement('span');
      key.className = 'choice-key';
      key.textContent = String(index + 1);

      const label = document.createElement('span');
      label.className = 'choice-label';
      label.textContent = topic.question;

      const category = document.createElement('span');
      category.className = 'choice-category';
      category.textContent = topic.category;

      button.append(key, label, category);

      if (nouveaux.has(topic.id)) {
        button.classList.add('is-new');
        const marque = document.createElement('span');
        marque.className = 'choice-new';
        marque.textContent = 'nouveau';
        button.appendChild(marque);
      }
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onChoose?.(topic);
      });
      list.appendChild(button);
    });

    if (canPresent) {
      const present = document.createElement('button');
      present.type = 'button';
      present.className = 'dialogue-choice is-action';
      present.id = 'dialogue-present';
      const presentKey = document.createElement('span');
      presentKey.className = 'choice-key';
      presentKey.textContent = 'P';
      const presentLabel = document.createElement('span');
      presentLabel.className = 'choice-label';
      presentLabel.textContent = 'Présenter un élément';
      present.append(presentKey, presentLabel);
      present.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onOpenEvidence?.();
      });
      list.appendChild(present);
    }

    const leave = document.createElement('button');
    leave.type = 'button';
    leave.className = 'dialogue-choice is-leave';
    leave.id = 'dialogue-leave';
    const leaveKey = document.createElement('span');
    leaveKey.className = 'choice-key';
    leaveKey.textContent = '×';
    const leaveLabel = document.createElement('span');
    leaveLabel.className = 'choice-label';
    leaveLabel.textContent = "Terminer l'entretien";
    leave.append(leaveKey, leaveLabel);
    leave.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onLeave?.();
    });
    list.appendChild(leave);

    this.choiceList.replaceChildren(list);
  }

  /**
   * Affiche ce que l'inspecteur peut brandir.
   *
   * Le balisage est le MEME pour un indice et pour une declaration, et
   * ne depend en rien de leur contenu : rien ici ne peut trahir ce qui
   * est vrai ou faux.
   */
  showEvidence(options: EvidenceOption[]): void {
    this.choices = [];
    this.evidence = options;
    this.typing = null;
    this.lineBox.textContent = '';
    this.hint.textContent = 'Touches 1 à 9 · Échap pour revenir';

    const list = document.createElement('div');
    list.className = 'dialogue-choice-list';

    if (options.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'dialogue-empty';
      empty.textContent = "Vous n'avez rien à lui montrer pour l'instant.";
      list.appendChild(empty);
    }

    options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dialogue-choice';
      button.dataset.evidence = `${option.evidence.kind}:${option.evidence.id}`;

      const key = document.createElement('span');
      key.className = 'choice-key';
      key.textContent = index < 9 ? String(index + 1) : '·';

      const label = document.createElement('span');
      label.className = 'choice-label';
      label.textContent = option.label;

      const kind = document.createElement('span');
      kind.className = 'choice-category';
      kind.textContent = option.alreadyShown ? `${option.kind} · déjà montré` : option.kind;

      button.append(key, label, kind);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onPresent?.(option);
      });
      list.appendChild(button);
    });

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'dialogue-choice is-leave';
    back.id = 'dialogue-back';
    const backKey = document.createElement('span');
    backKey.className = 'choice-key';
    backKey.textContent = '\u2039';
    const backLabel = document.createElement('span');
    backLabel.className = 'choice-label';
    backLabel.textContent = 'Revenir aux questions';
    back.append(backKey, backLabel);
    back.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onBack?.();
    });
    list.appendChild(back);

    this.choiceList.replaceChildren(list);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKey);
  }

  private handlePanelClick = (): void => {
    // Un clic dans le panneau ne sert qu'a faire defiler les repliques.
    if (this.suspended) return;
    if (this.choices.length > 0 || this.evidence.length > 0) return;
    this.onAdvance?.();
  };

  private handleKey = (event: KeyboardEvent): void => {
    if (!this.isOpen || this.suspended) return;

    if (event.code === 'Escape') {
      // Depuis la liste des elements, Echap revient aux questions.
      // Ailleurs, il met fin a l'entretien.
      if (this.evidence.length > 0) this.onBack?.();
      else this.onLeave?.();
      return;
    }

    if (this.evidence.length > 0) {
      const match = /^Digit([1-9])$/.exec(event.code);
      if (match) {
        const option = this.evidence[Number(match[1]) - 1];
        if (option) {
          event.preventDefault();
          this.onPresent?.(option);
        }
      }
      return;
    }

    if (this.choices.length > 0) {
      if (event.code === 'KeyP') {
        event.preventDefault();
        this.onOpenEvidence?.();
        return;
      }
      const match = /^Digit([1-9])$/.exec(event.code);
      if (match) {
        const topic = this.choices[Number(match[1]) - 1];
        if (topic) {
          event.preventDefault();
          this.onChoose?.(topic);
        }
      }
      return;
    }

    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      this.onAdvance?.();
    }
  };
}
