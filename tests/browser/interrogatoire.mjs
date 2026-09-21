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
const BASE = process.env.TEST_URL || 'http://127.0.0.1:4250/';
const EYE = 1.65, SENS = 0.0022;
const GRECO = { x: -3.2, y: 1.35, z: -0.2 };
const ASHTRAY = { x: -4.5, y: 0.83, z: 3.5 };
const REPORT = { x: 3.5, y: 1.42, z: -2.0 };

/* Valeurs INTERNES qui ne doivent JAMAIS apparaitre a l'ecran. */
const FORBIDDEN = ['truth', 'ment', 'mensonge', 'menteur', 'vrai', 'faux',
                   'partial', 'supersedes', 'true', 'false'];

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
  return { x: +m[1], y: +m[2], z: +m[3], yaw: +m[4] * Math.PI / 180, pitch: +m[5] * Math.PI / 180 }; };
/** Recale le suivi local sur l'orientation reelle du joueur.
    Indispensable apres un entretien : le cadrage camera a bouge la vue
    sans passer par nos evenements de souris. */
const syncLook = async () => { const p = await st(); yaw = p.yaw; pitch = p.pitch; };
const ch = async () => {
  const t = await page.textContent('#debug-characters');
  const m = /pnj (\S+) \| (\w+)\/(\w+) \| clip (\S+) t=([\d.]+) \| fondu (\d+) \| tete (-?[\d.]+)° \(rot (-?[\d.]+)°( fuyant)?\)/.exec(t ?? '');
  if (!m) throw new Error('ligne pnj illisible : ' + t);
  return { id: m[1], state: m[2], mood: m[3], clip: m[4], time: +m[5], blending: +m[6],
           head: +m[7], yaw: +m[8], averted: !!m[9], raw: t };
};
const dlg = () => page.evaluate(() => {
  const panel = document.querySelector('#dialogue-panel');
  const open = panel !== null && !panel.classList.contains('is-hidden');
  const choices = [...document.querySelectorAll('.dialogue-choice')].map((b) => ({
    topic: b.dataset.topic ?? null,
    label: b.querySelector('.choice-label')?.textContent ?? '',
  }));
  return {
    open,
    name: document.querySelector('.dialogue-name')?.textContent ?? '',
    role: document.querySelector('.dialogue-role')?.textContent ?? '',
    line: document.querySelector('#dialogue-line')?.textContent ?? '',
    speaker: document.querySelector('#dialogue-line')?.dataset.speaker ?? '',
    choices,
  };
});
let yaw = 0, pitch = 0;
const setYaw = async (t) => { await page.evaluate((dx) => window.dispatchEvent(new MouseEvent('mousemove', { movementX: dx })), -(t - yaw) / SENS); yaw = t; await page.waitForTimeout(110); };
const setPitch = async (t) => { await page.evaluate((dy) => window.dispatchEvent(new MouseEvent('mousemove', { movementY: dy })), -(t - pitch) / SENS); pitch = t; await page.waitForTimeout(110); };
/* Visee AUTO-CORRECTRICE : a chaque passe on relit l'orientation reelle
   dans la ligne de controle, au lieu de se fier a notre propre suivi.
   Trois passes suffisent a tomber sous le degre -- necessaire pour viser
   un cendrier de 4 cm, qui ne couvre que 2 degres a un metre. */
const lookAt = async (o, passes = 3) => {
  for (let i = 0; i < passes; i++) {
    const p = await st();
    yaw = p.yaw; pitch = p.pitch;
    const dx = o.x - p.x, dy = (o.y ?? 1) - (p.y + EYE), dz = o.z - p.z;
    await setYaw(Math.atan2(-dx, -dz));
    await setPitch(Math.atan2(dy, Math.hypot(dx, dz)));
  }
  await page.waitForTimeout(250);
};
const goNear = async (o, stop, maxMs = 20000) => { const t0 = Date.now();
  while (Date.now() - t0 < maxMs) { const p = await st();
    if (Math.hypot(o.x - p.x, o.z - p.z) <= stop) break;
    await setPitch(0); await setYaw(Math.atan2(-(o.x - p.x), -(o.z - p.z)));
    await page.keyboard.down('KeyW'); await page.waitForTimeout(320); await page.keyboard.up('KeyW'); await page.waitForTimeout(80); }
  await page.waitForTimeout(350); return st(); };
