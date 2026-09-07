import React, { useState } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import Icon from './Icon';

function HardwareButton({ name, diameter, onPress }) {
  const [focused, setFocused] = useState(false);
  const scale = diameter / 420;
  const ok = name === 'ok';
  return <View style={styles.buttonGroup}>
    <Text style={[styles.printLabel, { fontSize: 10 * scale }]}>{name.toUpperCase()}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={name === 'ok' ? 'OK' : name === 'back' ? 'Back' : 'Next'}
      hitSlop={Math.max(0, (44 - 48 * scale) / 2)} testID={`band-${name}`} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => [styles.button, { width: 48 * scale, height: 48 * scale, borderRadius: ok ? 28 : 13 },
        focused && styles.focused, pressed && styles.pressed]}>
      {ok ? <Text style={[styles.ok, { fontSize: 20 * scale }]}>OK</Text> : <Icon name={name} size={25 * scale} color="#202726" stroke={2.1} />}
    </Pressable>
  </View>;
}
export default function BandButtons({ diameter, onButton }) {
  return <View style={[styles.row, { top: diameter * 0.137, gap: diameter * 0.047 }]}>
    {['back', 'ok', 'next'].map(name => <HardwareButton key={name} name={name} diameter={diameter} onPress={() => onButton(name)} />)}
  </View>;
}
const styles = StyleSheet.create({
  row: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end' },
  buttonGroup: { alignItems: 'center', gap: 6 },
  printLabel: { color: '#62655F', fontWeight: '800', letterSpacing: 1.2 },
  button: { backgroundColor: '#EAE9E3', borderWidth: 1.5, borderColor: '#92968E', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 0 #A1A49B, 0 5px 7px rgba(39,45,38,0.24), inset 0 2px 2px rgba(255,255,255,1)' },
  focused: { borderColor: '#7335B6', outlineColor: '#7335B6', outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 3 },
  pressed: { transform: [{ translateY: 2 }], backgroundColor: '#D7D8CE', boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.22)' },
  ok: { color: '#202726', fontWeight: '800', letterSpacing: -0.5 },
});
