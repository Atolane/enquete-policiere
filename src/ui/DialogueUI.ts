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
  /** Appele quand le joueur avance dans les repliques. */
  onAdvance: (() => void) | null = null;

  private choices: DialogueTopic[] = [];
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
    this.choiceList.replaceChildren();
  }

  /** Affiche une replique, avec effet de frappe. */
  showLine(line: DialogueLine): void {
    this.choiceList.replaceChildren();
    this.choices = [];
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
    this.lineBox.dataset.speaker = 'character';
    this.lineBox.textContent = '…';
    this.typing = null;
    this.hint.textContent = '';
  }

  /** Affiche la liste des questions disponibles. */
  showChoices(topics: DialogueTopic[]): void {
    this.choices = topics;
    this.typing = null;
    this.lineBox.textContent = '';
    this.hint.textContent = 'Touches 1 à 9 · Échap pour terminer';

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
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onChoose?.(topic);
      });
      list.appendChild(button);
    });

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

  dispose(): void {
    window.removeEventListener('keydown', this.handleKey);
  }

  private handlePanelClick = (): void => {
    // Un clic dans le panneau ne sert qu'a faire defiler les repliques.
    if (this.choices.length > 0) return;
    this.onAdvance?.();
  };

  private handleKey = (event: KeyboardEvent): void => {
    if (!this.isOpen) return;

    if (event.code === 'Escape') {
      this.onLeave?.();
      return;
    }

    if (this.choices.length > 0) {
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
