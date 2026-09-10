import * as T from 'three';
import { arch, mesh } from './models';

export function treasureChest() {
  const root = new T.Group(), lid = new T.Group();
  root.add(mesh(new T.BoxGeometry(1.8, 0.85, 1.1), '#4a3030', [0, -0.65, 0]));
  for (const x of [-0.67, 0.67]) root.add(mesh(new T.BoxGeometry(0.09, 0.9, 1.16), '#b9945f', [x, -0.65, 0]));
  lid.position.set(0, -0.2, -0.55);
  lid.add(mesh(new T.BoxGeometry(1.88, 0.18, 1.18), '#855636', [0, 0.05, 0.55]));
  for (const x of [-0.67, 0.67]) lid.add(mesh(new T.BoxGeometry(0.1, 0.22, 1.22), '#d4b077', [x, 0.05, 0.55]));
  lid.add(mesh(new T.BoxGeometry(0.22, 0.28, 0.09), '#d4b077', [0, -0.05, 1.15])); root.add(lid);
  return { root, lid, update(open: boolean, dt: number, reduced: boolean) { lid.rotation.x = T.MathUtils.damp(lid.rotation.x, open ? -1.75 : 0, reduced ? 40 : 5, dt); }, reset() { lid.rotation.x = 0; } };
}

export function breakableArch() {
  const root = arch();
  // A segmented stone seal blocks the treasure, and the same pieces become debris.
  for (let i = 0; i < 8; i++) {
    const segment = mesh(new T.CylinderGeometry(1.3, 1.3, 0.24, 8, 1, false, i * Math.PI / 4, Math.PI / 4), '#43556a', [0, 0, 0.35]);
    segment.rotation.x = Math.PI / 2; root.add(segment);
  }
  const shards = root.children.map((object, i) => ({ object, home: object.position.clone(), rotation: object.rotation.clone(), direction: new T.Vector3(Math.sin(i * 2.399) * 2, -1.2 - i % 3 * 0.5, Math.cos(i * 2.399) * 1.4) }));
  let age = 0;
  function update(open: boolean, hits: number, dt: number, reduced: boolean) {
    if (open) age = Math.min(2.2, age + dt);
    for (const [i, shard] of shards.entries()) {
      shard.object.position.copy(shard.home); shard.object.rotation.copy(shard.rotation);
      if (open) {
        if (!reduced) { shard.object.position.addScaledVector(shard.direction, age); shard.object.position.y -= age * age; shard.object.rotation.z += Math.sin(i * 7) * age; }
        shard.object.scale.setScalar(Math.max(0, 1 - age / (reduced ? 0.25 : 2.2))); shard.object.visible = age < (reduced ? 0.25 : 2.2);
      } else if (hits) { shard.object.position.x += Math.sign(Math.sin(i * 7)) * hits * 0.07; shard.object.rotation.z += Math.sin(i * 7) * hits * 0.025; }
    }
  }
  function reset() { age = 0; for (const s of shards) { s.object.position.copy(s.home); s.object.rotation.copy(s.rotation); s.object.scale.setScalar(1); s.object.visible = true; } }
  return { root, shards, update, reset };
}
