// Four simulated recipient bands. No real connection or location data is used.
const FRIENDS = [
  { id: 'nayaka', name: 'Nayaka', colorName: 'Purple', color: '#A855F7', angle: -135, message: 'Taking a Break', lines: 'TAKING\nA BREAK', icon: 'break' },
  { id: 'amy', name: 'Amy', colorName: 'Red', color: '#EF4444', angle: -45, message: 'Going Home', lines: 'GOING\nHOME', icon: 'home' },
  { id: 'syifa', name: 'Syifa', colorName: 'Yellow', color: '#FACC15', angle: 135, message: 'Toilet', lines: 'TOILET', icon: 'toilet' },
  { id: 'nala', name: 'Nala', colorName: 'Green', color: '#22C55E', angle: 45, message: "I'm Safe", lines: "I'M SAFE", icon: 'safe' },
];

const OPTIONS = [
  { id: 'find', label: 'Find Friend', lines: 'FIND FRIEND', icon: 'friends' },
  { id: 'toilet', label: 'Toilet', lines: 'TOILET', icon: 'toilet' },
  { id: 'break', label: 'Taking a Break', lines: 'TAKING\nA BREAK', icon: 'break' },
  { id: 'home', label: 'Going Home', lines: 'GOING\nHOME', icon: 'home' },
  { id: 'safe', label: "I'm Safe", lines: "I'M SAFE", icon: 'safe' },
  { id: 'sos', label: 'SOS', lines: 'SOS', icon: 'sos' },
];

const DISTANCES = [24, 18, 12, 7, 3, 0];
const INTENSITIES = [0.35, 0.48, 0.62, 0.77, 0.9, 1];

module.exports = { FRIENDS, OPTIONS, DISTANCES, INTENSITIES };
