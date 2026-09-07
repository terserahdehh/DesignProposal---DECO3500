import React from 'react';
import { View, Text } from 'react-native';
import Icon from '../components/Icon';
import base from './screenStyles';

export default function SOSScreen({ scale }) {
  return <View style={base.center}>
    <Icon name="sos" size={36 * scale} stroke={2.1} />
    <Text style={[base.title, { fontSize: 28 * scale }]}>SOS</Text>
  </View>;
}