/** Deroule une reponse jusqu'au retour de la liste de questions. */
const readThrough = async (maxClicks = 14) => {
  const seen = [];
  for (let i = 0; i < maxClicks; i++) {
    const d = await dlg();
    if (d.choices.length > 0) break;
    if (d.line) seen.push(d.line);
    await page.click('#dialogue-line', { force: true }).catch(() => {});
    await page.waitForTimeout(260);
  }
  return seen;
};
const ask = async (topicId) => {
  await page.click(`.dialogue-choice[data-topic="${topicId}"]`);
  await page.waitForTimeout(350);
  return readThrough();
};
/** Tout le texte visible a l'ecran, pour le controle anti-divulgation. */
const visibleText = () => page.evaluate(() => {
  const layer = document.querySelector('#ui-layer');
  return (layer?.innerText ?? '') + ' ' + (layer?.innerHTML ?? '');
});

console.log('=== 1. DONNEES VALIDEES AU DEMARRAGE ===');
const validated = infos.find((l) => l.includes('[enquete] donnees validees'));
r('le validateur ne signale aucun probleme', !!validated, validated ?? (warns.find((w) => w.includes('[enquete]')) ?? 'aucun message'));

console.log('\n=== 2. OUVERTURE DE L\'ENTRETIEN ===');
await page.mouse.click(500, 280);
await page.waitForTimeout(400);
await goNear({ x: 0, z: 0.2 }, 0.6);
await goNear(GRECO, 1.9);
await lookAt(GRECO);
const prompt = await page.textContent('#prompt-line');
r('le libelle propose d\'interroger', (prompt ?? '').includes('Interroger Salvatore'), `"${prompt}"`);
await page.mouse.click(500, 280);
await page.waitForTimeout(700);
let d = await dlg();
r('le panneau d\'interrogatoire s\'ouvre', d.open);
r('nom et qualite affiches', d.name === 'Salvatore Greco' && d.role.includes('gérant'), `${d.name} — ${d.role}`);
r('la souris est liberee', await page.evaluate(() => document.pointerLockElement === null));
r('le panneau d\'accueil ne s\'affiche pas', await page.evaluate(() =>
  document.querySelector('#lock-panel')?.classList.contains('is-hidden')));

console.log('\n=== 3. QUESTIONS DISPONIBLES ET DISSIMULATION ===');
const ids = d.choices.map((c) => c.topic).filter(Boolean);
r('des questions sont proposees', ids.length >= 4, `${ids.length} : ${ids.join(', ')}`);
r('la question verrouillee par le cendrier est ABSENTE', !ids.includes('greco_after_closing'));
r('la question verrouillee par le rapport est ABSENTE', !ids.includes('greco_typewriter'));
r('la relance permanente est presente', ids.includes('greco_anything_else'));

console.log('\n=== 4. LE JOUEUR NE PEUT NI BOUGER NI TOURNER ===');
const p1 = await st();
await page.keyboard.down('KeyW'); await page.waitForTimeout(1100); await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
const p2 = await st();
r('le joueur reste immobile', Math.hypot(p2.x - p1.x, p2.z - p1.z) < 0.02,
  `${(Math.hypot(p2.x - p1.x, p2.z - p1.z) * 100).toFixed(1)} cm`);

console.log('\n=== 5. POSER UNE QUESTION (mensonge dit avec aplomb) ===');
const lines = await ask('greco_evening');
r('des repliques ont defile', lines.length >= 2, `${lines.length} repliques`);
r('le contenu correspond au sujet', lines.some((l) => l.includes('neuf heures')), `"${(lines[1] ?? '').slice(0, 60)}"`);
d = await dlg();
r('la liste de questions revient', d.choices.length > 0);
r('la question posee a DISPARU', !d.choices.some((c) => c.topic === 'greco_evening'));

