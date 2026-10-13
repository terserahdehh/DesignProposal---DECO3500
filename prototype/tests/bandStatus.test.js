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

const measured = { find: { mode: 'distance' },
  proximity: { active: true, source: 'wifi-ftm', metres: 0.42, uncertaintyMetres: 0.15, brightness: 0.81, beepIntervalMillis: 178 } };

test('band-measured distance works without locations and never claims a direction', () => {
  const state = describe({ ...measured, location: { valid: false }, peerLocation: { valid: false }, guidance: undefined });
  assert.equal(state.mode, 'distance');
  assert.match(state.title, /Distance to Syifa/);
  assert.match(state.detail, /0\.4 m ±0\.15 m/);
  assert.match(state.detail, /no compass/i);
  assert.equal(state.proximity.active, true);
});

test('the band’s suppressed direction is not revived from raw GPS guidance', () => {
  // GPS alone looks usable, but the band measured 0.4 m inside its uncertainty.
  const state = describe(measured);
  assert.equal(state.mode, 'distance');
  assert.doesNotMatch(state.detail, /clockwise from north/);
});

test('stale, offline or inactive band measurements fall back to location states', () => {
  assert.equal(describe({ ...measured, guidance: undefined, location: { valid: false } }, true, now - 6000).mode, 'waiting');
  assert.equal(describe({ ...measured, peerConnected: false }).mode, 'waiting');
  const inactive = describe({ find: { mode: 'unavailable' }, proximity: { active: false }, location: { valid: false }, guidance: undefined });
  assert.equal(inactive.mode, 'waiting');
  assert.equal(inactive.proximity.active, false);
});

test('direction from the band carries the band-measured distance and brightness', () => {
  const state = describe({ find: { mode: 'direction' }, proximity: { ...measured.proximity, metres: 98, uncertaintyMetres: 1.5, brightness: 0.2, beepIntervalMillis: 0 } });
  assert.equal(state.mode, 'ready');
  assert.match(state.detail, /90° clockwise from north/);
  assert.match(state.detail, /98 m measured/);
  assert.equal(state.proximity.brightness, 0.2);
});

test('a band demo direction is labelled as not measured and keeps the measured distance', () => {
  const state = describe({ find: { mode: 'demo-direction', demoBearing: 135 }, proximity: measured.proximity, location: { valid: false }, guidance: undefined });
  assert.equal(state.mode, 'demo');
  assert.equal(state.demoBearing, 135);
  assert.match(state.title, /DEMO direction/);
  assert.match(state.detail, /not measured/i);
  assert.match(state.detail, /0\.4 m ±0\.15 m/);
  assert.doesNotMatch(state.detail, /clockwise from north/);
  // Without a current measured distance, or with a malformed bearing, no demo shell.
  assert.equal(describe({ find: { mode: 'demo-direction', demoBearing: 135 }, proximity: { active: false }, location: { valid: false }, guidance: undefined }).mode, 'waiting');
  for (const demoBearing of [NaN, -1, 360, '90']) {
    assert.notEqual(describe({ find: { mode: 'demo-direction', demoBearing }, proximity: measured.proximity, location: { valid: false } }).mode, 'demo');
  }
  // GPS guidance in the status must not upgrade a demo into a measured direction.
  assert.equal(describe({ find: { mode: 'demo-direction', demoBearing: 135 }, proximity: measured.proximity }).mode, 'demo');
});

test('a walk-to-find estimate is shown with its uncertainty and never as a GPS direction', () => {
  const walk = { find: { mode: 'walk-estimate', walkBearing: 300, walkUncertaintyDegrees: 22, walk: { state: 'ok', steps: 14 } },
    proximity: { ...measured.proximity, metres: 6.2, uncertaintyMetres: 1.5 }, location: { valid: false }, guidance: undefined };
  const state = describe(walk);
  assert.equal(state.mode, 'walk');
  assert.equal(state.walkBearing, 300);
  assert.equal(state.walkUncertaintyDegrees, 22);
  assert.match(state.title, /Estimated direction/);
  assert.match(state.detail, /±22°/);
  assert.match(state.detail, /stays still/);
  assert.doesNotMatch(state.detail, /north/);
  for (const patch of [{ walkBearing: NaN }, { walkBearing: 360 }, { walkUncertaintyDegrees: 46 }, { walkUncertaintyDegrees: undefined }])
    assert.notEqual(describe({ ...walk, find: { ...walk.find, ...patch } }).mode, 'walk', JSON.stringify(patch));
  assert.notEqual(describe({ ...walk, proximity: { active: false } }).mode, 'walk');
  // Distance-only status passes the band's walk hint through.
  const hint = describe({ ...measured, find: { mode: 'distance', walk: { state: 'turn', steps: 6 } }, location: { valid: false }, guidance: undefined });
  assert.equal(hint.mode, 'distance');
  assert.match(hint.detail, /turn/i);
});

test('a warmer/colder estimate is labelled with its moves and uncertainty', () => {
  const probe = { find: { mode: 'probe-estimate', probeBearing: 90, probeUncertaintyDegrees: 64, probe: { last: 'counted', probes: 2 } },
    proximity: measured.proximity, location: { valid: false }, guidance: undefined };
  const state = describe(probe);
  assert.equal(state.mode, 'probe');
  assert.equal(state.probeBearing, 90);
  assert.equal(state.probeUncertaintyDegrees, 64);
  assert.match(state.title, /Warmer\/colder/);
  assert.match(state.detail, /2 moves/);
  assert.match(state.detail, /±64°/);
  for (const patch of [{ probeBearing: NaN }, { probeBearing: 360 }, { probeUncertaintyDegrees: 101 }])
    assert.notEqual(describe({ ...probe, find: { ...probe.find, ...patch } }).mode, 'probe', JSON.stringify(patch));
  assert.notEqual(describe({ ...probe, proximity: { active: false } }).mode, 'probe');
  const hint = describe({ ...measured, find: { mode: 'distance', probe: { last: 'no-change', probes: 0 } }, location: { valid: false }, guidance: undefined });
  assert.match(hint.detail, /did not change/);
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

test('uncertain laptop separation is not presented as a measured physical distance', () => {
  const state = describe({ guidance: { ...band.guidance, metres: 20, usable: false, accuracy: 54 } });
  assert.equal(state.mode, 'uncertain');
  assert.match(state.detail, /distance.*unknown/i);
  assert.match(state.detail, /±54 m/);
  assert.doesNotMatch(state.detail, /20 m|0 m/);
  assert.match(state.detail, /centimetre/i);
});
