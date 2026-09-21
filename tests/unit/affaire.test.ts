/* ===================================================================
   tests/unit/affaire.test.ts

   L'affaire elle-meme, eprouvee comme une donnee.

   Le validateur verifie la mecanique : identifiants, conditions,
   effets, impasses. Il ne peut rien dire du sens. Ce fichier ajoute
   les quelques regles d'ecriture qui, elles, SONT verifiables :
   l'absence de certains mots dans la bouche d'un temoin.

   Nino est parti a 21 h 50. Tout ce qu'il pourrait dire du retour de
   Rosa, du contenu du poele ou du nom du produit pris dans le local
   serait une connaissance qu'il n'a pas. Ces mots-la sont donc
   interdits dans son texte, et un test vaut mieux qu'une bonne
   intention : il tiendra encore le jour ou quelqu'un reecrira une
   replique sans se souvenir pourquoi elle etait prudente.
   =================================================================== */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dernierService } from '../../src/data/cases/dernier-service';
import { validateCase } from '../../src/game/dialogue';

test('l affaire passe le validateur sans un seul probleme', () => {
  assert.deepEqual(validateCase(dernierService), []);
});

test('la tranche en cours a la taille annoncee', () => {
  assert.equal(dernierService.characters.length, 1);
  assert.equal(dernierService.clues.length, 3);
  assert.equal(dernierService.facts.length, 6);
  assert.equal(dernierService.statements.length, 6);
  assert.equal(dernierService.topics.length, 8);
  assert.equal(dernierService.reactions.length, 3);
});

/** Tout ce qu'un personnage prononce : repliques de questions, de
    reactions, reponse generique, et ses declarations au carnet. */
function paroles(character: string): string {
  const morceaux: string[] = [];

  for (const topic of dernierService.topics) {
    if (topic.speaker !== character) continue;
    for (const line of topic.lines) {
      if (line.speaker === character) morceaux.push(line.text);
    }
  }
  for (const reaction of dernierService.reactions) {
    if (reaction.character !== character) continue;
    for (const line of reaction.lines) {
      if (line.speaker === character) morceaux.push(line.text);
    }
  }
  for (const sheet of dernierService.characters) {
    if (sheet.id !== character) continue;
    for (const line of sheet.defaultReaction) morceaux.push(line.text);
  }
  for (const statement of dernierService.statements) {
    if (statement.speaker === character) morceaux.push(statement.text);
  }

  return morceaux.join(' ‖ ').toLowerCase();
}

/* Les mots que Nino ne peut pas prononcer, et la raison de chacun.
   La raison est dans le test : elle s'affiche quand il echoue, ce qui
   evite d'avoir a retrouver pourquoi l'interdit existait. */
const interditsNino: ReadonlyArray<[string, string]> = [
  ['arsenic', 'il a vu un geste, pas une etiquette'],
  ['mort-aux-rats', 'il a vu un geste, pas une etiquette'],
  ['poison', 'il ignore de quoi Victor est mort'],
  ['revenue', 'il etait parti : il ne peut pas savoir que Rosa est revenue'],
  ['revenir', 'il etait parti : il ne peut pas savoir que Rosa est revenue'],
  ['brule', 'il voit des cendres, il ne sait pas ce qui a brule'],
  ['papier', 'il voit des cendres, il ne sait pas ce qui a brule'],
  ['document', 'il n a jamais entendu parler du releve de Victor'],
  ['releve', 'il n a jamais entendu parler du releve de Victor'],
];

for (const [mot, raison] of interditsNino) {
  test(`Nino ne dit jamais « ${mot} » : ${raison}`, () => {
    assert.equal(paroles('nino').includes(mot), false);
  });
}

test('le mensonge de Nino est bien marque comme tel, et il est seul', () => {
  const siens = dernierService.statements.filter((s) => s.speaker === 'nino');
  const faux = siens.filter((s) => s.truth === 'false');

  assert.equal(faux.length, 1, 'Nino ne ment que sur une chose');
  assert.equal(faux[0].id, 'nino_sac_rien', 'et c est le sac, pas le reste');
});

test('les trois indices sont ranges sous un lieu', () => {
  const lieux = new Set(dernierService.clueRubrics.map((r) => r.id));
  for (const clue of dernierService.clues) {
    assert.equal(lieux.has(clue.rubric), true, `${clue.id} : rubrique inconnue`);
  }
});

test('aucune description d indice ne cite un temoignage', () => {
  /* La source d un indice est l objet seul. « Personnel », « à lui »,
     « personne d autre » sont des choses qu une chose ne sait pas. */
  for (const clue of dernierService.clues) {
    const texte = clue.description.toLowerCase();
    assert.equal(texte.includes('personne d’autre'), false, clue.id);
    assert.equal(texte.includes('personnelle'), false, clue.id);
  }
});
