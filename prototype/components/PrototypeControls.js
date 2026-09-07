import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { FRIENDS, DISTANCES, INTENSITIES } from '../data/mockData';
import { THEME } from '../theme';
import ControlButton from './ControlButton';

function SectionHeading({ index, children }) {
  return <View style={styles.sectionHeading}><Text style={styles.index}>{index}</Text><Text style={styles.sectionTitle}>{children}</Text></View>;
}

export default function PrototypeControls({ state, dispatch }) {
  const target = FRIENDS.find(friend => friend.id === state.targetId);
  const connectionTarget = FRIENDS.find(friend => friend.id === state.controlFriendId);
  const step = state.steps[state.targetId];
  const finding = state.view === 'tracking';
  const glowing = finding && state.connected[target.id];

  return <View testID="prototype-controls" style={styles.panel}>
    <View style={styles.panelHeader}>
      <Text accessibilityRole="header" style={styles.title}>Prototype controls</Text>
      <Text style={styles.description}>Demo inputs · outside the band</Text>
    </View>

    <View style={styles.section}>
      <SectionHeading index="01">FRIEND FINDING</SectionHeading>
      <View style={styles.targetRow}>
        <View style={styles.person}><View style={[styles.dot, { backgroundColor: target.color }]} /><Text style={styles.target}>{target.name}</Text><Text style={styles.colorName}>{target.colorName}</Text></View>
        <Text style={styles.meters}>{DISTANCES[step] === 0 ? 'Nearby' : `${DISTANCES[step]} m`}</Text>
      </View>
      <View style={styles.proximity} accessibilityLabel={`Proximity step ${step + 1} of 6. ${Math.round(INTENSITIES[step] * 100)} percent glow when finding.`}>
        {DISTANCES.map((distance, i) => <View key={i} style={styles.proximityItem}>
          <View style={[styles.bar, { backgroundColor: i <= step ? target.color : '#26374E', opacity: i <= step ? 0.55 + i * 0.09 : 1 }]} />
          <Text style={[styles.stepLabel, i === step && styles.stepActive]}>{distance === 0 ? 'Near' : `${distance}m`}</Text>
        </View>)}
      </View>
      <Text style={styles.helper}>{!finding ? 'Use OK on the band to open Find Friend.' : !state.connected[target.id] ? `${target.name} is disconnected. Reconnect below.` : `External ${target.colorName.toLowerCase()} light · ${Math.round(INTENSITIES[step] * 100)}% glow`}</Text>
      <ControlButton label={glowing && step === DISTANCES.length - 1 ? 'Simulate Walking · Nearby' : 'Simulate Walking'} accessibilityLabel="Simulate Walking" icon="walk" primary onPress={() => dispatch({ type: 'WALK' })} />
      <View style={styles.row}>
        <ControlButton label="Move Friend Direction" icon="rotate" style={styles.flex} onPress={() => dispatch({ type: 'MOVE_DIRECTION' })} />
        <ControlButton label="Reset Friend" style={styles.resetFriend} onPress={() => dispatch({ type: 'RESET_FRIEND' })} />
      </View>
    </View>

    <View style={styles.section}>
      <SectionHeading index="02">INCOMING SIGNALS</SectionHeading>
      <View style={styles.messageGrid}>
        {FRIENDS.map(friend => <ControlButton key={friend.id} accessibilityLabel={`Trigger ${friend.name} Message`} style={styles.messageButton} onPress={() => dispatch({ type: 'INCOMING', friendId: friend.id })}>
          <View style={styles.messageContent}>
            <View style={styles.person}><View style={[styles.dot, { backgroundColor: friend.color }]} /><Text style={styles.messageName}>{friend.name}</Text></View>
            <Text style={styles.messageText}>{friend.message}</Text>
          </View>
        </ControlButton>)}
      </View>
    </View>

    <View style={styles.section}>
      <SectionHeading index="03">CONNECTION & BATTERY</SectionHeading>
      <View style={styles.row}>
        <ControlButton label="Bluetooth Good" selected={state.bluetooth === 'good'} style={styles.flex} onPress={() => dispatch({ type: 'BLUETOOTH', value: 'good' })} />
        <ControlButton label="Bluetooth Weak" selected={state.bluetooth === 'weak'} style={styles.flex} onPress={() => dispatch({ type: 'BLUETOOTH', value: 'weak' })} />
      </View>
      <Text style={[styles.helper, { marginTop: 3 }]}>Choose a band to disconnect or reconnect</Text>
      <View style={styles.friendPicker}>
        {FRIENDS.map(friend => <ControlButton key={friend.id} label={friend.name} accessibilityLabel={`Connection target ${friend.name}`} selected={state.controlFriendId === friend.id} style={styles.friendChip} onPress={() => dispatch({ type: 'CONTROL_FRIEND', friendId: friend.id })} />)}
      </View>
      <Text style={styles.connectionLabel}>{connectionTarget.name} · {state.connected[connectionTarget.id] ? 'Connected' : 'Disconnected'}</Text>
      <View style={styles.row}>
        <ControlButton label="Disconnect Friend" style={styles.flex} onPress={() => dispatch({ type: 'CONNECTION', friendId: state.controlFriendId, connected: false })} />
        <ControlButton label="Reconnect Friend" style={styles.flex} onPress={() => dispatch({ type: 'CONNECTION', friendId: state.controlFriendId, connected: true })} />
      </View>
      <ControlButton label="Battery Low" icon="battery" onPress={() => dispatch({ type: 'BATTERY_LOW' })} />
    </View>

    <View style={styles.bottom}>
      <View style={styles.hapticsRow}>
        <View><Text style={styles.settingLabel}>Haptics</Text><Text style={styles.settingHint}>Visual feedback always on</Text></View>
        <Switch accessibilityLabel="Haptics" value={state.hapticsEnabled} onValueChange={enabled => dispatch({ type: 'HAPTICS', enabled })} trackColor={{ false: '#3F4C60', true: '#8A43C7' }} thumbColor="#FFFFFF" activeThumbColor="#FFFFFF" />
      </View>
      <ControlButton label="Reset Demo" icon="reset" onPress={() => dispatch({ type: 'RESET' })} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#0C192A', borderWidth: 1, borderColor: THEME.border, borderRadius: 18, overflow: 'hidden', width: '100%' },
  panelHeader: { padding: 22, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#233249' },
  title: { color: THEME.text, fontSize: 21, fontWeight: '700', letterSpacing: -0.5 },
  description: { color: THEME.muted, fontSize: 14, marginTop: 5 },
  section: { padding: 20, paddingTop: 19, borderBottomWidth: 1, borderBottomColor: '#233249', gap: 10 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  index: { color: '#AD8CCC', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  sectionTitle: { color: '#B8C5D9', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  targetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  target: { color: THEME.text, fontSize: 16, fontWeight: '700' },
  colorName: { color: THEME.muted, fontSize: 13 },
  meters: { color: THEME.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  proximity: { flexDirection: 'row', gap: 5, marginTop: 4 },
  proximityItem: { flex: 1, gap: 6 },
  bar: { height: 4, borderRadius: 2 },
  stepLabel: { color: THEME.muted, fontSize: 12, textAlign: 'center' },
  stepActive: { color: THEME.text, fontWeight: '700' },
  helper: { color: THEME.muted, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  flex: { flex: 1, paddingHorizontal: 8 },
  resetFriend: { paddingHorizontal: 10 },
  messageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  messageButton: { width: '47%', flexGrow: 1, justifyContent: 'flex-start', minHeight: 64 },
  messageContent: { gap: 6, flex: 1 },
  messageName: { color: THEME.text, fontSize: 14, fontWeight: '700' },
  messageText: { color: THEME.secondary, fontSize: 13 },
  friendPicker: { flexDirection: 'row', gap: 5 },
  friendChip: { flex: 1, paddingHorizontal: 3, minHeight: 37, paddingVertical: 7 },
  connectionLabel: { color: THEME.secondary, fontSize: 13 },
  bottom: { padding: 20, gap: 16 },
  hapticsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { color: THEME.text, fontSize: 14, fontWeight: '600' },
  settingHint: { color: THEME.muted, fontSize: 12, marginTop: 3 },
});
