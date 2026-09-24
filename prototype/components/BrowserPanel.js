import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import ControlButton from './ControlButton';
import DeviceNameEditor from './DeviceNameEditor';
import SignalButtons, { SIGNAL_LABELS } from './SignalButtons';
import { createBrowserLink } from '../utils/browserLink';
import { defaultDeviceName, readDeviceName, saveDeviceName } from '../utils/deviceNames';
import { FRIENDS } from '../data/mockData';
export default function BrowserPanel({ identity }) {
  const [service] = useState(() => createBrowserLink(identity, readDeviceName(`browser:${identity}`, defaultDeviceName(identity))));
  const [state, setState] = useState(service.getState);
  const [input, setInput] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  useEffect(() => { const unsubscribe = service.subscribe(setState); return () => { unsubscribe(); service.disconnect(); }; }, [service]);
  const starting = ['idle', 'error', 'disconnected'].includes(state.status);
  return <View style={{ gap: 12, padding: 18, borderWidth: 1, borderColor: '#A568D5', borderRadius: 12, marginTop: 16, marginBottom: 20 }}>
    <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>Browser connection · Network</Text>
    <DeviceNameEditor name={state.name} label="YOUR VISIBLE DEVICE NAME" onSave={name => { service.rename(name); return saveDeviceName(`browser:${identity}`, name); }} />
    <Text style={{ color: '#A5B5CB', lineHeight: 21 }}>Connect two laptops with WebRTC. Choose different identities and keep both pages open. No Bluetooth pairing, camera or microphone is needed. One browser friend at a time.</Text>
    <Text style={{ color: '#A5B5CB', lineHeight: 21 }}>1. First laptop: create an invitation and send the whole code to your friend.{ '\n' }2. Other laptop: paste the invitation, create a reply, and send it back.{ '\n' }3. First laptop: paste that reply and finish connecting.</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: '#E4EAF4', lineHeight: 22 }}>{state.status.toUpperCase()} · {state.message}</Text>
    {state.peer && <Text style={{ color: '#E4EAF4', fontSize: 21, fontWeight: '700' }}>{state.status === 'connected' ? 'Connected to' : 'Peer'}: {state.peer.name} · {FRIENDS.find(f => f.id === state.peer.identity)?.name}</Text>}
    {starting && <ControlButton primary label="1. Create invitation" onPress={async () => { setInput(''); setCopyNotice(''); await service.createOffer(); }} />}
    {!!state.code && <>
      <Text style={{ color: '#E4EAF4' }}>{state.status === 'waiting' ? 'Your invitation code' : 'Your reply code'} · share only with your friend</Text>
      <TextInput accessibilityLabel="Your connection code" multiline editable={false} value={state.code} style={codeStyle} />
      <ControlButton label="Copy connection code" onPress={async () => { try { if (!globalThis.navigator?.clipboard?.writeText) throw Error(); await globalThis.navigator.clipboard.writeText(state.code); setCopyNotice('Copied. Send the code to your friend.'); } catch (_) { setCopyNotice('Select the code above and copy it manually.'); } }} />
      {!!copyNotice && <Text accessibilityLiveRegion="polite" style={{ color: '#C9BADB' }}>{copyNotice}</Text>}
    </>}
    {(starting || state.status === 'waiting') && <>
      <TextInput accessibilityLabel={state.status === 'waiting' ? 'Paste reply code' : 'Paste invitation code'} placeholder={state.status === 'waiting' ? 'Paste your friend’s reply here' : 'Or paste your friend’s invitation here'} placeholderTextColor="#8FA2BC" multiline value={input} onChangeText={setInput} maxLength={64000} style={codeStyle} />
      <ControlButton label={state.status === 'waiting' ? '3. Finish connecting' : '2. Accept invitation & create reply'} onPress={async () => { setCopyNotice(''); if (state.status === 'waiting') { if (await service.acceptAnswer(input)) setInput(''); } else if (await service.acceptOffer(input)) setInput(''); }} />
    </>}
    {!['idle', 'unsupported', 'disconnected'].includes(state.status) && <ControlButton label="Disconnect / start again" onPress={() => { service.disconnect(); setInput(''); setCopyNotice(''); }} />}
    {state.status === 'connected' && <SignalButtons connectionKey={state.peer?.identity} onSend={signal => service.send(signal)} />}
    {!!state.delivery && <Text accessibilityLiveRegion="polite" style={{ color: '#C9BADB' }}>Signal status: {state.delivery === 'received' ? 'Received by the other browser (not a read receipt)' : state.delivery}</Text>}
    {state.incoming && <Text key={state.incoming.id} accessibilityLiveRegion="assertive" style={{ color: '#FFFFFF', fontSize: 23, fontWeight: '700' }}>{state.peer?.name}: {SIGNAL_LABELS[state.incoming.signal]}</Text>}
    <Text style={{ color: '#A5B5CB', lineHeight: 20 }}>Use the same Wi-Fi or a hotspot if pairing fails. Some networks require a relay server, which is not configured. Names are self-selected, not verified identities. This connection does not measure distance or direction.</Text>
  </View>;
}
const codeStyle = { backgroundColor: '#0C192A', color: '#E4EAF4', borderWidth: 1, borderColor: '#49325F', borderRadius: 8, padding: 12, height: 88, fontSize: 12, width: '100%' };
