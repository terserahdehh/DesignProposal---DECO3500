import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function StatusIndicator({ poorNetwork = false, battery = 82, small = false }) {
  return (
    <View style={[styles.row, small && styles.smallRow]}>
      <View style={styles.network}>
        <View style={[styles.dot, { backgroundColor: poorNetwork ? colors.yellow : colors.green }]} />
        <Text style={styles.text}>{poorNetwork ? 'NETWORK WEAK' : 'NETWORK GOOD'}</Text>
      </View>
      <View style={styles.batteryWrap}>
        <View style={styles.battery}><View style={[styles.fill, { width: `${battery}%` }]} /></View>
        <Text style={styles.text}>{battery}%</Text>
      </View>
    </View>
  );
}

export function MiniBanner({ children, tone = 'aqua' }) {
  const toneColor = tone === 'orange' ? colors.orange : tone === 'pink' ? colors.pink : tone === 'green' ? colors.green : colors.aqua;
  return (
    <View style={[styles.banner, { borderColor: `${toneColor}66`, backgroundColor: `${toneColor}12` }]}>
      <View style={[styles.dot, { backgroundColor: toneColor }]} />
      <Text style={[styles.bannerText, { color: toneColor }]}>{children}</Text>
    </View>
  );
}

export function HapticStatus({ active = true, label = 'HAPTIC ACTIVE' }) {
  return (
    <View style={[styles.haptic, !active && styles.hapticOff]}>
      <Text style={styles.hapticIcon}>⌁</Text>
      <Text style={styles.hapticText}>{active ? label : 'HAPTIC OFF'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  smallRow: { transform: [{ scale: 0.9 }], transformOrigin: 'center' },
  network: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { color: colors.secondary, fontSize: 8, fontWeight: '900', letterSpacing: 0.45 },
  batteryWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  battery: { width: 19, height: 8, borderRadius: 3, borderWidth: 1, borderColor: colors.muted, padding: 1 },
  fill: { height: '100%', borderRadius: 2, backgroundColor: colors.aqua },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1 },
  bannerText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  haptic: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: `${colors.aqua}66`, backgroundColor: `${colors.aqua}14` },
  hapticOff: { borderColor: colors.line, backgroundColor: colors.panel },
  hapticIcon: { color: colors.aqua, fontSize: 15 },
  hapticText: { color: colors.secondary, fontSize: 8, fontWeight: '900', letterSpacing: 0.35 },
});
