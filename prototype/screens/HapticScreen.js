import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticVisualizer from '../components/HapticVisualizer';
import LightCue from '../components/LightCue';
import ScreenHeader from '../components/ScreenHeader';
import { HapticStatus } from '../components/StatusIndicator';
import { SegmentedControl, WatchButton } from '../components/WatchButton';
import { colors } from '../theme';

export default function HapticScreen({ mode, intensity, paused, lights = 'Full', lightCue, hapticNotice, onMode, onIntensity, onPause, onHaptic, onBack, onHome }) {
  const [beatTick, setBeatTick] = useState(0);
  useEffect(() => {
    if (paused) return undefined;
    const interval = setInterval(() => { setBeatTick((value) => value + 1); onHaptic(mode.toLowerCase()); }, mode === 'Bass' ? 1100 : mode === 'Full' ? 650 : 720);
    return () => clearInterval(interval);
  }, [mode, paused, onHaptic]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Feel the Music" subtitle="SENSORY CHANNEL" onBack={onBack} onHome={onHome} />
      <HapticVisualizer mode={mode} intensity={intensity} paused={paused} lights={lights} />
      <View style={styles.statusRow}><HapticStatus active={!paused} label={hapticNotice ? hapticNotice.label : 'HAPTIC ACTIVE'} /><Text style={styles.beatType}>{paused ? 'PAUSED' : `${mode.toUpperCase()} · BEAT ${String(beatTick % 16).padStart(2, '0')}`}</Text></View>
      <Text style={styles.label}>PATTERN</Text>
      <View style={styles.modes}>{['Beat', 'Bass', 'Full'].map((item) => <WatchButton key={item} label={item} icon={item === 'Beat' ? '◉' : item === 'Bass' ? '▰' : '✦'} compact fill variant={mode === item ? 'accent' : 'default'} onPress={() => onMode(item)} />)}</View>
      <Text style={styles.label}>INTENSITY</Text>
      <SegmentedControl options={['Soft', 'Medium', 'Strong']} value={intensity} onChange={onIntensity} />
      <LightCue color={lightCue.color} mode={lightCue.mode} lights={lights} title={lightCue.title} detail={lightCue.detail} compact />
      <View style={styles.bottom}><WatchButton label={paused ? 'Resume Haptics' : 'Pause Haptics'} icon={paused ? '▶' : 'Ⅱ'} compact variant={paused ? 'accent' : 'quiet'} onPress={onPause} /><Text style={styles.note}>Music through touch · you are in control</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  beatType: { color: colors.secondary, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  label: { color: colors.secondary, fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 1, marginBottom: 3 },
  modes: { flexDirection: 'row', gap: 5 },
  bottom: { marginTop: 'auto', gap: 4 },
  note: { color: colors.secondary, fontSize: 8, textAlign: 'center', lineHeight: 12 },
});
