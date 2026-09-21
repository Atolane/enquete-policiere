/* ===================================================================
   SUITE NAVIGATEUR -- LA PREMIERE TRANCHE DE L'AFFAIRE (Phase 9)

   Elle joue ce qu'un joueur ferait : marcher jusqu'a un indice,
   l'examiner, aller voir le temoin, lui poser une question, ouvrir le
   carnet. C'est la premiere suite qui vise l'affaire reelle et non le
   suspect jetable.

   Contrairement aux huit suites heritees, celle-ci a ete ecrite ET
   rejouee au moment ou elle a ete versee : 16 controles, 0 echec.

   Prerequis, comme les autres :
     npm install --no-save playwright
     npx playwright install chromium
     npm run dev          (dans un autre terminal)
     node tests/browser/affaire.mjs
   =================================================================== */

import { chromium } from 'playwright';

const BASE = process.env.TEST_URL ?? 'http://localhost:5173';
const EYE = 1.65;
const SENS = 0.0022;

/** Ou se trouvent les deux cibles, en metres. */
const VERRE = { x: -4.5, y: 0.83, z: 3.5 };
const NINO = { x: -3.2, y: 1.35, z: -0.2 };

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
  await page.waitForTimeout(110);
};
const setPitch = async (t) => {
  await page.evaluate((dy) => window.dispatchEvent(new MouseEvent('mousemove', { movementY: dy })), -(t - pitch) / SENS);
  pitch = t;
  await page.waitForTimeout(110);
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
const allerVers = async (o, arret, maxMs = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const p = await etat();
    yaw = p.yaw;
    pitch = p.pitch;
    if (Math.hypot(o.x - p.x, o.z - p.z) <= arret) break;
    await setPitch(0);
    await setYaw(Math.atan2(-(o.x - p.x), -(o.z - p.z)));
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(320);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(350);
};

// --- 1. Un indice du bureau -------------------------------------------

await allerVers({ x: 0, z: 0.4 }, 0.6);
await allerVers({ x: 0, z: 3.9 }, 0.6);
await allerVers({ x: -3.4, z: 3.1 }, 0.6);
await allerVers(VERRE, 1.3);
await viser(VERRE);

const invite = await page.textContent('#prompt-line');
check('le viseur annonce le verre', /Examiner le verre/.test(invite), `"${invite}"`);

await page.mouse.click(500, 280);
await page.waitForTimeout(400);
const fiche = await page.evaluate(() => ({
  ouverte: !document.querySelector('#info-panel')?.classList.contains('is-hidden'),
  titre: document.querySelector('.info-title')?.textContent ?? '',
  texte: document.querySelector('.info-text')?.textContent ?? '',
}));
check('la fiche s ouvre sur le bon indice', fiche.ouverte && /verre renvers/i.test(fiche.titre), fiche.titre);
check('elle porte le texte de l affaire', /sous-main/.test(fiche.texte), fiche.texte.slice(0, 50));
await page.mouse.click(500, 280);
await page.waitForTimeout(300);

// --- 2. Le temoin ------------------------------------------------------

{
  const p = await etat();
  yaw = p.yaw;
  pitch = p.pitch;
}
await allerVers({ x: 0, z: 0.2 }, 0.6);
await allerVers(NINO, 1.9);
await viser(NINO);

const invite2 = await page.textContent('#prompt-line');
check('le viseur annonce Nino Restivo', /Interroger Nino Restivo/.test(invite2), `"${invite2}"`);

await page.mouse.click(500, 280);
await page.waitForTimeout(700);

const entete = await page.evaluate(() => ({
  nom: document.querySelector('.dialogue-name')?.textContent ?? '',
  role: document.querySelector('.dialogue-role')?.textContent ?? '',
}));
check('l entretien s ouvre sur Nino Restivo', entete.nom.includes('Nino Restivo'), entete.nom);
check('sa qualite est affichee', /commis/i.test(entete.role), entete.role);

const choix = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.dialogue-choice')].map((e) => ({
      topic: e.dataset.topic ?? '',
      texte: e.querySelector('.choice-label')?.textContent ?? '',
    })),
  );
/** Fait defiler les repliques jusqu'au retour des questions. */
const lire = async (max = 14) => {
  for (let i = 0; i < max; i += 1) {
    if ((await choix()).length > 0) break;
    await page.click('#dialogue-line', { force: true }).catch(() => {});
    await page.waitForTimeout(280);
  }
};

const avant = await choix();
check('les questions sont celles de l affaire', avant.some((o) => o.topic === 'nino_heure'), JSON.stringify(avant.map((o) => o.texte)));
check('la question masquee n est pas encore la', !avant.some((o) => o.topic === 'nino_pourquoi_tot'));

await page.click('.dialogue-choice[data-topic="nino_heure"]');
await page.waitForTimeout(350);
await lire();

const apres = await choix();
check(
  'la question masquee s ouvre apres la reponse',
  apres.some((o) => o.topic === 'nino_pourquoi_tot'),
  JSON.stringify(apres.map((o) => o.texte)),
);

// --- 3. Le carnet ------------------------------------------------------

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.keyboard.press('KeyN');
await page.waitForTimeout(500);

const carnet = await page.evaluate(() => ({
  ouvert: !document.querySelector('#notebook-panel')?.classList.contains('is-hidden'),
  texte: document.querySelector('#notebook-body')?.textContent ?? '',
}));
check('le carnet s ouvre', carnet.ouvert);
check('l indice est range sous « Le bureau »', /Le bureau/.test(carnet.texte));
check('la declaration de Nino y figure', /dix heures moins dix/.test(carnet.texte));
check('le fait acquis y figure', /quitt.* le restaurant/i.test(carnet.texte));
check('aucun identifiant technique a l ecran', !/nino_|fait_|verre_renverse/.test(carnet.texte));

check('aucune erreur de console', erreurs.length === 0, erreurs.join(' | '));

console.log(`\n${ok} controle(s) reussi(s), ${ko} en echec.`);
await browser.close();
process.exit(ko === 0 ? 0 : 1);
