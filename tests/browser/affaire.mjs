/* ===================================================================
   SUITE NAVIGATEUR -- « LE DERNIER SERVICE » (Phase 9)

   Elle joue ce qu'un joueur ferait : marcher jusqu'a un indice,
   l'examiner, aller voir un temoin, lui poser une question, lui poser
   une piece sous le nez, ouvrir le carnet.

   CE QUE LE PARCOURS TRAVERSE (Phase 9, tranches 1 a 8)
     1. le verre renverse, Nino Restivo, une question qui s'ouvre ;
     2. le registre des livraisons, Enzo Carbone, et la premiere
        version qu'un temoin doit reprendre ;
     3. Rosa Vitale, au fond de la piece, et le verre qu'on lui
        presente ;
     4. Aldo Maglione, contre le mur est : ses jours de livraison, qui
        ne sont pas ceux d'Enzo, et la glace qu'il explique ;
     5. la bouteille au pied de la table, l'agent Doyle pres de
        l'entree, et le premier resultat de laboratoire ;
     6. le local arriere, la trace sur l'etagere haute, et la
        contre-epreuve -- qui exige DEUX choses, le premier resultat et
        le prelevement rapporte. Le parcours verifie le blocage autant
        que le deblocage, et rouvre deux fois l'entretien de Doyle ;
     7. quatre questions de plus chez Rosa et Aldo, chacune ouverte par
        ce qu'un autre temoin a dit ailleurs. Le parcours suit la plus
        longue chaine de l'affaire : le verre presente a Rosa lui ouvre
        une question, dont la reponse en ouvre une chez Aldo ;
     8. le poele du couloir. Quatre personnes repondent devant lui et
        deux seulement apportent un fait ; le constat de Doyle ouvre
        une question chez Aldo, a l'autre bout de la piece.

   (Cette liste est restee bloquee a la tranche 2 jusqu'a la tranche 7 :
   un remplacement de texte qui ne trouvait pas son ancre, et qui ne
   disait rien. Les controles, eux, ont toujours ete a jour -- seul ce
   commentaire mentait.)

   NAVIGATION -- a lire avant de deplacer un point de passage.
   La piece n'est pas un plateau vide et « allerVers » marche tout
   droit, sans contourner. Quatre obstacles decident des trajets :
     - le passage etroit (z de 1,2 a 1,8) n'a qu'une ouverture, large
       de 0,89 m, centree sur x = 0. Tout aller-retour nord-sud repasse
       donc par x = 0 ;
     - l'appareil de presse, a (-2,1 ; 2,6), ferme le couloir ouest :
       on longe le mur sud, vers z = 3,7 ;
     - la grande caisse occupe x de 2,8 a 4,2 : on s'arrete devant sa
       face ouest, vers x = 2,3, et le registre reste a portee ;
     - le local arriere n'a qu'une ouverture, de z = 1,1 a z = 2,1, sur
       sa facade a x = -4,2 ;
     - le renfoncement du poele ne se prend pas en ligne droite : entre
       la cloison du local et le cylindre de collision de Nino il reste
       vingt centimetres. On contourne Nino par l'est, puis on revient
       vers l'ouest sous lui.
   « allerVers » renvoie s'il est arrive. Un trajet qui echoue est un
   echec annonce, et non un controle suivant qui trouve un ecran vide
   sans savoir pourquoi.

   Prerequis :
     npm install --no-save playwright
     npx playwright install chromium
     npm run dev          (dans un autre terminal)
     node tests/browser/affaire.mjs
   =================================================================== */

import { chromium } from 'playwright';

const BASE = process.env.TEST_URL ?? 'http://localhost:5173';
const EYE = 1.65;
const SENS = 0.0022;

/** Les quatre cibles, en metres. */
const VERRE = { x: -4.5, y: 0.83, z: 3.5 };
const NINO = { x: -3.2, y: 1.35, z: -0.2 };
const ENZO = { x: 3.2, y: 1.35, z: -0.2 };
const REGISTRE = { x: 3.5, y: 1.43, z: -2.45 };
const ROSA = { x: 0, y: 1.35, z: -3.6 };
const ALDO = { x: 4.8, y: 1.35, z: 2.2 };
const LIVRES = { x: 3.5, y: 1.41, z: -2.0 };
const BOUTEILLE = { x: -5.0, y: 0.13, z: 4.15 };
const DOYLE = { x: 1.8, y: 1.35, z: 4.9 };
const ETAGERE = { x: -5.4, y: 1.29, z: 1.6 };
const POELE = { x: -4.91, y: 0.5, z: -0.9 };

let ok = 0;
let ko = 0;
const check = (nom, cond, detail = '') => {
  if (cond) {
    ok += 1;
    console.log(`  ok    ${nom}`);
  } else {
    ko += 1;
    console.log(`  ECHEC ${nom}${detail ? '  ->  ' + detail : ''}`);
  }
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});

const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') erreurs.push(m.text());
});

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(
  () => document.querySelector('#loading-screen')?.classList.contains('is-hidden'),
  { timeout: 40000 },
);
await page.waitForTimeout(900);

/* Le clic prend le controle du pointeur. Sans lui le joueur ne bouge
   pas, et rien de ce qui suit ne se produit. */
await page.mouse.click(500, 280);
await page.waitForTimeout(500);

// --- Marcher et viser, en lisant la ligne de controle ----------------

let yaw = 0;
let pitch = 0;

const etat = async () => {
  const t = await page.textContent('#debug-line');
  const m = /x (-?[\d.]+)\s+y (-?[\d.]+)\s+z (-?[\d.]+) \| cap (-?[\d.]+)° (-?[\d.]+)°/.exec(t);
  if (!m) throw new Error('ligne de controle illisible : ' + t);
  return { x: +m[1], y: +m[2], z: +m[3], yaw: (+m[4] * Math.PI) / 180, pitch: (+m[5] * Math.PI) / 180 };
};
const setYaw = async (t) => {
  await page.evaluate((dx) => window.dispatchEvent(new MouseEvent('mousemove', { movementX: dx })), -(t - yaw) / SENS);
  yaw = t;
  await page.waitForTimeout(100);
};
const setPitch = async (t) => {
  await page.evaluate((dy) => window.dispatchEvent(new MouseEvent('mousemove', { movementY: dy })), -(t - pitch) / SENS);
  pitch = t;
  await page.waitForTimeout(100);
};
const viser = async (o, passes = 3) => {
  for (let i = 0; i < passes; i += 1) {
    const p = await etat();
    yaw = p.yaw;
    pitch = p.pitch;
    await setYaw(Math.atan2(-(o.x - p.x), -(o.z - p.z)));
    await setPitch(Math.atan2((o.y ?? 1) - (p.y + EYE), Math.hypot(o.x - p.x, o.z - p.z)));
  }
  await page.waitForTimeout(250);
};
/**
 * Vise, et insiste si le viseur ne repond pas.
 *
 * « allerVers » s'arrete des qu'il est ASSEZ pres, ce qui va de la
 * distance d'arret a zero selon la marche du dernier pas. Trop pres
 * d'un personnage, le rayon passe au-dessus de son epaule et le viseur
 * reste muet. Un pas en arriere, un pas de cote, et il repond. Un
 * joueur fait cela sans y penser ; un test doit l'ecrire.
 */
const viserJusqua = async (o, motif, essais = 5) => {
  let vu = '';
  for (let i = 0; i < essais; i += 1) {
    await viser(o);
    vu = await page.textContent('#prompt-line');
    if (motif.test(vu)) return vu;
    const touche = i % 2 === 0 ? 'KeyS' : 'KeyD';
    await page.keyboard.down(touche);
    await page.waitForTimeout(200);
    await page.keyboard.up(touche);
    await page.waitForTimeout(150);
  }
  return vu;
};

/**
 * Attend qu'un entretien soit REELLEMENT ouvert sur la bonne personne.
 *
 * Le panneau garde le nom du precedent interlocuteur une fois referme.
 * Lire « .dialogue-name » sans verifier que le panneau est visible,
 * c'est prendre le souvenir du dernier entretien pour le suivant --
 * et c'est exactement ce qu'un echec intermittent a montre.
 */
const attendreEntretien = async (nom, max = 14) => {
  let vu = { ouvert: false, nom: '', role: '' };
  for (let i = 0; i < max; i += 1) {
    vu = await page.evaluate(() => ({
      ouvert: !document.querySelector('#dialogue-panel')?.classList.contains('is-hidden'),
      nom: document.querySelector('.dialogue-name')?.textContent ?? '',
      role: document.querySelector('.dialogue-role')?.textContent ?? '',
    }));
    if (vu.ouvert && vu.nom.includes(nom)) return vu;
    await page.waitForTimeout(250);
  }
  return vu;
};

