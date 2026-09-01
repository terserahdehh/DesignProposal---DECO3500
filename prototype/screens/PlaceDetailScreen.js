import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import DirectionArrow from '../components/DirectionArrow';
import LightCue from '../components/LightCue';
import ScreenHeader, { Toast } from '../components/ScreenHeader';
import WatchButton from '../components/WatchButton';
import { colors } from '../theme';

export default function PlaceDetailScreen({ place, crowdLevel, navigation, heading, lights = 'Full', lightCue, onGuide, onWalk, onTellGroup, onBack, onHome }) {
  const [notice, setNotice] = useState('');
  const isQuiet = place.id === 'quiet';
  const isArrived = navigation.arrived || navigation.distance === 0;
  const direction = isArrived ? 'ARRIVED' : place.direction;
  const tellGroup = () => { setNotice('“Taking a Break” sent to your group'); onTellGroup(); };
  const guide = () => { setNotice(navigation.active && !navigation.arrived ? 'Guidance paused' : `Guidance started to ${place.title}`); onGuide(); };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={place.title} subtitle="VENUE SIGNAL" onBack={onBack} onHome={onHome} />
      <DirectionArrow heading={heading} direction={direction} target={place.title.toUpperCase()} />
      <View style={styles.distance}><Text style={[styles.number, isArrived && styles.arrivedNumber]}>{isArrived ? '0' : navigation.distance}</Text><Text style={styles.unit}>m</Text></View>
      <Text style={[styles.route, isArrived && styles.arrivedRoute]}>{isArrived ? 'YOU HAVE ARRIVED' : navigation.active ? `${place.direction} · GUIDANCE ACTIVE` : `${place.direction} · READY TO GUIDE`}</Text>
      {!isArrived ? <Text style={styles.headingMeta}>HEADING {heading}° · TARGET {place.direction}</Text> : null}
      {isQuiet ? <View style={styles.info}><Text style={styles.infoLine}>◌  Low noise</Text><Text style={styles.infoLine}>▱  Seating available</Text><Text style={styles.infoLine}>✦  Main Stage audio available</Text></View> : <Text style={styles.detail}>{place.detail} · {crowdLevel === 'High' ? 'use the lower-crowd cue' : 'follow the arrow to arrive'}</Text>}
      {notice ? <Toast message={notice} tone={isArrived ? 'green' : 'orange'} /> : null}
      <LightCue color={isArrived ? colors.green : lightCue.color} mode={isArrived ? 'arrival' : lightCue.mode} lights={lights} title={isArrived ? 'YOU HAVE ARRIVED' : lightCue.title} detail={isArrived ? place.title : lightCue.detail} compact />
      <View style={styles.buttons}><WatchButton label={navigation.active ? 'Pause Guidance' : isArrived ? 'Guide Again' : 'Guide Me'} icon={navigation.active ? 'Ⅱ' : '↗'} fill variant="accent" onPress={guide} />{isQuiet ? <WatchButton label="Tell My Group" icon="⌁" fill variant="quiet" onPress={tellGroup} /> : null}</View>
      {navigation.active && !isArrived ? <WatchButton label={`Simulate Walking · ${navigation.distance} m left`} icon="→" compact onPress={onWalk} /> : null}
      <Text style={styles.note}>No detailed map · approximate route · crowd-aware cue: {crowdLevel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 4 },
  distance: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginTop: -3 },
  number: { color: colors.aqua, fontSize: 29, fontWeight: '900' },
  arrivedNumber: { color: colors.green },
  unit: { color: colors.secondary, fontSize: 10, fontWeight: '800', marginLeft: 5 },
  route: { color: colors.violet, fontSize: 8, letterSpacing: 0.7, fontWeight: '900', textAlign: 'center', marginTop: 1 },
  arrivedRoute: { color: colors.green },
  headingMeta: { color: colors.secondary, fontSize: 7, fontWeight: '900', letterSpacing: 0.4, textAlign: 'center', marginTop: 1 },
  info: { gap: 6, padding: 9, borderRadius: 14, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, marginTop: 6 },
  infoLine: { color: colors.text, fontSize: 9, fontWeight: '800' },
  detail: { color: colors.secondary, fontSize: 9, textAlign: 'center', marginTop: 8, lineHeight: 13 },
  buttons: { flexDirection: 'row', gap: 6, marginTop: 'auto', marginBottom: 2 },
  note: { color: colors.secondary, textAlign: 'center', fontSize: 7, lineHeight: 10 },
});
