const test = require('node:test');
const assert = require('node:assert/strict');
const { createPhoneBluetooth, CONFIG_CHARACTERISTIC } = require('../utils/phoneBluetooth');
const { SERVICE } = require('../utils/bluetooth');

function fakeBand(owner = 'nayaka', onCommand) {
  const handlers = new Map();
  const deviceHandlers = new Map();
  const frames = [];
  const chunks = [];
  let input = '';
  const notify = text => {
    const bytes = new TextEncoder().encode(text);
    for (let start = 0; start < bytes.length; start += 20) {
      const fragment = bytes.slice(start, start + 20);
      const padded = new Uint8Array(fragment.length + 6);
      padded.set(fragment, 3);
      const value = new DataView(padded.buffer, 3, fragment.length);
      handlers.get('characteristicvaluechanged')?.({ target: { value } });
    }
  };
  const characteristic = {
    properties: { write: true, notify: true },
    addEventListener: (event, callback) => handlers.set(event, callback),
    removeEventListener: event => handlers.delete(event),
    startNotifications: async () => characteristic,
    async writeValueWithResponse(chunk) {
      assert.ok(chunk.byteLength <= 20);
      chunks.push(chunk);
      input += new TextDecoder().decode(chunk);
      let newline;
      while ((newline = input.indexOf('\n')) >= 0) {
        const packet = JSON.parse(input.slice(0, newline));
        input = input.slice(newline + 1);
        frames.push(packet);
        const answer = onCommand ? onCommand(packet) : { ok: true, owner };
        if (answer !== null) notify(`${JSON.stringify({ id: packet.id, ...answer })}\n`);
      }
    },
  };
  const service = { getCharacteristic: async uuid => { assert.equal(uuid, CONFIG_CHARACTERISTIC); return characteristic; } };
  const server = { getPrimaryService: async uuid => { assert.equal(uuid, SERVICE); return service; } };
  const device = {
    name: `PulseBand ${owner}`, id: `band-${owner}`,
    addEventListener: (event, callback) => deviceHandlers.set(event, callback),
    removeEventListener: event => deviceHandlers.delete(event),
    gatt: {
      connected: false,
      async connect() { this.connected = true; return server; },
      disconnect() { this.connected = false; deviceHandlers.get('gattserverdisconnected')?.(); },
    },
  };
  const api = { async requestDevice(options) { assert.deepEqual(options.optionalServices, [SERVICE]); return device; } };
  return { api, frames, chunks, notify, device };
}

test('direct Bluetooth verifies firmware owner before exposing a connected band', async () => {
  const band = fakeBand('nayaka');
  const client = createPhoneBluetooth(band.api);
  assert.equal(await client.connect('nayaka'), true);
  assert.equal(client.getState().owner, 'nayaka');
  assert.equal(client.getState().status, 'connected');
  assert.equal(band.frames[0].cmd, 'hello');
  client.disconnect();
  assert.equal(client.getState().status, 'disconnected');
});

test('selecting the wrong physical band disconnects it and prevents configuration', async () => {
  const band = fakeBand('syifa');
  const client = createPhoneBluetooth(band.api);
  assert.equal(await client.connect('nayaka'), false);
  assert.equal(band.device.gatt.connected, false);
  assert.equal(client.getState().owner, null);
  assert.match(client.getState().message, /Syifa/);
  await assert.rejects(client.syncPresets('nayaka', []), /Connect the selected wearer/);
  assert.equal(band.frames.length, 1);
});

test('long preset frames and notification replies survive 20-byte fragmentation', async () => {
  const band = fakeBand();
  const client = createPhoneBluetooth(band.api);
  await client.connect('nayaka');
  const messages = Array.from({ length: 8 }, (_, index) => ({ id: `preset_${index}`, text: `Message ${index}: ${'x'.repeat(25)}` }));
  assert.equal((await client.syncPresets('nayaka', messages)).ok, true);
  assert.deepEqual(band.frames[1].messages, messages);
  assert.equal(band.frames[1].owner, 'nayaka');
  assert.ok(band.chunks.length > 20);
  client.disconnect();
});

