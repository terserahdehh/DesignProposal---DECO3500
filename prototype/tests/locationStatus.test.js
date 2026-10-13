const test = require('node:test');
const assert = require('node:assert/strict');
const { describeLocationStatus } = require('../utils/locationStatus');

const now = 1791860831769;
test('location diagnostics preserve actual accuracy and acquisition timestamp', () => {
  const fix = Object.freeze({ valid: true, timestamp: now - 12345, accuracy: 13.928, simulated: false });
  const state = describeLocationStatus(fix, now);
  assert.equal(state.state, 'fresh');
  assert.equal(state.timestamp, fix.timestamp);
  assert.equal(state.accuracy, 13.928);
  assert.equal(state.ageMs, 12345);
  assert.match(state.text, /12 s old.*±13.93 m/);
  assert.equal(fix.timestamp, now - 12345);
});

test('missing, expired, cleared and future-clock fixes remain distinguishable', () => {
  assert.equal(describeLocationStatus({ valid: false, timestamp: 0, accuracy: 0 }, now).state, 'missing');
  assert.doesNotMatch(describeLocationStatus({ valid: false, timestamp: 0, accuracy: 0 }, now).text, /±0/);
  assert.equal(describeLocationStatus({ valid: true, timestamp: now - 60000, accuracy: 40 }, now).state, 'expired');
  assert.equal(describeLocationStatus({ valid: false, timestamp: now - 1000, accuracy: 40 }, now).state, 'unavailable');
  const future = describeLocationStatus({ valid: true, timestamp: now + 6000, accuracy: 40 }, now);
  assert.equal(future.state, 'clock');
  assert.match(future.text, /6 s ahead/);
});

test('unreported accuracy and demonstration positions are explicitly labelled', () => {
  assert.match(describeLocationStatus({ valid: true, timestamp: now }, now).text, /accuracy unavailable/);
  assert.match(describeLocationStatus({ valid: true, timestamp: now, accuracy: 2, simulated: true }, now).text, /SIMULATED/);
});
