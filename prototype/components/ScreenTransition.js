import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

export default function ScreenTransition({ children, transitionKey }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    opacity.setValue(0);
    offset.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 230, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(offset, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [transitionKey, opacity, offset]);

  return <Animated.View style={[styles.fill, { opacity, transform: [{ translateY: offset }] }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
