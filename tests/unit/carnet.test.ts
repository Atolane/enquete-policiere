/* ===================================================================
   tests/unit/carnet.test.ts

   Casebook transforme l'etat de l'enquete en quelque chose qui se lit.
   Ce qu'il NE fait pas compte autant que ce qu'il fait : il ne trie
   rien, ne rapproche rien, ne juge rien.

   Deux points meritent un test plutot qu'une relecture. D'abord les
   changements de version : une declaration qui en remplace une autre
   s'ajoute a l'entree existante, mais seulement si le joueur a entendu
   la premiere -- sinon elle vaut pour elle-meme. Ensuite le repli
   « Sans rubrique » : une rubrique absente du catalogue ne doit jamais
   faire apparaitre un identifiant technique a l'ecran.
   =================================================================== */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Casebook } from '../../src/game/Casebook';
import { DialogueEngine } from '../../src/game/dialogue';
import { GameState } from '../../src/game/GameState';
import type { CaseData } from '../../src/data/types';
import { affaire, declaration, indice, rubrique } from '../support/affaire';

function dossier(data: CaseData, remplir: (state: GameState) => void) {
  const state = new GameState();
  remplir(state);
  return new Casebook(new DialogueEngine(data, state), state).build();
}

test('un carnet vide n a ni rubrique ni entree', () => {
  const vue = dossier(affaire(), () => {});
  assert.deepEqual(vue.clues, []);
  assert.deepEqual(vue.statements, []);
  assert.deepEqual(vue.facts, []);
  assert.deepEqual(vue.counts, { clues: 0, statements: 0, facts: 0 });
});

test('un indice est range sous le libelle de sa rubrique', () => {
  const vue = dossier(affaire(), (s) => s.discoverClue('i1'));
  assert.equal(vue.clues.length, 1);
  assert.equal(vue.clues[0].title, 'La salle');
  assert.equal(vue.clues[0].entries[0].label, 'Un cendrier');
  assert.deepEqual(vue.clues[0].entries[0].paragraphs, [
    'Trois megots, deux marques differentes.',
  ]);
});

test('une rubrique absente du catalogue se replie sans montrer son identifiant', () => {
  const data = affaire({ clues: [indice({ rubric: 'rubrique_absente_xyz' })] });
  const vue = dossier(data, (s) => s.discoverClue('i1'));

  assert.equal(vue.clues[0].title, 'Sans rubrique');
  const texte = JSON.stringify(vue.clues);
  assert.equal(texte.includes('rubrique_absente_xyz'), false, 'aucune plomberie a l ecran');
});

test('deux rubriques de meme libelle ne fusionnent pas', () => {
  const data = affaire({
    clueRubrics: [rubrique(), rubrique({ id: 'couloir', label: 'La salle' })],
    clues: [indice(), indice({ id: 'i2', name: 'Une cle', rubric: 'couloir' })],
  });
  const vue = dossier(data, (s) => {
    s.discoverClue('i1');
    s.discoverClue('i2');
  });

  assert.equal(vue.clues.length, 2, 'le groupement suit la cle, pas le titre');
});

test('les indices restent dans l ordre de decouverte', () => {
  const data = affaire({
    clueRubrics: [rubrique(), rubrique({ id: 'couloir', label: 'Le couloir' })],
    clues: [indice(), indice({ id: 'i2', name: 'Une cle', rubric: 'couloir' })],
  });
  const vue = dossier(data, (s) => {
    s.discoverClue('i2');
    s.discoverClue('i1');
  });

  assert.deepEqual(
    vue.clues.map((r) => r.title),
    ['Le couloir', 'La salle'],
  );
});

test('une declaration est rangee sous son auteur, avec sa qualite', () => {
  const vue = dossier(affaire(), (s) => s.hearStatement('d1'));
  assert.equal(vue.statements[0].title, 'Un temoin');
  assert.equal(vue.statements[0].subtitle, 'Passant');
  assert.equal(vue.statements[0].entries[0].label, 'Emploi du temps');
});

test('une reprise prolonge l entree de la version entendue', () => {
  const data = affaire({
    statements: [declaration(), declaration({ id: 'd2', text: 'En fait, je suis sorti.', supersedes: 'd1' })],
  });
  const vue = dossier(data, (s) => {
    s.hearStatement('d1');
    s.hearStatement('d2');
  });

  assert.equal(vue.statements[0].entries.length, 1, 'une seule entree');
  assert.deepEqual(vue.statements[0].entries[0].paragraphs, [
    "J'etais chez moi.",
    'En fait, je suis sorti.',
  ]);
});

test('une reprise dont la premiere version n a pas ete entendue vaut pour elle-meme', () => {
  const data = affaire({
    statements: [declaration(), declaration({ id: 'd2', text: 'En fait, je suis sorti.', supersedes: 'd1' })],
  });
  const vue = dossier(data, (s) => s.hearStatement('d2'));

  assert.equal(vue.statements[0].entries.length, 1);
  assert.deepEqual(vue.statements[0].entries[0].paragraphs, ['En fait, je suis sorti.']);
});

test('le carnet ne laisse jamais filtrer le champ truth', () => {
  const data = affaire({ statements: [declaration({ truth: 'false' })] });
  const vue = dossier(data, (s) => s.hearStatement('d1'));
  assert.equal(JSON.stringify(vue).includes('truth'), false);
});

test('les faits sont ranges par rubrique et comptes', () => {
  const vue = dossier(affaire(), (s) => {
    s.learnFact('f1');
    s.discoverClue('i1');
    s.hearStatement('d1');
  });

  assert.equal(vue.facts[0].title, 'La soiree');
  assert.deepEqual(vue.facts[0].entries[0].paragraphs, ['Deux personnes ont fume ici.']);
  assert.deepEqual(vue.counts, { clues: 1, statements: 1, facts: 1 });
});

test('un identifiant inconnu est ignore sans faire tomber le carnet', () => {
  const vue = dossier(affaire(), (s) => {
    s.discoverClue('i_disparu');
    s.learnFact('f_disparu');
  });

  assert.deepEqual(vue.clues, []);
  assert.deepEqual(vue.facts, []);
  assert.equal(vue.counts.clues, 1, 'le compteur reflete l etat, pas ce qui s affiche');
});
