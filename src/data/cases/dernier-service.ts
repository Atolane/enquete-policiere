/* ===================================================================
   src/data/cases/dernier-service.ts

   « LE DERNIER SERVICE » -- l'affaire, tranches 1 a 3.

   Boston, samedi 13 novembre 1948. Victor Bellini, comptable, a ete
   trouve mort a son bureau au petit matin. L'inspecteur arrive.

   -------------------------------------------------------------------
   CE QUE CE FICHIER CONTIENT AUJOURD'HUI
   -------------------------------------------------------------------
   Trois temoins, construits l'un apres l'autre :

     Nino Restivo, commis, dix-neuf ans. Il ne ment que sur une chose
     sans importance, et il livre trois renseignements dont l'enquete
     ne peut pas se passer.

     Enzo Carbone, gerant. Il ne cede pas, il ajuste : confronte au
     registre, il ne retire pas sa premiere version, il en donne une
     seconde. Le carnet garde les deux.

     Rosa Vitale, chef de salle. Elle repond a tout, poliment. C'est
     elle qui a ferme, elle qui a renvoye le petit, elle qui portait
     l'anisette -- et rien de ce qu'elle dit ici ne permet encore de
     l'inquieter. C'est exactement ce qu'on attend d'elle a ce stade.

     Le poele du couloir, entre l'escalier et le local. Des cendres
     froides, et un angle de papier qui n'a pas brule : des lignes
     bleues, des colonnes. Il dit de quoi etait fait ce qui a brule. Il
     ne dit pas ce qui y etait ecrit, ni qui a craque l'allumette.

     Le local arriere, ouvert par la police, et ce qu'on trouve sur
     son etagere haute : un rond de poussiere. Il dit qu'un recipient
     est reste la longtemps et qu'il n'y est plus. Il ne dit pas
     lequel.

     L'agent Doyle, qui garde la porte. Il n'est pas un suspect : il
     est arrive apres. Il est la voie par laquelle une bouteille
     ramassee au pied d'une table devient un resultat de laboratoire
     -- preliminaire, sans quantite, sans date et sans nom.

     Aldo Maglione, neveu du patron, qui tient les ecritures. Le seul
     des quatre qui n'etait pas la cette nuit-la, et il le dit tout de
     suite. Il explique volontiers, il donne des chiffres, il enonce
     lui-meme les regles qu'il suit. Un joueur attentif repartira avec
     deux phrases qui ne s'accordent pas -- celle d'Enzo sur le jour de
     livraison et la sienne -- sans que rien ni personne les lui ait
     signalees.

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

   La meme regle, retournee, gouverne Rosa : elle ne dit que ce qu'une
   femme irreprochable dirait. Un temoin qui se trahirait au premier
   entretien ne serait pas un suspect, seulement un decor.

   -------------------------------------------------------------------
   CE QUI N'EST PAS ENCORE LA
   -------------------------------------------------------------------
   Ce que Rosa a reellement fait de sa nuit, et ce qu'Aldo fait
   reellement de ses ecritures. Les epilogues. La conclusion. Les decors reels -- les
   licences d'assets ne sont pas reglees, et rien n'entrera dans
   public/ avant qu'elles le soient.
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
    {
      id: 'rosa',
      name: 'Rosa Vitale',
      role: 'Chef de salle',
      /* Elle commence NEUTRE, et c'est le plus inquietant des trois.
         Nino a peur, Enzo se ferme ; Rosa repond. Poliment, sans se
         derober, avec la fatigue de quelqu'un qui a servi jusqu'a onze
         heures du soir. Rien dans son humeur ne la designe, et c'est
         voulu : le joueur doit pouvoir la croire. */
      initialMood: 'neutral',
      defaultReaction: [
        { speaker: 'rosa', text: 'Je l’ai vu cent fois. Je ne sais pas quoi vous en dire.' },
      ],
    },
    {
      id: 'aldo',
      name: 'Aldo Maglione',
      role: 'Neveu du patron, tient les écritures',
      /* NEUTRE, et bavard. Il explique avant qu'on demande, il donne
         des details qu'on ne lui reclame pas -- ce qui passe tres bien
         pour de la bonne volonte. C'est le seul des quatre qui n'etait
         pas la cette nuit-la, et il le dit tout de suite. Rien, a ce
         stade, ne doit permettre de le distinguer d'un neveu serviable
         qui tient les comptes de son oncle. */
      initialMood: 'neutral',
      defaultReaction: [
        { speaker: 'aldo', text: 'Ça ne me parle pas. Moi je vois des chiffres, pas des choses.' },
      ],
    },
    {
      id: 'doyle',
      name: 'Agent Doyle',
      role: 'Police de Boston',
      /* Il n'est pas un suspect et il ne le sera jamais : il est
         arrive apres. Son interet est ailleurs -- c'est par lui que
         passent les choses que l'inspecteur ne peut pas constater
         seul, et il les rapporte avec la prudence d'un homme qui a vu
         des rapports se faire demolir au tribunal. */
      initialMood: 'neutral',
      defaultReaction: [
        { speaker: 'doyle', text: 'C’est votre affaire, inspecteur. Moi je garde la porte.' },
      ],
    },
    {
      id: 'enzo',
      name: 'Enzo Carbone',
      role: 'Gérant',
      /* Il commence FERME, pas nerveux. Nino a peur d'un inspecteur ;
         Enzo, lui, sait exactement ce qu'il a a cacher, et depuis
         dix-sept ans il a appris a ne rien laisser voir. */
      initialMood: 'guarded',
      defaultReaction: [
        { speaker: 'enzo', text: 'Je ne vois pas ce que vous voulez que ça me dise.' },
      ],
    },
  ],

  // --- Ce qu'on ramasse ---------------------------------------------
  /* Une seule rubrique pour l'instant : les trois indices de cette
     tranche sont tous dans le bureau. « Le couloir », « La salle », « La
     cuisine » et « Le local arriere » viendront avec leurs objets, pas
     avant -- une rubrique vide n'est pas une faute, mais c'est une
     promesse que le carnet ne tient pas encore. */
  clueRubrics: [
    { id: 'bureau', label: 'Le bureau' },
    { id: 'local', label: 'Le local arrière' },
    { id: 'couloir', label: 'Le couloir' },
  ],

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
    {
      /* L'OBJET DONT TOUT LE RESTE DE LA TRANCHE DEPEND.
         Sa description dit ce qu'on voit : une bouteille, un bouchon,
         une trace. Elle ne dit pas ce qu'il y a dedans -- c'est
         precisement la question, et ce n'est pas a un objet d'y
         repondre. */
      id: 'bouteille_anisette',
      name: 'Une bouteille d’anisette',
      prompt: 'Examiner la bouteille',
      description:
        'Une bouteille d’anisette posée contre le pied de la table, rebouchée, à moitié ' +
        'pleine. L’étiquette est intacte. Le goulot porte une trace sèche.',
      rubric: 'bureau',
    },
    {
      /* CE QU'ON VOIT SUR UNE ETAGERE, ET RIEN D'AUTRE.
         Un rond de poussiere et un peu de poudre dans le bois. Pas de
         nom de produit, pas d'etiquette, pas de marque : l'objet n'en
         sait pas plus, et il serait facile -- et faux -- de lui faire
         dire ce que seul le laboratoire pourra suggerer. */
      id: 'trace_etagere',
      name: 'Une trace sur l’étagère haute',
      prompt: 'Examiner l’étagère',
      description:
        'Sur l’étagère du haut, la poussière s’arrête net autour d’un disque plus clair : ' +
        'un récipient est resté là longtemps, et il n’y est plus. Un peu de poudre grise ' +
        'tient encore dans le grain du bois.',
      rubric: 'local',
    },
    {
      /* CE QU'UN POELE PEUT DIRE, ET OU IL S'ARRETE.
         Il dit qu'on a fait du feu, et de quoi etait fait ce qui a
         brule : du papier regle a colonnes. Il ne dit pas ce qui y
         etait ecrit -- l'angle qui reste ne porte que des lignes --,
         ni qui a craque l'allumette, ni a quelle heure. Trois choses
         qu'il serait facile, et faux, de lui faire dire. */
      id: 'poele_cendres',
      name: 'Le poêle du couloir',
      prompt: 'Examiner le poêle',
      description:
        'La porte du foyer est restée entrouverte. Dedans, des cendres froides et tassées. ' +
        'Un angle de papier n’a pas brûlé : il porte les lignes bleues et les colonnes ' +
        'd’un papier réglé.',
      rubric: 'couloir',
    },
    {
      id: 'registre_livraisons',
      name: 'Le registre des livraisons',
      prompt: 'Examiner le registre',
      description:
        'Un cahier à colonnes, une ligne par livraison, tenu sans une rature. La page du ' +
        'samedi 13 est vierge : rien n’était attendu ce matin-là.',
      rubric: 'bureau',
    },
  ],

  // --- Ce qu'on apprend ---------------------------------------------
  facts: [
    {
      id: 'fait_nino_parti',
      text: 'Nino Restivo a quitté le restaurant à dix heures moins dix.',
      topic: 'La nuit du 12',
    },
    {
      id: 'fait_rosa_a_renvoye_nino',
      text: 'Rosa Vitale a demandé à Nino Restivo de partir avant l’heure, ce soir-là.',
      topic: 'La nuit du 12',
    },
    {
      id: 'fait_deux_cles',
      text: 'Le local arrière ferme à clé. Deux personnes en ont une : le patron et le gérant.',
      topic: 'Le local arrière',
    },
    {
      id: 'fait_nino_a_vu',
      text: 'Nino Restivo a vu le gérant prendre quelque chose dans le local, quelques jours plus tôt.',
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
    {
      id: 'fait_enzo_a_la_cle',
      text: 'Enzo Carbone détient l’une des deux clés du local arrière.',
      topic: 'Le local arrière',
    },
    {
      id: 'fait_victor_verifiait',
      text: 'Victor Bellini vérifiait les livres de comptes du restaurant.',
      topic: 'Les comptes',
    },
    {
      id: 'fait_rosa_a_ferme',
      text: 'Rosa Vitale a fermé le restaurant seule, le soir du 12.',
      topic: 'La nuit du 12',
    },
    {
      /* Une HABITUDE, pas la soiree du 12. Elle dit ce qui se passait
         les soirs ou Victor restait tard -- elle ne dit pas ce qui
         s'est passe celui-la. La difference est tout ce qui separe un
         renseignement d'une revelation. */
      id: 'fait_verre_servi',
      text: 'Un verre d’anisette était porté à Victor Bellini les soirs où il restait tard.',
      topic: 'La nuit du 12',
    },
    {
      id: 'fait_scene_gardee',
      text: 'Le bureau est gardé depuis sept heures dix, le 13 au matin.',
      topic: 'Le 13 au matin',
    },
    {
      id: 'fait_enzo_a_trouve',
      text:
        'C’est Enzo Carbone qui a découvert le corps et donné l’alerte, depuis le café d’en face.',
      topic: 'Le 13 au matin',
    },
    {
      /* LE RESULTAT DE LABORATOIRE, TEL QU'IL DOIT ETRE LU.
         Ce fait enonce ce que le bulletin DIT. Il n'enonce pas ce que
         le bulletin prouve, et il ne designe personne. « Compatible
         avec la presence de » n'est pas « contenait » ; un resultat
         preliminaire n'est pas un resultat ; et l'absence de quantite,
         de date et d'origine est ecrite noir sur blanc dans le fait
         lui-meme, pour que le joueur ne puisse pas l'oublier.

         C'est au joueur de decider ce que cela vaut. Le moteur, lui,
         n'en tire rien : aucune humeur ne bouge, aucune question ne
         s'ouvre ailleurs, aucun epilogue ne s'y accroche. */
      id: 'fait_labo_preliminaire',
      text:
        'Un résultat préliminaire du chimiste municipal est compatible avec la présence ' +
        'd’un composé arsenical dans le résidu de la bouteille. Il ne porte ni quantité, ' +
        'ni date, ni origine, et demande une contre-épreuve.',
      topic: 'Le laboratoire',
    },
    {
      id: 'fait_local_ouvert',
      text: 'Le local arrière a été ouvert par la police le 13 au matin, avec la clé du gérant.',
      topic: 'Le local arrière',
    },
    {
      /* Ce qu'un rond de poussiere permet d'etablir, et pas un mot de
         plus. Qu'un recipient y soit reste longtemps : oui, la
         poussiere le dit. Lequel, depuis quand, emporte par qui : non,
         et aucun de ces trois mots n'a sa place ici. */
      id: 'fait_trace_etagere',
      text: 'Un récipient a séjourné longtemps sur l’étagère haute du local arrière. Il n’y est plus.',
      topic: 'Le local arrière',
    },
    {
      /* LA CONTRE-EPREUVE, TELLE QU'ELLE DOIT ETRE LUE.
         « Compatibles avec une meme preparation du commerce » est une
         phrase de chimiste, et elle dit exactement ce qu'elle dit :
         les deux prelevements pourraient venir d'un meme produit
         courant, ce qui est vrai de milliers de flacons. Elle
         n'etablit pas d'origine unique, elle ne nomme pas le produit,
         elle ne nomme pas le fabricant, et elle ne nomme personne.

         Les trois negations sont dans le texte du fait, pas seulement
         dans la bouche de Doyle : un joueur qui relit son carnet trois
         heures plus tard doit les retrouver. */
      id: 'fait_labo_contre_epreuve',
      text:
        'La comparaison des deux prélèvements les dit compatibles avec une même ' +
        'préparation du commerce. Elle n’établit pas d’origine unique et n’identifie ' +
        'ni le produit, ni le fabricant, ni personne.',
      topic: 'La contre-épreuve',
    },
    {
      /* Une HABITUDE, encore. « Les soirs ou il verifiait les comptes »
         n'est pas « le soir du 12 » : rien ici ne dit que Victor
         travaillait cette nuit-la, et Rosa, qui le sert depuis onze
         ans, n'a pas le droit d'en savoir davantage. */
      id: 'fait_victor_restait_les_comptes',
      text: 'Victor Bellini restait après la fermeture les soirs où il vérifiait les comptes.',
      topic: 'Les comptes',
    },
    {
      /* « AU MOINS UNE FEUILLE » : l'angle qui reste en prouve une, et
         une seule. Ecrire « des feuilles » serait deja compter ce
         qu'on n'a pas. */
      id: 'fait_papier_regle',
      text:
        'Ce qui a brûlé dans le poêle comprenait au moins une feuille de papier réglé à colonnes.',
      topic: 'Le couloir',
    },
    {
      /* Nino remplit le poele : c'est le seul a pouvoir dire cela, et
         c'est tout ce qu'il dit. « Donc le papier a servi de
         combustible » est une phrase de joueur, pas de commis. */
      id: 'fait_pas_de_charbon',
      text: 'Il n’y avait plus de charbon dans le poêle depuis octobre.',
      topic: 'Le couloir',
    },
    {
      id: 'fait_aldo_tient_les_comptes',
      text: 'Les comptes sont tenus par Aldo Maglione, le neveu du patron, depuis le printemps.',
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
      id: 'nino_charbon',
      speaker: 'nino',
      text: 'J’ai plus remis de charbon depuis octobre. Y en a plus dans la réserve.',
      topic: 'La maison',
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

    // --- Rosa ---------------------------------------------------------
    {
      id: 'rosa_soiree',
      speaker: 'rosa',
      text: 'Un samedi. Salle pleine jusqu’à dix heures et demie, puis le calme.',
      topic: 'Emploi du temps',
      truth: 'true',
    },
    {
      id: 'rosa_fermeture',
      speaker: 'rosa',
      text: 'C’est moi qui ai fermé. J’ai éteint la salle et j’ai tiré le rideau.',
      topic: 'Emploi du temps',
      truth: 'true',
    },
    {
      /* CE QU'ELLE DIT DE SON DEPART. Le champ truth sert au moteur et
         a personne d'autre : rien a l'ecran, rien dans le carnet, rien
         dans le ton de la replique ne permet de le lire. Le joueur ne
         pourra revenir ici que bien plus tard, et par un autre chemin
         que sa parole. */
      id: 'rosa_rentree',
      speaker: 'rosa',
      text: 'Je suis rentrée vers onze heures. À pied, c’est à dix minutes.',
      topic: 'Emploi du temps',
      claimedTime: '23:00',
      truth: 'false',
    },
    {
      id: 'rosa_nino_renvoye',
      speaker: 'rosa',
      text: 'Le petit tombait de sommeil. Je lui ai dit de filer, j’ai fait sa plonge.',
      topic: 'Les gens',
      truth: 'false',
    },
    {
      id: 'rosa_victor',
      speaker: 'rosa',
      text: 'Onze ans qu’il venait. Toujours la même table, toujours le même bonsoir.',
      topic: 'Les gens',
      truth: 'true',
    },
    {
      id: 'rosa_victor_tard',
      speaker: 'rosa',
      text: 'Il restait, les soirs où il faisait les comptes. Une fois par mois, jusqu’à pas d’heure.',
      topic: 'Les gens',
      truth: 'true',
    },
    {
      /* LE TROISIEME ECART DE ROSA, et le plus discret des trois.
         Elle ne nie pas qu'il y ait eu du feu : elle dit ce qu'elle a
         fait, et c'est eteindre. Le joueur tient d'un cote le poele
         vide jeudi et plein le samedi matin, de l'autre une femme qui
         a tout eteint avant de partir. Les deux phrases sont au
         carnet, cote a cote, et rien ne les commente. */
      id: 'rosa_rien_allume',
      speaker: 'rosa',
      text: 'Je n’ai rien allumé. J’ai éteint la salle, et je suis partie.',
      topic: 'La nuit du 12',
      truth: 'false',
    },
    {
      id: 'rosa_rideau',
      speaker: 'rosa',
      text: 'Il fait la caisse, il part. C’est moi qui tire le rideau. Ça ne s’appelle pas fermer.',
      topic: 'Emploi du temps',
      truth: 'true',
    },
    {
      id: 'rosa_charbon',
      speaker: 'rosa',
      text: 'C’est le petit qui s’en occupe. Moi je ne touche pas au charbon.',
      topic: 'La maison',
      truth: 'partial',
    },
    {
      id: 'rosa_anisette',
      speaker: 'rosa',
      text: 'Une anisette. Il en prenait une quand il restait tard. C’est moi qui la lui portais.',
      topic: 'La nuit du 12',
      truth: 'true',
    },

    // --- Aldo ---------------------------------------------------------
    {
      id: 'aldo_soiree',
      speaker: 'aldo',
      text: 'Je n’étais pas au restaurant. J’ai dîné chez mon oncle et je suis rentré.',
      topic: 'Emploi du temps',
      truth: 'true',
    },
    {
      id: 'aldo_ecritures',
      speaker: 'aldo',
      text: 'Je tiens les écritures depuis le printemps. Mon oncle n’a plus la tête aux chiffres.',
      topic: 'Les comptes',
      truth: 'true',
    },
    {
      id: 'aldo_adriatica',
      speaker: 'aldo',
      text: 'Adriatica, c’est le poisson et la glace. Ils livrent deux fois la semaine, le mardi et le vendredi.',
      topic: 'Les comptes',
      truth: 'partial',
    },
    {
      /* LA REGLE QU'IL ENONCE LUI-MEME. Elle est irreprochable, et
         c'est justement ce qui en fait un point d'appui : une regle
         enoncee est une regle qu'on peut aller verifier. Le joueur
         n'en a pas encore les moyens. */
      id: 'aldo_bons',
      speaker: 'aldo',
      text: 'Je paie sur présentation du bon de livraison. Pas de bon, pas de facture.',
      topic: 'Les comptes',
      truth: 'false',
    },
    {
      id: 'aldo_avances',
      speaker: 'aldo',
      text: 'Mon oncle m’a avancé de l’argent, oui. Deux fois. Ça se fait, en famille.',
      topic: 'Les gens',
      truth: 'partial',
    },
    {
      id: 'aldo_victor',
      speaker: 'aldo',
      text: 'Il vérifiait mes écritures. C’est son métier, je n’en faisais pas une affaire.',
      topic: 'Les gens',
      truth: 'false',
    },
    {
      id: 'aldo_papier',
      speaker: 'aldo',
      text: 'Du papier réglé, il y en a dans toutes les papeteries de la ville. Mes livres sont complets.',
      topic: 'Les comptes',
      truth: 'partial',
    },
    {
      id: 'aldo_ignorait',
      speaker: 'aldo',
      text: 'Je savais qu’il vérifiait les comptes. Je ne savais pas quels soirs.',
      topic: 'Les comptes',
      truth: 'false',
    },
    {
      id: 'aldo_remboursement',
      speaker: 'aldo',
      text: 'Mon oncle ne m’a rien réclamé. Ce n’est pas un prêt, c’est de la famille.',
      topic: 'Les gens',
      truth: 'partial',
    },
    {
      id: 'aldo_pas_a_boire',
      speaker: 'aldo',
      text: 'Je tiens des livres. Je ne sers pas à boire.',
      topic: 'Le laboratoire',
      truth: 'true',
    },
    {
      id: 'aldo_au_centime',
      speaker: 'aldo',
      text: 'Ce sont mes livres, et mon écriture. Tout y est au centime.',
      topic: 'Les comptes',
      truth: 'false',
    },
    {
      /* SA REPONSE SUR LA GLACE. Elle est excellente : une chambre
         froide perd reellement de la glace, et un inspecteur n'en a
         jamais tenu. Le joueur repart avec une explication plausible
         -- ce qui est exactement ce qu'on veut a ce stade. */
      id: 'aldo_glace_fond',
      speaker: 'aldo',
      text: 'La glace se perd. Il en fond la moitié entre le camion et la chambre froide.',
      topic: 'Les comptes',
      truth: 'false',
    },

    // --- Doyle --------------------------------------------------------
    {
      id: 'doyle_scene',
      speaker: 'doyle',
      text: 'Personne n’est entré avant moi. J’ai pris la porte à sept heures dix.',
      topic: 'Le 13 au matin',
      claimedTime: '07:10',
      truth: 'true',
    },
    {
      id: 'doyle_alerte',
      speaker: 'doyle',
      text: 'C’est le gérant qui l’a trouvé. Il a appelé du café d’en face.',
      topic: 'Le 13 au matin',
      truth: 'true',
    },
    {
      id: 'doyle_medecin',
      speaker: 'doyle',
      text: 'Le médecin ne se prononce pas. Pas de blessure, pas de lutte. Il demande une analyse.',
      topic: 'Le 13 au matin',
      truth: 'true',
    },
    {
      /* La phrase telle qu'elle ira au carnet. Trois negations, dans
         cet ordre : ni combien, ni quand, ni par qui. Elles ne sont
         pas de la coquetterie -- ce sont les trois questions que le
         joueur va se poser, et le bulletin n'en tranche aucune. */
      id: 'doyle_resultat_preliminaire',
      speaker: 'doyle',
      text:
        'Résultat préliminaire : compatible avec la présence d’un composé arsenical dans ' +
        'le résidu. Il ne dit pas combien, ni quand, ni par qui.',
      topic: 'Le laboratoire',
      truth: 'true',
    },

    {
      id: 'doyle_poele',
      speaker: 'doyle',
      text: 'La porte du foyer était entrouverte. Un angle de papier réglé, pas brûlé. Je le fais relever.',
      topic: 'Le 13 au matin',
      truth: 'true',
    },
    {
      id: 'doyle_local',
      speaker: 'doyle',
      text: 'Le local du fond, je l’ai fait ouvrir ce matin. Le gérant avait la clé.',
      topic: 'Le 13 au matin',
      truth: 'true',
    },
    {
      /* La declaration porte les memes reserves que le fait. Le carnet
         les range sous « La contre-epreuve » et non sous « Le
         laboratoire » : deux resultats, deux entrees, et aucun moyen
         de les confondre en relisant. */
      id: 'doyle_contre_epreuve',
      speaker: 'doyle',
      text:
        'Les deux prélèvements sont compatibles avec une même préparation du commerce. ' +
        'Ça n’établit pas d’origine unique, et ça ne nomme personne.',
      topic: 'La contre-épreuve',
      truth: 'true',
    },

    // --- Enzo ---------------------------------------------------------
    {
      id: 'enzo_soiree',
      speaker: 'enzo',
      text: 'Service normal. J’ai fermé, j’ai fait la caisse, je suis rentré.',
      topic: 'Emploi du temps',
      truth: 'partial',
    },
    {
      id: 'enzo_2215',
      speaker: 'enzo',
      text: 'Je suis parti vers dix heures et quart. Victor travaillait encore.',
      topic: 'Emploi du temps',
      claimedTime: '22:15',
      truth: 'false',
    },
    {
      id: 'enzo_pas_de_mots',
      speaker: 'enzo',
      text: 'Nous n’avons pas eu de mots. Victor et moi, jamais en onze ans.',
      topic: 'Les gens',
      truth: 'false',
    },
    {
      id: 'enzo_cle',
      speaker: 'enzo',
      text: 'J’ai une clé du fond, oui. Monsieur Maglione aussi. C’est tout.',
      topic: 'Le local arrière',
      truth: 'true',
    },
    {
      id: 'enzo_victor',
      speaker: 'enzo',
      text: 'Il vérifiait les livres. C’était son travail, et il le faisait bien.',
      topic: 'Les gens',
      truth: 'true',
    },
    {
      id: 'enzo_pas_regarde',
      speaker: 'enzo',
      text: 'Je n’ai pas regardé le poêle. J’ai vu Victor, et j’ai couru au café d’en face.',
      topic: 'Le 13 au matin',
      truth: 'true',
    },
    {
      id: 'enzo_livraison',
      speaker: 'enzo',
      text: 'Je suis venu tôt pour une livraison. Le poisson arrive avant l’ouverture.',
      topic: 'Le matin du 13',
      claimedTime: '07:00',
      truth: 'false',
    },
    {
      /* LA REPRISE. Confronte au registre, Enzo ne cede pas : il
         ajuste. C'est exactement l'homme qu'il est -- et le carnet
         montrera les deux versions cote a cote, sans jamais dire
         laquelle etait fausse. */
      id: 'enzo_livraison_reprise',
      speaker: 'enzo',
      text: 'Je me suis trompé de jour. La livraison, c’est le mercredi. Je viens tôt, voilà tout.',
      topic: 'Le matin du 13',
      truth: 'false',
      supersedes: 'enzo_livraison',
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

    // --- Rosa ---------------------------------------------------------
    {
      id: 'rosa_relance',
      speaker: 'rosa',
      question: 'Autre chose ?',
      category: 'ouverture',
      once: false,
      lines: [
        { speaker: 'detective', text: 'Autre chose qui vous revient ?' },
        { speaker: 'rosa', text: 'Demandez, je répondrai. Je n’ai rien à ajouter de moi-même.' },
      ],
    },
    {
      id: 'rosa_soiree',
      speaker: 'rosa',
      question: 'Racontez-moi votre soirée.',
      category: 'ouverture',
      lines: [
        { speaker: 'detective', text: 'Racontez-moi votre soirée d’hier.' },
        { speaker: 'rosa', text: 'Un samedi. Salle pleine jusqu’à dix heures et demie.' },
        { speaker: 'rosa', text: 'Puis le calme. On range, on compte, on éteint.', beat: 'think' },
      ],
      records: ['rosa_soiree'],
    },
    {
      id: 'rosa_fermeture',
      speaker: 'rosa',
      question: 'Qui a fermé le restaurant ?',
      category: 'emploi du temps',
      lines: [
        { speaker: 'detective', text: 'Qui a fermé, ce soir-là ?' },
        { speaker: 'rosa', text: 'Moi. J’ai éteint la salle et j’ai tiré le rideau.' },
      ],
      records: ['rosa_fermeture'],
      effects: { revealFacts: ['fait_rosa_a_ferme'], unlockTopics: ['rosa_depart'] },
    },
    {
      /* Masquee jusqu'a ce qu'elle ait dit avoir ferme. On ne demande
         pas a quelqu'un a quelle heure il est parti tant qu'on ignore
         qu'il etait le dernier. */
      id: 'rosa_depart',
      speaker: 'rosa',
      question: 'Et vous êtes partie à quelle heure ?',
      category: 'emploi du temps',
      hidden: true,
      lines: [
        { speaker: 'detective', text: 'Vous étiez donc la dernière. Partie à quelle heure ?' },
        { speaker: 'rosa', text: 'Vers onze heures.', pause: 0.4 },
        { speaker: 'rosa', text: 'À pied. C’est à dix minutes, j’habite derrière l’église.' },
      ],
      records: ['rosa_rentree'],
    },
    {
      /* Conditionnee au fait que Nino a livre. Sans lui, le joueur n'a
         aucune raison de savoir que le petit est parti en avance --
         et la question n'aurait pas de sens. */
      id: 'rosa_nino',
      speaker: 'rosa',
      question: 'Vous avez renvoyé Nino plus tôt.',
      category: 'les faits',
      requires: { facts: ['fait_rosa_a_renvoye_nino'] },
      lines: [
        { speaker: 'detective', text: 'Vous avez renvoyé le petit avant l’heure.' },
        { speaker: 'rosa', text: 'Il tombait de sommeil. Il a dix-neuf ans et il fait des journées d’homme.' },
        { speaker: 'rosa', text: 'Je lui ai dit de filer. J’ai fait sa plonge.', beat: 'dismiss' },
      ],
      records: ['rosa_nino_renvoye'],
    },
    {
      id: 'rosa_victor',
      speaker: 'rosa',
      question: 'Parlez-moi de Victor Bellini.',
      category: 'les gens',
      lines: [
        { speaker: 'detective', text: 'Victor Bellini. Vous le connaissiez ?' },
        { speaker: 'rosa', text: 'Onze ans qu’il venait. Toujours la même table.' },
        { speaker: 'rosa', text: 'Toujours le même bonsoir. Ça devient rare.', beat: 'think', pause: 0.6 },
      ],
      records: ['rosa_victor'],
    },

    // --- Aldo ---------------------------------------------------------
    {
      id: 'aldo_relance',
      speaker: 'aldo',
      question: 'Autre chose ?',
      category: 'ouverture',
      once: false,
      lines: [
        { speaker: 'detective', text: 'Autre chose ?' },
        { speaker: 'aldo', text: 'Demandez-moi n’importe quoi sur les chiffres. Le reste, je ne sais pas.' },
      ],
    },
    {
      id: 'aldo_soiree',
      speaker: 'aldo',
      question: 'Où étiez-vous hier soir ?',
      category: 'ouverture',
      lines: [
        { speaker: 'detective', text: 'Où étiez-vous, hier soir ?' },
        { speaker: 'aldo', text: 'Pas ici. J’ai dîné chez mon oncle.' },
        { speaker: 'aldo', text: 'Je suis rentré après. Demandez-lui.', beat: 'dismiss' },
      ],
      records: ['aldo_soiree'],
    },
    {
      id: 'aldo_ecritures',
      speaker: 'aldo',
      question: 'Qui tient les comptes du restaurant ?',
      category: 'les faits',
      lines: [
        { speaker: 'detective', text: 'Les comptes de la maison. Qui les tient ?' },
        { speaker: 'aldo', text: 'Moi. Depuis le printemps.' },
        { speaker: 'aldo', text: 'Mon oncle n’a plus la tête aux chiffres. Ça arrive, à son âge.' },
      ],
      records: ['aldo_ecritures'],
      effects: {
        revealFacts: ['fait_aldo_tient_les_comptes'],
        unlockTopics: ['aldo_adriatica'],
      },
    },
    {
      /* Masquee jusqu'a ce qu'il se soit dit comptable. On ne demande
         pas a quelqu'un le detail de ses fournisseurs avant de savoir
         qu'il les paie. */
      id: 'aldo_adriatica',
      speaker: 'aldo',
      question: 'Parlez-moi d’Adriatica Fish & Ice.',
      category: 'les faits',
      hidden: true,
      lines: [
        { speaker: 'detective', text: 'Adriatica Fish & Ice. Qu’est-ce que c’est ?' },
        { speaker: 'aldo', text: 'Le poisson et la glace. Ils livrent deux fois la semaine, le mardi et le vendredi.' },
        { speaker: 'aldo', text: 'Je paie sur présentation du bon de livraison. Pas de bon, pas de facture.' },
      ],
      records: ['aldo_adriatica', 'aldo_bons'],
    },
    {
      id: 'aldo_avances',
      speaker: 'aldo',
      question: 'Votre oncle vous avance-t-il de l’argent ?',
      category: 'les gens',
      lines: [
        { speaker: 'detective', text: 'Votre oncle vous a-t-il déjà avancé de l’argent ?' },
        { speaker: 'aldo', text: 'Deux fois. Ça se fait, en famille.', pause: 0.4 },
        { speaker: 'aldo', text: 'Je ne vois pas le rapport, mais je n’en fais pas un secret.' },
      ],
      records: ['aldo_avances'],
    },
    {
      id: 'aldo_victor',
      speaker: 'aldo',
      question: 'Victor Bellini vérifiait vos écritures.',
      category: 'les gens',
      lines: [
        { speaker: 'detective', text: 'Bellini vérifiait vos écritures.' },
        { speaker: 'aldo', text: 'C’est son métier. C’était son métier.', beat: 'think', pause: 0.5 },
        { speaker: 'aldo', text: 'Je n’en faisais pas une affaire.' },
      ],
      records: ['aldo_victor'],
      effects: { revealFacts: ['fait_victor_verifiait'] },
    },
    {
      /* LE RECOUPEMENT.
         Elle n'apparait que si le joueur a montre les livres a Nino :
         c'est Nino qui rentre la glace, et c'est lui qui a dit « pas
         autant, jamais autant ». Sans ce detour, le joueur n'a rien a
         opposer, et la question n'existe pas.

         Aldo n'est pas pris : il repond, et il repond bien. Une
         chambre froide perd reellement de la glace. Le joueur repart
         avec une explication plausible -- et une question de plus. */
      id: 'aldo_glace',
      speaker: 'aldo',
      question: 'Vous achetez plus de glace qu’on n’en consomme.',
      category: 'les faits',
      requires: { facts: ['fait_glace_impossible'] },
      lines: [
        { speaker: 'detective', text: 'Vous achetez plus de glace qu’une maison de cette taille n’en consomme.' },
        { speaker: 'aldo', text: 'La glace se perd. Il en fond la moitié entre le camion et la chambre froide.' },
        { speaker: 'aldo', text: 'Vous n’avez jamais tenu une chambre froide, inspecteur.', beat: 'dismiss', pause: 0.5 },
      ],
      records: ['aldo_glace_fond'],
    },

    {
      /* Conditionnee au verre qu'elle a reconnu avoir porte : c'est de
         la qu'on peut lui demander ce que Victor faisait si tard. Sans
         cela, la question tombe de nulle part. */
      id: 'rosa_victor_tard',
      speaker: 'rosa',
      question: 'Il restait après la fermeture ?',
      category: 'les gens',
      requires: { facts: ['fait_verre_servi'] },
      lines: [
        { speaker: 'detective', text: 'Il lui arrivait de rester après la fermeture ?' },
        { speaker: 'rosa', text: 'Les soirs où il faisait les comptes. Une fois par mois.' },
        { speaker: 'rosa', text: 'Jusqu’à pas d’heure. Ça ne me regardait pas.', beat: 'dismiss' },
      ],
      records: ['rosa_victor_tard'],
      effects: { revealFacts: ['fait_victor_restait_les_comptes'] },
    },
    {
      /* Conditionnee au poele de Nino. On ne demande pas a quelqu'un
         ce qu'il a brule : on lui dit qu'un poele a servi, et on
         ecoute. La question reste de la categorie « les faits » -- a
         ce stade, rien n'autorise a la presser. */
      id: 'rosa_poele',
      speaker: 'rosa',
      question: 'Le poêle du couloir a servi.',
      category: 'les faits',
      requires: { facts: ['fait_cendres'] },
      lines: [
        { speaker: 'detective', text: 'Le poêle, dans le couloir. Il a servi cette nuit-là.' },
        { speaker: 'rosa', text: 'En novembre ? On a le fourneau, inspecteur.', beat: 'think', pause: 0.5 },
        { speaker: 'rosa', text: 'Je n’ai rien allumé. J’ai éteint la salle, et je suis partie.' },
      ],
      records: ['rosa_rien_allume'],
    },

    // --- Doyle --------------------------------------------------------
    {
      id: 'doyle_relance',
      speaker: 'doyle',
      question: 'Autre chose ?',
      category: 'ouverture',
      once: false,
      lines: [
        { speaker: 'detective', text: 'Autre chose ?' },
        { speaker: 'doyle', text: 'Je note tout, inspecteur. Demandez.' },
      ],
    },
    {
      id: 'doyle_scene',
      speaker: 'doyle',
      question: 'Qui est entré ici avant vous ?',
      category: 'les faits',
      lines: [
        { speaker: 'detective', text: 'Qui est entré dans ce bureau avant vous ?' },
        { speaker: 'doyle', text: 'Personne. J’ai pris la porte à sept heures dix.' },
        { speaker: 'doyle', text: 'Le gérant attendait dehors. Il n’a pas voulu rentrer.', beat: 'think' },
      ],
      records: ['doyle_scene'],
      effects: { revealFacts: ['fait_scene_gardee'] },
    },
    {
      /* Elle ramene au combine decroche : le telephone d'ici ne
         servait plus, il a fallu traverser la rue. Le joueur peut
         l'avoir vu avant, ou l'apprendre ici. */
      id: 'doyle_alerte',
      speaker: 'doyle',
      question: 'Qui a donné l’alerte ?',
      category: 'les faits',
      lines: [
        { speaker: 'detective', text: 'Qui a donné l’alerte ?' },
        { speaker: 'doyle', text: 'Le gérant. Il l’a trouvé en ouvrant.' },
        { speaker: 'doyle', text: 'Il a appelé du café d’en face. Le poste d’ici ne servait à rien.' },
      ],
      records: ['doyle_alerte'],
      effects: { revealFacts: ['fait_enzo_a_trouve'] },
    },
    {
      id: 'doyle_medecin',
      speaker: 'doyle',
      question: 'Qu’a dit le médecin ?',
      category: 'les faits',
      lines: [
        { speaker: 'detective', text: 'Le médecin est passé. Qu’a-t-il dit ?' },
        { speaker: 'doyle', text: 'Qu’il ne se prononce pas. Pas de blessure, pas de lutte.' },
        { speaker: 'doyle', text: 'Il demande une analyse. Il ne signera rien avant.', beat: 'think' },
      ],
      records: ['doyle_medecin'],
    },
    {
      /* Masquee, et rien ne l'ouvre qu'une bouteille remise en main
         propre. Sans l'objet, pas d'analyse ; sans analyse, pas de
         question. L'ordre n'est pas decoratif : c'est ce qui fait du
         bulletin le resultat d'un geste du joueur, et non une
         information que le jeu lui sert. */
      id: 'doyle_resultat',
      speaker: 'doyle',
      question: 'Qu’en dit le chimiste ?',
      category: 'les faits',
      hidden: true,
      lines: [
        { speaker: 'detective', text: 'La bouteille. Qu’en dit le chimiste ?' },
        { speaker: 'doyle', text: 'Un test de paillasse, fait ce matin. Préliminaire, rien de plus.' },
        {
          speaker: 'doyle',
          text: 'Compatible avec la présence d’un composé arsenical dans le résidu.',
          pause: 0.7,
        },
        {
          speaker: 'doyle',
          text: 'Il ne dit pas combien. Ni quand. Ni par qui. Et il demande une contre-épreuve.',
          beat: 'think',
        },
      ],
      records: ['doyle_resultat_preliminaire'],
      effects: { revealFacts: ['fait_labo_preliminaire'] },
    },

    {
      id: 'doyle_local',
      speaker: 'doyle',
      question: 'Le local du fond est-il ouvert ?',
      category: 'les faits',
      lines: [
        { speaker: 'detective', text: 'Le local, au fond. On peut y entrer ?' },
        { speaker: 'doyle', text: 'Je l’ai fait ouvrir ce matin. Le gérant avait la clé.' },
        { speaker: 'doyle', text: 'Personne n’y est entré depuis. Allez-y.' },
      ],
      records: ['doyle_local'],
      effects: { revealFacts: ['fait_local_ouvert'] },
    },
    {
      /* Masquee, et deux verrous devant elle plutot qu'un : il faut un
         premier resultat A COMPARER, et un prelevement a lui opposer.
         Le premier verrou est porte par la condition de la reaction ;
         le second par le geste qui la declenche. Ni l'un ni l'autre ne
         se contourne, et aucun des deux n'est de la decoration : une
         contre-epreuve sans rien en face n'est pas une contre-epreuve. */
      id: 'doyle_contre_epreuve',
      speaker: 'doyle',
      question: 'Et la comparaison ?',
      category: 'les faits',
      hidden: true,
      lines: [
        { speaker: 'detective', text: 'Le bois de l’étagère. La comparaison a été faite ?' },
        {
          speaker: 'doyle',
          text: 'Ils ont mis les deux prélèvements côte à côte. Le résidu de la bouteille, la poudre du bois.',
        },
        {
          speaker: 'doyle',
          text: 'Compatibles avec une même préparation du commerce. C’est la phrase exacte.',
          pause: 0.7,
        },
        {
          speaker: 'doyle',
          text: 'Ça n’établit pas une origine unique. Ni le produit, ni le fabricant, ni personne.',
          beat: 'think',
        },
      ],
      records: ['doyle_contre_epreuve'],
      effects: { revealFacts: ['fait_labo_contre_epreuve'] },
    },

    {
      /* Conditionnee a ce que Rosa a livre. Aldo tient les ecritures :
         savoir quels soirs le comptable venait les verifier fait
         partie de son travail. Il dit que non. Personne ne releve. */
      id: 'aldo_ce_soir_la',
      speaker: 'aldo',
      question: 'Vous saviez quand il venait vérifier ?',
      category: 'les faits',
      requires: { facts: ['fait_victor_restait_les_comptes'] },
      lines: [
        { speaker: 'detective', text: 'Il restait le soir pour vos comptes. Vous saviez quand ?' },
        { speaker: 'aldo', text: 'Je savais qu’il le faisait. Pas quels soirs.', pause: 0.4 },
        { speaker: 'aldo', text: 'Il venait quand il voulait. C’était son droit.' },
      ],
      records: ['aldo_ignorait'],
    },
    {
      /* Ouverte par le constat de Doyle, a l'autre bout de la piece.
         C'est la premiere question de l'affaire qui s'ouvre a partir
         d'un OBJET vu ailleurs et non d'une parole : le poele ne parle
         a personne, il fallait que Doyle le consigne pour qu'Aldo ait
         quelque chose a nier. */
      id: 'aldo_papier',
      speaker: 'aldo',
      question: 'On a brûlé du papier réglé cette nuit-là.',
      category: 'les faits',
      requires: { facts: ['fait_papier_regle'] },
      lines: [
        { speaker: 'detective', text: 'On a brûlé du papier réglé à colonnes, cette nuit-là.' },
        { speaker: 'aldo', text: 'Du papier réglé, il y en a dans toutes les papeteries de la ville.' },
        { speaker: 'aldo', text: 'Mes livres sont complets. Comptez les pages, si ça vous amuse.', beat: 'dismiss' },
      ],
      records: ['aldo_papier'],
    },
    {
      /* Elle ne s'ouvre qu'apres qu'il a parle des avances lui-meme.
         On ne demande pas a quelqu'un s'il a rembourse un pret dont il
         n'a pas encore reconnu l'existence. */
      id: 'aldo_remboursement',
      speaker: 'aldo',
      question: 'Vous les avez remboursées ?',
      category: 'les gens',
      requires: { topicsAsked: ['aldo_avances'] },
      lines: [
        { speaker: 'detective', text: 'Ces avances, vous les avez remboursées ?' },
        { speaker: 'aldo', text: 'Mon oncle ne m’a rien réclamé.', beat: 'think', pause: 0.5 },
        { speaker: 'aldo', text: 'Ce n’est pas un prêt, c’est de la famille. Vous n’avez pas de famille ?' },
      ],
      records: ['aldo_remboursement'],
    },

    // --- Enzo ---------------------------------------------------------
    {
      id: 'enzo_relance',
      speaker: 'enzo',
      question: 'Autre chose ?',
      category: 'ouverture',
      once: false,
      lines: [
        { speaker: 'detective', text: 'Autre chose ?' },
        { speaker: 'enzo', text: 'Non. Je vous ai dit ce que je sais.' },
      ],
    },
    {
      id: 'enzo_soiree',
      speaker: 'enzo',
      question: 'Racontez-moi votre soirée.',
      category: 'ouverture',
      lines: [
        { speaker: 'detective', text: 'Votre soirée d’hier.' },
        { speaker: 'enzo', text: 'Service normal. J’ai fermé, j’ai fait la caisse, je suis rentré.' },
      ],
      records: ['enzo_soiree'],
    },
    {
      id: 'enzo_heure',
      speaker: 'enzo',
      question: 'À quelle heure êtes-vous parti ?',
      category: 'emploi du temps',
      lines: [
        { speaker: 'detective', text: 'À quelle heure êtes-vous parti, hier soir ?' },
        { speaker: 'enzo', text: 'Vers dix heures et quart.', pause: 0.3 },
        { speaker: 'enzo', text: 'Victor travaillait encore. Il travaillait toujours.' },
      ],
      records: ['enzo_2215'],
    },
    {
      id: 'enzo_dispute',
      speaker: 'enzo',
      question: 'Vous êtes-vous disputés ?',
      category: 'pression',
      lines: [
        { speaker: 'detective', text: 'Vous vous êtes disputés, ce soir-là ?' },
        { speaker: 'enzo', text: 'Non.', beat: 'deny', pause: 0.5 },
        { speaker: 'enzo', text: 'Nous n’avons pas eu de mots. Victor et moi, jamais en onze ans.' },
      ],
      records: ['enzo_pas_de_mots'],
    },
    {
      id: 'enzo_cles',
      speaker: 'enzo',
      question: 'Qui a la clé du local arrière ?',
      category: 'les faits',
      lines: [
        { speaker: 'detective', text: 'Le local, au fond. Qui en a la clé ?' },
        { speaker: 'enzo', text: 'J’ai une clé du fond, oui. Monsieur Maglione aussi. C’est tout.' },
      ],
      records: ['enzo_cle'],
      effects: { revealFacts: ['fait_enzo_a_la_cle'] },
    },
    {
      id: 'enzo_victor',
      speaker: 'enzo',
      question: 'Parlez-moi de Victor Bellini.',
      category: 'les gens',
      lines: [
        { speaker: 'detective', text: 'Parlez-moi de lui.' },
        { speaker: 'enzo', text: 'Il vérifiait les livres. C’était son travail, et il le faisait bien.' },
        { speaker: 'enzo', text: 'Un homme correct. Ça se paie, parfois.', beat: 'think', pause: 0.6 },
      ],
      records: ['enzo_victor'],
      effects: { revealFacts: ['fait_victor_verifiait'] },
    },
    {
      id: 'enzo_matin',
      speaker: 'enzo',
      question: 'Vous êtes arrivé avant l’ouverture.',
      category: 'emploi du temps',
      lines: [
        { speaker: 'detective', text: 'Ce matin, vous étiez là bien avant l’ouverture.' },
        { speaker: 'enzo', text: 'Je suis venu tôt pour une livraison.', pause: 0.3 },
        { speaker: 'enzo', text: 'Le poisson arrive avant l’ouverture.' },
      ],
      records: ['enzo_livraison'],
    },
    {
      /* Masquee. Rien ne l'ouvre qu'un registre pose sous son nez --
         voir la reaction plus bas. */
      id: 'enzo_matin_reprise',
      speaker: 'enzo',
      question: 'Ce registre ne mentionne aucune livraison.',
      category: 'pression',
      hidden: true,
      lines: [
        { speaker: 'detective', text: 'Rien n’était prévu ce matin-là. C’est écrit.' },
        { speaker: 'enzo', text: '…', beat: 'think', pause: 1.2 },
        {
          speaker: 'enzo',
          text: 'Je me suis trompé de jour. La livraison, c’est le mercredi.',
        },
        { speaker: 'enzo', text: 'Je viens tôt, voilà tout. Depuis onze ans.', beat: 'dismiss' },
      ],
      records: ['enzo_livraison_reprise'],
      effects: { setMood: 'nervous' },
    },
  ],

  // --- Ce qu'il dit devant un objet -----------------------------------
  reactions: [
    {
      /* LE PRELEVEMENT, QUAND IL Y A DE QUOI COMPARER.
         findReaction() rend la PREMIERE reaction dont les conditions
         passent : celle-ci doit donc rester avant sa jumelle sans
         condition, quelques lignes plus bas. Les inverser rendrait la
         contre-epreuve inatteignable, et rien ne planterait. */
      character: 'doyle',
      clue: 'trace_etagere',
      requires: { facts: ['fait_labo_preliminaire'] },
      lines: [
        { speaker: 'detective', text: 'Sur l’étagère du haut, dans le local. Il y a de la poudre dans le bois.' },
        { speaker: 'doyle', text: 'Je fais gratter le bois. Ils compareront avec le fond de la bouteille.' },
        { speaker: 'doyle', text: 'Redemandez-moi tout à l’heure.', beat: 'think' },
      ],
      effects: {
        revealFacts: ['fait_trace_etagere'],
        unlockTopics: ['doyle_contre_epreuve'],
      },
    },
    {
      /* LE MEME PRELEVEMENT, TROP TOT.
         Il ne se passe rien, et Doyle dit pourquoi. Un blocage muet
         ferait croire a une panne ; un blocage qui s'explique est une
         consigne. Le joueur repart en sachant ce qui lui manque. */
      character: 'doyle',
      clue: 'trace_etagere',
      lines: [
        { speaker: 'detective', text: 'Sur l’étagère du haut, dans le local. Il y a de la poudre dans le bois.' },
        { speaker: 'doyle', text: 'Et je compare ça avec quoi ?', beat: 'deny', pause: 0.6 },
        { speaker: 'doyle', text: 'Rapportez-moi de quoi mettre en face. Un prélèvement seul ne dit rien.' },
      ],
      effects: { revealFacts: ['fait_trace_etagere'] },
    },
    {
      character: 'enzo',
      clue: 'trace_etagere',
      lines: [
        { speaker: 'detective', text: 'Un cercle sec sur votre étagère du haut.' },
        { speaker: 'enzo', text: 'On pose des choses sur les étagères. C’est leur usage.', beat: 'dismiss' },
      ],
    },
    {
      /* LA CONTRE-EPREUVE SOUS SON NEZ.
         Il ne nie pas, il ne cede pas : il lit la phrase comme elle
         est ecrite, et il a raison de la lire ainsi. C'est la meilleure
         defense possible, et elle laisse le joueur exactement ou il
         doit etre -- avec un resultat qui l'oriente sans rien prouver. */
      character: 'enzo',
      statement: 'doyle_contre_epreuve',
      lines: [
        { speaker: 'detective', text: 'Le chimiste a comparé votre étagère et le fond de cette bouteille.' },
        { speaker: 'enzo', text: 'Compatibles. C’est votre mot.', pause: 0.6 },
        { speaker: 'enzo', text: 'Moi j’entends qu’ils n’en savent rien.', beat: 'dismiss' },
      ],
    },
    {
      /* LE POELE CONSIGNE.
         Doyle ne deduit rien et n'envoie rien au chimiste : il dit ce
         qu'il a vu en entrant, et il le note. C'est de cette note, et
         d'elle seule, que nait la question posable a Aldo. */
      character: 'doyle',
      clue: 'poele_cendres',
      lines: [
        { speaker: 'detective', text: 'Le poêle, dans le couloir. Il a servi.' },
        { speaker: 'doyle', text: 'La porte était entrouverte quand je suis entré. Je n’y ai pas touché.' },
        { speaker: 'doyle', text: 'Un angle de papier réglé, pas brûlé. Je le fais relever.', beat: 'think' },
      ],
      records: ['doyle_poele'],
      effects: { revealFacts: ['fait_papier_regle'] },
    },
    {
      /* LE CHARBON.
         Nino remplit le poele : il est le seul a savoir ce qu'il y
         avait dedans pour bruler. Il ne dit toujours pas ce qui a
         brule -- il voit des cendres, comme depuis la premiere tranche
         -- il dit ce qui n'y etait plus. */
      character: 'nino',
      clue: 'poele_cendres',
      lines: [
        { speaker: 'detective', text: 'Le poêle. Vous disiez l’avoir vidé.' },
        { speaker: 'nino', text: 'Jeudi, oui. Et j’ai plus remis de charbon depuis octobre.' },
        { speaker: 'nino', text: 'Y en a plus dans la réserve. Faut en commander.', beat: 'think' },
      ],
      records: ['nino_charbon'],
      effects: { revealFacts: ['fait_pas_de_charbon'] },
    },
    {
      /* Elle renvoie sur le charbon, et sur le petit. Ce n'est pas un
         mensonge -- le poele est bien le travail de Nino -- et ce
         n'est pas une reponse non plus. Aucun effet : son humeur ne
         bouge pas, et rien ne s'ouvre. */
      character: 'rosa',
      clue: 'poele_cendres',
      lines: [
        { speaker: 'detective', text: 'Le foyer était resté ouvert.' },
        { speaker: 'rosa', text: 'C’est le petit qui s’en occupe.', pause: 0.5 },
        { speaker: 'rosa', text: 'Moi je ne touche pas au charbon, inspecteur.' },
      ],
      records: ['rosa_charbon'],
    },
    {
      character: 'enzo',
      clue: 'poele_cendres',
      lines: [
        { speaker: 'detective', text: 'Vous êtes passé devant, ce matin-là.' },
        { speaker: 'enzo', text: 'Je n’ai pas regardé le poêle.', beat: 'deny', pause: 0.5 },
        { speaker: 'enzo', text: 'J’ai vu Victor, et j’ai couru au café d’en face.' },
      ],
      records: ['enzo_pas_regarde'],
    },
    {
      /* LE GESTE QUI DECLENCHE L'ANALYSE.
         C'est la seule chose, dans tout le jeu, qui ouvre la question
         du laboratoire. */
      character: 'doyle',
      clue: 'bouteille_anisette',
      lines: [
        { speaker: 'detective', text: 'Cette bouteille était contre le pied de la table.' },
        { speaker: 'doyle', text: 'Je la fais porter au chimiste municipal. Il est à trois rues.' },
        { speaker: 'doyle', text: 'Redemandez-moi tout à l’heure.', beat: 'think' },
      ],
      effects: { unlockTopics: ['doyle_resultat'] },
    },
    {
      character: 'doyle',
      clue: 'verre_renverse',
      lines: [
        { speaker: 'detective', text: 'Le verre, sur le sous-main.' },
        { speaker: 'doyle', text: 'Je l’ai laissé tel quel. On ne touche à rien avant le photographe.' },
      ],
    },
    {
      /* DEUX PERSONNES ONT FERME LE MEME SOIR.
         Enzo dit « j'ai ferme, j'ai fait la caisse, je suis rentre » ;
         Rosa dit « c'est moi qui ai ferme ». Les deux phrases sont
         dans le jeu depuis la deuxieme et la troisieme tranche, et
         personne ne les avait encore mises face a face.

         Rosa ne crie pas au mensonge : elle fait une distinction de
         metier, et cette distinction est parfaitement recevable. Le
         joueur repart avec deux versions et aucun arbitre. */
      character: 'rosa',
      statement: 'enzo_soiree',
      lines: [
        { speaker: 'detective', text: 'Le gérant dit que c’est lui qui a fermé.' },
        { speaker: 'rosa', text: 'Il fait la caisse, il part.', pause: 0.5 },
        { speaker: 'rosa', text: 'C’est moi qui tire le rideau. Ça ne s’appelle pas fermer.' },
      ],
      records: ['rosa_rideau'],
    },
    {
      /* Le bulletin presente a Aldo. Il n'etait pas la, et il le fait
         remarquer -- en designant, sans la nommer, la personne qui
         servait. C'est une phrase d'homme qui se met a l'abri, pas un
         renseignement : le carnet la garde, et rien de plus. */
      character: 'aldo',
      statement: 'doyle_resultat_preliminaire',
      lines: [
        { speaker: 'detective', text: 'Le chimiste a regardé le fond d’une bouteille.' },
        { speaker: 'aldo', text: 'Et alors ?', beat: 'deny', pause: 0.6 },
        { speaker: 'aldo', text: 'Je tiens des livres, inspecteur. Je ne sers pas à boire.' },
      ],
      records: ['aldo_pas_a_boire'],
    },
    {
      /* LE RESULTAT PRESENTE A ROSA.
         C'est elle qui portait l'anisette : lui montrer le bulletin
         est la seule chose qui aille de soi. Et il ne se passe rien --
         aucun fait, aucune question, aucune humeur. Elle repond ce
         qu'une femme repondrait si elle n'avait rien fait, et c'est
         exactement ce que le joueur doit avoir a interpreter. */
      character: 'rosa',
      statement: 'doyle_resultat_preliminaire',
      lines: [
        { speaker: 'detective', text: 'Le chimiste a regardé le fond de cette bouteille.' },
        { speaker: 'rosa', text: 'Elle est ouverte depuis des semaines.', pause: 0.5 },
        { speaker: 'rosa', text: 'Tout le monde passe derrière ce bar, inspecteur. Moi la première.' },
      ],
    },
    {
      character: 'aldo',
      clue: 'livres_comptes',
      lines: [
        { speaker: 'detective', text: 'Vos livres.' },
        { speaker: 'aldo', text: 'Mon écriture, oui. Regardez-les autant que vous voudrez.' },
        { speaker: 'aldo', text: 'Tout y est au centime.', beat: 'dismiss' },
      ],
      records: ['aldo_au_centime'],
    },
    {
      /* Il se separe du cahier, et il a raison de le faire : ce n'est
         pas le sien. Une denegation exacte vaut mieux qu'un mensonge
         -- et elle laisse au joueur un nom de plus a aller voir. */
      character: 'aldo',
      clue: 'registre_livraisons',
      lines: [
        { speaker: 'detective', text: 'Le cahier des livraisons.' },
        { speaker: 'aldo', text: 'Ça, c’est la salle. Moi je vois les factures, pas les cahiers.' },
      ],
    },
    {
      /* DEUX TEMOINS, DEUX JOURS.
         Enzo a dit mercredi ; Aldo dit mardi et vendredi. Aucun des
         deux n'est confondu, personne ne crie au mensonge, et le
         carnet se contente de porter les deux phrases. C'est au joueur
         de tenir les deux ensemble -- c'est tout le jeu.

         Conditionnee a rien : si le joueur a la declaration d'Enzo,
         c'est qu'il est alle la chercher avec le registre. */
      character: 'aldo',
      statement: 'enzo_livraison_reprise',
      lines: [
        { speaker: 'detective', text: 'On me dit que la livraison se fait le mercredi.' },
        { speaker: 'aldo', text: 'Le mercredi ?', beat: 'think', pause: 0.8 },
        { speaker: 'aldo', text: 'Mardi et vendredi. Depuis toujours. Qui vous a dit mercredi ?' },
      ],
    },
    {
      /* LE VERRE PRESENTE A ROSA.
         Elle ne se derobe pas : elle reconnait l'avoir porte. C'est un
         renseignement reel -- le joueur apprend d'ou vient le verre --
         et ce n'est pas un aveu : porter une anisette a un habitue qui
         travaille tard est une politesse, pas un geste.

         Elle parle d'une HABITUDE, jamais de cette nuit-la. Le jour ou
         le joueur pourra la ramener au 12 novembre, ce ne sera pas
         parce qu'elle l'aura dit ici. */
      character: 'rosa',
      clue: 'verre_renverse',
      lines: [
        { speaker: 'detective', text: 'Ce verre, sur son bureau.' },
        { speaker: 'rosa', text: 'Une anisette. Il en prenait une quand il restait tard.' },
        { speaker: 'rosa', text: 'C’est moi qui la lui portais.', pause: 0.5 },
      ],
      records: ['rosa_anisette'],
      effects: { revealFacts: ['fait_verre_servi'] },
    },
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

    // --- Enzo ---------------------------------------------------------
    {
      /* LE REGISTRE POSE SOUS SON NEZ.
         Conditionne a ce qu'il ait DEJA invoque la livraison : avant
         cela, un cahier de livraisons ne lui dit rien, et sa reponse
         generique suffit. On ne prend pas quelqu'un en defaut sur une
         chose qu'il n'a pas encore dite. */
      character: 'enzo',
      clue: 'registre_livraisons',
      requires: { topicsAsked: ['enzo_matin'] },
      lines: [
        { speaker: 'detective', text: 'Votre registre.' },
        { speaker: 'enzo', text: 'Oui. Et alors ?', beat: 'deny', pause: 0.8 },
      ],
      effects: { unlockTopics: ['enzo_matin_reprise'] },
    },
    {
      /* UNE DECLARATION PRESENTEE COMME UNE PIECE.
         Le joueur rapporte a Enzo ce que Nino lui a dit. Enzo ne nie
         pas -- nier serait avouer que la chose compte. */
      character: 'enzo',
      statement: 'nino_local',
      lines: [
        { speaker: 'detective', text: 'On vous a vu prendre quelque chose au fond, l’autre jour.' },
        { speaker: 'enzo', text: 'Je vais au fond dix fois par jour. C’est ma réserve.' },
        { speaker: 'enzo', text: 'Le petit a de bons yeux.', beat: 'dismiss', pause: 0.5 },
      ],
      effects: { setMood: 'nervous' },
    },
    {
      character: 'enzo',
      clue: 'livres_comptes',
      lines: [
        { speaker: 'detective', text: 'Les comptes du restaurant.' },
        { speaker: 'enzo', text: 'Je ne les tiens pas. C’est le neveu, depuis le printemps.' },
        { speaker: 'enzo', text: 'Moi je fais la salle et la caisse du soir.' },
      ],
      effects: { revealFacts: ['fait_aldo_tient_les_comptes'] },
    },
    {
      character: 'enzo',
      clue: 'combine_decroche',
      lines: [
        { speaker: 'detective', text: 'Le téléphone était décroché.' },
        { speaker: 'enzo', text: 'Je n’y ai pas touché. On ne touche à rien, dans ces cas-là.' },
      ],
    },
  ],
};
