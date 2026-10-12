import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import Icon from '../components/Icon';
import { THEME } from '../theme';
import { OWNERS, MAX_MESSAGES, MAX_TEXT_LENGTH, readPresets, savePresets, messageError, newMessageId, readBridgeUrl, saveBridgeUrl } from '../utils/presets';
import { createBandBridge } from '../utils/bandBridge';
import { createPhoneBluetooth } from '../utils/phoneBluetooth';
import { describeBandStatus, initialTransportMode } from '../utils/bandStatus';
import DirectionRing from '../components/DirectionRing';
import { directionGlow } from '../utils/directionGlow';

const NAMES = { nayaka: 'Nayaka', syifa: 'Syifa' };
const COLOURS = { nayaka: THEME.purple, syifa: THEME.yellow };
const fingerprint = messages => JSON.stringify(messages);

function Button({ children, onPress, disabled, primary, selected, accessibilityLabel, style, testID }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: !!disabled, selected: !!selected }} disabled={disabled} onPress={onPress}
    style={({ hovered, pressed, focused }) => [styles.button, primary && styles.primaryButton, selected && styles.selectedButton, hovered && !disabled && styles.hoveredButton, focused && styles.focusedButton, pressed && { opacity: 0.8 }, disabled && { opacity: 0.45 }, style]}>
    <Text style={styles.buttonText}>{children}</Text>
  </Pressable>;
}

