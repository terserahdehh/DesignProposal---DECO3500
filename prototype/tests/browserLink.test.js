const test = require('node:test');
const assert = require('node:assert/strict');
const { createBrowserLink } = require('../utils/browserLink');
class FakePeer {
  constructor() { this.iceGatheringState = 'complete'; this.connectionState = 'new'; FakePeer.last = this; }
  createDataChannel() { return this.channel = { readyState: 'connecting', send: text => { this.sent = JSON.parse(text); }, close() {} }; }
  async createOffer() { return { type: 'offer', sdp: 'offer-sdp' }; }
  async createAnswer() { return { type: 'answer', sdp: 'answer-sdp' }; }
  async setLocalDescription(d) { this.localDescription = d; }
  async setRemoteDescription(d) { this.remoteDescription = d; }
  close() { this.connectionState = 'closed'; }
}
const make = id => createBrowserLink(id, `${id} laptop`, { PeerConnection: FakePeer, connectTimeoutMs: 1000, ackTimeoutMs: 20 });
async function pair(t) {
  const a = make('nayaka'); const b = make('nala');
  t.after(() => { a.disconnect(); b.disconnect(); });
  const offer = await a.createOffer(); const pa = FakePeer.last;
  const answer = await b.acceptOffer(offer); const pb = FakePeer.last;
  assert.equal(await a.acceptAnswer(answer), true);
  pa.channel.readyState = 'open'; pa.channel.onopen();
  return { a, b, pa, pb };
}
test('unsupported browser returns status instead of crashing', async () => {
  const a = createBrowserLink('nayaka', 'Nayaka', { PeerConnection: null });
  assert.equal(a.getState().status, 'unsupported');
  assert.equal(await a.createOffer(), null);
});
test('offer/reply exchanges actual identities and device names', async t => {
  const { a, b } = await pair(t);
  assert.equal(a.getState().status, 'connected');
  assert.equal(a.getState().peer.identity, 'nala');
  assert.equal(a.getState().peer.name, 'nala laptop');
  assert.equal(b.getState().peer.identity, 'nayaka');
});
test('same identity and malformed pairing codes are rejected', async t => {
  const a = make('nayaka'); const b = make('nayaka'); t.after(() => { a.disconnect(); b.disconnect(); });
  assert.equal(await b.acceptOffer('broken'), null);
  assert.equal(await b.acceptOffer(await a.createOffer()), null);
  assert.match(b.getState().message, /different identity/i);
});
test('unrelated reply cannot hijack the pending connection', async t => {
  const a = make('nayaka'); const b = make('nala'); t.after(() => { a.disconnect(); b.disconnect(); });
  const offer = await a.createOffer(); const reply = JSON.parse(await b.acceptOffer(offer));
  reply.session = 'other-session';
  assert.equal(await a.acceptAnswer(JSON.stringify(reply)), false);
  assert.notEqual(a.getState().status, 'connected');
});
test('signals require acknowledgement and repeated received codes update the screen', async t => {
  const { a, pa } = await pair(t);
  assert.equal(a.send('safe'), true); assert.equal(a.getState().delivery, 'sending');
  pa.channel.onmessage({ data: JSON.stringify({ type: 'ack', id: pa.sent.id }) });
  assert.equal(a.getState().delivery, 'received');
  const signal = { type: 'signal', id: 9, code: 6 };
  pa.channel.onmessage({ data: JSON.stringify(signal) });
  assert.equal(a.getState().incoming.signal, 'sos');
  assert.equal(pa.sent.type, 'ack');
  assert.equal(a.rename('Nayaka MacBook'), true);
  assert.equal(pa.sent.type, 'name');
  pa.channel.onmessage({ data: JSON.stringify({ type: 'name', name: 'Nala MacBook' }) });
  assert.equal(a.getState().peer.name, 'Nala MacBook');
  pa.channel.onmessage({ data: '{invalid' });
  pa.channel.onmessage({ data: JSON.stringify({ type: 'signal', id: 10, code: 200 }) });
  assert.equal(a.getState().incoming.signal, 'sos');
});
test('missing acknowledgement and disconnect never claim delivery', async t => {
  const { a, pa } = await pair(t);
  a.send('safe');
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(a.getState().delivery, 'unconfirmed');
  pa.channel.onclose(); assert.equal(a.getState().status, 'disconnected');
  assert.equal(a.send('sos'), false);
});
