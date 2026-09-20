# Enquête — 1948

Petit jeu d'enquête policière 3D en vue FPS, jouable dans un navigateur.
États-Unis, 1948. Ambiance film noir. Une seule affaire de meurtre.

**État actuel : Phase 7C-1 — validation complète des conditions.**
Une pièce de test en primitives (graybox), une caméra à la première personne,
le déplacement ZQSD/WASD, la gravité, de vraies collisions (murs, escalier,
rampe, passage étroit) l'observation d'objets (viseur, libellé,
fiche d'information), le chargement de vrais modèles GLB et des **personnages
humanoïdes animés** qui suivent le joueur du regard, un **système
d'interrogatoire** (questions conditionnelles, réponses jouées, gestes et
humeurs) et la **présentation d'éléments** : montrer un indice ramassé ou une
déclaration déjà entendue, et voir le personnage réagir — parfois changer de
version. Depuis la Phase 6A, **tout ce que le joueur lit d'un indice est écrit
dans `src/data/`** : la scène 3D ne fournit plus que la géométrie et un
identifiant. Depuis la 6B, l'enquête tient aussi des **faits acquis** — ce
qu'elle a établi par ailleurs, qui ouvre des questions n'ayant aucun sens
avant eux. Et depuis la 7A, tout cela se consulte : un **carnet**
s'ouvre à la touche `N`, en exploration comme au milieu d'un
interrogatoire. La 7B **conserve la partie** : on peut fermer l'onglet et
retrouver son dossier intact. Pas encore d'affaire définitive.

### Commandes en jeu

| Touche | Action |
|---|---|
| clic | prendre le contrôle de la souris |
| `Z Q S D` / `W A S D` / flèches | se déplacer |
| souris | regarder autour de soi |
| `Maj` | marcher plus vite |
| clic | examiner l'objet visé / interroger un personnage |
| `1`-`9` | choisir une question, ou un élément à présenter |
| `P` | présenter un élément pendant un entretien |
| `N` | ouvrir et refermer le carnet (même pendant un entretien) |
| molette | faire défiler le dossier |
| `Échap` | refermer le carnet, revenir aux questions, terminer l'entretien |
| `Échap` | libérer la souris |

Adresses de réglage :

| Paramètre | Effet |
|---|---|
| `?personnages=N` | 0 à 8 mannequins, pour mesurer leur coût sur sa machine |
| `?etat=1` | affiche le relevé de l'état de l'enquête (outil de contrôle) |

Exemple : `http://localhost:5173/?personnages=4&etat=1`

Le relevé d'état **n'est pas le carnet** : c'est un affichage brut et inerte,
qui sert à vérifier que ce qu'on vient de faire a bien été enregistré. Le
carnet, lui, sera un vrai objet de jeu (Phase 7).

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

### Règles pour les personnages

Un personnage se compose de **deux fichiers** :

```
public/models/characters/<nom>.glb    le corps et son squelette, SANS animation
public/models/animations/anim_library.glb   les animations, SANS corps
```

Les animations sont **partagées** : elles sont téléchargées une seule fois et
jouées sur tous les personnages. Three.js relie chaque piste à l'os portant le
même nom, donc **tous les personnages doivent partager le même squelette**.

| | Fichier unique | Séparé (notre choix) |
|---|---|---|
| 1 personnage | 464 Ko | 190 Ko |
| 5 personnages | 2,3 Mo | **630 Ko** |

Pour produire ces deux fichiers à partir d'un personnage animé :

```bash
node scripts/extract-animations.mjs source.glb <dossier> <préfixe>
```

Le script préfixe aussi tous les os par `rig_`. C'est indispensable : beaucoup
de modèles donnent le même nom à un os et au maillage qu'il déforme (« Head »
pour les deux), et l'animation se brancherait alors sur le mauvais objet.

#### Obtenir les personnages définitifs (1948)

Le mannequin actuel est un **robot d'essai**, pas un personnage du jeu. Pour les
vraies figures, la voie la plus simple est **Mixamo** (gratuit, compte Adobe) :

1. Choisir un personnage habillé sur mixamo.com, télécharger en **FBX**.
2. Prendre les animations voulues (`Idle`, `Talking`, `Head Shake`, `Thinking`,
   `Standing`) **sur le même personnage**, cochant « Without Skin » pour les
   animations.
