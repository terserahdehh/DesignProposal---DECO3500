import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import WatchButton from '../components/WatchButton';
import { colors } from '../theme';

function FingerprintMark({ onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Touch fingerprint to enter festival" onPress={onPress} style={({ pressed }) => [styles.fingerprint, pressed && styles.fingerprintPressed]}>
      {[0, 1, 2, 3, 4].map((line) => { const width = 28 + line * 9; const height = 48 + line * 9; return <View key={line} style={[styles.ridge, { width, height, left: (72 - width) / 2, top: (72 - height) / 2, borderColor: line === 0 ? colors.cyan : colors.aqua }]} />; })}
      <View style={styles.centerRidge} />
      <View style={styles.ridgeBreak} />
    </Pressable>
  );
}

export default function WelcomeScreen({ haptics, lights, onToggleHaptics, onCycleLights, onOpenCompass, onOpenNavigate, onEnter }) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (lights === 'Off') {
      glow.stopAnimation();
      glow.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: lights === 'Reduced' ? 2200 : 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: lights === 'Reduced' ? 2200 : 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glow, lights]);

  const scale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, lights === 'Reduced' ? 1.02 : 1.08] });
  const opacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.1, lights === 'Reduced' ? 0.22 : 0.4] });

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.aura, { opacity, transform: [{ scale }] }]} />
      <FingerprintMark onPress={onEnter} />
      <Text style={styles.wordmark}>PULSEBAND</Text>
      <View style={styles.rule} />
      <Text style={styles.welcome}>Welcome, Nayaka</Text>
      <Text style={styles.subtitle}>Touch the signal to enter Pulse Festival</Text>
      <View style={styles.setup}>
        <Text style={styles.setupLabel}>QUICK SETUP</Text>
        <View style={styles.setupRow}><WatchButton label={`Vibration ${haptics ? 'ON' : 'OFF'}`} icon="⌁" compact fill variant={haptics ? 'accent' : 'default'} onPress={onToggleHaptics} /><WatchButton label={`Lights ${lights}`} icon="◉" compact fill variant={lights === 'Off' ? 'default' : 'quiet'} onPress={onCycleLights} /></View>
        <View style={styles.setupRow}><WatchButton label="Compass" icon="◎" compact fill variant="quiet" onPress={onOpenCompass} /><WatchButton label="Navigation" icon="↗" compact fill variant="quiet" onPress={onOpenNavigate} /></View>
      </View>
      <WatchButton label="Touch to Enter Festival" icon="→" variant="accent" onPress={onEnter} />
      <Text style={styles.meta}>PULSE FESTIVAL 2026  /  WRISTBAND LINK 01</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7 },
  aura: { position: 'absolute', width: 190, height: 190, borderRadius: 100, backgroundColor: colors.aqua, shadowColor: colors.aqua, shadowOpacity: 0.7, shadowRadius: 36, shadowOffset: { width: 0, height: 0 } },
  fingerprint: { width: 72, height: 72, borderRadius: 27, borderWidth: 1, borderColor: colors.aqua, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 1, shadowColor: colors.aqua, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  fingerprintPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  ridge: { position: 'absolute', borderWidth: 2, borderRadius: 50, transform: [{ rotate: '-8deg' }] },
  centerRidge: { position: 'absolute', width: 7, height: 33, borderRadius: 8, borderWidth: 2, borderColor: colors.cyan, bottom: 12, transform: [{ rotate: '-8deg' }] },
  ridgeBreak: { position: 'absolute', width: 37, height: 13, borderRadius: 20, backgroundColor: colors.panel, bottom: 5, transform: [{ rotate: '-8deg' }] },
  wordmark: { color: colors.text, fontSize: 17, fontWeight: '900', letterSpacing: 3.2 },
  rule: { width: 35, height: 1, backgroundColor: colors.aqua, marginVertical: 6 },
  welcome: { color: colors.text, fontSize: 16, fontWeight: '900' },
  subtitle: { color: colors.secondary, fontSize: 10, marginBottom: 2 },
  setup: { width: '100%', padding: 8, borderRadius: 14, backgroundColor: `${colors.panel}E8`, borderWidth: 1, borderColor: colors.line, gap: 4 },
  setupLabel: { color: colors.secondary, fontSize: 7, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginBottom: 1 },
  setupRow: { flexDirection: 'row', gap: 5 },
  meta: { color: colors.secondary, fontSize: 7, letterSpacing: 1, marginTop: 2, fontWeight: '800' },
});
