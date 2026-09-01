import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function WatchButton({ label, icon, onPress, onPressIn, onPressOut, variant = 'default', disabled = false, compact = false, fill = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.button,
        fill && styles.fill,
        compact && styles.compact,
        variant === 'accent' && styles.accent,
        variant === 'quiet' && styles.quiet,
        variant === 'danger' && styles.danger,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text numberOfLines={2} style={[styles.label, variant === 'accent' && styles.accentLabel]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ label, icon, onPress, active = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, active && styles.iconButtonActive, pressed && styles.pressed]}
    >
      <Text style={styles.iconButtonText}>{icon}</Text>
    </Pressable>
  );
}

export function SegmentedControl({ options, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option }}
          onPress={() => onChange(option)}
          style={[styles.segment, value === option && styles.segmentSelected]}
        >
          <Text style={[styles.segmentText, value === option && styles.segmentTextSelected]}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    alignSelf: 'stretch',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  fill: { flex: 1 },
  compact: { minHeight: 40, borderRadius: 15, paddingVertical: 6 },
  accent: { backgroundColor: colors.aqua, borderColor: colors.aqua },
  quiet: { backgroundColor: `${colors.aqua}14`, borderColor: `${colors.aqua}80` },
  danger: { backgroundColor: `${colors.danger}20`, borderColor: `${colors.danger}B0` },
  pressed: { opacity: 0.68, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.35 },
  icon: { color: colors.aqua, fontSize: 17, lineHeight: 18 },
  label: { color: colors.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center' },
  accentLabel: { color: colors.ink },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconButtonActive: { backgroundColor: `${colors.aqua}2A`, borderColor: colors.aqua },
  iconButtonText: { color: colors.text, fontSize: 16 },
  segmented: { flexDirection: 'row', backgroundColor: colors.panel, padding: 3, borderRadius: 14, gap: 3, borderWidth: 1, borderColor: colors.line },
  segment: { flex: 1, minHeight: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  segmentSelected: { backgroundColor: colors.aqua, borderColor: colors.text, shadowColor: colors.aqua, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  segmentText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  segmentTextSelected: { color: colors.ink },
});
