/* ===================================================================
   scripts/extract-animations.mjs

   SEPARE UN PERSONNAGE RIGUE EN DEUX FICHIERS.

   Pourquoi : les animations pesent souvent plus lourd que le
   personnage lui-meme. Si chaque personnage embarque son propre jeu
   d'animations, on paie N fois le meme contenu. En les sortant dans un
   fichier partage, on ne le paie qu'une fois, quel que soit le nombre
   de personnages -- a condition qu'ils partagent le meme squelette.

   Produit :
     <prefixe>_character.glb   maillages + squelette, SANS animation
     <prefixe>_animations.glb  squelette + animations, SANS maillage

   Les deux fichiers conservent exactement la meme hierarchie d'os, aux
   memes noms : c'est ce qui permet a Three.js de rebrancher les pistes
   d'animation sur n'importe quel personnage du meme rig.

   NORMALISATION DES NOMS D'OS
   Beaucoup de modeles donnent le MEME nom a un os et au maillage qu'il
   deforme ("Head" pour les deux). Three.js rend les noms uniques en
   ajoutant un suffixe, mais il le fait FICHIER PAR FICHIER : une piste
   d'animation visant "Head" pourrait alors se brancher sur le maillage
   au lieu de l'os, et la tete ne bougerait pas.
   On prefixe donc tous les os par "rig_" AVANT la separation. Les deux
   fichiers heritent des memes noms, uniques et sans ambiguite. C'est
   aussi ce que fait Mixamo avec son prefixe "mixamorig:".

   Usage :
     node scripts/extract-animations.mjs source.glb dossier/ prefixe
   =================================================================== */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const [source, outDir, prefix] = process.argv.slice(2);
if (!source || !outDir || !prefix) {
  console.error('Usage : node scripts/extract-animations.mjs <source.glb> <dossier> <prefixe>');
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await mkdir(outDir, { recursive: true });

/** Prefixe tous les os et supprime les caracteres que Three.js reecrit. */
function normalizeBoneNames(doc) {
  const renamed = new Map();
  for (const skin of doc.getRoot().listSkins()) {
    for (const joint of skin.listJoints()) {
      const original = joint.getName();
      if (original.startsWith('rig_')) continue;
      // Three.js retire . : / [ ] des noms : on le fait nous-memes pour
      // que le nom du fichier soit exactement celui utilise en jeu.
      const clean = original.replace(/[^A-Za-z0-9_]/g, '_');
      joint.setName(`rig_${clean}`);
      renamed.set(original, `rig_${clean}`);
    }
  }
  return renamed;
}

function describe(doc) {
  const root = doc.getRoot();
  const bones = root.listSkins().flatMap((s) => s.listJoints().map((j) => j.getName()));
  return {
    meshes: root.listMeshes().length,
    animations: root.listAnimations().map((a) => a.getName()),
    bones: new Set(bones).size,
    nodes: root.listNodes().length,
  };
}

const before = describe(await io.read(source));
console.log(`source : ${before.meshes} maillages, ${before.animations.length} animations, ${before.bones} os`);

// --- 1. Le PERSONNAGE : on retire les animations ---------------------
{
  const doc = await io.read(source);
  const renamed = normalizeBoneNames(doc);
  console.log(`os renommes : ${renamed.size} (prefixe "rig_")`);
  for (const animation of doc.getRoot().listAnimations()) animation.dispose();
  await doc.transform(prune());
  const out = path.join(outDir, `${prefix}_character.glb`);
  await io.write(out, doc);
  const after = describe(doc);
  console.log(`  -> ${prefix}_character.glb  : ${after.meshes} maillages, ${after.animations.length} animations, ${after.bones} os`);
}

// --- 2. La BIBLIOTHEQUE : on retire les maillages ---------------------
{
  const doc = await io.read(source);
  normalizeBoneNames(doc); // memes noms que dans le fichier personnage
  const root = doc.getRoot();

  // On detache d'abord les maillages et les peaux de leurs noeuds, sinon
  // les noeuds garderaient des references vers des objets supprimes.
  // Les NOEUDS eux-memes sont conserves : ce sont les os, et les pistes
  // d'animation les designent par leur nom.
  for (const node of root.listNodes()) {
    node.setMesh(null);
    node.setSkin(null);
  }
  for (const skin of root.listSkins()) skin.dispose();
  for (const mesh of root.listMeshes()) mesh.dispose();

  await doc.transform(prune());
  const out = path.join(outDir, `${prefix}_animations.glb`);
  await io.write(out, doc);
  const after = describe(doc);
  console.log(`  -> ${prefix}_animations.glb : ${after.meshes} maillages, ${after.animations.length} animations, ${after.nodes} noeuds`);
  console.log(`     animations : ${after.animations.join(', ')}`);
}
