// this screen welcomes the wearer and shows how many friends are connected.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import base from './screenStyles';

export default function HomeScreen({ connected, scale }) {
  return <View style={base.center}>
    <Text style={[base.number, { fontSize: 42 * scale, lineHeight: 46 * scale }]}>20:36</Text>
    <Text style={[base.label, { fontSize: 15 * scale, letterSpacing: 0.1 }]}>GOOD VIBES FEST</Text>
    <View style={styles.row}><Icon name="friends" size={18 * scale} /><Text style={[base.secondary, { fontSize: 14 * scale, color: '#FFFFFF' }]}>{connected} CONNECTED</Text></View>
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 } });
