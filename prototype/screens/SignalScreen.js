import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import LightCue from '../components/LightCue';
import ScreenHeader, { Toast } from '../components/ScreenHeader';
import { HapticStatus } from '../components/StatusIndicator';
import WatchButton from '../components/WatchButton';
import { signalMeta, signalOptions } from '../data/mockData';
import { colors } from '../theme';

export default function SignalScreen({ friends = [], focusedSignal, physicalSignal, groupSignal, lightCue, lights = 'Full', hapticNotice, onSend, onResponse, onBack, onHome }) {
  const [sent, setSent] = useState('');
  const [response, setResponse] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (groupSignal) {
      setSent(groupSignal.signal);
      setResponse(groupSignal.response || '');
      setConfirming(false);
    }
  }, [groupSignal]);

  const choose = (signal) => {
    if (signal === 'SOS / Emergency' && confirming) { confirmSos(); return; }
    setSent(signal);
    setResponse('');
    if (signal === 'SOS / Emergency') { setConfirming(true); return; }
    setConfirming(false);
    onSend(signal);
  };
  const confirmSos = () => { setConfirming(false); onSend('SOS / Emergency'); };
  const cancelSos = () => { setSent(''); setResponse(''); setConfirming(false); };
  useEffect(() => {
    if (physicalSignal?.signal) choose(physicalSignal.signal);
  }, [physicalSignal]);
  const respond = (value) => { setResponse(value); onResponse(value); };
  const meta = sent ? signalMeta[sent] : null;
  const recipientNames = groupSignal?.signal === sent ? groupSignal.recipients : friends.map((friend) => friend.name);
  const recipients = friends.filter((friend) => recipientNames.includes(friend.name));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader title="Quick Signal" subtitle="ONE-TAP GROUP COMMUNICATION" onBack={onBack} onHome={onHome} />
      <Text style={styles.intro}>Say what you need with one tap. No typing in the crowd.</Text>
      <View style={styles.options}>{signalOptions.map((signal) => {
        const urgent = signal === 'Need Help' || signal === 'SOS / Emergency';
        const selected = sent === signal || focusedSignal === signal;
        return <View key={signal} style={styles.optionCell}><WatchButton label={signal} icon={signalMeta[signal]?.icon || '⌁'} compact fill variant={selected ? 'accent' : urgent ? 'danger' : 'default'} onPress={() => choose(signal)} /></View>;
      })}</View>
      {confirming ? <>
        <Toast message="SOS READY · CONFIRM TO SEND TO ALL BANDS" tone="pink" />
        <View style={styles.confirmPanel}><Text style={styles.confirmTitle}>SEND EMERGENCY SIGNAL?</Text><Text style={styles.confirmCopy}>This sends a red urgent cue to every connected PulseBand in your group.</Text><View style={styles.responseButtons}><WatchButton label="Cancel" compact fill onPress={cancelSos} /><WatchButton label="Confirm SOS" compact fill variant="danger" onPress={confirmSos} /></View></View>
        <LightCue color={signalMeta['SOS / Emergency'].color} mode="help" lights={lights} title="SOS STANDBY" detail="Waiting for confirmation" compact />
      </> : sent ? <>
        <Toast message={`${sent.toUpperCase()} SENT · ${recipients.length} FRIENDS RECEIVED`} tone="aqua" />
        <View style={styles.recipientPanel}>
          <Text style={styles.panelTitle}>GROUP DELIVERY</Text>
          {recipients.map((friend) => <View key={friend.id} style={styles.recipient}><View style={[styles.recipientDot, { backgroundColor: friend.color }]} /><Text style={styles.recipientName}>{friend.name}</Text><Text style={styles.received}>✓ RECEIVED</Text></View>)}
          {sent === 'Meet Me' ? <View style={styles.responseArea}><Text style={styles.responseTitle}>{response ? `RESPONSE: ${response.toUpperCase()}` : 'WAITING FOR A RESPONSE'}</Text><View style={styles.responseButtons}><WatchButton label="Coming" compact fill variant="accent" onPress={() => respond('Coming')} /><WatchButton label="Later" compact fill variant="quiet" onPress={() => respond('Later')} /><WatchButton label="Can’t Meet" compact fill onPress={() => respond("Can't Meet")} /><WatchButton label="More Time" compact fill onPress={() => respond('Need More Time')} /></View></View> : null}
        </View>
        <LightCue color={lightCue.color} mode={lightCue.mode} lights={lights} title={lightCue.title} detail={lightCue.detail} compact />
        {hapticNotice ? <HapticStatus active label={hapticNotice.label} /> : null}
      </> : <View style={styles.empty}><Text style={styles.emptyIcon}>⌁</Text><Text style={styles.emptyTitle}>GROUP CHANNEL READY</Text><Text style={styles.emptyCopy}>Your next signal will appear here with delivery confirmation.</Text></View>}
      {meta ? <Text style={[styles.footerText, { color: meta.color }]}>Light cue: {sent} · local wristband feedback active</Text> : null}
      <Text style={styles.footer}>Signals are simulated locally for this prototype.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 5, paddingBottom: 4 },
  intro: { color: colors.secondary, fontSize: 9, lineHeight: 13, marginVertical: 3 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  optionCell: { width: '48%', minHeight: 40 },
  recipientPanel: { padding: 7, borderRadius: 13, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, gap: 4 },
  confirmPanel: { padding: 9, borderRadius: 13, backgroundColor: `${colors.danger}18`, borderWidth: 1, borderColor: `${colors.danger}88`, gap: 6 },
  confirmTitle: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.45 },
  confirmCopy: { color: colors.secondary, fontSize: 8, lineHeight: 12 },
  panelTitle: { color: colors.secondary, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginBottom: 2 },
  recipient: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  recipientDot: { width: 7, height: 7, borderRadius: 4 },
  recipientName: { color: colors.text, fontSize: 9, fontWeight: '800', flex: 1 },
  received: { color: colors.green, fontSize: 7, fontWeight: '900' },
  responseArea: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 5, marginTop: 3 },
  responseTitle: { color: colors.secondary, fontSize: 7, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 },
  responseButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  emptyIcon: { color: colors.aqua, fontSize: 40 },
  emptyTitle: { color: colors.text, fontSize: 12, fontWeight: '900', marginTop: 8 },
  emptyCopy: { color: colors.secondary, fontSize: 9, lineHeight: 13, textAlign: 'center', marginTop: 6 },
  footerText: { fontSize: 7, fontWeight: '900', textAlign: 'center' },
  footer: { color: colors.muted, fontSize: 7, textAlign: 'center', marginTop: 'auto' },
});
