/* ===================================================================
   src/data/cases/dernier-service.ts

   « LE DERNIER SERVICE » -- l'affaire, premiere tranche.

   Boston, samedi 13 novembre 1948. Victor Bellini, comptable, a ete
   trouve mort a son bureau au petit matin. L'inspecteur arrive.

   -------------------------------------------------------------------
   CE QUE CETTE TRANCHE CONTIENT, ET POURQUOI SI PEU
   -------------------------------------------------------------------
   Un seul temoin : Nino Restivo, commis de cuisine, dix-neuf ans. Trois
   indices du bureau. C'est volontairement court -- l'affaire complete
   compte cinq personnages et une vingtaine d'indices, et la construire
   d'un bloc reviendrait a decouvrir toutes ses fautes en meme temps.

   Nino d'abord parce qu'il est le plus simple et le plus utile : il ne
   ment que sur une chose sans importance, et il livre trois
   renseignements dont l'enquete ne peut pas se passer.

   -------------------------------------------------------------------
   LA REGLE QUI GOUVERNE CHAQUE MOT ECRIT ICI
   -------------------------------------------------------------------
   Un renseignement n'est JAMAIS plus precis que ce que sa source peut
   honnetement fournir.

   Nino est parti a 21 h 50 : il sait donc ce qui s'est passe AVANT, et
   rien de ce qui a suivi. Il ne peut pas dire que Rosa est revenue --
   il etait dehors. Il ne peut pas dire ce qui a brule dans le poele --
   il voit des cendres, c'est tout. Et il ne peut pas nommer le produit
   qu'il a vu prendre dans le local : il a vu un geste, pas une
   etiquette.

   Ces trois interdits ne sont pas des scrupules d'auteur. Si Nino
   nommait la mort-aux-rats, le joueur obtiendrait de lui, d'un seul
   coup, ce que l'affaire lui demande de construire en trois etapes.

   -------------------------------------------------------------------
   CE QUI N'EST PAS ENCORE LA
   -------------------------------------------------------------------
   Enzo, Rosa, Aldo, l'agent Doyle. Le laboratoire. La cave. La
   conclusion. Les decors reels -- les licences d'assets ne sont pas
   reglees, et rien n'entrera dans public/ avant qu'elles le soient.
   =================================================================== */

import type { CaseData } from '../types';

