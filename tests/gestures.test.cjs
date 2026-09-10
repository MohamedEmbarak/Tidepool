const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup(target = null) {
  const module = {}, calls = [], timers = new Map(); let nextTimer = 0;
  vm.runInNewContext(ts.transpile(fs.readFileSync('src/world/gestures.ts', 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }), {
    exports: module, setTimeout: cb => { timers.set(++nextTimer, cb); return nextTimer; }, clearTimeout: id => timers.delete(id),
  });
  const callbacks = Object.fromEntries(['start', 'navigate', 'drag', 'tap', 'hold', 'zoom', 'release', 'reset'].map(name => [name, (...args) => calls.push([name, ...args])]));
  const gesture = new module.DiveGestures({ ...callbacks, hit: () => target });
  return { gesture, calls, timers };
}
const p = (x, y) => ({ x, y });

test('a tap collects once; cancellation never collects or launches inertia', () => {
  const { gesture: g, calls } = setup({ kind: 'relic', value: 'bottle' });
  g.down(10, p(40, 40), 0, true); g.up(99, p(40, 40), 10);
  assert.equal(g.active, true);
  g.up(10, p(40, 40), 30); g.up(10, p(40, 40), 35);
  assert.equal(calls.filter(c => c[0] === 'tap').length, 1);
  g.down(11, p(40, 40), 50, true); g.move(11, p(40, 5), 70); g.up(11, p(40, 5), 75, true);
  assert.equal(calls.filter(c => c[0] === 'tap').length, 1);
  assert.deepEqual(calls.at(-1), ['release', 0]);
});

test('long press inspects without collecting; movement cancels inspection', () => {
  const { gesture: g, calls, timers } = setup({ kind: 'relic', value: 'key' });
  g.down(1, p(40, 40), 0, true); [...timers.values()][0](); g.up(1, p(40, 40), 500);
  assert.equal(calls.filter(c => c[0] === 'hold').length, 1);
  assert.equal(calls.filter(c => c[0] === 'tap').length, 0);
  g.down(1, p(40, 40), 600, true); g.move(1, p(40, 10), 620);
  assert.equal(timers.size, 0); g.cancel(); assert.equal(g.active, false);
});

test('a second finger takes over creature dragging; lifting it rebases without a jump or collection', () => {
  const { gesture: g, calls } = setup({ kind: 'creature', value: 'jelly' });
  g.down(1, p(100, 200), 0, true); g.move(1, p(100, 180), 20);
  assert.equal(calls.filter(c => c[0] === 'drag').length, 1);
  g.down(2, p(200, 180), 30, true); g.move(2, p(250, 180), 50);
  assert.equal(calls.find(c => c[0] === 'zoom')[1], 1.5);
  assert.deepEqual(calls.find(c => c[0] === 'navigate'), ['navigate', 25, 0, true]);
  g.up(2, p(250, 180), 60); g.move(1, p(100, 170), 80); g.up(1, p(100, 170), 90);
  assert.deepEqual(calls.filter(c => c[0] === 'navigate').at(-1), ['navigate', 0, -10, false]);
  assert.equal(calls.filter(c => c[0] === 'tap').length, 0);
  assert.deepEqual(calls.at(-1), ['release', 0]);
});

test('a fast swipe has momentum; a paused swipe and a creature drag do not', () => {
  const { gesture: g, calls } = setup();
  g.down(1, p(100, 200), 0, true); g.move(1, p(100, 100), 100); g.up(1, p(100, 100), 110);
  assert.ok(calls.at(-1)[1] < -100);
  g.down(1, p(100, 200), 200, true); g.move(1, p(100, 100), 300); g.up(1, p(100, 100), 500);
  assert.deepEqual(calls.at(-1), ['release', 0]);
  const { gesture: jelly, calls: jc } = setup({ kind: 'creature', value: 'jelly' });
  jelly.down(1, p(100, 200), 0, true); jelly.move(1, p(100, 100), 100); jelly.up(1, p(100, 100), 110);
  assert.deepEqual(jc.at(-1), ['release', 0]);
});

test('double tapping open water resets the view; a cancelled gesture clears tap history', () => {
  const { gesture: g, calls } = setup();
  for (const now of [0, 150]) { g.down(1, p(100, 200), now, true); g.up(1, p(100, 200), now + 30); }
  assert.equal(calls.filter(c => c[0] === 'reset').length, 1);
  g.down(1, p(100, 200), 200, true); g.up(1, p(100, 200), 220); g.cancel();
  g.down(1, p(100, 200), 250, true); g.up(1, p(100, 200), 280);
  assert.equal(calls.filter(c => c[0] === 'reset').length, 1);
});

test('holding a carrier works with mouse and touch, while drag and second-finger changes cancel the hold', () => {
  for (const touch of [false, true]) {
    const { gesture: g, calls, timers } = setup({ kind: 'creature', holdable: true, value: 'amber' });
    g.down(1, p(100, 100), 0, touch); assert.equal(timers.size, 1);
    [...timers.values()][0](); g.up(1, p(100, 100), 700);
    assert.equal(calls.filter(c => c[0] === 'hold').length, 1); assert.equal(calls.filter(c => c[0] === 'tap').length, 0);
    g.down(1, p(100, 100), 800, touch); g.move(1, p(112, 100), 820); assert.equal(timers.size, 0); g.cancel();
    g.down(1, p(100, 100), 900, touch); g.down(2, p(130, 100), 920, true); assert.equal(timers.size, 0); g.cancel();
  }
});
