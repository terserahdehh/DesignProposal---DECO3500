import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FRIENDS, OPTIONS, SOS_SIGNAL, DISTANCES } from '../data/mockData';
import { THEME } from '../theme';
import { connectedCount } from '../utils/simulation';
import StatusBar from './StatusBar';
import ScreenTransition from './ScreenTransition';
import HomeScreen from '../screens/HomeScreen';
import MenuScreen from '../screens/MenuScreen';
import FindFriendScreen from '../screens/FindFriendScreen';
import ConfirmationScreen from '../screens/ConfirmationScreen';
import IncomingMessageScreen from '../screens/IncomingMessageScreen';

export default function BandScreen({ state, diameter, reduceMotion }) {
  // Lay out text at one logical size, then scale the whole LCD, including line heights.
  const displayScale = diameter / 420;
  const scale = 1;
  const count = connectedCount(state);
  const friend = FRIENDS.find(item => item.id === state.targetId);
  let content;
  if (state.view === 'home') content = <HomeScreen connected={count} scale={scale} />;
  if (state.view === 'menu') content = <MenuScreen option={OPTIONS[state.menuIndex]} index={state.menuIndex} scale={scale} />;
  if (state.view === 'friends' || state.view === 'tracking') {
    const selected = state.view === 'friends' ? FRIENDS[state.friendIndex] : friend;
    content = <FindFriendScreen friend={selected} distance={DISTANCES[state.steps[selected.id]]} isTracking={state.view === 'tracking'} connected={state.connected[selected.id]} bluetooth={state.bluetooth} direction={state.direction} scale={scale} />;
  }
  if (['confirm', 'result', 'unavailable'].includes(state.view)) {
    content = <ConfirmationScreen signal={state.signalId === 'sos' ? SOS_SIGNAL : OPTIONS.find(option => option.id === state.signalId) || OPTIONS[0]} sosConfirmations={state.sosConfirmations} result={state.view === 'result' ? state.result : null} unavailable={state.view === 'unavailable'} connected={count} scale={scale} />;
  }
  if (state.view === 'incoming') content = <IncomingMessageScreen friend={FRIENDS.find(item => item.id === state.incomingId)} scale={scale} />;
  return <View testID="band-screen" accessibilityLiveRegion="polite" style={[styles.screen, {
    left: diameter * 0.194, top: diameter * 0.343, width: diameter * 0.612, height: diameter * 0.42,
    borderRadius: diameter * 0.034, borderWidth: 3 * displayScale,
  }]}>
    <View pointerEvents="none" style={[styles.logicalScreen, { transform: [{ scale: displayScale }] }]}>
      {state.view !== 'tracking' && <StatusBar bluetooth={state.bluetooth} battery={state.battery} scale={scale} />}
      <ScreenTransition transitionKey={`${state.view}-${state.menuIndex}-${state.friendIndex}-${state.incomingId}`} reduceMotion={reduceMotion}>
        {content}
      </ScreenTransition>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  logicalScreen: { position: 'absolute', top: 0, left: 0, width: 251.04, height: 170.4, paddingHorizontal: 15, paddingTop: 6, paddingBottom: 9, transformOrigin: 'top left' },
  screen: { position: 'absolute', zIndex: 2, backgroundColor: THEME.screen, borderWidth: 3, borderColor: '#646967', overflow: 'hidden', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.85), 0 2px 1px rgba(255,255,255,0.8)' },
});
