/* ===================================================================
   tests/unit/validateur.test.ts

   validateCase() confronte une affaire a elle-meme : tout identifiant
   cite doit exister, tout personnage doit rester interrogeable, tout
   fait doit pouvoir etre revele.

   Chaque test part d'une affaire VALIDE et n'y abime qu'une chose. Le
   controle porte sur le nombre de problemes ET sur leur texte : un test
   qui se contenterait de « au moins un probleme » passerait encore le
   jour ou le validateur signalerait la mauvaise faute.
   =================================================================== */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateCase } from '../../src/game/dialogue';
import { affaire, indice, personnage, question, reaction, relance } from '../support/affaire';

/** Les problemes contenant ce fragment. Sert a nommer la faute attendue. */
function parmi(problemes: string[], fragment: string): string[] {
  return problemes.filter((p) => p.includes(fragment));
}

test('une affaire minimale et valide ne produit aucun probleme', () => {
  assert.deepEqual(validateCase(affaire()), []);
});

// --- Questions ------------------------------------------------------

test('question en double', () => {
  const problemes = validateCase(affaire({ topics: [relance(), question(), question()] }));
  assert.equal(parmi(problemes, 'question en double').length, 1);
});

test('question adressee a un personnage inconnu', () => {
  const problemes = validateCase(
    affaire({ topics: [relance(), question({ speaker: 'fantome' })] }),
  );
  assert.equal(parmi(problemes, 'personnage inconnu "fantome"').length, 1);
});

test('question sans replique', () => {
  const problemes = validateCase(affaire({ topics: [relance(), question({ lines: [] })] }));
  assert.equal(parmi(problemes, 'aucune replique').length, 1);
});

test('question trop longue a lire', () => {
  const lignes = Array.from({ length: 6 }, () => ({ speaker: 'temoin', text: 'Oui.' }));
  const problemes = validateCase(affaire({ topics: [relance(), question({ lines: lignes })] }));
  assert.equal(parmi(problemes, '6 repliques').length, 1);
});

test('replique attribuee a un locuteur inconnu', () => {
  const problemes = validateCase(
    affaire({
      topics: [relance(), question({ lines: [{ speaker: 'fantome', text: 'Bonsoir.' }] })],
    }),
  );
  assert.equal(parmi(problemes, 'locuteur inconnu "fantome"').length, 1);
});

test('declaration inconnue dans records', () => {
  const problemes = validateCase(
    affaire({ topics: [relance(), question({ records: ['d_absente'] })] }),
  );
  assert.equal(parmi(problemes, 'declaration inconnue "d_absente"').length, 1);
});

// --- Auto-references -------------------------------------------------

test('une question qui s attend elle-meme n apparaitra jamais', () => {
  const problemes = validateCase(
    affaire({ topics: [relance(), question({ requires: { topicsAsked: ['q1'] } })] }),
  );
  assert.equal(parmi(problemes, "s'attend elle-meme").length, 1);
});

test('une question qui se cite dans topicsNotAsked est redondante', () => {
  const problemes = validateCase(
    affaire({ topics: [relance(), question({ requires: { topicsNotAsked: ['q1'] } })] }),
  );
  assert.equal(parmi(problemes, 'se cite dans topicsNotAsked').length, 1);
});

// --- Conditions : les six cases, sur une question --------------------

const conditionsInconnues: ReadonlyArray<[string, Record<string, string[]>, string]> = [
  ['clues', { clues: ['i_absent'] }, 'indice requis inconnu "i_absent"'],
  ['facts', { facts: ['f_absent'] }, 'fait requis inconnu "f_absent"'],
  ['topicsAsked', { topicsAsked: ['q_absente'] }, 'prerequis inconnu "q_absente"'],
  [
    'topicsNotAsked',
    { topicsNotAsked: ['q_absente'] },
    '« pas encore posee » inconnu "q_absente"',
  ],
  ['statementsHeard', { statementsHeard: ['d_absente'] }, 'declaration requise inconnue'],
  ['mood', { mood: ['furieux'] }, 'humeur inconnue "furieux"'],
];

for (const [nom, requires, attendu] of conditionsInconnues) {
  test(`condition d une question : ${nom} inconnu`, () => {
    const problemes = validateCase(
      affaire({ topics: [relance(), question({ requires: requires as never })] }),
    );
    assert.equal(parmi(problemes, attendu).length, 1, problemes.join(' | '));
  });

  test(`condition d une reaction : ${nom} inconnu`, () => {
    const problemes = validateCase(
      affaire({ reactions: [reaction({ requires: requires as never })] }),
    );
    assert.equal(parmi(problemes, attendu).length, 1, problemes.join(' | '));
  });
}

