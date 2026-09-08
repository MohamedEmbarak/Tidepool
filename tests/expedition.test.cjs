const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpile(fs.readFileSync(file, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }), { exports, require: name => dependencies[name] });
  return exports;
}
const catalog = load('src/world/catalog.ts');

test('discoveries reshuffle in both horizontal axes while retaining depth, IDs, and reachable bounds', () => {
  const first = JSON.stringify(catalog.discoveryLocations(42));
  assert.equal(JSON.stringify(catalog.discoveryLocations(42)), first);
  assert.notEqual(JSON.stringify(catalog.discoveryLocations(43)), first);
  const x = new Set(), z = new Set();
  for (let seed = 0; seed < 150; seed++) for (const [i, at] of catalog.discoveryLocations(seed).entries()) {
    assert.equal(at.id, catalog.RELICS[i].id); assert.equal(at.depth, catalog.RELICS[i].depth);
    assert.ok(Math.hypot(at.x, at.z) < 4.1, 'discovery stays inside the clear camera orbit');
    assert.ok(at.z > 0); x.add(at.x); z.add(at.z);
  }
  assert.ok(x.size > 800 && z.size > 800);
});

test('rocks and rooted vegetation occupy one ocean floor with buried bases and a bounded mesh budget', async () => {
  const T = await import('three'), buffers = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const habitat = load('src/world/habitat.ts', { three: T, './catalog': catalog, 'three/examples/jsm/utils/BufferGeometryUtils.js': buffers });
  const world = habitat.buildHabitats({ time: { value: 0 }, point: { value: new T.Vector3(999, 999, 999) }, strength: { value: 0 } });
  world.root.updateMatrixWorld(true);
  const floor = world.scenery.find(p => p.name.startsWith('Ocean floor')).root;
  const ray = new T.Raycaster(), geometries = new Set(), materials = new Set();
  let triangles = 0;
  for (const prop of world.scenery) {
    const bounds = new T.Box3().setFromObject(prop.root);
    assert.ok(bounds.max.y < -catalog.MAX_DEPTH + 10, 'no rock or rooted garden floats at an intermediate depth');
    assert.ok(Math.abs(prop.home.y + habitat.SEABED_DEPTH) < 0.7);
    if (prop.kind === 'plant') {
      assert.ok(prop.anchored, 'touches must bend leaves without lifting their roots');
      ray.set(new T.Vector3(prop.home.x, -120, prop.home.z), new T.Vector3(0, -1, 0));
      const surface = ray.intersectObject(floor)[0]; assert.ok(surface);
      assert.ok(prop.home.y <= surface.point.y && prop.home.y > surface.point.y - 0.1, 'roots meet the rendered terrain');
    }
    prop.root.traverse(o => {
      if (!o.isMesh) return;
      triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      geometries.add(o.geometry); materials.add(o.material);
      for (const value of o.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
    });
  }
  assert.ok(world.scenery.length < 100 && triangles < 400000, 'the detailed seabed stays within its render budget');
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  world.root.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
});

test('layout seed validation preserves zero and rejects corrupted or unbounded values', () => {
  for (const input of [null, '', '-1', 'NaN', 'Infinity', '1.1', '{}', '4294967296']) assert.equal(catalog.readSeed(input), null);
  assert.equal(catalog.readSeed('0'), 0); assert.equal(catalog.readSeed('4294967295'), 4294967295);
});

test('perspective orbit changes viewing angle while keeping depth framing and zoom bounded', async () => {
  const T = await import('three'), { DiveCamera } = load('src/world/camera.ts', { three: T });
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
    const rig = new DiveCamera(); rig.resize(width, height);
    assert.ok(rig.camera.isPerspectiveCamera);
    for (let turn = 0; turn < 20; turn++) {
      rig.orbit(turn % 2 ? -900 : 1100, width); rig.update(68, 1 / 60, true);
      const centre = new T.Vector3(0, -68, 0).project(rig.camera);
      assert.ok(Math.abs(centre.x) < 0.0001 && Math.abs(centre.y) < 0.0001);
      assert.ok(Number.isFinite(rig.camera.position.length()));
    }
    const before = rig.camera.position.clone(); rig.orbit(100, width); rig.update(68, 1 / 60, true);
    assert.ok(before.distanceTo(rig.camera.position) > 1);
    rig.zoom = 1.8; rig.resize(width, height); rig.reset(); rig.resize(width, height); rig.update(0, 0, true);
    assert.equal(rig.zoom, 1); assert.equal(rig.yaw, 0); assert.equal(rig.pan, 0);
  }
});

test('dense schools share geometry, react locally, and reset without adding objects', async () => {
  const T = await import('three');
  const loaders = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const skeletons = await import('three/examples/jsm/utils/SkeletonUtils.js');
  const buffers = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const assetsModule = load('src/world/assets.ts', { three: T, 'three/examples/jsm/loaders/GLTFLoader.js': loaders, 'three/examples/jsm/utils/SkeletonUtils.js': skeletons });
  const schoolsModule = load('src/world/schools.ts', { three: T, './assets': assetsModule, './catalog': catalog, 'three/examples/jsm/utils/BufferGeometryUtils.js': buffers });
  const assets = {};
  for (const name of ['fish1', 'fish2', 'fish3']) { const bytes = fs.readFileSync(`public/models/${name}.glb`); assets[name] = await new loaders.GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''); }
  const water = { time: { value: 0 }, point: { value: new T.Vector3(999, 999, 999) }, strength: { value: 0 } };
  const schools = schoolsModule.createSchools(assets, water);
  assert.equal(schools.fish.length, 216); assert.equal(schools.root.children.length, 18);
  assert.equal(new Set(schools.root.children.map(mesh => mesh.geometry)).size, 3);
  const fish = schools.fish[0], original = fish.position.clone(), far = schools.fish.at(-1).position.clone();
  schools.scatter(original, 7); schools.update(0, 0.05, 0, 25, true, false);
  assert.ok(fish.position.distanceTo(original) > 0.001); assert.equal(schools.fish.at(-1).position.distanceTo(far), 0);
  for (let i = 0; i < 12; i++) { schools.reset(); schools.update(0, 0, 0, 25, true, false); }
  assert.ok(fish.position.distanceTo(original) < 0.00001); assert.equal(schools.root.children.length, 18);
  assert.ok(schools.targets.filter(mesh => mesh.visible).length <= 6);
  assetsModule.disposeObject(schools.root); Object.values(assets).forEach(a => assetsModule.disposeObject(a.scene));
});
