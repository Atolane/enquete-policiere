/* ===================================================================
   src/world/Character.ts

   UN PERSONNAGE ANIME.

   Trois responsabilites, et rien d'autre :
     1. jouer une animation et passer d'un etat a un autre en FONDU ;
     2. tourner la TETE vers le joueur, dans des limites credibles ;
     3. ne rien calculer quand personne ne le regarde.

   Le personnage ne connait ni l'enquete, ni les dialogues : il sait
   seulement jouer des etats. En Phase 5, une replique dira simplement
   "passe en etat 'denying'", et la gene se verra a l'ecran.
   =================================================================== */

import * as THREE from 'three';
import type { Beat, Mood } from '../data/types';

/** Les etats possibles. Chacun correspond a une animation. */
export type CharacterState = 'idle' | 'attentive' | 'agreeing' | 'denying';

/** Quel clip joue quel etat. Les noms viennent de anim_library.glb. */
const STATE_CLIPS: Record<CharacterState, string> = {
  idle: 'Idle', // au repos, personne a proximite
  attentive: 'Standing', // le joueur s'est approche
  agreeing: 'Yes', // acquiescement
  denying: 'No', // denegation
};

/** Duree du fondu entre deux etats, en secondes. */
const FADE = 0.35;

/* --- Gestes ponctuels (Phase 5A) ---------------------------------
   Un geste est joue UNE SEULE FOIS par-dessus la posture, puis la
   posture reprend en fondu. */
const BEAT_CLIPS: Record<Beat, string> = {
  agree: 'Yes',
  deny: 'No',
  dismiss: 'Wave',
  think: 'Standing',
};
const BEAT_FADE = 0.15;

/* --- Humeurs (Phase 5A) -------------------------------------------
   L'humeur ne change pas de clip -- le mannequin d'essai n'en a pas
   assez. Elle s'exprime par la VITESSE de l'animation et surtout par
   le COMPORTEMENT DU REGARD, qui fonctionne avec n'importe quel modele
   et reste volontairement ambigu : un innocent aussi detourne les yeux.

   look    : duree pendant laquelle il vous tient le regard
   away    : duree pendant laquelle il le rompt
   offset  : de combien il regarde a cote pendant la rupture, en metres */
interface MoodBehaviour {
  timeScale: number;
  look: number;
  away: number;
  offset: number;
}

const MOOD_BEHAVIOUR: Record<Mood, MoodBehaviour> = {
  neutral: { timeScale: 1.0, look: Infinity, away: 0, offset: 0 },
  guarded: { timeScale: 0.9, look: 2.4, away: 1.2, offset: 0.9 },
  nervous: { timeScale: 1.15, look: 1.3, away: 0.9, offset: 1.4 },
  hostile: { timeScale: 1.0, look: Infinity, away: 0, offset: 0 },
};

/** Limites de rotation de la tete, en degres. Au-dela, le cou se devisse. */
const MAX_YAW = 70;
const MAX_PITCH = 28;

/** Vitesse de rotation de la tete. Plus grand = plus vif. */
const LOOK_SPEED = 6;

export class Character {
  readonly id: string;
  readonly root: THREE.Object3D;

  state: CharacterState = 'idle';

  /* --- Valeurs de controle, lues par l'interface de debogage et par les
     tests automatises. Elles rendent mesurable ce qui serait sinon une
     simple impression visuelle. --- */

  /** Le mixer a-t-il tourne a la derniere image ? */
  animated = false;
  /** Nombre d'animations en cours de melange (2 pendant un fondu). */
  blending = 0;
  /** Angle entre la direction du regard et la cible, en degres. */
  lookAngleDeg = 180;
  /** Rotation horizontale reellement appliquee a la tete, en degres. */
  appliedYawDeg = 0;
  /** Humeur courante, et vitesse d'animation qui en decoule. */
  mood: Mood = 'neutral';
  /** Le personnage detourne-t-il le regard en ce moment ? */
  gazeAverted = false;
  /** Nom du clip en cours, et son avancement en secondes.
      Le temps qui avance est la preuve la plus directe qu'une animation
      tourne : c'est une valeur, pas une impression. */
  currentClip = '';
  currentTime = 0;

  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<CharacterState, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;

  private readonly head: THREE.Object3D | null;
  /** Axe local de la tete pointant vers l'avant, mesure au repos. */
  private readonly headForward = new THREE.Vector3(0, 0, 1);
  /** Direction vers laquelle le modele regarde au repos, dans son repere. */
  private readonly modelForward: THREE.Vector3;

