import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function DirectionArrow({ close = false, heading = 45, direction = 'NORTH-EAST', target = 'TARGET', hidden = false }) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [4, -5] });
  const arrowRotation = `${heading - 45}deg`;

  if (hidden) {
    return (
      <View style={styles.hiddenWrap}>
        <View style={styles.hiddenCircle}><Text style={styles.hiddenIcon}>⌁</Text></View>
        <Text style={styles.hiddenTitle}>LOCATION HIDDEN</Text>
        <Text style={styles.hiddenCaption}>Turn on sharing to see direction</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.compassFace}>
        <Text style={[styles.marker, styles.north]}>N</Text>
        <Text style={[styles.marker, styles.east]}>E</Text>
        <Text style={[styles.marker, styles.south]}>S</Text>
        <Text style={[styles.marker, styles.west]}>W</Text>
        <Animated.View style={[styles.arrowMotion, { transform: [{ translateY }] }]}>
          <View style={[styles.arrowCircle, close && styles.closeCircle, { transform: [{ rotate: arrowRotation }] }]}>
            <Text style={styles.arrow}>↗</Text>
          </View>
        </Animated.View>
      </View>
      <View style={styles.radarLine} />
      <Text style={styles.target}>{target}</Text>
      <Text style={styles.caption}>{close ? 'SIGNAL STRONG' : direction}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', height: 176 },
  compassFace: { width: 138, height: 138, borderRadius: 80, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  arrowMotion: { alignItems: 'center', justifyContent: 'center' },
  arrowCircle: { width: 102, height: 102, borderRadius: 80, borderWidth: 2, borderColor: colors.cyan, backgroundColor: colors.screen, alignItems: 'center', justifyContent: 'center', shadowColor: colors.cyan, shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  closeCircle: { backgroundColor: colors.panelSoft, borderColor: colors.aqua, borderWidth: 2 },
  arrow: { color: colors.cyan, fontSize: 56, lineHeight: 64, fontWeight: '200', transform: [{ translateY: -3 }] },
  marker: { position: 'absolute', color: colors.secondary, fontSize: 10, fontWeight: '900', zIndex: 2 },
  north: { top: 7 },
  east: { right: 9, top: 63 },
  south: { bottom: 7 },
  west: { left: 9, top: 63 },
  radarLine: { width: 44, height: 1, backgroundColor: colors.cyan, opacity: 0.65, marginTop: 5 },
  target: { color: colors.text, fontSize: 9, letterSpacing: 0.7, fontWeight: '900', marginTop: 5, textAlign: 'center' },
  caption: { color: colors.secondary, fontSize: 8, letterSpacing: 1.1, fontWeight: '900', marginTop: 3 },
  hiddenWrap: { alignItems: 'center', justifyContent: 'center', height: 176, paddingHorizontal: 12 },
  hiddenCircle: { width: 102, height: 102, borderRadius: 60, borderWidth: 1, borderColor: colors.disabled, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  hiddenIcon: { color: colors.disabled, fontSize: 42 },
  hiddenTitle: { color: colors.secondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: 9 },
  hiddenCaption: { color: colors.muted, fontSize: 8, marginTop: 4, textAlign: 'center' },
});
