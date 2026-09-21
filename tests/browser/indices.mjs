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

/* PHASE 6A — l'indice devient une donnee.
   Ce que cette suite cherche a mettre en defaut :
     - un texte d'indice qui viendrait encore de la scene 3D ;
     - une faute d'authoring qui passerait en silence ;
     - le releve d'etat qui volerait un clic ou une touche ;
     - une fuite de la regle absolue dans les nouveaux textes. */
import { chromium } from 'playwright';
const BASE = process.env.TEST_URL || 'http://127.0.0.1:4270/';
const EYE = 1.65, SENS = 0.0022;
const GRECO = { x: -3.2, y: 1.35, z: -0.2 };
const MANNEQUIN_B = { x: 3.2, y: 1.35, z: -0.2 };
const ASHTRAY = { x: -4.5, y: 0.83, z: 3.5 };
const PHONE = { x: -4.7, y: 0.95, z: -3.0 };
const FORBIDDEN = ['truth', 'ment', 'mensonge', 'menteur', 'vrai', 'faux',
                   'partial', 'supersedes', 'true', 'false', 'contradiction'];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const r = (l, ok, d) => { if (!ok) failures++; console.log(`${ok ? 'OK  ' : 'ECHEC'}  ${l}${d ? '  ->  ' + d : ''}`); };
let failures = 0;

/* On retire les accents AVANT de chercher un terme interdit. En
   JavaScript une lettre accentuee n'est pas un caractere de mot :
   « élément » contiendrait donc « ment » entoure de frontieres de mots. */
const strip = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Ouvre une page neuve avec ses propres journaux.
 * @param patch remplacements appliques au vol dans le bundle servi, pour
 *   fabriquer une faute d'authoring sans toucher aux fichiers du projet.
 */
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
        if (!body.includes(from)) throw new Error(`motif introuvable dans le bundle : ${from}`);
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

/** Deplacements et visee, identiques aux suites precedentes. */
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

const card = (page) => page.evaluate(() => {
  const panel = document.querySelector('#info-panel');
  const note = document.querySelector('.info-note');
  return {
    open: panel !== null && !panel.classList.contains('is-hidden'),
    title: document.querySelector('.info-title')?.textContent ?? '',
    text: document.querySelector('.info-text')?.textContent ?? '',
    note: note && !note.classList.contains('is-hidden') ? note.textContent : null,
  };
});
const prompt = (page) => page.textContent('#prompt-line');
const report = (page) => page.evaluate(() => {
  const panel = document.querySelector('#state-report');
  if (!panel) return null;
  const blocks = {};
  for (const block of panel.querySelectorAll('.state-block')) {
    const heading = block.querySelector('.state-heading')?.textContent ?? '';
    blocks[heading] = [...block.querySelectorAll('.state-list li')].map((li) => li.textContent);
  }
  return { blocks, pointerEvents: getComputedStyle(panel).pointerEvents };
});

