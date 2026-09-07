import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from './Icon';

export default function StatusBar({ bluetooth, battery, scale = 1 }) {
  return <View style={styles.row}>
    <View style={styles.status} accessibilityLabel={`Simulated Bluetooth ${bluetooth}`}>
      <Icon name="bluetooth" size={19 * scale} />
      {bluetooth === 'weak' && <Text style={[styles.weak, { fontSize: 11 * scale }]}>WEAK</Text>}
    </View>
    <View style={styles.status} accessibilityLabel={`Battery ${battery} percent${battery <= 15 ? ', low battery' : ''}`}>
      <Text style={[styles.batteryLabel, { fontSize: 12 * scale }]}>{battery <= 15 ? 'LOW ' : ''}{battery}%</Text>
      <View style={[styles.battery, { width: 24 * scale, height: 12 * scale }]}>
        <View style={[styles.fill, { width: `${battery}%` }]} />
        <View style={styles.nub} />
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', height: 24 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weak: { color: '#FFFFFF', fontWeight: '800' },
  batteryLabel: { color: '#FFFFFF', fontWeight: '600', fontVariant: ['tabular-nums'] },
  battery: { borderWidth: 1.5, borderColor: '#FFFFFF', borderRadius: 2, padding: 2, justifyContent: 'center' },
  fill: { height: '100%', backgroundColor: '#FFFFFF', maxWidth: '100%' },
  nub: { position: 'absolute', right: -4, width: 2, height: 5, backgroundColor: '#FFFFFF', borderTopRightRadius: 1, borderBottomRightRadius: 1 },
});