3. Convertir en `.glb` (Blender : importer le FBX, exporter en glTF 2.0).
4. Vérifier l'échelle : 1 unité = 1 mètre, personnage entre 1,60 m et 1,90 m.
5. Passer par `extract-animations.mjs` puis par `gltf-transform optimize`.

Tous les personnages Mixamo partagent le squelette `mixamorig:` : une seule
bibliothèque d'animations suffira pour l'ensemble des suspects et témoins.

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

## Écrire un indice

Un indice est une **donnée**, pas un objet 3D qui parle. Tout ce que le joueur
lit à son sujet est écrit une seule fois, dans le catalogue de l'affaire :

```ts
// src/data/demo/greco.ts
clues: [
  {
    id: 'ashtray',
    name: 'Cendrier',                    // liste ET titre de la fiche
    prompt: 'Examiner le cendrier',      // libellé sous le viseur
    description: 'Un mégot taché de rouge à lèvres, écrasé récemment. …',
  },
]
```

La scène 3D, elle, ne dit plus que **où il se trouve** :

```ts
// src/world/scenes/TestRoomScene.ts
this.makeExaminable(ashtray, { kind: 'clue', clueId: 'ashtray' });
```

Ce n'est pas une convention qu'on peut oublier : `Interactable` est un type
union à trois cas (`clue`, `character`, `prop`), et le cas `clue` **ne possède
pas** de champ de texte. Écrire la description d'un indice dans la scène ne
compile pas.

Pourquoi cette séparation : les vrais lieux seront des fichiers `.glb` exportés
depuis Blender. On ne peut pas écrire une phrase française dans un fichier
binaire — mais on peut y nommer un emplacement.

### Deux fautes que le jeu attrape désormais tout seul

Au démarrage, `validateSceneClues()` rapproche les deux côtés et nomme le
coupable en console :

| Faute | Ce qui se passait avant | Message |
|---|---|---|
| un objet désigne un indice inexistant | le joueur le ramassait et ne pouvait jamais le présenter | `decor : un objet designe l'indice "phon", absent du catalogue` |
| un indice écrit que rien ne permet de trouver | contenu mort, enquête peut-être insoluble | `indice "phone" : aucun objet du decor ne permet de le trouver` |

Le jeu continue de tourner dans les deux cas : une fiche de secours s'affiche
plutôt qu'un panneau vide.

### Observable n'est pas indice

Tout n'est pas une preuve. Un objet peut s'examiner sans rien enregistrer : il
s'écrit alors `{ kind: 'prop', title, prompt, info }` et porte son propre texte,
puisqu'il n'appartient pas à l'affaire. À l'écran, la différence se voit : la
fiche d'un indice porte la mention « Noté au dossier » (ou « Déjà au dossier »),
celle d'un objet ordinaire n'en porte aucune.

## Écrire un fait acquis

Un **fait** est la troisième brique de l'enquête, et il faut la garder
distincte des deux autres :

| Brique | Ce que c'est | Peut être faux ? |
|---|---|---|
| un **indice** | un objet trouvé sur place | non, un objet ne ment pas |
| une **déclaration** | les mots de quelqu'un | oui, et le jeu ne le dira jamais |
| un **fait** | ce que l'enquête a établi par ailleurs | non, il est établi |

Un fait ne vient **jamais** de la parole d'un suspect. Si un personnage
l'affirme, c'est une déclaration — même s'il dit vrai. Confondre les deux
ferait du moteur le juge de la vérité, et c'est exactement ce que ce jeu ne
fait pas. Noter que `FactEntry` n'a **aucun champ de vérité**, là où
`Statement` en a un, interne.

```ts
// src/data/demo/greco.ts
facts: [
  {
    id: 'call_after_closing',
    text: 'Un appel est parti de la ligne du restaurant après vingt-deux heures.',
    topic: 'La soirée',
  },
]
```

À quoi cela sert : un fait **ouvre des questions qui n'auraient aucun sens
avant lui**. On ne demande pas à quelqu'un qui il a appelé tant que rien
n'établit qu'un appel a eu lieu.

```ts
// la question qui établit le fait
{ id: 'greco_the_call',   requires: { clues: ['phone'] },
  effects: { revealFacts: ['call_after_closing'] } }

// celle qui l'attend
{ id: 'greco_who_did_you_call', requires: { facts: ['call_after_closing'] } }
```

