import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

// A uniform ring: proximity only. It deliberately points in no direction.
export default function ProximityRing({ brightness, colour, diameter }) {
  if (!Number.isFinite(brightness) || !Number.isFinite(diameter) || diameter <= 0) return null;
  const light = Math.max(0, Math.min(1, brightness));
  return <View testID="proximity-ring" pointerEvents="none" accessibilityRole="image" accessibilityLabel={`Proximity light with no direction, ${Math.round(light * 100)} percent brightness`} style={{ width: diameter, height: diameter }}>
    <Svg width={diameter} height={diameter} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="46" fill="none" stroke={colour} strokeWidth="7" opacity={light * 0.22} />
      <Circle testID="proximity-ring-light" cx="50" cy="50" r="46" fill="none" stroke={colour} strokeWidth="3" opacity={light} />
    </Svg>
  </View>;
}
