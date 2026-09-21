// this reducer contains the band's navigation rules and all simulated interaction state.
const { FRIENDS, OPTIONS, SOS_SIGNAL, DISTANCES, INTENSITIES } = require('../data/mockData');

function createInitialState() {
  return {
    view: 'home', menuIndex: 0, friendIndex: 0, targetId: 'nayaka', controlFriendId: 'nayaka', signalId: null, sosConfirmations: 0,
    connected: Object.fromEntries(FRIENDS.map(friend => [friend.id, true])),
    steps: Object.fromEntries(FRIENDS.map(friend => [friend.id, 0])),
    direction: 0, bluetooth: 'good', battery: 86, hapticsEnabled: true,
    incomingId: null, resume: null, result: null,
    event: { id: 0, text: 'Ready. Press OK on the band to explore.', kind: 'info' },
    feedback: { id: 0, type: null },
  };
}

function connectedCount(state) {
  return FRIENDS.filter(friend => state.connected[friend.id]).length;
}

function notify(state, text, kind = 'info', feedbackType = null) {
  return {
    ...state,
    event: { id: state.event.id + 1, text, kind },
    feedback: feedbackType ? { id: state.feedback.id + 1, type: feedbackType } : state.feedback,
  };
}

function dismissOverlay(state) {
  if (state.view === 'incoming') {
    return { ...state, ...state.resume, incomingId: null, resume: null };
  }
  return { ...state, view: 'menu', result: null };
}

function navigate(state, button) {
  if (button === 'sos') {
    if (state.view === 'confirm' && state.signalId === 'sos') return state;
    return { ...state, view: 'confirm', signalId: 'sos', sosConfirmations: 0, result: null, incomingId: null, resume: null };
  }
  if (state.view === 'incoming' || state.view === 'result' || state.view === 'unavailable') {
    return dismissOverlay(state);
  }
  if (state.view === 'home') {
    return { ...state, view: 'menu', menuIndex: button === 'back' ? OPTIONS.length - 1 : 0 };
  }
  if (state.view === 'menu') {
    if (button === 'next') {
      return state.menuIndex === OPTIONS.length - 1
        ? { ...state, view: 'home' }
        : { ...state, menuIndex: state.menuIndex + 1 };
    }
    if (button === 'back') {
      return state.menuIndex === 0
        ? { ...state, view: 'home' }
        : { ...state, menuIndex: state.menuIndex - 1 };
    }
    const option = OPTIONS[state.menuIndex];
    if (option.id === 'find') return { ...state, view: 'friends', friendIndex: 0 };
    return { ...state, view: 'confirm', signalId: option.id, sosConfirmations: 0 };
  }
  if (state.view === 'friends') {
    if (button === 'next') return { ...state, friendIndex: (state.friendIndex + 1) % FRIENDS.length };
    if (button === 'back') {
      return state.friendIndex === 0
        ? { ...state, view: 'menu', menuIndex: 0 }
        : { ...state, friendIndex: state.friendIndex - 1 };
    }
    return notify({ ...state, view: 'tracking', targetId: FRIENDS[state.friendIndex].id, controlFriendId: FRIENDS[state.friendIndex].id },
      `Finding ${FRIENDS[state.friendIndex].name}. Use Simulate Walking to get closer.`);
  }
  if (state.view === 'tracking') {
    if (button === 'next') {
      const index = FRIENDS.findIndex(friend => friend.id === state.targetId);
      return { ...state, view: 'friends', friendIndex: (index + 1) % FRIENDS.length };
    }
    if (button === 'back') {
      return { ...state, view: 'friends', friendIndex: FRIENDS.findIndex(friend => friend.id === state.targetId) };
    }
    // OK acknowledges the finding display and returns to the main options.
    return notify({ ...state, view: 'menu', menuIndex: 0 }, 'Finding closed. The friend’s simulated distance is kept.');
  }
  if (state.view === 'confirm') {
    if (button === 'back') return notify({ ...state, view: 'menu', sosConfirmations: 0 }, 'Signal cancelled. Nothing was sent.');
    if (button === 'next') {
      return notify({ ...state, view: 'menu', sosConfirmations: 0, menuIndex: (state.menuIndex + 1) % OPTIONS.length }, 'Confirmation cancelled. Nothing was sent.');
    }
    if (state.signalId === 'sos' && state.sosConfirmations < 2) {
      return { ...state, sosConfirmations: state.sosConfirmations + 1 };
    }
    const recipients = FRIENDS.filter(friend => state.connected[friend.id]).map(friend => friend.id);
    if (recipients.length === 0) {
      return notify({ ...state, view: 'unavailable' }, 'Nothing sent. Reconnect a friend’s band first.', 'warning');
    }
    const signal = state.signalId === 'sos' ? SOS_SIGNAL : OPTIONS.find(option => option.id === state.signalId);
    const sos = signal.id === 'sos';
    return notify({ ...state, view: 'result', result: { signalId: signal.id, recipients } },
      sos ? `Group SOS simulated for ${recipients.length} connected band${recipients.length === 1 ? '' : 's'}.`
        : `${signal.label} sent to ${recipients.length} connected friend${recipients.length === 1 ? '' : 's'} (simulated).`,
      sos ? 'sos' : 'success', sos ? 'sos' : 'send');
  }
  return state;
}

