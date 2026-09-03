export const eventData = {
  event: 'Pulse Festival 2026',
  stage: 'Main Stage',
  artist: 'LUNA',
  song: 'Midnight',
  crowdLevel: 'High',
  network: 'Bluetooth Good',
  battery: 82,
};

export const initialFriends = [
  { id: 1, name: 'Syifa', distance: 12, location: 'East Entry', status: 'Safe', color: '#EF4444', heading: 35, direction: 'NORTH-EAST' },
  { id: 2, name: 'Serafina', distance: 24, location: 'Main Stage', status: 'At Main Stage', color: '#A855F7', heading: 70, direction: 'NORTH-EAST' },
  { id: 3, name: 'Amy', distance: 92, location: 'Food Area', status: 'Safe', color: '#FACC15', heading: 125, direction: 'SOUTH-EAST' },
];

export const lyricLines = [
  'Under the city lights',
  'We move into the night',
  'Every heartbeat finds its way',
  "We're here, we're here to stay",
];

export const signalOptions = [
  "I'm Safe",
  'Meet Me',
  'Need Help',
  'Taking a Break',
  'Going to Another Stage',
  'Going Home',
  'Toilet',
  'SOS / Emergency',
];

export const signalMeta = {
  "I'm Safe": { color: '#22C55E', lightMode: 'safe', haptic: 'medium', icon: '✓' },
  'Meet Me': { color: '#A855F7', lightMode: 'meet', haptic: 'medium', icon: '✦' },
  'Need Help': { color: '#EF4444', lightMode: 'help', haptic: 'strong', icon: '!' },
  'Taking a Break': { color: '#22D3EE', lightMode: 'break', haptic: 'soft', icon: '◌' },
  'Going to Another Stage': { color: '#FACC15', lightMode: 'signal', haptic: 'medium', icon: '↗' },
  'Going Home': { color: '#FACC15', lightMode: 'signal', haptic: 'medium', icon: '⌂' },
  Toilet: { color: '#22D3EE', lightMode: 'signal', haptic: 'medium', icon: '⌁' },
  'SOS / Emergency': { color: '#EF4444', lightMode: 'help', haptic: 'strong', icon: '!' },
};

export const incomingSignalOptions = [
  { friendId: 1, signal: 'Meet Me' },
  { friendId: 2, signal: "I'm Safe" },
  { friendId: 3, signal: 'Taking a Break' },
];

export const places = [
  { id: 'quiet', title: 'Quiet Space', detail: 'Low stimulation', distance: 42, direction: 'NORTH-EAST', heading: 60, icon: '◌', accent: '#22D3EE' },
  { id: 'accessible', title: 'Accessible Viewing', detail: 'Clear sightline', distance: 80, direction: 'NORTH', heading: 0, icon: '◎', accent: '#A855F7' },
  { id: 'toilets', title: 'Toilets', detail: 'North entrance', distance: 65, direction: 'NORTH-WEST', heading: 320, icon: '⌁', accent: '#FACC15' },
  { id: 'first-aid', title: 'First Aid', detail: 'Support point', distance: 150, direction: 'WEST', heading: 270, icon: '+', accent: '#EF4444' },
  { id: 'water', title: 'Water', detail: 'Refill station', distance: 40, direction: 'EAST', heading: 90, icon: '≈', accent: '#22D3EE' },
  { id: 'main-stage', title: 'Main Stage', detail: 'LUNA live now', distance: 0, direction: 'ARRIVED', heading: 0, icon: '✦', accent: '#22D3EE' },
];
