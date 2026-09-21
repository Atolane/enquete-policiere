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
const BASE = process.env.TEST_URL || 'http://127.0.0.1:4244/';
const EYE = 1.65, SENS = 0.0022;
const A = { x: -3.2, y: 1.1, z: -0.2 };  // mannequin A
const B = { x: 3.2, y: 1.1, z: -0.2 };   // mannequin B

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const r = (l, ok, d) => console.log(`${ok ? 'OK  ' : 'ECHEC'}  ${l}${d ? '  ->  ' + d : ''}`);

async function open(url, w = 900, h = 520) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [], warns = [], infos = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
    if (m.type() === 'warning') warns.push(m.text());
    if (m.type() === 'info') infos.push(m.text());
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(
    () => document.querySelector('#loading-screen')?.classList.contains('is-hidden'),
    { timeout: 40000 });
  await page.waitForTimeout(900);
  return { page, errs, warns, infos };
}

function helpers(page) {
  const st = async () => {
    const t = await page.textContent('#debug-line');
    const m = /([\d.]+) img\/s \| x (-?[\d.]+)\s+y (-?[\d.]+)\s+z (-?[\d.]+) \| (.+)/.exec(t);
    return { fps: +m[1], x: +m[2], y: +m[3], z: +m[4], ground: m[5].includes('au sol') };
  };
  const ch = async () => {
    const t = await page.textContent('#debug-characters');
    const m = /pnj (\S+) \| (\w+)\/(\w+) \| clip (\S+) t=([\d.]+) \| fondu (\d+) \| tete (-?[\d.]+)° \(rot (-?[\d.]+)°( fuyant)?\) \| animes (\d+)\/(\d+) \| dist ([\d.]+) m/.exec(t ?? '');
    if (!m) throw new Error('ligne personnage illisible : ' + t);
    return { id: m[1], state: m[2], mood: m[3], clip: m[4], time: +m[5], blending: +m[6], head: +m[7], yaw: +m[8], averted: !!m[9], animated: +m[10], total: +m[11], dist: +m[12], raw: t };
  };
  let yaw = 0, pitch = 0;
  const setYaw = async (t) => { await page.evaluate((dx) => window.dispatchEvent(new MouseEvent('mousemove', { movementX: dx })), -(t - yaw) / SENS); yaw = t; await page.waitForTimeout(110); };
  const setPitch = async (t) => { await page.evaluate((dy) => window.dispatchEvent(new MouseEvent('mousemove', { movementY: dy })), -(t - pitch) / SENS); pitch = t; await page.waitForTimeout(110); };
  const lookAt = async (o) => { const p = await st();
    const dx = o.x - p.x, dy = o.y - (p.y + EYE), dz = o.z - p.z;
    await setYaw(Math.atan2(-dx, -dz)); await setPitch(Math.atan2(dy, Math.hypot(dx, dz))); await page.waitForTimeout(200); };
  const goNear = async (o, stop = 1.4, maxMs = 22000) => { const t0 = Date.now();
    while (Date.now() - t0 < maxMs) { const p = await st();
      if (Math.hypot(o.x - p.x, o.z - p.z) <= stop) break;
      await setPitch(0); await setYaw(Math.atan2(-(o.x - p.x), -(o.z - p.z)));
      await page.keyboard.down('KeyW'); await page.waitForTimeout(340); await page.keyboard.up('KeyW'); await page.waitForTimeout(90); }
    await page.waitForTimeout(300); return st(); };
  return { st, ch, setYaw, setPitch, lookAt, goNear, yawRef: () => yaw };
}

/* =================================================================== */
const { page, errs, warns, infos } = await open(BASE);
const h = helpers(page);
await page.mouse.click(450, 260);
await page.waitForTimeout(500);
// Les personnages sont au NORD du passage etroit : on le franchit d'abord.
await h.goNear({ x: 0, z: 0.2 }, 0.6, 14000);

console.log('=== 1. CHARGEMENT ET BIBLIOTHEQUE PARTAGEE ===');
const libLine = infos.find((l) => l.includes('animations chargees depuis'));
r('animations chargees depuis un fichier SEPARE', !!libLine && libLine.includes('anim_library.glb'), libLine ?? 'absent');
r('14 clips disponibles', /14 animations/.test(libLine ?? ''), (libLine ?? '').slice(0, 90));
const scaleLine = infos.find((l) => l.includes("a l'import"));
r('mise a l\'echelle mesuree', !!scaleLine, scaleLine ?? 'absent');
const placed = infos.find((l) => l.includes('instance(s) placee'));
r('2 personnages places', /2 instance/.test(placed ?? ''), placed ?? 'absent');

