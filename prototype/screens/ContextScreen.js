import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import WatchButton from '../components/WatchButton';
import { colors } from '../theme';

export default function ContextScreen({ connectionState = 'Connected', batteryLevel = 82, crowdLevel, onToggleNetwork, onCycleBattery, onBeat, onMoveFriend, onResetFriend, onCrowdAlert, onCycleCrowd, onIncomingSignal, onOpenHelp, onBack, onHome }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader title="Live Context" subtitle="WATCH-ONLY FESTIVAL CONTROLS" onBack={onBack} onHome={onHome} />
      <Text style={styles.intro}>Try the wristband’s context cues while you move through the festival.</Text>
      <View style={styles.grid}>
        <WatchButton label="Pulse Beat" icon="◉" compact fill variant="accent" onPress={onBeat} />
        <WatchButton label={`Bluetooth ${connectionState}`} icon="⌁" compact fill variant={connectionState === 'Disconnected' || connectionState === 'Weak' ? 'danger' : 'quiet'} onPress={onToggleNetwork} />
        <WatchButton label={`Battery ${batteryLevel}%`} icon="▰" compact fill variant={batteryLevel <= 18 ? 'danger' : batteryLevel <= 54 ? 'quiet' : 'default'} onPress={onCycleBattery} />
        <WatchButton label={`Crowd: ${crowdLevel}`} icon="◌" compact fill onPress={onCycleCrowd} />
        <WatchButton label="Crowd Alert" icon="!" compact fill variant="danger" onPress={onCrowdAlert} />
        <WatchButton label="Friend Closer" icon="↗" compact fill onPress={onMoveFriend} />
        <WatchButton label="Reset Friend" icon="↻" compact fill onPress={onResetFriend} />
        <WatchButton label="Incoming Signal" icon="⌁" compact fill variant="quiet" onPress={onIncomingSignal} />
        <WatchButton label="Get Help" icon="?" compact fill variant="danger" onPress={onOpenHelp} />
      </View>
      <View style={styles.status}><Text style={styles.statusTitle}>CONTEXT CHANNEL ACTIVE</Text><Text style={styles.statusCopy}>Signals, proximity, light and haptic responses stay local to this Bluetooth-style band demo.</Text></View>
      <Text style={styles.note}>No phone required · all actions are reversible simulations</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 5, paddingBottom: 4 },
  intro: { color: colors.secondary, fontSize: 9, lineHeight: 13, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  status: { padding: 9, borderRadius: 14, backgroundColor: `${colors.cyan}14`, borderWidth: 1, borderColor: `${colors.cyan}66`, marginTop: 'auto' },
  statusTitle: { color: colors.cyan, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  statusCopy: { color: colors.secondary, fontSize: 8, lineHeight: 12, marginTop: 4 },
  note: { color: colors.secondary, fontSize: 7, lineHeight: 10, textAlign: 'center', marginTop: 7 },
});
