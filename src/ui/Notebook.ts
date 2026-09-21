/* ===================================================================
   src/ui/Notebook.ts

   LE CARNET, cote affichage.

   Il dessine ce que game/Casebook.ts a prepare, et rien de plus : il ne
   lit pas l'etat de l'enquete, il ne connait ni GameState ni le moteur
   de dialogue. On lui donne une vue, il la met en page.

   -------------------------------------------------------------------
   IL NE TOUCHE PAS AU CLAVIER
   -------------------------------------------------------------------
   Et c'est deliberé. Trois ecouteurs de clavier coexistent deja dans le
   jeu : Input (le deplacement) et DialogueUI (Echap, 1-9, P, Espace).
   Un quatrieme, ici, aurait rendu impossible de dire qui recoit Echap
   quand le carnet est ouvert PAR-DESSUS un entretien.

   C'est donc Game.ts qui arbitre : lui seul ecoute N et Echap pour le
   carnet, et lui seul decide. Voir le commentaire « PRIORITES CLAVIER »
   dans Game.ts.

   -------------------------------------------------------------------
   UNE SEULE INTERACTION (Phase 7B)
   -------------------------------------------------------------------
   Le carnet est en lecture seule, a une exception pres : « Recommencer
   l'enquete », en pied de page, nettement separe du dossier. Effacer une
   enquete est irreversible, donc il demande confirmation en deux temps,
   et l'armement retombe des que le carnet se referme -- on ne laisse pas
   un bouton dangereux arme dans le dos du joueur.

   -------------------------------------------------------------------
   PLEIN ECRAN, ET POURQUOI
   -------------------------------------------------------------------
   Le carnet couvre toute la page, fond assombri compris. Ce n'est pas
   un effet de style : un panneau plus petit laisserait le panneau
   d'interrogatoire cliquable derriere lui, et un clic a cote ferait
   defiler une replique sans que le joueur comprenne pourquoi.
   =================================================================== */

import type { CasebookSection, CasebookView } from '../game/Casebook';

export class Notebook {
  /** Appele quand le joueur confirme la remise a zero. */
  onRestart: (() => void) | null = null;

  private readonly panel: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly storageNote: HTMLParagraphElement;
  private readonly restartRow: HTMLDivElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly confirmRow: HTMLDivElement;

  constructor() {
    const layer = document.querySelector<HTMLDivElement>('#ui-layer');
    if (!layer) throw new Error('Couche #ui-layer introuvable dans index.html');

    this.panel = document.createElement('div');
    this.panel.id = 'notebook-panel';
    this.panel.classList.add('is-hidden');

    const header = document.createElement('div');
    header.id = 'notebook-header';
    const title = document.createElement('p');
    title.className = 'notebook-title';
    title.textContent = 'Dossier d’enquête';
    const hint = document.createElement('p');
    hint.className = 'notebook-hint';
    hint.textContent = 'N ou Échap pour refermer';
    header.append(title, hint);

    this.body = document.createElement('div');
    this.body.id = 'notebook-body';

    /* Pied de page : le repere de conservation, et la seule action du
       carnet. Separe du dossier par un filet, pour qu'on ne clique pas
       dessus en croyant lire. */
    const footer = document.createElement('div');
    footer.id = 'notebook-footer';

    this.storageNote = document.createElement('p');
    this.storageNote.className = 'notebook-storage';
    this.storageNote.textContent = 'Dossier conservé dans ce navigateur.';

    this.restartButton = document.createElement('button');
    this.restartButton.type = 'button';
    this.restartButton.id = 'notebook-restart';
    this.restartButton.textContent = 'Recommencer l’enquête';
    this.restartButton.addEventListener('click', () => this.arm());
    this.restartRow = document.createElement('div');
    this.restartRow.className = 'notebook-action';
    this.restartRow.appendChild(this.restartButton);

    /* L'etape de confirmation. Deux boutons distincts : on ne transforme
       pas le premier bouton en « confirmer », sans quoi un double-clic
       malheureux effacerait la partie. */
    const confirmText = document.createElement('p');
    confirmText.className = 'notebook-confirm-text';
    confirmText.textContent = 'Tout le dossier sera effacé. C’est définitif.';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.id = 'notebook-confirm';
    confirm.textContent = 'Effacer définitivement';
    confirm.addEventListener('click', () => {
      this.disarm();
      this.onRestart?.();
    });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.id = 'notebook-cancel';
    cancel.textContent = 'Annuler';
    cancel.addEventListener('click', () => this.disarm());
    this.confirmRow = document.createElement('div');
    this.confirmRow.className = 'notebook-action is-hidden';
    this.confirmRow.append(confirmText, confirm, cancel);

    footer.append(this.storageNote, this.restartRow, this.confirmRow);

    this.panel.append(header, this.body, footer);
    layer.appendChild(this.panel);
  }

  /**
   * Dit au joueur si sa partie sera conservee.
   *
   * En navigation privee ou avec un quota nul, localStorage leve une
   * exception : mieux vaut l'annoncer que laisser croire a une
   * progression enregistree.
   */
  setSaving(available: boolean): void {
    this.storageNote.textContent = available
      ? 'Dossier conservé dans ce navigateur.'
      : 'Ce navigateur ne conserve pas la partie : le dossier sera perdu en quittant.';
    this.storageNote.classList.toggle('is-warning', !available);
  }

