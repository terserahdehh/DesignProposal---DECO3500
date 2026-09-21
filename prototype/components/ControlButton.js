// this reusable button keeps the simulator controls visually and accessibly consistent.
import React, { useState } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { THEME } from '../theme';
import Icon from './Icon';

export default function ControlButton({ label, accessibilityLabel, icon, onPress, selected, primary, style, testID, children }) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} accessibilityState={selected === undefined ? undefined : { selected }}
    testID={testID} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed, hovered }) => [styles.button, primary && styles.primary, selected && styles.selected,
      hovered && styles.hovered, focused && styles.focused, pressed && styles.pressed, style]}>
    {icon && <Icon name={icon} size={18} color={primary ? '#F4E9FF' : THEME.secondary} />}
    {children || <Text style={[styles.label, primary && styles.primaryLabel]}>{label}</Text>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 42, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: THEME.border, backgroundColor: '#122137', borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { color: '#E4EAF4', fontSize: 14, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  primary: { backgroundColor: '#7334AB', borderColor: '#A568D5' }, primaryLabel: { color: '#FFFFFF', fontWeight: '700' },
  selected: { backgroundColor: '#24314B', borderColor: '#9E7ABE' },
  hovered: { backgroundColor: '#273751', borderColor: '#9D88B2' },
  focused: { outlineColor: '#D5B4FF', outlineWidth: 2, outlineOffset: 3, outlineStyle: 'solid', borderColor: '#D5B4FF' },
  pressed: { opacity: 0.8, transform: [{ translateY: 1 }] },
});
