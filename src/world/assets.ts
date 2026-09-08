import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const MODEL_FILES = ['fish1', 'fish2', 'fish3', 'manta-ray', 'whale', 'ship-small'] as const;
export type ModelName = typeof MODEL_FILES[number];
export type ModelAssets = Record<ModelName, GLTF>;

export function disposeObject(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  root.traverse(o => {
    if (!(o instanceof T.Mesh || o instanceof T.Points)) return;
    geometries.add(o.geometry);
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      materials.add(m); Object.values(m).forEach(value => { if (value instanceof T.Texture) textures.add(value); });
    });
    if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
    if (o instanceof T.InstancedMesh) o.dispose();
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}

export async function loadModels() {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled(MODEL_FILES.map(async name => [name, await loader.loadAsync(new URL(`models/${name}.glb`, location.href).href)] as const));
  if (results.some(r => r.status === 'rejected')) {
    results.forEach(r => { if (r.status === 'fulfilled') disposeObject(r.value[1].scene); });
    throw new Error('The ocean models could not be loaded');
  }
  return Object.fromEntries(results.map(r => (r as PromiseFulfilledResult<readonly [ModelName, GLTF]>).value)) as ModelAssets;
}

export function placeModel(asset: GLTF, length: number, yaw = Math.PI / 2) {
  const root = new T.Group(); const orientation = new T.Group(); const origin = new T.Group();
  const model = clone(asset.scene);
  const mixer = new T.AnimationMixer(model);
  if (asset.animations[0]) mixer.clipAction(asset.animations[0]).play();
  mixer.update(0); model.updateMatrixWorld(true);
  // A cloned skin needs its bind transforms refreshed before measuring it.
  model.traverse(o => { if (o instanceof T.SkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); } });
  const box = new T.Box3().setFromObject(model);
  const size = box.getSize(new T.Vector3()); origin.position.copy(box.getCenter(new T.Vector3())).negate();
  origin.add(model); orientation.add(origin); root.add(orientation);
  orientation.scale.setScalar(length / Math.max(size.x, size.y, size.z)); orientation.rotation.y = yaw;
  model.traverse(o => {
    if (o instanceof T.Mesh) {
      o.frustumCulled = false;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (m instanceof T.MeshStandardMaterial) { m.roughness = Math.max(0.4, m.roughness); m.envMapIntensity = 0.55; }
      });
    }
  });
  return { root, mixer, orientation };
}
