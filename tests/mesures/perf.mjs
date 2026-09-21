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
const SENS = 0.0022;
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});

/* Conditions IDENTIQUES pour chaque mesure : meme fenetre, meme point de
   vue, meme duree. Le joueur se place au sud de la bande des personnages
   et regarde vers le nord : tous les mannequins sont dans le champ. */
async function measure(count) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto(`http://127.0.0.1:4231/?personnages=${count}`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('#loading-screen')?.classList.contains('is-hidden'), { timeout: 40000 });
  await page.waitForTimeout(800);
  const st = async () => { const t = await page.textContent('#debug-line');
    const m = /x (-?[\d.]+)\s+y (-?[\d.]+)\s+z (-?[\d.]+)/.exec(t); return { x: +m[1], y: +m[2], z: +m[3] }; };
  let yaw = 0;
  const setYaw = async (t) => { await page.evaluate((dx) => window.dispatchEvent(new MouseEvent('mousemove', { movementX: dx })), -(t - yaw) / SENS); yaw = t; await page.waitForTimeout(110); };
  const goNear = async (o, stop, maxMs = 16000) => { const t0 = Date.now();
    while (Date.now() - t0 < maxMs) { const p = await st();
      if (Math.hypot(o.x - p.x, o.z - p.z) <= stop) break;
      await setYaw(Math.atan2(-(o.x - p.x), -(o.z - p.z)));
      await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW'); await page.waitForTimeout(70); }
    await page.waitForTimeout(300); };
  await page.mouse.click(480, 270);
  await page.waitForTimeout(400);
  await goNear({ x: 0, z: 0.2 }, 0.6);      // franchit le passage
  await goNear({ x: 0, z: 2.0 }, 0.5);      // recule au sud de la bande
  await setYaw(0);                           // regard plein nord
  await page.waitForTimeout(1200);           // stabilisation

  // Temps d'image mesure sur 180 images consecutives.
  const ms = await page.evaluate(() => new Promise((resolve) => {
    const times = []; let last = performance.now();
    const tick = () => {
      const now = performance.now();
      times.push(now - last); last = now;
      if (times.length < 180) requestAnimationFrame(tick);
      else { times.sort((a, b) => a - b); resolve({
        median: times[Math.floor(times.length / 2)],
        p95: times[Math.floor(times.length * 0.95)],
      }); }
    };
    requestAnimationFrame(tick);
  }));
  const dbg = await page.textContent('#debug-characters');
  const cpu = /cpu ([\d.]+) ms/.exec(dbg ?? '')?.[1] ?? '-';
  await page.close();
  return { count, ...ms, dbg, cpu };
}

console.log('CONDITIONS : Chromium headless, rendu LOGICIEL (SwiftShader, sans');
console.log('carte graphique), fenetre 960x540, pixelRatio 1, ombres activees,');
console.log('tous les personnages dans le champ de vision, 180 images mesurees.\n');
console.log('personnages | temps image median | 95e centile | img/s | cpu animation | cpu par pnj');
console.log('------------|--------------------|-------------|-------|---------------|------------');
const results = [];
for (const n of [0, 1, 2, 4]) {
  const res = await measure(n);
  results.push(res);
  const base = results[0].median;
  const per = n > 0 ? ((res.median - base) / n).toFixed(2) + ' ms' : '(reference)';
  const perCpu = n > 0 && res.cpu !== '-' ? (Number(res.cpu) / n).toFixed(3) + ' ms' : '-';
  console.log(
    `${String(n).padStart(11)} | ${res.median.toFixed(1).padStart(15)} ms | ${res.p95.toFixed(1).padStart(8)} ms | ` +
    `${(1000 / res.median).toFixed(1).padStart(5)} | ${(res.cpu + ' ms').padStart(13)} | ${perCpu.padStart(11)}`);
}
console.log('\nDetail des lignes de controle :');
for (const r of results) if (r.dbg) console.log(`  ${r.count} pnj : ${r.dbg}`);
await browser.close();