function simulationReducer(state, action) {
  switch (action.type) {
    case 'BUTTON':
      return ['back', 'ok', 'next', 'sos'].includes(action.button) ? navigate(state, action.button) : state;
    case 'WALK': {
      if (state.view !== 'tracking') return notify(state, 'Open Find Friend, choose a friend, then press OK before walking.', 'warning');
      if (!state.connected[state.targetId]) return notify(state, 'This friend is disconnected. Reconnect their band before walking.', 'warning');
      const current = state.steps[state.targetId];
      const next = Math.min(current + 1, DISTANCES.length - 1);
      const friend = FRIENDS.find(item => item.id === state.targetId);
      const distance = DISTANCES[next];
      return notify({ ...state, steps: { ...state.steps, [state.targetId]: next } },
        distance === 0 ? `${friend.name} is nearby. ${friend.colorName} light at full glow.`
          : `${friend.name} is ${distance} m away. ${friend.colorName} glow is brighter.`,
        distance === 0 ? 'success' : 'info', next !== current && distance <= 3 ? 'nearby' : null);
    }
    case 'RESET_FRIEND': {
      const friend = FRIENDS.find(item => item.id === state.targetId);
      return notify({ ...state, steps: { ...state.steps, [state.targetId]: 0 }, direction: 0 }, `${friend.name} reset to 24 m and the starting light position.`);
    }
    case 'MOVE_DIRECTION':
      return notify({ ...state, direction: (state.direction + 45) % 360 }, 'Simulated direction moved one step around the light ring.');
    case 'BLUETOOTH':
      return ['good', 'weak'].includes(action.value)
        ? notify({ ...state, bluetooth: action.value }, `Simulated Bluetooth ${action.value}. ${action.value === 'weak' ? 'Distances are approximate.' : 'Connection quality restored.'}`, action.value === 'weak' ? 'warning' : 'info')
        : state;
    case 'CONNECTION': {
      const friend = FRIENDS.find(item => item.id === action.friendId);
      if (!friend) return state;
      return notify({ ...state, connected: { ...state.connected, [friend.id]: action.connected } },
        `${friend.name} ${action.connected ? 'reconnected' : 'disconnected'} in the simulation.`, action.connected ? 'success' : 'warning');
    }
    case 'CONTROL_FRIEND':
      return FRIENDS.some(friend => friend.id === action.friendId) ? { ...state, controlFriendId: action.friendId } : state;
    case 'INCOMING': {
      const friend = FRIENDS.find(item => item.id === action.friendId);
      if (!friend) return state;
      if (!state.connected[friend.id]) return notify(state, `Reconnect ${friend.name} before triggering their message.`, 'warning');
      const resume = state.view === 'incoming' ? state.resume : {
        view: state.view, menuIndex: state.menuIndex, friendIndex: state.friendIndex,
        targetId: state.targetId, signalId: state.signalId, sosConfirmations: state.sosConfirmations, result: state.result,
      };
      return notify({ ...state, view: 'incoming', incomingId: friend.id, resume },
        `${friend.name}: ${friend.message} (simulated incoming message).`, 'incoming', 'incoming');
    }
    case 'BATTERY_LOW':
      return notify({ ...state, battery: 12 }, 'Battery set to 12%. Low battery is shown on the band.', 'warning');
    case 'HAPTICS':
      return notify({ ...state, hapticsEnabled: Boolean(action.enabled) }, action.enabled ? 'Haptics on. Visual feedback is always available.' : 'Haptics off. Visual feedback stays on.');
    case 'RESET': {
      const fresh = createInitialState();
      // Keep event IDs monotonic so resetting also clears old feedback timers.
      return { ...fresh, event: { id: state.event.id + 1, text: 'Demo reset. All four friends connected.', kind: 'info' }, feedback: { id: state.feedback.id + 1, type: null } };
    }
    default:
      return state;
  }
}

function lightForFriend(state, friend) {
  if (!state.connected[friend.id]) return { intensity: 0, active: false };
  if (state.view === 'result' && state.result?.signalId === 'sos') {
    return { intensity: 0.95, active: true };
  }
  if (state.view === 'incoming') {
    const active = state.incomingId === friend.id;
    return { intensity: active ? 0.92 : 0.09, active };
  }
  if (state.view === 'tracking') {
    const active = state.targetId === friend.id;
    return { intensity: active ? INTENSITIES[state.steps[friend.id]] : 0.06, active };
  }
  if (state.view === 'friends') {
    const active = FRIENDS[state.friendIndex].id === friend.id;
    return { intensity: active ? 0.5 : 0.1, active };
  }
  return { intensity: 0.25, active: false };
}

module.exports = { createInitialState, simulationReducer, connectedCount, lightForFriend };
