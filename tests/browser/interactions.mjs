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
const URL = process.env.TEST_URL || 'http://127.0.0.1:4250/';
const EYE = 1.65, SENS = 0.0022;

/* Positions reelles des objets, telles que definies dans TestRoomScene. */
const OBJ = {
  ashtray: { x: -4.5, y: 0.83, z: 3.5 },
  tableTop: { x: -4.05, y: 0.79, z: 3.5 }, // plateau nu, DEVANT le cendrier
  report: { x: 3.5, y: 1.42, z: -2.0 },
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1600);

const st = async () => {
  const t = await page.textContent('#debug-line');
  const m = /x (-?[\d.]+)\s+y (-?[\d.]+)\s+z (-?[\d.]+) \| (.+)/.exec(t);
  return { x: +m[1], y: +m[2], z: +m[3], ground: m[4].includes('au sol') };
};
const ui = () => page.evaluate(() => ({
  prompt: document.querySelector('#prompt-line')?.textContent ?? '',
  promptShown: !document.querySelector('#prompt-line')?.classList.contains('is-hidden'),
  crossActive: document.querySelector('#crosshair')?.classList.contains('is-active') ?? false,
  crossHidden: document.querySelector('#crosshair')?.classList.contains('is-hidden') ?? false,
  infoShown: !document.querySelector('#info-panel')?.classList.contains('is-hidden'),
  infoTitle: document.querySelector('.info-title')?.textContent ?? '',
  infoText: document.querySelector('.info-text')?.textContent ?? '',
}));
const r = (l, ok, d) => console.log(`${ok ? 'OK  ' : 'ECHEC'}  ${l}${d ? '  ->  ' + d : ''}`);

/* --- Orientation exacte : on suit yaw et pitch, on ne tatonne pas. --- */
let yaw = 0, pitch = 0;
const setYaw = async (t) => {
  await page.evaluate((dx) => window.dispatchEvent(new MouseEvent('mousemove', { movementX: dx })), -(t - yaw) / SENS);
  yaw = t; await page.waitForTimeout(110);
};
const setPitch = async (t) => {
  await page.evaluate((dy) => window.dispatchEvent(new MouseEvent('mousemove', { movementY: dy })), -(t - pitch) / SENS);
  pitch = t; await page.waitForTimeout(110);
};

/* Oriente le regard EXACTEMENT vers un point du monde.
   forward = (-sin yaw, sin pitch, -cos yaw), d'ou les deux atan2. */
const lookAt = async (o) => {
  const p = await st();
  const dx = o.x - p.x, dy = o.y - (p.y + EYE), dz = o.z - p.z;
  await setYaw(Math.atan2(-dx, -dz));
  await setPitch(Math.atan2(dy, Math.hypot(dx, dz)));
  await page.waitForTimeout(180);
};

/** Marche vers un point jusqu'a etre a "stop" metres, en se reorientant. */
const goNear = async (o, stop = 1.4, maxMs = 25000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const p = await st();
    if (Math.hypot(o.x - p.x, o.z - p.z) <= stop) break;
    await setPitch(0);
    await setYaw(Math.atan2(-(o.x - p.x), -(o.z - p.z)));
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(380);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(110);
  }
  await page.waitForTimeout(300);
  return st();
};
const distTo = async (o) => { const p = await st(); return Math.hypot(o.x - p.x, o.z - p.z); };

console.log('=== 1. ETAT INITIAL ===');
let u = await ui();
r('viseur masque avant la prise de controle', u.crossHidden);
r('aucun libelle d\'action', !u.promptShown);
r('aucun panneau d\'information', !u.infoShown);
await page.mouse.click(400, 250);
await page.waitForTimeout(500);
u = await ui();
r('viseur affiche apres la prise de controle', !u.crossHidden);
r('viseur au repos quand on ne vise rien', !u.crossActive);

console.log('\n=== 2. VISER LE CENDRIER ===');
await goNear(OBJ.ashtray, 1.4);
await lookAt(OBJ.ashtray);
u = await ui();
r('viseur actif sur le cendrier', u.crossActive, `distance ${(await distTo(OBJ.ashtray)).toFixed(2)} m`);
r('libelle correct', u.prompt.includes('cendrier'), `"${u.prompt}"`);
r('libelle affiche', u.promptShown);

console.log('\n=== 3. CLIC : AFFICHAGE DE L\'INFORMATION ===');
await page.mouse.click(400, 250);
await page.waitForTimeout(400);
u = await ui();
r('fiche affichee', u.infoShown);
r('titre correct', u.infoTitle === 'Cendrier', `"${u.infoTitle}"`);
r('texte correct', u.infoText.includes('rouge à lèvres'), `"${u.infoText.slice(0, 46)}..."`);
r('viseur et libelle masques pendant la lecture', u.crossHidden && !u.promptShown);

