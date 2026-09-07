const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('animated models retain their scale and skeleton motion after cloning and placement', async () => {
  const T = await import('three');
  const loaderModule = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const skeletonModule = await import('three/examples/jsm/utils/SkeletonUtils.js');
  const module = {};
  vm.runInNewContext(ts.transpile(fs.readFileSync('src/world/assets.ts', 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }), {
    exports: module,
    require: name => name === 'three' ? T : name.includes('GLTFLoader') ? loaderModule : skeletonModule,
  });
  for (const name of ['fish1', 'fish2', 'fish3', 'manta-ray', 'whale']) {
    const bytes = fs.readFileSync(`public/models/${name}.glb`);
    const asset = await new loaderModule.GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    assert.ok(asset.animations.length > 0, `${name} has swimming animation`);
    const placed = module.placeModel(asset, 3);
    const bones = [];
    placed.root.traverse(o => { if (o.isBone) bones.push(o); });
    const pose = () => bones.map(b => b.quaternion.toArray().join(',')).join('|');
    const initial = pose();
    for (let i = 0; i < 15; i++) {
      placed.mixer.update(0.08); placed.root.updateMatrixWorld(true);
      placed.root.traverse(o => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); } });
      const box = new T.Box3().setFromObject(placed.root), size = box.getSize(new T.Vector3());
      assert.ok(Math.max(size.x, size.y, size.z) > 1.5 && Math.max(size.x, size.y, size.z) < 5, `${name} remains at world scale`);
      assert.ok(box.getCenter(new T.Vector3()).length() < 1.5, `${name} stays centred`);
    }
    assert.notEqual(pose(), initial, `${name} skeleton actually moves`);
    let meshes = 0; placed.root.traverse(o => { if (o.isMesh) meshes++; });
    assert.ok(meshes <= 6, `${name} avoids fragmented material draw calls`);
    module.disposeObject(placed.root); module.disposeObject(asset.scene);
  }
});

test('the shipped model budget stays below 1 MB and all ship textures are present', () => {
  const files = ['fish1', 'fish2', 'fish3', 'manta-ray', 'whale', 'ship-small'].map(name => `${name}.glb`);
  assert.equal(files.length, 6);
  assert.ok(files.reduce((sum, f) => sum + fs.statSync(`public/models/${f}`).size, 0) < 1_000_000);
  const bytes = fs.readFileSync('public/models/ship-small.glb');
  const jsonLength = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  for (const image of gltf.images ?? []) if (image.uri) assert.ok(fs.existsSync(`public/models/${image.uri}`));
});
