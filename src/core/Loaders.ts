/* ===================================================================
   src/core/Loaders.ts

   CHARGEMENT DES MODELES 3D (.glb / .gltf)

   Un seul chargeur pour tout le projet, configure une fois. Aucun autre
   fichier ne doit creer son propre GLTFLoader : on passe toujours par
   ici, ce qui garantit la meme configuration et le meme cache partout.

   -------------------------------------------------------------------
   POURQUOI MESHOPT SEUL, ET PAS AUSSI DRACO NI KTX2
   -------------------------------------------------------------------
   Un fichier GLB peut etre compresse de plusieurs facons, et chacune
   demande son propre decodeur cote navigateur :

     - Meshopt : decodeur fourni par Three.js, un simple module
                 JavaScript inclus dans notre build. Rien a servir.
     - Draco   : demande de servir ~800 Ko de fichiers separes.
     - KTX2    : demande de servir ~1,6 Mo de transcodeur.

   Notre regle de projet est que TOUT asset passe par gltf-transform
   avant d'entrer dans public/ (voir le README). Cette etape reencode
   systematiquement la geometrie en Meshopt, quelle que soit la
   compression du fichier d'origine.

   Autrement dit : un modele telecharge compresse en Draco ressort de
   notre pipeline en Meshopt. Le navigateur n'a donc jamais besoin du
   decodeur Draco, et embarquer ces fichiers serait du poids mort.

   Le jour ou nous utiliserons reellement des textures KTX2 (Phase 13,
   pour reduire la memoire graphique), il suffira d'ajouter trois lignes
   ici et de copier le transcodeur dans public/.
   =================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Construit l'adresse d'un fichier de public/.
 *
 * IMPORTANT : ne jamais ecrire '/models/...' en dur. Avec un chemin
 * absolu, le jeu se casse des qu'il est publie dans un sous-dossier
 * (GitHub Pages). BASE_URL vaut './' grace au reglage base de Vite, ce
 * qui donne une adresse relative valable partout.
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

/** Progression globale du chargement, entre 0 et 1. */
export type ProgressHandler = (ratio: number, label: string) => void;

export class ModelLibrary {
  private readonly manager = new THREE.LoadingManager();
  private readonly loader: GLTFLoader;

  /** Un modele deja demande n'est jamais telecharge deux fois. */
  private readonly cache = new Map<string, Promise<GLTF>>();

  /** Tout ce qui a ete charge, pour pouvoir liberer la memoire ensuite. */
  private readonly loaded: GLTF[] = [];

  onProgress: ProgressHandler | null = null;

  constructor() {
    // Le LoadingManager suit AUSSI les textures chargees par le GLTFLoader :
    // la progression reflete donc le travail reel, pas seulement le .glb.
    this.manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      this.onProgress?.(itemsTotal > 0 ? itemsLoaded / itemsTotal : 1, shortName(url));
    };

    this.loader = new GLTFLoader(this.manager);
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  /**
   * Charge un modele depuis public/.
   * @param path chemin relatif a public/, ex. 'models/props/lampe.glb'
   */
  load(path: string): Promise<GLTF> {
    const cached = this.cache.get(path);
    if (cached) return cached;

    const url = assetUrl(path);
    const promise = this.loader.loadAsync(url).then((gltf) => {
      this.loaded.push(gltf);
      return gltf;
    });

    // On met la promesse en cache AVANT qu'elle aboutisse : deux demandes
    // simultanees du meme modele ne declenchent ainsi qu'un telechargement.
    this.cache.set(path, promise);

    // Un chargement rate ne doit pas rester en cache, sinon un nouvel essai
    // renverrait eternellement la meme erreur.
    promise.catch(() => this.cache.delete(path));

    return promise;
  }

  /** Libere geometries, materiaux et textures de tous les modeles charges. */
  dispose(): void {
    for (const gltf of this.loaded) disposeObject3D(gltf.scene);
    this.loaded.length = 0;
    this.cache.clear();
  }
}

/**
 * Libere la memoire graphique d'un objet et de ses enfants.
 *
 * Three.js ne le fait pas tout seul : sans cet appel, changer de lieu
 * plusieurs fois finit par saturer la memoire du navigateur. C'est la
 * premiere cause de fuite memoire dans une application WebGL.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    object.geometry?.dispose();

    const materials: THREE.Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of materials) {
      if (!material) continue;
      // Les textures sont rangees dans des proprietes du materiau
      // (map, normalMap, roughnessMap...). On les parcourt toutes.
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

/** 'http://.../models/props/x.glb' -> 'x.glb' */
function shortName(url: string): string {
  return url.split('/').pop() ?? url;
}
