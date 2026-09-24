const { FRIENDS } = require('../data/mockData');
function validName(name) { return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 40 && !/[\x00-\x1f\x7f]/.test(name); }
const defaultDeviceName = identity => `${FRIENDS.find(f => f.id === identity)?.name || 'PulseBand'}’s laptop`;
function readDeviceName(key, fallback, storage) {
  try { const name = (storage || globalThis.localStorage)?.getItem(`pulseband.name.${key}`); return validName(name) ? name.trim() : fallback; } catch (_) { return fallback; }
}
function saveDeviceName(key, name, storage) {
  if (!validName(name)) return false;
  try { const target = storage || globalThis.localStorage; if (!target) return false; target.setItem(`pulseband.name.${key}`, name.trim()); return true; } catch (_) { return false; }
}
module.exports = { validName, defaultDeviceName, readDeviceName, saveDeviceName };
