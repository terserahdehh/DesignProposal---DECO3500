import React from 'react';
import { View, Text } from 'react-native';
import base from './screenStyles';

export default function IncomingMessageScreen({ friend, scale }) {
  return <View style={base.center}>
    <Text style={[base.secondary, { fontSize: 12 * scale }]}>MESSAGE RECEIVED</Text>
    <Text style={[base.label, { fontSize: 16 * scale }]}>{friend.name.toUpperCase()}</Text>
    <Text style={[base.title, { fontSize: 22 * scale, lineHeight: 25 * scale }]}>{friend.lines}</Text>
  </View>;
}
