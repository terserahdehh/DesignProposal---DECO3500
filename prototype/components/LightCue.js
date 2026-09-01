import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const cueSymbols = {
  normal: '◉',
  nearby: '✦',
  meet: '✦',
  safe: '✓',
  help: '!',
  break: '◌',
  received: '⌁',
  navigation: '↗',
  arrival: '✓',
  crowd: '!',
};

export default function LightCue({ color = colors.aqua, mode = 'normal', lights = 'Full', title = 'LIGHT SIGNAL READY', detail = 'Visual cue active', compact = false }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const isOff = lights === 'Off';
  const isReduced = lights === 'Reduced';

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);
    if (isOff) return undefined;

    const baseDuration = isReduced ? 1150 : 620;
    const steps = mode === 'meet'
      ? [
        Animated.timing(pulse, { toValue: 1, duration: baseDuration * 0.4, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: baseDuration * 0.25, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: baseDuration * 0.4, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: baseDuration * 0.95, useNativeDriver: true }),
      ]
      : [
        Animated.timing(pulse, { toValue: 1, duration: baseDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: baseDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ];
    const loop = Animated.loop(Animated.sequence(steps));
    loop.start();
    return () => loop.stop();
  }, [isOff, isReduced, mode, pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [isReduced ? 0.12 : 0.18, isReduced ? 0.32 : mode === 'help' ? 0.9 : mode === 'nearby' ? 0.82 : 0.62] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, mode === 'help' || mode === 'nearby' ? 1.16 : 1.08] });
  const size = compact ? 44 : 58;

  return (
    <View style={[styles.wrap, compact && styles.compactWrap]} accessibilityLabel={`${title}. ${detail}`}>
      <View style={[styles.ringWrap, { width: size, height: size }]}>
        {!isOff ? <Animated.View style={[styles.glow, { width: size, height: size, borderColor: color, shadowColor: color, opacity, transform: [{ scale }] }]} /> : null}
        <View style={[styles.core, { width: size - 10, height: size - 10, borderColor: color, backgroundColor: `${color}20` }]}>
          <Text style={[styles.symbol, { color }, compact && styles.compactSymbol]}>{cueSymbols[mode] || '◉'}</Text>
        </View>
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, { color }, compact && styles.compactTitle]}>{isOff ? 'LIGHTS OFF' : title}</Text>
        <Text numberOfLines={1} style={[styles.detail, compact && styles.compactDetail]}>{isOff ? 'Static cue only' : detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  compactWrap: { padding: 6, gap: 6, borderRadius: 13 },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', borderRadius: 999, borderWidth: 2, shadowOpacity: 0.8, shadowRadius: 15, shadowOffset: { width: 0, height: 0 } },
  core: { borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  symbol: { fontSize: 22, fontWeight: '900' },
  compactSymbol: { fontSize: 16 },
  copy: { flex: 1 },
  title: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  compactTitle: { fontSize: 8 },
  detail: { color: colors.secondary, fontSize: 9, marginTop: 3 },
  compactDetail: { fontSize: 8, marginTop: 1 },
});
