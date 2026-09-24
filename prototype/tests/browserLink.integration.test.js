// Real ICE/DTLS/SCTP data channels over local UDP; no mocked message delivery.
const test = require('node:test');
const assert = require('node:assert/strict');
const { RTCPeerConnection } = require('werift');
const { createBrowserLink } = require('../utils/browserLink');
const { SIGNALS } = require('../utils/bluetooth');
class LocalPeer extends RTCPeerConnection {
  constructor(config) { super({ ...config, iceAdditionalHostAddresses: ['127.0.0.1'], iceUseIpv6: false }); }
}
function until(service, predicate) {
  return new Promise((resolve, reject) => {
    if (predicate(service.getState())) return resolve();
    const timer = setTimeout(() => { unsubscribe(); reject(Error(`Timed out: ${JSON.stringify(service.getState())}`)); }, 12000);
    const unsubscribe = service.subscribe(state => { if (predicate(state)) { clearTimeout(timer); unsubscribe(); resolve(); } });
  });
}
test('two independent WebRTC peers exchange all signals, acknowledgements and renamed devices', { timeout: 45000 }, async t => {
  const config = { PeerConnection: LocalPeer, iceServers: [], connectTimeoutMs: 20000 };
  const a = createBrowserLink('nayaka', 'Nayaka MacBook', config);
  const b = createBrowserLink('nala', 'Nala MacBook', config);
  t.after(() => { a.disconnect(); b.disconnect(); });
  const invitation = await a.createOffer(); assert.ok(invitation, a.getState().message);
  const reply = await b.acceptOffer(invitation); assert.ok(reply, b.getState().message);
  assert.equal(await a.acceptAnswer(reply), true);
  await Promise.all([until(a, s => s.status === 'connected'), until(b, s => s.status === 'connected')]);
  for (const signal of Object.keys(SIGNALS)) {
    for (const [sender, receiver] of [[a, b], [b, a]]) {
      const previous = receiver.getState().incoming?.id;
      assert.equal(sender.send(signal), true);
      await until(receiver, s => s.incoming?.signal === signal && s.incoming.id !== previous);
      await until(sender, s => s.delivery === 'received');
    }
  }
  a.rename('Nayaka’s concert laptop');
  await until(b, s => s.peer?.name === 'Nayaka’s concert laptop');
  a.disconnect();
  await until(b, s => s.status === 'disconnected');
  assert.equal(b.send('safe'), false);
});
