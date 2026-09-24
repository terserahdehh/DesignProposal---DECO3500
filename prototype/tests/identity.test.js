const test = require('node:test');
const assert = require('node:assert/strict');
const { readIdentity, saveIdentity, friendsFor } = require('../utils/identity');
const { createInitialState, simulationReducer } = require('../utils/simulation');
test('identity persists, switches and rejects invalid stored names', () => {
  const data = new Map(); const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) };
  assert.equal(readIdentity(storage), null);
  for (const id of ['nayaka', 'amy', 'nala', 'syifa']) { saveIdentity(id, storage); assert.equal(readIdentity(storage), id); }
  assert.equal(saveIdentity('unknown', storage), false);
  assert.equal(readIdentity({ getItem() { return 'unknown'; } }), null);
});
test('blocked local storage falls back without crashing', () => {
  const storage = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  assert.equal(readIdentity(storage), null); assert.equal(saveIdentity('amy', storage), false);
});
test('every identity excludes self from navigation, signals and reset', () => {
  for (const id of ['nayaka', 'amy', 'nala', 'syifa']) {
    let state = createInitialState(id);
    const press = button => { state = simulationReducer(state, { type: 'BUTTON', button }); };
    press('ok'); press('ok');
    for (let i = 0; i < 6; i++) { assert.notEqual(friendsFor(id)[state.friendIndex].id, id); press('next'); }
    press('ok'); assert.notEqual(state.targetId, id);
    press('sos'); press('ok'); press('ok'); press('ok');
    assert.equal(state.result.recipients.includes(id), false);
    state = simulationReducer(state, { type: 'RESET' }); assert.equal(state.identity, id);
    assert.notEqual(state.targetId, id);
  }
});
