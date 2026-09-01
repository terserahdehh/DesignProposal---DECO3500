import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import WatchButton from '../components/WatchButton';
import { colors } from '../theme';

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
      <View style={styles.mark}><Text style={styles.markGlyph}>✦</Text></View>
      <Text style={styles.wordmark}>PULSEBAND</Text>
      <View style={styles.rule} />
      <Text style={styles.welcome}>Welcome, Nayaka</Text>
      <Text style={styles.subtitle}>Ready for Pulse Festival?</Text>
      <View style={styles.setup}>
        <Text style={styles.setupLabel}>QUICK SETUP</Text>
        <View style={styles.setupRow}><WatchButton label={`Vibration ${haptics ? 'ON' : 'OFF'}`} icon="⌁" compact fill variant={haptics ? 'accent' : 'default'} onPress={onToggleHaptics} /><WatchButton label={`Lights ${lights}`} icon="◉" compact fill variant={lights === 'Off' ? 'default' : 'quiet'} onPress={onCycleLights} /></View>
        <View style={styles.setupRow}><WatchButton label="Compass" icon="◎" compact fill variant="quiet" onPress={onOpenCompass} /><WatchButton label="Navigation" icon="↗" compact fill variant="quiet" onPress={onOpenNavigate} /></View>
      </View>
      <WatchButton label="Enter Festival" icon="→" variant="accent" onPress={onEnter} />
      <Text style={styles.meta}>PULSE FESTIVAL 2026  /  WRISTBAND LINK 01</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7 },
  aura: { position: 'absolute', width: 190, height: 190, borderRadius: 100, backgroundColor: colors.aqua, shadowColor: colors.aqua, shadowOpacity: 0.7, shadowRadius: 36, shadowOffset: { width: 0, height: 0 } },
  mark: { width: 57, height: 57, borderRadius: 22, borderWidth: 1, borderColor: colors.aqua, backgroundColor: `${colors.aqua}20`, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  markGlyph: { color: colors.aqua, fontSize: 28 },
  wordmark: { color: colors.text, fontSize: 17, fontWeight: '900', letterSpacing: 3.2 },
  rule: { width: 35, height: 1, backgroundColor: colors.aqua, marginVertical: 6 },
  welcome: { color: colors.text, fontSize: 16, fontWeight: '900' },
  subtitle: { color: colors.secondary, fontSize: 10, marginBottom: 2 },
  setup: { width: '100%', padding: 8, borderRadius: 14, backgroundColor: `${colors.panel}E8`, borderWidth: 1, borderColor: colors.line, gap: 4 },
  setupLabel: { color: colors.secondary, fontSize: 7, fontWeight: '900', letterSpacing: 1, textAlign: 'center', marginBottom: 1 },
  setupRow: { flexDirection: 'row', gap: 5 },
  meta: { color: colors.secondary, fontSize: 7, letterSpacing: 1, marginTop: 2, fontWeight: '800' },
});
