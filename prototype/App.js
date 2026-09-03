import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import BandFrame from './components/BandFrame';
import ScreenTransition from './components/ScreenTransition';
import { eventData, incomingSignalOptions, initialFriends, places, signalMeta, signalOptions } from './data/mockData';
import AccessibilityScreen from './screens/AccessibilityScreen';
import ContextScreen from './screens/ContextScreen';
import FriendDetailScreen from './screens/FriendDetailScreen';
import FriendsScreen from './screens/FriendsScreen';
import HapticScreen from './screens/HapticScreen';
import HelpScreen from './screens/HelpScreen';
import HomeScreen from './screens/HomeScreen';
import LyricsScreen from './screens/LyricsScreen';
import LiveModeScreen from './screens/LiveModeScreen';
import NavigateScreen from './screens/NavigateScreen';
import PlaceDetailScreen from './screens/PlaceDetailScreen';
import SignalScreen from './screens/SignalScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import { colors } from './theme';

const defaultSettings = {
  haptics: true,
  lights: 'Full',
  intensity: 'Medium',
  hapticMode: 'Beat',
  largeLyrics: false,
  crowdAlerts: true,
  location: 'Precise',
};

const homeDestinations = ['friends', 'haptics', 'lyrics', 'navigate', 'live'];
const connectionStates = ['Connected', 'Weak', 'Disconnected'];

const defaultLightCue = {
  color: colors.aqua,
  mode: 'normal',
  title: 'LIGHT SIGNAL READY',
  detail: 'Ready for group cues',
};

function friendHeading(distance, baseHeading) {
  if (distance <= 3) return 5;
  if (distance <= 7) return 18;
  if (distance <= 12) return 35;
  if (distance <= 18) return 52;
  return baseHeading;
}

function nextFriendDistance(distance) {
  if (distance <= 0) return 0;
  if (distance <= 3) return 0;
  if (distance <= 7) return 3;
  if (distance <= 12) return 7;
  return distance - 6;
}

function nextNavigationDistance(distance) {
  if (distance <= 0) return 0;
  if (distance <= 8) return 0;
  if (distance <= 18) return 8;
  return Math.max(18, distance - 12);
}

