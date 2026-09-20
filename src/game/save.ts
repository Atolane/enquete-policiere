/* ===================================================================
   src/game/save.ts

   CONSERVER LA PARTIE.

   La sauvegarde est un JSON.stringify de l'etat de l'enquete, et rien
   d'autre. Ce n'est pas une facilite : c'est le resultat d'une decision
   prise en Phase 5A et jamais dementie depuis -- InvestigationState ne
   contient que des identifiants, des booleens et des chaines, et
   n'importe pas Three.js. Il n'y a donc aucun graphe d'objets a
   parcourir, aucune position a reconstruire, aucun cas particulier.

   -------------------------------------------------------------------
   DEUX MOITIES, ET POURQUOI ELLES SONT SEPAREES
   -------------------------------------------------------------------
   parseSave() est une fonction PURE : du texte et les donnees de
   l'affaire entrent, un etat propre sort. Elle ne touche a rien. C'est
   elle qui porte toute la logique delicate, et c'est ce qui la rend
   verifiable.

   SaveSlot isole les trois seuls appels a localStorage du projet. Le
   reste du jeu ne sait pas ou la partie est rangee.

   -------------------------------------------------------------------
   LA REGLE QUI GOUVERNE TOUT CE FICHIER
   -------------------------------------------------------------------
   UNE SAUVEGARDE ABIMEE NE DOIT JAMAIS EMPECHER DE JOUER.

   Au pire on repart de zero, mais on le DIT. Rien n'est jete en
   silence : chaque element ecarte est compte et nomme en console, comme
   le fait deja le controle croise de la Phase 6A. Une donnee qu'on jette
   sans le dire est un bug qui attend son heure.

   Corollaire : on ne MIGRE pas une sauvegarde d'une autre version. Une
   migration jamais testee est plus dangereuse qu'un redemarrage
   annonce.

   -------------------------------------------------------------------
   CE QUI N'EST PAS SAUVEGARDE
   -------------------------------------------------------------------
   La position du joueur : une coordonnee n'a de sens que dans un decor,
   et les vrais lieux remplaceront la piece de test. Restaurer un joueur
   a x -4,5 dans un decor qui a change, c'est le mettre dans un mur. On
   conserve le dossier, pas l'emplacement.

   L'entretien en cours : sa file de repliques vit dans Interrogation,
   pas dans l'etat. Recharger pendant un entretien ne perd que les
   lignes en train de defiler -- askedTopics et records sont ecrits des
   qu'une question est appliquee.

   Le mode de jeu : on revient toujours en exploration.

   Le champ truth : il n'est dans aucun des huit champs sauvegardes.
   Ouvrir la sauvegarde dans la console ne revele donc pas qui mentait.
   =================================================================== */

import { MOODS } from '../data/types';
import type { CaseData, Mood } from '../data/types';
import { createState, STATE_VERSION } from './GameState';
import type { InvestigationState } from './GameState';

/** Une seule cle. La version est DEDANS, pas dans le nom : une vieille
    partie est ainsi trouvee puis refusee en le disant, plutot que de
    disparaitre sans explication. */
export const SAVE_KEY = 'enquete-1948:partie';

/** L'etat, en une chaine. */
export function serialise(state: InvestigationState): string {
  return JSON.stringify(state);
}

export interface ParseResult {
  /** L'etat assaini, ou null si la sauvegarde est refusee en entier. */
  state: InvestigationState | null;
  /** Ce qui a ete refuse ou ecarte, en clair. Jamais silencieux. */
  problems: string[];
}

/**
 * Relit une sauvegarde et la CONFRONTE aux donnees de l'affaire.
 *
 * Le cas le plus probable n'est pas un fichier corrompu : c'est une
 * sauvegarde parfaitement valide qui cite des identifiants ayant
 * disparu. Greco est un suspect jetable ; le jour ou les vrais suspects
 * arriveront, toute partie existante citera des « greco_* » qui
 * n'existeront plus. Chaque identifiant est donc verifie un par un, et
 * ce qui ne correspond a rien est ecarte -- le reste est conserve.
 */
