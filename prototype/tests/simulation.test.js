const test = require('node:test');
const assert = require('node:assert/strict');
const { FRIENDS, OPTIONS, DISTANCES, INTENSITIES } = require('../data/mockData');
const { createInitialState, simulationReducer, connectedCount, lightForFriend } = require('../utils/simulation');
const { triggerHaptic, cancelHaptic } = require('../utils/haptics');

const press = (state, button) => simulationReducer(state, { type: 'BUTTON', button });
function chooseOption(id) {
  let state = press(createInitialState(), 'ok');
  for (let i = 0; i < OPTIONS.findIndex(option => option.id === id); i++) state = press(state, 'next');
  return state;
}
function findFriend(index = 0) {
  let state = press(chooseOption('find'), 'ok');
  for (let i = 0; i < index; i++) state = press(state, 'next');
  return press(state, 'ok');
}

test('exactly four consistent friend identities and colours', () => {
  assert.deepEqual(FRIENDS.map(friend => [friend.name, friend.color]), [
    ['Nayaka', '#A855F7'], ['Amy', '#EF4444'], ['Syifa', '#FACC15'], ['Nala', '#22C55E'],
  ]);
  assert.equal(connectedCount(createInitialState()), 4);
});

test('Next traverses every main option and returns home; Back reverses the cycle', () => {
  let state = createInitialState();
  for (const option of OPTIONS) {
    state = press(state, 'next');
    assert.equal(state.view, 'menu');
    assert.equal(OPTIONS[state.menuIndex].id, option.id);
  }
  assert.equal(press(state, 'next').view, 'home');
  state = press(createInitialState(), 'back');
  assert.equal(OPTIONS[state.menuIndex].id, 'safe');
  for (let i = 0; i < OPTIONS.length; i++) state = press(state, 'back');
  assert.equal(state.view, 'home');
});

test('friend selection cycles in the specified order and Back exits the first friend', () => {
  let state = press(chooseOption('find'), 'ok');
  for (const friend of FRIENDS) {
    assert.equal(FRIENDS[state.friendIndex].id, friend.id);
    state = press(state, 'next');
  }
  assert.equal(state.friendIndex, 0);
  assert.equal(press(state, 'back').view, 'menu');
  FRIENDS.forEach((friend, i) => assert.equal(findFriend(i).targetId, friend.id));
});

test('walking follows all distances with strictly increasing glow and near haptics', () => {
  let state = findFriend();
  for (let i = 0; i < DISTANCES.length; i++) {
    assert.equal(state.steps.nayaka, i);
    assert.equal(lightForFriend(state, FRIENDS[0]).intensity, INTENSITIES[i]);
    if (i > 0) assert.ok(INTENSITIES[i] > INTENSITIES[i - 1]);
    if (i >= 4) assert.equal(state.feedback.type, 'nearby');
    state = simulationReducer(state, { type: 'WALK' });
  }
  assert.equal(state.steps.nayaka, 5);
  const feedbackId = state.feedback.id;
  state = simulationReducer(state, { type: 'WALK' });
  assert.equal(state.feedback.id, feedbackId, 'no repeated near haptic when already nearby');
  state = simulationReducer(state, { type: 'RESET_FRIEND' });
  assert.equal(state.steps.nayaka, 0);
  assert.equal(state.direction, 0);
});

test('direction moves around the device without changing friend identity or distance', () => {
  let state = findFriend(1);
  for (let i = 1; i <= 8; i++) {
    state = simulationReducer(state, { type: 'MOVE_DIRECTION' });
    assert.equal(state.direction, (i * 45) % 360);
    assert.equal(state.targetId, 'amy');
    assert.equal(state.steps.amy, 0);
  }
});

