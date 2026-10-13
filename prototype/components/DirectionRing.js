import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { arcPath, DIRECTION_ARROW_PATH } from '../utils/directionGlow';

export default function DirectionRing({ bearing, brightness, colour, diameter, arrow = false }) {
  if (!Number.isFinite(bearing) || !Number.isFinite(brightness) || !Number.isFinite(diameter) || diameter <= 0) return null;
  const light = Math.max(0, Math.min(1, brightness));
  return <View testID="direction-ring" pointerEvents="none" accessibilityRole="image" accessibilityLabel={`${arrow ? 'North-up direction' : 'Direction light'} at ${Math.round(bearing)} degrees${arrow ? ' clockwise from north' : ''}, ${Math.round(light * 100)} percent brightness`} style={{ width: diameter, height: diameter }}>
    <Svg width={diameter} height={diameter} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="46" fill="none" stroke="#96A6BD" strokeWidth="0.5" opacity="0.25" />
      <Path testID="direction-quarter-halo" d={arcPath(bearing)} fill="none" stroke={colour} strokeWidth="7" opacity={light * 0.22} strokeLinecap="round" />
      <Path testID="direction-quarter-light" d={arcPath(bearing)} fill="none" stroke={colour} strokeWidth="3" opacity={light} strokeLinecap="round" />
      {arrow && <G testID="direction-arrow-rotation" rotation={bearing} origin="50, 50"><Path testID="direction-arrow" d={DIRECTION_ARROW_PATH} fill={colour} opacity={0.95} /></G>}
    </Svg>
  </View>;
}
