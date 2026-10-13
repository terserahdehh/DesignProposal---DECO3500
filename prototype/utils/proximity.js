// The band decides proximity (light brightness and beep interval) from its own
// measurements. The browser only displays a current, well-formed report and
// switches everything off when the report is stale, offline or malformed.
const PROXIMITY_STALE_MS = 5000;
const SOURCES = {
  'wifi-ftm': 'measured by Wi-Fi round-trip timing between the bands',
  'phone-gps': 'from both shared device locations',
};

const off = reason => ({ active: false, reason, brightness: 0, beepIntervalMs: 0 });

function metresText(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  return value < 10 ? `${value.toFixed(1)} m` : `${Math.round(value)} m`;
}

function uncertaintyText(value) {
  return value < 1 ? `${value.toFixed(2)} m` : value < 10 ? `${value.toFixed(1)} m` : `${Math.round(value)} m`;
}

function describeProximity(band, observedAt, now = Date.now()) {
  if (!band || band.peerConnected !== true) return off('offline');
  // A USB bridge snapshot can be older than the page's last poll.
  const seen = Number.isFinite(band.statusReceivedAt) ? Math.min(observedAt, band.statusReceivedAt) : observedAt;
  if (!Number.isFinite(seen) || now - seen >= PROXIMITY_STALE_MS) return off('stale');
  const report = band.proximity;
  if (!report || report.active !== true) return off('unavailable');
  const { source, metres, uncertaintyMetres, brightness, beepIntervalMillis: interval } = report;
  if (!Object.hasOwn(SOURCES, source) || !Number.isFinite(metres) || metres < 0 ||
      !Number.isFinite(uncertaintyMetres) || uncertaintyMetres < 0 ||
      !Number.isFinite(brightness) || brightness < 0 || brightness > 1 ||
      !Number.isInteger(interval) || interval !== 0 && (interval < 100 || interval > 5000)) return off('invalid');
  return { active: true, source, metres, uncertaintyMetres, brightness, beepIntervalMs: interval,
    label: `≈${metresText(metres)} ±${uncertaintyText(uncertaintyMetres)} · ${SOURCES[source]}` };
}

module.exports = { describeProximity, PROXIMITY_STALE_MS };
