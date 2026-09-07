import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as T from 'three';

const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error('Usage: node scripts/convert-models.mjs <directory containing the Quaternius FBX files>');

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:application/octet-stream;base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};

mkdirSync('public/models', { recursive: true });
for (const name of ['Fish1', 'Fish2', 'Fish3', 'Manta ray', 'Whale']) {
  const bytes = readFileSync(resolve(sourceDirectory, `${name}.fbx`));
  const root = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  root.traverse(object => {
    if (!object.isMesh) return;
    if (object.isSkinnedMesh) object.normalizeSkinWeights();
    const geometry = object.geometry, groups = new Map(), original = geometry.index;
    // Export one primitive per material, instead of one per alternating face group.
    for (const group of geometry.groups) {
      if (!groups.has(group.materialIndex)) groups.set(group.materialIndex, []);
      const list = groups.get(group.materialIndex);
      for (let i = group.start; i < group.start + group.count; i++) list.push(original ? original.getX(i) : i);
    }
    if (groups.size) {
      const indices = []; geometry.clearGroups();
      for (const [index, list] of groups) { geometry.addGroup(indices.length, list.length, index); indices.push(...list); }
      geometry.setIndex(indices);
    }
    const old = Array.isArray(object.material) ? object.material : [object.material];
    const materials = old.map(m => new T.MeshStandardMaterial({ color: m.color, roughness: 0.6, metalness: 0, side: T.DoubleSide }));
    object.material = Array.isArray(object.material) ? materials : materials[0];
  });
  const result = await new GLTFExporter().parseAsync(root, { binary: true, animations: root.animations });
  const destination = `public/models/${name.toLowerCase().replace(' ', '-')}.glb`;
  writeFileSync(destination, Buffer.from(result));
  console.log(`${destination}: ${result.byteLength} bytes`);
}
