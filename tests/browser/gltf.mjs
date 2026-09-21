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
const CAM = { x: -2.1, y: 0.9, z: 2.6 };   // position du modele charge

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 520 } });
const errs = [], infos = [], warns = [], reqs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text());
  if (m.type() === 'warning') warns.push(m.text());
  if (m.type() === 'info') infos.push(m.text());
});
page.on('response', (r) => { if (r.url().includes('.glb')) reqs.push(`${r.status()} ${r.url().split('/').pop()}`); });

const r = (l, ok, d) => console.log(`${ok ? 'OK  ' : 'ECHEC'}  ${l}${d ? '  ->  ' + d : ''}`);
const t0 = Date.now();
await page.goto(URL, { waitUntil: 'load' });

console.log('=== 1. ECRAN DE CHARGEMENT ===');
// L'ecran doit exister des le depart (avant la fin du telechargement).
const hadScreen = await page.evaluate(() => !!document.querySelector('#loading-screen'));
r('ecran de chargement present', hadScreen);

await page.waitForFunction(
  () => document.querySelector('#loading-screen')?.classList.contains('is-hidden'),
  { timeout: 30000 },
);
const loadMs = Date.now() - t0;
r('ecran masque une fois le chargement termine', true, `${(loadMs / 1000).toFixed(1)} s`);
const barWidth = await page.evaluate(() => document.querySelector('.loading-bar')?.style.width);
r('barre de progression a 100 %', barWidth === '100%', `largeur ${barWidth}`);

console.log('\n=== 2. TELECHARGEMENT DU MODELE ===');
r('le .glb a bien ete demande et servi', reqs.some((x) => x.startsWith('200')), reqs.join(', '));

console.log('\n=== 3. RAPPORT D\'INTEGRATION (console) ===');
const report = infos.find((l) => l.includes('[modele]'));
r('rapport de modele affiche', !!report, report ?? 'absent');
const collisions = infos.find((l) => l.includes('[collisions]'));
r('collisions reconstruites apres chargement', !!collisions, collisions ?? 'absent');

console.log('\n=== 4. LE MODELE EST REELLEMENT DANS LA SCENE ===');
await page.waitForTimeout(1200);
const st = async () => {
  const t = await page.textContent('#debug-line');
  const m = /x (-?[\d.]+)\s+y (-?[\d.]+)\s+z (-?[\d.]+) \| (.+)/.exec(t);
  return { x: +m[1], y: +m[2], z: +m[3], ground: m[4].includes('au sol') };
};
const ui = () => page.evaluate(() => ({
  prompt: document.querySelector('#prompt-line')?.textContent ?? '',
  crossActive: document.querySelector('#crosshair')?.classList.contains('is-active') ?? false,
  infoShown: !document.querySelector('#info-panel')?.classList.contains('is-hidden'),
  infoTitle: document.querySelector('.info-title')?.textContent ?? '',
  infoText: document.querySelector('.info-text')?.textContent ?? '',
}));
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
    await page.keyboard.down('KeyW'); await page.waitForTimeout(360); await page.keyboard.up('KeyW'); await page.waitForTimeout(100); }
  await page.waitForTimeout(300); return st(); };

await page.mouse.click(450, 260);
await page.waitForTimeout(500);

console.log('\n=== 5. COLLISION AVEC LE MODELE CHARGE ===');
const approach = await goNear(CAM, 0.55, 22000);
const dist = Math.hypot(CAM.x - approach.x, CAM.z - approach.z);
r('le joueur est arrete par le trepied', dist > 0.35 && dist < 1.4,
  `arrete a ${dist.toFixed(2)} m du centre du modele`);
r('toujours au sol', approach.ground);

console.log('\n=== 6. LE MODELE EST OBSERVABLE ===');
await lookAt(CAM);
let u = await ui();
r('le viseur detecte l\'appareil photo', u.crossActive, `"${u.prompt}"`);
if (u.crossActive) {
  await page.mouse.click(450, 260);
  await page.waitForTimeout(400);
  u = await ui();
  r('fiche affichee', u.infoShown, `"${u.infoTitle}"`);
  r('texte propre au modele', u.infoText.includes('soufflet'), `"${u.infoText.slice(0, 44)}..."`);
  await page.mouse.click(450, 260);
  await page.waitForTimeout(300);
}

console.log('\n=== 7. PIXELS REELLEMENT DESSINES (le modele n\'est pas invisible) ===');
await lookAt(CAM);
const shot = await page.screenshot({ path: process.argv[2] + '/3-modele.png' });
r('capture produite', shot.length > 10000, `${(shot.length / 1024).toFixed(0)} Ko`);

console.log('\n=== 8. AVERTISSEMENTS ET ERREURS ===');
r('aucune erreur JavaScript', errs.length === 0, errs.length ? errs.join(' | ') : 'aucune');
const scaleWarn = warns.find((w) => w.includes('echelle') || w.includes('modele'));
r('aucun avertissement d\'echelle apres mise a l\'echelle', !scaleWarn, scaleWarn ?? 'aucun');
if (warns.length) console.log('   (autres avertissements : ' + warns.slice(0, 3).join(' | ') + ')');

await browser.close();
