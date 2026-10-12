// Configuring a real band directly from supported secure-context browsers.
const { SERVICE } = require('./bluetooth');
const { validOwner, validatePresets, validatedBandPresets } = require('./presets');
const { validateLocationFix } = require('./locationFix');
const CONFIG_CHARACTERISTIC = 'b97b0003-7a62-4f1a-9b9c-0b13e9de3500';

function createPhoneBluetooth(api = globalThis.navigator?.bluetooth, options = {}) {
  // A fresh page must not accept a delayed acknowledgement from an older one.
  const requestSession = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const listeners = new Set();
  const pending = new Map();
  let device, channel, generation = 0, sequence = 0, incoming = '', writes = Promise.resolve();
  let state = { status: api?.requestDevice ? 'idle' : 'unsupported', owner: null, deviceName: null, band: null, message: api?.requestDevice ? 'Connect your band to prepare messages and share phone location.' : 'Direct Bluetooth needs Chrome on Android or a supported desktop browser. iPhone browsers do not support Web Bluetooth.' };
  const update = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener(state)); };

  function rejectPending(message) {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error(message)); }
    pending.clear();
  }
  function cleanup(message = 'Bluetooth connection closed. Delivery is unconfirmed.') {
    rejectPending(message);
    channel?.removeEventListener('characteristicvaluechanged', received);
    device?.removeEventListener('gattserverdisconnected', disconnected);
    try { if (device?.gatt?.connected) device.gatt.disconnect(); } catch (_) { /* Connection already closed. */ }
    channel = null; device = null; incoming = ''; writes = Promise.resolve();
  }
  function disconnected() {
    generation++; cleanup();
    update({ status: 'disconnected', owner: null, band: null, message: 'Band disconnected. Connect again to send updates.' });
  }
  function mergeBand(response) {
    const next = { ...state.band, ...(response.band || response) };
    const source = response.band || response;
    // Firmware omits guidance once a fix expires. A partial event must not
    // keep a bearing from an older complete status response.
    if (('location' in source || 'peerLocation' in source) && !('guidance' in source)) delete next.guidance;
    if (source.location?.valid === false || source.peerLocation?.valid === false) delete next.guidance;
    return next;
  }
  function received(event) {
    const value = event.target?.value;
    if (!value?.buffer || !value.byteLength) return;
    incoming += new TextDecoder().decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    if (incoming.length > 16384) { incoming = ''; rejectPending('The band response was too large. Reconnect and try again.'); return; }
    let newline;
    while ((newline = incoming.indexOf('\n')) >= 0) {
      const line = incoming.slice(0, newline).trim();
      incoming = incoming.slice(newline + 1);
      if (!line) continue;
      let response;
      try { response = JSON.parse(line); } catch (_) { continue; }
      if (response?.type === 'status') {
        // Unsolicited status updates are useful only after firmware ownership is verified.
        if (state.status === 'connected' && response.owner === state.owner && (response.band?.owner === undefined || response.band.owner === state.owner)) update({ band: mergeBand(response) });
        continue;
      }
      if (['message', 'sent', 'send_failed', 'dismissed'].includes(response?.type)) {
        if (state.status !== 'connected' || response.owner !== state.owner) continue;
        if (response.type === 'message') {
          const peer = state.owner === 'nayaka' ? 'syifa' : 'nayaka';
          if (response.from !== peer || typeof response.text !== 'string' || !/^[\x20-\x7e]{1,40}$/.test(response.text) || !Number.isSafeInteger(response.sequence) || response.sequence <= 0) continue;
          update({ band: { ...state.band, incoming: response.text, unread: true, view: 'incoming', incomingSequence: response.sequence } });
        } else if (response.type === 'dismissed') {
          update({ band: { ...state.band, incoming: '', unread: false, view: response.view || 'home' } });
        } else {
          update({ band: { ...state.band, result: response.type === 'sent' ? 'Received by band' : 'Delivery unconfirmed' } });
        }
        continue;
      }
      const request = pending.get(response?.id);
      if (!request) continue;
      pending.delete(response.id); clearTimeout(request.timer);
      if (response.ok !== true) request.reject(new Error(typeof response.error === 'string' ? response.error : 'The band did not acknowledge this request.'));
      else if (state.owner && [response.owner, response.band?.owner].some(owner => owner !== undefined && owner !== state.owner)) request.reject(new Error('The reply came from a different band owner. Reconnect your band.'));
      else { update({ band: response.owner || response.band?.owner ? mergeBand(response) : state.band }); request.resolve(response); }
    }
  }

  function rpc(cmd, body = {}, handshake = false) {
    if (!channel || !device?.gatt?.connected || !handshake && state.status !== 'connected') return Promise.reject(new Error('Connect the selected wearer’s band first.'));
    const attempt = generation;
    const target = channel;
    const id = `p-${requestSession}-${++sequence}`;
    const packet = { id, cmd, ...(state.owner ? { owner: state.owner } : {}), ...body };
    const bytes = new TextEncoder().encode(`${JSON.stringify(packet)}\n`);
    const result = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, timer: setTimeout(() => { pending.delete(id); reject(new Error('The band did not acknowledge in time. Delivery is unconfirmed; try again.')); }, options.timeoutMs || 10000) });
    });
    const transmit = async () => {
      if (cmd === 'location') validateLocationFix(body, (options.now || Date.now)());
      for (let offset = 0; offset < bytes.length; offset += 20) {
        if (attempt !== generation) throw new Error('Bluetooth disconnected. Delivery is unconfirmed.');
        await target.writeValueWithResponse(bytes.slice(offset, offset + 20));
      }
    };
    writes = writes.then(transmit, transmit).catch(error => {
      const request = pending.get(id);
      if (request) { pending.delete(id); clearTimeout(request.timer); request.reject(new Error(error.message || 'Bluetooth write failed. Delivery is unconfirmed.')); }
    });
    return result;
  }

  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async connect(owner) {
      if (!validOwner(owner)) throw new Error('Choose Nayaka or Syifa.');
      if (!api?.requestDevice || ['connecting', 'connected'].includes(state.status)) return false;
      const attempt = ++generation;
      cleanup();
      update({ status: 'connecting', owner: null, band: null, deviceName: null, message: `Choose ${owner === 'nayaka' ? 'Nayaka' : 'Syifa'}’s PulseBand. Its firmware identity will be checked.` });
      try {
        // requestDevice must run inside the original button gesture.
        const chosen = await api.requestDevice({ filters: [{ namePrefix: 'PulseBand' }, { services: [SERVICE] }], optionalServices: [SERVICE] });
        if (attempt !== generation) return false;
        device = chosen;
        device.addEventListener('gattserverdisconnected', disconnected);
        const server = await chosen.gatt.connect();
        if (attempt !== generation) { chosen.gatt.disconnect(); return false; }
        const service = await server.getPrimaryService(SERVICE);
        const config = await service.getCharacteristic(CONFIG_CHARACTERISTIC);
        if (attempt !== generation) return false;
        if (!config.properties.write || !config.properties.notify) throw new Error('Install the updated PulseBand firmware with Bluetooth configuration support.');
        channel = config;
        config.addEventListener('characteristicvaluechanged', received);
        await config.startNotifications();
        if (attempt !== generation) return false;
        const hello = await rpc('hello', {}, true);
        if (attempt !== generation) return false;
        const detectedOwner = hello.owner || hello.band?.owner;
        if (detectedOwner !== owner) throw new Error(`This is ${detectedOwner === 'nayaka' ? 'Nayaka' : detectedOwner === 'syifa' ? 'Syifa' : 'an unassigned band'}’s band. Choose ${owner === 'nayaka' ? 'Nayaka' : 'Syifa'}’s band instead.`);
        update({ status: 'connected', owner, band: hello.band || hello, deviceName: chosen.name || 'PulseBand', message: `Connected to ${owner === 'nayaka' ? 'Nayaka' : 'Syifa'}’s physical band. Firmware identity verified.` });
        return true;
      } catch (error) {
        if (attempt !== generation) return false;
        cleanup();
        const message = error.name === 'NotFoundError' ? 'No compatible band was selected. Turn on your band with updated firmware and try again.' : ['SecurityError', 'NotAllowedError'].includes(error.name) ? 'Bluetooth access was denied or blocked. Use HTTPS in a supported browser and allow access.' : error.message || 'Could not connect to the band.';
        update({ status: 'error', owner: null, band: null, message }); return false;
      }
    },
    disconnect() { generation++; cleanup(); update({ status: 'disconnected', owner: null, band: null, message: 'Bluetooth disconnected.' }); },
    async syncPresets(owner, messages) {
      if (owner !== state.owner) throw new Error('Connect the selected wearer’s band first.');
      const checked = validatePresets(messages);
      if (!checked.ok) throw new Error(checked.error);
      return rpc('presets', { messages: checked.messages });
    },
    async readPresets(owner) {
      if (owner !== state.owner) throw new Error('Connect the selected wearer’s band first.');
      return validatedBandPresets(owner, await rpc('status'));
    },
    async shareLocation(owner, location) {
      if (owner !== state.owner) throw new Error('Connect the selected wearer’s band first.');
      validateLocationFix(location, (options.now || Date.now)());
      return rpc('location', location);
    },
    async clearLocation(owner) {
      if (owner !== state.owner) throw new Error('Connect the selected wearer’s band first.');
      return rpc('clear_location');
    },
  };
}

module.exports = { createPhoneBluetooth, CONFIG_CHARACTERISTIC };
