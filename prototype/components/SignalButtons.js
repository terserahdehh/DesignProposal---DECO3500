import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import ControlButton from './ControlButton';
export const SIGNAL_LABELS = { safe: "I'm Safe", toilet: 'Toilet', break: 'Taking a Break', home: 'Going Home', meet: 'Meet Me', sos: 'SOS' };
export default function SignalButtons({ onSend, connectionKey }) {
  const [confirmations, setConfirmations] = useState(0);
  const [notice, setNotice] = useState('');
  useEffect(() => { setConfirmations(0); setNotice(''); }, [connectionKey]);
  const send = async key => { setNotice(''); if (!await onSend(key)) setNotice('Could not send yet. Check the connection or wait for the previous signal.'); };
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {Object.entries(SIGNAL_LABELS).filter(([key]) => key !== 'sos').map(([key, label]) => <ControlButton key={key} label={label} onPress={() => { setConfirmations(0); send(key); }} />)}
    </View>
    <ControlButton label={confirmations ? `Confirm SOS ${confirmations} of 3` : 'Send SOS'} onPress={() => { if (confirmations === 3) { setConfirmations(0); send('sos'); } else setConfirmations(confirmations + 1); }} />
    {confirmations > 0 && <ControlButton label="Cancel SOS" onPress={() => setConfirmations(0)} />}
    {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: '#FCD34D' }}>{notice}</Text>}
  </View>;
}
