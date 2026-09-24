const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultDeviceName, readDeviceName, saveDeviceName } = require('../utils/deviceNames');
test('noticeable default device name uses wearer identity', () => {
  assert.equal(defaultDeviceName('nayaka'), "Nayaka’s laptop");
  assert.equal(defaultDeviceName('nala'), "Nala’s laptop");
});
test('nicknames persist per device without renaming other devices', () => {
  const values = new Map(); const storage = { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v) };
  assert.equal(saveDeviceName('ble:123', '  Nala’s purple band  ', storage), true);
  assert.equal(readDeviceName('ble:123', 'Unknown BLE device', storage), 'Nala’s purple band');
  assert.equal(readDeviceName('ble:456', 'Other band', storage), 'Other band');
  assert.equal(saveDeviceName('ble:123', ' ', storage), false);
  assert.equal(saveDeviceName('ble:123', 'x'.repeat(41), storage), false);
});
test('restricted storage preserves a usable default', () => {
  const storage = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  assert.equal(readDeviceName('browser:nala', 'Nala', storage), 'Nala');
  assert.equal(saveDeviceName('browser:nala', 'Nala laptop', storage), false);
});
