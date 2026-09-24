import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import ControlButton from './ControlButton';
import { CONNECTION_HELP, connectPhysicalBand } from '../utils/connectionChoice';
const labels = { safe: "I'm Safe", toilet: 'Toilet', break: 'Taking a Break', home: 'Going Home', meet: 'Meet Me', sos: 'SOS' };
export default function BluetoothPanel({ service, hardware, friends, friendId, onFriend }) {
  const [choice, setChoice] = useState(null);
  const [confirmations, setConfirmations] = useState(0);
  useEffect(() => { setConfirmations(0); }, [hardware.status]);
  return <View style={{ gap: 10, padding: 18, borderWidth: 1, borderColor: '#49325F', borderRadius: 12, marginBottom: 20 }}>
    <Text accessibilityRole="header" style={{ color: '#E4EAF4', fontSize: 18, fontWeight: '700' }}>Connect a physical BLE device</Text>
    <Text style={{ color: '#E4EAF4', lineHeight: 22 }}>{CONNECTION_HELP}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <ControlButton label="I am using two browser laptops / phones" selected={choice === 'browser'} onPress={() => { service.disconnect(); setChoice('browser'); }} />
      <ControlButton label="I have a physical BLE device" selected={choice === 'physical'} onPress={() => setChoice('physical')} />
    </View>
    {choice === 'browser' && <Text accessibilityLiveRegion="polite" style={{ color: '#FCD34D', lineHeight: 22 }}>This setup cannot use Bluetooth between browsers. Each website is a scanner, not an advertising peripheral. Your simulated friends remain available below.</Text>}
    <Text accessibilityLiveRegion="polite" style={{ color: '#C9BADB', lineHeight: 21 }}>{hardware.deviceName ? `${hardware.deviceName} · ` : ''}{hardware.status}{'\n'}{hardware.message}</Text>
    {choice === 'physical' && <>
    <Text style={{ color: '#A5B5CB' }}>Physical device owner (label only, not discovery):</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{friends.map(friend => <ControlButton key={friend.id} label={friend.name} selected={friendId === friend.id} onPress={() => { service.disconnect(); setConfirmations(0); onFriend(friend.id); }} />)}</View>
    <Text style={{ color: '#A5B5CB', lineHeight: 20 }}>Turn on BLE advertising on the physical device. The chooser lists BLE devices, not Nayaka or Nala unless the firmware advertises those names. Signals require PulseBand firmware; connecting alone does not enable messaging.</Text>
    {hardware.status !== 'unsupported' && hardware.status !== 'connected' && hardware.status !== 'connecting' && <ControlButton label="Scan physical BLE devices" onPress={() => connectPhysicalBand(service, choice)} />}
    {['connecting', 'connected'].includes(hardware.status) && <ControlButton label="Disconnect Bluetooth" onPress={() => service.disconnect()} />}
    {hardware.status === 'connected' && hardware.canSignal && <>
      <Text style={{ color: '#E4EAF4' }}>Send to physical band</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(labels).filter(([key]) => key !== 'sos').map(([key, label]) => <ControlButton key={key} label={label} onPress={() => { setConfirmations(0); service.send(key); }} />)}
      </View>
      <ControlButton label={confirmations ? `Confirm hardware SOS ${confirmations} of 3` : 'Send hardware SOS'} onPress={() => {
        if (confirmations === 3) { setConfirmations(0); service.send('sos'); }
        else setConfirmations(confirmations + 1);
      }} />
      {confirmations > 0 && <ControlButton label="Cancel hardware SOS" onPress={() => setConfirmations(0)} />}
    </>}
    </>}
    {hardware.incoming && <Text accessibilityLiveRegion="assertive" style={{ color: '#E4EAF4', fontSize: 18 }}>Received via Bluetooth: {labels[hardware.incoming]}</Text>}
  </View>;
}