test('real firmware top-level replies merge presets and location into verified band state', async () => {
  const messages = [{ id: 'meet', text: 'Meet at the gate' }];
  const fix = { lat: -27.47, lon: 153.03, accuracy: 10, timestamp: 1791422400000, simulated: false };
  const band = fakeBand('nayaka', packet => {
    if (packet.cmd === 'hello') return { type: 'response', ok: true, owner: 'nayaka', mac: 'AA:BB:CC:DD:EE:01', messages: [], location: { valid: false } };
    if (packet.cmd === 'presets') return { type: 'response', ok: true, owner: 'nayaka', messages: packet.messages };
    return { type: 'response', ok: true, owner: 'nayaka', location: { ...fix, valid: true } };
  });
  const client = createPhoneBluetooth(band.api);
  await client.connect('nayaka');
  await client.syncPresets('nayaka', messages);
  assert.deepEqual(client.getState().band.messages, messages);
  assert.equal(client.getState().band.mac, 'AA:BB:CC:DD:EE:01');
  await client.shareLocation('nayaka', fix);
  assert.deepEqual(client.getState().band.location, { ...fix, valid: true });
  assert.deepEqual(client.getState().band.messages, messages);
  client.disconnect();
});

test('Bluetooth preset loading asks the verified band for a fresh correlated stored list', async () => {
  const messages = [{ id: 'gate', text: 'Meet at gate two' }];
  const band = fakeBand('nayaka', packet => packet.cmd === 'hello' ? { ok: true, owner: 'nayaka' } : { type: 'response', ok: true, owner: 'nayaka', messages });
  const client = createPhoneBluetooth(band.api);
  await client.connect('nayaka');
  assert.deepEqual(await client.readPresets('nayaka'), { owner: 'nayaka', messages });
  assert.equal(band.frames[1].cmd, 'status');
  assert.equal(band.frames[1].owner, 'nayaka');
  assert.deepEqual(client.getState().band.messages, messages);
  client.disconnect();
});

test('Bluetooth readback rejects wrong or missing owner identities without accepting the message list', async () => {
  for (const reply of [
    { ok: true, owner: 'syifa', messages: [] },
    { ok: true, messages: [] },
    { ok: true, owner: 'nayaka', band: { owner: 'syifa', messages: [] } },
  ]) {
    const band = fakeBand('nayaka', packet => packet.cmd === 'hello' ? { ok: true, owner: 'nayaka' } : reply);
    const client = createPhoneBluetooth(band.api);
    await client.connect('nayaka');
    await assert.rejects(client.readPresets('nayaka'), /different band owner|selected wearer/);
    assert.equal(client.getState().owner, 'nayaka');
    client.disconnect();
  }
});

test('Bluetooth readback validates stored messages and preserves supported raw text', async () => {
  for (const messages of [undefined, [{ id: 'emoji', text: '🎉' }], [{ id: 'repeat', text: 'One' }, { id: 'repeat', text: 'Two' }]]) {
    const band = fakeBand('nayaka', packet => packet.cmd === 'hello' ? { ok: true, owner: 'nayaka' } : { ok: true, owner: 'nayaka', messages });
    const client = createPhoneBluetooth(band.api);
    await client.connect('nayaka');
    await assert.rejects(client.readPresets('nayaka'), /invalid preset list/);
    client.disconnect();
  }
  const messages = [{ id: 'raw', text: ' Meet here ' }];
  const band = fakeBand('nayaka', packet => packet.cmd === 'hello' ? { ok: true, owner: 'nayaka' } : { ok: true, owner: 'nayaka', messages });
  const client = createPhoneBluetooth(band.api);
  await client.connect('nayaka');
  assert.deepEqual((await client.readPresets('nayaka')).messages, messages);
  client.disconnect();
});