La différence avec `hidden` mérite d'être notée : une question `hidden`
attend qu'un `unlockTopics` l'ouvre, c'est-à-dire qu'un personnage ait mis le
sujet sur la table. Une question conditionnée par un fait s'ouvre toute
seule, dès que le dossier tient ce qu'il faut.

### Trois fautes que le validateur refuse

| Faute | Pourquoi elle est coûteuse |
|---|---|
| `revealFacts` vers un fait inexistant | enregistre un fait fantôme |
| `requires.facts` vers un fait inexistant | la question ne s'ouvre **jamais** |
| un fait que rien ne révèle | contenu mort, et il bloque silencieusement tout ce qui l'attend |

La deuxième est la pire : elle ne casse rien, elle ne dit rien, et elle
ressemble à un choix de conception.

## Écrire un interrogatoire

Les dialogues sont des **données**, pas du code. Un personnage possède une
**liste plate de questions** ; chacune porte ses conditions d'apparition, sa
réponse et ses effets. Ajouter du contenu, c'est ajouter une entrée au tableau.

```
src/data/types.ts        le format (questions, déclarations, conditions, effets)
src/data/demo/greco.ts   un suspect de TEST, jetable
src/game/dialogue.ts     le moteur : questions disponibles, effets, validateur
src/game/GameState.ts    l'état de l'enquête (aucun import de Three.js)
```

Les six comportements d'un suspect ne demandent **aucun code spécifique** :

| Comportement | Comment on l'écrit |
|---|---|
| dire la vérité | une déclaration `truth: 'true'` |
| mentir | une déclaration `truth: 'false'` — visuellement identique |
| cacher | la question a un `requires` non satisfait : elle n'apparaît pas |
| refuser | la question répond mais n'a ni `records` ni `effects` |
| esquiver | des répliques hors sujet + `beat: 'dismiss'` + `setMood` |
| changer de version | une déclaration avec `supersedes` |

### La règle qui ne se négocie pas

**Le jeu ne dit jamais qu'un personnage ment.** Le champ `truth` est interne :
l'interface ne reçoit jamais une déclaration complète, seulement une projection
qui ne contient pas ce champ. Une déclaration vraie et une déclaration fausse
produisent exactement le même affichage. C'est vérifié par des tests
automatisés, et c'est un critère de validation à chaque phase.

Corollaire d'écriture : **les innocents aussi doivent avoir des tells.** Si les
menteurs étaient nerveux et les honnêtes gens tranquilles, le joueur résoudrait
l'affaire en lisant les attitudes, sans réfléchir.

### Présenter un élément

Pendant un entretien, le joueur peut **montrer** quelque chose au personnage :
un indice qu'il a examiné, ou une déclaration qu'il a déjà entendue. Les deux
sont traités de la même façon par le moteur (`Evidence`), et **affichés de la
même façon** à l'écran.

```
clues      dans CaseData : le catalogue des indices présentables (id + nom)
reactions  dans CaseData : les réactions spécifiques, hors des questions
```

Une réaction spécifique s'écrit comme une question : elle vise un personnage,
un `clue` **ou** un `statement`, peut porter un `requires`, et produit des
`lines`, des `records` et des `effects`.

```ts
{
  character: 'greco',
  clue: 'ashtray',
  requires: { heard: ['greco_nobody_stayed'] },   // seulement après son démenti
  lines: [...],
  records: ['greco_admits_stayed'],               // sa nouvelle version
  effects: { unlock: ['greco_who_came_back'] },
}
```

**Il y a toujours une réponse.** Si aucune réaction ne correspond, le
personnage joue la `defaultReaction` de sa fiche — jamais un silence, jamais un
message d'interface. Le coût d'une preuve brandie à tort est alors volontairement
**léger, plafonné et réversible** : l'humeur passe de `neutral` à `guarded`, une
seule fois, et **aucune question ne disparaît**. L'enquête ne peut pas se
bloquer.

**Les deux versions sont conservées.** Quand une déclaration en remplace une
autre (`supersedes`), l'ancienne reste dans l'état de l'enquête et reste
présentable. Le jeu ne dit pas laquelle est la bonne ; c'est la contradiction,
pas le moteur, qui informe le joueur.

### Ce que le validateur refuse dans une condition

`Condition` a six champs. Jusqu'à la Phase 7C-1, le validateur n'en lisait que
**quatre combinaisons sur douze** — trois sur les questions, une seule sur les
réactions. Les huit autres passaient en silence, et deux d'entre elles étaient
déjà utilisées par le suspect de test.