// --- Effets : sur une question et sur une reaction -------------------

test('effet d une question : fait a reveler inconnu', () => {
  const problemes = validateCase(
    affaire({
      topics: [relance(), question({ effects: { revealFacts: ['f1', 'f_absent'] } })],
    }),
  );
  assert.equal(parmi(problemes, 'fait a reveler inconnu "f_absent"').length, 1);
});

test('effet d une question : question a debloquer inconnue', () => {
  const problemes = validateCase(
    affaire({
      topics: [relance(), question({ effects: { revealFacts: ['f1'], unlockTopics: ['q_absente'] } })],
    }),
  );
  assert.equal(parmi(problemes, 'question a debloquer inconnue "q_absente"').length, 1);
});

test('effet d une reaction : fait a reveler inconnu', () => {
  const problemes = validateCase(
    affaire({ reactions: [reaction({ effects: { revealFacts: ['f_absent'] } })] }),
  );
  assert.equal(parmi(problemes, 'fait a reveler inconnu "f_absent"').length, 1);
});

test('effet d une reaction : question a debloquer inconnue', () => {
  const problemes = validateCase(
    affaire({ reactions: [reaction({ effects: { unlockTopics: ['q_absente'] } })] }),
  );
  assert.equal(parmi(problemes, 'question a debloquer inconnue "q_absente"').length, 1);
});

// --- Indices et rubriques (Phase 7C-2) -------------------------------

test('indice citant une rubrique absente du catalogue', () => {
  const problemes = validateCase(affaire({ clues: [indice({ rubric: 'rubrique_absente' })] }));
  assert.equal(parmi(problemes, 'rubrique inconnue "rubrique_absente"').length, 1);
});

test('indice sans nom, sans libelle d action, sans description', () => {
  const problemes = validateCase(
    affaire({ clues: [indice({ name: ' ', prompt: '', description: '  ' })] }),
  );
  assert.equal(parmi(problemes, 'aucun nom').length, 1);
  assert.equal(parmi(problemes, "aucun libelle d'action").length, 1);
  assert.equal(parmi(problemes, 'aucune description').length, 1);
});

test('description trop longue pour une fiche lue debout', () => {
  const problemes = validateCase(affaire({ clues: [indice({ description: 'x'.repeat(321) })] }));
  assert.equal(parmi(problemes, '321 signes').length, 1);
});

test('indice en double', () => {
  const problemes = validateCase(affaire({ clues: [indice(), indice()] }));
  assert.equal(parmi(problemes, 'indice en double').length, 1);
});

// --- Faits -----------------------------------------------------------

test('un fait que rien ne revele jamais est du contenu mort', () => {
  const problemes = validateCase(affaire({ topics: [relance(), question()] }));
  assert.equal(parmi(problemes, 'rien ne le revele jamais').length, 1);
});

// --- Reactions -------------------------------------------------------

test('reaction ne designant ni indice ni declaration', () => {
  const problemes = validateCase(affaire({ reactions: [reaction({ clue: undefined })] }));
  assert.equal(parmi(problemes, 'ne designe ni indice ni declaration').length, 1);
});

test('reaction designant a la fois un indice et une declaration', () => {
  const problemes = validateCase(affaire({ reactions: [reaction({ statement: 'd1' })] }));
  assert.equal(parmi(problemes, 'a la fois un indice et une declaration').length, 1);
});

test('reaction sans replique', () => {
  const problemes = validateCase(affaire({ reactions: [reaction({ lines: [] })] }));
  assert.equal(parmi(problemes, 'aucune replique').length, 1);
});

// --- Impasses --------------------------------------------------------

test('personnage sans question de relance permanente', () => {
  const problemes = validateCase(affaire({ topics: [question({ effects: { revealFacts: ['f1'] } })] }));
  assert.equal(parmi(problemes, 'aucune question de relance permanente').length, 1);
});

test('personnage sans reponse generique', () => {
  const problemes = validateCase(
    affaire({ characters: [personnage({ defaultReaction: [] })] }),
  );
  assert.equal(parmi(problemes, 'aucune reponse generique').length, 1);
});

test('question masquee que rien ne debloque jamais', () => {
  const problemes = validateCase(
    affaire({
      topics: [relance(), question({ effects: { revealFacts: ['f1'] }, hidden: true })],
    }),
  );
  assert.equal(parmi(problemes, 'rien ne la debloque jamais').length, 1);
});
