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

Quatre suites, sans navigateur, sans serveur, sans dépendance :

| Fichier | Ce qu'il couvre |
| --- | --- |
| `validateur.test.ts` | `validateCase` : identifiants inconnus, conditions, effets, rubriques, impasses |
| `etat.test.ts` | `GameState` : pas de doublon, humeurs, abonnés prévenus une seule fois |
| `carnet.test.ts` | `Casebook` : regroupement, changements de version, repli « Sans rubrique » |
| `sauvegarde.test.ts` | `parseSave` : défauts de forme contre identifiants disparus |

Ces quatre modules n'importent ni Three.js ni le DOM, ce qui est précisément la raison pour
laquelle ils sont testables ainsi.

### `browser/` — hérité, et non rejoué

Huit suites qui pilotent le jeu dans un vrai navigateur. Elles couvrent ce qu'aucun test
unitaire ne peut atteindre : le clavier, le pointeur, le rendu, la persistance réelle.

**Deux réserves, dites franchement.** Elles exigent Playwright, qui n'est pas une dépendance
du projet. Et elles visent la pièce de test et le suspect jetable `greco` : elles devront
être réécrites quand la vraie affaire arrivera. Elles sont versées ici parce qu'elles
représentent un travail réel qui, sinon, serait perdu — pas parce qu'elles sont prêtes.

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