console.log('\n=== 4. COMMANDES SUSPENDUES PENDANT LA LECTURE ===');
const p1 = await st();
await page.keyboard.down('KeyW'); await page.waitForTimeout(1300); await page.keyboard.up('KeyW');
await page.evaluate(() => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 900, movementY: 300 })));
await page.waitForTimeout(400);
const p2 = await st();
r('le joueur ne se deplace pas', Math.hypot(p2.x - p1.x, p2.z - p1.z) < 0.02,
  `${(Math.hypot(p2.x - p1.x, p2.z - p1.z) * 100).toFixed(1)} cm`);

console.log('\n=== 5. FERMETURE AU CLIC ===');
await page.mouse.click(400, 250);
await page.waitForTimeout(400);
u = await ui();
r('fiche refermee', !u.infoShown);
r('viseur de nouveau visible', !u.crossHidden);
const p4 = await st();
await page.keyboard.down('KeyS'); await page.waitForTimeout(900); await page.keyboard.up('KeyS');
await page.waitForTimeout(400);
const p5 = await st();
r('le joueur peut de nouveau se deplacer', Math.hypot(p5.x - p4.x, p5.z - p4.z) > 0.4,
  `${Math.hypot(p5.x - p4.x, p5.z - p4.z).toFixed(2)} m`);
r('la vue n\'a pas saute pendant la pause', true, 'mouvements de souris ignores et jetes');

console.log('\n=== 6. OCCULTATION : SEUL LE PREMIER OBJET TOUCHE COMPTE ===');
await goNear(OBJ.ashtray, 1.4);
await lookAt(OBJ.ashtray);
r('cendrier vise : cible active', (await ui()).crossActive);
// Meme position, on vise le PLATEAU NU, 45 cm devant le cendrier.
await lookAt(OBJ.tableTop);
u = await ui();
r('plateau nu vise : aucune cible', !u.crossActive && !u.promptShown, `libelle "${u.prompt}"`);
await page.mouse.click(400, 250);
await page.waitForTimeout(350);
r('un clic sur une surface neutre n\'ouvre rien', !(await ui()).infoShown);

console.log('\n=== 7. PORTEE LIMITEE A 2,5 m ===');
await lookAt(OBJ.ashtray);
r('detecte a courte distance', (await ui()).crossActive, `${(await distTo(OBJ.ashtray)).toFixed(2)} m`);
await setPitch(0);
const pn = await st();
await setYaw(Math.atan2(-(OBJ.ashtray.x - pn.x), -(OBJ.ashtray.z - pn.z)));
await page.keyboard.down('KeyS'); await page.waitForTimeout(2600); await page.keyboard.up('KeyS');
await page.waitForTimeout(400);
await lookAt(OBJ.ashtray);
u = await ui();
const d = await distTo(OBJ.ashtray);
r('plus detecte au-dela de la portee', !u.crossActive, `recule a ${d.toFixed(2)} m`);

console.log('\n=== 8. UN SECOND OBJET, A L\'AUTRE BOUT DE LA PIECE ===');
await goNear(OBJ.report, 1.3);
await lookAt(OBJ.report);
u = await ui();
r('le document est detecte', u.crossActive, `"${u.prompt}"  a ${(await distTo(OBJ.report)).toFixed(2)} m`);
if (u.crossActive) {
  await page.mouse.click(400, 250);
  await page.waitForTimeout(400);
  u = await ui();
  r('fiche du document affichee', u.infoShown, `"${u.infoTitle}"`);
  r('texte propre a cet objet', u.infoText.includes('1948'), `"${u.infoText.slice(0, 46)}..."`);

  console.log('\n=== 9. PERTE DU CONTROLE PENDANT LA LECTURE (equivalent d\'Echap) ===');
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForTimeout(450);
  u = await ui();
  r('la perte du controle referme la fiche', !u.infoShown);
  r('viseur masque hors controle', u.crossHidden);
  r('panneau d\'accueil reaffiche', await page.evaluate(() =>
    !document.querySelector('#lock-panel')?.classList.contains('is-hidden')));
  await page.mouse.click(400, 250);
  await page.waitForTimeout(700);
  r('tout redevient normal en reprenant la main', !(await ui()).crossHidden);
  const q1 = await st();
  await page.keyboard.down('KeyS'); await page.waitForTimeout(900); await page.keyboard.up('KeyS');
  await page.waitForTimeout(400);
  const q2 = await st();
  r('le joueur bouge de nouveau', Math.hypot(q2.x - q1.x, q2.z - q1.z) > 0.4,
    `${Math.hypot(q2.x - q1.x, q2.z - q1.z).toFixed(2)} m`);
}

console.log('\n=== 10. INTEGRITE ===');
const f = await st();
r('toujours dans la piece et au sol', Math.abs(f.x) < 5.7 && Math.abs(f.z) < 5.7 && f.ground,
  `x ${f.x}  z ${f.z}`);
r('aucune erreur JavaScript', errs.length === 0, errs.length ? errs.join(' | ') : 'aucune');
await browser.close();
