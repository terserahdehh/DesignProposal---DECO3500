import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function BeatVisualizer({ active = true, reduced = false, compact = false, beatTick = 0, onPress, focused = false, signalColor = colors.aqua }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      glow.stopAnimation();
      pulse.setValue(0);
      glow.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: reduced ? 720 : 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: reduced ? 620 : 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: reduced ? 720 : 420, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: reduced ? 620 : 380, useNativeDriver: true }),
      ]),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, reduced, pulse, glow]);

  useEffect(() => {
    if (!active || beatTick === 0) return;
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [beatTick, active, reduced, pulse]);

  const size = compact ? 110 : 142;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1.05 : 1.12] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0.08 : 0.16, reduced ? 0.24 : 0.48] });

  return (
    <View style={[styles.wrap, { width: size + 50, height: size + 50 }]}>
      <Animated.View style={[styles.aura, { width: size + 42, height: size + 42, backgroundColor: signalColor, opacity: glowOpacity, transform: [{ scale }] }]} />
      <Animated.View style={[styles.ring, focused && styles.focusedRing, { width: size, height: size, borderColor: signalColor, transform: [{ scale }] }]}>
        <View style={styles.ringInner}>
          <Text style={[styles.note, { color: signalColor }]}>♪</Text>
          <Text style={styles.pulseText}>PULSE</Text>
        </View>
      </Animated.View>
      <Text style={styles.tapHint}>{focused ? 'OK TO OPEN' : onPress ? 'TAP TO FEEL' : 'LIVE SIGNAL'}</Text>
      {onPress ? <Pressable onPress={onPress} style={StyleSheet.absoluteFill} accessible accessibilityRole="button" accessibilityLabel="Open live mode" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  aura: { position: 'absolute', borderRadius: 999, backgroundColor: colors.aqua, shadowColor: colors.aqua, shadowOpacity: 0.8, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
  ring: { borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.aqua}14`, shadowColor: colors.aqua, shadowOpacity: 0.4, shadowRadius: 13, shadowOffset: { width: 0, height: 0 } },
  focusedRing: { borderWidth: 3, shadowOpacity: 0.9, shadowRadius: 20 },
  ringInner: { width: '72%', height: '72%', borderRadius: 999, backgroundColor: `${colors.ink}D9`, borderWidth: 1, borderColor: `${colors.text}29`, alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 33, lineHeight: 37, fontWeight: '300' },
  pulseText: { color: colors.text, fontSize: 8, letterSpacing: 2.1, fontWeight: '800' },
  tapHint: { position: 'absolute', bottom: 3, color: colors.muted, fontSize: 8, letterSpacing: 1.2, fontWeight: '800' },
});
