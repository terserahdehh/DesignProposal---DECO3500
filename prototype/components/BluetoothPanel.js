import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import ControlButton from './ControlButton';
const labels = { safe: "I'm Safe", toilet: 'Toilet', break: 'Taking a Break', home: 'Going Home', meet: 'Meet Me', sos: 'SOS' };
export default function BluetoothPanel({ service, hardware, friends, friendId, onFriend }) {
  const [confirmations, setConfirmations] = useState(0);
  useEffect(() => { setConfirmations(0); }, [hardware.status]);
  return <View style={{ gap: 10, padding: 18, borderWidth: 1, borderColor: '#49325F', borderRadius: 12, marginBottom: 20 }}>
    <Text accessibilityRole="header" style={{ color: '#E4EAF4', fontSize: 18, fontWeight: '700' }}>Physical Bluetooth band</Text>
    <Text accessibilityLiveRegion="polite" style={{ color: '#C9BADB', lineHeight: 21 }}>{hardware.deviceName ? `${hardware.deviceName} · ` : ''}{hardware.status}{'\n'}{hardware.message}</Text>
    <Text style={{ color: '#A5B5CB' }}>Physical band belongs to (manual test label):</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{friends.map(friend => <ControlButton key={friend.id} label={friend.name} selected={friendId === friend.id} onPress={() => { service.disconnect(); setConfirmations(0); onFriend(friend.id); }} />)}</View>
    <Text style={{ color: '#A5B5CB', lineHeight: 20 }}>Connect a compatible physical band. Browser phones cannot connect to one another. This connection is separate from simulated friends below.</Text>
    {hardware.status !== 'connected' && hardware.status !== 'connecting' && <ControlButton label="Connect Bluetooth" onPress={() => service.connect()} />}
    {['connecting', 'connected'].includes(hardware.status) && <ControlButton label="Disconnect Bluetooth" onPress={() => service.disconnect()} />}
    {hardware.status === 'connected' && <>
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
    {hardware.incoming && <Text accessibilityLiveRegion="assertive" style={{ color: '#E4EAF4', fontSize: 18 }}>Received via Bluetooth: {labels[hardware.incoming]}</Text>}
  </View>;
}
