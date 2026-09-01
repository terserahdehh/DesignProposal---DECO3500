import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import BeatVisualizer from '../components/BeatVisualizer';
import LightCue from '../components/LightCue';
import { HapticStatus } from '../components/StatusIndicator';
import WatchButton, { IconButton } from '../components/WatchButton';
import { colors } from '../theme';

export default function LiveModeScreen({ hapticsEnabled, hapticStrength, lights = 'Full', lightCue, hapticNotice, onToggleHaptics, onHaptic, onBack, onHome }) {
  const [beatTick, setBeatTick] = useState(0);
  const screenGlow = useRef(new Animated.Value(0)).current;
  const lightOff = lights === 'Off';
  const reducedLights = lights === 'Reduced';

  useEffect(() => {
    const interval = setInterval(() => {
      setBeatTick((value) => value + 1);
      if (hapticsEnabled) onHaptic(hapticStrength === 'Strong' ? 'strong' : hapticStrength === 'Soft' ? 'soft' : 'beat');
    }, reducedLights ? 1450 : 800);
    return () => clearInterval(interval);
  }, [hapticsEnabled, hapticStrength, lightOff, onHaptic, reducedLights]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(screenGlow, { toValue: 1, duration: reducedLights ? 900 : 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(screenGlow, { toValue: 0, duration: reducedLights ? 900 : 400, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    if (!lightOff) loop.start();
    return () => loop.stop();
  }, [lightOff, reducedLights, screenGlow]);

  const backgroundOpacity = screenGlow.interpolate({ inputRange: [0, 1], outputRange: [0.02, reducedLights ? 0.06 : 0.13] });

  return (
    <View style={styles.screen}>
      {!lightOff ? <Animated.View style={[styles.glow, { opacity: backgroundOpacity }]} /> : <View style={styles.offState}><Text style={styles.offIcon}>◉</Text><Text style={styles.offText}>LIGHT EFFECTS OFF · STATIC MODE</Text></View>}
      <View style={styles.header}><IconButton label="Back" icon="‹" onPress={onBack} /><View style={styles.livePill}><View style={styles.dot} /><Text style={styles.liveText}>LIVE</Text></View><IconButton label="Home" icon="⌂" onPress={onHome} /></View>
      <Text style={styles.song}>Midnight</Text><Text style={styles.artist}>LUNA</Text><Text style={styles.feel}>FEEL THE MOMENT</Text>
      <BeatVisualizer active={!lightOff} reduced={reducedLights} beatTick={beatTick} signalColor={lightCue.color} />
      <View style={styles.beatRow}><View style={styles.beatBars}>{[0, 1, 2, 3, 4].map((bar) => <Animated.View key={bar} style={[styles.bar, { height: bar === 2 ? 26 : bar % 2 ? 15 : 20, opacity: lightOff ? 0.35 : reducedLights ? 0.38 : 0.75 }]} />)}</View><Text style={styles.beatLabel}>{`BEAT  ${String(beatTick % 16).padStart(2, '0')}`}</Text></View>
      <View style={styles.statusRow}><HapticStatus active={hapticsEnabled} label={hapticNotice ? hapticNotice.label : 'HAPTIC READY'} /><Text style={styles.strength}>{hapticStrength.toUpperCase()}</Text></View>
      <LightCue color={lightCue.color} mode={lightCue.mode} lights={lights} title={lightCue.title} detail={lightCue.detail} compact />
      <View style={styles.bottom}><WatchButton label={`Haptics: ${hapticsEnabled ? 'ON' : 'OFF'}`} icon="⌁" compact variant={hapticsEnabled ? 'quiet' : 'default'} onPress={onToggleHaptics} /><Text style={styles.hint}>LIGHT + TOUCH / SCREEN-FREE</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', position: 'relative', gap: 3 },
  glow: { position: 'absolute', top: 77, width: 240, height: 180, borderRadius: 130, backgroundColor: colors.violet, shadowColor: colors.cyan, shadowOpacity: 0.8, shadowRadius: 50, shadowOffset: { width: 0, height: 0 } },
  offState: { position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center', gap: 2 },
  offIcon: { color: colors.secondary, fontSize: 16 },
  offText: { color: colors.secondary, fontSize: 7, fontWeight: '900', letterSpacing: 0.3 },
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, backgroundColor: `${colors.pink}20`, borderWidth: 1, borderColor: `${colors.pink}80` },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.pink },
  liveText: { color: colors.pink, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  song: { color: colors.text, fontSize: 23, fontWeight: '900', marginTop: 13 },
  artist: { color: colors.violet, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  feel: { color: colors.secondary, fontSize: 8, letterSpacing: 1.5, fontWeight: '900', marginTop: 4 },
  beatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -2 },
  beatBars: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 27 },
  bar: { width: 3, backgroundColor: colors.cyan, borderRadius: 4 },
  beatLabel: { color: colors.secondary, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  statusRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  strength: { color: colors.secondary, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  bottom: { width: '100%', marginTop: 'auto', gap: 4 },
  hint: { color: colors.secondary, textAlign: 'center', fontSize: 7, letterSpacing: 1, fontWeight: '900' },
});
