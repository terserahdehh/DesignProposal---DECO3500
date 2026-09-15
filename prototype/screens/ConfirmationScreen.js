import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import base from './screenStyles';

export default function ConfirmationScreen({ signal, result, unavailable, connected, scale, sosConfirmations = 0 }) {
  if (unavailable) return <View style={base.center}>
    <Icon name="disconnect" size={30 * scale} />
    <Text style={[base.title, { fontSize: 20 * scale, lineHeight: 23 * scale }]}>{'NO FRIENDS\nCONNECTED'}</Text>
    <Text style={[base.secondary, { fontSize: 13 * scale }]}>NOT SENT</Text>
  </View>;

  const sos = signal.id === 'sos';
  if (result) return <View style={base.center}>
    <Icon name={sos ? 'sos' : 'check'} size={34 * scale} stroke={2.5} />
    <Text style={[base.title, { fontSize: (sos ? 25 : 20) * scale }]}>{sos ? 'SOS SENT' : 'MESSAGE SENT'}</Text>
    <Text style={[base.secondary, { fontSize: 14 * scale }]}>{sos && result.recipients.length === 4 ? 'TO ALL BANDS' : `TO ${result.recipients.length} ${sos ? (result.recipients.length === 1 ? 'BAND' : 'BANDS') : (result.recipients.length === 1 ? 'FRIEND' : 'FRIENDS')}`}</Text>
  </View>;

  return <View style={base.center}>
    <Text style={[base.title, { fontSize: 23 * scale, lineHeight: 27 * scale }]}>{sos ? 'SEND SOS\nTO GROUP?' : 'SEND TO\nGROUP?'}</Text>
    {sos && <Text style={[base.secondary, { fontSize: 13 * scale }]}>OK PRESSES: {sosConfirmations}/3</Text>}
    {connected < 4 && <Text style={[base.secondary, { fontSize: 12 * scale }]}>{connected} CONNECTED</Text>}
    <View style={styles.hints}><Text style={[styles.hint, { fontSize: 12 * scale }]}>BACK CANCEL</Text><Text style={[styles.hint, { fontSize: 12 * scale }]}>{sos ? (sosConfirmations === 2 ? 'OK SEND' : 'OK CONFIRM') : 'OK SEND'}</Text></View>
  </View>;
}
const styles = StyleSheet.create({ hints: { flexDirection: 'row', gap: 10, marginTop: 7 }, hint: { color: '#FFFFFF', fontWeight: '700', letterSpacing: 0 } });