/* ================================================================
   PAGE 1 — le jeu normal
   ================================================================ */
{
  const { page, logs } = await open();
  const { lookAt, goNear, resync } = controls(page);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await resync();

  console.log('=== 1. VALIDATION DES DONNEES ===');
  const validated = logs.infos.find((l) => l.includes('donnees validees'));
  r('le validateur ne signale aucun probleme', !!validated,
    validated ?? (logs.warns.filter((w) => w.includes('[enquete]')).join(' | ') || 'aucun message'));
  r('les indices sont comptes dans la validation', /\d+ indice/.test(validated ?? ''),
    /(\d+ indice)/.exec(validated ?? '')?.[1]);

  console.log('\n=== 2. CONTROLE CROISE DECOR <-> CATALOGUE ===');
  const crossed = logs.infos.find((l) => l.includes('decor et catalogue'));
  r('le decor et le catalogue concordent', !!crossed,
    crossed ?? (logs.warns.filter((w) => w.includes('decor')).join(' | ') || 'aucun message'));

  console.log('\n=== 3. LE RELEVE N\'EXISTE PAS SANS ?etat=1 ===');
  r("aucun releve d'etat dans la page", (await report(page)) === null);

  console.log('\n=== 4. LE LIBELLE SOUS LE VISEUR VIENT DU CATALOGUE ===');
  await goNear({ x: 0, z: 0.4 }, 0.6);
  await goNear({ x: 0, z: 3.9 }, 0.6);
  await goNear({ x: -3.4, z: 3.1 }, 0.6);
  await goNear(ASHTRAY, 1.3);
  await lookAt(ASHTRAY);
  const label = (await prompt(page))?.trim();
  r('libelle du catalogue affiche', label === 'Examiner le cendrier', `"${label}"`);

  console.log('\n=== 5. LA FICHE VIENT DU CATALOGUE, ET DIT QU\'ELLE EST NOTEE ===');
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  let c = await card(page);
  r('fiche affichee', c.open);
  r('titre = nom du catalogue', c.title === 'Cendrier', `"${c.title}"`);
  r('texte = description du catalogue', c.text.startsWith('Un mégot taché de rouge à lèvres'),
    `"${c.text.slice(0, 46)}..."`);
  r('mention d\'enregistrement affichee', c.note === 'Noté au dossier', `"${c.note}"`);
  const discovered = logs.infos.filter((l) => l.includes('indice decouvert : ashtray'));
  r('indice enregistre une fois', discovered.length === 1, `${discovered.length} enregistrement(s)`);

  console.log('\n=== 6. RE-EXAMINER : SIGNALE COMME DEJA AU DOSSIER ===');
  await page.mouse.click(500, 280); // fermer
  await page.waitForTimeout(350);
  await resync();
  await lookAt(ASHTRAY);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  c = await card(page);
  r('la mention change', c.note === 'Déjà au dossier', `"${c.note}"`);
  const again = logs.infos.filter((l) => l.includes('indice decouvert : ashtray'));
  r('aucun doublon dans l\'etat', again.length === 1, `${again.length} enregistrement(s)`);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(350);
  await resync();

  console.log('\n=== 7. OBSERVABLE N\'EST PAS INDICE ===');
  await goNear({ x: 0, z: 3.9 }, 0.7);
  await goNear({ x: 2.2, z: 1.2 }, 0.7);
  await goNear(MANNEQUIN_B, 1.5);
  await lookAt(MANNEQUIN_B);
  const propLabel = (await prompt(page))?.trim();
  r('le mannequin porte son propre libelle', propLabel === 'Observer Mannequin B', `"${propLabel}"`);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  c = await card(page);
  r('sa fiche s\'affiche', c.open && c.title === 'Mannequin B', `"${c.title}"`);
  r('AUCUNE mention d\'enregistrement', c.note === null, String(c.note));
  r('rien de nouveau dans l\'etat', logs.infos.filter((l) => l.includes('indice decouvert')).length === 1);

  console.log('\n=== 8. ANTI-DIVULGATION DANS LES NOUVEAUX TEXTES ===');
  const seen = strip(await page.evaluate(() => {
    const l = document.querySelector('#ui-layer');
    return (l?.innerText ?? '') + ' ' + (l?.innerHTML ?? '');
  }));
  const leaks = FORBIDDEN.filter((w) => new RegExp(`\\b${strip(w)}\\b`).test(seen));
  r('aucun terme interne ni jugement a l\'ecran', leaks.length === 0,
    leaks.length ? 'FUITE : ' + leaks.join(', ') : `${FORBIDDEN.length} termes verifies`);

  console.log('\n=== 9. ERREURS ET AVERTISSEMENTS ===');
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  r('aucun avertissement', logs.warns.length === 0, logs.warns.join(' | ') || 'aucun');
  await page.close();
}

