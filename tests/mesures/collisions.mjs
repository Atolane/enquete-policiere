/* ===================================================================
   CECI N'EST PAS UN TEST.

   Ce fichier produit des NOMBRES a lire, pas un verdict. Distances
   parcourues, images par seconde, cout des personnages : tout cela
   depend de la machine, du navigateur et de la charge du moment.

   Il ne compte donc pas dans la non-regression, et aucun script ne le
   lance automatiquement. Voir tests/README.md.

   Prerequis : Playwright, qui n'est PAS une dependance du projet.
   =================================================================== */

import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
// Petite fenetre : le rendu logiciel de ce conteneur est lent, on reduit la
// charge graphique pour se rapprocher d'une cadence realiste.
const page = await browser.newPage({ viewport: { width: 480, height: 300 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text());
  if (m.type() === 'info' && m.text().includes('triangles')) console.log('   ' + m.text());
});

await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4250/', { waitUntil: 'load' });
await page.waitForTimeout(1500);

const st = async () => {
  const t = await page.textContent('#debug-line');
  const m = /([\d.]+) img\/s \| x (-?[\d.]+)\s+y (-?[\d.]+)\s+z (-?[\d.]+) \| (.+)/.exec(t ?? '');
  return { fps: +m[1], x: +m[2], y: +m[3], z: +m[4], ground: m[5].includes('au sol'), raw: t };
};
const r = (l, ok, d) => console.log(`${ok ? 'OK  ' : 'ECHEC'}  ${l}${d ? '  ->  ' + d : ''}`);

/* --- Orientation : on suit le yaw exactement, au lieu de tatonner. ---
   applyMouseDelta fait yaw -= dx * 0.0022, donc pour viser un yaw cible
   on envoie dx = -(cible - actuel) / 0.0022.
   forward = (-sin yaw, 0, -cos yaw)  =>  0 : -Z | +PI/2 : -X | -PI/2 : +X | PI : +Z */
let yaw = 0;
const YAW = { nord: 0, ouest: Math.PI / 2, est: -Math.PI / 2, sud: Math.PI };
async function face(name) {
  const target = YAW[name];
  await page.evaluate((dx) => window.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: 0 })),
    -(target - yaw) / 0.0022);
  yaw = target;
  await page.waitForTimeout(120);
}
async function turnBy(deg) {
  const target = yaw + (deg * Math.PI) / 180;
  await page.evaluate((dx) => window.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: 0 })),
    -(target - yaw) / 0.0022);
  yaw = target;
  await page.waitForTimeout(120);
}

/** Avance par petites salves jusqu'a ce que la condition soit vraie. */
async function walkUntil(done, maxMs = 12000, run = false) {
  const t0 = Date.now();
  let peakY = (await st()).y;
  if (run) await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  let s = await st();
  while (Date.now() - t0 < maxMs && !done(s)) {
    await page.waitForTimeout(250);
    s = await st();
    peakY = Math.max(peakY, s.y);
  }
  await page.keyboard.up('KeyW');
  if (run) await page.keyboard.up('ShiftLeft');
  await page.waitForTimeout(450);
  const final = await st();
  return { ...final, peakY, reached: done(final), elapsed: Date.now() - t0 };
}

console.log('=== 0. GEOMETRIE DE COLLISION ===');
await page.mouse.click(240, 150);
await page.waitForTimeout(400);
const start = await st();
r('depart correct et au sol', Math.abs(start.x) < 0.01 && Math.abs(start.z - 4) < 0.01 && start.ground, start.raw);
console.log(`   cadence de test : ${start.fps.toFixed(0)} img/s`);

console.log('\n=== 1. STABILITE AU REPOS (absence de tremblement) ===');
const ys = [];
for (let i = 0; i < 6; i++) { await page.waitForTimeout(250); ys.push((await st()).y); }
r('hauteur parfaitement stable', Math.max(...ys) - Math.min(...ys) < 0.002,
  `amplitude ${(Math.max(...ys) - Math.min(...ys)).toFixed(5)} m`);