export default function PhoneScreen() {
  const { width } = useWindowDimensions();
  const [owner, setOwner] = useState('nayaka');
  const [lists, setLists] = useState(() => Object.fromEntries(OWNERS.map(id => [id, readPresets(id)])));
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [storageWarning, setStorageWarning] = useState('');
  const [bridgeUrl, setBridgeUrl] = useState(readBridgeUrl);
  const [bridgeDraft, setBridgeDraft] = useState(bridgeUrl);
  const bridge = useMemo(() => createBandBridge(bridgeUrl), [bridgeUrl]);
  const [transportMode, setTransportMode] = useState(() => initialTransportMode(globalThis.location));
  const [phoneBluetooth] = useState(() => createPhoneBluetooth());
  const [bluetooth, setBluetooth] = useState(phoneBluetooth.getState);
  const transport = transportMode === 'bluetooth' ? phoneBluetooth : bridge;
  const [bands, setBands] = useState([]);
  const [bridgeError, setBridgeError] = useState('');
  const [checking, setChecking] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [pendingLoad, setPendingLoad] = useState(null);
  const [synced, setSynced] = useState({});
  const [location, setLocation] = useState(null);
  const [locationNotice, setLocationNotice] = useState(null);
  const [locating, setLocating] = useState(false);
  const [watching, setWatching] = useState(false);
  const watchId = useRef(null);
  const locationSession = useRef(0);
  const locationSending = useRef(null);
  const mounted = useRef(true);
  const [now, setNow] = useState(Date.now);
  const [statusReceivedAt, setStatusReceivedAt] = useState(0);
  const [hiddenIncomingKey, setHiddenIncomingKey] = useState(null);
  const messages = lists[owner];
  const editorBusy = syncing || loadingPresets || !!pendingLoad;
  const band = bands.find(item => item.owner === owner);
  const connected = transportMode === 'bluetooth' ? bluetooth.status === 'connected' && bluetooth.owner === owner : band?.connected === true && !bridgeError;
  const savedOnBand = synced[owner] === fingerprint(messages);
  const previewIndex = Math.max(0, messages.findIndex(message => message.id === previewId));
  const preview = messages[previewIndex];
  const geolocation = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.geolocation : null;
  const liveBand = transportMode === 'bluetooth' ? bluetooth.band : band;
  const live = describeBandStatus(liveBand, owner, connected, statusReceivedAt, now);
  const showIncoming = live.incoming && live.incoming.key !== hiddenIncomingKey && !pendingLoad;
  const glow = live.mode === 'ready' ? directionGlow(liveBand.guidance.bearing, liveBand.guidance.metres) : null;

  useEffect(() => {
    const unsubscribe = phoneBluetooth.subscribe(next => { setBluetooth(next); setStatusReceivedAt(Date.now()); });
    return () => { unsubscribe(); phoneBluetooth.disconnect(); };
  }, [phoneBluetooth]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (connected) return;
    locationSession.current += 1;
    if (watchId.current !== null) geolocation?.clearWatch(watchId.current);
    watchId.current = null;
    setWatching(false);
    setLocating(false);
    setLocation(null);
  }, [connected, geolocation]);

  useEffect(() => { if (!live.incoming) setHiddenIncomingKey(null); }, [live.incoming?.key]);

  useEffect(() => {
    if (transportMode !== 'usb') { setChecking(false); return undefined; }
    let active = true;
    let inFlight = false;
    setBands([]);
    async function check() {
      if (inFlight) return;
      inFlight = true;
      setChecking(true);
      try {
        const result = await bridge.status();
        if (active) { setBands(result.bands); setStatusReceivedAt(Date.now()); setBridgeError(''); }
      } catch (error) {
        if (active) { setBands([]); setBridgeError(error.message); }
      } finally {
        inFlight = false;
        if (active) setChecking(false);
      }
    }
    check();
    const interval = setInterval(check, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [bridge, refresh, transportMode]);

  useEffect(() => {
    locationSession.current += 1;
    if (watchId.current !== null) geolocation?.clearWatch(watchId.current);
    watchId.current = null;
    setWatching(false);
    setLocating(false);
    setLocation(null);
    setLocationNotice(null);
    setHiddenIncomingKey(null);
    return () => {
      locationSession.current += 1;
      if (watchId.current !== null) geolocation?.clearWatch(watchId.current);
      watchId.current = null;
    };
  }, [owner, transport]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  function chooseOwner(next) {
    if (editorBusy) return;
    if (next !== owner && bluetooth.status === 'connected') phoneBluetooth.disconnect();
    setOwner(next); setDraft(''); setEditing(null); setPreviewId(null); setNotice(null); setStorageWarning('');
  }

  function chooseTransport(next) {
    if (editorBusy) return;
    if (next === transportMode) return;
    if (transportMode === 'bluetooth') phoneBluetooth.disconnect();
    setTransportMode(next); setNotice(null); setSynced({});
  }

  function updateMessages(next, action) {
    const result = savePresets(owner, next);
    setLists(previous => ({ ...previous, [owner]: result.messages || next }));
    setStorageWarning(result.ok ? '' : result.error);
    setNotice({ kind: result.ok ? 'success' : 'warning', text: result.ok ? `${action} Saved on this browser. Sync to update ${NAMES[owner]}'s band.` : `${action} ${result.error}` });
  }

  function saveMessage() {
    if (editorBusy) return;
    const error = messageError(draft);
    if (error) { setNotice({ kind: 'error', text: error }); return; }
    if (!editing && messages.length >= MAX_MESSAGES) { setNotice({ kind: 'error', text: 'This band already has 8 messages. Edit or delete one first.' }); return; }
    const id = editing || newMessageId();
    const next = editing ? messages.map(message => message.id === editing ? { id, text: draft.trim() } : message) : [...messages, { id, text: draft.trim() }];
    updateMessages(next, editing ? 'Message updated.' : 'Message added.');
    setPreviewId(id); setDraft(''); setEditing(null);
  }

  function removeMessage(id) {
    if (editorBusy) return;
    updateMessages(messages.filter(message => message.id !== id), 'Message deleted.');
    if (editing === id) { setEditing(null); setDraft(''); }
  }

  async function syncMessages() {
    if (!connected || editorBusy) return;
    const targetOwner = owner;
    const snapshot = messages.map(message => ({ ...message }));
    setSyncing(true); setNotice({ kind: 'info', text: `Waiting for ${NAMES[targetOwner]}'s band to acknowledge…` });
    try {
      await transport.syncPresets(targetOwner, snapshot);
      if (!mounted.current) return;
      setSynced(previous => ({ ...previous, [targetOwner]: fingerprint(snapshot) }));
      setNotice({ kind: 'success', text: `${NAMES[targetOwner]}'s band acknowledged ${snapshot.length} preset messages. Select them from the band's message menu.` });
    } catch (error) { if (mounted.current) setNotice({ kind: 'error', text: error.message }); }
    finally { if (mounted.current) setSyncing(false); }
  }

  async function loadFromBand() {
    if (!connected || editorBusy) return;
    const targetOwner = owner;
    setLoadingPresets(true);
    setNotice({ kind: 'info', text: `Reading stored messages from ${NAMES[targetOwner]}'s band…` });
    try {
      const result = await transport.readPresets(targetOwner);
      if (!mounted.current) return;
      setSynced(previous => ({ ...previous, [targetOwner]: fingerprint(result.messages) }));
      if (fingerprint(result.messages) !== fingerprint(messages) || draft.length || editing) {
        setPendingLoad({ owner: targetOwner, messages: result.messages });
        setNotice(null);
      } else setNotice({ kind: 'success', text: `${NAMES[targetOwner]}'s band acknowledged its stored messages. This browser already matches the band.` });
    } catch (error) { if (mounted.current) setNotice({ kind: 'error', text: error.message }); }
    finally { if (mounted.current) setLoadingPresets(false); }
  }

  function keepBrowserMessages() {
    setPendingLoad(null);
    setNotice({ kind: 'info', text: 'Kept your browser messages and editor text.' });
  }

  function replaceBrowserMessages() {
    if (!pendingLoad) return;
    const result = savePresets(pendingLoad.owner, pendingLoad.messages, undefined, { preserveStoredText: true });
    setLists(previous => ({ ...previous, [pendingLoad.owner]: result.messages || pendingLoad.messages }));
    setStorageWarning(result.ok ? '' : result.error);
    setDraft(''); setEditing(null); setPreviewId(null);
    setNotice({ kind: result.ok ? 'success' : 'warning', text: result.ok ? `Loaded ${pendingLoad.messages.length} stored messages from ${NAMES[pendingLoad.owner]}'s band. Edit them here, then sync your changes.` : `Messages loaded for this visit. ${result.error}` });
    setPendingLoad(null);
  }

  function configureBridge() {
    if (editorBusy) return;
    const result = saveBridgeUrl(bridgeDraft);
    if (!result.url) { setNotice({ kind: 'error', text: result.error }); return; }
    setBridgeUrl(result.url); setBridgeDraft(result.url); setRefresh(value => value + 1);
    setSynced({});
    setNotice({ kind: result.ok ? 'info' : 'warning', text: result.ok ? 'Bridge address saved. Checking connected bands…' : result.error });
  }

  async function stopSharing() {
    locationSession.current += 1;
    if (watchId.current !== null) geolocation?.clearWatch(watchId.current);
    watchId.current = null;
    setWatching(false); setLocating(true);
    const session = locationSession.current;
    try {
      await transport.clearLocation(owner);
      if (session !== locationSession.current || !mounted.current) return;
      setLocation(null);
      setLocationNotice({ kind: 'info', text: 'Location updates stopped. Your band acknowledged clearing its shared location.' });
    } catch (error) {
      if (session === locationSession.current && mounted.current) setLocationNotice({ kind: 'error', text: `Automatic updates stopped, but clearing the last band fix is unconfirmed. ${error.message}` });
    } finally { if (session === locationSession.current && mounted.current) setLocating(false); }
  }

  async function sendLocation(position, session) {
    if (session !== locationSession.current || locationSending.current === session) return;
    const fix = { lat: position.coords.latitude, lon: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp, simulated: false };
    locationSending.current = session;
    setLocating(true);
    try {
      await transport.shareLocation(owner, fix);
      if (session !== locationSession.current || !mounted.current) return;
      setLocation(fix);
      setLocationNotice({ kind: 'success', text: `${NAMES[owner]}'s band acknowledged this phone's location. Both wearers must share from their own phones for guidance.` });
    } catch (error) {
      if (session === locationSession.current && mounted.current) setLocationNotice({ kind: 'error', text: error.message });
    } finally {
      if (locationSending.current === session) locationSending.current = null;
      if (session === locationSession.current && mounted.current) setLocating(false);
    }
  }

  function startSharing(continuous) {
    if (!connected || locating) return;
    if (!geolocation || typeof window !== 'undefined' && !window.isSecureContext) {
      setLocationNotice({ kind: 'error', text: 'Phone location requires an HTTPS page or localhost and a browser with location support.' }); return;
    }
    const session = ++locationSession.current;
    setLocating(true);
    setLocationNotice({ kind: 'info', text: 'Allow browser location access to share this phone’s real position.' });
    const onError = error => {
      if (session !== locationSession.current || !mounted.current) return;
      const reason = error.code === 1 ? 'Location permission was denied. Allow access in your browser settings to try again.' : error.code === 2 ? 'Phone location is unavailable. Move somewhere with a clearer location signal and try again.' : 'Getting your phone location timed out. Try again.';
      if (error.code === 1) {
        if (watchId.current !== null) geolocation.clearWatch(watchId.current);
        watchId.current = null;
        setWatching(false);
      }
      setLocating(false); setLocationNotice({ kind: 'error', text: reason });
    };
    const options = { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 };
    if (continuous) {
      setWatching(true);
      watchId.current = geolocation.watchPosition(position => sendLocation(position, session), onError, options);
    } else geolocation.getCurrentPosition(position => sendLocation(position, session), onError, options);
  }

  function stepPreview(direction) {
    if (messages.length) setPreviewId(messages[(previewIndex + direction + messages.length) % messages.length].id);
  }

  return <ScrollView style={styles.page} contentContainerStyle={styles.scrollContent}>
    <View style={[styles.shell, width < 600 && styles.smallShell]}>
      <View style={styles.header}>
        <View style={styles.wordmark}><View style={styles.logo}><Icon name="pulse" size={23} color="#DEC1FF" /></View><Text style={styles.brand}>PulseBand<Text style={{ color: THEME.accent }}>.</Text></Text></View>
        <Text accessibilityRole="link" href="/" style={styles.backLink}>Band prototype ↗</Text>
      </View>
      <Text style={styles.eyebrow}>BEFORE THE CONCERT</Text>
      <Text accessibilityRole="header" style={styles.heading}>A few words. A closer circle.</Text>
      <Text style={styles.intro}>Prepare your messages, sync your band, then stay in touch with a tap.</Text>

      <View style={styles.ownerBar}>
        <View><Text style={styles.cardLabel}>PREPARING FOR</Text><Text style={styles.ownerName}>{NAMES[owner]}</Text></View>
        <View style={styles.ownerButtons}>{OWNERS.map(id => <Button key={id} testID={`owner-${id}`} selected={owner === id} disabled={editorBusy || bluetooth.status === 'connecting'} onPress={() => chooseOwner(id)} accessibilityLabel={`Prepare ${NAMES[id]}'s band`}><Text style={{ color: COLOURS[id] }}>● </Text>{NAMES[id]}</Button>)}</View>
      </View>

      <View style={[styles.columns, width < 900 && styles.stacked]}>
        <View style={styles.mainColumn}>
          <View style={styles.card}>
            <View style={styles.cardTop}><View><Text style={styles.cardLabel}>YOUR QUICK MESSAGES</Text><Text accessibilityRole="header" style={styles.cardTitle}>Say it your way.</Text></View><Text style={styles.count}>{messages.length} / {MAX_MESSAGES}</Text></View>
            <Text style={styles.note}>Saved separately for each wearer on this browser. Short messages fit the band screen.</Text>
            <Text style={styles.tinyNote}>Using a new phone? Connect your band, then load its saved messages to edit them here.</Text>
            <View style={styles.messageList}>{messages.map((message, index) => <View key={message.id} style={[styles.messageRow, preview?.id === message.id && styles.previewRow]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Preview message ${index + 1}: ${message.text}`} onPress={() => setPreviewId(message.id)} style={styles.messageContent}>
                <Text style={styles.messageNumber}>{String(index + 1).padStart(2, '0')}</Text><Text style={styles.messageText}>{message.text}</Text>
              </Pressable>
              <View style={styles.rowActions}><Button accessibilityLabel={`Edit ${message.text}`} disabled={editorBusy} onPress={() => { setEditing(message.id); setDraft(message.text); setNotice(null); }}>Edit</Button><Button accessibilityLabel={`Delete ${message.text}`} disabled={editorBusy} onPress={() => removeMessage(message.id)}>Delete</Button></View>
            </View>)}</View>
            {!messages.length && <Text style={styles.empty}>Your list is empty. Add a message below, or sync this empty list to clear the band.</Text>}
            <View style={styles.composer}>
              <View style={styles.cardTop}><Text style={styles.inputLabel}>{editing ? 'EDIT MESSAGE' : 'ADD A MESSAGE'}</Text><Text style={styles.count}>{draft.length} / {MAX_TEXT_LENGTH}</Text></View>
              <TextInput testID="preset-input" accessibilityLabel={editing ? 'Edit preset message' : 'New preset message'} value={draft} onChangeText={setDraft} placeholder="Meet at the main entrance" placeholderTextColor={THEME.muted} autoCapitalize="sentences" maxLength={MAX_TEXT_LENGTH} editable={!editorBusy} onSubmitEditing={saveMessage} style={styles.input} />
              <Text style={styles.tinyNote}>Up to 40 characters. Use letters, numbers and punctuation; the band font does not support emoji.</Text>
              <View style={styles.actionRow}><Button testID="save-preset" primary disabled={editorBusy || !draft.trim() || !editing && messages.length >= MAX_MESSAGES} onPress={saveMessage}>{editing ? 'Save changes' : 'Add message'}</Button>{editing && <Button disabled={editorBusy} onPress={() => { setEditing(null); setDraft(''); }}>Cancel edit</Button>}</View>
            </View>
            <View style={styles.syncRow}><View style={styles.syncCopy}><Text style={[styles.syncLabel, { color: savedOnBand ? '#86EFAC' : THEME.secondary }]}>{savedOnBand ? 'Band acknowledged this list' : 'Ready to sync to the band'}</Text><Text style={styles.tinyNote}>The band keeps its presets after USB is disconnected.</Text></View><View style={styles.actionRow}><Button testID="load-presets" disabled={!connected || editorBusy} onPress={loadFromBand}>{loadingPresets ? 'Reading…' : 'Load from band'}</Button><Button testID="sync-presets" primary disabled={!connected || editorBusy} onPress={syncMessages}>{syncing ? 'Syncing…' : `Sync to ${NAMES[owner]}`}</Button></View></View>
            {notice && <Text testID="preset-notice" accessibilityLiveRegion="polite" style={[styles.notice, notice.kind === 'error' && styles.error, notice.kind === 'success' && styles.success]}>{notice.text}</Text>}
            {!!storageWarning && <Text style={[styles.note, styles.error]}>{storageWarning}</Text>}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>FIND YOUR FRIEND</Text><Text accessibilityRole="header" style={styles.cardTitle}>Share this phone’s location.</Text>
            <Text style={styles.note}>The bands have no GPS or compass. Share each wearer’s real phone location to their own band. The band shows distance and a bearing from north; use a phone compass to orient yourself.</Text>
            <View style={styles.actionRow}>{!watching && <><Button testID="share-location" primary disabled={!connected || locating || syncing} onPress={() => startSharing(false)}>{locating ? 'Getting location…' : 'Share location once'}</Button><Button testID="watch-location" disabled={!connected || locating || syncing} onPress={() => startSharing(true)}>Keep location updated</Button></>}{(watching || location) && <Button testID="stop-location" disabled={locating && !watching} onPress={stopSharing}>Stop sharing location</Button>}</View>
            {watching && <Text style={styles.liveLocation}>● Automatic location updates are active for {NAMES[owner]}.</Text>}
            {location && <View style={styles.locationBox}><Text style={styles.locationText}>{location.lat.toFixed(5)}, {location.lon.toFixed(5)}</Text><Text style={styles.tinyNote}>Real phone fix · accuracy ±{Math.round(location.accuracy)} m · shared {new Date(location.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View>}
            {locationNotice && <Text testID="location-notice" accessibilityLiveRegion="polite" style={[styles.notice, locationNotice.kind === 'error' && styles.error, locationNotice.kind === 'success' && styles.success]}>{locationNotice.text}</Text>}
            <Text style={styles.tinyNote}>Location requires HTTPS or localhost. Leave this page open for automatic updates. GPS accuracy and stale fixes limit guidance, especially inside a crowded venue.</Text>
            <Text style={styles.tinyNote}>Switching wearer or connection stops browser updates. The previous band keeps its last fix until it expires; use Stop sharing location to request clearing.</Text>
          </View>
          <View testID="live-band-status" style={styles.card}>
            <Text style={styles.cardLabel}>LIVE PHYSICAL BAND</Text>
            <Text accessibilityRole="header" style={styles.cardTitle}>{NAMES[owner]}'s band</Text>
            <Text accessibilityLiveRegion="polite" style={styles.notice}>{live.peerConnected ? `${NAMES[owner === 'nayaka' ? 'syifa' : 'nayaka']} connected over ESP-NOW` : 'Paired band is offline or status is unavailable'}</Text>
            <Text testID="direction-title" style={styles.messageText}>{live.title}</Text>
            {!!live.detail && <Text testID="direction-detail" style={styles.note}>{live.detail}</Text>}
            {glow && <View style={{ alignItems: 'center', marginVertical: 12 }}><DirectionRing diameter={200} colour={COLOURS[owner === 'nayaka' ? 'syifa' : 'nayaka']} arrow {...glow} /><Text style={styles.tinyNote}>North-up direction preview · brighter when closer</Text></View>}
            {!!liveBand?.result && connected && <Text accessibilityLiveRegion="polite" style={styles.note}>Last band result: {liveBand.result}</Text>}
            {live.incoming && <Button onPress={() => setHiddenIncomingKey(null)}>Show incoming message</Button>}
            <Text style={styles.tinyNote}>Messages and SOS travel between the paired Nayaka and Syifa bands even when the website is closed. The arrow on the watch is north up; use a phone compass to orient yourself.</Text>
          </View>
        </View>

        <View style={[styles.sideColumn, width < 900 && { width: '100%' }]}>
          <View style={[styles.card, styles.previewCard]}>
            <Text style={styles.cardLabel}>BAND PREVIEW</Text>
            <View style={styles.watchFrame}>
              <View style={styles.watchTop}><View style={[styles.led, { backgroundColor: COLOURS[owner] }]} /><Text style={styles.watchOwner}>{NAMES[owner].toUpperCase()}</Text><View style={[styles.led, { opacity: 0 }]} /></View>
              <View style={styles.watchScreen}><Icon name="message" size={28} /><Text style={styles.watchMessage}>{preview ? preview.text.toUpperCase() : 'NO MESSAGES'}</Text><Text style={styles.watchCounter}>{messages.length ? `${previewIndex + 1} / ${messages.length}` : 'ADD A PRESET'}</Text></View>
              <View style={styles.watchButtons}><Button accessibilityLabel="Preview previous message" disabled={!messages.length} onPress={() => stepPreview(-1)} style={styles.watchButton}>◀</Button><Text style={styles.watchOK}>OK</Text><Button accessibilityLabel="Preview next message" disabled={!messages.length} onPress={() => stepPreview(1)} style={styles.watchButton}>▶</Button></View>
            </View>
            <Text style={[styles.tinyNote, { textAlign: 'center' }]}>Preview only. Sync sends the saved list to the physical band.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>CONNECT YOUR BAND</Text>
            <View style={styles.actionRow}><Button testID="transport-usb" selected={transportMode === 'usb'} disabled={editorBusy || bluetooth.status === 'connecting'} onPress={() => chooseTransport('usb')}>USB bridge</Button><Button testID="transport-bluetooth" selected={transportMode === 'bluetooth'} disabled={editorBusy || bluetooth.status === 'connecting'} onPress={() => chooseTransport('bluetooth')}>Direct Bluetooth</Button></View>
            {transportMode === 'bluetooth' ? <>
              <Text style={styles.note}>Use this Vercel HTTPS page in Chrome on Android or a supported laptop browser and connect your own band. The firmware identity is checked before syncing.</Text>
              <Text accessibilityLiveRegion="polite" style={[styles.notice, bluetooth.status === 'error' && styles.error, bluetooth.status === 'connected' && styles.success]}>{bluetooth.message}</Text>
              {bluetooth.deviceName && <Text style={styles.tinyNote}>{bluetooth.deviceName}</Text>}
              {bluetooth.status === 'connected' ? <Button disabled={editorBusy} onPress={() => phoneBluetooth.disconnect()}>Disconnect Bluetooth</Button> : <Button testID="connect-bluetooth" primary disabled={editorBusy || ['unsupported', 'connecting'].includes(bluetooth.status)} onPress={() => phoneBluetooth.connect(owner)}>{bluetooth.status === 'connecting' ? 'Connecting…' : `Connect ${NAMES[owner]}'s band`}</Button>}
              <Text style={styles.tinyNote}>iPhone browsers do not support Web Bluetooth. Use the USB bridge on a computer for preset preparation. Keep this page connected for phone location updates.</Text>
            </> : <>
            <View style={styles.cardTop}><Text style={styles.cardLabel}>USB BRIDGE</Text><Button disabled={checking} onPress={() => setRefresh(value => value + 1)} accessibilityLabel="Refresh connected bands">{checking ? 'Checking…' : 'Refresh'}</Button></View>
            <Text style={styles.note}>Run the bridge on the computer with both ESP32s plugged in. Its status confirms each band’s assigned owner.</Text>
            <View style={styles.bandStatuses}>{OWNERS.map(id => {
              const item = bands.find(entry => entry.owner === id);
              const online = item?.connected === true && !bridgeError;
              return <View key={id} style={styles.bandStatus}><View style={styles.statusName}><View style={[styles.statusDot, { backgroundColor: online ? '#22C55E' : '#66758B' }]} /><Text style={styles.messageText}>{NAMES[id]}</Text></View><Text style={[styles.statusValue, online && styles.success]}>{online ? 'USB connected' : 'Offline'}</Text>{item?.mac && <Text style={styles.mac}>{item.mac}</Text>}</View>;
            })}</View>
            {!!bridgeError && <Text accessibilityLiveRegion="polite" style={[styles.notice, styles.error]}>{bridgeError}</Text>}
            <Text style={styles.inputLabel}>BRIDGE ADDRESS</Text>
            <TextInput testID="bridge-url" accessibilityLabel="USB bridge address" value={bridgeDraft} onChangeText={setBridgeDraft} editable={!editorBusy} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={styles.input} onSubmitEditing={configureBridge} />
            <Button disabled={editorBusy} onPress={configureBridge}>Save bridge address</Button>
            <Text style={styles.tinyNote}>On this computer: http://localhost:8787. For Vercel, start the bridge with --allow-origin and this site's exact HTTPS origin, then allow local network access if prompted. On a phone, localhost means the phone: use Direct Bluetooth or an explicitly allowed LAN bridge.</Text>
            </>}
          </View>
        </View>
      </View>
      <Text style={styles.footer}>PULSEBAND · PREPARE TOGETHER. STAY TOGETHER.</Text>
    </View>
    <Modal visible={!!showIncoming} transparent animationType="fade" onRequestClose={() => setHiddenIncomingKey(live.incoming?.key)}>
      <View style={styles.modalOverlay}><View testID="incoming-band-popup" style={styles.modalCard}>
        <Text style={[styles.cardLabel, { color: COLOURS[live.incoming?.from] }]}>FROM {NAMES[live.incoming?.from]?.toUpperCase()}</Text>
        <Text accessibilityRole="header" accessibilityLiveRegion="assertive" style={styles.cardTitle}>{live.incoming?.text}</Text>
        <Text style={styles.note}>Received by {NAMES[owner]}'s physical band. Tap the watch to dismiss its own popup.</Text>
        <Button testID="hide-incoming" primary onPress={() => setHiddenIncomingKey(live.incoming?.key)}>Hide on this page</Button>
      </View></View>
    </Modal>
    <Modal visible={!!pendingLoad} transparent animationType="fade" onRequestClose={keepBrowserMessages}>
      <View style={styles.modalOverlay}><View testID="load-confirmation" style={styles.modalCard}>
        <Text accessibilityRole="header" style={styles.cardTitle}>Load {pendingLoad ? NAMES[pendingLoad.owner] : ''}'s band messages?</Text>
        <Text style={styles.note}>Replace this wearer's browser list with these stored band messages? Any text in the message editor will also be discarded.</Text>
        <ScrollView style={styles.modalMessages}>{pendingLoad?.messages.map((message, index) => <Text key={message.id} style={styles.modalMessage}>{index + 1}. {message.text}</Text>)}{pendingLoad?.messages.length === 0 && <Text style={styles.note}>The band has no messages. Replacing will clear this browser list.</Text>}</ScrollView>
        <View style={styles.actionRow}><Button testID="cancel-load-presets" onPress={keepBrowserMessages}>Keep browser messages</Button><Button testID="confirm-load-presets" primary onPress={replaceBrowserMessages}>Replace browser list</Button></View>
      </View></View>
    </Modal>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: THEME.page }, scrollContent: { alignItems: 'center', minHeight: '100%' },
  shell: { width: '100%', maxWidth: 1180, paddingHorizontal: 40, paddingTop: 26, paddingBottom: 28 }, smallShell: { paddingHorizontal: 16, paddingTop: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#1D2C42', paddingBottom: 22, marginBottom: 34 },
  wordmark: { flexDirection: 'row', gap: 10, alignItems: 'center' }, logo: { width: 37, height: 37, borderRadius: 11, backgroundColor: '#261B3A', borderWidth: 1, borderColor: '#6C3D91', alignItems: 'center', justifyContent: 'center' },
  brand: { color: THEME.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.8 }, backLink: { color: THEME.accent, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  eyebrow: { color: '#C1A4DC', fontSize: 11, fontWeight: '700', letterSpacing: 2.4, marginBottom: 12 }, heading: { color: THEME.text, fontSize: 34, fontWeight: '800', lineHeight: 41, letterSpacing: -1 },
  intro: { color: THEME.secondary, fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 28 },
  ownerBar: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#35304B', borderRadius: 14, backgroundColor: '#16192C', padding: 18, marginBottom: 24 },
  ownerName: { color: THEME.text, fontSize: 24, fontWeight: '700', marginTop: 6 }, ownerButtons: { flexDirection: 'row', gap: 10 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 }, stacked: { flexDirection: 'column' }, mainColumn: { flex: 1, minWidth: 0, gap: 22, width: '100%' }, sideColumn: { width: 320, gap: 22 },
  card: { borderWidth: 1, borderColor: '#203149', borderRadius: 16, backgroundColor: '#0B1829', padding: 20, gap: 14 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardLabel: { color: '#B6A0CC', fontSize: 10, fontWeight: '700', letterSpacing: 1.6 }, cardTitle: { color: THEME.text, fontSize: 23, fontWeight: '700', letterSpacing: -0.6, marginTop: 8 }, count: { color: THEME.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  note: { color: THEME.secondary, fontSize: 14, lineHeight: 21 }, tinyNote: { color: THEME.muted, fontSize: 12, lineHeight: 18 },
  messageList: { gap: 9 }, messageRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 10, borderWidth: 1, borderColor: THEME.border, borderRadius: 10, backgroundColor: '#101F33' }, previewRow: { borderColor: '#74559A', backgroundColor: '#191F35' },
  messageContent: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 120, paddingVertical: 8 }, messageNumber: { color: '#9A83B5', fontSize: 12, fontVariant: ['tabular-nums'] }, messageText: { color: THEME.text, fontSize: 14, lineHeight: 20, flexShrink: 1 }, rowActions: { flexDirection: 'row', gap: 6 },
  composer: { borderTopWidth: 1, borderTopColor: THEME.border, paddingTop: 17, marginTop: 3, gap: 10 }, inputLabel: { color: '#B4C0D3', fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  input: { color: THEME.text, backgroundColor: '#06111F', borderWidth: 1, borderColor: '#38506B', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 12, minHeight: 46, fontSize: 15, width: '100%' },
  button: { minHeight: 42, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: THEME.border, backgroundColor: '#122137', borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#F4EDFC', fontSize: 13, fontWeight: '600', textAlign: 'center' }, primaryButton: { backgroundColor: '#7334AB', borderColor: '#A568D5' }, selectedButton: { backgroundColor: '#30223E', borderColor: '#C297ED' }, hoveredButton: { backgroundColor: '#273751', borderColor: '#9D88B2' }, focusedButton: { outlineColor: '#D5B4FF', outlineWidth: 2, outlineOffset: 3, outlineStyle: 'solid' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, syncRow: { borderTopWidth: 1, borderTopColor: THEME.border, paddingTop: 18, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14 }, syncCopy: { flex: 1, minWidth: 140, gap: 5 }, syncLabel: { fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#000000B8' }, modalCard: { width: '100%', maxWidth: 500, maxHeight: '85%', backgroundColor: THEME.surface, borderWidth: 1, borderColor: '#74559A', borderRadius: 16, padding: 22, gap: 18 }, modalMessages: { flexGrow: 0, maxHeight: 260 }, modalMessage: { color: THEME.text, fontSize: 14, lineHeight: 21, paddingVertical: 7 },
  notice: { color: '#D9C9EB', backgroundColor: '#171E32', borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 20 }, error: { color: '#FCA5A5' }, success: { color: '#86EFAC' }, empty: { color: THEME.muted, fontSize: 14, lineHeight: 22, paddingVertical: 18 },
  previewCard: { alignItems: 'center', gap: 18 }, watchFrame: { width: 212, padding: 14, borderRadius: 31, backgroundColor: THEME.body, borderWidth: 3, borderColor: '#D4D2CE', gap: 12, boxShadow: '0 14px 28px #00000044' }, watchTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, led: { width: 10, height: 10, borderRadius: 5 }, watchOwner: { color: '#5D5870', fontSize: 9, fontWeight: '800', letterSpacing: 1.8 }, watchScreen: { minHeight: 160, padding: 16, backgroundColor: THEME.screen, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 12 }, watchMessage: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', lineHeight: 23, textAlign: 'center' }, watchCounter: { color: '#C1CAD8', fontSize: 10 }, watchButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, watchButton: { width: 48, backgroundColor: '#554763', borderColor: '#756682' }, watchOK: { color: '#62556D', fontSize: 12, fontWeight: '800', letterSpacing: 1.3 },
  bandStatuses: { gap: 8 }, bandStatus: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 7, borderBottomWidth: 1, borderBottomColor: '#203149', paddingBottom: 10, paddingTop: 5 }, statusName: { flexDirection: 'row', gap: 8, alignItems: 'center' }, statusDot: { width: 7, height: 7, borderRadius: 4 }, statusValue: { color: THEME.muted, fontSize: 12, lineHeight: 20 }, mac: { width: '100%', paddingLeft: 15, color: THEME.muted, fontSize: 10 },
  liveLocation: { color: '#86EFAC', fontSize: 12, lineHeight: 19 }, locationBox: { backgroundColor: '#0F2430', padding: 12, borderRadius: 8, gap: 5 }, locationText: { color: '#A8E5C5', fontSize: 14, fontVariant: ['tabular-nums'] }, footer: { color: '#8FA2BC', fontSize: 10, letterSpacing: 1.4, marginTop: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#1D2C42' },
});
