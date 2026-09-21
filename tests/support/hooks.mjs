/* ===================================================================
   tests/support/hooks.mjs

   POURQUOI CE FICHIER EXISTE.

   Les tests unitaires importent directement les sources TypeScript de
   src/, sans etape de compilation : c'est ce qui permet a « npm test »
   de tourner instantanement, juste apres un clonage, sans installer
   quoi que ce soit.

   Node sait depouiller les types depuis la version 22, mais son
   resolveur ESM exige une extension explicite dans les imports :
   « ../data/types » echoue la ou « ../data/types.ts » fonctionne. Les
   sources, elles, sont ecrites sans extension parce que Vite et
   TypeScript s'en accommodent.

   Ce crochet fait le pont, et rien d'autre : quand une resolution
   echoue sur un chemin relatif sans extension, il retente une fois en
   ajoutant « .ts ». Aucune magie, aucun cache, aucune transformation.
   =================================================================== */

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    const relatif = specifier.startsWith('.');
    const deja = /\.[cm]?[jt]s$/.test(specifier);
    if (relatif && !deja) return next(`${specifier}.ts`, context);
    throw error;
  }
}