/* ================================================================
   PAGE 2 — ?etat=1, le releve d'etat
   ================================================================ */
{
  const { page, logs } = await open('?etat=1');
  const { st, lookAt, goNear, resync } = controls(page);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await resync();

  console.log('\n=== 10. LE RELEVE EST LA, ET IL EST VIDE ===');
  let rep = await report(page);
  r('releve present avec ?etat=1', rep !== null);
  r('aucun indice au depart', (rep.blocks['Indices (0)'] ?? null) !== null,
    Object.keys(rep.blocks).join(' | '));

  console.log('\n=== 11. LE RELEVE EST TOTALEMENT INERTE ===');
  /* Le controle de deplacement se fait ICI, au depart : le joueur a de
     l'espace devant lui. Fait plus tard, contre la table du cendrier, il
     mesurerait un obstacle et non le clavier. */
  r('pointer-events: none', rep.pointerEvents === 'none', rep.pointerEvents);
  const under = await page.evaluate(() => document.elementFromPoint(60, 60)?.id ?? '(sans id)');
  r('un clic dans sa zone ne l\'atteint pas', under !== 'state-report', `atteint : ${under}`);
  const before = await st();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
  await page.waitForTimeout(250);
  const after = await st();
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  r('le joueur se deplace normalement', moved > 0.4, `${moved.toFixed(2)} m`);
  await resync();

  console.log('\n=== 12. LE RELEVE SUIT CE QUE LE JOUEUR RAMASSE ===');
  await goNear({ x: 0, z: 0.4 }, 0.6);
  await goNear({ x: 0, z: 3.9 }, 0.6);
  await goNear({ x: -3.4, z: 3.1 }, 0.6);
  await goNear(ASHTRAY, 1.3);
  await lookAt(ASHTRAY);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(350);
  await resync();
  rep = await report(page);
  const listed = rep.blocks['Indices (1)'] ?? [];
  r('l\'indice apparait au releve', listed.length === 1, listed.join(' | '));
  r('avec son identifiant ET son nom du catalogue',
    listed[0]?.includes('ashtray') && listed[0]?.includes('Cendrier'), listed[0]);

  console.log('\n=== 13. DECLARATIONS ET CHANGEMENT DE VERSION AU RELEVE ===');
  await resync();
  await goNear({ x: 0, z: 0.2 }, 0.6);
  await goNear(GRECO, 1.9);
  await lookAt(GRECO);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(700);
  const readThrough = async (max = 16) => {
    for (let i = 0; i < max; i++) {
      const done = await page.evaluate(() => document.querySelectorAll('.dialogue-choice').length > 0);
      if (done) break;
      await page.click('#dialogue-line', { force: true }).catch(() => {});
      await page.waitForTimeout(270);
    }
  };
  const ask = async (id) => {
    await page.click(`.dialogue-choice[data-topic="${id}"]`);
    await page.waitForTimeout(350); await readThrough();
  };
  /* C'est greco_after_closing qui le fait nier que quelqu'un soit reste,
     et cette question n'apparait qu'une fois le cendrier ramasse. */
  await ask('greco_after_closing');
  rep = await report(page);
  const heard = Object.entries(rep.blocks).find(([k]) => k.startsWith('Déclarations'))?.[1] ?? [];
  r('les declarations entendues sont au releve', heard.length >= 1, `${heard.length} declaration(s)`);

  await page.click('#dialogue-present');
  await page.waitForTimeout(350);
  await page.click('.dialogue-choice[data-evidence="clue:ashtray"]');
  await page.waitForTimeout(350); await readThrough();
  rep = await report(page);
  const heard2 = Object.entries(rep.blocks).find(([k]) => k.startsWith('Déclarations'))?.[1] ?? [];
  const v1 = heard2.find((l) => l.includes('greco_nobody_stayed'));
  const v2 = heard2.find((l) => l.includes('greco_admits_stayed'));
  r('la 1re version est conservee', !!v1, v1?.slice(0, 40));
  r('la 2e version est conservee aussi', !!v2, v2?.slice(0, 40));
  r('le remplacement est un CONSTAT, pas un jugement',
    !!v2 && v2.includes('remplace') && !/faux|fausse|mensonge/i.test(v2), v2?.slice(0, 60));
  const repText = strip(await page.evaluate(() => document.querySelector('#state-report')?.innerText ?? ''));
  const repLeaks = FORBIDDEN.filter((w) => new RegExp(`\\b${strip(w)}\\b`).test(repText));
  r('aucun terme interne dans le releve', repLeaks.length === 0,
    repLeaks.length ? 'FUITE : ' + repLeaks.join(', ') : `${FORBIDDEN.length} termes verifies`);

  console.log('\n=== 14. ERREURS ET AVERTISSEMENTS (?etat=1) ===');
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  r('aucun avertissement', logs.warns.length === 0, logs.warns.join(' | ') || 'aucun');
  await page.close();
}