/** Avance en ligne droite. Renvoie vrai si la cible a ete atteinte. */
const allerVers = async (o, arret, maxMs = 14000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const p = await etat();
    yaw = p.yaw;
    pitch = p.pitch;
    if (Math.hypot(o.x - p.x, o.z - p.z) <= arret) return true;
    await setPitch(0);
    await setYaw(Math.atan2(-(o.x - p.x), -(o.z - p.z)));
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(320);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(80);
  }
  return false;
};
/** Enchaine des points de passage et annonce le premier qui resiste. */
const trajet = async (nom, points) => {
  for (const [i, point] of points.entries()) {
    const arret = point.arret ?? 0.5;
    if (!(await allerVers(point, arret))) {
      const p = await etat();
      check(`trajet ${nom}`, false, `bloque au point ${i + 1} (${point.x} ; ${point.z}), reste en (${p.x.toFixed(2)} ; ${p.z.toFixed(2)})`);
      return false;
    }
  }
  await page.waitForTimeout(300);
  check(`trajet ${nom}`, true);
  return true;
};

/* FERMER UN PANNEAU NE REND PAS LA MAIN.
   Quitter un entretien libere le pointeur : les mouvements de souris
   ne sont plus recus, seule la marche repond encore, et le joueur
   avance tout droit dans la direction ou il regardait. Un clic reprend
   le controle -- c'est exactement ce qu'un joueur fait sans y penser. */
const reprendreLaMain = async () => {
  /* Chrome refuse le verrouillage pendant environ une seconde apres un
     appui sur Echap. On laisse passer ce delai, puis on reessaie. */
  await page.waitForTimeout(1100);
  for (let i = 0; i < 5; i += 1) {
    if (await page.evaluate(() => document.pointerLockElement !== null)) return true;
    await page.mouse.click(500, 280);
    await page.waitForTimeout(400);
  }
  return page.evaluate(() => document.pointerLockElement !== null);
};

/** L'etat de la fiche d'objet, panneau ferme compris. */
const fiche = () =>
  page.evaluate(() => ({
    ouverte: !document.querySelector('#info-panel')?.classList.contains('is-hidden'),
    titre: document.querySelector('.info-title')?.textContent ?? '',
    texte: document.querySelector('.info-text')?.textContent ?? '',
  }));

/**
 * Clique une entree de la liste, meme si elle a fallu defiler pour la
 * voir. La liste des pieces a presenter tient maintenant sur plusieurs
 * ecrans de haut : on l'amene sous les yeux avant de cliquer, ce qu'un
 * joueur fait a la molette.
 */
const cliquerChoix = async (selecteur) => {
  await page.waitForSelector(selecteur, { timeout: 15000 });
  await page.$eval(selecteur, (e) => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  await page.click(selecteur);
};

const choix = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.dialogue-choice')].map((e) => ({
      topic: e.dataset.topic ?? '',
      texte: e.querySelector('.choice-label')?.textContent ?? '',
      nouveau: e.querySelector('.choice-new') !== null,
    })),
  );

/** La ligne des pistes : son texte, et si elle est visible. */
const piste = () =>
  page.evaluate(() => ({
    visible: !document.querySelector('#lead-line')?.classList.contains('is-hidden'),
    texte: document.querySelector('#lead-line')?.textContent ?? '',
  }));
/**
 * Fait defiler les repliques jusqu'au retour des questions.
 *
 * La premiere boucle attend que la liste des questions DISPARAISSE.
 * Sans elle, « lire » sortait aussitot : la liste est encore a l'ecran
 * pendant la fraction de seconde qui suit le clic, l'entretien
 * paraissait fini alors qu'il commencait, et la declaration n'avait
 * pas encore ete portee au carnet quand on quittait la piece.
 */
const lire = async (max = 20) => {
  for (let i = 0; i < 12; i += 1) {
    if ((await choix()).length === 0) break;
    await page.waitForTimeout(200);
  }
  for (let i = 0; i < max; i += 1) {
    if ((await choix()).length > 0) return true;
    await page.click('#dialogue-line', { force: true }).catch(() => {});
    await page.waitForTimeout(280);
  }
  return (await choix()).length > 0;
};

/**
 * Comme « lire », mais rend tout ce qui est passe a l'ecran.
 *
 * Les repliques defilent une par une, au meme endroit : quand la liste
 * des questions revient, la derniere phrase prononcee a deja disparu.
 * Pour controler ce qu'un personnage a DIT, il faut donc le noter au
 * passage -- apres coup, il n'y a plus rien a lire.
 */
const lireEnNotant = async (max = 20) => {
  const vues = [];
  const noter = async () => {
    const texte = await page.textContent('#dialogue-line').catch(() => '');
    if (texte) vues.push(texte);
  };
  for (let i = 0; i < 12; i += 1) {
    if ((await choix()).length === 0) break;
    await page.waitForTimeout(200);
  }
  for (let i = 0; i < max; i += 1) {
    await noter();
    if ((await choix()).length > 0) break;
    await page.click('#dialogue-line', { force: true }).catch(() => {});
    await page.waitForTimeout(280);
  }
  return vues.join(' | ');
};

// --- 0. L'agent a la porte, en arrivant --------------------------------

/* Il se tient a deux metres du point d'apparition. C'est lui qu'on
   voit en premier, et c'est par lui qu'on apprend que le local du fond
   a ete ouvert. */
await trajet('jusqu a Doyle', [{ ...DOYLE, arret: 1.7 }]);
const inviteD0 = await viserJusqua(DOYLE, /Interroger Agent Doyle/);
check('le viseur annonce l agent Doyle', /Interroger Agent Doyle/.test(inviteD0), `"${inviteD0}"`);
await page.mouse.click(500, 280);
const enteteDoyle0 = await attendreEntretien('Agent Doyle');
check('l entretien s ouvre sur l agent Doyle', enteteDoyle0.ouvert && enteteDoyle0.nom.includes('Agent Doyle'), enteteDoyle0.nom);
check('sa qualite est affichee', /police/i.test(enteteDoyle0.role), enteteDoyle0.role);

const doyle0 = await choix();
check(
  'aucun des deux resultats n existe au depart',
  !doyle0.some((o) => o.topic === 'doyle_resultat') &&
    !doyle0.some((o) => o.topic === 'doyle_contre_epreuve'),
  JSON.stringify(doyle0.map((o) => o.texte)),
);

await cliquerChoix('.dialogue-choice[data-topic="doyle_local"]');
await page.waitForTimeout(350);
check('il dit que le local du fond est ouvert', await lire());

await cliquerChoix('.dialogue-choice[data-topic="doyle_alerte"]');
await page.waitForTimeout(350);
check('il dit qui a donne l alerte', await lire());

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('le joueur reprend la main en quittant Doyle', await reprendreLaMain());

// --- 1. Un indice du bureau -------------------------------------------

/* On longe le mur sud : l'appareil de presse ferme le passage direct. */
await trajet('jusqu au verre', [
  { x: -2.0, z: 3.7 },
  { x: -3.4, z: 3.5 },
]);
const invite = await viserJusqua(VERRE, /Examiner le verre/);
check('le viseur annonce le verre', /Examiner le verre/.test(invite), `"${invite}"`);

await page.mouse.click(500, 280);
await page.waitForTimeout(400);
const fiche1 = await fiche();
check('la fiche s ouvre sur le bon indice', fiche1.ouverte && /verre renvers/i.test(fiche1.titre), fiche1.titre);
check('elle porte le texte de l affaire', /sous-main/.test(fiche1.texte), fiche1.texte.slice(0, 50));
await page.mouse.click(500, 280);
await page.waitForTimeout(300);
check('la fiche se referme', (await fiche()).ouverte === false);

// --- 1 bis. La bouteille, au sol contre le pied de la table -----------

/* Un pas de cote, au sud de la table. Depuis le poste d'ou l'on
   examine le verre, la ligne de visee plonge et vient mourir dans le
   plateau : la bouteille est au sol, derriere le meuble. On se place
   du meme cote qu'elle, et elle apparait. */
await trajet('jusqu a la bouteille', [{ x: -3.4, z: 4.4, arret: 0.5 }]);
const invite1b = await viserJusqua(BOUTEILLE, /Examiner la bouteille/);
check('le viseur annonce la bouteille', /Examiner la bouteille/.test(invite1b), `"${invite1b}"`);
await page.mouse.click(500, 280);
await page.waitForTimeout(400);
const fiche1b = await fiche();
check('la fiche de la bouteille s ouvre', fiche1b.ouverte && /anisette/i.test(fiche1b.titre), fiche1b.titre);
check(
  'elle decrit ce qu on voit, et rien de plus',
  /trace sèche/.test(fiche1b.texte) && !/arsenic|poison|analyse/i.test(fiche1b.texte),
  fiche1b.texte.slice(0, 60),
);
await page.mouse.click(500, 280);
await page.waitForTimeout(300);

