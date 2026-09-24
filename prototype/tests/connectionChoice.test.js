const test = require('node:test');
const assert = require('node:assert/strict');
const { connectPhysicalBand, CONNECTION_HELP } = require('../utils/connectionChoice');
test('browser friend selection never starts a Bluetooth chooser', () => {
  let calls = 0;
  const service = { connect() { calls++; } };
  for (const choice of [undefined, 'browser', 'nayaka', 'nala']) {
    assert.equal(connectPhysicalBand(service, choice), false);
  }
  assert.equal(calls, 0);
});
test('only explicit compatible hardware selection permits discovery', () => {
  let calls = 0;
  assert.equal(connectPhysicalBand({ connect() { calls++; } }, 'physical'), true);
  assert.equal(calls, 1);
});
test('connection guidance explains why laptops and identities are not BLE devices', () => {
  assert.match(CONNECTION_HELP, /laptops/i);
  assert.match(CONNECTION_HELP, /cannot/i);
  assert.match(CONNECTION_HELP, /identity/i);
});
