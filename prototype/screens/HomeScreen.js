import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BeatVisualizer from '../components/BeatVisualizer';
import StatusIndicator, { HapticStatus, MiniBanner } from '../components/StatusIndicator';
import { IconButton, WatchButton } from '../components/WatchButton';
import { colors } from '../theme';

function ContextChip({ icon, label, color = colors.secondary }) {
  return <View style={styles.contextChip}><Text style={[styles.contextIcon, { color }]}>{icon}</Text><Text numberOfLines={1} style={styles.contextText}>{label}</Text></View>;
}

function IncomingSignalCard({ signal, onRespond }) {
  return (
    <View style={[styles.incoming, { borderColor: `${signal.friendColor}88` }]}>
      <View style={[styles.incomingMark, { borderColor: signal.friendColor, backgroundColor: `${signal.friendColor}20` }]}><Text style={[styles.incomingIcon, { color: signal.friendColor }]}>⌁</Text></View>
      <View style={styles.incomingCopy}>
        <Text style={styles.incomingName}>{signal.friendName}</Text>
        <Text style={[styles.incomingSignal, { color: signal.friendColor }]}>{signal.signal.toUpperCase()}</Text>
        <Text style={styles.incomingDetail}>{signal.distance} m away · signal received</Text>
      </View>
      <View style={styles.incomingActions}>
        <WatchButton label="Coming" compact variant="accent" onPress={() => onRespond('Coming')} />
        <WatchButton label="Later" compact variant="quiet" onPress={() => onRespond('Later')} />
      </View>
    </View>
  );
}

export default function HomeScreen({ event, friends = [], settings, poorNetwork, beatTick, crowdAlert, lightCue, groupSignal, incomingSignal, hapticNotice, groupNotice, onNavigate, onSettings, onContext, onHelp, onRespondIncoming }) {
  const crowdTone = event.crowdLevel === 'High' ? 'pink' : event.crowdLevel === 'Medium' ? 'orange' : 'green';
  const lightLabel = settings.lights === 'Off' ? 'LIGHTS OFF' : lightCue?.mode === 'normal' ? 'LIGHT READY' : 'LIGHT ACTIVE';

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <View><Text style={styles.eyebrow}>PULSE FESTIVAL 2026</Text><Text style={styles.stage}>MAIN STAGE</Text></View>
        <View style={styles.topActions}><IconButton label="Live context" icon="◌" onPress={onContext} /><IconButton label="Help" icon="!" onPress={onHelp} /><IconButton label="Settings" icon="⚙" onPress={onSettings} /></View>
      </View>
      <StatusIndicator poorNetwork={poorNetwork} battery={event.battery} />
      <View style={styles.contextRow}>
        <ContextChip icon="●" label={`CROWD ${event.crowdLevel.toUpperCase()}`} color={event.crowdLevel === 'High' ? colors.pink : event.crowdLevel === 'Medium' ? colors.orange : colors.green} />
        <ContextChip icon="◎" label={`${friends.length} FRIENDS`} color={colors.cyan} />
        <ContextChip icon="◉" label={lightLabel} color={lightCue?.color || colors.aqua} />
      </View>
      {poorNetwork ? <MiniBanner tone="orange">NETWORK WEAK · NEARBY GROUP LINK ACTIVE</MiniBanner> : null}
      {crowdAlert && settings.crowdAlerts ? <MiniBanner tone="pink">HIGH CROWD · STAY WITH YOUR GROUP</MiniBanner> : null}
      {incomingSignal ? <IncomingSignalCard signal={incomingSignal} onRespond={onRespondIncoming} /> : null}
      {!incomingSignal && groupSignal ? <MiniBanner tone="green">{groupSignal.signal.toUpperCase()} SENT · {groupSignal.recipients.length} RECEIVED</MiniBanner> : null}
      {groupNotice ? <Text style={styles.notice}>{groupNotice}</Text> : null}
      <View style={styles.artistBlock}><Text style={styles.artist}>{event.artist}</Text><Text style={styles.song}>{event.song}</Text><Text style={styles.live}>● LIVE  /  {event.stage}</Text></View>
      <BeatVisualizer compact active={settings.lights !== 'Off'} reduced={settings.lights === 'Reduced'} beatTick={beatTick} signalColor={lightCue?.color || colors.aqua} onPress={() => onNavigate('live')} />
      <View style={styles.controls}>
        <WatchButton label="Friends" icon="◎" compact fill onPress={() => onNavigate('friends')} />
        <WatchButton label="Feel" icon="⌁" compact fill onPress={() => onNavigate('haptics')} />
        <WatchButton label="Lyrics" icon="♪" compact fill onPress={() => onNavigate('lyrics')} />
        <WatchButton label="Navigate" icon="↗" compact fill onPress={() => onNavigate('navigate')} />
      </View>
      <View style={styles.footer}><Text style={styles.group}>GROUP: <Text style={styles.groupValue}>{friends.length + 1} CONNECTED</Text></Text><HapticStatus active={settings.haptics} label={hapticNotice ? hapticNotice.label : 'HAPTIC READY'} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  topActions: { flexDirection: 'row', gap: 5 },
  eyebrow: { color: colors.aqua, fontSize: 7, fontWeight: '900', letterSpacing: 1.2 },
  stage: { color: colors.secondary, fontSize: 8, fontWeight: '800', letterSpacing: 0.7, marginTop: 3 },
  contextRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  contextChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 9, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  contextIcon: { fontSize: 9, fontWeight: '900' },
  contextText: { color: colors.secondary, fontSize: 7, fontWeight: '900', letterSpacing: 0.25 },
  artistBlock: { alignItems: 'center', marginTop: 1 },
  artist: { color: colors.text, fontSize: 23, fontWeight: '900', letterSpacing: 1 },
  song: { color: colors.violet, fontSize: 12, fontWeight: '800', marginTop: 1 },
  live: { color: colors.secondary, fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginTop: 4 },
  controls: { flexDirection: 'row', gap: 5, marginTop: -2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', gap: 4 },
  group: { color: colors.secondary, fontSize: 8, fontWeight: '900', letterSpacing: 0.35 },
  groupValue: { color: colors.aqua },
  notice: { color: colors.green, fontSize: 8, fontWeight: '900', textAlign: 'center' },
  incoming: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, borderRadius: 13, backgroundColor: colors.panel, borderWidth: 1 },
  incomingMark: { width: 29, height: 29, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  incomingIcon: { fontSize: 17, fontWeight: '900' },
  incomingCopy: { flex: 1 },
  incomingName: { color: colors.text, fontSize: 9, fontWeight: '900' },
  incomingSignal: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginTop: 2 },
  incomingDetail: { color: colors.secondary, fontSize: 7, marginTop: 2 },
  incomingActions: { width: 57, gap: 3 },
});
