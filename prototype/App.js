import React, { useEffect, useReducer, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, Animated, AccessibilityInfo, Platform } from 'react-native';
import { FRIENDS, OPTIONS } from './data/mockData';
import { THEME } from './theme';
import { createInitialState, simulationReducer, connectedCount } from './utils/simulation';
import { triggerHaptic, cancelHaptic } from './utils/haptics';
import FestivalBand from './components/FestivalBand';
import PrototypeControls from './components/PrototypeControls';
import Icon from './components/Icon';

const FEEDBACK_LABELS = { incoming: 'Incoming message · short pulse', send: 'Message sent · short pulse', nearby: 'Friend very near · gentle pulse', sos: 'Group SOS · alert pulse' };

function navigationHint(state) {
  switch (state.view) {
    case 'home': return ['Previous option', 'Open menu', 'Next option'];
    case 'menu': return ['Previous option', 'Select', 'Next option'];
    case 'friends': return ['Previous / back', 'Find friend', 'Next friend'];
    case 'tracking': return ['Friend list', 'Close finding', 'Next friend'];
    case 'confirm': return ['Cancel', 'Send', 'Cancel / next'];
    case 'incoming': return ['Dismiss', 'Dismiss', 'Dismiss'];
    default: return ['Main options', 'Main options', 'Main options'];
  }
}

function screenDescription(state) {
  if (state.view === 'home') return 'Home';
  if (state.view === 'menu') return OPTIONS[state.menuIndex].label;
  if (state.view === 'friends') return 'Choose a friend';
  if (state.view === 'tracking') return `Finding ${FRIENDS.find(friend => friend.id === state.targetId).name}`;
  if (state.view === 'confirm') return `${OPTIONS.find(option => option.id === state.signalId)?.label} · confirm`;
  if (state.view === 'incoming') return 'Incoming message';
  if (state.view === 'unavailable') return 'No connected friends';
  return state.result?.signalId === 'sos' ? 'Group SOS sent' : 'Message sent';
}