  private target: THREE.Vector3 | null = null;
  /** Geste en cours : action jouee une fois, et temps restant. */
  private readonly beatActions = new Map<Beat, THREE.AnimationAction>();
  private beatRemaining = 0;
  /** Minuterie du comportement de regard. */
  private gazeTimer = 0;
  private readonly gazeOffset = new THREE.Vector3();
  private readonly gazeTarget = new THREE.Vector3();
  /** Direction reellement visee, qui glisse doucement vers la cible. */
  private readonly aimDirection = new THREE.Vector3(0, 0, 1);
  private aimInitialised = false;

  /* Objets de travail : aucune allocation dans la boucle de jeu. */
  private readonly tmpQuatA = new THREE.Quaternion();
  private readonly tmpQuatB = new THREE.Quaternion();
  private readonly tmpVecA = new THREE.Vector3();
  private readonly tmpVecB = new THREE.Vector3();
  private readonly tmpVecC = new THREE.Vector3();
  private readonly tmpVecD = new THREE.Vector3();
  /** Direction visee instantanee, avant lissage. */
  private readonly aimTarget = new THREE.Vector3(0, 0, 1);
  private readonly desiredDelta = new THREE.Quaternion();

  constructor(
    id: string,
    root: THREE.Object3D,
    clips: Map<string, THREE.AnimationClip>,
    modelForward: THREE.Vector3,
  ) {
    this.id = id;
    this.root = root;
    this.modelForward = modelForward.clone().normalize();

    this.mixer = new THREE.AnimationMixer(root);

    for (const [state, clipName] of Object.entries(STATE_CLIPS)) {
      const clip = clips.get(clipName);
      if (!clip) {
        console.warn(`[personnage] ${id} : clip "${clipName}" absent de la bibliotheque`);
        continue;
      }
      this.actions.set(state as CharacterState, this.mixer.clipAction(clip));
    }

    /* Les gestes utilisent une COPIE du clip, jamais le clip original.
       Raison : Three.js renvoie le meme objet d'animation pour un meme
       clip. Or un geste peut reposer sur le meme clip qu'une posture
       ("think" et la posture attentive partagent "Standing"). Sans
       copie, regler le geste en lecture unique transformait AUSSI la
       posture de base en animation a usage unique : elle se figeait
       apres un cycle, et le personnage devenait une statue. */
    for (const [beat, clipName] of Object.entries(BEAT_CLIPS)) {
      const clip = clips.get(clipName);
      if (!clip) continue;
      const beatClip = clip.clone();
      beatClip.name = `beat_${beat}`;
      const action = this.mixer.clipAction(beatClip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = false;
      this.beatActions.set(beat as Beat, action);
    }

    this.head = findHeadBone(root);
    if (!this.head) {
      console.warn(`[personnage] ${id} : aucun os de tete trouve, le regard sera inactif`);
    } else {
      this.measureHeadForward();
    }

    this.setState('idle', 0);
  }

  /**
   * Change d'etat avec un fondu enchaine.
   *
   * Jamais de coupe seche : passer brutalement d'une pose a une autre
   * casse l'illusion instantanement. fadeIn/fadeOut font se recouvrir
   * les deux animations pendant la duree indiquee.
   */
  setState(state: CharacterState, fade = FADE): void {
    if (state === this.state && this.current) return;

    const next = this.actions.get(state);
    this.state = state;
    if (!next) return;

    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    if (fade > 0) next.fadeIn(fade);
    next.play();

    if (this.current && this.current !== next) {
      if (fade > 0) this.current.fadeOut(fade);
      else this.current.stop();
    }

    this.current = next;
    this.currentClip = next.getClip().name;
  }

  /** Definit le point que le personnage doit regarder, ou null pour cesser. */
  lookAt(target: THREE.Vector3 | null): void {
    this.target = target;
  }

  /**
   * Change d'humeur. Agit sur la vitesse d'animation et sur la facon
   * dont le personnage soutient -- ou fuit -- le regard.
   */
  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.gazeTimer = 0;
    this.gazeAverted = false;
    this.mixer.timeScale = MOOD_BEHAVIOUR[mood].timeScale;
  }

  /**
   * Joue un geste ponctuel par-dessus la posture.
   *
   * La posture de base est mise en retrait le temps du geste, puis
   * revient en fondu. Sans cela, le geste serait ecrase par l'animation
   * de fond des la premiere image.
   */
  playBeat(beat: Beat): void {
    const action = this.beatActions.get(beat);
    if (!action) return;

    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(BEAT_FADE).play();
    this.current?.fadeOut(BEAT_FADE);

    this.beatRemaining = action.getClip().duration;
    this.currentClip = BEAT_CLIPS[beat];
  }

  /** Un geste est-il en cours ? */
  get isPlayingBeat(): boolean {
    return this.beatRemaining > 0;
  }

