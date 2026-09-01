import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

function distanceLabel(friend, locationSharing) {
  if (locationSharing === 'Off') return 'Location hidden';
  if (locationSharing === 'Approximate') {
    const low = Math.max(3, friend.distance - 4);
    return `Approx. ${low}–${friend.distance + 4} m`;
  }
  return `${friend.distance} m away`;
}

export default function FriendCard({ friend, locationSharing = 'Precise', onPress }) {
  const statusColor = friend.connection === 'Strong' ? colors.green : friend.connection === 'Good' ? colors.cyan : colors.yellow;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Find ${friend.name}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.avatar, { borderColor: friend.color, backgroundColor: `${friend.color}20` }]}><Text style={[styles.avatarText, { color: friend.color }]}>{friend.name[0]}</Text></View>
      <View style={styles.copy}>
        <Text style={styles.name}>{friend.name}</Text>
        <Text style={styles.detail}>{friend.location} <Text style={styles.bullet}>•</Text> {distanceLabel(friend, locationSharing)}</Text>
        <Text style={[styles.connection, { color: statusColor }]}>{friend.sharing ? 'SHARING ON' : 'LOCATION HIDDEN'} · {friend.connection.toUpperCase()}</Text>
      </View>
      <View style={styles.status}><View style={[styles.dot, { backgroundColor: statusColor }]} /><Text style={[styles.statusText, { color: statusColor }]}>{friend.status}</Text><Text style={styles.chevron}>›</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', minHeight: 62, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, gap: 8 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '900' },
  copy: { flex: 1 },
  name: { color: colors.text, fontSize: 11, fontWeight: '900' },
  detail: { color: colors.secondary, fontSize: 8, marginTop: 2 },
  bullet: { color: colors.aqua },
  connection: { fontSize: 7, fontWeight: '900', letterSpacing: 0.35, marginTop: 3 },
  status: { alignItems: 'flex-end', gap: 2, maxWidth: 65 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 7, fontWeight: '900', textAlign: 'right' },
  chevron: { position: 'absolute', color: colors.secondary, fontSize: 22, right: -8, top: 5 },
});
