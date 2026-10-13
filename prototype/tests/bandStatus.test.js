const test = require('node:test');
const assert = require('node:assert/strict');
const { describeBandStatus, initialTransportMode } = require('../utils/bandStatus');

const now = Date.now();
const fix = { valid: true, timestamp: now, simulated: false };
const band = { owner: 'nayaka', peer: 'syifa', peerConnected: true, location: fix, peerLocation: fix,
  guidance: { available: true, usable: true, metres: 100, bearing: 90, accuracy: 20, bearingUncertaintyDegrees: 11.5, northReferenced: true } };
const describe = (patch = {}, connected = true, observedAt = now, clock = now) => describeBandStatus({ ...band, ...patch }, 'nayaka', connected, observedAt, clock);

test('live physical direction includes north reference, distance and uncertainty', () => {
  const state = describe();
  assert.equal(state.mode, 'ready');
  assert.match(state.detail, /100 m.*90.*north.*11.5/);
  assert.equal(state.peerConnected, true);
});

test('disconnect, stale telemetry and wrong wearer suppress physical guidance and popups', () => {
  for (const state of [describe({}, false), describe({}, true, now - 9000), describe({ owner: 'syifa' })]) {
    assert.equal(state.mode, 'offline');
    assert.equal(state.incoming, null);
  }
});

test('expired locations and offline peer never retain a ready bearing', () => {
  for (const patch of [{ location: { ...fix, timestamp: now - 60000 } }, { peerLocation: { valid: false } }, { peerConnected: false }, { guidance: undefined }]) {
    assert.equal(describe(patch).mode, 'waiting');
  }
});

test('overlapping accuracy circles and malformed bearing suppress directional display', () => {
  assert.equal(describe({ guidance: { ...band.guidance, usable: false } }).mode, 'uncertain');
  assert.equal(describe({ guidance: { ...band.guidance, bearing: NaN } }).mode, 'waiting');
  assert.equal(describe({ guidance: { ...band.guidance, bearing: 361 } }).mode, 'waiting');
});

test('incoming custom messages are identified separately even when their text repeats', () => {
  const first = describe({ unread: true, incoming: 'Meet at gate two', incomingSequence: 42 });
  const second = describe({ unread: true, incoming: 'Meet at gate two', incomingSequence: 43 });
  assert.deepEqual(first.incoming, { from: 'syifa', text: 'Meet at gate two', key: 'nayaka:42:Meet at gate two' });
  assert.notEqual(first.incoming.key, second.incoming.key);
  assert.equal(describe({ unread: false, incoming: 'Meet at gate two' }).incoming, null);
  assert.equal(describe({ unread: true, incoming: 'x'.repeat(41) }).incoming, null);
});

test('demo guidance stays explicitly labelled as simulated', () => {
  assert.match(describe({ location: { ...fix, simulated: true } }).detail, /SIMULATED/);
});

test('public HTTPS phone setup starts with Bluetooth while localhost starts with USB', () => {
  assert.equal(initialTransportMode({ protocol: 'https:', hostname: 'pulseband-steel.vercel.app' }), 'bluetooth');
  for (const hostname of ['localhost', '127.0.0.1', '[::1]']) assert.equal(initialTransportMode({ protocol: 'http:', hostname }), 'usb');
  assert.equal(initialTransportMode(undefined), 'usb');
});

test('location diagnostics identify the missing wearer instead of a generic waiting message', () => {
  assert.match(describe({ location: { valid: false } }).detail, /Nayaka.*Keep location updated/);
  assert.match(describe({ peerLocation: { valid: false } }).detail, /Syifa.*Keep location updated/);
  assert.match(describe({ peerConnected: false }).detail, /Syifa.*offline/);
});

test('coarse laptop fixes explain overlapping accuracy and the need for independent phone positions', () => {
  const state = describe({ location: { ...fix, accuracy: 1000 }, peerLocation: { ...fix, accuracy: 1000 }, guidance: { ...band.guidance, metres: 2, usable: false, accuracy: 2000 } });
  assert.match(state.detail, /2000 m/);
  assert.match(state.detail, /overlap/);
  assert.match(state.detail, /own phone/);
});
