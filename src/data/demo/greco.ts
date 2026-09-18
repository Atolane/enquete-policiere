/* ===================================================================
   src/data/demo/greco.ts

   SUSPECT DE TEST -- JETABLE.

   Ce contenu sert uniquement a eprouver le moteur d'interrogatoire.
   Il n'appartient pas a l'affaire definitive, qui sera ecrite en
   Phase 9. Ne pas y investir de travail d'ecriture.

   Il couvre volontairement les cinq comportements de la Phase 5A :
     verite, mensonge, dissimulation, refus, esquive.

   -------------------------------------------------------------------
   REGLE D'ECRITURE A NE JAMAIS OUBLIER
   -------------------------------------------------------------------
   Greco livre son plus GROS MENSONGE avec assurance, et sa verite la
   plus SINCERE en bafouillant.

   C'est deliberé. Si les menteurs etaient nerveux et les honnetes
   gens tranquilles, le joueur aurait resolu l'affaire en dix minutes
   sans reflechir : il lui suffirait de lire les attitudes. Le
   comportement doit etre un indice AMBIGU, jamais une preuve.
   =================================================================== */

import type { CaseData } from '../types';

const GRECO = 'greco';

export const demoCase: CaseData = {
  characters: [
    {
      id: GRECO,
      name: 'Salvatore Greco',
      role: 'gérant du restaurant',
      initialMood: 'neutral',
    },
  ],

  /* --- Les declarations -------------------------------------------
     Le champ "truth" est INTERNE. Rien, dans l'interface, ne permet de
     distinguer une declaration vraie d'une declaration fausse. */
  statements: [
    {
      id: 'greco_closed_2130',
      speaker: GRECO,
      text: "J'ai fermé à neuf heures et demie, comme tous les soirs.",
      topic: 'Emploi du temps',
      claimedTime: '21:30',
      truth: 'false', // il a fermé bien plus tard
    },
    {
      id: 'greco_only_regulars',
      speaker: GRECO,
      text: "Il ne restait que des habitués, ce soir-là. Personne d'inhabituel.",
      topic: 'Les gens',
      truth: 'partial',
    },
    {
      id: 'greco_knew_alfieri',
      speaker: GRECO,
      text: "Je connaissais Bruno Alfieri depuis 1931. On a grandi dans la même rue.",
      topic: 'La victime',
      truth: 'true', // vrai, et pourtant dit en bafouillant
    },
    {
      id: 'greco_nobody_stayed',
      speaker: GRECO,
      text: "Personne n'est resté après la fermeture. J'ai éteint et je suis monté.",
      topic: 'Emploi du temps',
      claimedTime: '21:35',
      truth: 'false',
    },
    {
      id: 'greco_typewriter_his',
      speaker: GRECO,
      text: "La machine à écrire est à moi. Je fais mes commandes dessus.",
      topic: 'Les faits',
      truth: 'partial',
    },
  ],

  topics: [
    /* ---------- 1. Ouverture : un MENSONGE, dit avec aplomb -------- */
    {
      id: 'greco_evening',
      speaker: GRECO,
      question: 'Racontez-moi votre soirée.',
      category: 'ouverture',
      lines: [
        {
          speaker: GRECO,
          text: "Rien à raconter, inspecteur. Service jusqu'à neuf heures, "
            + "un dernier café, et j'ai baissé le rideau.",
        },
        {
          speaker: GRECO,
          text: "J'ai fermé à neuf heures et demie. Comme tous les soirs depuis onze ans.",
        },
      ],
      records: ['greco_closed_2130'],
    },

    /* ---------- 2. Une demi-verite, sans emotion particuliere ------ */
    {
      id: 'greco_who_was_there',
      speaker: GRECO,
      question: 'Qui était encore dans la salle en fin de service ?',
      category: 'les gens',
      lines: [
        {
          speaker: GRECO,
          text: "Les habitués. Le vieux Fanelli, les deux frères du garage. "
            + "Ils partent toujours avant la fermeture.",
        },
        { speaker: GRECO, text: "Personne d'inhabituel.", beat: 'agree' },
      ],
      records: ['greco_only_regulars'],
    },

    /* ---------- 3. La VERITE, et il la dit tres mal ---------------- */
    {
      id: 'greco_victim',
      speaker: GRECO,
      question: 'Depuis quand connaissiez-vous Bruno Alfieri ?',
      category: 'les gens',
      lines: [
        { speaker: GRECO, text: "…Bruno.", pause: 1.4, beat: 'think' },
        {
          speaker: GRECO,
          text: "Depuis… trente et un. Trente et un ou trente-deux. "
            + "On a grandi dans la même rue, vous savez.",
          pause: 0.8,
        },
        {
          speaker: GRECO,
          text: "Excusez-moi. Ça fait beaucoup, d'un coup.",
          pause: 0.6,
        },
      ],
      records: ['greco_knew_alfieri'],
      // Il est bouleverse -- et il dit vrai. Le joueur ne doit pas
      // pouvoir en conclure quoi que ce soit.
      effects: { setMood: 'nervous' },
    },

    /* ---------- 4. ESQUIVE : il parle, mais d'autre chose ---------- */
    {
      id: 'greco_business',
      speaker: GRECO,
      question: 'De quoi vivait exactement ce restaurant ?',
      category: 'les faits',
      lines: [
        {
          speaker: GRECO,
          text: "De quoi vit un restaurant ? De gens qui ont faim.",
          beat: 'dismiss',
        },
        {
          speaker: GRECO,
          text: "Le quartier a changé, remarquez. Avant la guerre, on faisait "
            + "cent couverts le dimanche. Aujourd'hui…",
        },
      ],
      // Aucun records, aucun fait revele : le joueur n'apprend RIEN.
      effects: { setMood: 'guarded' },
      once: false, // il esquivera encore, on peut insister
    },

    /* ---------- 5. REFUS : il ne repond pas -------------------------- */
    {
      id: 'greco_record',
      speaker: GRECO,
      question: 'Vous avez déjà eu affaire à nous, en 1943.',
      category: 'pression',
      lines: [
        { speaker: GRECO, text: "Non.", pause: 0.5, beat: 'deny' },
        { speaker: GRECO, text: "Je n'ai rien à dire là-dessus." },
      ],
      // Ni declaration, ni effet : refus pur.
      once: false,
    },

    /* ---------- 6. DISSIMULATION : la question n'existe pas
           tant que le joueur n'a pas trouve le cendrier --------------- */
    {
      id: 'greco_after_closing',
      speaker: GRECO,
      question: 'Quelqu’un a fumé ici après la fermeture.',
      category: 'pression',
      requires: { clues: ['ashtray'] },
      lines: [
        { speaker: GRECO, text: "Non.", beat: 'deny' },
        {
          speaker: GRECO,
          text: "Personne n'est resté. J'ai éteint les néons et je suis monté chez moi.",
        },
      ],
      records: ['greco_nobody_stayed'],
      effects: { setMood: 'guarded' },
    },

    /* ---------- 7. DISSIMULATION : debloquee par le rapport --------- */
    {
      id: 'greco_typewriter',
      speaker: GRECO,
      question: 'À qui appartient la machine à écrire de l’arrière-salle ?',
      category: 'les faits',
      requires: { clues: ['report'] },
      lines: [
        {
          speaker: GRECO,
          text: "À moi. Je fais mes commandes dessus, mes courriers.",
          beat: 'agree',
        },
        { speaker: GRECO, text: "Pourquoi cette question ?", pause: 0.6 },
      ],
      records: ['greco_typewriter_his'],
    },

    /* ---------- 8. RELANCE permanente : le joueur n'est jamais
           bloque devant un suspect muet ------------------------------- */
    {
      id: 'greco_anything_else',
      speaker: GRECO,
      question: 'Autre chose à ajouter ?',
      category: 'ouverture',
      lines: [
        { speaker: GRECO, text: "Non, inspecteur. Rien qui vous serve." },
      ],
      once: false,
    },
  ],
};