console.log('\n=== 2. RAMPE INCLINEE (13 degres, cote est) ===');
await face('est');
const ramp = await walkUntil((s) => s.x > 5.2, 14000);
r('monte la rampe jusqu\'au palier', ramp.peakY > 0.65, `sommet atteint : y = ${ramp.peakY} m (attendu ~0.70)`);
r('bloque par le mur est', ramp.x > 5.2, `x = ${ramp.x}`);
r('au sol en haut', ramp.ground, ramp.raw);
console.log(`   duree : ${(ramp.elapsed / 1000).toFixed(1)} s pour ~7 m  |  ${ramp.fps.toFixed(0)} img/s`);

console.log('\n=== 3. DESCENTE ET RETOUR AU SOL ===');
await face('ouest');
const back = await walkUntil((s) => s.x < 0.3 && s.y < 0.02, 14000);
r('redescend et se repose au sol', Math.abs(back.y) < 0.002 && back.ground, back.raw);

console.log('\n=== 4. PASSAGE ETROIT (90 cm pour un joueur de 70 cm) ===');
await face('nord');
const gap = await walkUntil((s) => s.z < -2.8, 14000);
r('a franchi l\'ouverture', gap.z < -2.8, `z ${back.z.toFixed(2)} -> ${gap.z.toFixed(2)} (obstacle a z = 1.8)`);
r('n\'a pas ete devie', Math.abs(gap.x) < 0.8, `x = ${gap.x}`);

console.log('\n=== 5. ESCALIER DE 5 MARCHES (17 cm par marche) ===');
await face('ouest');
const up = await walkUntil((s) => s.x < -4.5, 16000);
r('gravit les 5 marches', up.y > 0.82 && up.y < 0.90, `y = ${up.y} m (plateforme a 0.85)`);
r('au sol sur la plateforme', up.ground, up.raw);
r('bloque par le mur ouest', up.x < -4.5, `x = ${up.x}`);

console.log('\n=== 6. DESCENTE DE L\'ESCALIER ===');
await face('est');
const down = await walkUntil((s) => s.y < 0.02 && s.x > -1.5, 16000);
r('redescend marche par marche jusqu\'au sol', Math.abs(down.y) < 0.002 && down.ground, down.raw);

console.log('\n=== 7. OBSTACLE ISOLE (caisse de 1,4 m) ===');
await face('sud');
await walkUntil((s) => s.z > -2.2, 8000);
await face('est');
const crate = await walkUntil((s) => s.x > 2.0, 10000, true);
r('arrete par la caisse, jamais traversee', crate.x < 2.9,
  `x = ${crate.x} (face avant de la caisse a 2.45)`);
r('toujours au sol', crate.ground, crate.raw);

console.log('\n=== 8. GLISSEMENT LE LONG D\'UN MUR ===');
await face('ouest');
await walkUntil((s) => s.x < 0.2, 8000, true);   // revient au centre, hors des caisses
await face('nord');
const wallA = await walkUntil((s) => s.z < -5.6, 14000, true);
r('plaque contre le mur nord', Math.abs(wallA.z + 5.65) < 0.03, `z = ${wallA.z}`);
await turnBy(-35);
await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
await page.waitForTimeout(3000);
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
await page.waitForTimeout(400);
const wallB = await st();
r('glisse le long du mur au lieu de se bloquer', Math.abs(wallB.x - wallA.x) > 0.8,
  `x ${wallA.x.toFixed(2)} -> ${wallB.x.toFixed(2)}`);
r('ne traverse pas le mur en glissant', Math.abs(wallB.z + 5.65) < 0.03, `z = ${wallB.z}`);

console.log('\n=== 9. INTEGRITE FINALE ===');
const f = await st();
r('jamais passe sous le decor', f.y > -0.01, `y = ${f.y}`);
r('toujours dans la piece', Math.abs(f.x) < 5.7 && Math.abs(f.z) < 5.7, `x = ${f.x}  z = ${f.z}`);
r('aucune erreur JavaScript', errs.length === 0, errs.length ? errs.join(' | ') : 'aucune');

await browser.close();