  get isOpen(): boolean {
    return !this.panel.classList.contains('is-hidden');
  }

  /** Ouvre le carnet sur ce contenu. */
  open(view: CasebookView): void {
    this.render(view);
    this.disarm(); // jamais arme a l'ouverture
    this.panel.classList.remove('is-hidden');
    this.body.scrollTop = 0;
  }

  /** Met a jour le contenu sans changer la visibilite. */
  refresh(view: CasebookView): void {
    if (!this.isOpen) return;
    const scroll = this.body.scrollTop;
    this.render(view);
    this.body.scrollTop = scroll;
  }

  close(): void {
    this.panel.classList.add('is-hidden');
    this.disarm(); // un bouton dangereux ne reste pas arme dans le dos du joueur
  }

  /** Premier temps : on demande confirmation, on n'efface rien. */
  private arm(): void {
    this.restartButton.blur(); // sinon Espace ou Entree le rejouerait
    this.restartRow.classList.add('is-hidden');
    this.confirmRow.classList.remove('is-hidden');
  }

  private disarm(): void {
    this.restartRow.classList.remove('is-hidden');
    this.confirmRow.classList.add('is-hidden');
  }

  dispose(): void {
    this.panel.remove();
  }

  private render(view: CasebookView): void {
    /* « A verifier » passe EN TETE, et non a la suite des trois autres.
       Le dossier fait plusieurs ecrans de haut des la moitie de
       l'enquete ; une rubrique posee en bas ne serait jamais lue, et
       une indication qu'on ne lit pas ne guide personne. C'est la seule
       partie du carnet qui demande une action, elle est donc la ou l'on
       regarde en ouvrant. Absente quand il n'y a rien. */
    this.body.replaceChildren(
      ...(view.leads.length > 0 ? [leads(view.leads)] : []),
      rubric(`Indices (${view.counts.clues})`, view.clues, 'Rien de ramassé pour l’instant.'),
      rubric(
        `Déclarations (${view.counts.statements})`,
        view.statements,
        'Personne n’a encore rien dit.',
      ),
      rubric(`Faits acquis (${view.counts.facts})`, view.facts, 'Rien d’établi pour l’instant.'),
    );
  }
}

/**
 * « A verifier » : les personnes chez qui quelque chose attend.
 *
 * Un nom par ligne, suivi d'une phrase qui ne dit rien de plus. Pas de
 * sujet, pas de raison, pas de compte : le joueur apprend ou revenir,
 * jamais ce qu'il y trouvera.
 */
function leads(noms: string[]): HTMLElement {
  const block = document.createElement('section');
  block.className = 'notebook-rubric notebook-leads';

  const heading = document.createElement('h2');
  heading.className = 'rubric-title';
  heading.textContent = 'À vérifier';
  block.appendChild(heading);

  for (const nom of noms) {
    const ligne = document.createElement('p');
    ligne.className = 'notebook-lead';
    ligne.textContent = `${nom} — il reste quelque chose à lui demander.`;
    block.appendChild(ligne);
  }
  return block;
}

/** Une des trois rubriques du dossier. */
function rubric(title: string, sections: CasebookSection[], empty: string): HTMLElement {
  const block = document.createElement('section');
  block.className = 'notebook-rubric';

  const heading = document.createElement('h2');
  heading.className = 'rubric-title';
  heading.textContent = title;
  block.appendChild(heading);

  if (sections.length === 0) {
    const nothing = document.createElement('p');
    nothing.className = 'notebook-empty';
    nothing.textContent = empty;
    block.appendChild(nothing);
    return block;
  }

  for (const section of sections) block.appendChild(renderSection(section));
  return block;
}

function renderSection(section: CasebookSection): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'notebook-section';

  const heading = document.createElement('h3');
  heading.className = 'section-title';
  heading.textContent = section.title;
  group.appendChild(heading);

  if (section.subtitle) {
    const role = document.createElement('p');
    role.className = 'section-subtitle';
    role.textContent = section.subtitle;
    group.appendChild(role);
  }

  for (const entry of section.entries) {
    const item = document.createElement('div');
    item.className = 'notebook-entry';

    if (entry.label) {
      const label = document.createElement('p');
      label.className = 'entry-label';
      label.textContent = entry.label;
      item.appendChild(label);
    }

    /* Les versions successives, dans l'ordre entendu. La premiere n'a
       pas de mention ; les suivantes portent « Puis », qui est un
       CONSTAT de chronologie -- pas un verdict. Les deux textes portent
       la meme classe : rien, dans le balisage, ne distingue une version
       abandonnee d'une version maintenue. */
    for (const [index, paragraph] of entry.paragraphs.entries()) {
      if (index > 0) {
        const then = document.createElement('p');
        then.className = 'entry-then';
        then.textContent = 'Puis';
        item.appendChild(then);
      }
      const text = document.createElement('p');
      text.className = 'entry-text';
      text.textContent = paragraph;
      item.appendChild(text);
    }

    group.appendChild(item);
  }

  return group;
}
