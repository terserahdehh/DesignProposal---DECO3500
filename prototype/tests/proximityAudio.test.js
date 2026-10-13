const test = require('node:test');
const assert = require('node:assert/strict');
const { createBeepPreview } = require('../utils/proximityAudio');

function harness({ audio = true } = {}) {
  let clock = 0;
  let timers = [];
  const tones = [];
  let closed = 0;
  class FakeContext {
    constructor() { this.currentTime = 0; this.destination = {}; this.state = 'running'; }
    createOscillator() {
      return { frequency: { value: 0 }, connect() {}, start: at => tones.push({ at: clock, audioTime: at }), stop() {} };
    }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    async resume() {}
    async close() { closed++; this.state = 'closed'; }
  }
  const preview = createBeepPreview({
    AudioContext: audio ? FakeContext : undefined,
    now: () => clock,
    setTimeout: (fn, ms) => { const timer = { at: clock + ms, fn }; timers.push(timer); return timer; },
    clearTimeout: timer => { timers = timers.filter(item => item !== timer); },
  });
  const advanceTo = until => {
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > until) break;
      timers.shift();
      clock = next.at;
      next.fn();
    }
    clock = until;
  };
  return { preview, tones, advanceTo, get timers() { return timers; }, get closed() { return closed; } };
}

const plan = interval => ({ active: true, beepIntervalMs: interval });

test('the laptop preview stays silent until the user enables it', async () => {
  const h = harness();
  h.preview.update(plan(500));
  h.advanceTo(3000);
  assert.equal(h.tones.length, 0);
  assert.equal(h.preview.state.enabled, false);
  assert.equal((await h.preview.enable()).ok, true);
  assert.equal(h.tones.length, 1);
});

test('beeps follow the band interval, speed up immediately and stop on unusable measurements', async () => {
  const h = harness();
  h.preview.update(plan(500));
  await h.preview.enable();
  h.advanceTo(499);
  assert.equal(h.tones.length, 1);
  h.advanceTo(500);
  assert.equal(h.tones.length, 2);
  // Approaching: the next beep is due 200 ms after the last one, not 500 ms.
  h.advanceTo(650);
  h.preview.update(plan(200));
  h.advanceTo(699);
  assert.equal(h.tones.length, 2);
  h.advanceTo(700);
  assert.equal(h.tones.length, 3);
  assert.deepEqual(h.tones.map(tone => tone.at), [0, 500, 700]);
  // Stale/offline/inaccurate measurements silence the preview at once.
  h.preview.update({ active: false, beepIntervalMs: 0 });
  assert.equal(h.timers.length, 0);
  h.advanceTo(5000);
  assert.equal(h.tones.length, 3);
  assert.equal(h.preview.state.playing, false);
  // Recovery beeps immediately rather than waiting for an old interval.
  h.preview.update(plan(300));
  assert.equal(h.tones.length, 4);
  assert.equal(h.tones[3].at, 5000);
  h.preview.disable();
  h.advanceTo(9000);
  assert.equal(h.tones.length, 4);
  assert.equal(h.closed, 1);
});

test('browsers without audio support report an error and schedule nothing', async () => {
  const h = harness({ audio: false });
  h.preview.update(plan(200));
  const result = await h.preview.enable();
  assert.equal(result.ok, false);
  assert.match(result.error, /audio/i);
  assert.equal(h.timers.length, 0);
  assert.equal(h.preview.state.enabled, false);
});

test('a zero interval (too far for beeps) stays silent without disabling the preview', async () => {
  const h = harness();
  h.preview.update({ active: true, beepIntervalMs: 0 });
  await h.preview.enable();
  h.advanceTo(10000);
  assert.equal(h.tones.length, 0);
  assert.equal(h.preview.state.enabled, true);
});
