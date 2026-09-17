# Enquête — 1948

Petit jeu d'enquête policière 3D en vue FPS, jouable dans un navigateur.
États-Unis, 1948. Ambiance film noir. Une seule affaire de meurtre.

**État actuel : Phase 3 — pipeline d'assets.**
Une pièce de test en primitives (graybox), une caméra à la première personne,
le déplacement ZQSD/WASD, la gravité, de vraies collisions (murs, escalier,
rampe, passage étroit) l'observation d'objets (viseur, libellé,
fiche d'information) et le chargement de vrais modèles GLB. Pas encore de
personnages, de dialogues ni d'enquête.

### Commandes en jeu

| Touche | Action |
|---|---|
| clic | prendre le contrôle de la souris |
| `Z Q S D` / `W A S D` / flèches | se déplacer |
| souris | regarder autour de soi |
| `Maj` | marcher plus vite |
| clic | examiner l'objet visé / fermer la fiche |
| `Échap` | libérer la souris |

---

## Prérequis

- [Node.js](https://nodejs.org) version 20 ou plus (`node --version` pour vérifier)

## Installation

```bash
npm install
```

À faire une seule fois, ou après avoir récupéré une nouvelle version du projet.

## Lancer le jeu en développement

```bash
npm run dev
```

Puis ouvrir l'adresse affichée dans le terminal (généralement
http://localhost:5173). Le navigateur se met à jour automatiquement à chaque
fois qu'un fichier est enregistré. `Ctrl+C` pour arrêter.

## Les autres commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement, rechargement automatique |
| `npm run typecheck` | cherche les erreurs de TypeScript sans rien construire |
| `npm run build` | construit la version finale dans `dist/` (vérifie les types d'abord) |
| `npm run preview` | teste le contenu de `dist/` comme s'il était en ligne |

## Partager le jeu (plus tard)

`npm run build` produit un dossier `dist/` de fichiers statiques, sans serveur
ni base de données. Il peut être déposé tel quel sur Netlify, Vercel,
Cloudflare Pages ou GitHub Pages pour obtenir une URL publique.

Les chemins produits sont **relatifs** (réglage `base: './'` dans
`vite.config.ts`), donc le jeu fonctionne aussi bien à la racine d'un domaine
que dans un sous-dossier.

---

## Pipeline d'assets 3D

**Aucun modèle n'entre dans `public/` sans passer par cette étape.**
Un modèle téléchargé pèse couramment 20 à 50 fois trop lourd pour un navigateur.

```bash
# 1. Inspecter le fichier brut (taille, triangles, textures, échelle)
npx gltf-transform inspect brut.glb

# 2. Optimiser
npx gltf-transform optimize brut.glb public/models/props/mon_objet.glb \
  --texture-compress webp --texture-size 1024

# 3. Vérifier le résultat
npx gltf-transform inspect public/models/props/mon_objet.glb
```

Exemple réel, `antique_camera.glb` :

| | Avant | Après |
|---|---|---|
| Téléchargement | 17,54 Mo | **685 Ko** |
| Mémoire graphique | 134 Mo | **33 Mo** |
| Textures | 6 × 2048 PNG | 6 × 1024 WebP |

### Règles pour les modèles

À respecter dans Blender, **avant** l'export en `.glb` :

1. **1 unité = 1 mètre**, axe Y vers le haut, origine au sol.
2. Un maillage nommé **`collision`** définit la forme solide (invisible en jeu,
   quelques centaines de triangles maximum). Sans lui, l'objet se traverse.
3. Un objet vide nommé **`anchor_<nom>`** définit un point d'ancrage (apparition
   du joueur, position d'un personnage, emplacement d'un indice). Le code lit
   ces positions au lieu de les écrire en dur.
4. Budgets : accessoire 500 à 5 000 triangles, décor 150 000 à 250 000,
   personnage 15 000 à 30 000. Textures en 1024 par défaut.

Au chargement, la console affiche un rapport pour chaque modèle (triangles,
dimensions réelles, maillages de collision, ancres) : c'est le contrôle qui
révèle immédiatement un asset mal préparé.

Tout modèle ajouté doit être crédité dans `public/models/CREDITS.md`.

## Organisation du code

```
public/          fichiers servis tels quels : modèles 3D (.glb), textures, audio
src/
  main.ts        point d'entrée du jeu
  core/          briques techniques : rendu, boucle de jeu, entrées, chargeurs GLB
  player/        le détective : caméra FPS, déplacement, collisions
  interaction/   regarder et cliquer sur les objets
  world/         les lieux en 3D, les personnages, les effets (pluie, brouillard)
  game/          les règles de l'enquête (aucun code 3D ici)
  data/          le contenu de l'affaire : indices, témoignages, dialogues
  ui/            l'interface en HTML/CSS : carnet, dialogues, menus
  audio/         gestion du son
```

Règle importante : **les fichiers de `game/` et `data/` n'importent jamais
Three.js.** Cette séparation garde la logique de l'enquête lisible et
indépendante de l'affichage.

## Dépendances

| Paquet | Rôle |
|---|---|
| `three` | le moteur 3D |
| `three-mesh-bvh` | accélère les tests de collision contre le décor |
| `@gltf-transform/cli` | *(outil, hors jeu)* optimise les modèles avant intégration |
| `vite` | serveur de développement et outil de build |
| `typescript` | vérification des types |
| `@types/three` | descriptions des types de Three.js |

Les autres dépendances seront ajoutées seulement quand une phase en aura
réellement besoin.

## Feuille de route

- [x] **Phase 1** — socle technique : projet, arborescence, build, déploiement
- [x] **Phase 2A** — socle FPS : pièce de test, caméra FPS, déplacement, gravité
- [x] **Phase 2B** — collisions réelles : capsule contre géométrie (three-mesh-bvh)
- [x] **Phase 2C** — viseur, objets observables, fiche d'information
- [x] **Phase 3** — pipeline d'assets et chargement de modèles GLB
- [ ] Phase 4 — premier personnage animé
- [ ] Phase 5 — dialogues
- [ ] Phase 6 — indices et état de l'enquête
- [ ] Phase 7 — carnet de police et sauvegarde
- [ ] Phase 8 — tranche verticale jouable
- [ ] Phases 9 à 16 — contenu, lieux, ambiance, audio, finition
