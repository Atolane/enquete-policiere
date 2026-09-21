# Les tests

## En une ligne

```
npm test
```

Rien à installer, rien à compiler, aucun navigateur. Immédiatement après un clonage.

---

## Pourquoi ce répertoire existe

Jusqu'à la Phase 8A, les contrôles de ce projet vivaient **hors du dépôt**, dans le
répertoire de travail d'une session. Ils étaient cités à chaque phase comme la garantie de
non-régression, et ils n'étaient nulle part dans l'historique. Ils dépendaient en outre d'un
Playwright installé globalement dans l'environnement : depuis un clone neuf, ils n'auraient
pas démarré.

Ce répertoire corrige cela pour la partie qui peut l'être tout de suite.

---

## Trois répertoires, trois natures

| | `unit/` | `browser/` | `mesures/` |
| --- | --- | --- | --- |
| Question posée | « est-ce toujours vrai ? » | « est-ce toujours vrai ? » | « qu'est-ce que ça donne ici ? » |
| Résultat | réussite ou échec | réussite ou échec | un nombre à lire |
| Dépend de la machine | non | un peu | **oui** |
| Compte dans la non-régression | **oui** | oui, une fois rejouée | **non** |
| Dépendances | **aucune** | Playwright | Playwright |
| Lancé par `npm test` | oui | non | non |

### `unit/` — le socle

Six suites, sans navigateur, sans serveur, sans dépendance. **159 tests, 0 échec.**

| Fichier | Ce qu'il couvre |
| --- | --- |
| `validateur.test.ts` | `validateCase` : identifiants inconnus, conditions, effets, rubriques, impasses |
| `etat.test.ts` | `GameState` : pas de doublon, humeurs, abonnés prévenus une seule fois |
| `carnet.test.ts` | `Casebook` : regroupement, changements de version, repli « Sans rubrique » |
| `sauvegarde.test.ts` | `parseSave` : défauts de forme contre identifiants disparus |
| `pistes.test.ts` | le guidage : `seenTopics`, qui est une piste et surtout qui ne l'est pas, la rubrique « À vérifier », et les sauvegardes écrites avant tout cela |
| `affaire.test.ts` | « Le dernier service » : le validateur, la taille de la tranche, la reprise d'Enzo, la retenue de Rosa, les contradictions Enzo / Aldo et Enzo / Rosa, la prudence des deux bulletins de laboratoire, les deux verrous de la contre-épreuve, les prérequis des questions tardives, et les mots qu'un témoin ne peut pas prononcer |

Les modules testés n'importent ni Three.js ni le DOM, ce qui est précisément la raison pour
laquelle ils sont testables ainsi.

### `browser/` — une suite à jour, huit héritées

`affaire.mjs` vise **l'affaire réelle** et a été écrite *et rejouée* au moment de son versement :
**204 contrôles, 0 échec**, trois exécutions de suite. C'est le scénario de référence pour la
Phase 9. Elle couvre les sept tranches et le guidage, en un seul parcours : l'agent Doyle à la porte ; le
verre renversé, la bouteille d'anisette et la trace sur l'étagère du local arrière ; le
retour chez Doyle, où le prélèvement rapporté trop tôt **ne débloque rien** ; la bouteille,
le résultat préliminaire, puis le prélèvement redonné et la contre-épreuve ; Nino Restivo ;
le registre des livraisons, Enzo Carbone et la version qu'il doit reprendre ; les livres
montrés à Nino ; Rosa Vitale, le verre et le bulletin ; enfin Aldo Maglione, ses jours de
livraison et la glace qu'il explique.

Elle éprouve trois enchaînements que rien d'autre ne couvre. Sans le détour par Nino et les
livres, la question sur la glace **n'existe pas** chez Aldo. Et la contre-épreuve exige
**deux** choses — le premier résultat *et* le prélèvement rapporté : le test vérifie les
trois états, bloqué, toujours bloqué, puis ouvert, en rouvrant deux fois l'entretien de
Doyle. Enfin, la plus longue chaîne de l'affaire : le verre présenté à Rosa lui ouvre une
question, dont la réponse en ouvre une chez Aldo — trois personnes, deux pièces, aucun
raccourci.

Elle vérifie aussi un enchaînement qui traverse trois témoins : sans le détour par Nino et
les livres de comptes, la question sur la glace **n'existe pas** chez Aldo. Le test le
contrôle dans les deux sens, avant et après.

