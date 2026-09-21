/* ===================================================================
   Lance les suites navigateur les unes apres les autres.

   Chaque suite est un programme autonome : elle ouvre son navigateur,
   joue son scenario et sort avec un code non nul en cas d'echec. Les
   enchainer dans des processus separes evite qu'une suite qui plante
   emporte les suivantes.

   Prerequis : Playwright installe, et « npm run dev » en cours.
   =================================================================== */

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(ici)
  .filter((nom) => nom.endsWith('.mjs') && nom !== 'run.mjs')
  .sort();

let echecs = 0;
for (const suite of suites) {
  process.stdout.write(`\n=== ${suite} ===\n`);
  const r = spawnSync(process.execPath, [join(ici, suite)], { stdio: 'inherit' });
  if (r.status !== 0) echecs += 1;
}

process.stdout.write(`\n${suites.length} suite(s), ${echecs} en echec.\n`);
process.exit(echecs === 0 ? 0 : 1);
