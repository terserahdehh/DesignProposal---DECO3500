// Central/client only. Requires a physical peripheral implementing this protocol.
const SERVICE = 'b97b0001-7a62-4f1a-9b9c-0b13e9de3500';
const CHARACTERISTIC = 'b97b0002-7a62-4f1a-9b9c-0b13e9de3500';
const SIGNALS = { safe: 1, toilet: 2, break: 3, home: 4, meet: 5, sos: 6 };
function createBluetoothService(api = globalThis.navigator?.bluetooth) {
  let state = { status: api?.requestDevice ? 'idle' : 'unsupported', message: api?.requestDevice ? 'Ready to connect a physical band.' : 'Bluetooth unavailable here. Try Chrome on Android or a supported desktop browser.', deviceName: null, incoming: null };
  let device, characteristic, generation = 0, busy = false;
  const listeners = new Set();
  const update = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn(state)); };
  const received = event => {
    const value = event.target.value;
    if (value?.byteLength !== 1) return;
    const signal = Object.keys(SIGNALS).find(key => SIGNALS[key] === value.getUint8(0));
    if (signal) update({ incoming: signal });
  };
  function cleanup() {
    characteristic?.removeEventListener('characteristicvaluechanged', received);
    device?.removeEventListener('gattserverdisconnected', disconnected);
    try { if (device?.gatt?.connected) device.gatt.disconnect(); } catch (_) { /* Already lost. */ }
    characteristic = null; device = null;
  }
  function disconnected() {
    generation++; cleanup();
    update({ status: 'disconnected', message: 'Band disconnected. Press Connect Bluetooth to reconnect.', incoming: null });
  }
  return {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async connect() {
      if (!api?.requestDevice || state.status === 'connecting' || state.status === 'connected') return;
      const attempt = ++generation;
      cleanup();
      update({ status: 'connecting', message: 'Choose a compatible PulseBand device.', deviceName: null, incoming: null });
      try {
        // Do not await anything before requestDevice: preserve the click activation.
        const chosen = await api.requestDevice({ filters: [{ services: [SERVICE] }] });
        if (attempt !== generation) return;
        device = chosen;
        device.addEventListener('gattserverdisconnected', disconnected);
        const server = await chosen.gatt.connect();
        if (attempt !== generation) { if (chosen.gatt.connected) chosen.gatt.disconnect(); return; }
        const service = await server.getPrimaryService(SERVICE);
        const channel = await service.getCharacteristic(CHARACTERISTIC);
        if (attempt !== generation) return;
        if (!channel.properties.write || !channel.properties.notify) throw new Error('protocol');
        characteristic = channel;
        characteristic.addEventListener('characteristicvaluechanged', received);
        await characteristic.startNotifications();
        if (attempt !== generation) return;
        update({ status: 'connected', deviceName: chosen.name || 'PulseBand', message: 'Physical band connected. Signals use real Bluetooth.' });
      } catch (error) {
        if (attempt !== generation) return;
        cleanup();
        const message = ['NotAllowedError', 'SecurityError'].includes(error.name) ? 'Bluetooth permission was denied or blocked. You can try again.' : error.name === 'NotFoundError' ? 'No band selected. Turn on a compatible band and try again.' : 'Could not connect to a compatible band. Check power and retry.';
        update({ status: 'error', message });
      }
    },
    disconnect() { generation++; cleanup(); update({ status: 'disconnected', message: 'Bluetooth disconnected.', incoming: null }); },
    async send(signal) {
      if (state.status !== 'connected' || !characteristic || busy || !SIGNALS[signal]) return false;
      const attempt = generation; busy = true;
      try {
        await characteristic.writeValueWithResponse(Uint8Array.of(SIGNALS[signal]));
        if (attempt !== generation) return false;
        update({ message: 'Signal written to physical band. Recipient delivery is not confirmed.' });
        return true;
      } catch (_) {
        if (attempt === generation) update({ message: 'Signal could not be sent. Check the connection and retry.' });
        return false;
      } finally { busy = false; }
    },
  };
}
module.exports = { createBluetoothService, SERVICE, CHARACTERISTIC, SIGNALS };
