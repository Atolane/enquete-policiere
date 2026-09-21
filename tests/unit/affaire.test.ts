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
  assert.equal(dernierService.characters.length, 4);
  assert.equal(dernierService.clues.length, 4);
  assert.equal(dernierService.facts.length, 11);
  assert.equal(dernierService.statements.length, 27);
  assert.equal(dernierService.topics.length, 29);
  assert.equal(dernierService.reactions.length, 11);
});

test('la reprise d Enzo remplace bien sa premiere version', () => {
  const reprise = dernierService.statements.find((s) => s.id === 'enzo_livraison_reprise');
  assert.equal(reprise?.supersedes, 'enzo_livraison');

  const premiere = dernierService.statements.find((s) => s.id === 'enzo_livraison');
  assert.notEqual(premiere, undefined, 'la version remplacee doit exister');
  assert.equal(premiere?.speaker, reprise?.speaker, 'on ne se reprend que soi-meme');
});

test('Enzo ment, et le moteur le sait sans jamais le dire', () => {
  const siens = dernierService.statements.filter((s) => s.speaker === 'enzo');
  const faux = siens.filter((s) => s.truth === 'false');
  assert.equal(faux.length >= 3, true, 'il ment sur l heure, la dispute et le matin');

  /* Le champ truth ne doit apparaitre dans AUCUN texte visible : ni
     dans une replique, ni dans une description d indice. */
  const visible = [
    ...dernierService.topics.flatMap((t) => t.lines.map((l) => l.text)),
    ...dernierService.reactions.flatMap((r) => r.lines.map((l) => l.text)),
    ...dernierService.clues.map((c) => c.description),
    ...dernierService.facts.map((f) => f.text),
  ].join(' ').toLowerCase();
  /* « ment » tout court ne peut pas servir : c'est une sous-chaine de
     « seulement », « comment », « egalement ». On cherche donc les
     mots entiers, accents retires au prealable -- en JavaScript une
     lettre accentuee n'est pas un caractere de mot, et « \b » se
     placerait au mauvais endroit. */
  const sansAccents = visible.normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const mot of ['mensonge', 'menteur', 'mentez', 'ment', 'contradiction', 'coupable']) {
    assert.equal(
      new RegExp(`\\b${mot}\\b`).test(sansAccents),
      false,
      `aucun texte visible ne doit contenir « ${mot} »`,
    );
  }
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

  /* Accents retires : sans cela, « brule » ne verrait pas « brulé » et
     « releve » ne verrait pas « relevé ». Un interdit qu'un accent
     suffit a contourner n'est pas un interdit. */
  return morceaux
    .join(' ‖ ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

/* CE QUE ROSA NE PEUT PAS DIRE A SON PREMIER ENTRETIEN.
   Deux raisons distinctes, et il vaut mieux ne pas les confondre.

   Les premiers mots relevent de la meme regle que pour Nino : une
   source ne donne pas plus que ce qu'elle possede honnetement. Rosa
   n'a aucune raison de parler du poele, des cendres ou d'un document
   dont personne ne lui a parle.

   Les seconds relevent d'autre chose : ils diraient trop tot ce que
   l'affaire doit faire decouvrir. Une femme qui evoque d'elle-meme son
   retour, ou qui se defend d'un soupcon que nul n'a formule, s'est
   deja designee. Le joueur n'aurait plus d'enquete a mener sur elle,
   seulement une confirmation a aller chercher. */
const interditsRosa: ReadonlyArray<[string, string]> = [
  ['revenue', 'son retour est ce que l affaire doit faire decouvrir, pas ce qu elle annonce'],
  ['revenir', 'son retour est ce que l affaire doit faire decouvrir, pas ce qu elle annonce'],
  ['repassee', 'meme raison : rien dans sa parole ne doit la ramener sur place'],
  ['poele', 'personne ne lui en a parle'],
  ['cendres', 'personne ne lui en a parle'],
  ['document', 'elle ignore jusqu a l existence du releve'],
  ['releve', 'elle ignore jusqu a l existence du releve'],
  ['arsenic', 'aucun temoin ne nomme un produit a ce stade'],
  ['poison', 'aucun temoin ne nomme un produit a ce stade'],
  ['innocente', 'se defendre d un soupcon que personne n a formule, c est l avouer'],
];

for (const [mot, raison] of interditsRosa) {
  test(`Rosa ne dit jamais « ${mot} » : ${raison}`, () => {
    assert.equal(paroles('rosa').includes(mot), false);
  });
}

test('Rosa ne ment qu une fois, et sur l heure', () => {
  const siennes = dernierService.statements.filter((s) => s.speaker === 'rosa');
  const faux = siennes.filter((s) => s.truth === 'false');

  /* Deux ecarts seulement : l'heure de son depart et la raison qu'elle
     donne d'avoir renvoye le petit. Tout le reste est vrai -- c'est ce
     qui rend les deux invisibles. */
  assert.deepEqual(
    faux.map((s) => s.id).sort(),
    ['rosa_nino_renvoye', 'rosa_rentree'],
  );
  assert.equal(siennes.length > faux.length * 2, true, 'elle dit surtout la verite');
});

test('le premier entretien de Rosa ne la designe jamais', () => {
  /* Aucune de ses questions n'est de la categorie « pression » : a ce
     stade, le joueur n'a rien a lui opposer, et une question de
     pression posee sans piece est une accusation gratuite. */
  const siennes = dernierService.topics.filter((t) => t.speaker === 'rosa');
  assert.equal(siennes.length > 0, true);
  for (const topic of siennes) {
    assert.notEqual(topic.category, 'pression', `${topic.id} : trop tot pour presser Rosa`);
  }

  /* Et son humeur ne bouge pas : aucun effet setMood. Une humeur qui
     se degrade au premier entretien serait un aveu de mise en scene. */
  for (const topic of siennes) {
    assert.equal(topic.effects?.setMood, undefined, `${topic.id} : son humeur ne doit pas bouger`);
  }
});

/* CE QU'ALDO NE PEUT PAS DIRE A SON PREMIER ENTRETIEN.
   Il tient les ecritures, il paie les factures, il a recu des avances
   de son oncle : tout cela, il le dit, et c'est ce qui le rend
   credible. Ce qu'il ne dit pas, c'est le mot qui transformerait ces
   trois choses en une seule. Un temoin qui prononce lui-meme le mot
   qui l'accuse n'est plus un temoin, c'est un aveu qui marche. */
const interditsAldo: ReadonlyArray<[string, string]> = [
  ['detournement', 'le mot qui resume tout ne peut pas venir de lui'],
  ['detourne', 'le mot qui resume tout ne peut pas venir de lui'],
  ['fausse facture', 'il enonce la regle, il ne decrit pas comment il la contourne'],
  ['fictive', 'il enonce la regle, il ne decrit pas comment il la contourne'],
  ['coupable', 'personne ne se designe au premier entretien'],
  ['innocent', 'se defendre d un soupcon que nul n a formule, c est l avouer'],
  ['dette', 'ses dettes sont le mobile : elles se decouvrent, elles ne s annoncent pas'],
  ['cave', 'la cave n existe pas encore dans l enquete'],
  ['arsenic', 'aucun temoin ne nomme un produit a ce stade'],
  ['poison', 'aucun temoin ne nomme un produit a ce stade'],
];

for (const [mot, raison] of interditsAldo) {
  test(`Aldo ne dit jamais « ${mot} » : ${raison}`, () => {
    assert.equal(paroles('aldo').includes(mot), false);
  });
}

test('Aldo n est pas coupable a la lecture de son premier entretien', () => {
  const siennes = dernierService.topics.filter((t) => t.speaker === 'aldo');
  assert.equal(siennes.length > 0, true);

  /* Ni pression, ni humeur qui se degrade : les deux signaux dont le
     joueur se sert pour sentir qu'il touche quelque chose. Aldo n'en
     emet aucun. Ce qu'il laisse, ce sont deux phrases a rapprocher. */
  for (const topic of siennes) {
    assert.notEqual(topic.category, 'pression', `${topic.id} : trop tot pour presser Aldo`);
    assert.equal(topic.effects?.setMood, undefined, `${topic.id} : son humeur ne doit pas bouger`);
  }
  for (const reaction of dernierService.reactions.filter((r) => r.character === 'aldo')) {
    assert.equal(reaction.effects?.setMood, undefined, 'aucune de ses reactions ne change son humeur');
  }
});

test('la contradiction sur le jour de livraison existe, et personne ne la nomme', () => {
  /* Enzo dit mercredi, Aldo dit mardi et vendredi. Les deux phrases
     sont dans le jeu, et rien dans le jeu ne les rapproche : c'est au
     joueur de le faire. */
  const enzo = dernierService.statements.find((s) => s.id === 'enzo_livraison_reprise');
  const aldo = dernierService.statements.find((s) => s.id === 'aldo_adriatica');
  assert.equal(/mercredi/.test(enzo?.text ?? ''), true);
  assert.equal(/mardi/.test(aldo?.text ?? ''), true);
  assert.equal(/vendredi/.test(aldo?.text ?? ''), true);
  assert.equal(/mercredi/.test(aldo?.text ?? ''), false, 'il ne reprend pas le jour d Enzo');

  /* La declaration d'Enzo est presentable a Aldo, et sa reaction ne
     produit AUCUN effet : pas de fait revele, pas de question ouverte,
     pas d humeur changee. Le seul resultat est une phrase de plus au
     carnet. */
  const face = dernierService.reactions.find(
    (r) => r.character === 'aldo' && r.statement === 'enzo_livraison_reprise',
  );
  assert.notEqual(face, undefined, 'la declaration d Enzo doit lui etre presentable');
  assert.equal(face?.effects, undefined, 'le jeu ne tire aucune conclusion a la place du joueur');
});

test('la question sur la glace exige le detour par Nino', () => {
  /* Elle n'est pas « masquee » : elle est CONDITIONNEE. La nuance
     compte -- une question masquee attend qu'on la deverrouille, une
     question conditionnee attend que le joueur sache quelque chose. */
  const glace = dernierService.topics.find((t) => t.id === 'aldo_glace');
  assert.equal(glace?.hidden, undefined);
  assert.deepEqual(glace?.requires?.facts, ['fait_glace_impossible']);

  /* Et ce fait ne s'obtient qu'en montrant les livres a Nino, qui est
     celui qui rentre la glace. */
  const source = dernierService.reactions.filter((r) =>
    (r.effects?.revealFacts ?? []).includes('fait_glace_impossible'),
  );
  assert.equal(source.length, 1);
  assert.equal(source[0].character, 'nino');
  assert.equal(source[0].clue, 'livres_comptes');
});

test('un fait acquis nomme les temoins en entier', () => {
  /* Le carnet est un document, pas une conversation : « Rosa » y
     devient « Rosa Vitale ». Dans la bouche de Nino, en revanche,
     « Rosa » reste « Rosa » -- un commis de dix-neuf ans ne donne pas
     le nom de famille de sa chef de salle. */
  for (const fact of dernierService.facts) {
    for (const sheet of dernierService.characters) {
      const prenom = sheet.name.split(' ')[0];
      if (!fact.text.includes(prenom)) continue;
      assert.equal(
        fact.text.includes(sheet.name),
        true,
        `fait ${fact.id} : « ${prenom} » sans son nom de famille`,
      );
    }
  }
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
