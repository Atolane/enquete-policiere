/* ===================================================================
   tests/unit/pistes.test.ts

   « A VERIFIER », LA MARQUE « NOUVEAU », ET CE QU'ELLES NE DISENT PAS.

   Le joueur obtient un renseignement chez l'un, et une question
   s'ouvre chez l'autre. Rien ne le lui disait. Ces controles couvrent
   la reponse apportee a ce probleme -- et, plus encore, ses limites.

   Le piege de ce genre de guidage est connu : il devient une liste de
   courses. Un carnet qui repond « va voir tout le monde » ne guide
   personne, il remplace l'enquete par une tournee. La regle qui
   l'empeche tient en deux conditions, et la seconde est la moins
   evidente des deux : une piste ne se signale que chez quelqu'un que
   le joueur a DEJA rencontre. Aller faire connaissance est le cours
   normal du jeu ; annoncer une piste chez un inconnu reviendrait a
   designer d'avance les gens qui comptent.
   =================================================================== */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Casebook } from '../../src/game/Casebook';
import { DialogueEngine } from '../../src/game/dialogue';
import { GameState, createState } from '../../src/game/GameState';
import { parseSave, serialise } from '../../src/game/save';
import { affaire, personnage, question, relance } from '../support/affaire';
import type { CaseData } from '../../src/data/types';

/* Deux temoins. Le second porte une question masquee que seule une
   reponse du premier ouvre : c'est la situation exacte qui a motive
   tout ce fichier. */
function deuxTemoins(): CaseData {
  return affaire({
    characters: [personnage(), personnage({ id: 'autre', name: 'Un autre' })],
    topics: [
      relance(),
      question({ id: 'q1', effects: { revealFacts: ['f1'], unlockTopics: ['tardive'] } }),
      relance('autre'),
      question({ id: 'tardive', speaker: 'autre', hidden: true }),
    ],
  });
}

function moteur(data: CaseData = deuxTemoins()) {
  const state = new GameState();
  return { state, engine: new DialogueEngine(data, state) };
}

// --- L'etat : une liste de plus, et rien d'autre ---------------------

test('une question vue le reste, et ne se note qu une fois', () => {
  const state = new GameState();
  assert.equal(state.hasSeen('q1'), false);
  assert.equal(state.markSeen('q1'), true);
  assert.equal(state.hasSeen('q1'), true);
  assert.equal(state.markSeen('q1'), false, 'deux fois la meme, c est une fois');
  assert.deepEqual(state.data.seenTopics, ['q1']);
});

test('voir une question n est pas la poser', () => {
  const state = new GameState();
  state.markSeen('q1');
  assert.equal(state.hasSeen('q1'), true);
  assert.equal(state.hasAsked('q1'), false, 'les deux listes sont independantes');
});

test('les abonnes sont prevenus, une fois par nouveaute', () => {
  const state = new GameState();
  let appels = 0;
  state.subscribe(() => { appels += 1; });
  state.markSeen('q1');
  state.markSeen('q1');
  assert.equal(appels, 1);
});

// --- Qui est une piste, et surtout qui ne l est pas -------------------

test('un inconnu n est jamais une piste', () => {
  const { engine } = moteur();
  /* Au depart, les deux temoins ont des questions disponibles. Aucun
     n'est une piste : le joueur n'a encore vu personne, et « revenir
     voir » quelqu'un qu'on n'a jamais rencontre n'a pas de sens. */
  assert.deepEqual(engine.leads(), []);
  assert.equal(engine.metCount(), 0);
});

test('une personne deja vue, dont la liste n a pas bouge, n est pas une piste', () => {
  const { state, engine } = moteur();
  for (const topic of engine.availableTopics('temoin')) state.markSeen(topic.id);

  assert.equal(engine.hasMet('temoin'), true);
  assert.equal(engine.metCount(), 1);
  assert.deepEqual(engine.unseenTopics('temoin'), []);
  assert.deepEqual(engine.leads(), [], 'rien de neuf : rien a signaler');
});

test('une question qui s ouvre chez quelqu un de deja vu en fait une piste', () => {
  const { state, engine } = moteur();

  // Le joueur a vu les deux temoins, et n'a rien laisse de cote.
  for (const id of ['temoin', 'autre']) {
    for (const topic of engine.availableTopics(id)) state.markSeen(topic.id);
  }
  assert.deepEqual(engine.leads(), []);

  // Puis il pose la question qui ouvre quelque chose ailleurs.
  engine.applyTopic(engine.topic('q1')!);
  assert.deepEqual(engine.leads(), ['autre']);
  assert.deepEqual(engine.unseenTopics('autre').map((t) => t.id), ['tardive']);
});

