import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors } from '../theme';

const indicatorPositions = [
  { top: '22%', left: '14%' },
  { top: '18%', right: '14%' },
  { bottom: '20%', right: '15%' },
];

function PhysicalButton({ label, onPress, kind = 'default' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} physical band button`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.physicalButton,
        kind === 'ok' && styles.okButton,
        pressed && styles.physicalButtonPressed,
      ]}
    >
      <Text style={[styles.physicalLabel, kind === 'ok' && styles.okLabel]}>{label}</Text>
    </Pressable>
  );
}

function FriendIndicator({ friend, index, selectedFriendId, lightCue }) {
  const selected = friend.id === selectedFriendId;
  const distance = Number.isFinite(friend.distance) ? friend.distance : 100;
  const proximity = Math.max(0, Math.min(1, 1 - distance / 100));
  const cueActive = selected && lightCue && (lightCue.color === friend.color || ['nearby', 'received'].includes(lightCue.mode));
  const intensity = selected ? Math.min(1, 0.38 + proximity * 0.52 + (cueActive ? 0.18 : 0)) : 0.42;
  const size = selected ? 10 + Math.round(proximity * 9) : 9;
  const position = indicatorPositions[index] || indicatorPositions[0];

  return (
    <View
      accessibilityLabel={`${friend.name} indicator. ${selected ? `${friend.distance} metres away` : 'friend connected'}`}
      style={[
        styles.indicator,
        position,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: friend.color,
          opacity: intensity,
          shadowColor: friend.color,
          shadowOpacity: selected ? 0.95 : 0.45,
          shadowRadius: selected ? 17 + proximity * 12 : 7,
        },
      ]}
    />
  );
}

export default function BandFrame({ children, screenKey, friends = [], selectedFriendId, lightCue, onBack, onNext, onOk }) {
  const { width } = useWindowDimensions();
  const bodySize = width < 600 ? Math.min(420, Math.max(260, width - 32)) : Math.min(610, Math.max(490, width * 0.52));
  const screenWidth = bodySize * 0.67;
  const screenHeight = screenWidth * (336 / 296);
  const screenContentScale = screenWidth / 296;
  const bodyTop = 40;
  const screenTop = bodyTop + bodySize * 0.2;
  const displayLeft = (bodySize - screenWidth) / 2;
  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId);
  const groupActive = lightCue?.color === colors.green || lightCue?.mode === 'safe';

  return (
    <View style={[styles.stage, { width: bodySize, height: bodySize + 82 }]}>
      <View style={[styles.topStrap, { width: bodySize * 0.26, height: 76, left: bodySize * 0.37 }]} />
      <View style={[styles.bottomStrap, { width: bodySize * 0.26, height: 76, left: bodySize * 0.37, top: bodySize + 4 }]} />
      <View style={[styles.body, { width: bodySize, height: bodySize, top: bodyTop, borderRadius: bodySize / 2 }]}>
        <View style={[styles.bodyHighlight, { width: bodySize - 14, height: bodySize - 14, borderRadius: bodySize / 2 }]} />
        <Text style={styles.brand}>PULSEBAND</Text>
        {friends.slice(0, 3).map((friend, index) => <FriendIndicator key={friend.id} friend={friend} index={index} selectedFriendId={selectedFriendId} lightCue={lightCue} />)}
        <View style={[styles.groupIndicator, { opacity: groupActive ? 1 : 0.52, shadowColor: colors.green, shadowOpacity: groupActive ? 0.95 : 0.45, shadowRadius: groupActive ? 16 : 7 }]} />
        <View style={[styles.controlRail, { width: screenWidth, left: displayLeft, top: bodySize * 0.095 }]}>
          <PhysicalButton label="BACK" onPress={onBack} />
          <PhysicalButton label="NEXT" onPress={onNext} />
          <PhysicalButton label="OK" kind="ok" onPress={onOk} />
        </View>
        <View style={[styles.display, { width: screenWidth, height: screenHeight, left: displayLeft, top: screenTop - bodyTop, borderRadius: Math.max(16, bodySize * 0.045) }]}>
          <View style={[styles.displayShine, { borderRadius: Math.max(13, bodySize * 0.038) }]} />
          <View style={[styles.screenContent, { transform: [{ scale: screenContentScale }] }]} key={screenKey}>
            {children}
          </View>
        </View>
        <View style={styles.bodyFooter}>
          <View style={styles.linkDot} />
          <Text style={styles.footerText}>LOCAL BLUETOOTH LINK</Text>
          {selectedFriend ? <Text style={[styles.footerFriend, { color: selectedFriend.color }]}>{selectedFriend.name.toUpperCase()}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { position: 'relative', alignSelf: 'center', alignItems: 'center' },
  topStrap: { position: 'absolute', top: 0, borderRadius: 28, backgroundColor: colors.panelSoft, borderWidth: 2, borderColor: colors.line },
  bottomStrap: { position: 'absolute', borderRadius: 28, backgroundColor: colors.panelSoft, borderWidth: 2, borderColor: colors.line },
  body: { position: 'absolute', left: 0, backgroundColor: colors.screen, borderWidth: 3, borderColor: '#253653', shadowColor: colors.aqua, shadowOpacity: 0.24, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, alignItems: 'center', overflow: 'hidden' },
  bodyHighlight: { position: 'absolute', top: 5, borderWidth: 1, borderColor: `${colors.text}15` },
  brand: { position: 'absolute', top: 13, color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 2.2 },
  indicator: { position: 'absolute', zIndex: 3, borderWidth: 1, borderColor: colors.text },
  groupIndicator: { position: 'absolute', width: 10, height: 10, borderRadius: 5, bottom: '20%', left: '15%', backgroundColor: colors.green, borderWidth: 1, borderColor: colors.text, zIndex: 3 },
  controlRail: { position: 'absolute', zIndex: 7, flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
  physicalButton: { flex: 1, minHeight: 25, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.55, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  okButton: { backgroundColor: colors.green, borderColor: colors.text },
  physicalButtonPressed: { opacity: 0.68, transform: [{ translateY: 1 }, { scale: 0.96 }] },
  physicalLabel: { color: colors.text, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  okLabel: { color: colors.ink },
  display: { position: 'absolute', zIndex: 5, overflow: 'hidden', backgroundColor: colors.screen, borderWidth: 2, borderColor: '#40516B', alignItems: 'center', justifyContent: 'center' },
  displayShine: { position: 'absolute', top: 2, left: 2, right: 2, height: 20, borderTopWidth: 1, borderTopColor: `${colors.text}12` },
  screenContent: { width: 296, height: 336, paddingHorizontal: 19, paddingTop: 17, paddingBottom: 15 },
  bodyFooter: { position: 'absolute', bottom: 12, left: '19%', right: '19%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  linkDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.green, shadowColor: colors.green, shadowOpacity: 0.8, shadowRadius: 5 },
  footerText: { color: colors.muted, fontSize: 6, fontWeight: '900', letterSpacing: 0.45 },
  footerFriend: { fontSize: 6, fontWeight: '900', letterSpacing: 0.45 },
});