/* ================================================================
   PAGE 3 — LA PREUVE DE LA SOURCE UNIQUE
   On change le catalogue (et RIEN d'autre) dans le bundle servi : si
   un seul texte ne suivait pas, c'est qu'il vivait ailleurs.
   ================================================================ */
{
  const { page, logs } = await open('', [
    ['name:`Cendrier`', 'name:`SCELLÉ N°7`'],
    ['prompt:`Examiner le cendrier`', 'prompt:`Relever le scellé`'],
  ]);
  const { lookAt, goNear, resync } = controls(page);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await resync();

  console.log('\n=== 15. CHANGER LE CATALOGUE CHANGE TOUT L\'AFFICHAGE ===');
  await goNear({ x: 0, z: 0.4 }, 0.6);
  await goNear({ x: 0, z: 3.9 }, 0.6);
  await goNear({ x: -3.4, z: 3.1 }, 0.6);
  await goNear(ASHTRAY, 1.3);
  await lookAt(ASHTRAY);
  const label = (await prompt(page))?.trim();
  r('le libelle sous le viseur a suivi', label === 'Relever le scellé', `"${label}"`);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  const c = await card(page);
  r('le titre de la fiche a suivi', c.title === 'SCELLÉ N°7', `"${c.title}"`);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(350);
  await resync();
  await goNear({ x: 0, z: 0.2 }, 0.6);
  await goNear(GRECO, 1.9);
  await lookAt(GRECO);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(700);
  await page.click('#dialogue-present');
  await page.waitForTimeout(400);
  const option = await page.evaluate(() =>
    document.querySelector('.dialogue-choice[data-evidence="clue:ashtray"] .choice-label')?.textContent ?? '');
  r("l'etiquette dans la liste d'elements a suivi", option === 'SCELLÉ N°7', `"${option}"`);
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  await page.close();
}

/* ================================================================
   PAGE 4 — LES DEUX FAUTES D'AUTHORING
   Un seul sabotage (l'objet designe « phon ») produit les deux :
   l'identifiant du decor est inconnu, et « phone » devient
   introuvable dans la piece.
   ================================================================ */
{
  const { page, logs } = await open('', [['clueId:`phone`', 'clueId:`phon`']]);
  const { lookAt, goNear, resync } = controls(page);

  console.log('\n=== 16. LES FAUTES D\'AUTHORING SONT ATTRAPEES ET NOMMEES ===');
  const warned = logs.warns.filter((w) => w.includes('decor') || w.includes('indice'));
  const unknown = warned.find((w) => w.includes('"phon"'));
  const orphan = warned.find((w) => w.includes('"phone"'));
  r('identifiant inconnu dans le decor signale', !!unknown, unknown ?? (warned.join(' | ') || 'rien'));
  r('indice devenu introuvable signale', !!orphan, orphan ?? 'rien');
  r('les deux messages nomment le fautif',
    !!unknown && !!orphan && unknown.includes('phon') && orphan.includes('phone'));

  console.log('\n=== 17. LE JEU CONTINUE DE TOURNER MALGRE LA FAUTE ===');
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await resync();
  await goNear({ x: 0, z: 0.4 }, 0.6);
  await goNear({ x: -1.2, z: -3.2 }, 0.8);
  await goNear(PHONE, 1.3);
  await lookAt(PHONE);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  const c = await card(page);
  r('une fiche de secours s\'affiche au lieu du vide', c.open && c.title === 'Objet non catalogué',
    `"${c.title}"`);
  r('elle nomme l\'indice fautif', c.text.includes('phon'), `"${c.text.slice(0, 50)}..."`);
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  await page.close();
}

