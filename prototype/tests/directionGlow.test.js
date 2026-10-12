const test = require('node:test');
const assert = require('node:assert/strict');
const { directionGlow, arcPath } = require('../utils/directionGlow');

test('the direction glow covers one quarter of the ring around the north bearing', () => {
  const glow = directionGlow(0, 100);
  assert.equal(glow.spanDegrees, 90);
  assert.equal(glow.bearing, 0);
  assert.match(arcPath(0), /^M /);
  assert.match(arcPath(0), / A 46 46 0 0 1 /);
  assert.notEqual(arcPath(0), arcPath(90));
  assert.equal(arcPath(360), arcPath(0));
});
test('proximity brightness is monotonic and invalid distances show no glow', () => {
  assert.equal(directionGlow(90, 5).brightness, 1);
  assert.ok(directionGlow(90, 25).brightness > directionGlow(90, 100).brightness);
  assert.ok(directionGlow(90, 100).brightness > directionGlow(90, 200).brightness);
  assert.equal(directionGlow(90, 200).brightness, 0.2);
  for (const value of [NaN, Infinity, -1]) assert.equal(directionGlow(90, value), null);
  assert.equal(directionGlow(NaN, 10), null);
});
