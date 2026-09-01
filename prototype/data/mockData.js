export const eventData = {
  event: 'Pulse Festival 2026',
  stage: 'Main Stage',
  artist: 'LUNA',
  song: 'Midnight',
  crowdLevel: 'High',
  network: 'Good',
  battery: 82,
};

export const initialFriends = [
  { id: 1, name: 'Syifa', distance: 12, location: 'East Entry', status: 'Safe', color: '#00C2FF', heading: 35, direction: 'NORTH-EAST' },
  { id: 2, name: 'Serafina', distance: 24, location: 'Main Stage', status: 'At Main Stage', color: '#9B7BFF', heading: 70, direction: 'NORTH-EAST' },
  { id: 3, name: 'Amy', distance: 92, location: 'Food Area', status: 'Safe', color: '#FF9F43', heading: 125, direction: 'SOUTH-EAST' },
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
];

export const signalMeta = {
  "I'm Safe": { color: '#39E58C', lightMode: 'safe', haptic: 'medium', icon: '✓' },
  'Meet Me': { color: '#9B7BFF', lightMode: 'meet', haptic: 'medium', icon: '✦' },
  'Need Help': { color: '#FF4D6D', lightMode: 'help', haptic: 'strong', icon: '!' },
  'Taking a Break': { color: '#00C2FF', lightMode: 'break', haptic: 'soft', icon: '◌' },
  'Going to Another Stage': { color: '#FF9F43', lightMode: 'signal', haptic: 'medium', icon: '↗' },
};

export const incomingSignalOptions = [
  { friendId: 1, signal: 'Meet Me' },
  { friendId: 2, signal: "I'm Safe" },
  { friendId: 3, signal: 'Taking a Break' },
];

export const places = [
  { id: 'quiet', title: 'Quiet Space', detail: 'Low stimulation', distance: 42, direction: 'NORTH-EAST', heading: 60, icon: '◌', accent: '#20E3D2' },
  { id: 'accessible', title: 'Accessible Viewing', detail: 'Clear sightline', distance: 80, direction: 'NORTH', heading: 0, icon: '◎', accent: '#9B7BFF' },
  { id: 'toilets', title: 'Toilets', detail: 'North entrance', distance: 65, direction: 'NORTH-WEST', heading: 320, icon: '⌁', accent: '#FF9F43' },
  { id: 'first-aid', title: 'First Aid', detail: 'Support point', distance: 150, direction: 'WEST', heading: 270, icon: '+', accent: '#FF5CA8' },
  { id: 'water', title: 'Water', detail: 'Refill station', distance: 40, direction: 'EAST', heading: 90, icon: '≈', accent: '#00C2FF' },
  { id: 'main-stage', title: 'Main Stage', detail: 'LUNA live now', distance: 0, direction: 'ARRIVED', heading: 0, icon: '✦', accent: '#20E3D2' },
];