export const dernierService: CaseData = {
  // --- Qui ----------------------------------------------------------
  characters: [
    {
      id: 'nino',
      name: 'Nino Restivo',
      role: 'Commis de cuisine',
      initialMood: 'nervous',
      /* Il a dix-neuf ans et un inspecteur devant lui. Il commence
         donc nerveux, pas neutre : c'est son etat naturel ici, pas une
         reaction a ce que le joueur ferait. */
      defaultReaction: [
        { speaker: 'nino', text: 'Ça… je sais pas ce que c’est, monsieur.', beat: 'dismiss' },
      ],
    },
  ],

  // --- Ce qu'on ramasse ---------------------------------------------
  /* Une seule rubrique pour l'instant : les trois indices de cette
     tranche sont tous dans le bureau. « Le couloir », « La salle », « La
     cuisine » et « Le local arriere » viendront avec leurs objets, pas
     avant -- une rubrique vide n'est pas une faute, mais c'est une
     promesse que le carnet ne tient pas encore. */
  clueRubrics: [{ id: 'bureau', label: 'Le bureau' }],

  clues: [
    {
      id: 'verre_renverse',
      name: 'Un verre renversé',
      prompt: 'Examiner le verre',
      description: 'Un verre couché sur le sous-main, un fond de liquide séché au bord.',
      rubric: 'bureau',
    },
    {
      id: 'livres_comptes',
      name: 'Les livres de comptes',
      prompt: 'Examiner les livres',
      description:
        'Les comptes du restaurant, tenus à la main. Une page est restée ouverte sur les ' +
        'achats de l’année : un fournisseur y revient tous les mois, Adriatica Fish & Ice.',
      rubric: 'bureau',
    },
    {
      id: 'combine_decroche',
      name: 'Le combiné décroché',
      prompt: 'Examiner le téléphone',
      description:
        'Le combiné pend au bout de son fil, à côté du fauteuil. Personne ne l’a raccroché.',
      rubric: 'bureau',
    },
  ],

  // --- Ce qu'on apprend ---------------------------------------------
  facts: [
    {
      id: 'fait_nino_parti',
      text: 'Nino a quitté le restaurant à dix heures moins dix.',
      topic: 'La nuit du 12',
    },
    {
      id: 'fait_rosa_a_renvoye_nino',
      text: 'Rosa a demandé à Nino de partir avant l’heure, ce soir-là.',
      topic: 'La nuit du 12',
    },
    {
      id: 'fait_deux_cles',
      text: 'Le local arrière ferme à clé. Deux personnes en ont une : le patron et le gérant.',
      topic: 'Le local arrière',
    },
    {
      id: 'fait_nino_a_vu',
      text: 'Nino a vu le gérant prendre quelque chose dans le local, quelques jours plus tôt.',
      topic: 'Le local arrière',
    },
    {
      id: 'fait_cendres',
      text:
        'Le poêle du couloir, vidé le 11 novembre, contenait des cendres le 13 au matin.',
      topic: 'La nuit du 12',
    },
    {
      id: 'fait_glace_impossible',
      text:
        'Les quantités de glace facturées par Adriatica dépassent de loin ce qu’un ' +
        'restaurant de cette taille peut consommer.',
      topic: 'Les comptes',
    },
  ],

  // --- Ce qu'il dit --------------------------------------------------
  statements: [
    {
      id: 'nino_soiree',
      speaker: 'nino',
      text: 'Service normal. Vendredi, c’est plein. J’ai fait la plonge jusqu’à la fin.',
      topic: 'Emploi du temps',
      truth: 'true',
    },
    {
      id: 'nino_2150',
      speaker: 'nino',
      text: 'Je suis parti à dix heures moins dix. D’habitude c’est dix heures.',
      topic: 'Emploi du temps',
      claimedTime: '21:50',
      truth: 'true',
    },
    {
      id: 'nino_rosa_filer',
      speaker: 'nino',
      text: 'Rosa m’a dit de filer. Qu’elle fermerait. Elle fait jamais ça.',
      topic: 'Les gens',
      truth: 'true',
    },
    {
      /* LE MENSONGE DE NINO. Il est derisoire, et c'est tout son
         interet : le joueur decouvre qu'un temoin lui a menti, et
         apprend du meme coup qu'un mensonge n'est pas un aveu. C'est
         l'inoculation dont il aura besoin pour Rosa. */
      id: 'nino_sac_rien',
      speaker: 'nino',
      text: 'Mon sac ? Rien. Mes affaires. J’emporte jamais rien d’ici.',
      topic: 'Les gens',
      truth: 'false',
    },
    {
      id: 'nino_local',
      speaker: 'nino',
      text:
        'J’ai vu monsieur Carbone au fond, l’autre jour. Il a pris quelque chose sur ' +
        'l’étagère du haut. J’ai rien demandé, c’est pas mes affaires.',
      topic: 'Le local arrière',
      truth: 'true',
    },
    {
      id: 'nino_poele',
      speaker: 'nino',
      text:
        'Le poêle, je l’ai vidé jeudi. Ce matin il était plein de cendres. Personne ' +
        'l’allume en novembre, on a le fourneau.',
      topic: 'La maison',
      truth: 'true',
    },
  ],

  // --- Ce qu'on lui demande -------------------------------------------
  topics: [
    {
      /* QUESTION DE RELANCE. Sans condition et reposable : le
         validateur en exige une par personnage, faute de quoi le
         joueur peut se retrouver devant un temoin muet sans
         comprendre pourquoi. */
      id: 'nino_relance',
      speaker: 'nino',
      question: 'Autre chose ?',
      category: 'ouverture',
      once: false,
      lines: [
        { speaker: 'detective', text: 'Autre chose qui vous revient ?' },
        { speaker: 'nino', text: 'Non, monsieur. Je crois pas.', beat: 'think' },
      ],
    },
    {
      id: 'nino_soiree',
      speaker: 'nino',
      question: 'Racontez-moi votre soirée.',
      category: 'ouverture',
      lines: [
        { speaker: 'detective', text: 'Racontez-moi votre soirée d’hier.' },
        {
          speaker: 'nino',
          text: 'Service normal. Vendredi, c’est plein. J’ai fait la plonge jusqu’à la fin.',
        },
      ],
      records: ['nino_soiree'],
    },
    {
      id: 'nino_heure',
      speaker: 'nino',
      question: 'À quelle heure êtes-vous parti ?',
      category: 'emploi du temps',
      lines: [
        { speaker: 'detective', text: 'À quelle heure êtes-vous parti ?' },
        {
          speaker: 'nino',
          text: 'Je suis parti à dix heures moins dix.',
          pause: 0.4,
        },
        { speaker: 'nino', text: 'D’habitude c’est dix heures.', beat: 'think' },
      ],
      records: ['nino_2150'],
      effects: { revealFacts: ['fait_nino_parti'], unlockTopics: ['nino_pourquoi_tot'] },
    },
    {
      /* Masquee jusqu'a ce que Nino ait lui-meme signale l'anomalie.
         Le joueur ne peut pas demander « pourquoi si tot » avant de
         savoir que c'etait tot. */
      id: 'nino_pourquoi_tot',
      speaker: 'nino',
      question: 'Pourquoi plus tôt que d’habitude ?',
      category: 'emploi du temps',
      hidden: true,
      lines: [
        { speaker: 'detective', text: 'Pourquoi plus tôt, ce soir-là ?' },
        {
          speaker: 'nino',
          text: 'Rosa m’a dit de filer. Qu’elle fermerait.',
        },
        { speaker: 'nino', text: 'Elle fait jamais ça.', beat: 'think', pause: 0.5 },
      ],
      records: ['nino_rosa_filer'],
      effects: { revealFacts: ['fait_rosa_a_renvoye_nino'] },
    },
    {
      id: 'nino_sac',
      speaker: 'nino',
      question: 'Qu’y avait-il dans votre sac ?',
      category: 'pression',
      lines: [
        { speaker: 'detective', text: 'Vous êtes parti avec un sac. Qu’y avait-il dedans ?' },
        { speaker: 'nino', text: 'Mon sac ? Rien. Mes affaires.', beat: 'deny', pause: 0.6 },
        { speaker: 'nino', text: 'J’emporte jamais rien d’ici.' },
      ],
      records: ['nino_sac_rien'],
      effects: { setMood: 'guarded' },
    },
    {
      id: 'nino_cles',
      speaker: 'nino',
      question: 'Qui a la clé du local arrière ?',
      category: 'les faits',
      lines: [
        { speaker: 'detective', text: 'Le local, au fond. Qui en a la clé ?' },
        {
          speaker: 'nino',
          text: 'Monsieur Maglione et monsieur Carbone. Moi je demande quand j’ai besoin.',
        },
      ],
      effects: { revealFacts: ['fait_deux_cles'], unlockTopics: ['nino_local'] },
    },
    {
      id: 'nino_local',
      speaker: 'nino',
      question: 'Avez-vous vu quelqu’un entrer dans le local ?',
      category: 'les faits',
      hidden: true,
      lines: [
        { speaker: 'detective', text: 'Vous avez vu quelqu’un y entrer, récemment ?' },
        {
          speaker: 'nino',
          text: 'J’ai vu monsieur Carbone au fond, l’autre jour. Il a pris quelque chose sur l’étagère du haut.',
        },
        {
          speaker: 'nino',
          text: 'J’ai rien demandé. C’est pas mes affaires.',
          beat: 'dismiss',
        },
      ],
      records: ['nino_local'],
      effects: { revealFacts: ['fait_nino_a_vu'] },
    },
    {
      id: 'nino_poele',
      speaker: 'nino',
      question: 'Le poêle du couloir.',
      category: 'les faits',
      lines: [
        { speaker: 'detective', text: 'Le poêle, dans le couloir. Qui s’en occupe ?' },
        { speaker: 'nino', text: 'Moi. Je l’ai vidé jeudi.' },
        {
          speaker: 'nino',
          text: 'Ce matin il était plein de cendres. Personne l’allume en novembre, on a le fourneau.',
          beat: 'think',
        },
      ],
      records: ['nino_poele'],
      effects: { revealFacts: ['fait_cendres'] },
    },
  ],

  // --- Ce qu'il dit devant un objet -----------------------------------
  reactions: [
    {
      character: 'nino',
      clue: 'livres_comptes',
      lines: [
        { speaker: 'detective', text: 'Adriatica Fish & Ice. Ça vous dit quelque chose ?' },
        { speaker: 'nino', text: 'La glace, c’est moi qui la rentre.' },
        {
          speaker: 'nino',
          text: 'Mais pas autant. Jamais autant. On en prend deux blocs, trois quand il fait chaud.',
          beat: 'think',
        },
      ],
      effects: { revealFacts: ['fait_glace_impossible'] },
    },
    {
      character: 'nino',
      clue: 'combine_decroche',
      lines: [
        { speaker: 'detective', text: 'Le téléphone était décroché.' },
        {
          speaker: 'nino',
          text: 'Il appelait tard, des fois. Mais moi je suis en cuisine, j’entends rien.',
        },
      ],
    },
    {
      character: 'nino',
      clue: 'verre_renverse',
      lines: [
        { speaker: 'detective', text: 'Ce verre.' },
        { speaker: 'nino', text: 'Il buvait dans le sien. Il l’aimait pas, notre verrerie.' },
        { speaker: 'nino', text: 'Il gardait sa bouteille dans le tiroir.', beat: 'think' },
      ],
    },
  ],
};