// --- 1 ter. Le local arriere ------------------------------------------

/* Les cloisons montent plus haut que les yeux : l'etagere ne se voit
   pas depuis la salle. On entre par l'ouverture, au milieu de la
   facade, et on s'avance jusqu'a la planche. */
await trajet('jusqu au local arriere', [
  { x: -3.6, z: 2.0 },
  { x: -3.9, z: 1.6 },
  { x: -4.6, z: 1.6, arret: 0.4 },
]);
const inviteE = await viserJusqua(ETAGERE, /Examiner l’étagère/);
check('le viseur annonce l etagere', /Examiner l’étagère/.test(inviteE), `"${inviteE}"`);
await page.mouse.click(500, 280);
await page.waitForTimeout(400);
const ficheE = await fiche();
check('la fiche de la trace s ouvre', ficheE.ouverte && /étagère/i.test(ficheE.titre), ficheE.titre);
check('elle decrit un rond de poussiere', /disque plus clair/.test(ficheE.texte), ficheE.texte.slice(0, 60));
check(
  'elle ne nomme aucun produit',
  !/arsenic|raticide|poison|mort-aux-rats/i.test(ficheE.texte),
  ficheE.texte.slice(0, 80),
);
await page.mouse.click(500, 280);
await page.waitForTimeout(300);

// --- 1 ter bis. Le poele du couloir ------------------------------------

/* Il est a deux pas du local, et pourtant on n'y va pas tout droit :
   Nino bouche le passage direct. On le contourne par l'est. */
await trajet('jusqu au poele', [
  { x: -3.4, z: 1.6, arret: 0.5 },
  { x: -2.2, z: 0.9, arret: 0.6 },
  { x: -2.2, z: -1.1, arret: 0.6 },
  { x: -4.0, z: -1.1, arret: 0.6 },
]);
const inviteP = await viserJusqua(POELE, /Examiner le poêle/);
check('le viseur annonce le poele', /Examiner le poêle/.test(inviteP), `"${inviteP}"`);
await page.mouse.click(500, 280);
await page.waitForTimeout(400);
const ficheP = await fiche();
check('la fiche du poele s ouvre', ficheP.ouverte && /poêle du couloir/i.test(ficheP.titre), ficheP.titre);
check('elle montre des cendres et un angle regle', /cendres/.test(ficheP.texte) && /papier réglé/.test(ficheP.texte), ficheP.texte.slice(0, 70));
check(
  'elle ne dit pas ce qui etait ecrit',
  !/relevé|document|compte|facture/i.test(ficheP.texte),
  ficheP.texte.slice(0, 90),
);
check(
  'ni qui a craque l allumette',
  !/Rosa|Enzo|Aldo|Nino|Victor/.test(ficheP.texte),
  ficheP.texte.slice(0, 90),
);
await page.mouse.click(500, 280);
await page.waitForTimeout(300);

// --- 1 quater. Retour chez Doyle : le blocage, puis le deblocage ------

/* En revenant du poele on est au NORD du passage etroit, dont
   l'unique ouverture est centree sur x = 0 : on y repasse, sinon on
   longe la cloison jusqu'a expiration du chronometre. */
await trajet('retour chez Doyle', [
  { x: -2.2, z: -1.0, arret: 0.6 },
  { x: -2.2, z: 0.9, arret: 0.6 },
  { x: 0, z: 0.9, arret: 0.5 },
  { x: 0, z: 4.0, arret: 0.6 },
  { ...DOYLE, arret: 1.7 },
]);
const inviteD = await viserJusqua(DOYLE, /Interroger Agent Doyle/);
check('le viseur le retrouve', /Interroger Agent Doyle/.test(inviteD), `"${inviteD}"`);
await page.mouse.click(500, 280);
const enteteDoyle = await attendreEntretien('Agent Doyle');
check('l entretien se rouvre sur l agent Doyle', enteteDoyle.ouvert && enteteDoyle.nom.includes('Agent Doyle'), enteteDoyle.nom);

const doyleAvant = await choix();
check(
  'la question du laboratoire n existe pas encore',
  !doyleAvant.some((o) => o.topic === 'doyle_resultat'),
  JSON.stringify(doyleAvant.map((o) => o.texte)),
);

/* LE PRELEVEMENT RAPPORTE TROP TOT.
   Il n'y a encore rien a comparer. Doyle le prend, le dit, et n'ouvre
   rien -- c'est le blocage, et il s'explique. */
await page.click('#dialogue-present');
await page.waitForTimeout(400);
await cliquerChoix('.dialogue-choice[data-evidence="clue:trace_etagere"]');
await page.waitForTimeout(400);
const refus = await lireEnNotant();
check('il dit ce qui lui manque', /compare|mettre en face/i.test(refus), refus.slice(0, 120));

const apresRefus = await choix();
check(
  'le prelevement seul n ouvre pas la contre-epreuve',
  !apresRefus.some((o) => o.topic === 'doyle_contre_epreuve'),
  JSON.stringify(apresRefus.map((o) => o.texte)),
);

/* LA BOUTEILLE EN MAIN PROPRE. C'est le seul geste, dans tout le jeu,
   qui ouvre la question du laboratoire. */
await page.click('#dialogue-present');
await page.waitForTimeout(400);
const piecesDoyle = await page.evaluate(() =>
  [...document.querySelectorAll('.dialogue-choice')].map((e) => e.dataset.evidence ?? ''),
);
check(
  'la bouteille lui est presentable',
  piecesDoyle.includes('clue:bouteille_anisette'),
  JSON.stringify(piecesDoyle),
);
await cliquerChoix('.dialogue-choice[data-evidence="clue:bouteille_anisette"]');
await page.waitForTimeout(400);
check('il emporte la bouteille', await lire());

const doyleApres = await choix();
check(
  'la bouteille remise ouvre la question du laboratoire',
  doyleApres.some((o) => o.topic === 'doyle_resultat'),
  JSON.stringify(doyleApres.map((o) => o.texte)),
);

/* LE GUIDAGE, A SA PREMIERE APPARITION DE LA PARTIE.
   C'est la premiere fois qu'une piste s'ouvre : le jeu explique la
   regle au lieu de donner un nom. Un joueur qui ignore encore qu'un
   entretien peut changer ne saurait pas quoi faire d'un nom. */
const lecon = await piste();
check('la ligne des pistes s affiche', lecon.visible, JSON.stringify(lecon.texte));
check(
  'la premiere fois, elle explique la regle',
  /Ce que vous apprenez peut ouvrir de nouvelles questions/.test(lecon.texte),
  lecon.texte,
);
check(
  'elle parle de personnes deja interrogees',
  /approfondies auprès des personnes déjà interrogées/.test(lecon.texte),
  lecon.texte,
);
check('elle ne nomme aucune question', !/laboratoire|chimiste|bouteille/i.test(lecon.texte), lecon.texte);
check('elle n accuse personne', !/ment|menteur|coupable|cache/i.test(lecon.texte), lecon.texte);

check(
  'la question qui vient de s ouvrir porte la marque « nouveau »',
  doyleApres.find((o) => o.topic === 'doyle_resultat')?.nouveau === true,
  JSON.stringify(doyleApres.map((o) => `${o.topic}:${o.nouveau}`)),
);
check(
  'les questions deja vues ne la portent pas',
  doyleApres.filter((o) => o.topic === 'doyle_relance' || o.topic === 'doyle_medecin').every((o) => o.nouveau === false),
  JSON.stringify(doyleApres.map((o) => `${o.topic}:${o.nouveau}`)),
);

await cliquerChoix('.dialogue-choice[data-topic="doyle_resultat"]');
await page.waitForTimeout(350);
const repliques = await lireEnNotant();
check('il lit le resultat', repliques.length > 0, repliques.slice(0, 60));

/* Ce qu'il vient de dire compte ; ce qu'il n'a PAS dit compte autant.
   Ni un nom, ni une quantite, ni un verdict. */
check('le resultat est annonce comme preliminaire', /préliminaire/i.test(repliques), repliques.slice(0, 120));
check('la prudence est dans sa bouche, pas seulement au carnet', /compatible avec la présence/i.test(repliques));
check('il dit lui-meme ce qu il ignore', /ni quand/i.test(repliques) && /ni par qui/i.test(repliques));
check('il ne designe personne', !/coupable|assassin|empoisonn/i.test(repliques));
check('il n avance aucun chiffre', !/[0-9]/.test(repliques), repliques.slice(0, 120));

