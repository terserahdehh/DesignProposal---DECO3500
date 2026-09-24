import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import ControlButton from './ControlButton';
import { validName } from '../utils/deviceNames';
export default function DeviceNameEditor({ name, label, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [notice, setNotice] = useState('');
  return <View style={{ padding: 16, borderRadius: 12, backgroundColor: '#24213D', borderWidth: 1, borderColor: '#A568D5', gap: 10 }}>
    <Text style={{ color: '#C9BADB', fontSize: 12 }}>{label}</Text>
    <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: 25, fontWeight: '800' }}>{name}</Text>
    {editing ? <>
      <TextInput accessibilityLabel={label} value={draft} onChangeText={setDraft} maxLength={40} autoFocus style={{ backgroundColor: '#0C192A', color: '#FFFFFF', padding: 12, borderRadius: 8, fontSize: 17 }} />
      <ControlButton label="Save name" onPress={() => { if (!validName(draft)) { setNotice('Enter a name from 1 to 40 characters.'); return; } const persisted = onSave(draft.trim()); setNotice(persisted ? 'Name saved.' : 'Name updated for this session. Browser storage is unavailable.'); setEditing(false); }} />
      <ControlButton label="Cancel rename" onPress={() => { setEditing(false); setNotice(''); }} />
    </> : <ControlButton label="Rename device" onPress={() => { setDraft(name); setEditing(true); setNotice(''); }} />}
    {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: '#C9BADB' }}>{notice}</Text>}
  </View>;
}
