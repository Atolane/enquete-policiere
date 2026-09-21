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
  assert.equal(dernierService.characters.length, 5);
  assert.equal(dernierService.clues.length, 6);
  assert.equal(dernierService.clueRubrics.length, 2);
  assert.equal(dernierService.facts.length, 18);
  assert.equal(dernierService.statements.length, 39);
  assert.equal(dernierService.topics.length, 40);
  assert.equal(dernierService.reactions.length, 20);
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

test('Rosa ment peu, et jamais sur rien de verifiable tout de suite', () => {
  const siennes = dernierService.statements.filter((s) => s.speaker === 'rosa');
  const faux = siennes.filter((s) => s.truth === 'false');

  /* Trois ecarts, pas un de plus : l'heure de son depart, la raison
     qu'elle donne d'avoir renvoye le petit, et le poele auquel elle
     n'a rien allume. Le reste est vrai, et c'est ce qui rend les trois
     invisibles -- un temoin qui ment sur tout se repere en deux
     questions. */
  assert.deepEqual(
    faux.map((s) => s.id).sort(),
    ['rosa_nino_renvoye', 'rosa_rentree', 'rosa_rien_allume'],
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

/* ===================================================================
   LE RESULTAT DE LABORATOIRE

   C'est le premier objet de l'affaire qui ressemble a une preuve, et
   c'est pour cela qu'il est le plus dangereux. Un bulletin mal ecrit
   ferait le travail a la place du joueur : il lui dirait de quoi
   Victor est mort, et l'enquete deviendrait une formalite.

   Les quatre tests qui suivent tiennent la ligne : le bulletin dit ce
   qu'il a vu, il ne conclut pas, il ne designe personne, et le moteur
   n'en tire rien.
   =================================================================== */

const bulletin = () => {
  const fait = dernierService.facts.find((f) => f.id === 'fait_labo_preliminaire');
  const dite = dernierService.statements.find((s) => s.id === 'doyle_resultat_preliminaire');
  const question = dernierService.topics.find((t) => t.id === 'doyle_resultat');
  assert.notEqual(fait, undefined);
  assert.notEqual(dite, undefined);
  assert.notEqual(question, undefined);
  return { fait: fait!, dite: dite!, question: question! };
};

test('le bulletin reste preliminaire, et le dit', () => {
  const { fait, dite } = bulletin();
  for (const texte of [fait.text, dite.text]) {
    assert.match(texte, /préliminaire/i);
    assert.match(texte, /compatible avec la présence/i);
  }
  /* « compatible avec la presence de » n'est pas « contenait ». Le
     jour ou quelqu'un abregera, ce test le dira. */
  assert.doesNotMatch(fait.text, /contenait|contient|renferm/i);
  assert.doesNotMatch(dite.text, /contenait|contient|renferm/i);
});

test('le bulletin ne porte ni quantite, ni date, ni nom', () => {
  const { fait, dite } = bulletin();

  /* Aucun chiffre : ni un dosage, ni un seuil, ni une heure. Un
     nombre dans un bulletin est une precision, et nous n'avons defini
     aucun procede qui la justifierait. */
  for (const texte of [fait.text, dite.text]) {
    assert.doesNotMatch(texte, /[0-9]/, 'un chiffre dans le bulletin serait une quantite');
    assert.doesNotMatch(texte, /milligramme|gramme|dose|taux|seuil/i);
  }

  /* Aucun nom de personnage : un bulletin qui designe quelqu'un n'est
     plus un bulletin, c'est une accusation. */
  for (const sheet of dernierService.characters) {
    for (const texte of [fait.text, dite.text]) {
      assert.equal(texte.includes(sheet.name.split(' ')[0]), false, `${sheet.name} n a rien a faire la`);
    }
  }
});

test('le moteur ne conclut rien a la place du joueur', () => {
  const { question } = bulletin();

  /* La question du laboratoire ne fait qu'une chose : porter le fait
     au carnet. Elle n'ouvre aucune autre question, ne change aucune
     humeur, ne termine aucun entretien. */
  assert.deepEqual(question.effects?.revealFacts, ['fait_labo_preliminaire']);
  assert.equal(question.effects?.unlockTopics, undefined);
  assert.equal(question.effects?.setMood, undefined);
  assert.equal(question.effects?.endInterrogation, undefined);

  /* Et le presenter a quelqu'un ne produit rien non plus. Deux
     personnes le commentent -- Rosa, qui portait l'anisette, et Aldo,
     qui n'etait pas la et tient a le rappeler -- et aucune des deux
     reactions n'a le moindre effet : ce qu'il faut en penser
     n'appartient qu'au joueur. */
  const faceAuBulletin = dernierService.reactions.filter(
    (r) => r.statement === 'doyle_resultat_preliminaire',
  );
  assert.deepEqual(faceAuBulletin.map((r) => r.character).sort(), ['aldo', 'rosa']);
  for (const reaction of faceAuBulletin) {
    assert.equal(reaction.effects, undefined, `${reaction.character} : aucun effet attendu`);
  }

  /* Rosa, elle, ne concede rien du tout : sa reaction ne porte meme
     pas de declaration au carnet. Elle repond, et il ne reste rien. */
  const chezRosa = faceAuBulletin.find((r) => r.character === 'rosa')!;
  assert.equal(chezRosa.records, undefined);
});

test('le bulletin n existe que si le joueur remet la bouteille', () => {
  const { question } = bulletin();
  assert.equal(question.hidden, true);

  const ouvrent = dernierService.reactions.filter((r) =>
    (r.effects?.unlockTopics ?? []).includes('doyle_resultat'),
  );
  const aussi = dernierService.topics.filter((t) =>
    (t.effects?.unlockTopics ?? []).includes('doyle_resultat'),
  );
  assert.equal(aussi.length, 0, 'aucune question ne doit ouvrir le laboratoire');
  assert.equal(ouvrent.length, 1, 'un seul geste doit l ouvrir');
  assert.equal(ouvrent[0].character, 'doyle');
  assert.equal(ouvrent[0].clue, 'bouteille_anisette');
});

/* Doyle rapporte ; il ne juge pas. Ces mots-la sont ceux d'un homme
   qui a deja conclu, et un rapport qui conclut n'est plus un rapport. */
const interditsDoyle: ReadonlyArray<[string, string]> = [
  ['coupable', 'il constate, il ne designe pas'],
  ['assassin', 'il constate, il ne designe pas'],
  ['meurtrier', 'il constate, il ne designe pas'],
  ['empoisonn', 'le mot n est pas dans le bulletin : il ne sera pas dans sa bouche'],
  ['certitude', 'un resultat preliminaire n en offre aucune'],
  ['prouve', 'compatible avec n est pas prouve par'],
];

for (const [mot, raison] of interditsDoyle) {
  test(`Doyle ne dit jamais « ${mot} » : ${raison}`, () => {
    assert.equal(paroles('doyle').includes(mot), false);
  });
}

/* ===================================================================
   LA CONTRE-EPREUVE

   Le second resultat est plus dangereux que le premier, parce qu'il
   ressemble encore davantage a une preuve. « Compatibles » est un mot
   de chimiste, et un joueur presse le lira « identiques ». Le jeu ne
   doit pas l'y aider : la phrase porte ses reserves, et le moteur n'en
   tire toujours rien.
   =================================================================== */

const contreEpreuve = () => {
  const fait = dernierService.facts.find((f) => f.id === 'fait_labo_contre_epreuve');
  const dite = dernierService.statements.find((s) => s.id === 'doyle_contre_epreuve');
  const question = dernierService.topics.find((t) => t.id === 'doyle_contre_epreuve');
  assert.notEqual(fait, undefined);
  assert.notEqual(dite, undefined);
  assert.notEqual(question, undefined);
  return { fait: fait!, dite: dite!, question: question! };
};

test('la contre-epreuve dit « compatibles », et ce qu elle n etablit pas', () => {
  const { fait, dite } = contreEpreuve();
  for (const texte of [fait.text, dite.text]) {
    assert.match(texte, /compatibles? avec une même préparation/i);
    assert.match(texte, /n[’']établit pas d[’']origine unique/i);
  }
  /* Les trois choses qu'elle ne nomme pas doivent etre ecrites la ou
     le joueur relira : dans le fait porte au carnet. */
  assert.match(fait.text, /ni le produit/i);
  assert.match(fait.text, /ni le fabricant/i);
  assert.match(fait.text, /ni personne/i);
});

test('ni « lot », ni « concentration », nulle part dans le jeu', () => {
  /* Deux formulations ecartees a la conception, et pour deux raisons
     differentes : « meme lot » affirme une origine unique que la
     comparaison n etablit pas, et « concentration » suppose un procede
     quantitatif dont l affaire n a jamais defini le moindre detail.
     Le controle vaut pour TOUT texte visible, pas seulement pour le
     laboratoire : c est la seule facon qu il tienne encore quand
     quelqu un ecrira la conclusion. */
  const visible = [
    ...dernierService.topics.flatMap((t) => t.lines.map((l) => l.text)),
    ...dernierService.reactions.flatMap((r) => r.lines.map((l) => l.text)),
    ...dernierService.characters.flatMap((c) => c.defaultReaction.map((l) => l.text)),
    ...dernierService.clues.map((c) => c.description),
    ...dernierService.facts.map((f) => f.text),
    ...dernierService.statements.map((s) => s.text),
  ]
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  assert.doesNotMatch(visible, /\blots?\b/, '« lot » affirme une origine unique');
  assert.doesNotMatch(visible, /concentration/, '« concentration » suppose un dosage');
});

test('les deux resultats restent deux choses distinctes', () => {
  const premier = dernierService.statements.find((s) => s.id === 'doyle_resultat_preliminaire')!;
  const second = dernierService.statements.find((s) => s.id === 'doyle_contre_epreuve')!;

  assert.equal(premier.speaker, 'doyle');
  assert.equal(second.speaker, 'doyle');
  /* Deux rubriques differentes : le carnet en fera deux entrees, et
     nul ne pourra prendre l'une pour l'autre en relisant. */
  assert.notEqual(premier.topic, second.topic);
  assert.equal(second.supersedes, undefined, 'la seconde ne remplace pas la premiere');

  const faitUn = dernierService.facts.find((f) => f.id === 'fait_labo_preliminaire')!;
  const faitDeux = dernierService.facts.find((f) => f.id === 'fait_labo_contre_epreuve')!;
  assert.notEqual(faitUn.topic, faitDeux.topic);
});

test('la contre-epreuve a deux verrous, pas un', () => {
  const { question } = contreEpreuve();
  assert.equal(question.hidden, true);

  const ouvrent = dernierService.reactions.filter((r) =>
    (r.effects?.unlockTopics ?? []).includes('doyle_contre_epreuve'),
  );
  const parQuestion = dernierService.topics.filter((t) =>
    (t.effects?.unlockTopics ?? []).includes('doyle_contre_epreuve'),
  );
  assert.equal(parQuestion.length, 0, 'aucune question ne doit l ouvrir');
  assert.equal(ouvrent.length, 1, 'un seul geste doit l ouvrir');

  /* Premier verrou : le geste. Il faut rapporter le prelevement a
     Doyle en main propre. */
  assert.equal(ouvrent[0].character, 'doyle');
  assert.equal(ouvrent[0].clue, 'trace_etagere');

  /* Second verrou : il faut deja tenir le premier resultat, faute de
     quoi il n'y a rien a comparer. */
  assert.deepEqual(ouvrent[0].requires?.facts, ['fait_labo_preliminaire']);
});

test('le prelevement rapporte trop tot ne debloque rien, et le dit', () => {
  const lesDeux = dernierService.reactions.filter(
    (r) => r.character === 'doyle' && r.clue === 'trace_etagere',
  );
  assert.equal(lesDeux.length, 2, 'un cas conditionne, et son jumeau sans condition');

  /* findReaction() rend la PREMIERE reaction dont les conditions
     passent. Si la version sans condition passait devant, elle
     capterait tout et la contre-epreuve deviendrait inatteignable --
     sans que rien ne plante. L'ordre est donc une regle, pas un
     hasard de redaction. */
  const iConditionnee = dernierService.reactions.findIndex(
    (r) => r.character === 'doyle' && r.clue === 'trace_etagere' && r.requires !== undefined,
  );
  const iLibre = dernierService.reactions.findIndex(
    (r) => r.character === 'doyle' && r.clue === 'trace_etagere' && r.requires === undefined,
  );
  assert.equal(iConditionnee < iLibre, true, 'la conditionnee doit passer en premier');

  /* Le cas « trop tot » n'ouvre rien. Il enregistre seulement ce que
     l'objet permet d'etablir tout seul. */
  const libre = dernierService.reactions[iLibre];
  assert.equal(libre.effects?.unlockTopics, undefined);
  assert.equal(libre.effects?.setMood, undefined);
  assert.deepEqual(libre.effects?.revealFacts, ['fait_trace_etagere']);
  /* Et il explique ce qui manque, plutot que de laisser le joueur
     devant un mur muet. */
  const dit = libre.lines.map((l) => l.text).join(' ');
  assert.match(dit, /compare|mettre en face/i);
});

test('la contre-epreuve ne fait conclure personne', () => {
  const { question } = contreEpreuve();
  assert.deepEqual(question.effects?.revealFacts, ['fait_labo_contre_epreuve']);
  assert.equal(question.effects?.unlockTopics, undefined);
  assert.equal(question.effects?.setMood, undefined);
  assert.equal(question.effects?.endInterrogation, undefined);

  /* La presenter a Enzo -- la seule personne a qui cela aille de soi,
     puisque c'est son etagere -- ne produit rien du tout. */
  const face = dernierService.reactions.filter((r) => r.statement === 'doyle_contre_epreuve');
  assert.equal(face.length, 1);
  assert.equal(face[0].character, 'enzo');
  assert.equal(face[0].effects, undefined);
  assert.equal(face[0].records, undefined);
});

test('ce que la trace etablit ne depasse pas ce qu une trace peut dire', () => {
  const trace = dernierService.clues.find((c) => c.id === 'trace_etagere')!;
  const fait = dernierService.facts.find((f) => f.id === 'fait_trace_etagere')!;

  /* L'objet decrit un rond de poussiere et de la poudre dans le bois.
     Il ne nomme aucun produit, aucune marque, aucune personne. */
  for (const texte of [trace.description, fait.text]) {
    assert.doesNotMatch(texte, /arsenic|raticide|mort-aux-rats|poison|marque/i);
    for (const sheet of dernierService.characters) {
      assert.equal(texte.includes(sheet.name.split(' ')[0]), false, `${sheet.name} n a rien a faire la`);
    }
  }
  /* Ce que la poussiere permet, et rien de plus : qu'un recipient soit
     reste la, et qu'il n'y soit plus. */
  assert.match(fait.text, /récipient/i);
  assert.match(fait.text, /n[’']y est plus/i);
  assert.equal(trace.rubric, 'local');
});

/* ===================================================================
   L'APPROFONDISSEMENT DE ROSA ET D'ALDO (tranche 7)

   Quatre questions de plus et deux pieces a leur presenter. Le risque
   de cette tranche-ci n'est plus la fuite d'information : c'est la
   DESIGNATION. Quatre reponses evasives de suite, une humeur qui se
   degrade, une question de pression qui apparait -- et le joueur sait,
   sans avoir rien deduit, qui il doit soupconner.

   Les tests qui suivent verifient que rien de tout cela n'arrive.
   =================================================================== */

/** Les quatre questions et les deux reactions ajoutees en tranche 7. */
const tranche7 = {
  topics: ['rosa_victor_tard', 'rosa_poele', 'aldo_ce_soir_la', 'aldo_remboursement'],
  reactions: [
    { character: 'rosa', statement: 'enzo_soiree' },
    { character: 'aldo', statement: 'doyle_resultat_preliminaire' },
  ],
};

test('les quatre nouvelles questions existent et restent non accusatoires', () => {
  for (const id of tranche7.topics) {
    const topic = dernierService.topics.find((t) => t.id === id);
    assert.notEqual(topic, undefined, `${id} : introuvable`);
    assert.notEqual(topic!.category, 'pression', `${id} : trop tot pour presser`);
    assert.equal(topic!.effects?.setMood, undefined, `${id} : son humeur ne doit pas bouger`);
    assert.equal(topic!.effects?.endInterrogation, undefined, `${id} : personne ne claque la porte`);
  }
});

test('chacune attend quelque chose que le joueur doit etre alle chercher', () => {
  /* Aucune des quatre ne tombe du ciel : chacune a son prerequis, et
     chaque prerequis vient d'ailleurs. Rosa ouvre une question chez
     Aldo ; Nino en ouvre une chez Rosa. C'est le maillage de
     l'affaire, et il se lit ici en huit lignes. */
  const attendu = {
    rosa_victor_tard: { facts: ['fait_verre_servi'] },
    rosa_poele: { facts: ['fait_cendres'] },
    aldo_ce_soir_la: { facts: ['fait_victor_restait_les_comptes'] },
    aldo_remboursement: { topicsAsked: ['aldo_avances'] },
  } as const;

  for (const [id, requis] of Object.entries(attendu)) {
    const topic = dernierService.topics.find((t) => t.id === id)!;
    assert.deepEqual(topic.requires, requis, `${id} : prerequis inattendu`);
  }

  /* Et le chemin le plus long tient debout : le verre presente a Rosa
     lui ouvre une question, dont la reponse ouvre une question chez
     Aldo. Trois personnes, deux pieces, aucun raccourci. */
  const verreChezRosa = dernierService.reactions.find(
    (r) => r.character === 'rosa' && r.clue === 'verre_renverse',
  )!;
  assert.deepEqual(verreChezRosa.effects?.revealFacts, ['fait_verre_servi']);
  const chezRosa = dernierService.topics.find((t) => t.id === 'rosa_victor_tard')!;
  assert.deepEqual(chezRosa.effects?.revealFacts, ['fait_victor_restait_les_comptes']);
});

test('les deux nouvelles pieces presentees ne declenchent rien', () => {
  for (const cible of tranche7.reactions) {
    const reaction = dernierService.reactions.find(
      (r) => r.character === cible.character && r.statement === cible.statement,
    );
    assert.notEqual(reaction, undefined, `${cible.character} / ${cible.statement} : introuvable`);
    /* Elles portent une phrase au carnet, et c'est tout. Ni fait, ni
       question ouverte, ni humeur : mettre deux versions face a face
       est le travail du joueur, pas celui du moteur. */
    assert.equal(reaction!.effects, undefined, `${cible.statement} : aucun effet attendu`);
    assert.equal((reaction!.records ?? []).length, 1);
  }
});

test('les deux versions de la fermeture coexistent, sans arbitre', () => {
  const enzo = dernierService.statements.find((s) => s.id === 'enzo_soiree')!;
  const rosa = dernierService.statements.find((s) => s.id === 'rosa_fermeture')!;
  const mise_au_point = dernierService.statements.find((s) => s.id === 'rosa_rideau')!;

  assert.match(enzo.text, /j[’']ai fermé/i);
  assert.match(rosa.text, /c[’']est moi qui ai fermé/i);

  /* Aucune des trois n'en remplace une autre : le carnet les garde
     toutes, dans l'ordre ou elles ont ete entendues. */
  for (const dite of [enzo, rosa, mise_au_point]) {
    assert.equal(dite.supersedes, undefined, `${dite.id} : rien ne doit etre efface`);
  }
  /* Et la mise au point de Rosa est VRAIE. Elle ne traite personne de
     menteur : elle fait une distinction de metier, qui se defend. */
  assert.equal(mise_au_point.truth, 'true');
});

test('Rosa et Aldo n en disent pas plus qu ils ne peuvent savoir', () => {
  const nouvelles = [
    'rosa_victor_tard', 'rosa_rien_allume', 'rosa_rideau',
    'aldo_ignorait', 'aldo_remboursement', 'aldo_pas_a_boire',
  ];
  for (const id of nouvelles) {
    const dite = dernierService.statements.find((s) => s.id === id);
    assert.notEqual(dite, undefined, `${id} : introuvable`);
    const texte = dite!.text;

    /* Aucune ne nomme un produit, ni ce qui a brule, ni le montage des
       ecritures. Ce sont les trois choses que l'affaire doit encore
       faire decouvrir. */
    assert.doesNotMatch(texte, /arsenic|poison|raticide|cendres|détournement|fausse facture/i);
    /* Et aucune ne designe quiconque. */
    assert.doesNotMatch(texte, /coupable|assassin|menteur|c[’']est (lui|elle)/i);
  }

  /* Ce que Rosa dit de Victor est une HABITUDE : « les soirs ou »,
     « une fois par mois ». Rien qui place quiconque dans le bureau la
     nuit du 12 -- elle n'en sait rien, et le fait acquis non plus. */
  const fait = dernierService.facts.find((f) => f.id === 'fait_victor_restait_les_comptes')!;
  assert.match(fait.text, /les soirs où/i);
  assert.doesNotMatch(fait.text, /le 12|cette nuit|ce soir-là/i);
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