/* ================================================================
   PAGE 5 — PHASE 6B : LES FAITS ACQUIS
   Un fait s'etablit par une question, et ouvre une question qui
   n'avait aucun sens avant lui.
   ================================================================ */
{
  const { page, logs } = await open('?etat=1');
  const { lookAt, goNear, resync } = controls(page);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(400);
  await resync();

  const topics = () => page.evaluate(() =>
    [...document.querySelectorAll('.dialogue-choice')].map((b) => b.dataset.topic).filter(Boolean));
  const readThrough = async (max = 16) => {
    for (let i = 0; i < max; i++) {
      const done = await page.evaluate(() => document.querySelectorAll('.dialogue-choice').length > 0);
      if (done) break;
      await page.click('#dialogue-line', { force: true }).catch(() => {});
      await page.waitForTimeout(270);
    }
  };
  const ask = async (id) => {
    await page.click(`.dialogue-choice[data-topic="${id}"]`);
    await page.waitForTimeout(350); await readThrough();
  };

  console.log('\n=== 18. LES FAITS SONT COMPTES ET LE DOSSIER EST VIDE ===');
  const validated = logs.infos.find((l) => l.includes('donnees validees'));
  r('le validateur ne signale aucun probleme', !!validated,
    validated ?? (logs.warns.filter((w) => w.includes('[enquete]')).join(' | ') || 'aucun message'));
  r('les faits sont comptes dans la validation', /\d+ fait/.test(validated ?? ''),
    /(\d+ fait)/.exec(validated ?? '')?.[1]);
  let rep = await report(page);
  r('aucun fait acquis au depart', (rep.blocks['Faits acquis (0)'] ?? null) !== null,
    Object.keys(rep.blocks).join(' | '));

  console.log('\n=== 19. SANS LE TELEPHONE, LA QUESTION N\'EXISTE PAS ===');
  await goNear({ x: 0, z: 0.2 }, 0.6);
  await goNear(GRECO, 1.9);
  await lookAt(GRECO);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(700);
  let ids = await topics();
  r('la question qui etablit le fait est ABSENTE', !ids.includes('greco_the_call'), ids.join(', '));
  r('la question qui attend le fait est ABSENTE aussi',
    !ids.includes('greco_who_did_you_call'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(450);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(500);
  await resync();

  console.log('\n=== 20. LE TELEPHONE OUVRE LA QUESTION, MAIS PAS LA SUITE ===');
  await goNear({ x: 0, z: 0.4 }, 0.6);
  await goNear({ x: -1.2, z: -3.2 }, 0.8);
  await goNear(PHONE, 1.3);
  await lookAt(PHONE);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(450);
  const fiche = await card(page);
  r('le telephone est bien un indice', fiche.note === 'Noté au dossier', `"${fiche.title}"`);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(350);
  await resync();
  await goNear({ x: -1.2, z: -3.2 }, 0.8);
  await goNear({ x: 0, z: 0.2 }, 0.7);
  await goNear(GRECO, 1.9);
  await lookAt(GRECO);
  await page.mouse.click(500, 280);
  await page.waitForTimeout(700);
  ids = await topics();
  r('la question qui etablit le fait est APPARUE', ids.includes('greco_the_call'), ids.join(', '));
  r('celle qui attend le fait est TOUJOURS absente',
    !ids.includes('greco_who_did_you_call'));

  console.log('\n=== 21. POSER LA QUESTION ETABLIT LE FAIT ===');
  const heardBefore = (await report(page)).blocks;
  const countBefore = Object.keys(heardBefore).find((k) => k.startsWith('Déclarations')) ?? '';
  await ask('greco_the_call');
  rep = await report(page);
  const facts = rep.blocks['Faits acquis (1)'] ?? [];
  r('le fait apparait au releve', facts.length === 1, facts.join(' | '));
  r('avec son identifiant ET son enonce du catalogue',
    facts[0]?.includes('call_after_closing') && facts[0]?.includes('appel est parti'), facts[0]);
  const countAfter = Object.keys(rep.blocks).find((k) => k.startsWith('Déclarations')) ?? '';
  r('il n\'a concede AUCUNE declaration : un fait n\'est pas un temoignage',
    countBefore === countAfter, `${countBefore} -> ${countAfter}`);

  console.log('\n=== 22. LE FAIT OUVRE LA QUESTION SUIVANTE ===');
  ids = await topics();
  r('la question conditionnee par le fait est APPARUE',
    ids.includes('greco_who_did_you_call'), ids.join(', '));
  await ask('greco_who_did_you_call');
  r('elle se pose normalement', (await topics()).length > 0);
  r('reposable : elle est encore la', (await topics()).includes('greco_who_did_you_call'));

  console.log('\n=== 23. UN FAIT N\'EST PAS UN ELEMENT A PRESENTER ===');
  await page.click('#dialogue-present');
  await page.waitForTimeout(400);
  const kinds = await page.evaluate(() =>
    [...document.querySelectorAll('.dialogue-choice[data-evidence]')]
      .map((b) => b.dataset.evidence.split(':')[0]));
  r('la liste ne contient que des indices et des declarations',
    kinds.length > 0 && kinds.every((k) => k === 'clue' || k === 'statement'),
    [...new Set(kinds)].join(', '));
  r('aucun fait ne s\'y est glisse', !kinds.includes('fact'));

  console.log('\n=== 24. ANTI-DIVULGATION SUR L\'ENONCE DU FAIT ===');
  const repText = strip(await page.evaluate(() =>
    document.querySelector('#state-report')?.innerText ?? ''));
  const repLeaks = FORBIDDEN.filter((w) => new RegExp(`\\b${strip(w)}\\b`).test(repText));
  r('aucun terme interne ni jugement au releve', repLeaks.length === 0,
    repLeaks.length ? 'FUITE : ' + repLeaks.join(', ') : `${FORBIDDEN.length} termes verifies`);
  r('aucune erreur JavaScript', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune');
  r('aucun avertissement', logs.warns.length === 0, logs.warns.join(' | ') || 'aucun');
  await page.close();
}

/* ================================================================
   PAGE 6 — LES FAUTES D'AUTHORING SUR LES FAITS
   Deux sabotages produisent les trois messages attendus.
   ================================================================ */
{
  const { logs, page } = await open('', [
    ['revealFacts:[`call_after_closing`]', 'revealFacts:[`call_after_closng`]'],
    ['requires:{facts:[`call_after_closing`]}', 'requires:{facts:[`call_afterclosing`]}'],
  ]);

  console.log('\n=== 25. LES FAUTES SUR LES FAITS SONT ATTRAPEES ===');
  for (const w of logs.warns) console.log('   ' + w);
  const reveal = logs.warns.find((w) => w.includes('fait a reveler inconnu') && w.includes('closng'));
  const required = logs.warns.find((w) => w.includes('fait requis inconnu') && w.includes('afterclosing'));
  const dead = logs.warns.find((w) => w.includes('rien ne le revele jamais'));
  r('un fait a reveler inconnu est signale', !!reveal, reveal ?? 'rien');
  r('un fait requis inconnu est signale', !!required, required ?? 'rien');
  r('un fait que rien ne revele est signale comme mort', !!dead, dead ?? 'rien');
  r('le jeu demarre quand meme', logs.errs.length === 0, logs.errs.join(' | ') || 'aucune erreur');
  await page.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'TOUT EST VERT' : failures + ' ECHEC(S)'}`);
process.exit(failures === 0 ? 0 : 1);