/* Le premier resultat est acquis -- et la contre-epreuve reste
   fermee. C'est le point de la tranche : le prelevement a ete
   rapporte TROP TOT, et le geste ne se rattrape pas tout seul. */
const apresPremier = await choix();
check(
  'le premier resultat seul n ouvre pas la contre-epreuve',
  !apresPremier.some((o) => o.topic === 'doyle_contre_epreuve'),
  JSON.stringify(apresPremier.map((o) => o.texte)),
);

// --- 1 quinquies. On ressort, on revient, et on redonne le prelevement -

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('le joueur reprend la main en quittant Doyle', await reprendreLaMain());

await viserJusqua(DOYLE, /Interroger Agent Doyle/);
await page.mouse.click(500, 280);
const doyleTrois = await attendreEntretien('Agent Doyle');
check('l entretien se rouvre une seconde fois', doyleTrois.ouvert && doyleTrois.nom.includes('Agent Doyle'), doyleTrois.nom);

await page.click('#dialogue-present');
await page.waitForTimeout(400);
await cliquerChoix('.dialogue-choice[data-evidence="clue:trace_etagere"]');
await page.waitForTimeout(400);
const priseEnCharge = await lireEnNotant();
check('cette fois il emporte le prelevement', /gratter|compareront/i.test(priseEnCharge), priseEnCharge.slice(0, 120));

const doyleContre = await choix();
check(
  'les deux prerequis reunis ouvrent la contre-epreuve',
  doyleContre.some((o) => o.topic === 'doyle_contre_epreuve'),
  JSON.stringify(doyleContre.map((o) => o.texte)),
);

/* LA SECONDE PISTE. La lecon a deja ete donnee : cette fois c'est la
   phrase courte, avec un nom et rien d'autre. */
const piste2 = await piste();
check('la ligne des pistes revient', piste2.visible, JSON.stringify(piste2.texte));
check(
  'cette fois elle donne la phrase courte',
  /Une nouvelle piste mérite d’être approfondie auprès de/.test(piste2.texte),
  piste2.texte,
);
check('elle nomme la personne', /Agent Doyle/.test(piste2.texte), piste2.texte);
check('elle ne redonne pas la lecon', !/Ce que vous apprenez/.test(piste2.texte), piste2.texte);
check('elle ne nomme toujours aucune question', !/comparaison|prélèvement|étagère/i.test(piste2.texte), piste2.texte);
check(
  'la contre-epreuve porte la marque « nouveau »',
  doyleContre.find((o) => o.topic === 'doyle_contre_epreuve')?.nouveau === true,
  JSON.stringify(doyleContre.map((o) => `${o.topic}:${o.nouveau}`)),
);

/* Elle s'efface toute seule. Quatre secondes annoncees, on laisse une
   marge : ce qu'on verifie ici, c'est qu'elle ne reste pas a l'ecran. */
await page.waitForTimeout(5200);
check('puis elle s efface sans qu on y touche', (await piste()).visible === false);

await cliquerChoix('.dialogue-choice[data-topic="doyle_contre_epreuve"]');
await page.waitForTimeout(350);
const contre = await lireEnNotant();
check('il lit la comparaison', contre.length > 0, contre.slice(0, 60));
check(
  'les prelevements sont dits compatibles avec une meme preparation',
  /compatibles avec une même préparation/i.test(contre),
  contre.slice(0, 140),
);
check('il dit que cela n etablit pas d origine unique', /n’établit pas une origine unique/i.test(contre));
check('il ne nomme ni produit, ni fabricant, ni personne', /ni le produit/i.test(contre) && /ni le fabricant/i.test(contre) && /ni personne/i.test(contre));
check('le mot « lot » n est jamais prononce', !/\blots?\b/i.test(contre), contre.slice(0, 140));
check('le mot « concentration » non plus', !/concentration/i.test(contre));
check('il ne designe toujours personne', !/coupable|assassin|empoisonn/i.test(contre));

const dejaVues = await choix();
check(
  'une fois vues, les questions perdent leur marque',
  dejaVues.every((o) => o.nouveau === false),
  JSON.stringify(dejaVues.map((o) => `${o.topic}:${o.nouveau}`)),
);

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('le joueur reprend la main une derniere fois', await reprendreLaMain());

// --- 2. Le temoin ------------------------------------------------------

/* Retour par x = 0 : c'est la seule ouverture du passage etroit. */
await trajet('jusqu a Nino', [
  { x: 0, z: 3.7 },
  { x: 0, z: 0.4 },
  { x: -2.4, z: -0.2, arret: 0.6 },
]);
const invite2 = await viserJusqua(NINO, /Interroger Nino Restivo/);
check('le viseur annonce Nino Restivo', /Interroger Nino Restivo/.test(invite2), `"${invite2}"`);

await page.mouse.click(500, 280);
const entete = await attendreEntretien('Nino Restivo');
check('l entretien s ouvre sur Nino Restivo', entete.ouvert && entete.nom.includes('Nino Restivo'), entete.nom);
check('sa qualite est affichee', /commis/i.test(entete.role), entete.role);

const avant = await choix();
check('les questions sont celles de l affaire', avant.some((o) => o.topic === 'nino_heure'), JSON.stringify(avant.map((o) => o.texte)));
check('la question masquee n est pas encore la', !avant.some((o) => o.topic === 'nino_pourquoi_tot'));

await cliquerChoix('.dialogue-choice[data-topic="nino_heure"]');
await page.waitForTimeout(350);
await lire();

const apres = await choix();
check(
  'la question masquee s ouvre apres la reponse',
  apres.some((o) => o.topic === 'nino_pourquoi_tot'),
  JSON.stringify(apres.map((o) => o.texte)),
);

/* On la pose : sa reponse etablit que Rosa a renvoye le petit, et
   c'est ce fait -- pas une humeur, pas un soupcon -- qui ouvrira une
   question chez Rosa, trois pieces plus loin. C'est le premier lien
   entre deux temoins que le jeu met reellement a l'epreuve. */
await cliquerChoix('.dialogue-choice[data-topic="nino_pourquoi_tot"]');
await page.waitForTimeout(350);
check('il dit pourquoi il est parti tot', await lire());

// --- 2 bis. Un bonjour a Rosa ------------------------------------------

/* Vingt secondes de marche qui changent tout pour la suite : une piste
   ne se signale que chez quelqu'un que le joueur a DEJA rencontre. Sans
   ce detour, la question du poele s'ouvrirait chez une inconnue, et le
   jeu aurait raison de ne rien dire. */
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('le joueur reprend la main en sortant de chez Nino', await reprendreLaMain());

await trajet('bonjour a Rosa', [
  { x: -1.6, z: -1.6, arret: 0.6 },
  { x: 0, z: -2.4, arret: 0.6 },
  { ...ROSA, arret: 1.7 },
]);
await viserJusqua(ROSA, /Interroger Rosa Vitale/);
await page.mouse.click(500, 280);
const bonjour = await attendreEntretien('Rosa Vitale');
check('on fait sa connaissance', bonjour.ouvert && bonjour.nom.includes('Rosa Vitale'), bonjour.nom);
check('sa liste ne porte pas encore la question du poele', !(await choix()).some((o) => o.topic === 'rosa_poele'));

// --- 3. Le registre ----------------------------------------------------

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('le joueur reprend la main en sortant de l entretien', await reprendreLaMain());

/* On s'arrete devant la face ouest de la grande caisse : impossible de
   la traverser, inutile d'essayer. Le registre reste a portee. */
await trajet('jusqu au registre', [
  { x: 0, z: -1.8, arret: 0.6 },
  { x: 2.3, z: -2.3, arret: 0.6 },
]);
const invite3 = await viserJusqua(REGISTRE, /Examiner le registre/);
check('le viseur annonce le registre', /Examiner le registre/.test(invite3), `"${invite3}"`);
await page.mouse.click(500, 280);
await page.waitForTimeout(400);
const fiche2 = await fiche();
check('la fiche du registre est la bonne', fiche2.ouverte && /registre des livraisons/i.test(fiche2.titre), fiche2.titre);
check('la page du 13 est vierge', /vierge/.test(fiche2.texte), fiche2.texte.slice(0, 50));
await page.mouse.click(500, 280);
await page.waitForTimeout(300);

/* Deux objets sur la meme caisse : le viseur doit les distinguer. */
const invite3b = await viserJusqua(LIVRES, /Examiner les livres/);
check('les livres voisins restent un autre objet', /Examiner les livres/.test(invite3b), `"${invite3b}"`);
await page.mouse.click(500, 280);
await page.waitForTimeout(400);
const fiche3 = await fiche();
check('la fiche des livres s ouvre', fiche3.ouverte && /livres de comptes/i.test(fiche3.titre), fiche3.titre);
check('le fournisseur y est nomme', /Adriatica/.test(fiche3.texte), fiche3.texte.slice(0, 60));
await page.mouse.click(500, 280);
await page.waitForTimeout(300);

