const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const catalog = {};
vm.runInNewContext(ts.transpile(fs.readFileSync('src/world/catalog.ts', 'utf8'), { module: ts.ModuleKind.CommonJS }), { exports: catalog });

test('save data accepts known unique IDs and ignores malformed or foreign values', () => {
  for (const invalid of [null, 'null', '{}', 'not json', '42']) assert.equal(catalog.readFinds(invalid).length, 0);
  assert.equal(JSON.stringify(catalog.readFinds('["pearl","pearl","unknown",false,"key"]')), '["pearl","key"]');
});

test('containers must open; objects cannot be collected twice; final fragment requires every other object', () => {
  const found = new Set(); const opened = new Set();
  for (const id of ['pearl', 'key']) {
    assert.equal(catalog.canCollect(id, found, opened), false);
    opened.add(id); assert.equal(catalog.canCollect(id, found, opened), true);
  }
  assert.equal(catalog.canCollect('moon', found, opened), false);
  for (const { id } of catalog.RELICS.filter(r => r.id !== 'moon')) {
    found.add(id); assert.equal(catalog.canCollect(id, found, opened), false);
  }
  assert.equal(catalog.canCollect('moon', found, opened), true);
  found.add('moon'); assert.equal(catalog.canCollect('moon', found, opened), false);
  const restored = new Set(catalog.readFinds(JSON.stringify([...found])));
  assert.equal(restored.size, 6);
  for (const id of restored) assert.equal(catalog.canCollect(id, restored, opened), false);
});

test('camera remains bounded through repeated reversals and long resume frames', () => {
  let depth = 0;
  for (let trip = 0; trip < 20; trip++) {
    for (const target of [900, -100]) {
      for (let frame = 0; frame < 120; frame++) {
        const next = catalog.approach(depth, target, frame === 0 ? 10 : 1/60);
        assert.ok(next >= 0 && next <= 120);
        assert.ok(target > depth ? next >= depth : next <= depth);
        depth = next;
      }
    }
  }
  assert.equal(catalog.approach(12, 900, 1, true), 120);
  assert.equal(catalog.approach(12, -10, 1, true), 0);
});
