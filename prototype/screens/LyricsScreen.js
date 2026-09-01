import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import WatchButton from '../components/WatchButton';
import { lyricLines } from '../data/mockData';
import { colors } from '../theme';

export default function LyricsScreen({ large, onToggleLarge, onBack, onHome }) {
  const [active, setActive] = useState(0);
  useEffect(() => { const interval = setInterval(() => setActive((line) => (line + 1) % lyricLines.length), 1450); return () => clearInterval(interval); }, []);
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Lyrics Mode" subtitle="SYNCED TO MIDNIGHT · LUNA" onBack={onBack} onHome={onHome} />
      <View style={styles.songRow}><Text style={styles.song}>Midnight</Text><Text style={styles.artist}>LUNA</Text></View>
      <View style={styles.lyrics}>{lyricLines.map((line, index) => <Text key={line} style={[styles.line, large && styles.largeLine, index === active && styles.activeLine]}>{line}</Text>)}</View>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${((active + 1) / lyricLines.length) * 100}%` }]} /></View>
      <WatchButton label={large ? 'Large Text: ON' : 'Large Text'} icon="Aa" compact variant={large ? 'accent' : 'quiet'} onPress={onToggleLarge} />
      <Text style={styles.note}>Fictional lyrics · synchronized visual cue</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  songRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 11 },
  song: { color: colors.text, fontSize: 16, fontWeight: '900' },
  artist: { color: colors.violet, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  lyrics: { flex: 1, justifyContent: 'center', gap: 11, paddingVertical: 15 },
  line: { color: colors.muted, fontSize: 15, lineHeight: 19, fontStyle: 'italic', fontWeight: '600', opacity: 0.62 },
  largeLine: { fontSize: 19, lineHeight: 23 },
  activeLine: { color: colors.aqua, opacity: 1, fontWeight: '900', textShadowColor: colors.aqua, textShadowRadius: 9 },
  progress: { height: 3, backgroundColor: colors.panelSoft, borderRadius: 2, overflow: 'hidden', marginBottom: 9 },
  progressFill: { height: '100%', backgroundColor: colors.aqua },
  note: { color: colors.muted, textAlign: 'center', fontSize: 8, marginTop: 7 },
});