// --- 3 bis. Retour chez Nino : les livres sous ses yeux ---------------

/* C'est lui qui rentre la glace. Montrer les livres a n'importe qui
   d'autre ne donnerait rien -- et c'est de cette reaction-la, et
   d'aucune autre, que depend la question posable a Aldo tout a
   l'heure. On refait donc le chemin en sens inverse : un entretien
   deja quitte doit pouvoir etre rouvert. */
await trajet('retour chez Nino', [
  { x: 1.6, z: -0.8, arret: 0.6 },
  { x: -1.4, z: -0.6, arret: 0.6 },
  { ...NINO, arret: 1.8 },
]);
const invite3c = await viserJusqua(NINO, /Interroger Nino Restivo/);
check('le viseur le retrouve', /Interroger Nino Restivo/.test(invite3c), `"${invite3c}"`);
await page.mouse.click(500, 280);
const retour = await attendreEntretien('Nino Restivo');
check('l entretien se rouvre sur Nino Restivo', retour.ouvert && retour.nom.includes('Nino Restivo'), retour.nom);

await page.click('#dialogue-present');
await page.waitForTimeout(400);
const piecesNino = await page.evaluate(() =>
  [...document.querySelectorAll('.dialogue-choice')].map((e) => e.dataset.evidence ?? ''),
);
check(
  'les livres figurent parmi les pieces presentables',
  piecesNino.includes('clue:livres_comptes'),
  JSON.stringify(piecesNino),
);
await cliquerChoix('.dialogue-choice[data-evidence="clue:livres_comptes"]');
await page.waitForTimeout(400);
check('il repond sur la glace', await lire());

/* Le poele, tant qu'on est chez lui : c'est Nino qui le vide, et lui
   seul peut dire qu'il etait plein le samedi matin. Sans cette
   reponse, on ne pourra pas en parler a Rosa tout a l'heure. */
/* LE POELE PRESENTE A NINO. C'est lui qui le remplit : il est le seul
   a pouvoir dire ce qu'il y avait dedans pour bruler. */
await page.click('#dialogue-present');
await page.waitForTimeout(400);
await cliquerChoix('.dialogue-choice[data-evidence="clue:poele_cendres"]');
await page.waitForTimeout(400);
const ninoCharbon = await lireEnNotant();
check('il parle du charbon', /charbon/i.test(ninoCharbon), ninoCharbon.slice(0, 120));
check('il ne dit toujours pas ce qui a brule', !/papier|brûl/i.test(ninoCharbon), ninoCharbon.slice(0, 120));

await cliquerChoix('.dialogue-choice[data-topic="nino_poele"]');
await page.waitForTimeout(350);
check('il repond sur le poele', await lire());

/* LA PISTE QUI S'OUVRE AILLEURS -- tout le probleme, et sa reponse.
   Le joueur est en face de Nino ; ce que Nino vient de dire ouvre une
   question chez Rosa, a l'autre bout de la piece. Il ne peut pas le
   voir : on le lui dit. */
const pisteRosa = await piste();
check('la ligne des pistes signale l autre temoin', pisteRosa.visible, JSON.stringify(pisteRosa.texte));
check(
  'elle nomme Rosa Vitale',
  /Une nouvelle piste mérite d’être approfondie auprès de Rosa Vitale\./.test(pisteRosa.texte),
  pisteRosa.texte,
);
check('elle ne dit pas de quoi il s agit', !/poêle|cendres|feu/i.test(pisteRosa.texte), pisteRosa.texte);
check('elle ne dit pas pourquoi la question s est ouverte', !/parce que|car /i.test(pisteRosa.texte), pisteRosa.texte);
check('elle n accuse personne', !/ment|menteur|coupable|suspect/i.test(pisteRosa.texte), pisteRosa.texte);

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('le joueur reprend la main en quittant Nino', await reprendreLaMain());

/* ET LE CARNET S'EN SOUVIENT. La ligne s'efface au bout de quatre
   secondes ; un joueur qui repose le jeu ici doit pouvoir retrouver ou
   revenir. C'est a cela, et a rien d'autre, que sert « A verifier ». */
await page.keyboard.press('KeyN');
await page.waitForTimeout(500);
const rappel = await page.evaluate(() => ({
  ouvert: !document.querySelector('#notebook-panel')?.classList.contains('is-hidden'),
  texte: document.querySelector('#notebook-body')?.textContent ?? '',
  noms: [...document.querySelectorAll('.notebook-lead')].map((e) => e.textContent ?? ''),
}));
check('le carnet porte la rubrique « A verifier »', rappel.ouvert && /À vérifier/.test(rappel.texte));
check('elle nomme Rosa Vitale', rappel.noms.some((n) => n.includes('Rosa Vitale')), JSON.stringify(rappel.noms));
check('elle ne nomme qu elle', rappel.noms.length === 1, JSON.stringify(rappel.noms));
check(
  'elle ne dit pas ce qu il y a a lui demander',
  rappel.noms.every((n) => !/poêle|question|cendres/i.test(n)),
  JSON.stringify(rappel.noms),
);
await page.keyboard.press('KeyN');
await page.waitForTimeout(400);
check('le carnet se referme', await reprendreLaMain());

// --- 4. Enzo, et la version qu il doit reprendre ------------------------

await trajet('jusqu a Enzo', [
  { x: -1.0, z: -0.6, arret: 0.6 },
  { x: 1.6, z: -0.8, arret: 0.6 },
  { ...ENZO, arret: 1.7 },
]);
const invite4 = await viserJusqua(ENZO, /Interroger Enzo Carbone/);
check('le viseur annonce Enzo Carbone', /Interroger Enzo Carbone/.test(invite4), `"${invite4}"`);
await page.mouse.click(500, 280);
const enteteEnzo = await attendreEntretien('Enzo Carbone');
check('l entretien s ouvre sur Enzo Carbone', enteteEnzo.ouvert && enteteEnzo.nom.includes('Enzo Carbone'), enteteEnzo.nom);

/* Sa version de la soiree. Elle contient « j'ai ferme » -- et Rosa
   dit exactement la meme chose de son cote. On la lui portera. */
await cliquerChoix('.dialogue-choice[data-topic="enzo_soiree"]');
await page.waitForTimeout(350);
check('il raconte sa soiree', await lire());

// Il invoque une livraison.
await cliquerChoix('.dialogue-choice[data-topic="enzo_matin"]');
await page.waitForTimeout(350);
await lire();
const avantPiece = await choix();
check('la reprise n est pas encore proposee', !avantPiece.some((o) => o.topic === 'enzo_matin_reprise'));

// On lui pose le registre sous le nez.
await page.click('#dialogue-present');
await page.waitForTimeout(400);
const pieces = await page.evaluate(() =>
  [...document.querySelectorAll('.dialogue-choice')].map((e) => e.dataset.evidence ?? ''),
);
check(
  'le registre figure parmi les pieces presentables',
  pieces.includes('clue:registre_livraisons'),
  JSON.stringify(pieces),
);
await cliquerChoix('.dialogue-choice[data-evidence="clue:registre_livraisons"]');
await page.waitForTimeout(400);
await lire();

const apresPiece = await choix();
check(
  'le registre ouvre la question qu il ne voulait pas',
  apresPiece.some((o) => o.topic === 'enzo_matin_reprise'),
  JSON.stringify(apresPiece.map((o) => o.texte)),
);

await cliquerChoix('.dialogue-choice[data-topic="enzo_matin_reprise"]');
await page.waitForTimeout(350);
check('la reprise se joue jusqu au bout', await lire());

/* C'est son etagere : la trace et la comparaison sont les deux seules
   pieces qu'il ait un rapport a commenter. Il commente, et rien ne
   bouge. */
const avantEtagere = await choix();
await page.click('#dialogue-present');
await page.waitForTimeout(400);
await cliquerChoix('.dialogue-choice[data-evidence="clue:trace_etagere"]');
await page.waitForTimeout(400);
const enzoTrace = await lireEnNotant();
check('il repond sur l etagere', /étagères/i.test(enzoTrace), enzoTrace.slice(0, 120));

await page.click('#dialogue-present');
await page.waitForTimeout(400);
const piecesEnzo = await page.evaluate(() =>
  [...document.querySelectorAll('.dialogue-choice')].map((e) => e.dataset.evidence ?? ''),
);
check(
  'la contre-epreuve lui est presentable',
  piecesEnzo.includes('statement:doyle_contre_epreuve'),
  JSON.stringify(piecesEnzo),
);
await cliquerChoix('.dialogue-choice[data-evidence="statement:doyle_contre_epreuve"]');
await page.waitForTimeout(400);
const enzoContre = await lireEnNotant();
check('il lit la phrase comme elle est ecrite', /n’en savent rien/i.test(enzoContre), enzoContre.slice(0, 120));

