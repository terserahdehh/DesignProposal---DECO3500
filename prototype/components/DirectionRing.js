import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { arcPath } from '../utils/directionGlow';

export default function DirectionRing({ bearing, brightness, colour, diameter, arrow = false }) {
  return <View testID="direction-ring" pointerEvents="none" accessibilityLabel={`Direction light at ${Math.round(bearing)} degrees, ${Math.round(brightness * 100)} percent brightness`} style={{ width: diameter, height: diameter }}>
    <Svg width={diameter} height={diameter} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="46" fill="none" stroke="#96A6BD" strokeWidth="0.5" opacity="0.25" />
      <Path d={arcPath(bearing)} fill="none" stroke={colour} strokeWidth="7" opacity={brightness * 0.22} strokeLinecap="round" />
      <Path d={arcPath(bearing)} fill="none" stroke={colour} strokeWidth="3" opacity={brightness} strokeLinecap="round" />
      {arrow && <G rotation={bearing} origin="50, 50"><Path d="M50 25 L59 66 L50 57 L41 66 Z" fill={colour} opacity={brightness} /></G>}
    </Svg>
  </View>;
}
