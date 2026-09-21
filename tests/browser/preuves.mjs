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

import { chromium } from 'playwright';
const BASE = process.env.TEST_URL || 'http://127.0.0.1:4260/';
const EYE = 1.65, SENS = 0.0022;
const GRECO = { x: -3.2, y: 1.35, z: -0.2 };
const ASHTRAY = { x: -4.5, y: 0.83, z: 3.5 };
const REPORT = { x: 3.5, y: 1.42, z: -2.0 };
const PHONE = { x: -4.7, y: 0.95, z: -3.0 };
const FORBIDDEN = ['truth', 'ment', 'mensonge', 'menteur', 'vrai', 'faux',
                   'partial', 'supersedes', 'true', 'false', 'contradiction'];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 560 } });
const errs = [], warns = [], infos = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text());
  if (m.type() === 'warning') warns.push(m.text());
  if (m.type() === 'info') infos.push(m.text());
});
const r = (l, ok, d) => console.log(`${ok ? 'OK  ' : 'ECHEC'}  ${l}${d ? '  ->  ' + d : ''}`);

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('#loading-screen')?.classList.contains('is-hidden'), { timeout: 40000 });
await page.waitForTimeout(900);

const st = async () => { const t = await page.textContent('#debug-line');
  const m = /x (-?[\d.]+)\s+y (-?[\d.]+)\s+z (-?[\d.]+) \| cap (-?[\d.]+)° (-?[\d.]+)°/.exec(t);
  if (!m) throw new Error('ligne de controle illisible : ' + t);
  return { x: +m[1], y: +m[2], z: +m[3], yaw: +m[4]*Math.PI/180, pitch: +m[5]*Math.PI/180 }; };
const ch = async () => { const t = await page.textContent('#debug-characters');
  const m = /pnj (\S+) \| (\w+)\/(\w+) \|/.exec(t ?? '');
  return m ? { state: m[2], mood: m[3], raw: t } : { state: '?', mood: '?', raw: t }; };
const dlg = () => page.evaluate(() => {
  const panel = document.querySelector('#dialogue-panel');
  return {
    open: panel !== null && !panel.classList.contains('is-hidden'),
    line: document.querySelector('#dialogue-line')?.textContent ?? '',
    choices: [...document.querySelectorAll('.dialogue-choice')].map((b) => ({
      topic: b.dataset.topic ?? null, evidence: b.dataset.evidence ?? null,
      label: b.querySelector('.choice-label')?.textContent ?? '',
      category: b.querySelector('.choice-category')?.textContent ?? '',
      classes: b.className,
    })),
    hasPresent: !!document.querySelector('#dialogue-present'),
    hasBack: !!document.querySelector('#dialogue-back'),
  };
});
let yaw = 0, pitch = 0;
const setYaw = async (t) => { await page.evaluate((dx) => window.dispatchEvent(new MouseEvent('mousemove', { movementX: dx })), -(t - yaw) / SENS); yaw = t; await page.waitForTimeout(110); };
const setPitch = async (t) => { await page.evaluate((dy) => window.dispatchEvent(new MouseEvent('mousemove', { movementY: dy })), -(t - pitch) / SENS); pitch = t; await page.waitForTimeout(110); };
const lookAt = async (o, passes = 3) => { for (let i = 0; i < passes; i++) {
    const p = await st(); yaw = p.yaw; pitch = p.pitch;
    const dx = o.x - p.x, dy = (o.y ?? 1) - (p.y + EYE), dz = o.z - p.z;
    await setYaw(Math.atan2(-dx, -dz)); await setPitch(Math.atan2(dy, Math.hypot(dx, dz))); }
  await page.waitForTimeout(250); };
const goNear = async (o, stop, maxMs = 20000) => { const t0 = Date.now();
  while (Date.now() - t0 < maxMs) { const p = await st(); yaw = p.yaw; pitch = p.pitch;
    if (Math.hypot(o.x - p.x, o.z - p.z) <= stop) break;
    await setPitch(0); await setYaw(Math.atan2(-(o.x - p.x), -(o.z - p.z)));
    await page.keyboard.down('KeyW'); await page.waitForTimeout(320); await page.keyboard.up('KeyW'); await page.waitForTimeout(80); }
  await page.waitForTimeout(350); return st(); };
const readThrough = async (max = 16) => { const seen = [];
  for (let i = 0; i < max; i++) { const d = await dlg();
    if (d.choices.length > 0) break;
    if (d.line) seen.push(d.line);
    await page.click('#dialogue-line', { force: true }).catch(() => {});
    await page.waitForTimeout(270); }
  return seen; };
const ask = async (id) => { await page.click(`.dialogue-choice[data-topic="${id}"]`);
  await page.waitForTimeout(350); return readThrough(); };