const apresEtagere = await choix();
check(
  'ni la trace ni la comparaison ne lui ouvrent quoi que ce soit',
  apresEtagere.length === avantEtagere.length,
  `avant ${avantEtagere.length}, apres ${apresEtagere.length}`,
);

/* Il est passe devant le poele en ouvrant. Il dit ce qu'il a fait,
   pas ce qu'il a compris. */
await page.click('#dialogue-present');
await page.waitForTimeout(400);
await cliquerChoix('.dialogue-choice[data-evidence="clue:poele_cendres"]');
await page.waitForTimeout(400);
const enzoPoele = await lireEnNotant();
check('il dit ne pas avoir regarde', /pas regardé/i.test(enzoPoele), enzoPoele.slice(0, 120));
check('et ce qu il a fait a la place', /café/i.test(enzoPoele));

// --- 5. Rosa Vitale ----------------------------------------------------

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('le joueur reprend la main en quittant Enzo', await reprendreLaMain());

/* On contourne la grande caisse par le sud : en ligne droite, le
   trajet depuis Enzo en accroche l'angle. */
await trajet('jusqu a Rosa', [
  { x: 2.4, z: -0.8, arret: 0.6 },
  { x: 0.4, z: -2.0, arret: 0.6 },
  { ...ROSA, arret: 1.7 },
]);
const invite5 = await viserJusqua(ROSA, /Interroger Rosa Vitale/);
check('le viseur annonce Rosa Vitale', /Interroger Rosa Vitale/.test(invite5), `"${invite5}"`);
await page.mouse.click(500, 280);
const enteteRosa = await attendreEntretien('Rosa Vitale');
check('l entretien s ouvre sur Rosa Vitale', enteteRosa.ouvert && enteteRosa.nom.includes('Rosa Vitale'), enteteRosa.nom);
check('sa qualite est affichee', /salle/i.test(enteteRosa.role), enteteRosa.role);

const rosaAvant = await choix();
check(
  'la question sur le depart n est pas encore la',
  !rosaAvant.some((o) => o.topic === 'rosa_depart'),
  JSON.stringify(rosaAvant.map((o) => o.texte)),
);
check(
  'la question ouverte par Nino lui est bien posable',
  rosaAvant.some((o) => o.topic === 'rosa_nino'),
  JSON.stringify(rosaAvant.map((o) => o.texte)),
);

/* LA MARQUE, A L'INSTANT OU ELLE COMPTE : la toute premiere liste
   affichee depuis que la piste s'est ouverte ailleurs. Une liste plus
   tard, la question a ete vue et ne se distingue plus -- c'est le
   comportement voulu, et c'est pourquoi ce controle est ici et pas
   trois lignes plus bas. */
check(
  'la question ouverte pendant son absence porte la marque « nouveau »',
  rosaAvant.find((o) => o.topic === 'rosa_poele')?.nouveau === true,
  JSON.stringify(rosaAvant.map((o) => `${o.topic}:${o.nouveau}`)),
);
check(
  'celles vues lors du bonjour ne la portent pas',
  rosaAvant.filter((o) => o.topic === 'rosa_relance' || o.topic === 'rosa_nino').every((o) => o.nouveau === false),
  JSON.stringify(rosaAvant.map((o) => `${o.topic}:${o.nouveau}`)),
);

await cliquerChoix('.dialogue-choice[data-topic="rosa_fermeture"]');
await page.waitForTimeout(350);
check('elle repond sur la fermeture', await lire());

const rosaApres = await choix();
check(
  'avoir ferme ouvre la question de l heure',
  rosaApres.some((o) => o.topic === 'rosa_depart'),
  JSON.stringify(rosaApres.map((o) => o.texte)),
);
check(
  'aucune question de pression ne lui est proposee',
  rosaApres.every((o) => !/pression/i.test(o.texte)),
  JSON.stringify(rosaApres.map((o) => o.texte)),
);
check(
  'la question sur les habitudes de Victor n est pas encore la',
  !rosaApres.some((o) => o.topic === 'rosa_victor_tard'),
  JSON.stringify(rosaApres.map((o) => o.texte)),
);
check(
  'celle du poele l est, parce que Nino a parle',
  rosaApres.some((o) => o.topic === 'rosa_poele'),
  JSON.stringify(rosaApres.map((o) => o.texte)),
);


await cliquerChoix('.dialogue-choice[data-topic="rosa_depart"]');
await page.waitForTimeout(350);
check('elle donne son heure', await lire());

/* Le verre sous les yeux : elle ne se derobe pas, et rien ne bouge
   pour autant. C'est tout l'interet de la tranche. */
await page.click('#dialogue-present');
await page.waitForTimeout(400);
const piecesRosa = await page.evaluate(() =>
  [...document.querySelectorAll('.dialogue-choice')].map((e) => e.dataset.evidence ?? ''),
);
check(
  'le verre figure parmi les pieces presentables',
  piecesRosa.includes('clue:verre_renverse'),
  JSON.stringify(piecesRosa),
);
await cliquerChoix('.dialogue-choice[data-evidence="clue:verre_renverse"]');
await page.waitForTimeout(400);
check('elle reagit au verre', await lire());

const rosaFin = await choix();
/* Le verre qu'elle reconnait avoir porte ouvre UNE question, et une
   seule : ce que Victor faisait si tard. Rien qui la vise -- on lui
   demande les habitudes d'un client, pas ses propres gestes. */
check(
  'le verre ouvre la question des habitudes de Victor',
  rosaFin.some((o) => o.topic === 'rosa_victor_tard'),
  JSON.stringify(rosaFin.map((o) => o.texte)),
);
check(
  'et rien d autre : une question ouverte, une question consommee',
  rosaFin.length === rosaApres.length,
  `avant ${rosaApres.length}, apres ${rosaFin.length}`,
);

await cliquerChoix('.dialogue-choice[data-topic="rosa_victor_tard"]');
await page.waitForTimeout(350);
const rosaVictor = await lireEnNotant();
check('elle parle d une habitude, pas de cette nuit-la', /une fois par mois/i.test(rosaVictor), rosaVictor.slice(0, 120));
check('elle ne place personne dans le bureau le 12', !/cette nuit|ce soir-là|le 12/i.test(rosaVictor));

await cliquerChoix('.dialogue-choice[data-topic="rosa_poele"]');
await page.waitForTimeout(350);
const rosaPoele = await lireEnNotant();
check('elle repond sur le poele', /fourneau/i.test(rosaPoele), rosaPoele.slice(0, 120));
check('elle dit n avoir rien allume', /rien allumé/i.test(rosaPoele));
check('et le jeu ne commente pas', !/faux|mensonge|contradiction/i.test(rosaPoele));

/* LA VERSION D'ENZO SUR LA FERMETURE.
   Deux personnes disent avoir ferme. Rosa fait une distinction de
   metier, qui se defend. Aucun arbitre ne tranche. */
await page.click('#dialogue-present');
await page.waitForTimeout(400);
const piecesRosa3 = await page.evaluate(() =>
  [...document.querySelectorAll('.dialogue-choice')].map((e) => e.dataset.evidence ?? ''),
);
check(
  'la version d Enzo lui est presentable',
  piecesRosa3.includes('statement:enzo_soiree'),
  JSON.stringify(piecesRosa3),
);
await cliquerChoix('.dialogue-choice[data-evidence="statement:enzo_soiree"]');
await page.waitForTimeout(400);
const rosaRideau = await lireEnNotant();
check('elle repond sur le rideau', /rideau/i.test(rosaRideau), rosaRideau.slice(0, 120));
check('elle ne traite personne de menteur', !/\bment\b|menteur|faux/i.test(rosaRideau));

/* Le compte de reference, pris juste avant de presenter le bulletin :
   deux questions ont ete posees depuis « rosaFin », et une mesure
   prise trop tot ne mesure plus rien. */
const avantBulletinRosa = (await choix()).length;

/* LE BULLETIN PRESENTE A ROSA.
   C'est elle qui portait l'anisette : c'est la seule personne a qui
   le montrer aille de soi. Et il ne se passe rien. */
await page.click('#dialogue-present');
await page.waitForTimeout(400);
const piecesRosa2 = await page.evaluate(() =>
  [...document.querySelectorAll('.dialogue-choice')].map((e) => e.dataset.evidence ?? ''),
);
check(
  'le resultat du chimiste lui est presentable',
  piecesRosa2.includes('statement:doyle_resultat_preliminaire'),
  JSON.stringify(piecesRosa2),
);
await cliquerChoix('.dialogue-choice[data-evidence="statement:doyle_resultat_preliminaire"]');
await page.waitForTimeout(400);
check('elle repond au chimiste', await lire());

