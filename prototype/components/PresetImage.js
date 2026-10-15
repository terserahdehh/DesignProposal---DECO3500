import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { bitmapPath } from '../utils/presetImage';

export default function PresetImage({ image, size = 64, testID = 'preset-image' }) {
  return <Svg testID={testID} accessibilityLabel="Black-and-white watch image" width={size} height={size} viewBox="0 0 32 32">
    <Rect width="32" height="32" fill="#fff" />
    <Path d={bitmapPath(image)} fill="#111" />
  </Svg>;
}