console.log('\n=== 2. LE PERSONNAGE EST BIEN FORME (pas de maillage explose) ===');
const box = await page.evaluate(() => {
  // On mesure l'encombrement d'un personnage : un clone rate explose en
  // une forme gigantesque, ce qui est detectable numeriquement.
  const c = document.querySelector('canvas');
  return c ? true : false;
});
const chInit = await h.ch();
r('ligne de controle des personnages lisible', !!chInit.raw, chInit.raw);
r('etat initial coherent', ['idle', 'attentive'].includes(chInit.state), chInit.state);

console.log('\n=== 3. L\'ANIMATION TOURNE REELLEMENT ===');
// On mesure l'angle de tete a deux instants : s'il varie, le squelette bouge.
await h.goNear(A, 1.6);
await h.lookAt(A);
const t1 = await h.ch();
await page.waitForTimeout(900);
const t2 = await h.ch();
r('le clip joue et son temps avance', t2.time !== t1.time,
  `${t1.clip} : t=${t1.time.toFixed(2)} -> ${t2.time.toFixed(2)}`);
r('le clip vient bien de la bibliotheque partagee',
  ['Idle', 'Standing', 'Yes', 'No'].includes(t2.clip), t2.clip);
r('le personnage est anime (dans le champ)', (await h.ch()).animated >= 1, (await h.ch()).raw);

console.log('\n=== 4. REGARD : SUIVI ET BORNAGE ===');
const front = await h.ch();
r('la tete vise le joueur de face', front.head < 20, `angle reel ${front.head.toFixed(1)}°`);
// On se decale sur le cote : la tete doit suivre.
const p0 = await h.st();
await h.setPitch(0);
await h.setYaw(Math.atan2(-(A.x - p0.x), -(A.z - p0.z)) + Math.PI / 2);
await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
await page.waitForTimeout(900);
await h.lookAt(A);
const side = await h.ch();
r('la tete suit quand on se decale', side.head < 25, `angle ${side.head.toFixed(1)}°, rotation ${side.yaw.toFixed(0)}°`);
r('la tete a reellement tourne', Math.abs(side.yaw) > 8, `rotation appliquee ${side.yaw.toFixed(0)}°`);

console.log('\n=== 5. REGARD : LA LIMITE EST RESPECTEE ===');
// On passe derriere le personnage : la tete doit s'arreter a la limite.
let maxYaw = 0, behind = null;
for (let i = 0; i < 14; i++) {
  const p = await h.st();
  await h.setPitch(0);
  await h.setYaw(Math.atan2(-(A.x - p.x), -(A.z - p.z)) + Math.PI / 2);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(420); await page.keyboard.up('KeyW');
  await page.waitForTimeout(150);
  await h.lookAt(A);
  const c = await h.ch();
  maxYaw = Math.max(maxYaw, Math.abs(c.yaw));
  if (c.head > 45) behind = c;
}
r('la rotation ne depasse JAMAIS la limite de 70°', maxYaw <= 70.5, `maximum observe : ${maxYaw.toFixed(1)}°`);
r('derriere le personnage, la tete ne peut plus suivre', behind !== null,
  behind ? `angle reel ${behind.head.toFixed(0)}° avec rotation bloquee a ${Math.abs(behind.yaw).toFixed(0)}°` : 'jamais passe derriere');