/* LE POELE PRESENTE A ROSA. Elle renvoie sur le charbon et sur le
   petit. Ce n'est pas un mensonge, et ce n'est pas une reponse. */
await page.click('#dialogue-present');
await page.waitForTimeout(400);
await cliquerChoix('.dialogue-choice[data-evidence="clue:poele_cendres"]');
await page.waitForTimeout(400);
const rosaFoyer = await lireEnNotant();
check('elle renvoie sur le charbon', /charbon/i.test(rosaFoyer), rosaFoyer.slice(0, 120));
check('elle ne nomme ni le poele ni les cendres', !/poêle|cendres/i.test(rosaFoyer), rosaFoyer.slice(0, 120));

const rosaBulletin = await choix();
check(
  'le bulletin ne lui ouvre aucune question non plus',
  rosaBulletin.length === avantBulletinRosa,
  `avant ${avantBulletinRosa}, apres ${rosaBulletin.length}`,
);

// --- 6. Aldo Maglione --------------------------------------------------

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('le joueur reprend la main en quittant Rosa', await reprendreLaMain());

/* Il se tient contre le mur est, en avant de la rampe. On repasse au
   nord des blocs du passage etroit avant de redescendre. */
await trajet('jusqu a Aldo', [
  { x: 2.0, z: -0.6, arret: 0.6 },
  { x: 3.9, z: 0.6, arret: 0.6 },
  { x: 4.7, z: 1.5, arret: 0.6 },
  { ...ALDO, arret: 1.7 },
]);
const invite6 = await viserJusqua(ALDO, /Interroger Aldo Maglione/);
check('le viseur annonce Aldo Maglione', /Interroger Aldo Maglione/.test(invite6), `"${invite6}"`);
await page.mouse.click(500, 280);
const enteteAldo = await attendreEntretien('Aldo Maglione');
check('l entretien s ouvre sur Aldo Maglione', enteteAldo.ouvert && enteteAldo.nom.includes('Aldo Maglione'), enteteAldo.nom);
check('sa qualite est affichee', /écritures/i.test(enteteAldo.role), enteteAldo.role);

const aldoAvant = await choix();
check(
  'la question sur Adriatica n est pas encore la',
  !aldoAvant.some((o) => o.topic === 'aldo_adriatica'),
  JSON.stringify(aldoAvant.map((o) => o.texte)),
);
check(
  'la question sur la glace est la, parce que Nino a parle',
  aldoAvant.some((o) => o.topic === 'aldo_glace'),
  JSON.stringify(aldoAvant.map((o) => o.texte)),
);
check(
  'celle sur les soirs de verification aussi, parce que Rosa a parle',
  aldoAvant.some((o) => o.topic === 'aldo_ce_soir_la'),
  JSON.stringify(aldoAvant.map((o) => o.texte)),
);
check(
  'celle du remboursement, non : il n a pas encore parle des avances',
  !aldoAvant.some((o) => o.topic === 'aldo_remboursement'),
  JSON.stringify(aldoAvant.map((o) => o.texte)),
);
check(
  'celle du papier reglé, non plus : personne ne l a encore consigné',
  !aldoAvant.some((o) => o.topic === 'aldo_papier'),
  JSON.stringify(aldoAvant.map((o) => o.texte)),
);

await cliquerChoix('.dialogue-choice[data-topic="aldo_ecritures"]');
await page.waitForTimeout(350);
check('il repond sur les ecritures', await lire());

const aldoApres = await choix();
check(
  'se dire comptable ouvre la question sur le fournisseur',
  aldoApres.some((o) => o.topic === 'aldo_adriatica'),
  JSON.stringify(aldoApres.map((o) => o.texte)),
);

await cliquerChoix('.dialogue-choice[data-topic="aldo_adriatica"]');
await page.waitForTimeout(350);
check('il donne ses jours de livraison', await lire());

/* LA DECLARATION D'ENZO SOUS SON NEZ.
   Deux temoins, deux jours differents. Le jeu ne dit rien, ne
   deverrouille rien, ne change aucune humeur : il pose la seconde
   phrase a cote de la premiere dans le carnet, et s'arrete la. */
const avantFace = await choix();
await page.click('#dialogue-present');
await page.waitForTimeout(400);
const piecesAldo = await page.evaluate(() =>
  [...document.querySelectorAll('.dialogue-choice')].map((e) => e.dataset.evidence ?? ''),
);
check(
  'la declaration d Enzo lui est presentable',
  piecesAldo.includes('statement:enzo_livraison_reprise'),
  JSON.stringify(piecesAldo),
);
await cliquerChoix('.dialogue-choice[data-evidence="statement:enzo_livraison_reprise"]');
await page.waitForTimeout(400);
check('il repond sur le jour de livraison', await lire());

const apresFace = await choix();
check(
  'la contradiction n ouvre aucune question : elle est au joueur',
  apresFace.length === avantFace.length,
  `avant ${avantFace.length}, apres ${apresFace.length}`,
);

await cliquerChoix('.dialogue-choice[data-topic="aldo_glace"]');
await page.waitForTimeout(350);
check('il explique la glace', await lire());

/* Les avances, puis leur remboursement. La seconde question n'existe
   qu'apres la premiere : on ne demande pas a quelqu'un s'il a
   rembourse un pret dont il n'a pas encore reconnu l'existence. */
await cliquerChoix('.dialogue-choice[data-topic="aldo_avances"]');
await page.waitForTimeout(350);
const aldoAvances = await lireEnNotant();
check('il reconnait les avances', /famille/i.test(aldoAvances), aldoAvances.slice(0, 120));

const aldoApresAvances = await choix();
check(
  'les avances reconnues ouvrent la question du remboursement',
  aldoApresAvances.some((o) => o.topic === 'aldo_remboursement'),
  JSON.stringify(aldoApresAvances.map((o) => o.texte)),
);
await cliquerChoix('.dialogue-choice[data-topic="aldo_remboursement"]');
await page.waitForTimeout(350);
const aldoRemb = await lireEnNotant();
check('il repond sans se fermer', /rien réclamé/i.test(aldoRemb), aldoRemb.slice(0, 120));
check('et le mot « dette » n est jamais prononce', !/dette/i.test(aldoRemb));

await cliquerChoix('.dialogue-choice[data-topic="aldo_ce_soir_la"]');
await page.waitForTimeout(350);
const aldoSoirs = await lireEnNotant();
check('il dit ignorer quels soirs', /quels soirs/i.test(aldoSoirs), aldoSoirs.slice(0, 120));
check('rien ne le designe pour autant', !/coupable|menteur|contradiction/i.test(aldoSoirs));

/* LE BULLETIN SOUS SON NEZ. Il se met a l'abri, et rien ne bouge. */
const avantBulletin = (await choix()).length;
await page.click('#dialogue-present');
await page.waitForTimeout(400);
await cliquerChoix('.dialogue-choice[data-evidence="statement:doyle_resultat_preliminaire"]');
await page.waitForTimeout(400);
const aldoBulletin = await lireEnNotant();
check('il rappelle qu il ne sert pas a boire', /sers pas à boire/i.test(aldoBulletin), aldoBulletin.slice(0, 120));
check(
  'le bulletin ne lui ouvre aucune question',
  (await choix()).length === avantBulletin,
  `avant ${avantBulletin}`,
);

// --- 6 bis. Le poele consigne, et la piste qui s ouvre chez Aldo -------

/* LA BOUCLE COMPLETE, en trois lieux : un objet qu'on a regarde dans
   le couloir, un agent qui le consigne pres de la porte, une question
   qui s'ouvre chez un homme assis contre le mur d'en face. Aldo a ete
   rencontre : le jeu a donc quelque chose a dire. */
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('le joueur reprend la main en quittant Aldo', await reprendreLaMain());

/* LE MUR EST : la rampe et son palier occupent z de 2,7 a 4,5 sur
   toute la largeur x de 1,8 a 5,9, et le passage etroit occupe z de
   1,2 a 1,8 jusqu'a x = 3,0. Entre les deux il reste vingt
   centimetres : on ne passe pas. On remonte donc au nord du passage,
   et on redescend par son ouverture, a x = 0. */
await trajet('de Aldo a Doyle', [
  { x: 3.6, z: 1.8, arret: 0.6 },
  { x: 3.6, z: 0.8, arret: 0.6 },
  { x: 0, z: 0.8, arret: 0.5 },
  { x: 0, z: 4.0, arret: 0.6 },
  { ...DOYLE, arret: 1.7 },
]);
await viserJusqua(DOYLE, /Interroger Agent Doyle/);
await page.mouse.click(500, 280);
const doyleFin = await attendreEntretien('Agent Doyle');
check('l entretien se rouvre une derniere fois', doyleFin.ouvert && doyleFin.nom.includes('Agent Doyle'), doyleFin.nom);

