import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  center: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 5 },
  title: { color: '#FFFFFF', fontSize: 23, fontWeight: '800', textAlign: 'center', letterSpacing: 0.6, lineHeight: 27 },
  label: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center', letterSpacing: 0.8 },
  secondary: { color: '#CBD5E1', fontSize: 14, fontWeight: '500', textAlign: 'center', letterSpacing: 0.3 },
  number: { color: '#FFFFFF', fontSize: 38, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'], letterSpacing: -1 },
});
