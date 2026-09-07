// Reuses the existing prototype's group, arrival and alert vibration patterns.
// Optional browser vibration. Every event also has visible feedback in App.js.
const PATTERNS = {
  incoming: [45, 55, 45],
  send: [85],
  nearby: [35, 60, 35],
  sos: [90, 70, 90, 70, 90],
};

function triggerHaptic(type, enabled = true, browserNavigator = typeof navigator !== 'undefined' ? navigator : null) {
  if (!enabled || !PATTERNS[type]) return false;
  try {
    if (!browserNavigator || typeof browserNavigator.vibrate !== 'function') return false;
    return browserNavigator.vibrate(PATTERNS[type]) !== false;
  } catch (_) {
    // Unsupported/blocked vibration must never stop the prototype.
    return false;
  }
}

function cancelHaptic(browserNavigator = typeof navigator !== 'undefined' ? navigator : null) {
  try {
    if (browserNavigator && typeof browserNavigator.vibrate === 'function') browserNavigator.vibrate(0);
  } catch (_) { /* Visual feedback remains available. */ }
}

module.exports = { PATTERNS, triggerHaptic, cancelHaptic };