await page.click('#dialogue-present');
await page.waitForTimeout(400);
await cliquerChoix('.dialogue-choice[data-evidence="clue:poele_cendres"]');
await page.waitForTimeout(400);
const doyleConsigne = await lireEnNotant();
check('il dit ce qu il a vu en entrant', /entrouverte/i.test(doyleConsigne), doyleConsigne.slice(0, 120));
check('il consigne le papier reglé', /papier réglé/i.test(doyleConsigne));
check('et il ne conclut rien', !/coupable|prouve|forcément|donc/i.test(doyleConsigne), doyleConsigne.slice(0, 140));

const pisteAldo = await piste();
check('la ligne des pistes signale Aldo', pisteAldo.visible, JSON.stringify(pisteAldo.texte));
check(
  'elle nomme Aldo Maglione',
  /Une nouvelle piste mérite d’être approfondie auprès de Aldo Maglione\./.test(pisteAldo.texte),
  pisteAldo.texte,
);
check('elle ne dit pas de quoi il s agit', !/papier|poêle|cendres/i.test(pisteAldo.texte), pisteAldo.texte);

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('le joueur reprend la main', await reprendreLaMain());
await page.keyboard.press('KeyN');
await page.waitForTimeout(500);
const rappelAldo = await page.evaluate(() =>
  [...document.querySelectorAll('.notebook-lead')].map((e) => e.textContent ?? ''),
);
check('le carnet le retient', rappelAldo.some((n) => n.includes('Aldo Maglione')), JSON.stringify(rappelAldo));
await page.keyboard.press('KeyN');
await page.waitForTimeout(400);
check('le carnet se referme', await reprendreLaMain());

await trajet('retour chez Aldo', [
  { x: 0, z: 3.4, arret: 0.6 },
  { x: 0, z: 0.8, arret: 0.5 },
  { x: 3.6, z: 0.8, arret: 0.6 },
  { x: 4.7, z: 1.6, arret: 0.6 },
  { ...ALDO, arret: 1.7 },
]);
await viserJusqua(ALDO, /Interroger Aldo Maglione/);
await page.mouse.click(500, 280);
const aldoFin = await attendreEntretien('Aldo Maglione');
check('on le retrouve', aldoFin.ouvert && aldoFin.nom.includes('Aldo Maglione'), aldoFin.nom);

const aldoDernier = await choix();
check(
  'la question du papier reglé est la, et marquee « nouveau »',
  aldoDernier.find((o) => o.topic === 'aldo_papier')?.nouveau === true,
  JSON.stringify(aldoDernier.map((o) => `${o.topic}:${o.nouveau}`)),
);
await cliquerChoix('.dialogue-choice[data-topic="aldo_papier"]');
await page.waitForTimeout(350);
const aldoReponse = await lireEnNotant();
check('il renvoie sur les papeteries de la ville', /papeteries/i.test(aldoReponse), aldoReponse.slice(0, 120));
check('et affirme ses livres complets', /complets/i.test(aldoReponse));
check('rien ne le designe pour autant', !/coupable|menteur|contradiction/i.test(aldoReponse));

// --- 7. Le carnet ------------------------------------------------------

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await reprendreLaMain();
await page.keyboard.press('KeyN');
await page.waitForTimeout(500);

const carnet = await page.evaluate(() => ({
  ouvert: !document.querySelector('#notebook-panel')?.classList.contains('is-hidden'),
  texte: document.querySelector('#notebook-body')?.textContent ?? '',
}));
check('le carnet s ouvre', carnet.ouvert);
/* « A verifier » n'apparait que s'il y a quelque chose a verifier. A ce
   stade du parcours, chaque piste ouverte l'a ete dans la liste que le
   joueur avait sous les yeux : il les a toutes vues, et le carnet n'a
   donc rien a lui rappeler. Une rubrique qui s'afficherait quand meme
   dirait au joueur qu'on attend quelque chose de lui, ce qui serait
   faux -- et la ferait glisser vers la liste de courses. */
check(
  'le carnet ne reclame rien quand rien n attend',
  !/À vérifier/.test(carnet.texte),
  carnet.texte.slice(0, 80),
);
check('l indice est range sous « Le bureau »', /Le bureau/.test(carnet.texte));
check('la declaration de Nino y figure', /dix heures moins dix/.test(carnet.texte));
check('le fait acquis y figure', /quitt.* le restaurant/i.test(carnet.texte));
check('Enzo a sa propre section', /Enzo Carbone/.test(carnet.texte));
check('sa premiere version y est', /une livraison/.test(carnet.texte));
check('sa reprise y est aussi', /tromp.* de jour/i.test(carnet.texte));
check('mais le carnet ne dit jamais laquelle etait fausse', !/faux|fausse|mensonge|contradiction/i.test(carnet.texte));
check('Rosa a sa propre section', /Rosa Vitale/.test(carnet.texte));
check('ce qu elle dit du verre y figure', /anisette/i.test(carnet.texte));
check('l heure qu elle donne y figure', /onze heures/.test(carnet.texte));
check('le carnet ne juge pas non plus ce qu elle dit', !/douteux|suspect|invraisemblable/i.test(carnet.texte));
check('Aldo a sa propre section', /Aldo Maglione/.test(carnet.texte));
check('ses jours de livraison y figurent', /mardi/.test(carnet.texte) && /vendredi/.test(carnet.texte));
check('ceux d Enzo aussi, sans commentaire', /mercredi/.test(carnet.texte));
/* « or, » etait cherche comme une simple sous-chaine : il attrapait
   « Victor, ». Le defaut a dormi quatre tranches, jusqu'au jour ou un
   temoin a nomme le mort suivi d'une virgule. Les mots entiers, donc
   -- et « dement » avec son accent, faute de quoi il ne trouvait rien
   dans un texte francais. */
check(
  'le carnet ne rapproche jamais les deux',
  !/contradi|incompatible|pourtant|\bor\b|dément/i.test(carnet.texte),
);
check('la glace qu il explique y figure', /fond la moitié/.test(carnet.texte));
check('l agent Doyle a sa propre section', /Agent Doyle/.test(carnet.texte));
check('la bouteille est rangee sous un lieu', /anisette/i.test(carnet.texte));
check('le resultat y figure tel qu il a ete dit', /préliminaire/i.test(carnet.texte));
check('et sa prudence avec lui', /compatible avec la présence/i.test(carnet.texte));
check(
  'le carnet ne transforme pas le bulletin en verdict',
  !/empoisonn|coupable|assassin|prouve|meurtre/i.test(carnet.texte),
);
check(
  'aucune quantite n est apparue en chemin',
  !/milligramme|gramme|dose|taux|seuil/i.test(carnet.texte),
);
check('le couloir est une rubrique du carnet', /Le couloir/.test(carnet.texte));
check('le poele y est range', /papier réglé/.test(carnet.texte));
check('ce que Nino dit du charbon y est', /depuis octobre/.test(carnet.texte));
check(
  'le carnet ne dit jamais ce qui a brule',
  !/relevé|document brûlé|les comptes ont brûlé/i.test(carnet.texte),
);
check('le local arriere est une rubrique du carnet', /Le local arrière/.test(carnet.texte));
check('la trace de l etagere y est rangee', /disque plus clair/.test(carnet.texte));
check('la contre-epreuve y figure', /compatibles avec une même préparation/i.test(carnet.texte));
check(
  'les deux resultats restent deux entrees distinctes',
  /Le laboratoire/.test(carnet.texte) && /La contre-épreuve/.test(carnet.texte),
);
check('le carnet ne dit jamais « lot »', !/\blots?\b/i.test(carnet.texte));
check('ni « concentration »', !/concentration/i.test(carnet.texte));
check('les deux versions de la fermeture y sont', /tire le rideau/.test(carnet.texte) && /J’ai fermé/i.test(carnet.texte));
check('ce que Rosa dit du poele y est', /rien allumé/.test(carnet.texte));
check('ce qu Aldo dit des avances y est', /famille/.test(carnet.texte));
check('le carnet ne tranche entre aucune des deux versions', !/en réalité|démenti|invraisemblable/i.test(carnet.texte));
check('aucun identifiant technique a l ecran', !/nino_|enzo_|rosa_|aldo_|doyle_|fait_|registre_livraisons/.test(carnet.texte));

check('aucune erreur de console', erreurs.length === 0, erreurs.join(' | '));

console.log(`\n${ok} controle(s) reussi(s), ${ko} en echec.`);
await browser.close();
process.exit(ko === 0 ? 0 : 1);
