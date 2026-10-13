const test = require('node:test');
const assert = require('node:assert/strict');
const { describeProximity, PROXIMITY_STALE_MS } = require('../utils/proximity');

const now = 1_800_000_000_000;
const band = { owner: 'nayaka', peerConnected: true,
  proximity: { active: true, source: 'wifi-ftm', metres: 0.42, uncertaintyMetres: 0.15, brightness: 0.81, beepIntervalMillis: 178 } };

test('current firmware-measured proximity is reported with its source and uncertainty', () => {
  const state = describeProximity(band, now - 1000, now);
  assert.equal(state.active, true);
  assert.equal(state.source, 'wifi-ftm');
  assert.equal(state.beepIntervalMs, 178);
  assert.equal(state.brightness, 0.81);
  assert.match(state.label, /0\.4 m ±0\.15 m/);
  assert.match(state.label, /Wi-Fi round-trip timing/);
  const gps = describeProximity({ ...band, proximity: { ...band.proximity, source: 'phone-gps', metres: 120, uncertaintyMetres: 20, beepIntervalMillis: 0 } }, now, now);
  assert.equal(gps.active, true);
  assert.equal(gps.beepIntervalMs, 0);
  assert.match(gps.label, /120 m/);
  assert.match(gps.label, /device locations/);
});

test('offline peers, stale status and inactive firmware proximity give no light or beeps', () => {
  const cases = [
    describeProximity({ ...band, peerConnected: false }, now, now),
    describeProximity(band, now - PROXIMITY_STALE_MS, now),
    describeProximity(band, NaN, now),
    describeProximity({ ...band, proximity: { ...band.proximity, active: false } }, now, now),
    describeProximity({ ...band, proximity: undefined }, now, now),
    describeProximity(undefined, now, now),
    // The bridge's own receipt time also ages a cached USB snapshot.
    describeProximity({ ...band, statusReceivedAt: now - PROXIMITY_STALE_MS }, now, now),
  ];
  for (const state of cases) {
    assert.equal(state.active, false);
    assert.equal(state.beepIntervalMs, 0);
    assert.equal(state.brightness, 0);
  }
  assert.equal(describeProximity(band, now - PROXIMITY_STALE_MS + 1, now).active, true);
});

test('malformed proximity values are rejected rather than clamped into a claim', () => {
  for (const patch of [{ metres: -1 }, { metres: NaN }, { uncertaintyMetres: -0.1 }, { brightness: 1.2 },
    { brightness: -0.1 }, { beepIntervalMillis: 50 }, { beepIntervalMillis: 9000 }, { beepIntervalMillis: 1.5 }, { source: 'rssi' }]) {
    const state = describeProximity({ ...band, proximity: { ...band.proximity, ...patch } }, now, now);
    assert.equal(state.active, false, JSON.stringify(patch));
    assert.equal(state.beepIntervalMs, 0);
  }
});
