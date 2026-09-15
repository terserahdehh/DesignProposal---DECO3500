import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Compass-style outlined circle for a friend on the band's outer ring.
 *
 * - Position rotates with `friend.angle + direction` like a compass needle.
 * - Border/glow brightness = proximity (brighter → nearer).
 * - Outlined (not filled) so it reads as a compass marker.
 * - Shows the friend's initial letter inside.
 */
export default function FriendLight({ friend, diameter, direction, intensity, active, connected }) {
  const angle = (friend.angle + direction) * Math.PI / 180;
  const radius = diameter * 0.422;
  const x = diameter / 2 + Math.cos(angle) * radius;
  const y = diameter / 2 + Math.sin(angle) * radius;

  // Scale the marker size: slightly larger when active so it pops.
  const size = diameter * (active ? 0.078 : 0.063);
  const borderWidth = diameter * (active ? 0.008 : 0.005);

  // Glow radius grows with intensity.
  const glowRadius = 4 + intensity * 28;
  const glowSpread = intensity * 10;

  const ringColor = connected ? friend.color : '#808680';
  const ringOpacity = connected ? 0.35 + intensity * 0.65 : 0.4;

  return <View
    testID={`light-${friend.id}`}
    accessibilityLabel={`${friend.name}, ${friend.colorName}, ${!connected ? 'disconnected' : `${Math.round(intensity * 100)} percent glow${active ? ', active' : ''}`}`}
    style={[styles.position, { left: x, top: y }]}
  >
    {/* Outer glow halo — visible only when connected */}
    {connected && <View style={[styles.halo, {
      width: size + glowRadius * 2,
      height: size + glowRadius * 2,
      borderRadius: (size + glowRadius * 2) / 2,
      left: -(size + glowRadius * 2) / 2,
      top: -(size + glowRadius * 2) / 2,
      backgroundColor: friend.color,
      opacity: intensity * 0.12,
    }]} />}

    {/* Outlined compass marker */}
    <View style={[styles.marker, {
      width: size,
      height: size,
      left: -size / 2,
      top: -size / 2,
      borderRadius: size / 2,
      borderWidth,
      borderColor: ringColor,
      opacity: ringOpacity,
      boxShadow: connected
        ? `0 0 ${glowRadius}px ${glowSpread}px ${friend.color}${Math.round(intensity * 80).toString(16).padStart(2, '0')}, inset 0 0 ${intensity * 8}px ${friend.color}${Math.round(intensity * 40).toString(16).padStart(2, '0')}`
        : 'none',
    }]}>
      {/* Friend initial letter inside the ring */}
      <Text style={[styles.initial, {
        fontSize: size * 0.38,
        color: connected ? friend.color : '#999',
        opacity: connected ? 0.5 + intensity * 0.5 : 0.5,
      }]}>{friend.name[0]}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  position: { pointerEvents: 'none', position: 'absolute', width: 0, height: 0 },
  halo: { position: 'absolute' },
  marker: {
    position: 'absolute',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
});
