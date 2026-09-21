// this component assembles the strap, casing, screen, buttons, and friend lights.
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { FRIENDS } from '../data/mockData';
import { THEME } from '../theme';
import { lightForFriend } from '../utils/simulation';
import FriendLight from './FriendLight';
import BandButtons from './BandButtons';
import BandScreen from './BandScreen';

export default function FestivalBand({ state, width, onButton, motion, feedbackVisible, reduceMotion }) {
  const diameter = Math.min(430, Math.max(220, width - 30));
  const strapWidth = Math.min(width - 10, diameter * 1.54);
  const sos = state.view === 'result' && state.result?.signalId === 'sos';
  return <View testID="festival-band" style={[styles.stage, { height: diameter + 76 }]}>
    <View style={[styles.stageHalo, { width: diameter * 1.02, height: diameter * 1.02, borderRadius: diameter, opacity: sos ? 0.1 : 0.5, backgroundColor: sos ? THEME.red : '#132640' }]} />
    <Animated.View style={[styles.assembly, { width: strapWidth, height: diameter, transform: [{ translateX: motion }] }]}>
      <View testID="fabric-strap" style={[styles.strap, { width: strapWidth, height: diameter * 0.46, top: diameter * 0.30, borderRadius: 22 }]}>
        {Array.from({ length: 37 }, (_, i) => <View key={`h${i}`} style={[styles.weaveHorizontal, { top: `${i * 2.8}%` }]} />)}
        {Array.from({ length: 95 }, (_, i) => <View key={`v${i}`} style={[styles.weaveVertical, { left: `${i * 1.06}%` }]} />)}
        <View style={styles.stitchTop} /><View style={styles.stitchBottom} />
        {strapWidth > diameter * 1.32 && <Text style={[styles.strapLabel, { fontSize: 13, right: 17 }]}>{'FEST\nTOGETHER'}</Text>}
      </View>
      <View testID="circular-body" style={[styles.body, { width: diameter, height: diameter, borderRadius: diameter / 2, left: (strapWidth - diameter) / 2 }, sos && styles.sosBody, feedbackVisible && !sos && styles.feedbackBody]}>
        <View style={styles.innerBevel} />
        <View pointerEvents="none" style={styles.grain}>
          {Array.from({ length: 170 }, (_, i) => <View key={i} style={[styles.speckle, { left: `${(i * 43.17) % 100}%`, top: `${(i * 71.31) % 100}%` }]} />)}
        </View>
        <Text style={[styles.brand, { top: diameter * 0.087, fontSize: diameter * 0.02 }]}>P U L S E B A N D</Text>
        <BandButtons diameter={diameter} onButton={onButton} reduceMotion={reduceMotion} />
        <BandScreen state={state} diameter={diameter} reduceMotion={reduceMotion} />
        <Text style={[styles.casingText, { bottom: diameter * 0.072, fontSize: diameter * 0.021 }]}>TOGETHER, FURTHER.</Text>
        {/* Compass guide track — subtle ring the friend markers sit on */}
        <View pointerEvents="none" style={[styles.compassTrack, {
          width: diameter * 0.844, height: diameter * 0.844,
          borderRadius: diameter * 0.422,
          left: diameter * 0.078, top: diameter * 0.078,
        }]} />
        {/* Cardinal tick marks */}
        {[0, 90, 180, 270].map(deg => {
          const rad = deg * Math.PI / 180;
          const tickR = diameter * 0.422;
          const tx = diameter / 2 + Math.cos(rad) * tickR;
          const ty = diameter / 2 + Math.sin(rad) * tickR;
          return <View key={deg} pointerEvents="none" style={[styles.tick, {
            left: tx - 1, top: ty - diameter * 0.012,
            width: 2, height: diameter * 0.024,
            transform: [{ rotate: `${deg}deg` }],
          }]} />;
        })}
        {FRIENDS.map(friend => <FriendLight key={friend.id} friend={friend} diameter={diameter} direction={state.direction} connected={state.connected[friend.id]} {...lightForFriend(state, friend)} />)}
      </View>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  stageHalo: { position: 'absolute', boxShadow: '0 0 85px 35px rgba(24,48,80,0.16)' },
  assembly: { position: 'relative' },
  strap: { position: 'absolute', backgroundColor: '#626765', overflow: 'hidden', borderTopWidth: 4, borderBottomWidth: 4, borderColor: '#8B908B', boxShadow: '0 16px 20px rgba(0,0,0,0.42), inset 0 10px 13px rgba(255,255,255,0.17), inset 0 -12px 15px rgba(0,0,0,0.48)' },
  weaveHorizontal: { position: 'absolute', width: '100%', height: 2, backgroundColor: '#B4B6AC', opacity: 0.29 },
  weaveVertical: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#272E2C', opacity: 0.3 },
  stitchTop: { position: 'absolute', top: 8, width: '100%', borderBottomColor: '#C3C2B4', borderBottomWidth: 1, borderStyle: 'dashed', opacity: 0.7 },
  stitchBottom: { position: 'absolute', bottom: 8, width: '100%', borderBottomColor: '#B2B3A5', borderBottomWidth: 1, borderStyle: 'dashed', opacity: 0.6 },
  strapLabel: { position: 'absolute', top: '40%', color: '#242C2C', fontWeight: '900', lineHeight: 17, textAlign: 'center', letterSpacing: -0.4 },
  body: { position: 'absolute', top: 0, backgroundColor: THEME.body, borderWidth: 3, borderTopColor: '#FFFFFF', borderLeftColor: '#E3E4DA', borderRightColor: '#BBC0B2', borderBottomColor: '#A1A698', boxShadow: '0 22px 28px rgba(0,0,0,0.5), inset 0 4px 4px #FFFFFF, inset 0 -12px 17px rgba(72,83,58,0.23), inset 5px 0 12px rgba(255,255,255,0.9)' },
  grain: { ...StyleSheet.absoluteFillObject, borderRadius: 500, overflow: 'hidden' },
  speckle: { position: 'absolute', width: 1.4, height: 1.4, borderRadius: 1, backgroundColor: '#85877D', opacity: 0.19 },
  innerBevel: { pointerEvents: 'none', position: 'absolute', top: 9, right: 9, bottom: 9, left: 9, borderRadius: 300, borderWidth: 1, borderColor: '#E0DED3' },
  brand: { position: 'absolute', width: '100%', textAlign: 'center', color: '#9B9D90', fontWeight: '800' },
  casingText: { position: 'absolute', width: '100%', textAlign: 'center', color: '#8B8E80', letterSpacing: 1.3, fontWeight: '700' },
  compassTrack: { position: 'absolute', borderWidth: 1, borderColor: '#C8C9C0', borderStyle: 'dashed', opacity: 0.25 },
  tick: { position: 'absolute', backgroundColor: '#B0B2A8', opacity: 0.3, borderRadius: 1 },
  sosBody: { boxShadow: '0 0 0 5px rgba(239,68,68,0.65), 0 0 65px 8px rgba(239,68,68,0.4), inset 0 4px 4px #FFFFFF, inset 0 -12px 17px rgba(72,83,58,0.23)' },
  feedbackBody: { boxShadow: '0 0 0 3px rgba(201,156,255,0.55), 0 0 35px rgba(168,85,247,0.2), inset 0 4px 4px #FFFFFF, inset 0 -12px 17px rgba(72,83,58,0.23)' },
});