console.log('\n=== 6. ESQUIVE ET REFUS restent posables ===');
await ask('greco_business');
d = await dlg();
r('l\'esquive reste dans la liste', d.choices.some((c) => c.topic === 'greco_business'));
const afterDodge = await ch();
r('l\'esquive a ferme le personnage (guarded)', afterDodge.mood === 'guarded', afterDodge.mood);
await ask('greco_record');
d = await dlg();
r('le refus reste dans la liste', d.choices.some((c) => c.topic === 'greco_record'));

console.log('\n=== 7. GESTE PONCTUEL ET HUMEUR ===');
// La question sur la victime : verite, dite nerveusement, avec pauses.
const before = await ch();
await page.click('.dialogue-choice[data-topic="greco_victim"]');
let sawBeat = false, sawPause = false;
for (let i = 0; i < 26; i++) {
  await page.waitForTimeout(200);
  const c = await ch();
  if (['No', 'Yes', 'Wave'].includes(c.clip)) sawBeat = true;
  const cur = await dlg();
  if (cur.line === '…') sawPause = true;
  if (cur.choices.length === 0 && cur.line && cur.line !== '…') {
    await page.click('#dialogue-line', { force: true }).catch(() => {});
  }
  if (cur.choices.length > 0) break;
}
await page.waitForTimeout(400);
const afterVictim = await ch();
r('un silence est marque avant la reponse', sawPause, 'replique « … » observee');
r('l\'humeur devient « nervous »', afterVictim.mood === 'nervous', `${before.mood} -> ${afterVictim.mood}`);
r('le clip de base est revenu apres le geste', ['Standing', 'Idle'].includes(afterVictim.clip), afterVictim.clip);

console.log('\n=== 8. LE REGARD FUIT QUAND IL EST NERVEUX ===');
let averted = 0, held = 0, maxHead = 0;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(120);
  const c = await ch();
  if (c.averted) averted++; else held++;
  maxHead = Math.max(maxHead, c.head);
}
r('il rompt le contact visuel par intermittence', averted > 3 && held > 3,
  `${averted} images yeux fuyants, ${held} images regard tenu`);
r('l\'ecart de regard devient mesurable', maxHead > 12, `ecart maximum ${maxHead.toFixed(0)}°`);

console.log('\n=== 9. ANTI-DIVULGATION : le jeu ne dit JAMAIS qu\'il ment ===');
/* On retire les accents AVANT de chercher. En JavaScript, une lettre
   accentuee n'est pas un caractere de mot : « élément » contiendrait
   donc « ment » entoure de frontieres de mots, et declencherait une
   fausse alerte. Sans accents, « element » ne piege plus rien. */
const strip = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const text = strip(await visibleText());
const leaks = FORBIDDEN.filter((w) => new RegExp(`\\b${strip(w)}\\b`).test(text));
r('aucun terme interne ni jugement a l\'ecran', leaks.length === 0,
  leaks.length ? 'FUITE : ' + leaks.join(', ') : `${FORBIDDEN.length} termes verifies`);
const attrs = await page.evaluate(() => {
  const el = document.querySelector('#dialogue-line');
  return el ? [...el.attributes].map((a) => `${a.name}=${a.value}`).join(' ') : '';
});
r('la replique ne porte aucun attribut revelateur',
  !/truth|lie|ment|faux/i.test(attrs), `attributs : ${attrs || '(aucun)'}`);

console.log('\n=== 10. SORTIE ET RETOUR AU JEU ===');
await page.click('#dialogue-leave');
await page.waitForTimeout(500);
d = await dlg();
r('le panneau se ferme', !d.open);
await page.mouse.click(500, 280);
await page.waitForTimeout(600);
r('la souris est reprise au clic', await page.evaluate(() => document.pointerLockElement !== null));
const p3 = await st();
await page.keyboard.down('KeyS'); await page.waitForTimeout(900); await page.keyboard.up('KeyS');
await page.waitForTimeout(400);
const p4 = await st();
r('le joueur peut de nouveau se deplacer', Math.hypot(p4.x - p3.x, p4.z - p3.z) > 0.4,
  `${Math.hypot(p4.x - p3.x, p4.z - p3.z).toFixed(2)} m`);