Ces fautes-là sont les plus coûteuses parce qu'elles ne **cassent rien**. Une
question dont le prérequis n'existe pas n'apparaît simplement jamais ; une
réaction mal conditionnée laisse le personnage servir sa réponse générique. Le
jeu a l'air de fonctionner, et l'auteur cherche pendant une heure ce qu'il a
mal écrit dans son dialogue.

Les six champs sont désormais contrôlés, sur les questions **et** sur les
réactions, par une seule fonction partagée :

| Champ | Contrôle |
|---|---|
| `clues`, `facts`, `topicsAsked`, `topicsNotAsked`, `statementsHeard` | l'identifiant existe dans l'affaire |
| `mood` | la valeur est l'une des quatre humeurs possibles |

Une humeur est une **valeur**, pas un identifiant : elle est confrontée à
`MOODS`, seule liste qui fasse foi. Une humeur inventée ne lèverait aucune
erreur — la condition serait simplement toujours fausse, et la réplique jamais
jouée.

Les effets (`revealFacts`, `unlockTopics`) passent par la même mécanique, en
sens inverse : un fait révélé qui n'existe pas enregistre un fantôme.

**Deux auto-références sont signalées**, avec des messages différents parce
qu'elles n'ont pas la même gravité :

| Forme | Effet | Traitement |
|---|---|---|
| `topicsAsked` contient son propre `id` | la question exige d'avoir déjà été posée : **elle n'apparaîtra jamais** | faute franche |
| `topicsNotAsked` contient son propre `id` | sans danger : c'est ce que `once: true` fait déjà | signalé comme redondance |

## Lire le dossier

La touche `N` ouvre le carnet — en exploration **et** au milieu d'un
interrogatoire, parce que relire une déclaration avant de décider quoi demander
est le geste central du genre. `N` ou `Échap` le referment, et on retrouve
exactement ce qu'on avait quitté, entretien en cours compris.

Le carnet range les trois briques de l'enquête, et rien d'autre :

| Rubrique | Groupée par |
|---|---|
| Indices | rubrique de l'indice (`ClueEntry.topic`) |
| Déclarations | personne, avec sa qualité ; chaque entrée porte son sujet |
| Faits acquis | rubrique du fait (`FactEntry.topic`) |

### Le carnet ne résout rien. Il présente.

