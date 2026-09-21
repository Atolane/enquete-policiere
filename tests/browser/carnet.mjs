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

/* PHASE 7A — le carnet.
   Ce que cette suite cherche a mettre en defaut :
     - le carnet qui volerait une touche aux dialogues, ou l'inverse ;
     - un entretien abime par un aller-retour dans le carnet ;
     - le viseur qui ne revient pas (la regression de la 2C) ;
     - un jugement, une humeur, un identifiant brut a l'ecran ;
     - un texte de carnet qui ne viendrait pas de src/data/ ;
     - le releve ?etat=1 qui cesserait de suivre l'etat. */
import { chromium } from 'playwright';
const BASE = process.env.TEST_URL || 'http://127.0.0.1:4290/';
const EYE = 1.65, SENS = 0.0022;
const GRECO = { x: -3.2, y: 1.35, z: -0.2 };
const MANNEQUIN_B = { x: 3.2, y: 1.35, z: -0.2 };
const ASHTRAY = { x: -4.5, y: 0.83, z: 3.5 };
const REPORT = { x: 3.5, y: 1.42, z: -2.0 };
const PHONE = { x: -4.7, y: 0.95, z: -3.0 };
const FORBIDDEN = ['truth', 'ment', 'mensonge', 'menteur', 'vrai', 'faux',
                   'partial', 'supersedes', 'true', 'false', 'contradiction'];
/* Ce qui ne doit JAMAIS apparaitre dans le carnet : des identifiants
   techniques, et tout ce qui releve du jugement ou du score. */
const NO_TECH = ['greco_', 'ashtray', 'report', 'press_camera',
                 'call_after_closing', 'neutral', 'guarded', 'nervous', 'hostile'];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
