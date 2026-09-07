import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';

// Retained from the original prototype, with cleanup and reduced-motion support.
export default function ScreenTransition({ children, transitionKey, reduceMotion = false }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      offset.setValue(0);
      return undefined;
    }
    opacity.setValue(0);
    offset.setValue(4);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(offset, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [transitionKey, opacity, offset, reduceMotion]);

  return <Animated.View style={[styles.fill, { opacity, transform: [{ translateY: offset }] }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({ fill: { flex: 1, width: '100%', minHeight: 0 } });
