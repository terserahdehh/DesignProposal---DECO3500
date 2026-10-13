const { LOCATION_TTL_MS } = require('./locationFix');

// Describe the band's last received fix. These labels do not change a fix or
// decide whether guidance is usable; the existing quality checks do that.
function describeLocationStatus(fix, now = Date.now()) {
  if (!Number.isFinite(fix?.timestamp) || fix.timestamp <= 0)
    return { state: 'missing', text: 'No device location received.' };
  const ageMs = now - fix.timestamp;
  const accuracy = Number.isFinite(fix.accuracy) && fix.accuracy >= 0 ? fix.accuracy : null;
  const state = ageMs < -5000 ? 'clock' : ageMs >= LOCATION_TTL_MS ? 'expired' : fix.valid === true ? 'fresh' : 'unavailable';
  const label = { clock: 'Device clock is ahead', expired: 'Expired', fresh: 'Fresh', unavailable: 'Not shared or unavailable' }[state];
  const age = ageMs < -5000 ? `${Math.ceil(-ageMs / 1000)} s ahead` : `${Math.max(0, Math.floor(ageMs / 1000))} s old`;
  const precision = accuracy === null ? 'accuracy unavailable' : `reported accuracy ±${accuracy.toLocaleString('en', { maximumFractionDigits: 2 })} m`;
  return { state, timestamp: fix.timestamp, accuracy, ageMs, simulated: fix.simulated === true,
    text: `${label} · ${age} · ${precision}${fix.simulated === true ? ' · SIMULATED' : ''}` };
}

module.exports = { describeLocationStatus };
