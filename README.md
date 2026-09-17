# Enquête — 1948

Petit jeu d'enquête policière 3D en vue FPS, jouable dans un navigateur.
États-Unis, 1948. Ambiance film noir. Une seule affaire de meurtre.

**État actuel : Phase 2A — socle FPS.**
Une pièce de test en primitives (graybox), une caméra à la première personne,
le déplacement ZQSD/WASD et une gravité simple. Pas encore d'interactions,
de personnages ni d'enquête.

### Commandes en jeu

| Touche | Action |
|---|---|
| clic | prendre le contrôle de la souris |
| `Z Q S D` / `W A S D` / flèches | se déplacer |
| souris | regarder autour de soi |
| `Maj` | marcher plus vite |
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

## Organisation du code

```
public/          fichiers servis tels quels : modèles 3D (.glb), textures, audio
src/
  main.ts        point d'entrée du jeu
  core/          briques techniques : rendu, boucle de jeu, entrées, chargeurs
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
| `vite` | serveur de développement et outil de build |
| `typescript` | vérification des types |
| `@types/three` | descriptions des types de Three.js |

Les autres dépendances seront ajoutées seulement quand une phase en aura
réellement besoin.

## Feuille de route

- [x] **Phase 1** — socle technique : projet, arborescence, build, déploiement
- [x] **Phase 2A** — socle FPS : pièce de test, caméra FPS, déplacement, gravité
- [ ] **Phase 2B** — vraies collisions, viseur, interaction avec un objet
- [ ] Phase 3 — chargement de modèles GLB
- [ ] Phase 4 — premier personnage animé
- [ ] Phase 5 — dialogues
- [ ] Phase 6 — indices et état de l'enquête
- [ ] Phase 7 — carnet de police et sauvegarde
- [ ] Phase 8 — tranche verticale jouable
- [ ] Phases 9 à 16 — contenu, lieux, ambiance, audio, finition
