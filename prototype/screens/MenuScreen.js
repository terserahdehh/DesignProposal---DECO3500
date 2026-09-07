import React from 'react';
import { View, StyleSheet } from 'react-native';
import QuickSignalScreen from './QuickSignalScreen';
import SOSScreen from './SOSScreen';

export default function MenuScreen({ option, index, scale }) {
  return <View style={styles.menu}>
    {option.id === 'sos' ? <SOSScreen scale={scale} /> : <QuickSignalScreen option={option} scale={scale} />}
    <View style={styles.dots} accessibilityLabel={`Option ${index + 1} of 6`}>
      {Array.from({ length: 6 }, (_, i) => <View key={i} style={[styles.dot, index === i && styles.active]} />)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  menu: { flex: 1, width: '100%' }, dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', paddingBottom: 3, paddingTop: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#5A6676' },
  active: { width: 13, backgroundColor: '#FFFFFF' },
});
