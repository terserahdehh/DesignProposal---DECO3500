import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FriendCard from '../components/FriendCard';
import LightCue from '../components/LightCue';
import ScreenHeader from '../components/ScreenHeader';
import WatchButton from '../components/WatchButton';
import { colors } from '../theme';

export default function FriendsScreen({ friends, focusedFriendId, locationSharing, lights = 'Full', connectionState = 'Connected', poorNetwork, lightCue, onSelectFriend, onSignals, onBack, onHome }) {
  return (
    <View style={styles.screen}>
      <ScreenHeader title="My Group" subtitle={`${friends.length + 1} WRISTBANDS CONNECTED`} onBack={onBack} onHome={onHome} />
      {connectionState === 'Disconnected' ? <Text style={styles.networkNote}>BLUETOOTH OFFLINE · cached friend traces remain visible</Text> : poorNetwork ? <Text style={styles.networkNote}>BLUETOOTH WEAK · nearby group link keeps local cues available</Text> : null}
      <View style={styles.list}>{friends.map((friend) => <FriendCard key={friend.id} friend={friend} focused={friend.id === focusedFriendId} locationSharing={locationSharing} onPress={() => onSelectFriend(friend)} />)}</View>
      <LightCue compact color={lightCue.color} mode={lightCue.mode} lights={lights} title={lightCue.title} detail={lightCue.detail} />
      <View style={styles.groupStatus}><View style={styles.avatarStack}><View style={[styles.stack, { backgroundColor: colors.cyan }]} /><View style={[styles.stack, { backgroundColor: colors.violet }]} /><View style={[styles.stack, { backgroundColor: colors.orange }]} /></View><View style={styles.statusCopy}><Text style={styles.statusTitle}>Group channel open</Text><Text style={styles.statusDetail}>Sharing: {locationSharing} · friends only</Text></View></View>
      <WatchButton label="Send Group Signal" icon="⌁" variant="quiet" onPress={onSignals} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 6 },
  networkNote: { color: colors.yellow, fontSize: 8, lineHeight: 12, marginBottom: 1, fontWeight: '800' },
  list: { gap: 6, marginTop: 2 },
  groupStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 14, backgroundColor: `${colors.cyan}12`, borderWidth: 1, borderColor: `${colors.cyan}55`, marginTop: 'auto', marginBottom: 2 },
  avatarStack: { flexDirection: 'row', width: 40 },
  stack: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: colors.screen, marginRight: -6 },
  statusCopy: { flex: 1 },
  statusTitle: { color: colors.text, fontSize: 9, fontWeight: '900' },
  statusDetail: { color: colors.secondary, fontSize: 7, marginTop: 2 },
});