Elle contient aussi les **cinq pièges de pilotage** que les tranches 2 et 3 ont mis au jour,
chacun commenté sur place :

| Piège | Ce qu'il donnait | La parade |
| --- | --- | --- |
| Les trajets ne contournent rien | le joueur restait coincé et visait par-dessus une cloison | des points de passage explicites, et `allerVers` annonce s'il est arrivé |
| `Escape` rend la souris | le joueur avançait tout droit sans pouvoir tourner | `reprendreLaMain()` : un clic, après le délai que Chrome impose |
| La liste des questions survit au clic | l'entretien semblait fini avant d'avoir commencé | « lire » attend d'abord qu'elle *disparaisse* |
| Trop près d'un personnage, le rayon passe au-dessus de l'épaule | le viseur restait muet, au hasard des runs | `viserJusqua()` : un pas en arrière, un pas de côté, on réessaie |
| Le panneau garde le nom du précédent interlocuteur | on prenait le souvenir du dernier entretien pour le suivant | `attendreEntretien()` : le panneau doit être *visible* et porter le bon nom |
| La liste des choix dépassait le haut de l'écran | les dernières pièces devenaient inatteignables — pour le test **et pour le joueur** | la liste défile désormais (`max-height` + `overflow-y`), et `cliquerChoix()` l'amène sous les yeux avant de cliquer |
| Les répliques défilent au même endroit | après coup il n'y a plus rien à lire | `lireEnNotant()` note chaque phrase au passage |

Les huit autres pilotent le jeu dans un vrai navigateur. Elles couvrent ce qu'aucun test
unitaire ne peut atteindre : le clavier, le pointeur, le rendu, la persistance réelle.

**Deux réserves sur les huit héritées, dites franchement.** Elles exigent Playwright, qui
n'est pas une dépendance du projet. Et elles visent encore le suspect jetable `greco`, qui
n'est plus chargé par le jeu depuis la Phase 9 : **elles échoueront en l'état** et devront
être réécrites. Elles restent versées parce qu'elles représentent un travail réel et des
motifs réutilisables — pas parce qu'elles sont prêtes.

Pour les lancer :

```
npm install --no-save playwright   # non déclaré volontairement
npx playwright install chromium
npm run dev                        # dans un autre terminal
npm run test:browser
```

### `mesures/` — des nombres, pas un verdict

Deux fichiers qui produisent des chiffres : distances parcourues, images par seconde, coût
des personnages. **Ils ne sont pas des tests** et ne comptent dans aucun total. Aucun script
ne les lance automatiquement.

---

## Les commandes

| Commande | Ce qu'elle fait |
| --- | --- |
| `npm test` | les suites unitaires. Aucune dépendance |
| `npm run typecheck` | vérifie les types de `src` |
| `npm run typecheck:tests` | vérifie les types de `tests` (config séparée, types Node) |
| `npm run check` | les trois ci-dessus, dans l'ordre |
| `npm run test:browser` | les suites navigateur, si Playwright est installé |

---

## Comment les tests unitaires importent les sources

Ils importent directement les fichiers `.ts` de `src/`, sans compilation. Deux réglages le
permettent :

- `--experimental-transform-types` : Node transforme les types à la volée. Le simple
  dépouillement (`--experimental-strip-types`) ne suffit pas, à cause des propriétés
  déclarées dans les constructeurs (`constructor(private readonly …)`).
- `tests/support/hooks.mjs` : le résolveur ESM de Node exige une extension explicite, que
  les sources n'écrivent pas. Le crochet réessaie une fois en ajoutant `.ts`. Rien d'autre.

C'est le prix à payer pour que `npm test` reste instantané et sans dépendance. Le jour où ce
bricolage coûte plus qu'il ne rapporte, la solution de repli est connue : compiler `src` vers
un répertoire temporaire avant de tester.

---

## Ce que ces tests ne remplacent pas

Ils ne voient ni le rendu, ni le confort de lecture, ni le rythme d'un dialogue. Les
**vérifications manuelles** de chaque phase restent nécessaires et restent décrites dans le
dossier de conception : ce qu'on regarde à l'écran, dans quel ordre, et ce qui doit s'y
passer. Un test dit qu'une règle tient ; il ne dit pas qu'une scène est jouable.
