# Crédits des modèles 3D

Tout asset ajouté ici doit être listé ci-dessous avec sa source et sa licence.
Aucun modèle sans licence claire ne doit entrer dans le projet.

---

## antique_camera.glb — Appareil photo sur trépied

- **Source** : [Khronos glTF-Sample-Assets — AntiqueCamera](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/AntiqueCamera)
- **Auteur** : Maximillan Kamps / UX3D (2018)
- **Licence** : [Creative Commons Zero v1.0 Universal (CC0)](https://creativecommons.org/publicdomain/zero/1.0/) — domaine public
- **Réserve** : le modèle porte un logo UX3D sur un pied du trépied. Ce logo est
  une marque, non couverte par la licence CC0. Modèle utilisé ici comme **asset
  de test du pipeline** ; il devra être remplacé ou le logo retiré avant toute
  diffusion publique du jeu.
- **Traitement appliqué** :
  `gltf-transform optimize --texture-compress webp --texture-size 1024`
  17,54 Mo → 685 Ko (téléchargement), 134 Mo → 33 Mo (mémoire graphique).
- **Échelle** : le modèle d'origine mesure 7,2 m de haut. Un facteur d'échelle
  est appliqué au placement pour le ramener à 1,55 m (voir TestRoomScene).

---

## mannequin.glb + anim_library.glb — Mannequin d'essai animé

- **Source** : [three.js — RobotExpressive](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive)
- **Auteur** : [Tomás Laulhé](https://www.patreon.com/quaternius) (Quaternius),
  modifications par [Don McCurdy](https://donmccurdy.com/)
- **Licence** : **CC0 1.0 Universal** — domaine public, redistribution
  explicitement autorisée. Licence documentée dans le `README.md` du modèle,
  dans le dépôt three.js.
- **Rôle** : mannequin d'essai pour valider la chaîne technique des personnages
  (squelette, animations, fondus, regard). **Ce n'est pas un personnage du jeu** :
  les figures de 1948 viendront en Phase 12.
- **Traitement appliqué** :
  1. `node scripts/extract-animations.mjs RobotExpressive.glb <dossier> mannequin`
     — sépare le personnage de ses animations et préfixe les os par `rig_`
  2. `gltf-transform optimize --compress meshopt --texture-compress webp
     --texture-size 1024 --flatten false --join false --instance false
     --palette false --simplify false`
     (les réorganisations de hiérarchie sont désactivées : elles casseraient
     le lien entre les os et les animations)

  | | Fichier d'origine | Après séparation et optimisation |
  |---|---|---|
  | Personnage | — | `mannequin.glb` 110 Ko |
  | Animations (14 clips) | — | `anim_library.glb` 80 Ko |
  | **Total** | 464 Ko | **190 Ko** |

  La bibliothèque d'animations n'est payée **qu'une fois**, quel que soit le
  nombre de personnages partageant ce squelette.

### Sources écartées pour raison de licence

**Xbot.glb** et **Soldier.glb** (exemples three.js) ont été écartés : ils sont
dérivés de **Mixamo**, dont les conditions autorisent l'usage dans un projet
mais restreignent la redistribution du fichier lui-même. Aucun fichier de
licence n'accompagne ces modèles dans le dépôt three.js (dont la licence MIT ne
couvre que le code). Ils ont servi uniquement à une analyse hors dépôt.
