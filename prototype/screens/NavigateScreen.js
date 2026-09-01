import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import WatchButton from '../components/WatchButton';
import { places } from '../data/mockData';
import { colors } from '../theme';

export default function NavigateScreen({ crowdLevel = 'High', onSelect, onBack, onHome }) {
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Where to?" subtitle="LIGHTWEIGHT VENUE CUES" onBack={onBack} onHome={onHome} />
      <Text style={styles.intro}>Choose a destination. Follow the signal, not a map.</Text>
      {crowdLevel === 'High' ? <Text style={styles.crowdNote}>⚠ HIGH CROWD NEAR MAIN STAGE · alternative cues available</Text> : null}
      <View style={styles.grid}>{places.map((place) => <WatchButton key={place.id} label={`${place.title}\n${place.distance} m`} icon={place.icon} compact fill variant="default" onPress={() => onSelect(place)} />)}</View>
      <Text style={styles.note}>Approximate venue navigation · current crowd: {crowdLevel.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { color: colors.secondary, fontSize: 9, lineHeight: 13, marginTop: 7, marginBottom: 7 },
  crowdNote: { color: colors.yellow, fontSize: 8, lineHeight: 12, fontWeight: '800', marginBottom: 7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { color: colors.secondary, textAlign: 'center', fontSize: 8, lineHeight: 12, marginTop: 'auto' },
});
