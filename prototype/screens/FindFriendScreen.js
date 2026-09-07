import React from 'react';
import { View, Text } from 'react-native';
import base from './screenStyles';

// Deliberately no directional information, map, compass or arrows in this screen.
export default function FindFriendScreen({ friend, distance, isTracking, connected, bluetooth, scale }) {
  if (!isTracking) return <View style={base.center}>
    <Text style={[base.title, { fontSize: 25 * scale }]}>{friend.name.toUpperCase()}</Text>
    <Text style={[base.secondary, { fontSize: 15 * scale }]}>{friend.colorName.toUpperCase()}</Text>
    <Text style={[base.secondary, { fontSize: 13 * scale, marginTop: 6 }]}>{connected ? 'OK TO FIND' : 'DISCONNECTED'}</Text>
  </View>;

  let status = !connected ? 'DISCONNECTED' : distance === 0 ? 'FRIEND NEARBY' : bluetooth === 'weak' ? 'BLUETOOTH WEAK' : 'FINDING...';
  return <View style={base.center}>
    <Text style={[base.label, { fontSize: 17 * scale }]}>{friend.name.toUpperCase()}</Text>
    <Text style={[base.number, { fontSize: (distance === 0 && connected ? 29 : 38) * scale, lineHeight: 42 * scale }]}>{!connected ? '—' : distance === 0 ? 'NEARBY' : `${distance} m`}</Text>
    <Text style={[base.secondary, { fontSize: 13 * scale }]}>{status}</Text>
  </View>;
}
