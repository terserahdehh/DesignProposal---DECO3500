import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme';

const watchFrame = require('../static/watch.png');

export default function WatchFrame({ children, screenKey }) {
  const { width } = useWindowDimensions();
  const imageWidth = width < 600 ? Math.max(320, width - 24) : Math.min(720, Math.max(520, width * 0.52));
  const imageHeight = imageWidth * 1.5;

  // These proportions align the PulseBand UI with the black display in watch.png.
  const display = {
    left: imageWidth * 0.344,
    top: imageHeight * 0.326,
    width: imageWidth * 0.313,
    height: imageHeight * 0.256,
  };
  const contentScale = display.width / 296;

  return (
    <View style={[styles.canvas, { width: imageWidth, height: imageHeight }]}>
      <Image accessibilityLabel="Black concert watch frame" source={watchFrame} resizeMode="contain" style={styles.watchImage} />
      <View style={[styles.display, { ...display, borderRadius: display.width * 0.18 }]}>
        <View style={[styles.screenContent, { transform: [{ scale: contentScale }] }]} key={screenKey}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'relative', alignSelf: 'center' },
  watchImage: { position: 'absolute', width: '100%', height: '100%', left: 0, top: 0 },
  display: { position: 'absolute', overflow: 'hidden', borderRadius: 54, backgroundColor: colors.screen, alignItems: 'center', justifyContent: 'center' },
  screenContent: { width: 296, height: 336, paddingHorizontal: 19, paddingTop: 17, paddingBottom: 15 },
});
