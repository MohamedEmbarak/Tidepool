const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, deps = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpile(fs.readFileSync(file, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }), { exports, require: name => deps[name] });
  return exports;
}
const { readMoonReward } = load('src/world/moonReward.ts');
test('moon reward survives an empty journal and preserves the chosen lighting', () => {
  for (const night of [true, false]) {
    const reward = readMoonReward(JSON.stringify({ unlocked: true, night }), []);
    assert.equal(reward.unlocked, true); assert.equal(reward.night, night);
  }
  const migrated = readMoonReward(null, ['moon']);
  assert.equal(migrated.unlocked, true); assert.equal(migrated.night, true);
  assert.equal(readMoonReward('{broken', ['moon']).unlocked, true);
  for (const raw of [null, 'null', 'false', '[]', '{broken', '{"unlocked":"true","night":true}', '{"night":true}']) {
    const reward = readMoonReward(raw, ['pearl']);
    assert.equal(reward.unlocked, false); assert.equal(reward.night, false);
  }
});
test('night swarms use bounded resources across toggles, depth changes, and reduced motion', async () => {
  const T = await import('three'), catalog = load('src/world/catalog.ts');
  const { nightSwarms } = load('src/world/night.ts', { three: T, './catalog': catalog });
  const swarms = nightSwarms(1.5), points = swarms.root.children.find(o => o.isPoints);
  const lights = swarms.root.children.filter(o => o.isPointLight), geometry = points.geometry, material = points.material;
  assert.equal(lights.length, 2); assert.equal(geometry.attributes.position.count, 128);
  for (let i = 0; i < 100; i++) {
    const focus = new T.Vector3(0, -i, 0); swarms.update(i, i % 2, focus, false);
    assert.ok(swarms.root.position.equals(focus)); assert.equal(points.visible, Boolean(i % 2));
    assert.equal(points.geometry, geometry); assert.equal(points.material, material);
    assert.ok(lights.every(light => !light.castShadow && light.intensity === (i % 2) * 22));
  }
  swarms.update(100, 1, new T.Vector3(), true); const before = lights[0].position.clone();
  swarms.update(200, 1, new T.Vector3(), true); assert.ok(lights[0].position.equals(before));
  assert.equal(material.uniforms.uTime.value, 0); swarms.setPixelRatio(1); assert.equal(material.uniforms.uRatio.value, 1);
  geometry.dispose(); material.dispose();
});
test('the final treasure is a bounded spherical moon with crater relief', async () => {
  const T = await import('three'), buffers = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const { relicModel } = load('src/world/models.ts', { three: T, './catalog': load('src/world/catalog.ts'), 'three/examples/jsm/utils/BufferGeometryUtils.js': buffers });
  const moon = relicModel('moon'); assert.equal(moon.children.length, 1);
  const mesh = moon.children[0], position = mesh.geometry.attributes.position, p = new T.Vector3();
  let min = Infinity, max = 0;
  for (let i = 0; i < position.count; i++) { p.fromBufferAttribute(position, i); min = Math.min(min, p.length()); max = Math.max(max, p.length()); }
  assert.ok(min < 0.7 && min > 0.6); assert.ok(max > 0.72 && max < 0.76);
  assert.ok(position.count < 3000); assert.equal(mesh.geometry.attributes.color.count, position.count);
  mesh.geometry.dispose(); mesh.material.dispose();
});