console.log('\n=== 11. DISSIMULATION : l\'indice ouvre une question ===');
/* Itineraire en trois etapes. goNear marche EN LIGNE DROITE : il faut
   contourner le bloc du passage etroit, puis le trepied de l'appareil
   photo, dont la boite de collision est sur le chemin direct. */
await goNear({ x: 0, z: 0.4 }, 0.6);     // face a l'ouverture
await goNear({ x: 0, z: 3.9 }, 0.6);     // franchit le passage, bien au sud
await goNear({ x: -3.4, z: 3.1 }, 0.6);  // longe vers l'ouest, au nord du trepied
const atAshtray = await goNear(ASHTRAY, 1.3);
console.log(`   [diag] position ${JSON.stringify(atAshtray)} distance ${Math.hypot(ASHTRAY.x - atAshtray.x, ASHTRAY.z - atAshtray.z).toFixed(2)} m`);
await lookAt(ASHTRAY);
const after = await st();
const want = { yaw: Math.atan2(-(ASHTRAY.x - after.x), -(ASHTRAY.z - after.z)),
               pitch: Math.atan2(ASHTRAY.y - (after.y + EYE), Math.hypot(ASHTRAY.x - after.x, ASHTRAY.z - after.z)) };
console.log(`   [diag] APRES visee : cap ${(after.yaw*180/Math.PI).toFixed(1)}° ${(after.pitch*180/Math.PI).toFixed(1)}°`);
console.log(`   [diag] cap VOULU  : ${(want.yaw*180/Math.PI).toFixed(1)}° ${(want.pitch*180/Math.PI).toFixed(1)}°`);
console.log(`   [diag] libelle : ${JSON.stringify(await page.textContent('#prompt-line'))}`);
console.log(`   [diag] souris capturee : ${await page.evaluate(() => document.pointerLockElement !== null)}`);
await page.mouse.click(500, 280);
await page.waitForTimeout(500);
console.log(`   [diag] fiche ouverte : ${await page.evaluate(() => !document.querySelector('#info-panel')?.classList.contains('is-hidden'))}`);
const clueFound = infos.find((l) => l.includes('indice decouvert : ashtray'));
r('le cendrier est enregistre comme indice', !!clueFound, clueFound ?? 'absent');
await page.mouse.click(500, 280);   // ferme la fiche
await page.waitForTimeout(400);
await goNear({ x: 0, z: 0.2 }, 0.6);
await goNear(GRECO, 1.9);
await lookAt(GRECO);
await page.mouse.click(500, 280);
await page.waitForTimeout(700);
d = await dlg();
r('la nouvelle question est APPARUE', d.choices.some((c) => c.topic === 'greco_after_closing'),
  d.choices.map((c) => c.topic).join(', '));

console.log('\n=== 12. MEMOIRE ENTRE DEUX ENTRETIENS ===');
r('les questions deja posees ne reviennent pas',
  !d.choices.some((c) => ['greco_evening', 'greco_victim'].includes(c.topic ?? '')),
  d.choices.map((c) => c.topic).join(', '));
const moodKept = await ch();
r('l\'humeur est conservee', moodKept.mood === 'nervous' || moodKept.mood === 'guarded', moodKept.mood);

console.log('\n=== 13. RACCOURCI CLAVIER ===');
const firstTopic = (await dlg()).choices[0]?.topic;
await page.keyboard.press('Digit1');
await page.waitForTimeout(500);
const afterKey = await dlg();
r('la touche 1 pose la premiere question',
  afterKey.choices.length === 0 || afterKey.choices[0]?.topic !== firstTopic,
  `question posee : ${firstTopic}`);
await readThrough();
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
r('Echap termine l\'entretien', !(await dlg()).open);

console.log('\n=== 14. ERREURS ET AVERTISSEMENTS ===');
r('aucune erreur JavaScript', errs.length === 0, errs.slice(0, 2).join(' | ') || 'aucune');
r('aucun avertissement', warns.length === 0, warns.slice(0, 2).join(' | ') || 'aucun');
await browser.close();
