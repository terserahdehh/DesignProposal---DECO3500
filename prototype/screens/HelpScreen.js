import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import LightCue from '../components/LightCue';
import ScreenHeader from '../components/ScreenHeader';
import { WatchButton } from '../components/WatchButton';
import { colors } from '../theme';

export default function HelpScreen({ lights = 'Full', lightCue, onRequestHelp, onBack, onHome }) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('hold');
  const timer = useRef(null);
  const startedAt = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const startHold = () => {
    if (stage !== 'hold') return;
    startedAt.current = Date.now();
    setProgress(0.01);
    timer.current = setInterval(() => {
      const next = Math.min(1, (Date.now() - startedAt.current) / 2000);
      setProgress(next);
      if (next >= 1) { clearInterval(timer.current); timer.current = null; setStage('confirm'); }
    }, 40);
  };

  const stopHold = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (stage === 'hold' && progress < 1) setProgress(0);
  };

  const cancel = () => { setStage('hold'); setProgress(0); };
  const request = () => { onRequestHelp(); setStage('sent'); };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Need Support?" subtitle="PRIVATE GROUP SIGNAL" onBack={onBack} onHome={onHome} />
      {stage === 'hold' ? <>
        <View style={styles.center}><View style={styles.helpMark}><Text style={styles.helpIcon}>!</Text></View><Text style={styles.title}>Hold for Help</Text><Text style={styles.copy}>Press and hold for 2 seconds to request support from your selected group.</Text></View>
        <LightCue color={colors.danger} mode="help" lights={lights} title="SIMULATED SUPPORT" detail="Hold to continue" compact />
        <View style={styles.progressTrack}><Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
        <WatchButton label="Hold for Help" icon="!" variant="danger" onPressIn={startHold} onPressOut={stopHold} />
      </> : stage === 'confirm' ? <>
        <View style={styles.center}><View style={[styles.helpMark, styles.confirmMark]}><Text style={styles.helpIcon}>?</Text></View><Text style={styles.title}>Request support?</Text><Text style={styles.copy}>Your selected group can see that you need help. Nothing is sent until you confirm.</Text></View>
        <View style={styles.buttons}><WatchButton label="Cancel" fill onPress={cancel} /><WatchButton label="Request Help" fill variant="danger" onPress={request} /></View>
      </> : <View style={styles.sent}><View style={[styles.helpMark, styles.sentMark]}><Text style={styles.helpIcon}>✓</Text></View><Text style={styles.title}>Support request sent</Text><Text style={styles.copy}>Your selected group can see that you need help.</Text><LightCue color={colors.danger} mode="help" lights={lights} title="SUPPORT ALERT" detail="Red light + simulated haptic" compact /><WatchButton label="Back to Live" icon="⌂" variant="accent" onPress={onHome} /></View>}
      <Text style={styles.note}>SIMULATED PROTOTYPE SUPPORT · no emergency service is contacted</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  helpMark: { width: 68, height: 68, borderRadius: 26, borderWidth: 2, borderColor: colors.danger, backgroundColor: `${colors.danger}20`, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: colors.danger, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  confirmMark: { borderColor: colors.orange, backgroundColor: `${colors.orange}20` },
  sentMark: { borderColor: colors.green, backgroundColor: `${colors.green}20` },
  helpIcon: { color: colors.text, fontSize: 30, fontWeight: '300' },
  title: { color: colors.text, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  copy: { color: colors.secondary, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 7 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: colors.panelSoft, overflow: 'hidden', marginBottom: 5 },
  progressFill: { height: '100%', backgroundColor: colors.danger },
  buttons: { flexDirection: 'row', gap: 6, marginTop: 'auto', marginBottom: 5 },
  sent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, gap: 7 },
  note: { color: colors.secondary, textAlign: 'center', fontSize: 7, lineHeight: 11, marginTop: 5 },
});
