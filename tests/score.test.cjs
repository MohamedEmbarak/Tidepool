const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const score = {};
vm.runInNewContext(ts.transpile(fs.readFileSync('src/lib/score.ts', 'utf8'), { module: ts.ModuleKind.CommonJS }), { exports: score });

test('the score progresses harmonically, loops, and expands on completing the expedition', () => {
  assert.notEqual(JSON.stringify(score.scoreStep(0, 0, false)), JSON.stringify(score.scoreStep(16, 0, false)));
  assert.deepEqual(score.scoreStep(0, 0, false).map(n => n.midi), score.scoreStep(64, 0, false).map(n => n.midi));
  assert.equal(score.scoreStep(1, 0, false).length, 0);
  assert.ok(score.scoreStep(1, 0, true).length > 0);
  const bright = score.scoreStep(2, 0, false)[0], deep = score.scoreStep(2, 1, false)[0];
  assert.ok(deep.gain < bright.gain); assert.ok(deep.duration > bright.duration);
});

test('every voice has a finite audible pitch, bounded gain/pan, and enough time for its attack', () => {
  for (const depth of [-1, 0, 0.5, 1, 2]) for (const complete of [false, true]) for (let i = 0; i < 256; i++) {
    for (const note of score.scoreStep(i, depth, complete)) {
      assert.ok(Number.isFinite(note.midi) && note.midi >= 28 && note.midi <= 96);
      assert.ok(note.gain > 0 && note.gain < 0.1);
      assert.ok(Math.abs(note.pan) <= 1);
      assert.ok(note.duration > (note.voice === 'pad' ? 1.5 : 0.08) && note.duration < 10);
    }
  }
});
