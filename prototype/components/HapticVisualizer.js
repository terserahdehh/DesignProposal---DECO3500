import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function HapticVisualizer({ mode, intensity, paused, lights = 'Full' }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const lightOff = lights === 'Off';
  const reduced = lights === 'Reduced';

  useEffect(() => {
    if (paused || lightOff) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return undefined;
    }
    const isBass = mode === 'Bass';
    const isFull = mode === 'Full';
    const speed = reduced ? 1.8 : 1;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: (isBass ? 720 : isFull ? 260 : 350) * speed, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: (isBass ? 680 : isFull ? 230 : 300) * speed, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [lightOff, mode, paused, pulse, reduced]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, reduced ? 1.04 : intensity === 'Strong' ? 1.16 : intensity === 'Soft' ? 1.03 : 1.09] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0.1 : 0.18, reduced ? 0.28 : intensity === 'Strong' ? 0.62 : intensity === 'Soft' ? 0.34 : 0.48] });
  const modeColor = mode === 'Bass' ? colors.violet : mode === 'Full' ? colors.cyan : colors.aqua;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.outerWave, { borderColor: modeColor, opacity, transform: [{ scale }] }]} />
      <Animated.View style={[styles.middleWave, { borderColor: modeColor, opacity, transform: [{ scale }] }]} />
      <Animated.View style={[styles.core, { backgroundColor: modeColor, transform: [{ scale }] }]}>
        <Text style={styles.symbol}>{paused ? 'Ⅱ' : '⌁'}</Text>
        <Text style={styles.mode}>{paused ? 'PAUSED' : lightOff ? 'STATIC · LIGHTS OFF' : `${mode.toUpperCase()} · ${intensity.toUpperCase()}`}</Text>
      </Animated.View>
      <Text style={styles.caption}>{paused ? 'HAPTIC MUSIC OFF' : lightOff ? 'HAPTIC ACTIVE · STATIC VISUAL' : 'MUSIC THROUGH TOUCH'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 190, height: 190, justifyContent: 'center', alignItems: 'center' },
  outerWave: { position: 'absolute', width: 180, height: 180, borderRadius: 100, borderWidth: 1 },
  middleWave: { position: 'absolute', width: 145, height: 145, borderRadius: 100, borderWidth: 2, backgroundColor: `${colors.violet}14` },
  core: { width: 102, height: 102, borderRadius: 60, alignItems: 'center', justifyContent: 'center', shadowColor: colors.cyan, shadowOpacity: 0.7, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  symbol: { color: colors.ink, fontSize: 31, lineHeight: 35, fontWeight: '300' },
  mode: { color: colors.ink, fontSize: 8, letterSpacing: 0.65, fontWeight: '900', textAlign: 'center' },
  caption: { position: 'absolute', bottom: 0, color: colors.secondary, fontSize: 8, letterSpacing: 1.1, fontWeight: '900' },
});