test('compass bearing for each friend rotates with simulated direction', () => {
  // Each friend has a fixed angle. The compass arrow bearing should be friend.angle + direction.
  for (const friend of FRIENDS) {
    assert.equal(typeof friend.angle, 'number', `${friend.name} has a numeric angle`);
  }
  let state = findFriend(0); // tracking Nayaka (angle: -135)
  assert.equal(state.view, 'tracking');
  assert.equal(state.direction, 0);
  // After one Move Direction (45°), Nayaka's bearing is -135 + 45 = -90
  state = simulationReducer(state, { type: 'MOVE_DIRECTION' });
  assert.equal(FRIENDS[0].angle + state.direction, -90);
  // After another (90°), bearing is -135 + 90 = -45
  state = simulationReducer(state, { type: 'MOVE_DIRECTION' });
  assert.equal(FRIENDS[0].angle + state.direction, -45);
  // Full rotation (360°) returns to original bearing
  for (let i = 0; i < 6; i++) state = simulationReducer(state, { type: 'MOVE_DIRECTION' });
  assert.equal(state.direction, 0);
  assert.equal(FRIENDS[0].angle + state.direction, FRIENDS[0].angle);
});

for (const signal of ['toilet', 'break', 'home', 'safe']) {
  test(`${signal}: confirmation is required; Back/Next cancel; OK sends to four`, () => {
    const menu = chooseOption(signal);
    const confirmation = press(menu, 'ok');
    assert.equal(confirmation.view, 'confirm');
    assert.equal(confirmation.result, null);
    assert.equal(confirmation.feedback.type, null);
    for (const button of ['back', 'next']) {
      const cancelled = press(confirmation, button);
      assert.equal(cancelled.view, 'menu');
      assert.equal(cancelled.result, null);
      assert.equal(cancelled.feedback.type, null);
    }
    const sent = press(confirmation, 'ok');
    assert.equal(sent.view, 'result');
    assert.equal(sent.result.signalId, signal);
    assert.equal(sent.result.recipients.length, 4);
    assert.equal(sent.feedback.type, signal === 'sos' ? 'sos' : 'send');
    for (const button of ['back', 'ok', 'next']) assert.equal(press(sent, button).view, 'menu');
  });
}

test('incoming signals glow in the sender colour and restore the interrupted screen', () => {
  const tracking = simulationReducer(findFriend(1), { type: 'WALK' });
  for (const friend of FRIENDS) {
    const received = simulationReducer(tracking, { type: 'INCOMING', friendId: friend.id });
    assert.equal(received.view, 'incoming');
    assert.equal(received.incomingId, friend.id);
    assert.equal(received.feedback.type, 'incoming');
    assert.equal(lightForFriend(received, friend).active, true);
    for (const button of ['back', 'ok', 'next']) {
      const restored = press(received, button);
      assert.equal(restored.view, 'tracking');
      assert.equal(restored.targetId, 'amy');
      assert.equal(restored.steps.amy, 1);
    }
  }
});

test('repeated incoming messages preserve the original screen and do not send pending SOS', () => {
  const confirmation = press(createInitialState(), 'sos');
  let state = simulationReducer(confirmation, { type: 'INCOMING', friendId: 'nayaka' });
  state = simulationReducer(state, { type: 'INCOMING', friendId: 'nala' });
  state = press(state, 'ok');
  assert.equal(state.view, 'confirm');
  assert.equal(state.result, null);
  state = press(state, 'back');
  assert.equal(state.result, null);
});

test('disconnected friend has no distance progression, active glow or incoming delivery', () => {
  let state = findFriend(2);
  state = simulationReducer(state, { type: 'CONNECTION', friendId: 'syifa', connected: false });
  assert.equal(connectedCount(state), 3);
  assert.equal(lightForFriend(state, FRIENDS[2]).intensity, 0);
  state = simulationReducer(state, { type: 'WALK' });
  assert.equal(state.steps.syifa, 0);
  state = simulationReducer(state, { type: 'INCOMING', friendId: 'syifa' });
  assert.equal(state.view, 'tracking');
  state = simulationReducer(state, { type: 'CONNECTION', friendId: 'syifa', connected: true });
  assert.equal(connectedCount(state), 4);
  assert.equal(simulationReducer(state, { type: 'WALK' }).steps.syifa, 1);
});

test('partial-group SOS reports only connected recipients; zero connections cannot send', () => {
  let state = press(createInitialState(), 'sos');
  state = simulationReducer(state, { type: 'CONNECTION', friendId: 'amy', connected: false });
  let sent = press(press(press(state, 'ok'), 'ok'), 'ok');
  assert.deepEqual(sent.result.recipients, ['nayaka', 'syifa', 'nala']);
  for (const friend of FRIENDS) state = simulationReducer(state, { type: 'CONNECTION', friendId: friend.id, connected: false });
  sent = press(press(press(state, 'ok'), 'ok'), 'ok');
  assert.equal(sent.view, 'unavailable');
  assert.equal(sent.result, null);
  assert.equal(sent.feedback.type, null);
});