test('la meme question ouverte chez un inconnu ne signale rien', () => {
  const { state, engine } = moteur();
  for (const topic of engine.availableTopics('temoin')) state.markSeen(topic.id);

  engine.applyTopic(engine.topic('q1')!);
  assert.deepEqual(engine.leads(), [], 'on n a jamais rencontre « autre »');

  /* Et le jour ou le joueur ira le voir, la question sera la, marquee
     nouvelle comme toutes celles qu'il n'a jamais vues. */
  assert.equal(engine.unseenTopics('autre').some((t) => t.id === 'tardive'), true);
});

test('une piste se referme des qu elle a ete vue, meme sans etre posee', () => {
  const { state, engine } = moteur();
  for (const id of ['temoin', 'autre']) {
    for (const topic of engine.availableTopics(id)) state.markSeen(topic.id);
  }
  engine.applyTopic(engine.topic('q1')!);
  assert.deepEqual(engine.leads(), ['autre']);

  /* Le joueur ouvre la liste et la referme sans rien demander. Le jeu
     a dit ce qu'il avait a dire : il ne le repetera pas. */
  for (const topic of engine.availableTopics('autre')) state.markSeen(topic.id);
  assert.deepEqual(engine.leads(), []);
});

// --- Ce que le carnet en fait -----------------------------------------

test('le carnet ne donne que des noms', () => {
  const data = deuxTemoins();
  const state = new GameState();
  const engine = new DialogueEngine(data, state);
  for (const id of ['temoin', 'autre']) {
    for (const topic of engine.availableTopics(id)) state.markSeen(topic.id);
  }
  engine.applyTopic(engine.topic('q1')!);

  const vue = new Casebook(engine, state).build();
  assert.deepEqual(vue.leads, ['Un autre']);

  /* Le nom, et rien du contenu : ni l'intitule de la question, ni son
     sujet, ni l'identifiant technique. */
  const affiche = vue.leads.join(' ');
  assert.doesNotMatch(affiche, /tardive|Ou etiez-vous/);
});

test('un carnet sans piste n a pas de rubrique « A verifier »', () => {
  const { state, engine } = moteur();
  for (const topic of engine.availableTopics('temoin')) state.markSeen(topic.id);
  assert.deepEqual(new Casebook(engine, state).build().leads, []);
});

// --- Les anciennes sauvegardes -----------------------------------------

test('une sauvegarde ecrite avant seenTopics se relit sans une plainte', () => {
  /* Le cas reel : un joueur qui reprend une partie commencee avant
     cette amelioration. Le champ n'existe pas dans son fichier, et son
     absence n'est PAS un defaut -- monter la version de l'etat aurait
     efface toutes les parties en cours pour ajouter une commodite
     d'affichage. */
  const ancien = createState() as unknown as Record<string, unknown>;
  ancien.discoveredClues = ['i1'];
  ancien.askedTopics = ['q1'];
  delete ancien.seenTopics;

  const { state, problems } = parseSave(JSON.stringify(ancien), affaire());
  assert.deepEqual(problems, [], 'aucun champ manquant ne doit etre signale');
  assert.notEqual(state, null);
  assert.deepEqual(state!.seenTopics, []);
  assert.deepEqual(state!.discoveredClues, ['i1'], 'le reste de la partie est intact');
  assert.deepEqual(state!.askedTopics, ['q1']);
});

test('une sauvegarde recente conserve ses questions vues', () => {
  const etat = createState();
  etat.seenTopics = ['q1', 'temoin_relance'];
  const { state, problems } = parseSave(serialise(etat), affaire());
  assert.deepEqual(problems, []);
  assert.deepEqual(state!.seenTopics, ['q1', 'temoin_relance']);
});

test('une question vue qui n existe plus est ecartee, et dite', () => {
  const etat = createState() as unknown as Record<string, unknown>;
  etat.seenTopics = ['q1', 'disparue'];
  const { state, problems } = parseSave(JSON.stringify(etat), affaire());
  assert.deepEqual(state!.seenTopics, ['q1']);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /question vue/);
});

test('un champ seenTopics du mauvais type ne coute que lui-meme', () => {
  const etat = createState() as unknown as Record<string, unknown>;
  etat.discoveredClues = ['i1'];
  etat.seenTopics = 'q1';
  const { state, problems } = parseSave(JSON.stringify(etat), affaire());
  assert.deepEqual(state!.seenTopics, []);
  assert.deepEqual(state!.discoveredClues, ['i1'], 'la progression reste');
  assert.match(problems.join(' '), /mauvais type/);
});