  /**
   * @param active false quand le personnage n'est pas visible : on saute
   *               alors tout le calcul d'animation, qui est la partie
   *               couteuse (deformation du maillage par le squelette).
   */
  update(deltaTime: number, active: boolean): void {
    this.animated = active;
    if (!active) {
      this.blending = 0;
      return;
    }

    this.mixer.update(deltaTime);

    // Fin d'un geste ponctuel : on relance la posture de base en fondu.
    if (this.beatRemaining > 0) {
      this.beatRemaining -= deltaTime;
      if (this.beatRemaining <= 0) {
        this.beatRemaining = 0;
        for (const action of this.beatActions.values()) action.fadeOut(BEAT_FADE);
        if (this.current) {
          this.current.reset().setEffectiveWeight(1).fadeIn(BEAT_FADE).play();
          this.currentClip = this.current.getClip().name;
        }
      }
    }

    if (this.current) this.currentTime = this.current.time;

    // Combien d'animations se melangent reellement en ce moment ?
    this.blending = 0;
    for (const action of this.actions.values()) {
      if (action.isRunning() && action.getEffectiveWeight() > 0.01) this.blending++;
    }

    this.updateGaze(deltaTime);

    // IMPORTANT : le regard s'applique APRES mixer.update(). Dans l'autre
    // ordre, l'animation ecraserait la rotation de la tete a chaque image
    // et le personnage ne regarderait jamais nulle part.
    this.applyLook(deltaTime);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }

  // -----------------------------------------------------------------
  // Le regard
  // -----------------------------------------------------------------

  /**
   * Fait alterner contact visuel et rupture, selon l'humeur.
   *
   * C'est le principal moyen d'expression du personnage, et il est
   * volontairement AMBIGU : detourner les yeux peut trahir un mensonge,
   * ou simplement de la gene, du chagrin, de la lassitude. Le jeu ne
   * tranche jamais -- c'est au joueur de se faire une opinion.
   */
  private updateGaze(deltaTime: number): void {
    const behaviour = MOOD_BEHAVIOUR[this.mood];

    if (!this.target || behaviour.away <= 0) {
      this.gazeAverted = false;
      this.gazeTimer = 0;
      return;
    }

    this.gazeTimer -= deltaTime;
    if (this.gazeTimer <= 0) {
      this.gazeAverted = !this.gazeAverted;
      this.gazeTimer = this.gazeAverted ? behaviour.away : behaviour.look;

      if (this.gazeAverted) {
        // On regarde a cote, d'un cote ou de l'autre, et un peu plus bas.
        const side = Math.random() < 0.5 ? -1 : 1;
        this.gazeOffset.set(side * behaviour.offset, -0.35, 0);
      }
    }
  }

  /** Point reellement vise : la cible, ou un point a cote si le regard fuit. */
  private effectiveTarget(): THREE.Vector3 | null {
    if (!this.target) return null;
    if (!this.gazeAverted) return this.target;
    return this.gazeTarget.copy(this.target).add(this.gazeOffset);
  }

  /**
   * Mesure, au repos, quel axe local de la tete pointe vers l'avant.
   *
   * On ne peut pas le supposer : selon le logiciel de modelisation, l'os
   * de tete peut avoir n'importe quelle orientation de repos. On part de
   * la direction vers laquelle le MODELE regarde, et on la convertit
   * dans le repere de l'os.
   */
  private measureHeadForward(): void {
    if (!this.head) return;
    this.root.updateMatrixWorld(true);
    const headWorld = this.head.getWorldQuaternion(this.tmpQuatA);
    const rootWorld = this.root.getWorldQuaternion(this.tmpQuatB);
    // direction "avant" du modele, exprimee en monde
    this.headForward.copy(this.modelForward).applyQuaternion(rootWorld);
    // puis ramenee dans le repere local de l'os de tete
    this.headForward.applyQuaternion(headWorld.invert()).normalize();
  }

