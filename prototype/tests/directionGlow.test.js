const test = require('node:test');
const assert = require('node:assert/strict');
const { directionGlow, arcPath, DIRECTION_ARROW_PATH } = require('../utils/directionGlow');

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
  // Same final-approach curve as the firmware: full at 0.2 m, dimmest from 20 m.
  assert.equal(directionGlow(90, 0.2).brightness, 1);
  assert.ok(directionGlow(90, 0.4).brightness > directionGlow(90, 1.3).brightness);
  assert.ok(directionGlow(90, 5).brightness > directionGlow(90, 15).brightness);
  assert.ok(directionGlow(90, 15).brightness > directionGlow(90, 19).brightness);
  assert.equal(directionGlow(90, 20).brightness, 0.12);
  assert.equal(directionGlow(90, 200).brightness, 0.12);
  assert.ok(Math.abs(directionGlow(90, 5).brightness - 0.1997) < 1e-3);
  // Desk scale must be visible: touching is at least twice as bright as 1 m.
  assert.ok(directionGlow(90, 0.1).brightness >= 2 * directionGlow(90, 1).brightness);
  for (const value of [NaN, Infinity, -1]) assert.equal(directionGlow(90, value), null);
  assert.equal(directionGlow(NaN, 10), null);
});

test('large web arrow is centered in the compass and stays inside its quarter-ring at every rotation', () => {
  const numbers = DIRECTION_ARROW_PATH.match(/\d+/g).map(Number);
  const xs = [], ys = [];
  for (let i = 0; i < numbers.length; i += 2) {
    xs.push(numbers[i]); ys.push(numbers[i + 1]);
    for (let bearing = 0; bearing < 360; bearing += 45) {
      const radians = bearing * Math.PI / 180;
      const dx = numbers[i] - 50, dy = numbers[i + 1] - 50;
      const x = dx * Math.cos(radians) - dy * Math.sin(radians);
      const y = dx * Math.sin(radians) + dy * Math.cos(radians);
      assert.ok(Math.hypot(x, y) < 42.5, 'arrow must clear the quarter-ring halo');
    }
  }
  assert.equal((Math.min(...xs) + Math.max(...xs)) / 2, 50);
  assert.equal((Math.min(...ys) + Math.max(...ys)) / 2, 50);
  assert.ok(Math.max(...ys) - Math.min(...ys) >= 70, 'arrow must fill at least 70% of the compass height');
  for (let bearing = 0; bearing < 360; bearing += 45) {
    const radians = bearing * Math.PI / 180;
    const rotated = xs.map((x, index) => ({
      x: (x - 50) * Math.cos(radians) - (ys[index] - 50) * Math.sin(radians),
      y: (x - 50) * Math.sin(radians) + (ys[index] - 50) * Math.cos(radians),
    }));
    for (const axis of ['x', 'y']) {
      const values = rotated.map(point => point[axis]);
      assert.ok(Math.abs(Math.min(...values) + Math.max(...values)) < 1e-10, 'visible bounds must remain centred at diagonal bearings');
    }
  }
});

test('reported half-metre changes update light brightness at desk and festival distances', () => {
  assert.ok(directionGlow(90, 15.5).brightness < directionGlow(90, 15).brightness);
  assert.ok(directionGlow(90, 1.5).brightness < directionGlow(90, 1).brightness);
  assert.ok(directionGlow(90, 0.6).brightness < directionGlow(90, 0.3).brightness);
  assert.equal(directionGlow(90, 0.05).brightness, directionGlow(90, 0.2).brightness);
});
