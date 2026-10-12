const { normalizeBridgeUrl, validOwner, validatePresets, validatedBandPresets } = require('./presets');

function createBandBridge(input, options = {}) {
  const base = normalizeBridgeUrl(input);
  const transport = options.fetch || globalThis.fetch;
  async function request(path, body) {
    if (!transport) throw new Error('This browser cannot connect to the USB bridge.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || 10000);
    try {
      const response = await transport(`${base}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('The bridge returned an unreadable response. Check the bridge address.'); }
      if (!response.ok || body !== undefined && data?.ok !== true) throw new Error(typeof data?.error === 'string' ? data.error : 'The band did not acknowledge this request.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The bridge or band did not reply in time. Delivery is unconfirmed; try again.');
      if (error instanceof TypeError) throw new Error('Cannot reach the USB bridge. Check its address and that it is running on the computer with the bands.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  const ownerPath = owner => {
    if (!validOwner(owner)) throw new Error('Choose Nayaka or Syifa.');
    return `/api/bands/${owner}`;
  };
  return {
    async status() {
      const data = await request('/api/bands');
      if (!Array.isArray(data?.bands)) throw new Error('The bridge did not return its connected bands.');
      return data;
    },
    async syncPresets(owner, messages) {
      const path = ownerPath(owner);
      const checked = validatePresets(messages);
      if (!checked.ok) throw new Error(checked.error);
      return request(`${path}/presets`, { messages: checked.messages });
    },
    async readPresets(owner) {
      // A fresh firmware RPC is acknowledged; GET status only polls cached bridge state.
      const response = await request(`${ownerPath(owner)}/status`, {});
      return validatedBandPresets(owner, response);
    },
    async shareLocation(owner, location) {
      const path = ownerPath(owner);
      if (!location || !Number.isFinite(location.lat) || Math.abs(location.lat) > 90 || !Number.isFinite(location.lon) || Math.abs(location.lon) > 180 || !Number.isFinite(location.accuracy) || location.accuracy < 0 || !Number.isFinite(location.timestamp) || location.timestamp <= 0 || location.simulated !== false) throw new Error('A valid phone location is required.');
      return request(`${path}/location`, location);
    },
    async clearLocation(owner) { return request(`${ownerPath(owner)}/clear-location`, {}); },
  };
}
module.exports = { createBandBridge };