  private applyLook(deltaTime: number): void {
    if (!this.head?.parent) return;

    // Les matrices monde doivent refleter l'animation qu'on vient de jouer.
    this.root.updateMatrixWorld(true);

    const headPos = this.head.getWorldPosition(this.tmpVecA);

    /* Orientation REELLE de la tete telle que l'animation vient de la
       poser. C'est le point de depart de la correction.

       Partir de l'axe du CORPS serait une erreur : quand le joueur est
       droit devant, la rotation corps -> joueur vaut zero, on
       n'appliquerait donc rien, et la tete resterait la ou l'animation
       l'a mise. Le personnage ne regarderait jamais vraiment le joueur. */
    const animatedFacing = this.tmpVecB.copy(this.headForward)
      .applyQuaternion(this.head.getWorldQuaternion(this.tmpQuatA))
      .normalize();

    if (!this.aimInitialised) {
      this.aimDirection.copy(animatedFacing);
      this.aimInitialised = true;
    }

    // Direction souhaitee : vers la cible si elle existe (bornee par
    // rapport au corps), sinon simplement la pose animee.
    const aimAt = this.effectiveTarget();
    if (aimAt) {
      const bodyForward = this.tmpVecD.copy(this.modelForward)
        .applyQuaternion(this.root.getWorldQuaternion(this.tmpQuatB))
        .normalize();
      const desired = this.tmpVecC.subVectors(aimAt, headPos);
      if (desired.lengthSq() > 1e-8) {
        desired.normalize();
        this.computeClampedAim(bodyForward, desired);
      }
    } else {
      this.aimTarget.copy(animatedFacing);
      this.appliedYawDeg = 0;
    }

    // Lissage : la direction visee glisse, la tete ne saute jamais.
    const k = 1 - Math.exp(-LOOK_SPEED * deltaTime);
    this.aimDirection.lerp(this.aimTarget, k);
    if (this.aimDirection.lengthSq() < 1e-8) this.aimDirection.copy(animatedFacing);
    this.aimDirection.normalize();

    /* Rotation a appliquer : de la pose animee vers la direction visee.
       Recalculee entierement a chaque image a partir de la pose reelle,
       elle ne s'accumule donc jamais et se corrige toute seule. */
    this.desiredDelta.setFromUnitVectors(animatedFacing, this.aimDirection);

    const headWorld = this.head.getWorldQuaternion(this.tmpQuatA);
    const parentWorld = this.head.parent.getWorldQuaternion(this.tmpQuatB);
    headWorld.premultiply(this.desiredDelta);
    this.head.quaternion.copy(parentWorld.invert()).multiply(headWorld);

    this.measureLookAngle(headPos);
  }

  /**
   * Calcule la direction que la tete doit viser, bornee par rapport au
   * corps. Les limites sont relatives au CORPS : c'est lui qui definit
   * jusqu'ou un cou peut tourner.
   */
  private computeClampedAim(bodyForward: THREE.Vector3, desired: THREE.Vector3): void {
    // --- Composante horizontale ---
    const bodyYaw = Math.atan2(bodyForward.x, bodyForward.z);
    const desiredYaw = Math.atan2(desired.x, desired.z);
    let yaw = desiredYaw - bodyYaw;
    // Ramene l'ecart dans [-PI, PI] : sans cela, un joueur juste derriere
    // ferait tourner la tete dans le mauvais sens.
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    const maxYaw = THREE.MathUtils.degToRad(MAX_YAW);
    const clampedYaw = THREE.MathUtils.clamp(yaw, -maxYaw, maxYaw);
    this.appliedYawDeg = THREE.MathUtils.radToDeg(clampedYaw);

    // --- Composante verticale ---
    const maxPitch = THREE.MathUtils.degToRad(MAX_PITCH);
    const pitch = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(desired.y, -1, 1)), -maxPitch, maxPitch);

    // --- Direction finale, reconstruite a partir des angles bornes ---
    const finalYaw = bodyYaw + clampedYaw;
    const cosPitch = Math.cos(pitch);
    this.aimTarget.set(
      Math.sin(finalYaw) * cosPitch,
      Math.sin(pitch),
      Math.cos(finalYaw) * cosPitch,
    ).normalize();
  }

  /** Angle reel entre l'axe de la tete et la cible : la mesure du resultat. */
  private measureLookAngle(headPos: THREE.Vector3): void {
    if (!this.target || !this.head) {
      this.lookAngleDeg = 0;
      return;
    }
    const facing = this.tmpVecB.copy(this.headForward)
      .applyQuaternion(this.head.getWorldQuaternion(this.tmpQuatA))
      .normalize();
    const toTarget = this.tmpVecC.subVectors(this.target, headPos);
    if (toTarget.lengthSq() < 1e-8) return;
    toTarget.normalize();
    this.lookAngleDeg = THREE.MathUtils.radToDeg(
      Math.acos(THREE.MathUtils.clamp(facing.dot(toTarget), -1, 1)),
    );
  }
}

/**
 * Cherche l'os de tete par son nom.
 *
 * Recherche insensible a la casse sur un nom contenant "head" : cela
 * couvre "Head", "rig_Head", "mixamorig:Head", "Bip01_Head"... On evite
 * volontairement "HeadTop" ou "HeadEnd", qui sont des os terminaux.
 */
function findHeadBone(root: THREE.Object3D): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((node) => {
    if (found || !(node instanceof THREE.Bone)) return;
    const name = node.name.toLowerCase();
    if (name.includes('head') && !name.includes('top') && !name.includes('end')) {
      found = node;
    }
  });
  return found;
}