/** Presente un element. Ouvre la liste si elle ne l'est pas deja. */
const present = async (key) => {
  const listOpen = await page.evaluate(() => !!document.querySelector('#dialogue-back'));
  if (!listOpen) { await page.click('#dialogue-present'); await page.waitForTimeout(350); }
  await page.click(`.dialogue-choice[data-evidence="${key}"]`);
  await page.waitForTimeout(350); return readThrough(); };
const examine = async (target) => {
  await lookAt(target); await page.mouse.click(500, 280); await page.waitForTimeout(450);
  await page.mouse.click(500, 280); await page.waitForTimeout(350); };
const talkToGreco = async () => {
  await goNear({ x: 0, z: 0.2 }, 0.6); await goNear(GRECO, 1.9); await lookAt(GRECO);
  await page.mouse.click(500, 280); await page.waitForTimeout(700); };
/** Quitte l'entretien ET reprend la souris. */
const leaveInterview = async () => {
  await page.keyboard.press('Escape'); await page.waitForTimeout(450);
  await page.mouse.click(500, 280); await page.waitForTimeout(500);
  const p = await st(); yaw = p.yaw; pitch = p.pitch; };
const visibleText = () => page.evaluate(() => {
  const l = document.querySelector('#ui-layer');
  return (l?.innerText ?? '') + ' ' + (l?.innerHTML ?? ''); });

console.log('=== 1. DONNEES VALIDEES (indices et reactions inclus) ===');
const ok = infos.find((l) => l.includes('donnees validees'));
r('le validateur ne signale aucun probleme', !!ok,
  ok ?? (warns.filter((w) => w.includes('[enquete]')).join(' | ') || 'aucun message'));

console.log('\n=== 2. SANS INDICE, RIEN A PRESENTER ===');
await page.mouse.click(500, 280);
await page.waitForTimeout(400);
await talkToGreco();
let d = await dlg();
r("l'option « Présenter » est absente au depart", !d.hasPresent);
await leaveInterview();

console.log('\n=== 3. RAMASSER LES TROIS INDICES ===');
await goNear({ x: 0, z: 0.4 }, 0.6);
await goNear({ x: 0, z: 3.9 }, 0.6);
await goNear({ x: -3.4, z: 3.1 }, 0.6);
await goNear(ASHTRAY, 1.3);
await examine(ASHTRAY);
await goNear({ x: 0, z: 3.9 }, 0.7);
await goNear({ x: 2.6, z: 0.6 }, 0.7);
await goNear(REPORT, 1.3);
await examine(REPORT);
const clues = infos.filter((l) => l.includes('indice decouvert'));
r('cendrier et rapport enregistres', clues.length >= 2, clues.join(' | '));

console.log('\n=== 4. LA LISTE DES ELEMENTS ===');
await talkToGreco();
d = await dlg();
r("l'option « Présenter » est apparue", d.hasPresent);
await page.click('#dialogue-present');
await page.waitForTimeout(400);
d = await dlg();
const ev = d.choices.filter((c) => c.evidence);
r('les indices ramasses sont proposes', ev.length >= 2, ev.map((e) => e.label).join(' | '));
r('ils portent la rubrique « indice »', ev.every((e) => e.category.includes('indice')),
  ev.map((e) => e.category).join(', '));
r('un retour aux questions est propose', d.hasBack);
await page.click('#dialogue-back');
await page.waitForTimeout(350);
r('le retour ramene bien aux questions', (await dlg()).choices.some((c) => c.topic));

console.log('\n=== 5. REACTION GENERIQUE ET COUT LEGER ===');
const before = await ch();
// Le rapport n'a pas encore de reaction : il n'a pas parle de la machine.
const generic = await present('clue:report');
r('il repond quand meme', generic.length >= 1, `"${(generic[0] ?? '').slice(0, 55)}"`);
r('la reponse est la reponse generique',
  generic.some((l) => l.includes('ne me dit rien') || l.includes('au hasard')),
  `"${(generic[0] ?? '').slice(0, 55)}"`);
const afterGeneric = await ch();
r('il se ferme d\'un cran', before.mood === 'neutral' && afterGeneric.mood === 'guarded',
  `${before.mood} -> ${afterGeneric.mood}`);
d = await dlg();
r('AUCUNE question n\'a disparu : rien n\'est bloque', d.choices.filter((c) => c.topic).length >= 4,
  `${d.choices.filter((c) => c.topic).length} questions encore posables`);

console.log('\n=== 6. LA MEME PREUVE, AU BON MOMENT, DEVIENT SPECIFIQUE ===');
// Il faut d'abord qu'il ait nie que quelqu'un soit reste.
await ask('greco_after_closing');
const specific = await present('clue:ashtray');
r('la reaction est cette fois specifique',
  specific.some((l) => l.includes('mégot')) || specific.some((l) => l.includes('repassé')),
  specific.map((l) => l.slice(0, 40)).join(' / '));