test('Bluetooth quality, low battery, haptics and reset controls update local state', () => {
  let state = findFriend();
  state = simulationReducer(state, { type: 'BLUETOOTH', value: 'weak' });
  assert.equal(state.bluetooth, 'weak');
  state = simulationReducer(state, { type: 'BLUETOOTH', value: 'good' });
  assert.equal(state.bluetooth, 'good');
  state = simulationReducer(state, { type: 'BATTERY_LOW' });
  assert.equal(state.battery, 12);
  state = simulationReducer(state, { type: 'HAPTICS', enabled: false });
  assert.equal(state.hapticsEnabled, false);
  state = simulationReducer(state, { type: 'CONTROL_FRIEND', friendId: 'nala' });
  assert.equal(state.controlFriendId, 'nala');
  state = simulationReducer(state, { type: 'RESET' });
  assert.equal(state.view, 'home');
  assert.equal(state.battery, 86);
  assert.equal(state.controlFriendId, 'nayaka');
  assert.equal(state.hapticsEnabled, true);
  assert.equal(connectedCount(state), 4);
});

test('unsupported or blocked browser vibration cannot throw; haptics off suppresses it', () => {
  assert.equal(triggerHaptic('sos', true, null), false);
  assert.equal(triggerHaptic('sos', true, {}), false);
  assert.equal(triggerHaptic('incoming', true, { vibrate() { throw new Error('Blocked'); } }), false);
  let calls = 0;
  const device = { vibrate() { calls++; return true; } };
  assert.equal(triggerHaptic('send', false, device), false);
  assert.equal(calls, 0);
  assert.equal(triggerHaptic('send', true, device), true);
  assert.equal(calls, 1);
  assert.doesNotThrow(() => cancelHaptic({ vibrate() { throw new Error('Unsupported'); } }));
});

test('SOS sends only on the third OK press and cancellation clears progress', () => {
  for (const cancel of ['back', 'next']) {
    let state = press(createInitialState(), 'sos');
    assert.equal(state.view, 'confirm');
    for (let count = 1; count <= 2; count++) {
      state = press(state, 'ok');
      assert.equal(state.sosConfirmations, count);
      assert.equal(state.view, 'confirm');
      assert.equal(state.result, null);
      assert.equal(state.feedback.type, null);
    }
    const sent = press(state, 'ok');
    assert.equal(sent.result.signalId, 'sos');
    assert.equal(sent.result.recipients.length, 4);
    assert.equal(sent.feedback.type, 'sos');
    state = press(press(state, cancel), 'sos');
    assert.equal(state.sosConfirmations, 0);
    assert.equal(state.result, null);
  }
});

test('incoming message dismissal does not count as SOS confirmation', () => {
  let state = press(press(createInitialState(), 'sos'), 'ok');
  state = simulationReducer(state, { type: 'INCOMING', friendId: 'nala' });
  state = press(state, 'ok');
  assert.equal(state.sosConfirmations, 1);
  state = press(state, 'ok');
  assert.equal(state.result, null);
  assert.equal(press(state, 'ok').result.signalId, 'sos');
});

test('incoming overlay controls never advance or cancel pending SOS confirmation', () => {
  let state = press(press(createInitialState(), 'sos'), 'ok');
  state = simulationReducer(state, { type: 'INCOMING', friendId: 'nala' });

  for (const button of ['back', 'ok', 'next']) {
    const dismissed = press(state, button);
    assert.equal(dismissed.view, 'confirm');
    assert.equal(dismissed.sosConfirmations, 1);
    assert.equal(dismissed.result, null);
    state = simulationReducer(dismissed, { type: 'INCOMING', friendId: 'nala' });
  }

  state = press(state, 'back');
  assert.equal(state.view, 'confirm');
  state = press(state, 'back');
  assert.equal(state.view, 'menu');
  assert.equal(state.sosConfirmations, 0);
  state = press(state, 'sos');
  assert.equal(state.sosConfirmations, 0);
  assert.equal(state.view, 'confirm');
});
