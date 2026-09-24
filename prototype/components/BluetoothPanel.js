import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import ControlButton from './ControlButton';
import DeviceNameEditor from './DeviceNameEditor';
import SignalButtons, { SIGNAL_LABELS } from './SignalButtons';
import { readDeviceName, saveDeviceName } from '../utils/deviceNames';
export default function BluetoothPanel({ service, hardware, friends, friendId, onFriend }) {
  const [nickname, setNickname] = useState('');
  useEffect(() => { setNickname(hardware.deviceId ? readDeviceName(`ble:${hardware.deviceId}`, hardware.deviceName) : hardware.deviceName || ''); }, [hardware.deviceId, hardware.deviceName]);
  return <View style={{ gap: 12, padding: 18, borderWidth: 1, borderColor: '#49325F', borderRadius: 12, marginBottom: 20 }}>
    <Text accessibilityRole="header" style={{ color: '#E4EAF4', fontSize: 22, fontWeight: '700' }}>Physical band · Bluetooth</Text>
    <Text style={{ color: '#A5B5CB', lineHeight: 21 }}>Connect an ESP32 or band running PulseBand firmware. For another laptop, use Browser connection above.</Text>
    {hardware.deviceName && <>
      <DeviceNameEditor key={hardware.deviceId || hardware.deviceName} name={nickname || hardware.deviceName} label="BLE DEVICE NICKNAME · IN THIS BROWSER" onSave={name => { setNickname(name); return hardware.deviceId ? saveDeviceName(`ble:${hardware.deviceId}`, name) : false; }} />
      <Text style={{ color: '#A5B5CB' }}>Advertised Bluetooth name: {hardware.deviceName}</Text>
    </>}
    <Text accessibilityLiveRegion="polite" style={{ color: '#C9BADB', lineHeight: 21 }}>{hardware.status.toUpperCase()}{'\n'}{hardware.message}</Text>
    <Text style={{ color: '#A5B5CB' }}>Band owner (local label):</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{friends.map(friend => <ControlButton key={friend.id} label={friend.name} selected={friendId === friend.id} onPress={() => { service.disconnect(); onFriend(friend.id); }} />)}</View>
    <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Suggested firmware name: PulseBand-{friends.find(friend => friend.id === friendId)?.name}</Text>
    <Text style={{ color: '#A5B5CB', lineHeight: 21 }}>Set this advertised name in your band’s firmware to see it in Chrome’s popup. A website nickname cannot rename Chrome’s device list.</Text>
    {!['unsupported', 'connected', 'connecting'].includes(hardware.status) && <>
      <ControlButton primary label="Find PulseBand device" onPress={() => service.connect()} />
      <ControlButton label="Scan all BLE devices" onPress={() => service.connect({ allDevices: true })} />
      <Text style={{ color: '#A5B5CB', lineHeight: 20 }}>The main scan filters for PulseBand names or service. Scan all also shows unrelated or unnamed devices; connecting one does not enable PulseBand signals.</Text>
    </>}
    {['connecting', 'connected'].includes(hardware.status) && <ControlButton label="Disconnect Bluetooth" onPress={() => service.disconnect()} />}
    {hardware.status === 'connected' && hardware.canSignal && <>
      <Text style={{ color: '#E4EAF4' }}>Send to {nickname || hardware.deviceName}</Text>
      <SignalButtons connectionKey={hardware.deviceId} onSend={signal => service.send(signal)} />
    </>}
    {hardware.incoming && <Text accessibilityLiveRegion="assertive" style={{ color: '#E4EAF4', fontSize: 18 }}>Received via Bluetooth: {SIGNAL_LABELS[hardware.incoming]}</Text>}
  </View>;
}