r('il change de version',
  specific.some((l) => l.includes('Cinq minutes') || l.includes('repassé')),
  `"${specific[specific.length - 1]?.slice(0, 60)}"`);
d = await dlg();
r('une question masquee s\'est ouverte', d.choices.some((c) => c.topic === 'greco_who_came_back'),
  d.choices.map((c) => c.topic).filter(Boolean).join(', '));

console.log('\n=== 7. LES DEUX VERSIONS SONT CONSERVEES ===');
await page.click('#dialogue-present');
await page.waitForTimeout(400);
d = await dlg();
const statements = d.choices.filter((c) => c.evidence?.startsWith('statement:'));
const ids = statements.map((s) => s.evidence);
r('les declarations entendues sont presentables', statements.length >= 2,
  `${statements.length} declarations`);
r('la 1re version est conservee', ids.includes('statement:greco_nobody_stayed'));
r('la 2e version est conservee aussi', ids.includes('statement:greco_admits_stayed'));
r('aucune des deux n\'est marquee comme fausse',
  statements.every((s) => !/ment|faux|contradiction/i.test(s.category + s.classes)),
  statements.map((s) => s.category).join(' | '));

console.log('\n=== 8. PRESENTER UNE DECLARATION ENTENDUE ===');
// Encore faut-il qu'il ait donne cette version : on la lui fait dire d'abord.
await page.click('#dialogue-back').catch(() => {});
await page.waitForTimeout(300);
await ask('greco_evening');
const onOwnWords = await present('statement:greco_closed_2130');
r('il reagit a ses propres mots', onOwnWords.length >= 2,
  onOwnWords.map((l) => l.slice(0, 40)).join(' / '));
r('il nuance sa version', onOwnWords.some((l) => l.includes('pendule') || l.includes('dix heures')),
  `"${onOwnWords[onOwnWords.length - 1]?.slice(0, 60)}"`);

console.log('\n=== 9. ELEMENT DEJA MONTRE : SIGNALE, PAS INTERDIT ===');
await page.click('#dialogue-present');
await page.waitForTimeout(400);
d = await dlg();
const shown = d.choices.find((c) => c.evidence === 'clue:ashtray');
r('l\'element deja montre est signale', (shown?.category ?? '').includes('déjà montré'),
  shown?.category ?? 'introuvable');
r('il reste tout de meme presentable', !!shown);
await page.click('#dialogue-back');
await page.waitForTimeout(300);

console.log('\n=== 10. ANTI-DIVULGATION ===');
/* On retire les accents AVANT de chercher. En JavaScript, une lettre
   accentuee n'est pas un caractere de mot : « élément » contiendrait
   donc « ment » entoure de frontieres de mots, et declencherait une
   fausse alerte. Sans accents, « element » ne piege plus rien. */
const strip = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const text = strip(await visibleText());
const leaks = FORBIDDEN.filter((w) => new RegExp(`\\b${strip(w)}\\b`).test(text));
r('aucun terme interne ni jugement a l\'ecran', leaks.length === 0,
  leaks.length ? 'FUITE : ' + leaks.join(', ') : `${FORBIDDEN.length} termes verifies`);
await page.click('#dialogue-present');
await page.waitForTimeout(400);
const markup = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.dialogue-choice[data-evidence]')];
  return items.map((b) => b.className + '|' + (b.querySelector('.choice-category')?.className ?? ''));
});
const uniques = new Set(markup.map((m) => m.replace(/\s+/g, ' ')));
r('tous les elements partagent le meme balisage', uniques.size <= 2,
  `${uniques.size} variante(s) : ${[...uniques].join(' || ')}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

console.log('\n=== 11. RACCOURCIS CLAVIER ===');
d = await dlg();
r('on est revenu aux questions', d.choices.some((c) => c.topic));
await page.keyboard.press('KeyP');
await page.waitForTimeout(400);
r('la touche P ouvre la liste des elements', (await dlg()).hasBack);
await page.keyboard.press('Escape');
await page.waitForTimeout(350);
r('Echap revient aux questions, sans quitter', (await dlg()).open && (await dlg()).choices.some((c) => c.topic));
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
r('un second Echap termine l\'entretien', !(await dlg()).open);

console.log('\n=== 12. ERREURS ET AVERTISSEMENTS ===');
r('aucune erreur JavaScript', errs.length === 0, errs.slice(0, 2).join(' | ') || 'aucune');
r('aucun avertissement', warns.length === 0, warns.slice(0, 2).join(' | ') || 'aucun');
await browser.close();
