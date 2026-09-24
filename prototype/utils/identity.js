const { FRIENDS } = require('../data/mockData');
const valid = id => FRIENDS.some(friend => friend.id === id);
function readIdentity(storage) {
  try { const id = (storage || globalThis.localStorage)?.getItem('pulseband.identity'); return valid(id) ? id : null; } catch (_) { return null; }
}
function saveIdentity(id, storage) {
  if (!valid(id)) return false;
  try { const target = storage || globalThis.localStorage; if (!target) return false; target.setItem('pulseband.identity', id); return true; } catch (_) { return false; }
}
const friendsFor = identity => FRIENDS.filter(friend => friend.id !== identity);
module.exports = { readIdentity, saveIdentity, friendsFor };
