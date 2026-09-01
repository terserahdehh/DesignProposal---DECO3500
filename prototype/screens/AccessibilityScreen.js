import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import WatchButton, { SegmentedControl } from '../components/WatchButton';
import { colors } from '../theme';

function SettingRow({ title, detail, children }) {
  return <View style={styles.setting}><View style={styles.settingCopy}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDetail}>{detail}</Text></View><View style={styles.settingControl}>{children}</View></View>;
}

export default function AccessibilityScreen({ settings, onChange, onBack, onHome }) {
  return (
    <View style={styles.screen}>
      <ScreenHeader title="My Experience" subtitle="ACCESSIBILITY + CONTROL" onBack={onBack} onHome={onHome} />
      <View style={styles.list}>
        <SettingRow title="Haptic Music" detail="Feel the rhythm"><WatchButton label={settings.haptics ? 'ON' : 'OFF'} compact variant={settings.haptics ? 'accent' : 'default'} onPress={() => onChange('haptics', !settings.haptics)} /></SettingRow>
        <SettingRow title="Light Effects" detail="Visual intensity"><SegmentedControl options={['Full', 'Reduced', 'Off']} value={settings.lights} onChange={(value) => onChange('lights', value)} /></SettingRow>
        <SettingRow title="Haptic Strength" detail="Vibration level"><SegmentedControl options={['Soft', 'Medium', 'Strong']} value={settings.intensity} onChange={(value) => onChange('intensity', value)} /></SettingRow>
        <SettingRow title="Large Lyrics" detail="Readable type"><WatchButton label={settings.largeLyrics ? 'ON' : 'OFF'} compact variant={settings.largeLyrics ? 'accent' : 'default'} onPress={() => onChange('largeLyrics', !settings.largeLyrics)} /></SettingRow>
        <SettingRow title="Crowd Alerts" detail="Context cues"><WatchButton label={settings.crowdAlerts ? 'ON' : 'OFF'} compact variant={settings.crowdAlerts ? 'accent' : 'default'} onPress={() => onChange('crowdAlerts', !settings.crowdAlerts)} /></SettingRow>
        <SettingRow title="Location Sharing" detail="Friend privacy"><SegmentedControl options={['Precise', 'Approximate', 'Off']} value={settings.location} onChange={(value) => onChange('location', value)} /></SettingRow>
      </View>
      <Text style={styles.note}>Your sensory settings stay on the wristband.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { gap: 7, marginTop: 5 },
  setting: { minHeight: 42, padding: 8, borderRadius: 14, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 7 },
  settingCopy: { flex: 1 },
  settingTitle: { color: colors.text, fontSize: 10, fontWeight: '900' },
  settingDetail: { color: colors.secondary, fontSize: 8, marginTop: 2 },
  settingControl: { maxWidth: 148, minWidth: 54 },
  note: { color: colors.muted, textAlign: 'center', fontSize: 8, marginTop: 'auto' },
});