export function parseSave(text: string, data: CaseData): ParseResult {
  const problems: string[] = [];

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { state: null, problems: ['sauvegarde illisible (JSON invalide)'] };
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { state: null, problems: ["sauvegarde inattendue : ce n'est pas un objet"] };
  }

  const source = raw as Record<string, unknown>;

  if (source.version !== STATE_VERSION) {
    return {
      state: null,
      problems: [
        `sauvegarde en version ${String(source.version)}, ` +
          `le jeu attend la version ${STATE_VERSION} : partie neuve`,
      ],
    };
  }

  /* On part d'un etat VIDE et on y verse ce qui est valide, champ par
     champ. Un champ abime ne coute donc que lui-meme : le joueur garde
     tout le reste de sa progression. */
  const state = createState();
  const clues = new Set(data.clues.map((c) => c.id));
  const statements = new Set(data.statements.map((s) => s.id));
  const facts = new Set(data.facts.map((f) => f.id));
  const topics = new Set(data.topics.map((t) => t.id));
  const characters = new Set(data.characters.map((c) => c.id));

  state.discoveredClues = keep(source, 'discoveredClues', clues, 'indice', problems);
  state.heardStatements = keep(source, 'heardStatements', statements, 'declaration', problems);
  state.knownFacts = keep(source, 'knownFacts', facts, 'fait', problems);
  state.askedTopics = keep(source, 'askedTopics', topics, 'question posee', problems);
  state.unlockedTopics = keep(source, 'unlockedTopics', topics, 'question ouverte', problems);

  /* Les elements presentes sont des cles composees « personnage|kind:id ».
     Les DEUX moities comptent : un personnage disparu invalide la cle
     autant qu'un indice disparu. */
  const presented = strings(source, 'presentedEvidence', problems);
  const droppedKeys: string[] = [];
  for (const key of presented) {
    const cut = key.indexOf('|');
    const colon = key.indexOf(':', cut + 1);
    const character = cut > 0 ? key.slice(0, cut) : '';
    const kind = cut > 0 && colon > cut ? key.slice(cut + 1, colon) : '';
    const id = colon > cut ? key.slice(colon + 1) : '';

    const knownKind =
      (kind === 'clue' && clues.has(id)) || (kind === 'statement' && statements.has(id));
    if (characters.has(character) && knownKind) state.presentedEvidence.push(key);
    else droppedKeys.push(key);
  }
  if (droppedKeys.length > 0) {
    problems.push(`${droppedKeys.length} element(s) presente(s) ecarte(s) : ${droppedKeys.join(', ')}`);
  }

  /* Les humeurs. On verifie le personnage ET la valeur : une humeur
     inventee ferait dire n'importe quoi au moteur de dialogue, puisque
     certaines repliques n'existent que dans une humeur donnee. */
  const moods = source.moods;
  if (typeof moods === 'object' && moods !== null && !Array.isArray(moods)) {
    const droppedMoods: string[] = [];
    for (const [character, mood] of Object.entries(moods as Record<string, unknown>)) {
      if (characters.has(character) && isMood(mood)) state.moods[character] = mood;
      else droppedMoods.push(`${character}=${String(mood)}`);
    }
    if (droppedMoods.length > 0) {
      problems.push(`${droppedMoods.length} humeur(s) ecartee(s) : ${droppedMoods.join(', ')}`);
    }
  } else if (moods !== undefined) {
    problems.push('champ « moods » du mauvais type : ignore');
  }

  return { state, problems };
}

/**
 * La partie conservee par le navigateur.
 *
 * Chaque acces est sous try/catch : en navigation privee, avec un quota
 * nul ou un reglage restrictif, localStorage LEVE une exception au lieu
 * de renvoyer null. Le jeu doit demarrer quand meme.
 */
