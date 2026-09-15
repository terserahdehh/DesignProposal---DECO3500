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
  const [sosFocused, setSosFocused] = useState(false);
  const sosWidth = diameter * 0.17;
  const sosHeight = diameter * 0.12;

  return <>
    <View style={[styles.row, { top: diameter * 0.137, gap: diameter * 0.047 }]}>
      {['back', 'ok', 'next'].map(name => <HardwareButton key={name} name={name} diameter={diameter} onPress={() => onButton(name)} />)}
    </View>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="SOS"
      accessibilityHint="Opens confirmation. Press OK three times to send, or Back to cancel."
      testID="band-sos"
      onFocus={() => setSosFocused(true)}
      onBlur={() => setSosFocused(false)}
      onPress={() => onButton('sos')}
      style={({ pressed }) => [
        styles.sosHitArea,
        {
          top: diameter * 0.775,
          left: (diameter - sosWidth) / 2,
          width: sosWidth,
          height: sosHeight,
        },
        sosFocused && styles.sosFocused,
        pressed && styles.sosPressed,
      ]}
    >
      <View style={[
        styles.sosTriangle,
        {
          borderLeftWidth: sosWidth / 2,
          borderRightWidth: sosWidth / 2,
          borderBottomWidth: sosHeight,
        },
      ]} />
      <Text style={[styles.sosText, { bottom: sosHeight * 0.13, fontSize: diameter * 0.029 }]}>SOS</Text>
    </Pressable>
  </>;
}
const styles = StyleSheet.create({
  sosHitArea: { position: 'absolute', zIndex: 3, alignItems: 'center', justifyContent: 'flex-end' },
  sosTriangle: { position: 'absolute', bottom: 0, width: 0, height: 0, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#C62828', filter: 'drop-shadow(0 3px 1px #8E1919) drop-shadow(0 5px 4px rgba(0,0,0,0.24))' },
  sosText: { position: 'absolute', color: '#FFFFFF', fontWeight: '900', letterSpacing: 0.5 },
  sosFocused: { outlineColor: '#7335B6', outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 3, borderRadius: 4 },
  sosPressed: { transform: [{ translateY: 2 }], opacity: 0.82 },
  row: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end' },
  buttonGroup: { alignItems: 'center', gap: 6 },
  printLabel: { color: '#62655F', fontWeight: '800', letterSpacing: 1.2 },
  button: { backgroundColor: '#EAE9E3', borderWidth: 1.5, borderColor: '#92968E', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 0 #A1A49B, 0 5px 7px rgba(39,45,38,0.24), inset 0 2px 2px rgba(255,255,255,1)' },
  focused: { borderColor: '#7335B6', outlineColor: '#7335B6', outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 3 },
  pressed: { transform: [{ translateY: 2 }], backgroundColor: '#D7D8CE', boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.22)' },
  ok: { color: '#202726', fontWeight: '800', letterSpacing: -0.5 },
});