let failures = 0;
const r = (l, ok, d) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'ECHEC'}  ${l}${d ? '  ->  ' + d : ''}`); };
const strip = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function open(query = '', patch = []) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
  const logs = { errs: [], warns: [], infos: [] };
  page.on('pageerror', (e) => logs.errs.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') logs.errs.push(m.text());
    if (m.type() === 'warning') logs.warns.push(m.text());
    if (m.type() === 'info') logs.infos.push(m.text());
  });
  if (patch.length > 0) {
    await page.route('**/*.js', async (route) => {
      const res = await route.fetch();
      let body = await res.text();
      for (const [from, to] of patch) {
        if (!body.includes(from)) throw new Error(`motif introuvable : ${from}`);
        body = body.replace(from, to);
      }
      await route.fulfill({ response: res, body });
    });
  }
  await page.goto(BASE + query, { waitUntil: 'load' });
  await page.waitForFunction(
    () => document.querySelector('#loading-screen')?.classList.contains('is-hidden'),
    { timeout: 40000 },
  );
  await page.waitForTimeout(900);
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
  return { st, lookAt, goNear, resync, setYaw };
}

/** Lit tout le carnet : rubriques, sections, entrees, balisage. */
const book = (page) => page.evaluate(() => {
  const panel = document.querySelector('#notebook-panel');
  if (!panel) return null;
  const rubrics = [...panel.querySelectorAll('.notebook-rubric')].map((block) => ({
    title: block.querySelector('.rubric-title')?.textContent ?? '',
    empty: block.querySelector('.notebook-empty')?.textContent ?? null,
    sections: [...block.querySelectorAll('.notebook-section')].map((group) => ({
      title: group.querySelector('.section-title')?.textContent ?? '',
      subtitle: group.querySelector('.section-subtitle')?.textContent ?? null,
      entries: [...group.querySelectorAll('.notebook-entry')].map((item) => ({
        label: item.querySelector('.entry-label')?.textContent ?? null,
        texts: [...item.querySelectorAll('.entry-text')].map((p) => p.textContent),
        thens: [...item.querySelectorAll('.entry-then')].map((p) => p.textContent),
        classes: [...item.querySelectorAll('.entry-text')].map((p) => p.className),
      })),
    })),
  }));
  return {
    open: !panel.classList.contains('is-hidden'),
    rubrics,
    text: panel.innerText ?? '',
    html: panel.innerHTML ?? '',
  };
});

const crosshairHidden = (page) => page.evaluate(() =>
  document.querySelector('#crosshair')?.classList.contains('is-hidden') ?? null);
const topics = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.dialogue-choice')].map((b) => b.dataset.topic).filter(Boolean));
const dialogueOpen = (page) => page.evaluate(() => {
  const p = document.querySelector('#dialogue-panel');
  return p !== null && !p.classList.contains('is-hidden');
});
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
const rubricOf = (b, prefix) => b.rubrics.find((x) => x.title.startsWith(prefix));

/* ================================================================
   PAGE 1 — ouverture, fermeture, et ce que le carnet contient
   ================================================================ */
{
  const { page, logs } = await open();
  const c = controls(page);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await c.resync();

  console.log('=== 1. AU DEPART, LE CARNET EST FERME ===');
  let b = await book(page);
  r('le panneau existe mais reste ferme', b !== null && !b.open);
  r('le viseur est visible', (await crosshairHidden(page)) === false);

  console.log('\n=== 2. N OUVRE LE CARNET ===');
  const before = await c.st();
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(350);
  b = await book(page);
  r('le carnet est ouvert', b.open);
  r('le viseur est masque', (await crosshairHidden(page)) === true);

  console.log('\n=== 3. LE JEU EST SUSPENDU DERRIERE ===');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
  await page.waitForTimeout(200);
  let now = await c.st();
  const moved = Math.hypot(now.x - before.x, now.z - before.z);
  r('le joueur ne se deplace pas', moved < 0.02, `${(moved * 100).toFixed(1)} cm`);
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 400 })));
  await page.waitForTimeout(200);
  now = await c.st();
  r('la vue ne tourne pas', Math.abs(now.yaw - before.yaw) < 0.01,
    `${((now.yaw - before.yaw) * 180 / Math.PI).toFixed(1)}°`);

  console.log('\n=== 4. LE CARNET VIDE EST LISIBLE ===');
  r('trois rubriques', b.rubrics.length === 3, b.rubrics.map((x) => x.title).join(' | '));
  r('les compteurs sont a zero',
    b.rubrics.every((x) => /\(0\)$/.test(x.title)), b.rubrics.map((x) => x.title).join(' | '));
  r('chaque rubrique explique qu\'elle est vide',
    b.rubrics.every((x) => x.empty && x.empty.length > 5),
    b.rubrics.map((x) => x.empty).join(' | '));

  console.log('\n=== 5. N PUIS ECHAP REFERMENT, ET TOUT REVIENT ===');
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(350);
  r('N referme', !(await book(page)).open);
  r('le viseur est revenu', (await crosshairHidden(page)) === false);
  await c.resync();
  const p1 = await c.st();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
  await page.waitForTimeout(200);
  const p2 = await c.st();
  r('le joueur se deplace de nouveau',
    Math.hypot(p2.x - p1.x, p2.z - p1.z) > 0.3,
    `${Math.hypot(p2.x - p1.x, p2.z - p1.z).toFixed(2)} m`);
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  r('Echap referme aussi', !(await book(page)).open);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(500);
  await c.resync();

  console.log('\n=== 6. N NE FAIT RIEN PENDANT LA LECTURE D\'UNE FICHE ===');
  await c.goNear({ x: 0, z: 0.4 }, 0.6);
  await c.goNear({ x: 0, z: 3.9 }, 0.6);
  await c.goNear({ x: -3.4, z: 3.1 }, 0.6);
  await c.goNear(ASHTRAY, 1.3);
  await c.lookAt(ASHTRAY);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(350);
  r('le carnet ne s\'ouvre pas par-dessus une fiche', !(await book(page)).open);
  r('la fiche est toujours la', await page.evaluate(() =>
    !document.querySelector('#info-panel')?.classList.contains('is-hidden')));
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await c.resync();

  console.log('\n=== 7. L\'INDICE RAMASSE FIGURE AU CARNET ===');
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(350);
  b = await book(page);
  let clues = rubricOf(b, 'Indices');
  r('la rubrique compte 1 indice', clues.title === 'Indices (1)', clues.title);
  r('il est classe sous sa rubrique', clues.sections[0]?.title === 'La salle',
    clues.sections.map((s) => s.title).join(' | '));
  r('son nom vient du catalogue', clues.sections[0]?.entries[0]?.label === 'Cendrier',
    clues.sections[0]?.entries[0]?.label);
  r('sa description aussi',
    clues.sections[0]?.entries[0]?.texts[0]?.startsWith('Un mégot taché de rouge à lèvres'),
    clues.sections[0]?.entries[0]?.texts[0]?.slice(0, 40));
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(300);
  await c.resync();

  console.log('\n=== 8. GROUPEMENT PAR RUBRIQUE ===');
  await c.goNear({ x: 0, z: 3.9 }, 0.7);
  await c.goNear({ x: 2.6, z: 0.6 }, 0.7);
  await c.goNear(REPORT, 1.3);
  await c.lookAt(REPORT);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(350);
  await c.resync();
  await c.goNear({ x: 0, z: 0.4 }, 0.7);
  await c.goNear({ x: -1.2, z: -3.2 }, 0.8);
  await c.goNear(PHONE, 1.3);
  await c.lookAt(PHONE);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(350);
  await c.resync();
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(350);
  b = await book(page);
  clues = rubricOf(b, 'Indices');
  r('3 indices ramasses', clues.title === 'Indices (3)', clues.title);
  r('deux rubriques, pas trois', clues.sections.length === 2,
    clues.sections.map((s) => `${s.title} (${s.entries.length})`).join(' | '));
  r('cendrier et telephone sous la meme rubrique',
    clues.sections.find((s) => s.title === 'La salle')?.entries.length === 2);
  r('le rapport est sous la sienne',
    clues.sections.find((s) => s.title === 'Papiers')?.entries.length === 1);

  console.log('\n=== 9. CE QUE LE CARNET NE DIT PAS ===');
  const bookText = strip(b.text + ' ' + b.html);
  const tech = NO_TECH.filter((w) => bookText.includes(strip(w)));
  r('aucun identifiant technique, aucune humeur', tech.length === 0,
    tech.length ? 'TROUVE : ' + tech.join(', ') : `${NO_TECH.length} termes verifies`);
  r('aucune rubrique « questions posees »', !bookText.includes('question'));
  r('aucun score, aucun pourcentage', !/\d+\s*%/.test(b.text));
  const leaks = FORBIDDEN.filter((w) => new RegExp(`\\b${strip(w)}\\b`).test(bookText));
  r('aucun terme interne ni jugement', leaks.length === 0,
    leaks.length ? 'FUITE : ' + leaks.join(', ') : `${FORBIDDEN.length} termes verifies`);

  console.log('\n=== 10. UN OBJET ORDINAIRE N\'Y FIGURE PAS ===');
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(300);
  await c.resync();
  await c.goNear({ x: 0, z: 0.4 }, 0.7);
  await c.goNear({ x: 2.2, z: 1.2 }, 0.7);
  await c.goNear(MANNEQUIN_B, 1.5);
  await c.lookAt(MANNEQUIN_B);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(350);
  await c.resync();
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(350);
  b = await book(page);
  r('le mannequin examine n\'est pas entre au dossier',
    rubricOf(b, 'Indices').title === 'Indices (3)' && !b.text.includes('Mannequin'),
    rubricOf(b, 'Indices').title);

  console.log('\n=== 11. ERREURS ET AVERTISSEMENTS ===');
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  r('aucun avertissement', logs.warns.length === 0, logs.warns.join(' | ') || 'aucun');
  await page.close();
}

/* ================================================================
   PAGE 2 — le carnet PENDANT un entretien
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

  // Le cendrier d'abord : il ouvre la question du dementi.
  await c.goNear({ x: 0, z: 0.4 }, 0.6);
  await c.goNear({ x: 0, z: 3.9 }, 0.6);
  await c.goNear({ x: -3.4, z: 3.1 }, 0.6);
  await c.goNear(ASHTRAY, 1.3);
  await c.lookAt(ASHTRAY);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(350);
  await c.resync();
  await c.goNear({ x: 0, z: 0.2 }, 0.6);
  await c.goNear(GRECO, 1.9);
  await c.lookAt(GRECO);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(700);
  await ask('greco_evening');

  console.log('\n=== 12. LE CARNET S\'OUVRE PENDANT L\'ENTRETIEN ===');
  const topicsBefore = await topics(page);
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  let b = await book(page);
  r('le carnet est ouvert', b.open);
  r('le panneau d\'entretien reste visible derriere', await dialogueOpen(page));

  console.log('\n=== 13. LE CLAVIER DE L\'ENTRETIEN EST ENDORMI ===');
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(400);
  r('la touche 1 ne pose aucune question',
    JSON.stringify(await topics(page)) === JSON.stringify(topicsBefore),
    (await topics(page)).join(', '));
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(400);
  r('la touche P n\'ouvre pas la liste d\'elements',
    await page.evaluate(() => !document.querySelector('#dialogue-back')));
  r('le carnet est toujours ouvert', (await book(page)).open);

  console.log('\n=== 14. ECHAP REFERME LE CARNET SANS QUITTER L\'ENTRETIEN ===');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(450);
  r('le carnet est referme', !(await book(page)).open);
  r('l\'entretien est toujours en cours', await dialogueOpen(page));
  r('les memes questions sont disponibles',
    JSON.stringify(await topics(page)) === JSON.stringify(topicsBefore),
    (await topics(page)).join(', '));

  console.log('\n=== 15. L\'ENTRETIEN FONCTIONNE ENCORE NORMALEMENT ===');
  await ask('greco_after_closing');
  r('une question posee apres l\'aller-retour repond bien',
    !(await topics(page)).includes('greco_after_closing'),
    (await topics(page)).join(', '));

  console.log('\n=== 16. LES DECLARATIONS AU CARNET ===');
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  b = await book(page);
  const said = rubricOf(b, 'Déclarations');
  r('la rubrique compte les declarations', /\(2\)$/.test(said.title), said.title);
  r('elles sont classees sous le nom du personnage',
    said.sections[0]?.title === 'Salvatore Greco', said.sections[0]?.title);
  r('avec sa qualite, pas son humeur',
    said.sections[0]?.subtitle === 'gérant du restaurant', said.sections[0]?.subtitle);
  r('chaque entree porte son sujet',
    said.sections[0]?.entries.every((e) => e.label && e.label.length > 2),
    said.sections[0]?.entries.map((e) => e.label).join(' | '));
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(300);

  console.log('\n=== 17. LES DEUX VERSIONS, SANS VERDICT ===');
  await page.click('#dialogue-present');
  await page.waitForTimeout(400);
  await page.click('.dialogue-choice[data-evidence="clue:ashtray"]');
  await page.waitForTimeout(400);
  await readThrough();
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  b = await book(page);
  const greco = rubricOf(b, 'Déclarations').sections[0];
  const chained = greco.entries.find((e) => e.texts.length > 1);
  r('les deux versions sont dans la MEME entree', !!chained,
    greco.entries.map((e) => `${e.label}:${e.texts.length}`).join(' | '));
  r('dans l\'ordre ou il les a dites',
    chained?.texts[0]?.includes('Personne') && chained?.texts[1]?.includes('repassé'),
    chained?.texts.map((t) => t.slice(0, 26)).join(' >> '));
  r('la seconde est presentee comme une suite', chained?.thens.length === 1,
    chained?.thens.join(', '));
  r('« Puis » est un constat de chronologie, pas un verdict',
    chained?.thens[0] === 'Puis', chained?.thens[0]);
  r('les deux versions portent EXACTEMENT le meme balisage',
    new Set(chained?.classes).size === 1, [...new Set(chained?.classes)].join(' | '));
  const bookText2 = strip(b.text + ' ' + b.html);
  const leaks2 = FORBIDDEN.filter((w) => new RegExp(`\\b${strip(w)}\\b`).test(bookText2));
  r('aucun terme interne ni jugement, versions comprises', leaks2.length === 0,
    leaks2.length ? 'FUITE : ' + leaks2.join(', ') : `${FORBIDDEN.length} termes verifies`);

  console.log('\n=== 18. LE RELEVE ?etat=1 SUIT TOUJOURS (liste d\'abonnes) ===');
  const blocks = await report(page);
  r('le releve existe encore', blocks !== null);
  r('il a bien suivi les declarations',
    (Object.entries(blocks).find(([k]) => k.startsWith('Déclarations'))?.[1] ?? []).length >= 2,
    Object.keys(blocks).join(' | '));
  r('il garde les humeurs, que le carnet n\'affiche pas',
    (Object.entries(blocks).find(([k]) => k.startsWith('Humeurs'))?.[1] ?? []).length >= 1,
    (Object.entries(blocks).find(([k]) => k.startsWith('Humeurs'))?.[1] ?? []).join(' | '));
  r('il garde les questions posees, que le carnet n\'affiche pas',
    (Object.entries(blocks).find(([k]) => k.startsWith('Questions'))?.[1] ?? []).length >= 2);

  console.log('\n=== 19. SORTIE PROPRE ===');
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(350);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  r('Echap met fin a l\'entretien quand le carnet est ferme',
    !(await dialogueOpen(page)));
  /* Reprise de la souris. Chrome peut refuser le verrouillage pendant
     environ une seconde apres un appui sur Echap : on verifie donc qu'il
     est reellement acquis, et on reessaie une fois plutot que de mesurer
     un deplacement qui n'avait aucune chance d'avoir lieu. */
  const locked = async () => page.evaluate(() => document.pointerLockElement !== null);
  for (let i = 0; i < 3 && !(await locked()); i++) {
    await page.mouse.click(500, 280);
    await page.waitForTimeout(700);
  }
  r('la souris est reprise au clic', await locked());
  await c.resync();
  /* On s'eloigne de Greco au lieu de marcher dedans : son volume de
     collision bloquerait le deplacement et le test mesurerait l'obstacle
     au lieu du clavier. */
  const away = await c.st();
  await c.setYaw(Math.atan2(-(away.x - GRECO.x), -(away.z - GRECO.z)));
  const q1 = await c.st();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
  await page.waitForTimeout(250);
  const q2 = await c.st();
  r('le joueur a repris la main',
    Math.hypot(q2.x - q1.x, q2.z - q1.z) > 0.3,
    `${Math.hypot(q2.x - q1.x, q2.z - q1.z).toFixed(2)} m`);
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  r('aucun avertissement', logs.warns.length === 0, logs.warns.join(' | ') || 'aucun');
  await page.close();
}

/* ================================================================
   PAGE 3 — le carnet lit-il vraiment src/data/ ?
   On change le catalogue dans le bundle servi, et rien d'autre.
   ================================================================ */
{
  const { page, logs } = await open('', [
    ['name:`Cendrier`', 'name:`SCELLÉ N°7`'],
    ['{id:`salle`,label:`La salle`}', '{id:`salle`,label:`SOUS SÉQUESTRE`}'],
  ]);
  const c = controls(page);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await c.resync();

  console.log('\n=== 20. LE CARNET SUIT LE CATALOGUE ===');
  await c.goNear({ x: 0, z: 0.4 }, 0.6);
  await c.goNear({ x: 0, z: 3.9 }, 0.6);
  await c.goNear({ x: -3.4, z: 3.1 }, 0.6);
  await c.goNear(ASHTRAY, 1.3);
  await c.lookAt(ASHTRAY);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(350);
  await c.resync();
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  const b = await book(page);
  const clues = rubricOf(b, 'Indices');
  r('le nom du catalogue a suivi',
    clues.sections[0]?.entries[0]?.label === 'SCELLÉ N°7', clues.sections[0]?.entries[0]?.label);
  r('la rubrique du catalogue a suivi',
    clues.sections[0]?.title === 'SOUS SÉQUESTRE', clues.sections[0]?.title);
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  await page.close();
}

/* ================================================================
   PAGE 4 — L'ORDRE DE DECOUVERTE (Phase 7C-2)
   Les rubriques sont desormais groupees par IDENTIFIANT et non plus
   par libelle. L'ordre doit rester celui dans lequel le joueur a
   trouve les choses -- on ramasse donc a l'envers.
   ================================================================ */
{
  const { page, logs } = await open();
  const c = controls(page);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await c.resync();

  console.log('\n=== 21. L\'ORDRE DE DECOUVERTE EST CONSERVE ===');
  // Le RAPPORT d'abord (rubrique « Papiers »), le cendrier ensuite.
  await c.goNear({ x: 0, z: 0.4 }, 0.6);
  await c.goNear({ x: 2.6, z: 0.6 }, 0.7);
  await c.goNear(REPORT, 1.3);
  await c.lookAt(REPORT);
  await page.mouse.click(500, 280); await page.waitForTimeout(450);
  await page.mouse.click(500, 280); await page.waitForTimeout(350);
  await c.resync();
  await c.goNear({ x: 2.6, z: 0.6 }, 0.7);
  await c.goNear({ x: 0, z: 3.9 }, 0.7);
  await c.goNear({ x: -3.4, z: 3.1 }, 0.6);
  await c.goNear(ASHTRAY, 1.3);
  await c.lookAt(ASHTRAY);
  await page.mouse.click(500, 280); await page.waitForTimeout(450);
  await page.mouse.click(500, 280); await page.waitForTimeout(350);
  await c.resync();
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  const b = await book(page);
  const clues = rubricOf(b, 'Indices');
  r('les deux indices sont la', clues.title === 'Indices (2)', clues.title);
  r('« Papiers » vient EN PREMIER, car trouve en premier',
    clues.sections[0]?.title === 'Papiers',
    clues.sections.map((x) => x.title).join(' puis '));
  r('« La salle » vient ensuite', clues.sections[1]?.title === 'La salle',
    clues.sections.map((x) => x.title).join(' puis '));
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  await page.close();
}

/* ================================================================
   PAGE 5 — UNE RUBRIQUE QUI N'EXISTE PAS
   Le validateur la nomme en console ; le carnet se rabat sur un
   intitule neutre, sans jamais montrer l'identifiant au joueur.
   ================================================================ */
{
  const { page, logs } = await open('', [
    ['rubric:`papiers`', 'rubric:`rubrique_absente_xyz`'],
  ]);
  const c = controls(page);

  console.log('\n=== 22. RUBRIQUE INCONNUE : REPLI SANS PLOMBERIE ===');
  const warned = logs.warns.find((w) => w.includes('rubrique inconnue'));
  r('le validateur la signale et la nomme',
    !!warned && warned.includes('rubrique_absente_xyz') && warned.includes('report'),
    warned ?? 'aucun message');

  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await c.resync();
  await c.goNear({ x: 0, z: 0.4 }, 0.6);
  await c.goNear({ x: 2.6, z: 0.6 }, 0.7);
  await c.goNear(REPORT, 1.3);
  await c.lookAt(REPORT);
  await page.mouse.click(500, 280); await page.waitForTimeout(450);
  await page.mouse.click(500, 280); await page.waitForTimeout(350);
  await c.resync();
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  let b = await book(page);
  let clues = rubricOf(b, 'Indices');
  r('l\'indice est quand meme au dossier', clues.title === 'Indices (1)', clues.title);
  r('il est range sous « Sans rubrique »', clues.sections[0]?.title === 'Sans rubrique',
    clues.sections[0]?.title);
  r('il reste parfaitement lisible',
    clues.sections[0]?.entries[0]?.label === 'Rapport dactylographié',
    clues.sections[0]?.entries[0]?.label);
  r('AUCUN identifiant technique n\'apparait dans le carnet',
    !b.text.includes('rubrique_absente_xyz') && !b.html.includes('rubrique_absente_xyz'));

  // Le jeu reste jouable : on ramasse un second indice, bien range celui-la.
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(350);
  await c.resync();
  await c.goNear({ x: 2.6, z: 0.6 }, 0.7);
  await c.goNear({ x: 0, z: 3.9 }, 0.7);
  await c.goNear({ x: -3.4, z: 3.1 }, 0.6);
  await c.goNear(ASHTRAY, 1.3);
  await c.lookAt(ASHTRAY);
  await page.mouse.click(500, 280); await page.waitForTimeout(450);
  await page.mouse.click(500, 280); await page.waitForTimeout(350);
  await c.resync();
  await page.keyboard.press('KeyN');
  await page.waitForTimeout(400);
  b = await book(page);
  clues = rubricOf(b, 'Indices');
  r('le jeu reste jouable malgre la faute',
    clues.title === 'Indices (2)'
      && clues.sections.some((x) => x.title === 'La salle'),
    clues.sections.map((x) => x.title).join(' | '));
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  await page.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'TOUT EST VERT' : failures + ' ECHEC(S)'}`);
process.exit(failures === 0 ? 0 : 1);
