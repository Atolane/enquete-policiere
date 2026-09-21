/* Branche le crochet de resolution avant le chargement des tests.
   Passe a Node via --import, voir le script « test » du package.json. */
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