test('live status notifications update the verified wearer and ignore different or absent owners', async () => {
  const band = fakeBand('nayaka');
  const client = createPhoneBluetooth(band.api);
  await client.connect('nayaka');
  band.notify(`${JSON.stringify({ type: 'status', owner: 'nayaka', peer: { connected: true }, location: { valid: true } })}\n`);
  assert.deepEqual(client.getState().band.peer, { connected: true });
  assert.deepEqual(client.getState().band.location, { valid: true });
  const verified = client.getState().band;
  band.notify(`${JSON.stringify({ type: 'status', owner: 'syifa', location: { valid: false } })}\n`);
  band.notify(`${JSON.stringify({ type: 'status', peer: { connected: false } })}\n`);
  assert.deepEqual(client.getState().band, verified);
  client.disconnect();
  assert.equal(client.getState().band, null);
});

test('expired or cleared Bluetooth status removes the previous direction', async () => {
  const band = fakeBand('nayaka', () => ({ ok: true, owner: 'nayaka', location: { valid: true }, peerLocation: { valid: true }, guidance: { available: true, usable: true, bearing: 90 } }));
  const client = createPhoneBluetooth(band.api);
  await client.connect('nayaka');
  assert.equal(client.getState().band.guidance.bearing, 90);
  band.notify(`${JSON.stringify({ type: 'status', owner: 'nayaka', location: { valid: false }, peerLocation: { valid: true }, directionArrowVisible: false })}\n`);
  assert.equal(client.getState().band.guidance, undefined);
  client.disconnect();
});

test('custom band message and dismissal notifications update the phone immediately', async () => {
  const band = fakeBand();
  const client = createPhoneBluetooth(band.api);
  await client.connect('nayaka');
  band.notify(`${JSON.stringify({ type: 'message', owner: 'nayaka', from: 'syifa', text: 'Meet at gate two', sequence: 42 })}\n`);
  assert.equal(client.getState().band.incoming, 'Meet at gate two');
  assert.equal(client.getState().band.unread, true);
  assert.equal(client.getState().band.view, 'incoming');
  assert.equal(client.getState().band.incomingSequence, 42);
  band.notify(`${JSON.stringify({ type: 'dismissed', owner: 'nayaka', incoming: '', unread: false, view: 'home' })}\n`);
  assert.equal(client.getState().band.unread, false);
  assert.equal(client.getState().band.incoming, '');
  client.disconnect();
});

test('invalid owner, sender or text cannot become an incoming band popup', async () => {
  const band = fakeBand();
  const client = createPhoneBluetooth(band.api);
  await client.connect('nayaka');
  for (const message of [
    { owner: 'syifa', from: 'nayaka', text: 'Other band' },
    { owner: 'nayaka', from: 'nayaka', text: 'Self' },
    { owner: 'nayaka', from: 'amy', text: 'Unpaired band' },
    { owner: 'nayaka', from: 'syifa', text: 'x'.repeat(41) },
  ]) band.notify(`${JSON.stringify({ type: 'message', sequence: 42, ...message })}\n`);
  assert.equal(client.getState().band.incoming, undefined);
  client.disconnect();
});

test('concurrent presets and phone location writes remain separate complete JSON frames', async () => {
  const band = fakeBand();
  const client = createPhoneBluetooth(band.api);
  await client.connect('nayaka');
  const fix = { lat: -27.47, lon: 153.03, accuracy: 10, timestamp: Date.now(), simulated: false };
  await Promise.all([client.syncPresets('nayaka', [{ id: 'meet', text: 'Meet at the entrance' }]), client.shareLocation('nayaka', fix)]);
  await client.clearLocation('nayaka');
  assert.deepEqual(band.frames.map(frame => frame.cmd), ['hello', 'presets', 'location', 'clear_location']);
  assert.equal(band.frames[2].simulated, false);
  assert.equal(band.frames[2].timestamp, fix.timestamp);
  assert.equal(new Set(band.frames.map(frame => frame.id)).size, 4);
  client.disconnect();
});

