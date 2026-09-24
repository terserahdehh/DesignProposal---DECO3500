const test = require('node:test');
const assert = require('node:assert/strict');
const { createBluetoothService, SIGNALS } = require('../utils/bluetooth');
function fixture(error) {
  const device = new EventTarget(); device.name = 'Test band';
  const characteristic = new EventTarget();
  characteristic.properties = { write: true, notify: true };
  characteristic.startNotifications = async () => characteristic;
  characteristic.writeValueWithResponse = async bytes => { characteristic.sent = [...bytes]; };
  device.gatt = { connected: false, connect: async () => { if (error) throw error; device.gatt.connected = true; return { getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }) }; }, disconnect: () => { device.gatt.connected = false; device.dispatchEvent(new Event('gattserverdisconnected')); } };
  const api = { requestDevice: async () => device };
  return { device, characteristic, service: createBluetoothService(api) };
}
test('unsupported browser stays usable', async () => {
  const service = createBluetoothService(null);
  assert.equal(service.getState().status, 'unsupported');
  await service.connect(); assert.equal(service.getState().status, 'unsupported');
});
test('connection, compact writes, notifications and remote disconnect', async () => {
  const { service, device, characteristic } = fixture();
  await service.connect(); assert.equal(service.getState().status, 'connected');
  for (const signal of Object.keys(SIGNALS)) {
    assert.equal(await service.send(signal), true);
    assert.deepEqual(characteristic.sent, [SIGNALS[signal]]);
  }
  characteristic.value = new DataView(Uint8Array.of(SIGNALS.safe).buffer);
  characteristic.dispatchEvent(new Event('characteristicvaluechanged'));
  assert.equal(service.getState().incoming, 'safe');
  device.gatt.disconnect(); assert.equal(service.getState().status, 'disconnected');
  assert.equal(await service.send('safe'), false);
});
for (const name of ['NotAllowedError', 'NotFoundError', 'SecurityError', 'NetworkError']) {
  test(`handles ${name}`, async () => {
    const { service } = fixture(Object.assign(new Error(), { name }));
    await service.connect(); assert.equal(service.getState().status, 'error');
    assert.ok(service.getState().message);
  });
}
test('chooser rejection and manual disconnect never throw', async () => {
  const service = createBluetoothService({ requestDevice: async () => { throw { name: 'NotAllowedError' }; } });
  await service.connect(); assert.equal(service.getState().status, 'error');
  service.disconnect();
  const f = fixture(); await f.service.connect(); f.service.disconnect();
  assert.equal(f.service.getState().status, 'disconnected');
});
test('simulated movement and reset cannot change hardware state', async () => {
  const { createInitialState, simulationReducer } = require('../utils/simulation');
  const { service } = fixture(); await service.connect();
  const before = service.getState();
  let state = simulationReducer(createInitialState(), { type: 'MOVE_DIRECTION' });
  state = simulationReducer(state, { type: 'RESET' });
  assert.deepEqual(service.getState(), before);
  assert.equal(state.direction, 0); assert.equal('direction' in before, false);
  assert.equal('distance' in before, false);
});
test('late connection after cancellation closes the peripheral', async () => {
  const { service, device } = fixture();
  let finish;
  device.gatt.connect = () => new Promise(resolve => { finish = () => { device.gatt.connected = true; resolve({}); }; });
  const pending = service.connect();
  await Promise.resolve();
  service.disconnect(); finish(); await pending;
  assert.equal(device.gatt.connected, false);
  assert.equal(service.getState().status, 'disconnected');
});
test('malformed notifications ignored and failed writes reported without delivery', async () => {
  const { service, characteristic } = fixture(); await service.connect();
  characteristic.value = new DataView(Uint8Array.of(255).buffer);
  characteristic.dispatchEvent(new Event('characteristicvaluechanged'));
  assert.equal(service.getState().incoming, null);
  characteristic.writeValueWithResponse = async () => { throw Error(); };
  assert.equal(await service.send('safe'), false);
  assert.match(service.getState().message, /could not be sent/);
});
test('discovery includes BLE peripherals even without advertised PulseBand UUID', async () => {
  const { device } = fixture(); let options;
  const service = createBluetoothService({ requestDevice: async value => { options = value; return device; } });
  await service.connect({ allDevices: true });
  assert.equal(options.acceptAllDevices, true);
  assert.ok(options.optionalServices.includes(require('../utils/bluetooth').SERVICE));
  assert.equal(service.getState().canSignal, true);
});
test('device lacking PulseBand service stays connected but cannot send signals', async () => {
  const { device, service } = fixture();
  device.gatt.connect = async () => { device.gatt.connected = true; return { getPrimaryService: async () => { throw Object.assign(Error(), { name: 'NotFoundError' }); } }; };
  await service.connect();
  assert.equal(service.getState().status, 'connected');
  assert.equal(service.getState().canSignal, false);
  assert.match(service.getState().message, /firmware/i);
  assert.equal(await service.send('sos'), false);
  device.gatt.disconnect(); assert.equal(service.getState().status, 'disconnected');
});
test('wrong characteristic properties do not enable signals', async () => {
  const { service, characteristic } = fixture(); characteristic.properties.write = false;
  await service.connect();
  assert.equal(service.getState().status, 'connected');
  assert.equal(service.getState().canSignal, false);
  assert.equal(await service.send('safe'), false);
});

test('default discovery filters clutter by PulseBand name or service', async () => {
  const { device } = fixture(); device.id = 'stable-device'; let options;
  const service = createBluetoothService({ requestDevice: async value => { options = value; return device; } });
  await service.connect();
  assert.ok(options.filters.some(filter => filter.namePrefix === 'PulseBand'));
  assert.ok(options.filters.some(filter => filter.services?.includes(require('../utils/bluetooth').SERVICE)));
  assert.equal(service.getState().deviceId, 'stable-device');
  assert.equal(service.getState().deviceName, 'Test band');
});