C'est la règle de la phase, et elle a des conséquences visibles. Le carnet
**ne trie pas** (l'ordre est celui dans lequel le joueur a appris les choses),
**ne rapproche rien** entre indices et déclarations, **ne souligne rien**.

Quand un témoin s'est reprise, les deux versions apparaissent dans la même
entrée, dans l'ordre où il les a dites, séparées par un discret « Puis ». C'est
un constat de chronologie — ce que le joueur a entendu de ses oreilles — et les
deux textes portent **exactement le même balisage**. Rien ne dit laquelle était
fausse : le carnet ne le sait pas, et ce n'est pas son travail.

Quatre choses n'y figurent pas, volontairement : l'**humeur** des personnages
(ce serait un jugement du moteur sur quelqu'un, alors que lire les gens est le
travail du joueur), les **questions déjà posées** (une liste de courses, pas un
dossier), les **identifiants techniques** et tout **score**. Elles restent
visibles dans le relevé `?etat=1`, qui sert aux tests.

### La partie est conservée

Chaque changement d'état est écrit dans `localStorage`, sous une seule clé
(`enquete-1948:partie`). La sauvegarde est un `JSON.stringify` de
`InvestigationState` — rien de plus, parce que cet objet n'a jamais contenu
autre chose que des identifiants et des chaînes.

```
src/game/save.ts
  ├─ serialise(state)            l'état → une chaîne JSON
  ├─ parseSave(texte, caseData)  une chaîne → un état PROPRE, ou null (pure)
  └─ class SaveSlot              les trois seuls appels à localStorage
```

**Ce qui n'est pas sauvegardé, et pourquoi :**

| Non conservé | Raison |
|---|---|
| la position du joueur | une coordonnée n'a de sens que dans un décor, et les vrais lieux remplaceront la pièce de test. Restaurer `x -4,5` dans un décor qui a changé, c'est se retrouver dans un mur. On réapparaît au point de départ |
| l'entretien en cours | sa file de répliques vit dans `Interrogation`. Recharger ne perd que les lignes en train de défiler : `askedTopics` et `records` sont écrits dès qu'une question est appliquée |
| le mode de jeu | on revient toujours en exploration |
| le champ `truth` | il n'est dans aucun des huit champs. Ouvrir la sauvegarde dans la console ne révèle donc pas qui mentait |

**La règle qui gouverne `save.ts` : une sauvegarde abîmée ne doit jamais
empêcher de jouer.** Au pire on repart de zéro, mais on le dit — rien n'est
jeté en silence.

| Ce qui arrive | Ce qui se passe |
|---|---|
| `localStorage` indisponible (navigation privée, quota) | le jeu démarre, un avertissement **unique**, et le carnet prévient que rien ne sera conservé |
| version de format différente | refusée en nommant les deux versions, partie neuve. **On ne migre pas** : une migration jamais testée est plus dangereuse qu'un redémarrage annoncé |
| JSON illisible, ou pas un objet | refusé, partie neuve |
| un champ absent ou du mauvais type | ce champ seul repart vide, le reste de la progression est gardé |
| des identifiants qui n'existent plus | écartés un par un, comptés et nommés. C'est le cas le plus probable : Greco est jetable, et toute partie existante citera des `greco_*` le jour où il disparaîtra |

Deux onglets ouverts sur la même partie : le dernier qui écrit gagne.
Limitation assumée.

Pour repartir de zéro : « Recommencer l'enquête », en pied de carnet, avec une
confirmation en deux temps. L'armement retombe dès que le carnet se referme —
on ne laisse pas un bouton destructeur armé dans le dos du joueur.

### Priorités clavier

Trois composants écoutent le clavier. À tout instant, un seul est réveillé pour
une touche donnée — c'est ce qui rend l'ordre d'inscription des écouteurs sans
importance :

| Composant | Touches | Endormi par |
|---|---|---|
| `Input` | déplacement | `setEnabled(false)` dès qu'un panneau s'ouvre |
| `DialogueUI` | `Échap`, `1`-`9`, `P`, Espace | `setSuspended(true)` quand le carnet s'ouvre par-dessus |
| `Game` | `N` toujours, `Échap` seulement carnet ouvert | — |

Sans ce sommeil explicite, `Échap` sur un carnet ouvert pendant un entretien
aurait mis fin à l'entretien : l'écouteur de `DialogueUI` est installé avant
celui de `Game` et l'aurait reçu le premier. C'est plus verbeux qu'un
`stopImmediatePropagation()`, et beaucoup plus facile à relire.

Le carnet met aussi l'entretien **réellement** en pause : sans cela, les
silences continueraient de s'écouler et les répliques de défiler derrière lui.

### Où le code se trouve

```
src/game/Casebook.ts   assemble le dossier (aucun DOM, aucun Three.js)
src/ui/Notebook.ts     le dessine (ne connaît ni l'état ni le moteur)
src/game/save.ts       conserve et relit la partie
```

Même séparation que `Interrogation` / `DialogueUI`. Le carnet ne touche pas au
clavier : c'est `Game.ts` qui arbitre, seul.

## Organisation du code

```
public/          fichiers servis tels quels : modèles 3D (.glb), textures, audio
src/
  main.ts        point d'entrée du jeu
  core/          briques techniques : rendu, boucle de jeu, entrées, chargeurs GLB
  player/        le détective : caméra FPS, déplacement, collisions
  interaction/   regarder et cliquer sur les objets
  world/         les lieux en 3D, les personnages, les effets (pluie, brouillard)
  game/          les règles de l'enquête (aucun code 3D ici) : état, dialogues
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
- [x] **Phase 4** — personnages animés : squelette, fondus, regard, coût mesuré
- [x] **Phase 5A** — interrogatoires : moteur de dialogue, gestes, humeurs
- [x] **Phase 5B** — présenter un indice, réactions, changement de version
- [x] **Phase 6A** — l'indice devient une donnée : source unique, contrôle croisé
- [x] **Phase 6B** — les faits acquis : catalogue, validation, conditions
- [x] **Phase 7A** — le carnet : dossier consultable, rubriques, priorités clavier
- [x] **Phase 7B** — sauvegarde et reprise, tolérante aux sauvegardes abîmées
- [x] **Phase 7C-1** — validation complète des conditions et des effets
- [ ] Phase 7C-2 — rubriques d'indices : catalogue de lieux
- [ ] Phase 8 — tranche verticale jouable
- [ ] Phases 9 à 16 — contenu, lieux, ambiance, audio, finition
