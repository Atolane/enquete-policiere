/* ===================================================================
   SUITE NAVIGATEUR, HERITEE DE LA PHASE 7.

   Elle pilote le jeu dans un vrai navigateur et couvre ce qu'aucun
   test unitaire ne peut atteindre : le clavier, le pointeur, le rendu,
   la persistance reelle.

   Deux reserves, dites franchement :
     - elle exige Playwright, qui n'est PAS une dependance du projet ;
     - elle vise la piece de test et le suspect jetable « greco », et
       devra etre reecrite quand la vraie affaire arrivera.

   Elle n'a pas ete rejouee depuis son versement au depot. Voir
   tests/README.md.
   =================================================================== */

/* PHASE 7B — sauvegarde et reprise.
   Ce que cette suite cherche a mettre en defaut :
     - une progression perdue au rechargement ;
     - une sauvegarde abimee qui empecherait de jouer ;
     - un identifiant disparu qui ferait tomber toute la partie ;
     - un clic unique qui effacerait l'enquete ;
     - une fuite de la verite interne dans le fichier de sauvegarde ;
     - le carnet qui ne defilerait pas a la molette.

   Chaque browser.newPage() de Playwright cree un CONTEXTE neuf : le
   localStorage est donc vide au depart de chaque page, et les pages ne se
   contaminent pas entre elles. */
import { chromium } from 'playwright';
const BASE = process.env.TEST_URL || 'http://127.0.0.1:4300/';
const KEY = 'enquete-1948:partie';
const EYE = 1.65, SENS = 0.0022;
const GRECO = { x: -3.2, y: 1.35, z: -0.2 };
const ASHTRAY = { x: -4.5, y: 0.83, z: 3.5 };
const PHONE = { x: -4.7, y: 0.95, z: -3.0 };
const FORBIDDEN = ['truth', 'ment', 'mensonge', 'menteur', 'vrai', 'faux',
                   'partial', 'supersedes', 'contradiction'];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