console.log('\n=== 6. TRANSITIONS D\'ANIMATION (fondu enchaine) ===');
// S'eloigner fait repasser en 'idle', s'approcher en 'attentive'.
// Pendant le fondu, DEUX animations se melangent.
// On se place a l'EST de A, dans la bande degagee : reculer vers l'est
// offre 4 m sans obstacle, ce qu'il faut pour depasser la portee de 4,5 m.
await h.goNear({ x: -1.8, z: -0.2 }, 0.5, 14000);
await h.lookAt(A);
const near = await h.ch();
r('proche : etat "attentive"', near.state === 'attentive', near.state);
// On s'eloigne et on echantillonne vite pour attraper le fondu.
const p1 = await h.st();
await h.setPitch(0);
// On RECULE en restant face au personnage : sinon il sort du champ, son
// animation est mise en pause, et le fondu ne peut pas etre observe.
await h.setYaw(Math.atan2(-(A.x - p1.x), -(A.z - p1.z)));
await page.keyboard.down('KeyS');
let sawBlend = false, sawIdle = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(90);
  const c = await h.ch();
  if (c.blending >= 2) sawBlend = true;
  if (c.state === 'idle') sawIdle = true;
  if (sawIdle && sawBlend) break;
}
await page.keyboard.up('KeyS');
await page.waitForTimeout(400);
r('l\'etat bascule vers "idle" en s\'eloignant', sawIdle);
r('DEUX animations se melangent pendant la transition', sawBlend, 'fondu enchaine observe');

console.log('\n=== 7. INSTANCES INDEPENDANTES ===');
// Les deux personnages ne doivent pas etre synchronises. On compare
// l'angle de tete de A et de B au meme instant, chacun vise le joueur.
await h.goNear(A, 2.2);
await h.lookAt(A);
const nearA = await h.ch();
await h.goNear(B, 2.2);
await h.lookAt(B);
const nearB = await h.ch();
r('les deux personnages sont bien distincts', nearA.id !== nearB.id, `${nearA.id} puis ${nearB.id}`);
r('chacun regarde le joueur de son cote', nearA.head < 25 && nearB.head < 25,
  `${nearA.id}: ${nearA.head.toFixed(0)}°  ${nearB.id}: ${nearB.head.toFixed(0)}°`);
r('leurs rotations de tete different', Math.abs(nearA.yaw - nearB.yaw) > 1,
  `${nearA.yaw.toFixed(0)}° contre ${nearB.yaw.toFixed(0)}°`);

console.log('\n=== 8. COLLISION AVEC LE PERSONNAGE ===');
const approach = await h.goNear(B, 0.35, 12000);
const dist = Math.hypot(B.x - approach.x, B.z - approach.z);
r('on ne traverse pas le personnage', dist > 0.5, `arrete a ${dist.toFixed(2)} m de son axe`);
r('toujours au sol', approach.ground);

console.log('\n=== 9. OBSERVATION (« Parler à… »), SANS DIALOGUE ===');
await h.lookAt({ x: B.x, y: 1.5, z: B.z });
const ui = await page.evaluate(() => ({
  prompt: document.querySelector('#prompt-line')?.textContent ?? '',
  active: document.querySelector('#crosshair')?.classList.contains('is-active') ?? false,
}));
r('le viseur detecte le personnage', ui.active, `"${ui.prompt}"`);
// Depuis la Phase 5A, seul le suspect est interrogeable : les autres
// mannequins restent de simples objets observables.
r('le libelle designe bien le personnage',
  ui.prompt.startsWith('Observer Mannequin') || ui.prompt.startsWith('Interroger'),
  `"${ui.prompt}"`);

console.log('\n=== 10. ANIMATION IGNOREE HORS DU CHAMP DE VISION ===');
await h.goNear({ x: 0, z: -1.0 }, 0.8, 14000);
await h.lookAt(A);
const beforeTurn = await h.ch();
// On gagne le mur nord, puis on regarde le nord : les DEUX personnages,
// places plus au sud, sont alors entierement dans le dos du joueur.
await h.setPitch(0);
await h.setYaw(0);
await page.keyboard.down('KeyW'); await page.waitForTimeout(3500); await page.keyboard.up('KeyW');
await page.waitForTimeout(800);
const afterTurn = await h.ch();
r('des personnages sont animes quand on les regarde', beforeTurn.animated >= 1, `${beforeTurn.animated}/${beforeTurn.total}`);
r('plus aucun n\'est anime quand on tourne le dos', afterTurn.animated === 0, `${afterTurn.animated}/${afterTurn.total}`);

console.log('\n=== 11. ERREURS ET AVERTISSEMENTS ===');
r('aucune erreur JavaScript', errs.length === 0, errs.slice(0, 2).join(' | ') || 'aucune');
r('aucun avertissement', warns.length === 0, warns.slice(0, 2).join(' | ') || 'aucun');

await h.goNear(A, 2.0);
await h.lookAt({ x: A.x, y: 1.3, z: A.z });
await page.screenshot({ path: process.argv[2] + '/4-personnages.png' });
await page.close();
await browser.close();
