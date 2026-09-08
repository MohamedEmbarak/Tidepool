import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { placeModel, type ModelAssets } from './assets';
import { randomSequence } from './catalog';
import type { Water } from './habitat';

export type SchoolFish = { position: T.Vector3; offset: T.Vector3; velocity: T.Vector3; phase: number; size: number; band: number; species: number };
const BANDS = [0, 24, 48, 72, 96, 118];
const PER_SPECIES = 12;
export const SCHOOL_FISH_COUNT = BANDS.length * 3 * PER_SPECIES;

function bakeFish(asset: ModelAssets['fish1']) {
  const placed = placeModel(asset, 1.2), parts: T.BufferGeometry[] = [];
  placed.root.updateMatrixWorld(true);
  const point = new T.Vector3();
  placed.root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    if (object instanceof T.SkinnedMesh) object.skeleton.update();
    const source = object.geometry, index = source.getIndex(), count = index ? index.count : source.getAttribute('position').count;
    const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
    const material = (Array.isArray(object.material) ? object.material[0] : object.material) as T.MeshStandardMaterial;
    for (let i = 0; i < count; i++) {
      object.getVertexPosition(index ? index.getX(i) : i, point); point.applyMatrix4(object.matrixWorld).toArray(positions, i * 3);
      material.color.toArray(colors, i * 3);
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(positions, 3)); geometry.setAttribute('color', new T.BufferAttribute(colors, 3)); geometry.computeVertexNormals(); parts.push(geometry);
    if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
  });
  placed.mixer.stopAllAction(); placed.mixer.uncacheRoot(placed.mixer.getRoot());
  const geometry = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); geometry.computeBoundingSphere(); return geometry;
}

export function createSchools(assets: ModelAssets, water: Water) {
  const root = new T.Group(), fish: SchoolFish[] = [], batches: { mesh: T.InstancedMesh; fish: SchoolFish[]; depth: number }[] = [];
  const geometries = [assets.fish1, assets.fish2, assets.fish3].map(bakeFish);
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.56, metalness: 0.04 });
  material.onBeforeCompile = shader => {
    shader.uniforms.uSwimTime = water.time;
    shader.vertexShader = 'uniform float uSwimTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.z+=sin(uSwimTime*8.+position.x*8.+instanceMatrix[3].x*2.)*max(0.,-position.x)*.16;`);
  };
  const random = randomSequence(17171), matrix = new T.Object3D(), next = new T.Vector3(), previous = new T.Vector3(), away = new T.Vector3();
  for (const [band, depth] of BANDS.entries()) for (let species = 0; species < 3; species++) {
    const mesh = new T.InstancedMesh(geometries[species], material, PER_SPECIES); mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.boundingSphere = new T.Sphere(new T.Vector3(0, -depth, 0), 26);
    const members = Array.from({ length: PER_SPECIES }, (_, i): SchoolFish => ({ position: new T.Vector3(), offset: new T.Vector3(), velocity: new T.Vector3(), phase: i * 0.51 + random() * 0.3, size: 0.4 + random() * 0.58, band, species }));
    mesh.userData.fish = members; mesh.userData.owner = mesh;
    root.add(mesh); fish.push(...members); batches.push({ mesh, fish: members, depth });
  }
  function update(time: number, dt: number, depth: number, viewHeight: number, reduced: boolean, complete: boolean) {
    for (const batch of batches) {
      batch.mesh.visible = Math.abs(batch.depth - depth) < viewHeight * 0.65 + 12;
      if (!batch.mesh.visible) continue;
      batch.fish.forEach((f, i) => {
        const t = reduced ? 0 : time, a = f.phase + t * (0.16 + f.species * 0.025) + f.band;
        const gathering = complete && f.band === BANDS.length - 1;
        const radius = gathering ? 4 + f.species * 0.6 : 4.7 + Math.sin(f.phase * 2) * 2;
        next.set(Math.sin(a) * radius + (gathering ? 0 : Math.cos(t * 0.11 + f.species) * 1.4), -batch.depth + Math.sin(f.phase * 2.3) * (gathering ? 1.8 : 4.5) + Math.sin(a * 1.3) * 0.5, Math.cos(a) * (gathering ? 4 : 5.8));
        const distance = f.position.distanceTo(water.point.value);
        if (water.strength.value > 0.05 && distance < 4) {
          away.copy(f.position).sub(water.point.value); if (away.lengthSq() < 0.01) away.set(1, 0.4, 0);
          f.velocity.addScaledVector(away.normalize(), (1 - distance / 4) * water.strength.value * dt * 14);
        }
        f.velocity.multiplyScalar(Math.exp(-3.2 * dt)); f.offset.addScaledVector(f.velocity, dt).multiplyScalar(Math.exp(-0.85 * dt)); f.offset.clampLength(0, 6);
        previous.copy(f.position); f.position.copy(next).add(f.offset);
        const dx = f.position.x - previous.x, dz = f.position.z - previous.z;
        const yaw = reduced || dt === 0 || Math.hypot(dx, dz) < 0.001 ? Math.atan2(Math.sin(a), Math.cos(a)) : Math.atan2(-dz, dx);
        matrix.position.copy(f.position); matrix.rotation.set(0, yaw, Math.sin(a * 1.3) * 0.07); matrix.scale.setScalar(f.size); matrix.updateMatrix(); batch.mesh.setMatrixAt(i, matrix.matrix);
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  function scatter(point: T.Vector3, power: number) {
    for (const f of fish) {
      const distance = f.position.distanceTo(point); if (distance > 10) continue;
      away.copy(f.position).sub(point); if (away.lengthSq() < 0.01) away.set(1, 0.4, 0);
      f.velocity.addScaledVector(away.normalize(), (1 - distance / 10) * power);
    }
  }
  function reset() { fish.forEach(f => { f.offset.set(0, 0, 0); f.velocity.set(0, 0, 0); }); }
  update(0, 0, 0, Infinity, true, false);
  return { root, fish, targets: batches.map(b => b.mesh), update, scatter, reset };
}