export default function App() {
  const [screen, setScreen] = useState('welcome');
  const [connectionState, setConnectionState] = useState('Connected');
  const [batteryLevel, setBatteryLevel] = useState(eventData.battery);
  const [crowdLevel, setCrowdLevel] = useState(eventData.crowdLevel);
  const [crowdAlert, setCrowdAlert] = useState(false);
  const [beatTick, setBeatTick] = useState(0);
  const [settings, setSettings] = useState(defaultSettings);
  const [selectedFriendId, setSelectedFriendId] = useState(2);
  const [friendFocusIndex, setFriendFocusIndex] = useState(1);
  const [signalFocusIndex, setSignalFocusIndex] = useState(0);
  const [signalRequest, setSignalRequest] = useState(null);
  const [placeFocusIndex, setPlaceFocusIndex] = useState(0);
  const [homeFocusIndex, setHomeFocusIndex] = useState(0);
  const [distances, setDistances] = useState(() => Object.fromEntries(initialFriends.map((friend) => [friend.id, friend.distance])));
  const [friendStatuses, setFriendStatuses] = useState(() => Object.fromEntries(initialFriends.map((friend) => [friend.id, friend.status])));
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [navigation, setNavigation] = useState({ active: false, distance: 0, arrived: false });
  const [lightCue, setLightCue] = useState(defaultLightCue);
  const [groupSignal, setGroupSignal] = useState(null);
  const [incomingSignal, setIncomingSignal] = useState(null);
  const [incomingIndex, setIncomingIndex] = useState(0);
  const [groupNotice, setGroupNotice] = useState('');
  const [hapticNotice, setHapticNotice] = useState(null);
  const lightTimer = useRef(null);
  const noticeTimer = useRef(null);
  const hapticTimer = useRef(null);

  const friends = useMemo(() => initialFriends.map((friend) => {
    const distance = distances[friend.id] ?? friend.distance;
    const moved = distance < friend.distance;
    const sharing = settings.location !== 'Off';
    const status = !sharing
      ? 'Location Hidden'
      : friendStatuses[friend.id] || (moved ? 'Moving' : friend.status);
    return {
      ...friend,
      distance,
      location: sharing ? friend.location : 'Location Hidden',
      status,
      connection: !sharing ? 'Private' : connectionState === 'Disconnected' ? 'Disconnected' : distance <= 7 ? 'Strong' : distance <= 30 ? 'Good' : 'Weak',
      heading: friendHeading(distance, friend.heading),
      sharing,
    };
  }), [connectionState, distances, friendStatuses, settings.location]);

  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId) || friends[0];

  useEffect(() => () => {
    if (lightTimer.current) clearTimeout(lightTimer.current);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (hapticTimer.current) clearTimeout(hapticTimer.current);
  }, []);

  const showNotice = (message) => {
    setGroupNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setGroupNotice(''), 4200);
  };

  const triggerLight = (mode, color, title, detail, duration = 4600) => {
    setLightCue({ mode, color, title, detail });
    if (lightTimer.current) clearTimeout(lightTimer.current);
    lightTimer.current = setTimeout(() => setLightCue(defaultLightCue), duration);
  };

  const triggerHaptic = (pattern = 'medium', force = false) => {
    if (!settings.haptics && !force) return;
    const patterns = {
      soft: [25],
      medium: [45, 55, 45],
      strong: [90, 70, 90, 70, 90],
      beat: [30],
      bass: [85],
      full: [35, 45, 80],
      arrival: [35, 60, 35],
    };
    const strength = settings.intensity === 'Soft' ? 0.7 : settings.intensity === 'Strong' ? 1.35 : 1;
    const vibration = (patterns[pattern] || patterns.medium).map((duration) => Math.round(duration * strength));
    const vibrationSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    if (vibrationSupported) {
      try { navigator.vibrate(vibration); } catch (error) { /* Browser vibration is optional. */ }
    }
    setHapticNotice({ id: Date.now(), label: vibrationSupported ? (force ? 'ALERT HAPTIC ACTIVE' : 'HAPTIC ACTIVE') : 'HAPTIC SIMULATED', pattern });
    if (hapticTimer.current) clearTimeout(hapticTimer.current);
    hapticTimer.current = setTimeout(() => setHapticNotice(null), 1500);
  };

  const updateSetting = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const goHome = () => { setSignalRequest(null); setScreen('home'); };
  const goBack = () => setScreen('home');
  const navigate = (destination) => setScreen(destination);

  const selectFriend = (friend) => {
    setSelectedFriendId(friend.id);
    setFriendFocusIndex(Math.max(0, friends.findIndex((item) => item.id === friend.id)));
    setScreen('friend-detail');
  };

  const moveFriendCloser = () => {
    const id = selectedFriendId || 1;
    const friend = friends.find((item) => item.id === id) || friends[0];
    const next = nextFriendDistance(friend.distance);
    setDistances((current) => ({ ...current, [id]: next }));
    setFriendStatuses((current) => ({ ...current, [id]: next <= 3 ? 'Nearby' : 'Moving' }));
    if (next <= 7) {
      triggerLight('nearby', friend.color, `${friend.name.toUpperCase()} NEARBY`, next === 0 ? 'Arrived · signal strong' : 'Signal getting stronger');
      triggerHaptic(next === 0 ? 'arrival' : 'medium', true);
    }
  };

  const resetFriend = () => {
    const friend = initialFriends.find((item) => item.id === selectedFriendId);
    if (!friend) return;
    setDistances((current) => ({ ...current, [friend.id]: friend.distance }));
    setFriendStatuses((current) => ({ ...current, [friend.id]: friend.status }));
    triggerLight('normal', colors.aqua, 'LIGHT SIGNAL READY', 'Friend simulation reset');
  };

  const handleSignal = (signal, targetFriend = null) => {
    const meta = signalMeta[signal] || signalMeta["I'm Safe"];
    const recipients = targetFriend ? [targetFriend] : friends;
    setGroupSignal({
      signal,
      targetName: targetFriend ? targetFriend.name : null,
      recipients: recipients.map((friend) => friend.name),
      response: null,
    });
    if (targetFriend && signal === 'Meet Me') {
      setFriendStatuses((current) => ({ ...current, [targetFriend.id]: 'Wants to Meet' }));
    }
    triggerLight(meta.lightMode, meta.color, `${signal.toUpperCase()} SENT`, `${recipients.map((friend) => friend.name).join(', ')} received it`);
    triggerHaptic(meta.haptic, true);
  };

  const handleSignalResponse = (response) => {
    setGroupSignal((current) => current ? { ...current, response } : current);
    showNotice(`Group response: ${response}`);
    triggerLight('safe', colors.green, 'RESPONSE RECEIVED', response);
    triggerHaptic('medium', true);
  };

  const triggerIncomingSignal = () => {
    const sample = incomingSignalOptions[incomingIndex % incomingSignalOptions.length];
    const friend = initialFriends.find((item) => item.id === sample.friendId) || initialFriends[0];
    const meta = signalMeta[sample.signal];
    setIncomingIndex((current) => current + 1);
    setIncomingSignal({ ...sample, friendName: friend.name, friendColor: friend.color, distance: distances[friend.id] });
    setScreen('home');
    triggerLight('received', friend.color, `${friend.name.toUpperCase()} SIGNAL`, sample.signal);
    triggerHaptic(meta ? meta.haptic : 'medium', true);
  };

  const respondToIncoming = (response) => {
    if (!incomingSignal) return;
    const friend = friends.find((item) => item.id === incomingSignal.friendId);
    setIncomingSignal(null);
    if (friend) setFriendStatuses((current) => ({ ...current, [friend.id]: response === 'Coming' ? 'Moving' : 'Safe' }));
    showNotice(`${incomingSignal.friendName} received “${response}”`);
    triggerLight(response === 'Coming' ? 'meet' : 'safe', response === 'Coming' ? colors.violet : colors.green, 'RESPONSE SENT', `${incomingSignal.friendName} · ${response}`);
    triggerHaptic('medium', true);
  };

  const selectPlace = (place) => {
    setPlaceFocusIndex(Math.max(0, places.findIndex((item) => item.id === place.id)));
    setSelectedPlace(place);
    setNavigation({ active: false, distance: place.distance, arrived: place.distance === 0 });
    setScreen('place-detail');
  };

  const toggleNavigation = () => {
    if (!selectedPlace) return;
    if (navigation.active && !navigation.arrived) {
      setNavigation((current) => ({ ...current, active: false }));
      showNotice('Guidance paused');
      return;
    }
    setNavigation({ active: true, distance: selectedPlace.distance, arrived: selectedPlace.distance === 0 });
    triggerLight('navigation', selectedPlace.accent, 'GUIDANCE ACTIVE', `${selectedPlace.title} · follow the arrow`);
    triggerHaptic('soft');
  };

  const moveNavigation = () => {
    if (!selectedPlace || !navigation.active) return;
    const next = nextNavigationDistance(navigation.distance);
    setNavigation({ active: true, distance: next, arrived: next === 0 });
    if (next === 0) {
      triggerLight('arrival', colors.green, 'YOU HAVE ARRIVED', selectedPlace.title);
      triggerHaptic('arrival', true);
    } else {
      triggerLight('navigation', selectedPlace.accent, 'GUIDANCE ACTIVE', `${next} m remaining`);
    }
  };

  const tellGroupTakingBreak = () => {
    handleSignal('Taking a Break');
    showNotice('“Taking a Break” sent to your group');
  };

  const cycleCrowd = () => {
    const levels = ['Low', 'Medium', 'High'];
    const next = levels[(levels.indexOf(crowdLevel) + 1) % levels.length];
    setCrowdLevel(next);
    setCrowdAlert(next === 'High');
    if (next === 'High') {
      triggerLight('crowd', colors.orange, 'HIGH CROWD', 'Stay with your group');
      triggerHaptic('medium', true);
    } else showNotice(`Crowd level set to ${next}`);
  };

  const cycleBattery = () => {
    const levels = [82, 54, 18];
    const next = levels[(levels.indexOf(batteryLevel) + 1) % levels.length];
    setBatteryLevel(next);
    showNotice(`Battery simulation set to ${next}%`);
  };

  const triggerCrowdAlert = () => {
    setCrowdLevel('High');
    setCrowdAlert(true);
    triggerLight('crowd', colors.orange, 'HIGH CROWD', 'Stay with your group');
    triggerHaptic('medium', true);
  };

  const resetDemo = () => {
    setScreen('welcome');
    setConnectionState('Connected');
    setBatteryLevel(eventData.battery);
    setCrowdLevel(eventData.crowdLevel);
    setCrowdAlert(false);
    setBeatTick(0);
    setSettings(defaultSettings);
    setSelectedFriendId(2);
    setFriendFocusIndex(1);
    setSignalFocusIndex(0);
    setSignalRequest(null);
    setPlaceFocusIndex(0);
    setHomeFocusIndex(0);
    setDistances(Object.fromEntries(initialFriends.map((friend) => [friend.id, friend.distance])));
    setFriendStatuses(Object.fromEntries(initialFriends.map((friend) => [friend.id, friend.status])));
    setSelectedPlace(null);
    setNavigation({ active: false, distance: 0, arrived: false });
    setGroupSignal(null);
    setIncomingSignal(null);
    setGroupNotice('');
    setLightCue(defaultLightCue);
    setHapticNotice(null);
  };

  const event = { ...eventData, battery: batteryLevel, crowdLevel, network: `Bluetooth ${connectionState}` };
  const poorNetwork = connectionState !== 'Connected';
  const navHeading = selectedPlace && selectedPlace.distance > 0
    ? Math.max(5, Math.round(5 + ((selectedPlace.heading - 5) * navigation.distance) / selectedPlace.distance))
    : 0;

  const physicalBack = () => {
    if (screen === 'welcome') return;
    if (screen === 'friend-detail') { setScreen('friends'); return; }
    if (screen === 'signals') { setSignalRequest(null); setScreen('friends'); return; }
    if (screen === 'place-detail') { setScreen('navigate'); return; }
    setScreen('home');
  };

  const physicalNext = () => {
    if (screen === 'welcome') { updateSetting('lights', settings.lights === 'Full' ? 'Reduced' : settings.lights === 'Reduced' ? 'Off' : 'Full'); return; }
    if (screen === 'home') { setHomeFocusIndex((current) => (current + 1) % homeDestinations.length); return; }
    if (screen === 'friends') { setFriendFocusIndex((current) => (current + 1) % friends.length); return; }
    if (screen === 'friend-detail') { moveFriendCloser(); return; }
    if (screen === 'signals') { setSignalFocusIndex((current) => (current + 1) % signalOptions.length); return; }
    if (screen === 'navigate') { setPlaceFocusIndex((current) => (current + 1) % places.length); return; }
    if (screen === 'place-detail') { if (navigation.active && !navigation.arrived) moveNavigation(); else toggleNavigation(); return; }
    if (screen === 'haptics') {
      const modes = ['Beat', 'Bass', 'Full'];
      updateSetting('hapticMode', modes[(modes.indexOf(settings.hapticMode || 'Beat') + 1) % modes.length]);
      return;
    }
    if (screen === 'lyrics') { updateSetting('largeLyrics', !settings.largeLyrics); return; }
    if (screen === 'settings') { updateSetting('haptics', !settings.haptics); return; }
    if (screen === 'context') { cycleCrowd(); return; }
    if (screen === 'live') { triggerHaptic('beat'); }
  };

  const physicalOk = () => {
    if (screen === 'welcome') { setScreen('home'); return; }
    if (screen === 'home') { setScreen(homeDestinations[homeFocusIndex]); return; }
    if (screen === 'friends') { selectFriend(friends[friendFocusIndex] || friends[0]); return; }
    if (screen === 'friend-detail') { handleSignal('Meet Me', selectedFriend); return; }
    if (screen === 'signals') { setSignalRequest({ signal: signalOptions[signalFocusIndex], token: Date.now() }); return; }
    if (screen === 'navigate') { selectPlace(places[placeFocusIndex] || places[0]); return; }
    if (screen === 'place-detail') { toggleNavigation(); return; }
    if (screen === 'live') { triggerHaptic('beat'); return; }
    if (screen === 'haptics') { updateSetting('haptics', !settings.haptics); return; }
    if (screen === 'lyrics') { updateSetting('largeLyrics', !settings.largeLyrics); return; }
    if (screen === 'settings') { updateSetting('lights', settings.lights === 'Full' ? 'Reduced' : settings.lights === 'Reduced' ? 'Off' : 'Full'); return; }
    if (screen === 'context') { triggerIncomingSignal(); }
  };

  const content = (() => {
    switch (screen) {
      case 'welcome': return <WelcomeScreen haptics={settings.haptics} lights={settings.lights} onToggleHaptics={() => updateSetting('haptics', !settings.haptics)} onCycleLights={() => updateSetting('lights', settings.lights === 'Full' ? 'Reduced' : settings.lights === 'Reduced' ? 'Off' : 'Full')} onOpenCompass={() => setScreen('friend-detail')} onOpenNavigate={() => setScreen('navigate')} onEnter={() => setScreen('home')} />;
      case 'home': return <HomeScreen event={event} friends={friends} settings={settings} homeFocusIndex={homeFocusIndex} connectionState={connectionState} poorNetwork={poorNetwork} crowdAlert={crowdAlert} beatTick={beatTick} lightCue={lightCue} groupSignal={groupSignal} incomingSignal={incomingSignal} hapticNotice={hapticNotice} groupNotice={groupNotice} onNavigate={navigate} onSettings={() => setScreen('settings')} onContext={() => setScreen('context')} onHelp={() => setScreen('help')} onRespondIncoming={respondToIncoming} />;
      case 'live': return <LiveModeScreen hapticsEnabled={settings.haptics} hapticStrength={settings.intensity} lights={settings.lights} lightCue={lightCue} hapticNotice={hapticNotice} onToggleHaptics={() => updateSetting('haptics', !settings.haptics)} onHaptic={triggerHaptic} onBack={goBack} onHome={goHome} />;
      case 'haptics': return <HapticScreen mode={settings.hapticMode || 'Beat'} intensity={settings.intensity} paused={!settings.haptics} lights={settings.lights} lightCue={lightCue} hapticNotice={hapticNotice} onMode={(value) => updateSetting('hapticMode', value)} onIntensity={(value) => updateSetting('intensity', value)} onPause={() => updateSetting('haptics', !settings.haptics)} onHaptic={triggerHaptic} onBack={goBack} onHome={goHome} />;
      case 'friends': return <FriendsScreen friends={friends} focusedFriendId={friends[friendFocusIndex]?.id} locationSharing={settings.location} lights={settings.lights} connectionState={connectionState} poorNetwork={poorNetwork} lightCue={lightCue} onSelectFriend={selectFriend} onSignals={() => setScreen('signals')} onBack={goBack} onHome={goHome} />;
      case 'friend-detail': return <FriendDetailScreen friend={selectedFriend} distance={selectedFriend.distance} locationSharing={settings.location} lights={settings.lights} lightCue={lightCue} hapticNotice={hapticNotice} onWalk={moveFriendCloser} onReset={resetFriend} onSignal={(signal) => handleSignal(signal, selectedFriend)} onBack={() => setScreen('friends')} onHome={goHome} />;
      case 'signals': return <SignalScreen friends={friends} focusedSignal={signalOptions[signalFocusIndex]} physicalSignal={signalRequest} groupSignal={groupSignal} lights={settings.lights} lightCue={lightCue} hapticNotice={hapticNotice} onSend={handleSignal} onResponse={handleSignalResponse} onBack={() => { setSignalRequest(null); setScreen('friends'); }} onHome={goHome} />;
      case 'lyrics': return <LyricsScreen large={settings.largeLyrics} onToggleLarge={() => updateSetting('largeLyrics', !settings.largeLyrics)} onBack={goBack} onHome={goHome} />;
      case 'navigate': return <NavigateScreen crowdLevel={crowdLevel} focusedPlaceId={places[placeFocusIndex]?.id} onSelect={selectPlace} onBack={goBack} onHome={goHome} />;
      case 'place-detail': return selectedPlace ? <PlaceDetailScreen place={selectedPlace} crowdLevel={crowdLevel} navigation={navigation} heading={navHeading} lights={settings.lights} lightCue={lightCue} onGuide={toggleNavigation} onWalk={moveNavigation} onTellGroup={tellGroupTakingBreak} onBack={() => setScreen('navigate')} onHome={goHome} /> : <NavigateScreen crowdLevel={crowdLevel} focusedPlaceId={places[placeFocusIndex]?.id} onSelect={selectPlace} onBack={goBack} onHome={goHome} />;
      case 'settings': return <AccessibilityScreen settings={{ ...settings, lights: settings.lights || 'Full', intensity: settings.intensity || 'Medium', location: settings.location || 'Precise' }} onChange={updateSetting} onBack={goBack} onHome={goHome} />;
      case 'context': return <ContextScreen connectionState={connectionState} batteryLevel={batteryLevel} crowdLevel={crowdLevel} onToggleNetwork={() => setConnectionState((current) => connectionStates[(connectionStates.indexOf(current) + 1) % connectionStates.length])} onCycleBattery={cycleBattery} onBeat={() => { setBeatTick((value) => value + 1); triggerHaptic('beat'); }} onMoveFriend={moveFriendCloser} onResetFriend={resetFriend} onCrowdAlert={triggerCrowdAlert} onCycleCrowd={cycleCrowd} onIncomingSignal={triggerIncomingSignal} onOpenHelp={() => setScreen('help')} onBack={goBack} onHome={goHome} />;
      case 'help': return <HelpScreen lights={settings.lights} lightCue={lightCue} onRequestHelp={() => { triggerLight('help', colors.danger, 'SUPPORT ALERT', 'Simulated group help request'); triggerHaptic('strong', true); }} onBack={goBack} onHome={goHome} />;
      default: return <HomeScreen event={event} friends={friends} settings={settings} connectionState={connectionState} poorNetwork={poorNetwork} crowdAlert={crowdAlert} beatTick={beatTick} lightCue={lightCue} groupSignal={groupSignal} incomingSignal={incomingSignal} hapticNotice={hapticNotice} groupNotice={groupNotice} onNavigate={navigate} onSettings={() => setScreen('settings')} onContext={() => setScreen('context')} onHelp={() => setScreen('help')} onRespondIncoming={respondToIncoming} />;
    }
  })();

  return (
    <View style={styles.root}>
      <BandFrame screenKey={screen} friends={friends} selectedFriendId={selectedFriendId} lightCue={lightCue} onBack={physicalBack} onNext={physicalNext} onOk={physicalOk}><ScreenTransition transitionKey={screen}>{content}</ScreenTransition></BandFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: '100vh', backgroundColor: '#F3F7FB', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 12 },
});