let failures = 0;
const r = (l, ok, d) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'ECHEC'}  ${l}${d ? '  ->  ' + d : ''}`); };
const strip = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const settle = async (page) => {
  await page.waitForFunction(
    () => document.querySelector('#loading-screen')?.classList.contains('is-hidden'),
    { timeout: 40000 },
  );
  await page.waitForTimeout(800);
};

async function open(query = '', viewport = { width: 1000, height: 560 }, init = null) {
  const page = await browser.newPage({ viewport });
  const logs = { errs: [], warns: [], infos: [] };
  page.on('pageerror', (e) => logs.errs.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') logs.errs.push(m.text());
    if (m.type() === 'warning') logs.warns.push(m.text());
    if (m.type() === 'info') logs.infos.push(m.text());
  });
  if (init) await page.addInitScript(init);
  await page.goto(BASE + query, { waitUntil: 'load' });
  await settle(page);
  return { page, logs };
}

function controls(page) {
  let yaw = 0, pitch = 0;
  const st = async () => {
    const t = await page.textContent('#debug-line');
    const m = /x (-?[\d.]+)\s+y (-?[\d.]+)\s+z (-?[\d.]+) \| cap (-?[\d.]+)° (-?[\d.]+)°/.exec(t);
    if (!m) throw new Error('ligne de controle illisible : ' + t);
    return { x: +m[1], y: +m[2], z: +m[3], yaw: +m[4] * Math.PI / 180, pitch: +m[5] * Math.PI / 180 };
  };
  const setYaw = async (t) => {
    await page.evaluate((dx) => window.dispatchEvent(new MouseEvent('mousemove', { movementX: dx })), -(t - yaw) / SENS);
    yaw = t; await page.waitForTimeout(110);
  };
  const setPitch = async (t) => {
    await page.evaluate((dy) => window.dispatchEvent(new MouseEvent('mousemove', { movementY: dy })), -(t - pitch) / SENS);
    pitch = t; await page.waitForTimeout(110);
  };
  const lookAt = async (o, passes = 3) => {
    for (let i = 0; i < passes; i++) {
      const p = await st(); yaw = p.yaw; pitch = p.pitch;
      const dx = o.x - p.x, dy = (o.y ?? 1) - (p.y + EYE), dz = o.z - p.z;
      await setYaw(Math.atan2(-dx, -dz)); await setPitch(Math.atan2(dy, Math.hypot(dx, dz)));
    }
    await page.waitForTimeout(250);
  };
  const goNear = async (o, stop, maxMs = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const p = await st(); yaw = p.yaw; pitch = p.pitch;
      if (Math.hypot(o.x - p.x, o.z - p.z) <= stop) break;
      await setPitch(0); await setYaw(Math.atan2(-(o.x - p.x), -(o.z - p.z)));
      await page.keyboard.down('KeyW'); await page.waitForTimeout(320);
      await page.keyboard.up('KeyW'); await page.waitForTimeout(80);
    }
    await page.waitForTimeout(350); return st();
  };
  const resync = async () => { const p = await st(); yaw = p.yaw; pitch = p.pitch; };
  return { st, lookAt, goNear, resync };
}

const book = (page) => page.evaluate(() => {
  const panel = document.querySelector('#notebook-panel');
  if (!panel) return null;
  return {
    open: !panel.classList.contains('is-hidden'),
    pointerEvents: getComputedStyle(panel).pointerEvents,
    storage: document.querySelector('.notebook-storage')?.textContent ?? '',
    armed: !document.querySelector('#notebook-confirm')
      ?.closest('.notebook-action')?.classList.contains('is-hidden'),
    rubrics: [...panel.querySelectorAll('.notebook-rubric')].map((block) => ({
      title: block.querySelector('.rubric-title')?.textContent ?? '',
      entries: [...block.querySelectorAll('.notebook-entry')].map((item) => ({
        label: item.querySelector('.entry-label')?.textContent ?? null,
        texts: [...item.querySelectorAll('.entry-text')].map((p) => p.textContent),
      })),
    })),
    text: panel.innerText ?? '',
  };
});
const rubricOf = (b, prefix) => b.rubrics.find((x) => x.title.startsWith(prefix));
const topics = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.dialogue-choice')].map((b) => b.dataset.topic).filter(Boolean));
const evidences = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.dialogue-choice[data-evidence]')].map((b) => ({
    key: b.dataset.evidence,
    category: b.querySelector('.choice-category')?.textContent ?? '',
  })));
const report = (page) => page.evaluate(() => {
  const panel = document.querySelector('#state-report');
  if (!panel) return null;
  const blocks = {};
  for (const block of panel.querySelectorAll('.state-block')) {
    blocks[block.querySelector('.state-heading')?.textContent ?? ''] =
      [...block.querySelectorAll('.state-list li')].map((li) => li.textContent);
  }
  return blocks;
});
const saved = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);

/** Ecrit une sauvegarde puis recharge : c'est le vrai chemin de lecture. */
async function seed(page, value) {
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, value]);
  await page.reload({ waitUntil: 'load' });
  await settle(page);
}

/* ================================================================
   PAGE 1 — JOUER, RECHARGER, TOUT RETROUVER
   ================================================================ */
{
  const { page, logs } = await open('?etat=1');
  const c = controls(page);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await c.resync();

  const readThrough = async (max = 16) => {
    for (let i = 0; i < max; i++) {
      if ((await topics(page)).length > 0) break;
      await page.click('#dialogue-line', { force: true }).catch(() => {});
      await page.waitForTimeout(270);
    }
  };
  const ask = async (id) => {
    await page.click(`.dialogue-choice[data-topic="${id}"]`);
    await page.waitForTimeout(350); await readThrough();
  };
  const examine = async (target) => {
    await c.lookAt(target);
    await page.mouse.click(500, 280); await page.waitForTimeout(450);
    await page.mouse.click(500, 280); await page.waitForTimeout(350);
    await c.resync();
  };

  console.log('=== 1. AUCUNE PARTIE AU DEPART ===');
  r('la cle de sauvegarde est absente', (await saved(page)) === null);
  r('la console le dit', logs.infos.some((l) => l.includes('aucune partie conservee')),
    logs.infos.find((l) => l.includes('[sauvegarde]')) ?? 'aucun message');

  console.log('\n=== 2. ON JOUE ===');
  await c.goNear({ x: 0, z: 0.4 }, 0.6);
  await c.goNear({ x: 0, z: 3.9 }, 0.6);
  await c.goNear({ x: -3.4, z: 3.1 }, 0.6);
  await c.goNear(ASHTRAY, 1.3);
  await examine(ASHTRAY);
  await c.goNear({ x: 0, z: 0.4 }, 0.7);
  await c.goNear({ x: -1.2, z: -3.2 }, 0.8);
  await c.goNear(PHONE, 1.3);
  await examine(PHONE);
  await c.goNear({ x: -1.2, z: -3.2 }, 0.8);
  await c.goNear({ x: 0, z: 0.2 }, 0.7);
  await c.goNear(GRECO, 1.9);
  await c.lookAt(GRECO);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(700);
  await ask('greco_evening');
  await ask('greco_after_closing');
  await page.click('#dialogue-present');
  await page.waitForTimeout(400);
  await page.click('.dialogue-choice[data-evidence="clue:ashtray"]');
  await page.waitForTimeout(400);
  await readThrough();
  await ask('greco_the_call');
  const before = { topics: await topics(page) };
  r('la partie a bien avance',
    before.topics.includes('greco_who_came_back')
      && before.topics.includes('greco_who_did_you_call'),
    before.topics.join(', '));

  console.log('\n=== 3. LA SAUVEGARDE ELLE-MEME ===');
  const text = await saved(page);
  r('la cle existe maintenant', typeof text === 'string' && text.length > 0);
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* signale juste apres */ }
  r('son contenu est du JSON valide', parsed !== null);
  r('elle porte la version du format', parsed?.version === 1, `version ${parsed?.version}`);
  r('elle pese moins de 4 Ko', text.length < 4096, `${text.length} octets`);
  const leaks = FORBIDDEN.filter((w) => new RegExp(`\\b${strip(w)}\\b`).test(strip(text)));
  r('elle ne contient AUCUN terme interne', leaks.length === 0,
    leaks.length ? 'FUITE : ' + leaks.join(', ') : `${FORBIDDEN.length} termes verifies`);
  r('elle ne contient aucun champ de verite',
    !Object.prototype.hasOwnProperty.call(parsed ?? {}, 'truth') && !text.includes('truth'));
  r('elle ne contient ni position ni mode de jeu',
    !text.includes('position') && !text.includes('exploring') && !text.includes('notebook'));

  console.log('\n=== 4. ON RECHARGE : TOUT DOIT ETRE LA ===');
  await page.reload({ waitUntil: 'load' });
  await settle(page);
  r('la console annonce la reprise',
    logs.infos.some((l) => l.includes('partie reprise')),
    logs.infos.filter((l) => l.includes('partie reprise')).join(' | ') || 'aucun message');
  const rep = await report(page);
  r('les indices sont repris',
    (rep['Indices (2)'] ?? null) !== null, Object.keys(rep).join(' | '));
  r('les declarations sont reprises, les deux versions comprises',
    (Object.entries(rep).find(([k]) => k.startsWith('Déclarations'))?.[1] ?? []).length === 3);
  r('le fait acquis est repris',
    (rep['Faits acquis (1)'] ?? null) !== null);
  r('les questions posees sont reprises',
    (Object.entries(rep).find(([k]) => k.startsWith('Questions'))?.[1] ?? []).length >= 3);
  r("l'humeur est reprise",
    (Object.entries(rep).find(([k]) => k.startsWith('Humeurs'))?.[1] ?? []).length >= 1,
    (Object.entries(rep).find(([k]) => k.startsWith('Humeurs'))?.[1] ?? []).join(' | '));

  console.log('\n=== 5. LE CARNET APRES RECHARGEMENT ===');
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  const b = await book(page);
  r('2 indices au dossier', rubricOf(b, 'Indices').title === 'Indices (2)',
    rubricOf(b, 'Indices').title);
  r('3 declarations au dossier', rubricOf(b, 'Déclarations').title === 'Déclarations (3)',
    rubricOf(b, 'Déclarations').title);
  r('1 fait au dossier', rubricOf(b, 'Faits acquis').title === 'Faits acquis (1)',
    rubricOf(b, 'Faits acquis').title);
  const chained = rubricOf(b, 'Déclarations').entries.find((e) => e.texts.length > 1);
  r('les deux versions sont toujours chainees', !!chained,
    chained?.texts.map((t) => t.slice(0, 24)).join(' >> '));
  r('le repere de conservation est affiche',
    b.storage.includes('conservé dans ce navigateur'), `"${b.storage}"`);
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);

  console.log('\n=== 6. L\'ENTRETIEN SE SOUVIENT ===');
  /* On REMARCHE jusqu'a Greco : la position n'est pas sauvegardee, a
     dessein, et le joueur reapparait au point de depart. */
  await c.resync();
  await c.goNear({ x: 0, z: 0.2 }, 0.6);
  await c.goNear(GRECO, 1.9);
  await c.lookAt(GRECO);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(700);
  const after = { topics: await topics(page), evidences: await evidences(page) };
  r("l'entretien se rouvre apres avoir remarche", after.topics.length > 0,
    after.topics.join(', '));
  r('les questions deja posees ne reviennent pas',
    !after.topics.includes('greco_evening') && !after.topics.includes('greco_after_closing'),
    after.topics.join(', '));
  r('la question ouverte par le personnage est toujours la',
    after.topics.includes('greco_who_came_back'));
  r('la question conditionnee par le fait est toujours la',
    after.topics.includes('greco_who_did_you_call'));
  await page.click('#dialogue-present');
  await page.waitForTimeout(400);
  const shown = await evidences(page);
  r('la mention « deja montre » est conservee',
    shown.some((e) => e.key === 'clue:ashtray' && e.category.includes('déjà montré')),
    shown.find((e) => e.key === 'clue:ashtray')?.category);
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  await page.close();
}

/* ================================================================
   PAGES 2 a 7 — LES SAUVEGARDES ABIMEES
   Dans CHAQUE cas : le jeu demarre, le probleme est nomme, et ce qui
   restait de valable est conserve.
   ================================================================ */
const base = {
  version: 1,
  discoveredClues: ['ashtray'],
  heardStatements: [],
  knownFacts: [],
  askedTopics: [],
  unlockedTopics: [],
  presentedEvidence: [],
  moods: {},
};
const abimees = [
  {
    titre: '7. UNE VERSION ETRANGERE',
    valeur: JSON.stringify({ ...base, version: 99 }),
    attend: (w) => w.includes('version 99') && w.includes('version 1'),
    neuve: true,
  },
  {
    titre: '8. DU JSON ILLISIBLE',
    valeur: '{ceci n’est pas du JSON',
    attend: (w) => w.includes('illisible'),
    neuve: true,
  },
  {
    titre: '9. UN TABLEAU AU LIEU D’UN OBJET',
    valeur: '[]',
    attend: (w) => w.includes("n'est pas un objet") || w.includes('pas un objet'),
    neuve: true,
  },
  {
    titre: '10. UN CHAMP ABSENT ET UN CHAMP DU MAUVAIS TYPE',
    valeur: JSON.stringify({ version: 1, discoveredClues: 'ashtray', moods: 42 }),
    attend: (w) => w.includes('mauvais type') && w.includes('absent'),
    neuve: true,
  },
  {
    titre: '11. DES IDENTIFIANTS QUI N’EXISTENT PLUS',
    valeur: JSON.stringify({
      ...base,
      discoveredClues: ['ashtray', 'fantome', 'disparu'],
      heardStatements: ['greco_closed_2130', 'jamais_dit'],
      knownFacts: ['inconnu'],
      askedTopics: ['greco_evening', 'question_morte'],
    }),
    attend: (w) => w.includes('2 indice(s) inconnu(s)') && w.includes('fantome')
      && w.includes('declaration(s) inconnu(s)') && w.includes('fait(s) inconnu(s)'),
    neuve: false,
    verifie: (b) => rubricOf(b, 'Indices').title === 'Indices (1)'
      && rubricOf(b, 'Déclarations').title === 'Déclarations (1)'
      && rubricOf(b, 'Faits acquis').title === 'Faits acquis (0)',
  },
  {
    titre: '12. UN PERSONNAGE ET UNE HUMEUR QUI N’EXISTENT PAS',
    valeur: JSON.stringify({
      ...base,
      presentedEvidence: ['fantome|clue:ashtray', 'greco|clue:disparu', 'greco|clue:ashtray'],
      moods: { greco: 'furieux', fantome: 'guarded' },
    }),
    attend: (w) => w.includes('2 element(s) presente(s) ecarte(s)')
      && w.includes('2 humeur(s) ecartee(s)'),
    neuve: false,
    verifie: (b) => rubricOf(b, 'Indices').title === 'Indices (1)',
  },
];

for (const cas of abimees) {
  const { page, logs } = await open('?etat=1');
  console.log(`\n=== ${cas.titre} ===`);
  await seed(page, cas.valeur);
  const warns = logs.warns.filter((w) => w.includes('[sauvegarde]')).join(' | ');
  for (const w of logs.warns.filter((x) => x.includes('[sauvegarde]'))) console.log('   ' + w);
  r('le probleme est signale et nomme', cas.attend(warns), warns || 'AUCUN message');
  r('le jeu demarre quand meme', await page.evaluate(() =>
    document.querySelector('#loading-screen')?.classList.contains('is-hidden')));
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  const b = await book(page);
  if (cas.neuve) {
    r('la partie repart de zero',
      b.rubrics.every((x) => /\(0\)$/.test(x.title)), b.rubrics.map((x) => x.title).join(' | '));
  } else {
    r('ce qui restait de valable est CONSERVE', cas.verifie(b),
      b.rubrics.map((x) => x.title).join(' | '));
  }
  await page.close();
}

/* ================================================================
   PAGE 8 — localStorage INDISPONIBLE (navigation privee, quota nul)
   ================================================================ */
{
  const { page, logs } = await open('', { width: 1000, height: 560 }, () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('acces refuse', 'SecurityError'); },
    });
  });
  const c = controls(page);
  console.log('\n=== 13. SANS localStorage, LE JEU TOURNE QUAND MEME ===');
  const warns = logs.warns.filter((w) => w.includes('[sauvegarde]'));
  r('le jeu a demarre', await page.evaluate(() =>
    document.querySelector('#loading-screen')?.classList.contains('is-hidden')));
  r('un seul avertissement, pas un par changement', warns.length === 1,
    `${warns.length} : ${warns.join(' | ')}`);
  r("il explique qu'on joue sans sauvegarde", warns[0]?.includes('ne conserve pas la partie'),
    warns[0]);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await c.resync();
  await c.goNear({ x: 0, z: 0.4 }, 0.6);
  await c.goNear({ x: 0, z: 3.9 }, 0.6);
  await c.goNear({ x: -3.4, z: 3.1 }, 0.6);
  await c.goNear(ASHTRAY, 1.3);
  await c.lookAt(ASHTRAY);
  await page.mouse.click(500, 280); await page.waitForTimeout(450);
  await page.mouse.click(500, 280); await page.waitForTimeout(350);
  await c.resync();
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  const b = await book(page);
  r('on peut jouer et le carnet se remplit',
    rubricOf(b, 'Indices').title === 'Indices (1)', rubricOf(b, 'Indices').title);
  r('le carnet PREVIENT que rien ne sera conserve',
    b.storage.includes('ne conserve pas'), `"${b.storage}"`);
  r('aucun avertissement supplementaire apres avoir joue',
    logs.warns.filter((w) => w.includes('[sauvegarde]')).length === 1);
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  await page.close();
}

/* ================================================================
   PAGE 9 — RECOMMENCER L'ENQUETE, EN DEUX TEMPS
   ================================================================ */
{
  const { page, logs } = await open();
  const c = controls(page);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await c.resync();
  await c.goNear({ x: 0, z: 0.4 }, 0.6);
  await c.goNear({ x: 0, z: 3.9 }, 0.6);
  await c.goNear({ x: -3.4, z: 3.1 }, 0.6);
  await c.goNear(ASHTRAY, 1.3);
  await c.lookAt(ASHTRAY);
  await page.mouse.click(500, 280); await page.waitForTimeout(450);
  await page.mouse.click(500, 280); await page.waitForTimeout(350);
  await c.resync();

  console.log('\n=== 14. UN CLIC N’EFFACE RIEN ===');
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  let b = await book(page);
  r('le dossier contient quelque chose',
    rubricOf(b, 'Indices').title === 'Indices (1)', rubricOf(b, 'Indices').title);
  r('le bouton de confirmation est cache au depart', b.armed === false);
  await page.click('#notebook-restart');
  await page.waitForTimeout(300);
  b = await book(page);
  r('un clic demande confirmation', b.armed === true);
  r("il annonce que c'est definitif", b.text.includes('définitif'));
  r('RIEN n’a ete efface', (await saved(page)) !== null);
  r('le dossier est intact',
    rubricOf(b, 'Indices').title === 'Indices (1)', rubricOf(b, 'Indices').title);

  console.log('\n=== 15. ANNULER, ET REFERMER, DESARMENT ===');
  await page.click('#notebook-cancel');
  await page.waitForTimeout(300);
  r('« Annuler » revient en arriere', (await book(page)).armed === false);
  await page.click('#notebook-restart');
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(350);
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  r('refermer le carnet desarme le bouton', (await book(page)).armed === false);
  r('toujours rien d’efface', (await saved(page)) !== null);

  console.log('\n=== 16. CONFIRMER EFFACE VRAIMENT ===');
  await page.click('#notebook-restart');
  await page.waitForTimeout(250);
  await page.click('#notebook-confirm');
  await page.waitForTimeout(1200);
  await settle(page);
  r('la sauvegarde a disparu', (await saved(page)) === null);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  b = await book(page);
  r('le dossier est vide',
    b.rubrics.every((x) => /\(0\)$/.test(x.title)), b.rubrics.map((x) => x.title).join(' | '));
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  await page.close();
}

/* ================================================================
   PAGE 10 — LE CARNET DEFILE A LA MOLETTE
   Fenetre volontairement basse pour que le dossier depasse.
   ================================================================ */
{
  const { page, logs } = await open('', { width: 620, height: 340 });
  const c = controls(page);
  await page.mouse.click(310, 170);
  await page.waitForTimeout(400);
  await c.resync();
  await c.goNear({ x: 0, z: 0.4 }, 0.6);
  await c.goNear({ x: 0, z: 3.9 }, 0.6);
  await c.goNear({ x: -3.4, z: 3.1 }, 0.6);
  await c.goNear(ASHTRAY, 1.3);
  await c.lookAt(ASHTRAY);
  await page.mouse.click(310, 170); await page.waitForTimeout(450);
  await page.mouse.click(310, 170); await page.waitForTimeout(350);
  await c.resync();

  console.log('\n=== 17. LA MOLETTE (defaut de la 7A) ===');
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  const b = await book(page);
  r('le carnet recoit les evenements de pointeur', b.pointerEvents === 'auto', b.pointerEvents);
  const overflow = await page.evaluate(() => {
    const body = document.querySelector('#notebook-body');
    return { scrollH: body.scrollHeight, clientH: body.clientHeight, top: body.scrollTop };
  });
  r('le dossier depasse la fenetre (conditions du test reunies)',
    overflow.scrollH > overflow.clientH + 10,
    `${overflow.scrollH} px de contenu pour ${overflow.clientH} px visibles`);
  await page.mouse.move(310, 200);
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(350);
  const after = await page.evaluate(() => document.querySelector('#notebook-body').scrollTop);
  r('la molette fait defiler le dossier', after > 5, `scrollTop ${overflow.top} -> ${after}`);
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  await page.close();
}

/* ================================================================
   PAGE 11 — LES RUBRIQUES NE SONT PAS DANS LA SAUVEGARDE (7C-2)
   Une partie ecrite AVANT l'arrivee du catalogue se relit telle
   quelle : le format de l'etat n'a pas bouge d'un octet, et le
   rangement se resout au chargement depuis les donnees de l'affaire.
   ================================================================ */
{
  const { page, logs } = await open();
  console.log('\n=== 18. UNE PARTIE D\'AVANT LE CATALOGUE SE RELIT ===');
  await seed(page, JSON.stringify({
    version: 1,
    discoveredClues: ['ashtray', 'report'],
    heardStatements: [],
    knownFacts: [],
    askedTopics: [],
    unlockedTopics: [],
    presentedEvidence: [],
    moods: {},
  }));
  r('aucun probleme signale a la relecture',
    logs.warns.filter((w) => w.includes('[sauvegarde]')).length === 0,
    logs.warns.filter((w) => w.includes('[sauvegarde]')).join(' | ') || 'aucun');
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  const b = await book(page);
  const clues = rubricOf(b, 'Indices');
  r('les deux indices sont repris', clues.title === 'Indices (2)', clues.title);
  r('et ranges sous leurs rubriques, resolues au chargement',
    b.text.includes('La salle') && b.text.includes('Papiers'),
    clues.entries.map((e) => e.label).join(' | '));
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  await page.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'TOUT EST VERT' : failures + ' ECHEC(S)'}`);
process.exit(failures === 0 ? 0 : 1);