export default function App() {
  const [state, dispatch] = useReducer(simulationReducer, undefined, createInitialState);
  const { width } = useWindowDimensions();
  const [stageWidth, setStageWidth] = useState(650);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [hapticDelivered, setHapticDelivered] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const motion = useRef(new Animated.Value(0)).current;
  const wide = width >= 1100;
  const count = connectedCount(state);
  const hints = navigationHint(state);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; listener.remove(); };
  }, []);

  useEffect(() => {
    if (!state.feedback.type) { setFeedbackVisible(false); motion.setValue(0); cancelHaptic(); return; }
    setFeedbackVisible(true);
    setHapticDelivered(triggerHaptic(state.feedback.type, state.hapticsEnabled));
    // One small movement, never a repeating flash. Respect reduced-motion settings.
    const animation = Animated.sequence([-2, 2, -1, 0].map(value => Animated.timing(motion, { toValue: value, duration: 75, useNativeDriver: Platform.OS !== 'web' })));
    if (!reduceMotion) animation.start();
    const timeout = setTimeout(() => setFeedbackVisible(false), 1800);
    return () => { clearTimeout(timeout); animation.stop(); motion.setValue(0); cancelHaptic(); };
  }, [state.feedback.id, motion, reduceMotion]);

  useEffect(() => { if (!state.hapticsEnabled) cancelHaptic(); }, [state.hapticsEnabled]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    function onKeyDown(event) {
      const target = event.target;
      // Leave focused controls with their normal keyboard activation.
      if (target?.closest?.('button, input, textarea, select, [role="button"], [role="switch"], [contenteditable="true"]')) return;
      const button = { ArrowLeft: 'back', ArrowRight: 'next', Enter: 'ok' }[event.key];
      if (button && !event.repeat) { event.preventDefault(); dispatch({ type: 'BUTTON', button }); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return <ScrollView style={styles.page} contentContainerStyle={styles.scrollContent}>
    <View style={[styles.shell, width < 600 && styles.smallShell]}>
      <View style={styles.header}>
        <View style={styles.wordmark}><View style={styles.logo}><Icon name="pulse" size={23} color="#DEC1FF" /></View><Text style={styles.brand}>PulseBand<Text style={styles.brandPeriod}>.</Text></Text></View>
        <View style={styles.headerMeta}><Text style={styles.course}>DECO3500</Text><Text style={styles.version}>INTERACTIVE PROTOTYPE / 01</Text></View>
      </View>

      <View style={[styles.workspace, !wide && styles.stacked]}>
        <View style={[styles.main, !wide && styles.mainStacked]}>
          <View style={styles.mainHeading}>
            <View><Text style={styles.eyebrow}>FESTIVAL BAND</Text><Text accessibilityRole="header" style={[styles.heading, width < 600 && { fontSize: 29 }]}>Together, further.</Text></View>
            <View style={styles.liveTag}><Icon name="bluetooth" size={15} color="#D3B0F5" /><Text style={styles.liveText}>{'SIMULATED\nBLUETOOTH'}</Text></View>
          </View>
          <Text style={styles.intro}>Find your people. Send a signal. Stay together.</Text>

          <View style={styles.simulator}>
            <View style={styles.simulatorTop}><Text style={styles.smallCaps}>LIVE BAND SIMULATION</Text><Text style={styles.screenName}>{screenDescription(state)}</Text></View>
            <View style={styles.bandArea} onLayout={event => setStageWidth(event.nativeEvent.layout.width)}>
              <FestivalBand state={state} width={stageWidth} onButton={button => dispatch({ type: 'BUTTON', button })} motion={motion} feedbackVisible={feedbackVisible} reduceMotion={reduceMotion} />
            </View>
            <View style={styles.hintRow}>
              {['BACK', 'OK', 'NEXT'].map((name, i) => <View key={name} style={styles.hintItem}><Text style={styles.hintKey}>{i === 0 ? '◀  BACK' : i === 2 ? 'NEXT  ▶' : 'OK'}</Text><Text style={styles.hintText}>{hints[i]}</Text></View>)}
            </View>
            <View style={styles.feedbackRow} accessibilityLiveRegion="polite">
              <Icon name={feedbackVisible ? 'pulse' : 'bluetooth'} size={16} color={state.event.kind === 'sos' ? '#FCA5A5' : THEME.accent} />
              <Text style={styles.feedbackText}>{feedbackVisible ? `${FEEDBACK_LABELS[state.feedback.type]} · ${!state.hapticsEnabled ? 'haptics off · visual cue' : hapticDelivered ? 'vibration requested' : 'haptic simulated'}` : `BLUETOOTH ${state.bluetooth.toUpperCase()} · ${count} CONNECTED`}</Text>
            </View>
          </View>

          <View style={styles.circle}>
            <View style={styles.circleHeader}><Text style={styles.circleTitle}>Your festival circle</Text><Text style={styles.circleCount}>{count} of 4 connected</Text></View>
            <View style={styles.friendLegend}>
              {FRIENDS.map(friend => <View key={friend.id} style={styles.legendItem} accessibilityLabel={`${friend.name}, ${friend.colorName}, ${state.connected[friend.id] ? 'connected' : 'disconnected'}`}>
                <View style={[styles.legendDot, { backgroundColor: friend.color, opacity: state.connected[friend.id] ? 1 : 0.3, boxShadow: `0 0 12px ${friend.color}55` }]} />
                <Text style={styles.friendName}>{friend.name}</Text><Text style={[styles.friendColor, { color: friend.color }]}>{friend.colorName}</Text>
                {!state.connected[friend.id] && <Text style={styles.offline}>Offline</Text>}
              </View>)}
            </View>
            <Text style={styles.circleNote}>Follow the coloured light. It grows brighter as you get closer.</Text>
          </View>

          <View testID="demo-feedback" accessibilityLiveRegion="polite" style={[styles.event, state.event.kind === 'sos' && styles.alertEvent]}>
            <Icon name={state.event.kind === 'sos' || state.event.kind === 'warning' ? 'sos' : state.event.kind === 'success' ? 'check' : 'message'} size={19} color={state.event.kind === 'sos' ? '#FCA5A5' : '#C7B2DB'} />
            <Text style={styles.eventText}>{state.event.text}</Text>
          </View>
          <Text style={styles.note}>Digital proof-of-concept. Bluetooth, distance, battery and group messages are simulated. SOS alerts the connected group in this demo.</Text>
        </View>

        <View style={[styles.controlsColumn, !wide && styles.controlsStacked]}><PrototypeControls state={state} dispatch={dispatch} /></View>
      </View>

      <View style={styles.footer}><Text style={styles.footerText}>SOCIAL & MOBILE COMPUTING</Text><Text style={styles.footerText}>FOUR FRIENDS. FOUR COLOURS.</Text></View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: THEME.page },
  scrollContent: { alignItems: 'center', minHeight: '100%' },
  shell: { width: '100%', maxWidth: 1330, paddingHorizontal: 40, paddingTop: 26, paddingBottom: 24 },
  smallShell: { paddingHorizontal: 14, paddingTop: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1D2C42', paddingBottom: 24, marginBottom: 31, gap: 12 },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 37, height: 37, borderRadius: 11, backgroundColor: '#261B3A', borderWidth: 1, borderColor: '#6C3D91', alignItems: 'center', justifyContent: 'center' },
  brand: { color: THEME.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.8 },
  brandPeriod: { color: '#BD78EE' },
  headerMeta: { alignItems: 'flex-end', flexShrink: 1, gap: 5 },
  course: { color: '#D6DFEE', fontSize: 13, fontWeight: '700', letterSpacing: 1.4 },
  version: { color: '#91A3BB', fontSize: 10, letterSpacing: 1.5, textAlign: 'right' },
  workspace: { flexDirection: 'row', alignItems: 'flex-start', gap: 34 },
  stacked: { flexDirection: 'column', gap: 28 },
  main: { flex: 1, minWidth: 0, paddingTop: 5 },
  mainStacked: { flex: undefined, width: '100%' },
  mainHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  eyebrow: { color: '#C1A4DC', fontSize: 12, fontWeight: '700', letterSpacing: 2.6, marginBottom: 10 },
  heading: { color: THEME.text, fontSize: 39, lineHeight: 44, fontWeight: '800', letterSpacing: -1.4 },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#49325F', backgroundColor: '#191A30' },
  liveText: { color: '#D6B9F4', fontSize: 10, fontWeight: '700', lineHeight: 14, letterSpacing: 0.7 },
  intro: { color: THEME.secondary, fontSize: 16, lineHeight: 24, marginTop: 9, marginBottom: 29 },
  simulator: { borderWidth: 1, borderColor: '#203149', borderRadius: 18, backgroundColor: '#0A1626', overflow: 'hidden' },
  simulatorTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingHorizontal: 19, paddingTop: 18, alignItems: 'center' },
  smallCaps: { color: '#8E9EB6', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  screenName: { color: '#CDD7E9', fontSize: 12, fontWeight: '500', textAlign: 'right', flexShrink: 1 },
  bandArea: { width: '100%', minHeight: 280 },
  hintRow: { flexDirection: 'row', width: '100%', justifyContent: 'center', paddingHorizontal: 12, paddingBottom: 23, gap: 10 },
  hintItem: { alignItems: 'center', flex: 1, maxWidth: 160, gap: 6 },
  hintKey: { color: '#E5D6F7', fontSize: 12, letterSpacing: 1.3, fontWeight: '700' },
  hintText: { color: THEME.muted, fontSize: 12, textAlign: 'center' },
  feedbackRow: { borderTopWidth: 1, borderTopColor: '#203149', minHeight: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  feedbackText: { color: '#C9BADB', fontSize: 12, fontWeight: '500', letterSpacing: 0.3, flexShrink: 1 },
  circle: { marginTop: 24 },
  circleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  circleTitle: { color: THEME.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  circleCount: { color: THEME.muted, fontSize: 12 },
  friendLegend: { flexDirection: 'row', paddingVertical: 17, borderWidth: 1, borderColor: '#203149', borderRadius: 12, backgroundColor: '#0A1626' },
  legendItem: { flex: 1, alignItems: 'center', gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginBottom: 5 },
  friendName: { color: THEME.text, fontSize: 15, fontWeight: '600' },
  friendColor: { fontSize: 12, fontWeight: '600' },
  offline: { color: THEME.secondary, fontSize: 11 },
  circleNote: { color: '#A5B5CB', fontSize: 14, lineHeight: 21, marginTop: 14 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, padding: 14, backgroundColor: '#171C30', borderLeftWidth: 2, borderLeftColor: '#8B54B6', borderRadius: 6, minHeight: 56 },
  alertEvent: { backgroundColor: '#301C2A', borderLeftColor: '#EF4444' },
  eventText: { color: '#DCD6E7', fontSize: 14, lineHeight: 21, flex: 1 },
  note: { color: '#96A6BD', fontSize: 12, lineHeight: 19, marginTop: 13, paddingHorizontal: 3 },
  controlsColumn: { width: 374 },
  controlsStacked: { width: '100%' },
  footer: { borderTopWidth: 1, borderTopColor: '#1D2C42', marginTop: 32, paddingTop: 19, flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  footerText: { color: '#8FA2BC', fontSize: 10, letterSpacing: 1.5, flexShrink: 1 },
});
