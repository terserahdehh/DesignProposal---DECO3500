const { LOCATION_TTL_MS } = require('./locationFix');
const { describeProximity } = require('./proximity');

const WALK_HINTS = {
  walk: 'Walk a few metres, then turn, so the band can estimate the direction.',
  turn: 'Now turn and keep walking: a straight walk cannot tell left from right.',
  inconsistent: 'The distances stopped fitting one spot, so your friend may have moved. Keep walking.',
  near: 'Your friend is very close: look around.',
  uncertain: 'Keep walking to narrow the direction.',
  'no-imu': 'The motion sensor is unavailable, so no direction can be estimated.',
};

function initialTransportMode(location) {
  return location?.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname) ? 'bluetooth' : 'usb';
}

function describeBandStatus(band, owner, connected, observedAt, now = Date.now()) {
  const empty = { mode: 'offline', title: 'Connect your band to see live status.', detail: '', peerConnected: false, incoming: null, proximity: describeProximity(null) };
  if (!connected || band?.owner !== owner || !Number.isFinite(observedAt) || now - observedAt >= 9000) return empty;
  const peer = owner === 'nayaka' ? 'syifa' : 'nayaka';
  const proximity = describeProximity(band, observedAt, now);
  const state = { ...empty, mode: 'waiting', title: 'Waiting for fresh locations from both wearers.',
    detail: 'Share each wearer’s location from their own phone. A laptop reports the laptop’s position.', peerConnected: band.peerConnected === true, proximity };
  if (band.unread === true && typeof band.incoming === 'string' && /^[\x20-\x7e]{1,40}$/.test(band.incoming))
    state.incoming = { from: peer, text: band.incoming, key: `${owner}:${band.incomingSequence || 0}:${band.incoming}` };
  const fresh = fix => fix?.valid === true && Number.isFinite(fix.timestamp) && fix.timestamp > 0 && now - fix.timestamp < LOCATION_TTL_MS && fix.timestamp - now <= 5000;
  const name = id => id === 'nayaka' ? 'Nayaka' : 'Syifa';
  if (!state.peerConnected) return { ...state, detail: `${name(peer)}’s paired band is offline. Power on both bands and bring them within radio range.` };
  // The band's own decision wins: it may have suppressed a GPS bearing that
  // contradicts its measured distance. Never revive a direction it withheld.
  const findMode = band.find?.mode;
  const measuredDistance = proximity.active && proximity.source === 'wifi-ftm';
  const { walkBearing, walkUncertaintyDegrees: walkUncertainty } = band.find || {};
  if (findMode === 'walk-estimate' && measuredDistance && Number.isFinite(walkBearing) && walkBearing >= 0 && walkBearing < 360 &&
      Number.isFinite(walkUncertainty) && walkUncertainty >= 0 && walkUncertainty <= 45)
    return { ...state, mode: 'walk', walkBearing, walkUncertaintyDegrees: walkUncertainty, title: `Estimated direction to ${name(peer)}`,
      detail: `ESTIMATED FROM YOUR WALK: ${Math.round(walkBearing)}° clockwise from the top of the band, ±${Math.round(walkUncertainty)}°. It assumes ${name(peer)} stays still while you walk. ${proximity.label}.` };
  const demoBearing = band.find?.demoBearing;
  if (findMode === 'demo-direction' && proximity.active && proximity.source === 'wifi-ftm' &&
      Number.isFinite(demoBearing) && demoBearing >= 0 && demoBearing < 360)
    return { ...state, mode: 'demo', demoBearing, title: `DEMO direction · distance to ${name(peer)}`,
      detail: `DEMO DIRECTION — NOT MEASURED. The arrow points where it was set with < and > on the band; it does not follow the other band. ${proximity.label}; brightness and beeps follow this measured distance.` };
  if (findMode === 'distance' && proximity.active && proximity.source === 'wifi-ftm')
    return { ...state, mode: 'distance', title: `Distance to ${name(peer)} · no direction yet`,
      detail: `${proximity.label}. These bands have no compass or direction-finding radio. ${WALK_HINTS[band.find?.walk?.state] || WALK_HINTS.walk} The ring brightens and pulses faster as the measured distance shrinks.` };
  if (!fresh(band.location) || !fresh(band.peerLocation)) {
    const missing = [!fresh(band.location) && name(owner), !fresh(band.peerLocation) && name(peer)].filter(Boolean).join(' and ');
    return { ...state, detail: `${missing} needs a fresh location. On each missing wearer’s device, connect their matching band and press Keep location updated. Keep the pages visible and allow location access.` };
  }
  const guidance = band.guidance;
  if (guidance?.available !== true || !Number.isFinite(guidance.metres) || guidance.metres < 0) return state;
  if (guidance.usable !== true) return { ...state, mode: 'uncertain', title: 'Location is too uncertain for a direction.',
    detail: `Actual distance is unknown.${Number.isFinite(guidance.accuracy) ? ` Combined reported accuracy: ±${Math.round(guidance.accuracy)} m.` : ''} The accuracy ranges overlap or the bearing is ambiguous, so no safe arrow is shown. These devices could be side by side; laptop location cannot measure centimetre movements. Each wearer can use their own phone outdoors for a better fix.` };
  if (findMode !== undefined && findMode !== 'direction') return state;
  if (!Number.isFinite(guidance.bearing) || guidance.bearing < 0 || guidance.bearing >= 360 ||
      !Number.isFinite(guidance.bearingUncertaintyDegrees) || guidance.bearingUncertaintyDegrees < 0 || guidance.bearingUncertaintyDegrees > 90 ||
      guidance.northReferenced !== true) return state;
  const simulated = guidance.simulated || band.location.simulated || band.peerLocation.simulated;
  const measured = proximity.active && proximity.source === 'wifi-ftm' ? ` · ${Math.round(proximity.metres)} m measured by Wi-Fi` : '';
  return { ...state, mode: 'ready', title: `Direction to ${peer === 'syifa' ? 'Syifa' : 'Nayaka'}`,
    detail: `${Math.round(guidance.metres)} m · ${Math.round(guidance.bearing)}° clockwise from north · bearing ±${guidance.bearingUncertaintyDegrees.toFixed(1)}°${measured}${simulated ? ' · SIMULATED LOCATION' : ''}` };
}

module.exports = { initialTransportMode, describeBandStatus };
