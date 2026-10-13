const test = require('node:test');
const assert = require('node:assert/strict');
const { createLocationSharing, prefersPreciseLocation } = require('../utils/locationSharing');

function setup(extra = {}) {
  const requests = [], sent = [], errors = [], notices = [];
  let watch, tick, resume, cleared = 0;
  const geo = {
    getCurrentPosition(ok, fail, options) { requests.push({ ok, fail, options }); },
    watchPosition(ok, fail, options) { watch = { ok, fail, options }; return 7; },
    clearWatch(id) { assert.equal(id, 7); cleared++; },
  };
  const document = { visibilityState: 'visible', addEventListener(_, fn) { resume = fn; }, removeEventListener() { resume = null; } };
  const session = createLocationSharing({ geolocation: geo, document,
    setInterval(fn, ms) { assert.equal(ms, 20000); tick = fn; return 1; }, clearInterval() { tick = null; },
    onPosition: async position => sent.push(position), onError: error => errors.push(error), onNotice: notice => notices.push(notice), ...extra });
  return { session, requests, sent, errors, notices, watch: () => watch, tick: () => tick?.(), resume: () => resume?.(), cleared: () => cleared };
}
const position = timestamp => ({ coords: { latitude: -27.47, longitude: 153.03, accuracy: 10 }, timestamp });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('phone accuracy preference distinguishes Chrome laptops from phones without fabricating GPS capability', () => {
  assert.equal(prefersPreciseLocation({ userAgentData: { mobile: false }, userAgent: 'Chrome Macintosh' }), false);
  assert.equal(prefersPreciseLocation({ userAgentData: { mobile: true } }), true);
  assert.equal(prefersPreciseLocation({ userAgent: 'Mozilla Android Mobile' }), true);
  assert.equal(prefersPreciseLocation({ userAgent: 'Mozilla Windows Chrome' }), false);
});

test('stationary sharing obtains genuinely new fixes every 20 seconds instead of replaying cached coordinates', async () => {
  const t = setup(); t.session.start(true);
  assert.equal(t.requests.length, 1);
  assert.equal(t.requests[0].options.maximumAge, 0);
  t.requests[0].ok(position(100)); await flush();
  t.tick(); assert.equal(t.requests.length, 2);
  t.requests[1].ok(position(20100)); await flush();
  assert.deepEqual(t.sent.map(p => p.timestamp), [100, 20100]);
  t.session.stop(); assert.equal(t.cleared(), 1);
});

test('high-accuracy timeout tries the laptop provider without claiming greater accuracy', async () => {
  const t = setup(); t.session.start(false);
  t.requests[0].fail({ code: 3 });
  assert.equal(t.requests.length, 2);
  assert.equal(t.requests[1].options.enableHighAccuracy, false);
  const coarse = position(100); coarse.coords.accuracy = 1500;
  t.requests[1].ok(coarse); await flush();
  assert.equal(t.sent[0].coords.accuracy, 1500);
  assert.equal(t.notices.length, 1);
  assert.equal(t.errors.length, 0);
});

test('desktop sharing requests the standard provider first without repeatedly waiting for a precise provider', () => {
  const t = setup({ preferHighAccuracy: false }); t.session.start(true);
  assert.equal(t.requests[0].options.enableHighAccuracy, false);
  assert.equal(t.watch().options.enableHighAccuracy, false);
  assert.equal(t.requests[0].options.maximumAge, 0);
  t.requests[0].fail({ code: 3 });
  assert.equal(t.requests.length, 1);
  assert.match(t.errors[0].message, /timed out/);
  t.tick();
  assert.equal(t.requests[1].options.enableHighAccuracy, false);
  t.session.stop();
});

test('permission denial stops all updates and returns actionable guidance without fallback', () => {
  const t = setup(); t.session.start(true);
  t.requests[0].fail({ code: 1 });
  assert.equal(t.requests.length, 1);
  assert.match(t.errors[0].message, /Chrome.*Location.*Allow/);
  assert.equal(t.errors[0].stopped, true);
  t.tick(); t.resume();
  assert.equal(t.requests.length, 1);
  assert.equal(t.cleared(), 1);
});

test('stopping sharing ignores late GPS responses and tears down timer, watcher and resume listener', async () => {
  const t = setup(); t.session.start(true); t.session.stop();
  t.requests[0].ok(position(100)); t.watch().ok(position(200)); await flush();
  t.tick(); t.resume();
  assert.equal(t.sent.length, 0);
  assert.equal(t.requests.length, 1);
});

test('a new position arriving during an upload is sent afterwards, with only the latest queued fix', async () => {
  const sent = []; let finish;
  const t = setup({ onPosition: async p => { sent.push(p.timestamp); if (sent.length === 1) await new Promise(resolve => { finish = resolve; }); } });
  t.session.start(true);
  t.requests[0].ok(position(100)); await flush();
  t.watch().ok(position(200)); t.watch().ok(position(300));
  finish(); await flush();
  assert.deepEqual(sent, [100, 300]);
  t.session.stop();
});

test('movement fixes are uploaded immediately without rounding coordinates or lowering accuracy', async () => {
  const t = setup({ preferHighAccuracy: false }); t.session.start(true);
  const first = position(100), moved = position(101);
  first.coords.accuracy = moved.coords.accuracy = 40;
  moved.coords.latitude += 0.0000001;
  t.requests[0].ok(first); await flush();
  t.watch().ok(moved); await flush();
  assert.equal(t.requests.length, 1, 'movement does not wait for the periodic request');
  assert.deepEqual(t.sent, [first, moved]);
  assert.equal(t.sent[1].coords.latitude, moved.coords.latitude);
  assert.equal(t.sent[1].coords.accuracy, 40);
  assert.equal(t.sent[1].timestamp, 101);
  t.session.stop();
});

test('returning to the page requests a new fix but does not overlap an outstanding GPS request', () => {
  const t = setup(); t.session.start(true); t.tick(); t.resume();
  assert.equal(t.requests.length, 1);
  t.requests[0].ok(position(100)); t.resume();
  assert.equal(t.requests.length, 2);
  t.session.stop();
});

test('failed providers leave continuous mode retryable, and exceptions become visible errors', () => {
  const t = setup(); t.session.start(true);
  t.requests[0].fail({ code: 2 }); t.requests[1].fail({ code: 2 });
  assert.match(t.errors[0].message, /device.*location/i);
  assert.equal(t.errors[0].stopped, false);
  t.tick(); assert.equal(t.requests.length, 3); t.session.stop();
  const broken = setup({ geolocation: { getCurrentPosition() { throw new Error('provider blocked'); } } });
  broken.session.start(false);
  assert.match(broken.errors[0].message, /provider blocked/);
});
