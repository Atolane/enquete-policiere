/* ===================================================================
   tests/unit/sauvegarde.test.ts

   parseSave() relit une sauvegarde et la CONFRONTE aux donnees de
   l'affaire. Le cas le plus probable n'est pas un fichier corrompu :
   c'est une sauvegarde parfaitement valide qui cite des identifiants
   ayant disparu entre deux versions du jeu.

   Deux comportements sont donc eprouves separement. Un defaut de FORME
   -- JSON illisible, mauvaise version -- refuse la sauvegarde en
   entier. Un identifiant INCONNU ne coute que lui-meme : le reste de la
   progression est conserve, et ce qui a ete ecarte est dit en clair.

   SaveSlot, qui touche a localStorage, n'est pas teste ici : il n'y a
   pas de navigateur. Ses trois acces sous try/catch relevent des
   suites navigateur.
   =================================================================== */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createState } from '../../src/game/GameState';
import { parseSave, serialise } from '../../src/game/save';
import { affaire } from '../support/affaire';

const data = affaire();

/** Un etat complet et coherent avec l'affaire minimale. */
function etatRempli() {
  const etat = createState();
  etat.discoveredClues = ['i1'];
  etat.heardStatements = ['d1'];
  etat.knownFacts = ['f1'];
  etat.askedTopics = ['q1'];
  etat.unlockedTopics = ['temoin_relance'];
  etat.presentedEvidence = ['temoin|clue:i1'];
  etat.moods = { temoin: 'guarded' };
  return etat;
}

test('une sauvegarde valide revient intacte', () => {
  const { state, problems } = parseSave(serialise(etatRempli()), data);
  assert.deepEqual(problems, []);
  assert.deepEqual(state, etatRempli());
});

// --- Defauts de forme : la sauvegarde est refusee en entier ----------

test('JSON illisible', () => {
  const { state, problems } = parseSave('{ ceci n est pas du JSON', data);
  assert.equal(state, null);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /illisible/);
});

test('un tableau n est pas un etat', () => {
  const { state, problems } = parseSave('[1, 2, 3]', data);
  assert.equal(state, null);
  assert.match(problems[0], /pas un objet/);
});

test('null n est pas un etat', () => {
  const { state } = parseSave('null', data);
  assert.equal(state, null);
});

test('une sauvegarde d une autre version est refusee en le disant', () => {
  const vieille = { ...etatRempli(), version: 0 };
  const { state, problems } = parseSave(JSON.stringify(vieille), data);
  assert.equal(state, null);
  assert.match(problems[0], /version 0/);
});

// --- Identifiants disparus : seul le champ fautif est ecarte ---------

test('un indice disparu est ecarte, le reste est conserve', () => {
  const etat = etatRempli();
  etat.discoveredClues = ['i1', 'i_disparu'];
  const { state, problems } = parseSave(JSON.stringify(etat), data);

  assert.deepEqual(state?.discoveredClues, ['i1']);
  assert.deepEqual(state?.knownFacts, ['f1'], 'le reste de la progression survit');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /i_disparu/);
});

test('une declaration, un fait et une question disparus sont ecartes chacun de leur cote', () => {
  const etat = etatRempli();
  etat.heardStatements = ['d_disparue'];
  etat.knownFacts = ['f_disparu'];
  etat.askedTopics = ['q_disparue'];
  const { state, problems } = parseSave(JSON.stringify(etat), data);

  assert.deepEqual(state?.heardStatements, []);
  assert.deepEqual(state?.knownFacts, []);
  assert.deepEqual(state?.askedTopics, []);
  assert.equal(problems.length, 3, 'un probleme par champ, pas un pour tout');
});

test('un champ du mauvais type est ignore sans emporter les autres', () => {
  const etat = { ...etatRempli(), discoveredClues: 'i1' };
  const { state, problems } = parseSave(JSON.stringify(etat), data);

  assert.deepEqual(state?.discoveredClues, []);
  assert.deepEqual(state?.knownFacts, ['f1']);
  assert.equal(problems.length >= 1, true);
});

// --- Elements presentes : les deux moities de la cle comptent --------

test('un element presente dont le personnage a disparu est ecarte', () => {
  const etat = etatRempli();
  etat.presentedEvidence = ['fantome|clue:i1'];
  const { state, problems } = parseSave(JSON.stringify(etat), data);

  assert.deepEqual(state?.presentedEvidence, []);
  assert.match(problems[0], /presente/);
});

test('un element presente dont l indice a disparu est ecarte', () => {
  const etat = etatRempli();
  etat.presentedEvidence = ['temoin|clue:i_disparu'];
  const { state } = parseSave(JSON.stringify(etat), data);
  assert.deepEqual(state?.presentedEvidence, []);
});

test('une cle presentee malformee est ecartee', () => {
  const etat = etatRempli();
  etat.presentedEvidence = ['nimportequoi'];
  const { state } = parseSave(JSON.stringify(etat), data);
  assert.deepEqual(state?.presentedEvidence, []);
});

test('une declaration presentee est reconnue', () => {
  const etat = etatRempli();
  etat.presentedEvidence = ['temoin|statement:d1'];
  const { state, problems } = parseSave(JSON.stringify(etat), data);
  assert.deepEqual(state?.presentedEvidence, ['temoin|statement:d1']);
  assert.deepEqual(problems, []);
});

// --- Humeurs : le personnage ET la valeur sont verifies --------------

test('une humeur inventee est ecartee', () => {
  const etat = { ...etatRempli(), moods: { temoin: 'furieux' } };
  const { state, problems } = parseSave(JSON.stringify(etat), data);

  assert.deepEqual(state?.moods, {});
  assert.match(problems[0], /humeur/);
});

test('une humeur attribuee a un personnage disparu est ecartee', () => {
  const etat = { ...etatRempli(), moods: { fantome: 'hostile' } };
  const { state } = parseSave(JSON.stringify(etat), data);
  assert.deepEqual(state?.moods, {});
});

test('un champ moods du mauvais type est signale et ignore', () => {
  const etat = { ...etatRempli(), moods: ['hostile'] };
  const { state, problems } = parseSave(JSON.stringify(etat), data);

  assert.deepEqual(state?.moods, {});
  assert.equal(problems.some((p) => p.includes('moods')), true);
});

test('une sauvegarde vide mais bien formee est acceptee', () => {
  const { state, problems } = parseSave(serialise(createState()), data);
  assert.deepEqual(problems, []);
  assert.deepEqual(state, createState());
});
