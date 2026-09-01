import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import DirectionArrow from '../components/DirectionArrow';
import LightCue from '../components/LightCue';
import ScreenHeader, { Toast } from '../components/ScreenHeader';
import { HapticStatus } from '../components/StatusIndicator';
import WatchButton from '../components/WatchButton';
import { colors } from '../theme';

function distanceLabel(distance, locationSharing) {
  if (locationSharing === 'Off') return 'Hidden';
  if (locationSharing === 'Approximate') return `Approx. ${Math.max(3, distance - 4)}–${distance + 4} m`;
  return `${distance} m`;
}

export default function FriendDetailScreen({ friend, distance, locationSharing, lights = 'Full', lightCue, hapticNotice, onWalk, onReset, onSignal, onBack, onHome }) {
  const [toast, setToast] = useState('');
  useEffect(() => { setToast(''); }, [friend.id]);
  const close = locationSharing !== 'Off' && distance <= 7;
  const handle = (signal, message) => { setToast(message); onSignal(signal); };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={`Finding ${friend.name}`} subtitle="FRIEND AWARENESS CHANNEL" onBack={onBack} onHome={onHome} />
      <View style={styles.friendHeading}><View style={[styles.friendDot, { backgroundColor: friend.color }]} /><Text style={styles.friendName}>{friend.name.toUpperCase()}</Text><Text style={[styles.connection, { color: friend.connection === 'Strong' ? colors.green : friend.connection === 'Good' ? colors.cyan : colors.yellow }]}>{friend.connection.toUpperCase()}</Text></View>
      <DirectionArrow close={close} hidden={locationSharing === 'Off'} heading={friend.heading} direction={friend.direction} target={friend.name.toUpperCase()} />
      <View style={styles.distance}><Text style={[styles.number, locationSharing === 'Off' && styles.hiddenNumber]}>{distanceLabel(distance, locationSharing)}</Text>{locationSharing === 'Precise' ? <Text style={styles.unit}>away</Text> : null}</View>
      <Text style={[styles.status, close && styles.closeStatus]}>{friend.status} <Text style={styles.statusDivider}>·</Text> {locationSharing === 'Off' ? 'location sharing off' : close ? 'Signal Strong' : 'Location sharing active'}</Text>
      {locationSharing !== 'Off' ? <Text style={styles.headingMeta}>HEADING {friend.heading}° · TARGET {friend.direction}</Text> : null}
      {toast ? <Toast message={toast} /> : null}
      <LightCue color={lightCue.color} mode={lightCue.mode} lights={lights} title={lightCue.title} detail={lightCue.detail} compact />
      {hapticNotice ? <HapticStatus active label={hapticNotice.label} /> : null}
      <View style={styles.buttons}><WatchButton label="Meet Me" icon="✦" fill variant="accent" onPress={() => handle('Meet Me', `Meet Me sent to ${friend.name}`)} /><WatchButton label="I'm Safe" icon="✓" fill variant="quiet" onPress={() => handle("I'm Safe", `I'm Safe sent to your group`)} /></View>
      {locationSharing !== 'Off' ? <WatchButton label={distance === 0 ? 'Reset Position' : 'Simulate Walking'} icon={distance === 0 ? '↻' : '→'} compact onPress={distance === 0 ? onReset : onWalk} /> : null}
      <Text style={styles.privacy}>{locationSharing === 'Precise' ? 'Precise direction and distance · shared with friends only' : locationSharing === 'Approximate' ? 'Approximate zone and distance · shared with friends only' : 'Location hidden from the group'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 5 },
  friendHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  friendDot: { width: 7, height: 7, borderRadius: 4 },
  friendName: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  connection: { fontSize: 7, fontWeight: '900', letterSpacing: 0.6, marginLeft: 3 },
  distance: { alignItems: 'center', justifyContent: 'center', marginTop: -3 },
  number: { color: colors.aqua, fontSize: 25, fontWeight: '900', letterSpacing: -0.5 },
  hiddenNumber: { color: colors.disabled, fontSize: 18, letterSpacing: 0 },
  unit: { color: colors.secondary, fontSize: 8, fontWeight: '800', marginTop: -2 },
  status: { color: colors.secondary, textAlign: 'center', fontSize: 8, fontWeight: '800' },
  closeStatus: { color: colors.green },
  statusDivider: { color: colors.muted },
  headingMeta: { color: colors.secondary, fontSize: 7, fontWeight: '900', letterSpacing: 0.45, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 6, marginTop: 'auto', marginBottom: 2 },
  privacy: { color: colors.secondary, fontSize: 7, lineHeight: 10, textAlign: 'center', marginTop: 3 },
});
