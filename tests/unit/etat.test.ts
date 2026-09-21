/* ===================================================================
   tests/unit/etat.test.ts

   GameState est le seul endroit qui ait le droit de modifier l'etat de
   l'enquete. Deux garanties comptent et sont eprouvees ici : rien n'est
   enregistre deux fois, et tout changement reel previent les abonnes.

   La seconde est moins evidente que la premiere. Trois abonnes en
   dependent -- l'ecriture de la sauvegarde, le rafraichissement du
   carnet et le releve ?etat=1 -- et un enregistrement en double les
   reveillerait pour rien.
   =================================================================== */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GameState, createState, STATE_VERSION } from '../../src/game/GameState';

test('un etat neuf est vide et porte la version courante', () => {
  const etat = createState();
  assert.equal(etat.version, STATE_VERSION);
  assert.deepEqual(etat.discoveredClues, []);
  assert.deepEqual(etat.moods, {});
});

test('un identifiant n est jamais enregistre deux fois', () => {
  const state = new GameState();
  assert.equal(state.discoverClue('i1'), true);
  assert.equal(state.discoverClue('i1'), false);
  assert.deepEqual(state.data.discoveredClues, ['i1']);
});

test('les cinq listes se remplissent et se relisent', () => {
  const state = new GameState();
  state.discoverClue('i1');
  state.hearStatement('d1');
  state.learnFact('f1');
  state.markAsked('q1');
  state.unlockTopic('q2');

  assert.equal(state.hasClue('i1'), true);
  assert.equal(state.hasHeard('d1'), true);
  assert.equal(state.hasFact('f1'), true);
  assert.equal(state.hasAsked('q1'), true);
  assert.equal(state.isUnlocked('q2'), true);
  assert.equal(state.hasClue('i2'), false);
});

test('un element presente est retenu sous une cle composee', () => {
  const state = new GameState();
  state.markPresented('temoin', 'clue:i1');
  assert.equal(state.hasPresented('temoin', 'clue:i1'), true);
  assert.equal(state.hasPresented('autre', 'clue:i1'), false);
  assert.deepEqual(state.data.presentedEvidence, ['temoin|clue:i1']);
});

test('une humeur non fixee retombe sur la valeur par defaut', () => {
  const state = new GameState();
  assert.equal(state.moodOf('temoin'), 'neutral');
  assert.equal(state.moodOf('temoin', 'nervous'), 'nervous');
  state.setMood('temoin', 'hostile');
  assert.equal(state.moodOf('temoin'), 'hostile');
});

test('closeUp ferme d un cran un personnage encore neutre', () => {
  const state = new GameState();
  state.closeUp('temoin');
  assert.equal(state.moodOf('temoin'), 'guarded');
});

test('closeUp ne rouvre jamais un personnage deja ferme', () => {
  const state = new GameState();
  state.setMood('temoin', 'hostile');
  state.closeUp('temoin');
  assert.equal(state.moodOf('temoin'), 'hostile');
});

test('un abonne est prevenu a chaque changement reel', () => {
  const state = new GameState();
  let appels = 0;
  state.subscribe(() => {
    appels += 1;
  });

  state.discoverClue('i1');
  assert.equal(appels, 1);

  state.discoverClue('i1'); // deja connu : rien ne change
  assert.equal(appels, 1, 'un doublon ne doit prevenir personne');

  state.setMood('temoin', 'guarded');
  assert.equal(appels, 2);

  state.setMood('temoin', 'guarded'); // meme humeur : rien ne change
  assert.equal(appels, 2, 'une humeur identique ne doit prevenir personne');
});

test('se desabonner arrete les notifications', () => {
  const state = new GameState();
  let appels = 0;
  const stop = state.subscribe(() => {
    appels += 1;
  });

  state.discoverClue('i1');
  stop();
  state.discoverClue('i2');

  assert.equal(appels, 1);
});

test('plusieurs abonnes sont tous prevenus', () => {
  const state = new GameState();
  const vus: string[] = [];
  state.subscribe(() => vus.push('a'));
  state.subscribe(() => vus.push('b'));

  state.learnFact('f1');

  assert.deepEqual(vus, ['a', 'b']);
});