test('old location callbacks cannot refresh the physical band location lifetime', async () => {
  const now = Date.now();
  const band = fakeBand();
  const client = createPhoneBluetooth(band.api, { now: () => now });
  await client.connect('nayaka');
  for (const timestamp of [now - 60000, now + 5001, now + 0.5]) {
    await assert.rejects(client.shareLocation('nayaka', { lat: 0, lon: 0, accuracy: 5, timestamp, simulated: false }), /fresh phone location/);
  }
  assert.equal(band.frames.length, 1);
  client.disconnect();
});

test('only correlated positive replies count as band acknowledgements', async () => {
  const band = fakeBand('nayaka', packet => packet.cmd === 'hello' ? { ok: true, owner: 'nayaka' } : null);
  const client = createPhoneBluetooth(band.api);
  await client.connect('nayaka');
  const pending = client.syncPresets('nayaka', []);
  await new Promise(resolve => setTimeout(resolve, 1));
  band.notify('malformed\n{"id":"stray","ok":true}\n');
  band.notify(`${JSON.stringify({ type: 'status', id: band.frames[1].id, owner: 'nayaka', ok: true, peer: { connected: true } })}\n`);
  band.notify(`${JSON.stringify({ id: band.frames[1].id, ok: false, error: 'Preset storage failed' })}\n`);
  await assert.rejects(pending, /Preset storage failed/);
  client.disconnect();
});

test('missing firmware acknowledgement is explicitly unconfirmed', async () => {
  const band = fakeBand('nayaka', packet => packet.cmd === 'hello' ? { ok: true, owner: 'nayaka' } : null);
  const client = createPhoneBluetooth(band.api, { timeoutMs: 5 });
  await client.connect('nayaka');
  await assert.rejects(client.syncPresets('nayaka', []), /Delivery is unconfirmed/);
  client.disconnect();
});

test('a delayed acknowledgement from a previous page cannot confirm a new preset sync', async () => {
  const band = fakeBand('nayaka', packet => packet.cmd === 'hello' ? { ok: true, owner: 'nayaka' } : null);
  const firstPage = createPhoneBluetooth(band.api);
  await firstPage.connect('nayaka');
  const oldSync = firstPage.syncPresets('nayaka', [{ id: 'old', text: 'Old message' }]);
  const oldRejected = assert.rejects(oldSync, /unconfirmed/);
  await new Promise(resolve => setTimeout(resolve, 1));
  const oldRequest = band.frames.at(-1);
  firstPage.disconnect();
  await oldRejected;

  const newPage = createPhoneBluetooth(band.api);
  await newPage.connect('nayaka');
  const newSync = newPage.syncPresets('nayaka', [{ id: 'new', text: 'New message' }]);
  let settled = false;
  newSync.then(() => { settled = true; }, () => { settled = true; });
  await new Promise(resolve => setTimeout(resolve, 1));
  const newRequest = band.frames.at(-1);
  band.notify(`${JSON.stringify({ id: oldRequest.id, owner: 'nayaka', ok: true })}\n`);
  await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(settled, false, 'The older page acknowledgement must leave the current write unconfirmed');
  band.notify(`${JSON.stringify({ id: newRequest.id, owner: 'nayaka', ok: true })}\n`);
  assert.equal((await newSync).ok, true);
  newPage.disconnect();
});

test('disconnect rejects an in-flight configuration and clears its owner', async () => {
  const band = fakeBand('nayaka', packet => packet.cmd === 'hello' ? { ok: true, owner: 'nayaka' } : null);
  const client = createPhoneBluetooth(band.api);
  await client.connect('nayaka');
  const pending = client.syncPresets('nayaka', []);
  client.disconnect();
  await assert.rejects(pending, /unconfirmed/);
  assert.equal(client.getState().owner, null);
  assert.equal(client.getState().status, 'disconnected');
});

test('unsupported browsers expose a usable explanation', () => {
  const client = createPhoneBluetooth(null);
  assert.equal(client.getState().status, 'unsupported');
  assert.match(client.getState().message, /iPhone/);
});
