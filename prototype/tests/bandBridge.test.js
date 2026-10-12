const test = require('node:test');
const assert = require('node:assert/strict');
const { createBandBridge } = require('../utils/bandBridge');

const response = (data, ok = true) => ({ ok, json: async () => data });

test('preset syncing targets the selected wearer and waits for a positive band acknowledgement', async () => {
  const calls = [];
  const bridge = createBandBridge('http://localhost:8787', { fetch: async (url, options) => {
    calls.push({ url, options });
    return response({ ok: true, owner: 'syifa' });
  } });
  await bridge.syncPresets('syifa', [{ id: 'meeting', text: ' Near the stage ' }]);
  assert.equal(calls[0].url, 'http://localhost:8787/api/bands/syifa/presets');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { messages: [{ id: 'meeting', text: 'Near the stage' }] });
  const unconfirmed = createBandBridge('http://localhost:8787', { fetch: async () => response({ status: 'queued' }) });
  await assert.rejects(unconfirmed.syncPresets('nayaka', []), /did not acknowledge/);
  const offline = createBandBridge('http://localhost:8787', { fetch: async () => response({ ok: false, error: 'Nayaka is not connected' }, false) });
  await assert.rejects(offline.syncPresets('nayaka', []), /not connected/);
});

test('offline browser saves can never become hardware acknowledgements', async () => {
  const bridge = createBandBridge('http://localhost:8787', { fetch: async () => { throw new TypeError('network failed'); } });
  await assert.rejects(bridge.syncPresets('nayaka', [{ id: 'safe', text: "I'm Safe" }]), /Cannot reach the USB bridge/);
});

test('invalid messages and owners never reach the USB bridge', async () => {
  let requests = 0;
  const bridge = createBandBridge('http://localhost:8787', { fetch: async () => { requests++; return response({ ok: true }); } });
  await assert.rejects(bridge.syncPresets('syifa', [{ id: 'a', text: '🎵' }]), /no emoji/);
  await assert.rejects(bridge.syncPresets('../syifa', []), /Nayaka or Syifa/);
  assert.equal(requests, 0);
});

test('bridge status validates its response before exposing connections', async () => {
  const bands = [{ owner: 'nayaka', connected: true }, { owner: 'syifa', connected: false }];
  const bridge = createBandBridge('http://localhost:8787', { fetch: async (url, options) => { assert.match(url, /\/api\/bands$/); assert.equal(options.method, 'GET'); return response({ bands }); } });
  assert.deepEqual((await bridge.status()).bands, bands);
  await assert.rejects(createBandBridge('http://localhost:8787', { fetch: async () => response({ ok: true }) }).status(), /connected bands/);
});

test('loading USB presets uses a fresh acknowledged firmware status command for the selected owner', async () => {
  const messages = [{ id: 'gate', text: 'Meet at gate two' }];
  const bridge = createBandBridge('http://localhost:8787', { fetch: async (url, options) => {
    assert.equal(url, 'http://localhost:8787/api/bands/syifa/status');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), {});
    return response({ type: 'response', id: 'fresh-status', ok: true, owner: 'syifa', messages });
  } });
  assert.deepEqual(await bridge.readPresets('syifa'), { owner: 'syifa', messages });
});

test('USB readback rejects missing, wrong and contradictory firmware owners', async () => {
  for (const payload of [
    { ok: true, owner: 'syifa', messages: [] },
    { ok: true, messages: [] },
    { ok: true, owner: 'nayaka', band: { owner: 'syifa', messages: [] } },
  ]) {
    const bridge = createBandBridge('http://localhost:8787', { fetch: async () => response(payload) });
    await assert.rejects(bridge.readPresets('nayaka'), /selected wearer/);
  }
});

test('USB readback rejects malformed presets and accepts an acknowledged empty band list', async () => {
  for (const messages of [undefined, 'not a list', [{ id: 'duplicate', text: 'First' }, { id: 'duplicate', text: 'Second' }], [{ id: 'emoji', text: '🎉' }], [{ id: 'padding', text: ` ${'x'.repeat(40)} ` }]]) {
    const bridge = createBandBridge('http://localhost:8787', { fetch: async () => response({ ok: true, owner: 'nayaka', messages }) });
    await assert.rejects(bridge.readPresets('nayaka'), /invalid preset list/);
  }
  const bridge = createBandBridge('http://localhost:8787', { fetch: async () => response({ ok: true, owner: 'nayaka', messages: [] }) });
  assert.deepEqual(await bridge.readPresets('nayaka'), { owner: 'nayaka', messages: [] });
  const unconfirmed = createBandBridge('http://localhost:8787', { fetch: async () => response({ owner: 'nayaka', messages: [] }) });
  await assert.rejects(unconfirmed.readPresets('nayaka'), /did not acknowledge/);
});

test('real phone location includes accuracy and timestamp while invalid fixes are blocked', async () => {
  let requests = 0;
  const fix = { lat: -27.47, lon: 153.03, accuracy: 12, timestamp: Date.now(), simulated: false };
  const bridge = createBandBridge('http://localhost:8787', { fetch: async (url, options) => {
    requests++; assert.match(url, /\/api\/bands\/nayaka\/location$/); assert.deepEqual(JSON.parse(options.body), fix); return response({ ok: true });
  } });
  await bridge.shareLocation('nayaka', fix);
  for (const patch of [{ lat: NaN }, { lat: 91 }, { lon: -181 }, { accuracy: -1 }, { timestamp: 0 }, { simulated: true }]) await assert.rejects(bridge.shareLocation('nayaka', { ...fix, ...patch }), /valid phone location/);
  assert.equal(requests, 1);
});

test('stale, future and fractional phone fixes never reach USB hardware', async () => {
  const now = Date.now();
  let requests = 0;
  const bridge = createBandBridge('http://localhost:8787', { now: () => now, fetch: async () => { requests++; return response({ ok: true }); } });
  for (const timestamp of [now - 60000, now + 5001, now + 0.5]) {
    await assert.rejects(bridge.shareLocation('nayaka', { lat: 0, lon: 0, accuracy: 5, timestamp, simulated: false }), /fresh phone location/);
  }
  assert.equal(requests, 0);
});

test('a timed-out request stays unconfirmed', async () => {
  const bridge = createBandBridge('http://localhost:8787', { timeoutMs: 5, fetch: (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => { const error = new Error('Aborted'); error.name = 'AbortError'; reject(error); });
  }) });
  await assert.rejects(bridge.syncPresets('nayaka', []), /Delivery is unconfirmed/);
});
