import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from './WatchButton';
import { colors } from '../theme';

export default function ScreenHeader({ title, subtitle, onBack, onHome, rightIcon, onRight }) {
  return (
    <View style={styles.header}>
      <IconButton label={onBack ? 'Go back' : 'Home'} icon={onBack ? '‹' : '⌂'} onPress={onBack || onHome} />
      <View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}</View>
      {rightIcon ? <IconButton label="Open settings" icon={rightIcon} onPress={onRight} /> : <View style={styles.placeholder} />}
    </View>
  );
}

export function Toast({ message, tone = 'aqua' }) {
  const toneColor = tone === 'pink' ? colors.pink : tone === 'orange' ? colors.orange : tone === 'green' ? colors.green : colors.aqua;
  return <View style={[styles.toast, { borderColor: `${toneColor}66`, backgroundColor: `${toneColor}18` }]}><Text style={[styles.toastText, { color: toneColor }]}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 36, marginBottom: 8, gap: 8 },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },
  subtitle: { color: colors.muted, fontSize: 9, marginTop: 2 },
  placeholder: { width: 32, height: 32 },
  toast: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, marginVertical: 4 },
  toastText: { fontSize: 10, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
});
