import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function FriendLight({ friend, diameter, direction, intensity, active, connected }) {
  const angle = (friend.angle + direction) * Math.PI / 180;
  const x = diameter / 2 + Math.cos(angle) * diameter * 0.422;
  const y = diameter / 2 + Math.sin(angle) * diameter * 0.422;
  const size = diameter * 0.063;
  const halo = diameter * (0.095 + intensity * 0.18);
  return <View testID={`light-${friend.id}`} accessibilityLabel={`${friend.name}, ${friend.colorName}, ${!connected ? 'disconnected' : `${Math.round(intensity * 100)} percent glow${active ? ', active' : ''}`}`} style={[styles.position, { left: x, top: y }]}>
    <View style={[styles.halo, { width: halo, height: halo, borderRadius: halo / 2, left: -halo / 2, top: -halo / 2, backgroundColor: friend.color, opacity: intensity * 0.14 }]} />
    <View style={[styles.halo, { width: halo * 0.65, height: halo * 0.65, borderRadius: halo, left: -halo * 0.325, top: -halo * 0.325, backgroundColor: friend.color, opacity: intensity * 0.2 }]} />
    <View style={[styles.lens, { width: size, height: size, left: -size / 2, top: -size / 2, borderRadius: size / 2,
      borderColor: connected ? friend.color : '#959A91', backgroundColor: connected ? friend.color : '#B5B7AE',
      opacity: connected ? 0.55 + intensity * 0.45 : 0.65,
      boxShadow: connected ? `0 0 ${4 + intensity * 25}px ${intensity * 8}px ${friend.color}, inset 0 1px 3px rgba(255,255,255,0.7)` : 'inset 0 1px 3px rgba(0,0,0,0.2)',
    }]}>
      <View style={[styles.core, { opacity: connected ? 0.15 + intensity * 0.63 : 0 }]} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  position: { pointerEvents: 'none', position: 'absolute', width: 0, height: 0 },
  halo: { position: 'absolute' },
  lens: { position: 'absolute', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  core: { width: '64%', height: '64%', borderRadius: 30, backgroundColor: '#FFFFFF' },
});
