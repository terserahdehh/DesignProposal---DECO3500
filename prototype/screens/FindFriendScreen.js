// this screen shows the selected friend's connection, distance, and compass direction.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import base from './screenStyles';

/**
 * Directional compass arrow pointing toward a friend.
 * The bearing is friend.angle (dummy compass heading) offset by the
 * simulated user direction, so pressing "Move Friend Direction" rotates
 * the arrow like a real compass would.
 */
function DirectionArrow({ friend, direction, distance, connected, scale }) {
  // Hide the arrow when nearby (distance 0) or disconnected.
  if (!connected || distance === 0) return null;
  // Bearing the arrow should point: friend's fixed angle, offset by the
  // user's simulated facing direction so it rotates like a compass.
  const bearing = friend.angle + direction;
  const size = 32 * scale;
  return <View style={[styles.arrowWrap, { width: size, height: size, transform: [{ rotate: `${bearing}deg` }] }]}>
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <Path d="M16 2l6 24-6-6-6 6z" fill={friend.color} opacity={0.92} />
    </Svg>
  </View>;
}

export default function FindFriendScreen({ friend, hardwareStatus, distance, isTracking, connected, bluetooth, direction = 0, scale }) {
  if (!isTracking) return <View style={base.center}>
    <Text style={[base.title, { fontSize: 25 * scale }]}>{friend.name.toUpperCase()}</Text>
    <Text style={[base.secondary, { fontSize: 15 * scale }]}>{friend.colorName.toUpperCase()}</Text>
    <Text style={[base.secondary, { fontSize: 13 * scale, marginTop: 6 }]}>{hardwareStatus ? `BLE: ${hardwareStatus.toUpperCase()}` : 'SIMULATED FRIEND'}</Text>
  </View>;

  let status = !connected ? 'DISCONNECTED' : distance === 0 ? 'FRIEND NEARBY' : bluetooth === 'weak' ? 'LINK WEAK' : 'FINDING...';
  return <View style={base.center}>
    <Text style={[base.label, { fontSize: 17 * scale }]}>{friend.name.toUpperCase()}</Text>
    <View style={styles.trackingRow}>
      <DirectionArrow friend={friend} direction={direction} distance={distance} connected={connected} scale={scale} />
      <Text style={[base.number, { fontSize: (distance === 0 && connected ? 29 : 38) * scale, lineHeight: 42 * scale }]}>{!connected ? '—' : distance <= 3 ? 'CLOSE' : distance <= 12 ? 'NEARBY' : 'FAR'}</Text>
    </View>
    <Text style={[base.secondary, { fontSize: 13 * scale }]}>{`SIM · ${status}`}</Text>
  </View>;
}

const styles = StyleSheet.create({
  trackingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrowWrap: { alignItems: 'center', justifyContent: 'center' },
});