export class SaveSlot {
  /** Faux des qu'on sait que ce navigateur ne conservera rien. */
  private usable = true;
  /** Pour n'avertir qu'UNE fois, et non a chaque changement d'etat. */
  private warned = false;

  get available(): boolean {
    return this.usable;
  }

  /** Relit la partie. Renvoie null s'il n'y en a pas, ou si elle est refusee. */
  read(data: CaseData): InvestigationState | null {
    let text: string | null;
    try {
      text = window.localStorage.getItem(SAVE_KEY);
    } catch (error) {
      this.usable = false;
      console.warn(
        '[sauvegarde] ce navigateur ne conserve pas la partie ' +
          `(${error instanceof Error ? error.message : String(error)}). On joue sans.`,
      );
      return null;
    }

    if (text === null) {
      console.info('[sauvegarde] aucune partie conservee : on commence une enquete neuve');
      return null;
    }

    const { state, problems } = parseSave(text, data);
    for (const problem of problems) console.warn(`[sauvegarde] ${problem}`);
    if (state === null) return null;

    console.info(
      '[sauvegarde] partie reprise : ' +
        `${state.discoveredClues.length} indice(s), ` +
        `${state.heardStatements.length} declaration(s), ` +
        `${state.knownFacts.length} fait(s)`,
    );
    return state;
  }

  /**
   * Ecrit la partie. Appele a chaque changement d'etat.
   *
   * Pas d'ecriture differee, volontairement : setItem est synchrone et
   * ATOMIQUE pour une cle -- il n'existe pas d'ecriture a moitie faite.
   * La sauvegarde pese moins de deux kilo-octets et l'etat change
   * quelques fois par entretien, pas quelques fois par image. Differer
   * n'apporterait que le seul vrai risque de perte : un changement
   * ecrit « bientot » et une page fermee entre-temps.
   */
  write(state: InvestigationState): void {
    if (!this.usable) return;
    try {
      window.localStorage.setItem(SAVE_KEY, serialise(state));
    } catch (error) {
      if (!this.warned) {
        this.warned = true;
        console.warn(
          '[sauvegarde] impossible d’enregistrer la partie ' +
            `(${error instanceof Error ? error.message : String(error)}). La partie continue.`,
        );
      }
    }
  }

  /** Efface la partie conservee. */
  clear(): void {
    try {
      window.localStorage.removeItem(SAVE_KEY);
      console.info('[sauvegarde] partie effacee');
    } catch {
      /* Rien a faire : il n'y avait de toute facon rien a effacer. */
    }
  }
}

/* --- Outils de relecture ------------------------------------------ */

/** Un tableau de chaines, quoi qu'il y ait reellement dans le champ. */
function strings(
  source: Record<string, unknown>,
  field: string,
  problems: string[],
): string[] {
  const value = source[field];
  if (value === undefined) {
    problems.push(`champ « ${field} » absent : ignore`);
    return [];
  }
  if (!Array.isArray(value)) {
    problems.push(`champ « ${field} » du mauvais type : ignore`);
    return [];
  }
  const kept = value.filter((item): item is string => typeof item === 'string');
  if (kept.length !== value.length) {
    problems.push(`champ « ${field} » : ${value.length - kept.length} valeur(s) non textuelle(s) ecartee(s)`);
  }
  return kept;
}

/** Les identifiants d'un champ qui existent reellement dans l'affaire. */
function keep(
  source: Record<string, unknown>,
  field: string,
  known: Set<string>,
  label: string,
  problems: string[],
): string[] {
  const all = strings(source, field, problems);
  const kept = all.filter((id) => known.has(id));
  const dropped = all.filter((id) => !known.has(id));
  if (dropped.length > 0) {
    problems.push(`${dropped.length} ${label}(s) inconnu(s) ecarte(s) : ${dropped.join(', ')}`);
  }
  return kept;
}

function isMood(value: unknown): value is Mood {
  return typeof value === 'string' && (MOODS as readonly string[]).includes(value);
}
