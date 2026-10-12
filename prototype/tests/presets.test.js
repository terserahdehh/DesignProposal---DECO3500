const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_MESSAGES, messageError, validatePresets, readPresets, savePresets, newMessageId, normalizeBridgeUrl, readBridgeUrl, saveBridgeUrl } = require('../utils/presets');

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
}

test('presets persist across visits independently for both band owners', () => {
  const storage = memoryStorage();
  const nayaka = [{ id: 'main_entrance', text: ' Meet me at the main entrance ' }];
  const syifa = [{ id: 'food', text: 'At the food stalls' }];
  assert.equal(savePresets('nayaka', nayaka, storage).ok, true);
  assert.equal(savePresets('syifa', syifa, storage).ok, true);
  assert.deepEqual(readPresets('nayaka', storage), [{ id: 'main_entrance', text: 'Meet me at the main entrance' }]);
  assert.deepEqual(readPresets('syifa', storage), syifa);
  assert.equal(savePresets('nayaka', [], storage).ok, true);
  assert.deepEqual(readPresets('nayaka', storage), []);
  assert.deepEqual(readPresets('syifa', storage), syifa);
});

test('importing stored band messages preserves their exact text across browser reloads', () => {
  const storage = memoryStorage();
  const messages = [{ id: 'gate', text: ' Meet at gate two ' }];
  assert.deepEqual(savePresets('nayaka', messages, storage, { preserveStoredText: true }), { ok: true, messages });
  assert.deepEqual(readPresets('nayaka', storage), messages);
  assert.equal(savePresets('nayaka', [{ id: 'oversize', text: ` ${'x'.repeat(40)} ` }], storage, { preserveStoredText: true }).ok, false);
  assert.deepEqual(readPresets('nayaka', storage), messages);
});

test('malformed storage recovers built-in messages without sharing mutable defaults', () => {
  const storage = memoryStorage();
  storage.setItem('pulseband.presets.v1.nayaka', '{oops');
  assert.deepEqual(readPresets('nayaka', storage), DEFAULT_MESSAGES);
  storage.setItem('pulseband.presets.v1.nayaka', JSON.stringify([{ id: 'bad', text: '🎉' }]));
  const defaults = readPresets('nayaka', storage);
  defaults[0].text = 'Changed';
  assert.deepEqual(readPresets('nayaka', storage), DEFAULT_MESSAGES);
});

test('failed writes report that changes are temporary and do not erase saved messages', () => {
  const storage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.deepEqual(readPresets('nayaka', storage), DEFAULT_MESSAGES);
  assert.match(savePresets('nayaka', DEFAULT_MESSAGES, storage).error, /visit only/);
  assert.equal(savePresets('amy', DEFAULT_MESSAGES, memoryStorage()).ok, false);
});

test('firmware limits reject unsupported text, duplicate IDs and oversized lists', () => {
  assert.equal(messageError('x'.repeat(40)), null);
  for (const text of ['', '   ', 'x'.repeat(41), 'Meet 🎉', 'Toilet\nnow', 'Mötley', 'Bell\x7f']) assert.equal(typeof messageError(text), 'string');
  assert.equal(validatePresets(Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, text: 'Ready' }))).ok, true);
  assert.equal(validatePresets(Array.from({ length: 9 }, (_, i) => ({ id: `m${i}`, text: 'Ready' }))).ok, false);
  assert.equal(validatePresets([{ id: 'same', text: 'First' }, { id: 'same', text: 'Second' }]).ok, false);
  assert.equal(validatePresets([{ id: '../owner', text: 'Ready' }]).ok, false);
  assert.equal(validatePresets([{ id: 'x'.repeat(33), text: 'Ready' }]).ok, false);
  assert.equal(validatePresets([{ id: 1, text: 'Ready' }]).ok, false);
  assert.match(newMessageId(), /^[A-Za-z0-9_-]{1,32}$/);
});

test('invalid writes preserve the previous persistent list', () => {
  const storage = memoryStorage();
  savePresets('syifa', [{ id: 'safe', text: "I'm Safe" }], storage);
  assert.equal(savePresets('syifa', [{ id: 'bad', text: 'Too long '.repeat(8) }], storage).ok, false);
  assert.deepEqual(readPresets('syifa', storage), [{ id: 'safe', text: "I'm Safe" }]);
});

test('bridge address persists and rejects invalid URL protocols and credentials', () => {
  const storage = memoryStorage();
  assert.equal(readBridgeUrl(storage), 'http://localhost:8787');
  assert.equal(saveBridgeUrl(' http://192.168.1.5:8787/ ', storage).ok, true);
  assert.equal(readBridgeUrl(storage), 'http://192.168.1.5:8787');
  for (const input of ['javascript:alert(1)', '/bridge', 'http://user:pass@localhost:8787', 'http://localhost:8787/?key=secret', 'http://localhost:8787/#fragment']) assert.throws(() => normalizeBridgeUrl(input));
  assert.equal(saveBridgeUrl('https://example.com/bridge', null).url, 'https://example.com/bridge');
  assert.equal(saveBridgeUrl('https://example.com/bridge', null).ok, false);
});
