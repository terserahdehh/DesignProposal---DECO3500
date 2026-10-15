const { LOCATION_TTL_MS } = require('./locationFix');
const { imageError, copyImage } = require('./presetImage');

function initialTransportMode(location) {
  return location?.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname) ? 'bluetooth' : 'usb';
}

function describeBandStatus(band, owner, connected, observedAt, now = Date.now()) {
  const empty = { mode: 'offline', title: 'Connect your band to see live status.', detail: '', peerConnected: false, incoming: null };
  if (!connected || band?.owner !== owner || !Number.isFinite(observedAt) || now - observedAt >= 9000) return empty;
  const peer = owner === 'nayaka' ? 'syifa' : 'nayaka';
  const state = { ...empty, mode: 'waiting', title: 'Waiting for fresh locations from both wearers.',
    detail: 'Share each wearer’s location from their own phone. A laptop reports the laptop’s position.', peerConnected: band.peerConnected === true };
  if (band.unread === true && typeof band.incoming === 'string' && /^[\x20-\x7e]{1,40}$/.test(band.incoming))
    state.incoming = { from: peer, text: band.incoming, key: `${owner}:${band.incomingSequence || 0}:${band.incoming}`,
      ...(band.incomingImage && !imageError(band.incomingImage) ? { image: copyImage(band.incomingImage) } : {}) };
  const fresh = fix => fix?.valid === true && Number.isFinite(fix.timestamp) && fix.timestamp > 0 && now - fix.timestamp < LOCATION_TTL_MS && fix.timestamp - now <= 5000;
  const name = id => id === 'nayaka' ? 'Nayaka' : 'Syifa';
  if (!state.peerConnected) return { ...state, detail: `${name(peer)}’s paired band is offline. Power on both bands and bring them within radio range.` };
  if (!fresh(band.location) || !fresh(band.peerLocation)) {
    const missing = [!fresh(band.location) && name(owner), !fresh(band.peerLocation) && name(peer)].filter(Boolean).join(' and ');
    return { ...state, detail: `${missing} needs a fresh location. On each missing wearer’s device, connect their matching band and press Keep location updated. Keep the pages visible and allow location access.` };
  }
  const guidance = band.guidance;
  if (guidance?.available !== true || !Number.isFinite(guidance.metres) || guidance.metres < 0) return state;
  if (guidance.usable !== true) return { ...state, mode: 'uncertain', title: 'Location is too uncertain for a direction.',
    detail: `Actual distance is unknown.${Number.isFinite(guidance.accuracy) ? ` Combined reported accuracy: ±${Math.round(guidance.accuracy)} m.` : ''} The accuracy ranges overlap or the bearing is ambiguous, so no safe arrow is shown. These devices could be side by side; laptop location cannot measure centimetre movements. Each wearer can use their own phone outdoors for a better fix.` };
  if (!Number.isFinite(guidance.bearing) || guidance.bearing < 0 || guidance.bearing >= 360 ||
      !Number.isFinite(guidance.bearingUncertaintyDegrees) || guidance.bearingUncertaintyDegrees < 0 || guidance.bearingUncertaintyDegrees > 90 ||
      guidance.northReferenced !== true) return state;
  const simulated = guidance.simulated || band.location.simulated || band.peerLocation.simulated;
  return { ...state, mode: 'ready', title: `Direction to ${peer === 'syifa' ? 'Syifa' : 'Nayaka'}`,
    detail: `${Math.round(guidance.metres)} m · ${Math.round(guidance.bearing)}° clockwise from north · bearing ±${guidance.bearingUncertaintyDegrees.toFixed(1)}°${simulated ? ' · SIMULATED LOCATION' : ''}` };
}

module.exports = { initialTransportMode, describeBandStatus };
