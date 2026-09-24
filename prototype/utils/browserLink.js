// WebRTC network transport. Independent of Bluetooth and simulation state.
// Manual SDP exchange allows static HTTPS hosting without a signalling backend.
const { FRIENDS } = require('../data/mockData');
const { SIGNALS } = require('./bluetooth');
const { validName } = require('./deviceNames');
function createBrowserLink(identity, name, options = {}) {
  const PeerConnection = 'PeerConnection' in options ? options.PeerConnection : globalThis.RTCPeerConnection;
  const iceServers = options.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }];
  let state = { status: PeerConnection ? 'idle' : 'unsupported', name, peer: null, code: '', incoming: null, delivery: null, message: PeerConnection ? 'Create an invitation or paste a friend’s invitation.' : 'This browser does not support WebRTC.' };
  let pc, channel, generation = 0, session, busy = false, deadline, cancelGather, pending, sequence = 0;
  const listeners = new Set();
  const update = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn(state)); };
  function cleanup() {
    clearTimeout(deadline); clearTimeout(pending?.timer); pending = null;
    cancelGather?.(); cancelGather = null;
    if (channel) { channel.onopen = channel.onmessage = channel.onclose = channel.onerror = null; channel.close(); channel = null; }
    if (pc) { pc.onconnectionstatechange = pc.ondatachannel = null; pc.close(); pc = null; }
  }
  function stop(status, message) {
    generation++; busy = false; cleanup();
    update({ status, message, code: '', incoming: null, delivery: state.delivery === 'sending' ? 'unconfirmed' : state.delivery });
  }
  function connectDeadline() {
    clearTimeout(deadline);
    deadline = setTimeout(() => stop('error', 'Could not connect. Try the same Wi-Fi or a hotspot. Restricted networks may need a TURN relay, which this prototype does not provide.'), options.connectTimeoutMs || 120000);
  }
  function bindChannel(next, attempt) {
    if (attempt !== generation || channel && channel !== next) { next.close(); return; }
    channel = next;
    channel.onopen = () => { if (attempt !== generation) return; clearTimeout(deadline); update({ status: 'connected', code: '', message: 'Browser connected over WebRTC (network).' }); channel.send(JSON.stringify({ type: 'name', name: state.name })); };
    channel.onclose = () => { if (attempt === generation) stop('disconnected', 'Browser disconnected. Exchange new codes to reconnect.'); };
    channel.onerror = () => { if (attempt === generation) stop('error', 'Browser connection failed. Exchange new codes to retry.'); };
    channel.onmessage = event => {
      if (attempt !== generation || typeof event.data !== 'string' || event.data.length > 512) return;
      try {
        const packet = JSON.parse(event.data);
        if (!packet || typeof packet !== 'object') return;
        if (packet.type === 'name' && validName(packet.name)) update({ peer: { ...state.peer, name: packet.name.trim() } });
        if (packet.type === 'ack' && pending?.id === packet.id) { clearTimeout(pending.timer); pending = null; update({ delivery: 'received', message: 'The other browser acknowledged this signal.' }); }
        if (packet.type === 'signal' && Number.isSafeInteger(packet.id) && packet.id > 0) {
          const signal = Object.keys(SIGNALS).find(key => SIGNALS[key] === packet.code);
          if (!signal) return;
          update({ incoming: { signal, id: packet.id, at: Date.now() } });
          channel.send(JSON.stringify({ type: 'ack', id: packet.id }));
        }
      } catch (_) { /* Invalid packets never become signals. */ }
    };
  }
  function start(peer, newSession) {
    generation++; cleanup(); busy = true; session = newSession;
    const attempt = generation;
    pc = new PeerConnection({ iceServers });
    update({ status: 'pairing', peer, code: '', incoming: null, delivery: null, message: 'Preparing the connection code…' });
    pc.ondatachannel = event => bindChannel(event.channel, attempt);
    pc.onconnectionstatechange = () => {
      if (attempt !== generation) return;
      if (['failed', 'closed'].includes(pc.connectionState)) stop('disconnected', 'Connection lost. Exchange new codes to reconnect.');
      else if (pc.connectionState === 'disconnected') { update({ status: 'reconnecting', message: 'Network interrupted. Waiting for the peer…' }); connectDeadline(); }
      else if (pc.connectionState === 'connected' && channel?.readyState === 'open') { clearTimeout(deadline); update({ status: 'connected', message: 'Browser connected over WebRTC (network).' }); }
    };
    return attempt;
  }
  async function gathered(target) {
    if (target.iceGatheringState === 'complete') return;
    await new Promise((resolve, reject) => {
      let timer;
      const done = error => { clearTimeout(timer); target.removeEventListener('icegatheringstatechange', changed); cancelGather = null; error ? reject(error) : resolve(); };
      const changed = () => { if (target.iceGatheringState === 'complete') done(); };
      cancelGather = () => done(new Error('Connection cancelled.'));
      target.addEventListener('icegatheringstatechange', changed);
      timer = setTimeout(() => done(new Error('Network address discovery timed out. Try another network.')), options.gatherTimeoutMs || 15000);
      changed();
    });
  }
  function readCode(text, type) {
    if (typeof text !== 'string' || text.length > 64000) throw Error('Paste a valid PulseBand connection code.');
    let code; try { code = JSON.parse(text.trim()); } catch (_) { throw Error('Paste the complete PulseBand connection code.'); }
    if (!code || code.v !== 1 || code.type !== type || typeof code.session !== 'string' || code.session.length > 80 || !code.session || !FRIENDS.some(f => f.id === code.identity) || !validName(code.name) || code.description?.type !== type || typeof code.description.sdp !== 'string' || !code.description.sdp || code.description.sdp.length > 50000) throw Error(`Use a valid ${type === 'offer' ? 'invitation' : 'reply'} code.`);
    if (code.identity === identity) throw Error('Choose a different identity on each laptop before connecting.');
    return code;
  }
  function encode(type) { return JSON.stringify({ v: 1, type, session, identity, name: state.name, description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }); }
  async function prepare(type, input) {
    if (!PeerConnection || busy || !['idle', 'error', 'disconnected', 'unsupported'].includes(state.status)) return null;
    let attempt;
    try {
      const remote = type === 'answer' ? readCode(input, 'offer') : null;
      attempt = start(remote ? { identity: remote.identity, name: remote.name } : null, remote?.session || globalThis.crypto.randomUUID());
      const target = pc;
      if (remote) await target.setRemoteDescription(remote.description);
      else bindChannel(target.createDataChannel('pulseband'), attempt);
      const description = remote ? await target.createAnswer() : await target.createOffer();
      if (attempt !== generation) return null;
      await target.setLocalDescription(description);
      if (attempt !== generation) return null;
      await gathered(target);
      if (attempt !== generation) return null;
      const code = encode(type);
      update({ code, status: remote ? 'connecting' : 'waiting', message: remote ? 'Send this reply code back to the first laptop.' : 'Send this invitation to the other laptop, then paste its reply here.' });
      if (remote) connectDeadline();
      return code;
    } catch (error) {
      if (attempt === undefined || attempt === generation) stop('error', error.message || 'Could not create the connection.');
      return null;
    } finally { if (attempt === generation) busy = false; }
  }
  return {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    createOffer: () => prepare('offer'),
    acceptOffer: text => prepare('answer', text),
    async acceptAnswer(text) {
      if (busy || state.status !== 'waiting' || !pc) return false;
      const attempt = generation;
      try {
        const reply = readCode(text, 'answer');
        if (reply.session !== session) throw Error('This reply belongs to another invitation. Ask for a new reply.');
        busy = true;
        await pc.setRemoteDescription(reply.description);
        if (attempt !== generation) return false;
        update({ peer: { identity: reply.identity, name: reply.name }, status: 'connecting', code: '', message: 'Connecting to the other browser…' });
        connectDeadline(); return true;
      } catch (error) { if (attempt === generation) update({ message: error.message || 'Invalid reply code.' }); return false; }
      finally { if (attempt === generation) busy = false; }
    },
    rename(next) {
      if (!validName(next)) return false;
      update({ name: next.trim() });
      if (channel?.readyState === 'open') { try { channel.send(JSON.stringify({ type: 'name', name: state.name })); } catch (_) { return false; } }
      return true;
    },
    send(signal) {
      if (state.status !== 'connected' || channel?.readyState !== 'open' || !SIGNALS[signal] || pending) return false;
      const id = ++sequence;
      try {
        pending = { id, timer: setTimeout(() => { pending = null; update({ delivery: 'unconfirmed', message: 'No acknowledgement received. Delivery is unconfirmed.' }); }, options.ackTimeoutMs || 5000) };
        update({ delivery: 'sending' });
        channel.send(JSON.stringify({ type: 'signal', id, code: SIGNALS[signal] })); return true;
      } catch (_) { clearTimeout(pending?.timer); pending = null; update({ delivery: 'unconfirmed', message: 'Signal could not be sent.' }); return false; }
    },
    disconnect() { stop('disconnected', 'Browser connection closed.'); },
  };
}
module.exports = { createBrowserLink };
