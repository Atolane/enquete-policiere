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
