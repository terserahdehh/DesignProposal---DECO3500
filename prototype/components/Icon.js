import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

// Local vector icons keep the band clear and monochrome. No downloaded fonts.
export default function Icon({ name, size = 24, color = '#FFFFFF', stroke = 1.8 }) {
  const paths = {
    bluetooth: <Path d="M7 7l10 10-5 4V3l5 4L7 17" />,
    back: <Path d="M15 5l-8 7 8 7z" fill={color} strokeLinejoin="round" />,
    next: <Path d="M9 5l8 7-8 7z" fill={color} strokeLinejoin="round" />,
    check: <Path d="M5 12l4.5 4.5L19 7" />,
    safe: <><Path d="M12 2l8 3v6c0 5-4.4 8.6-8 11-3.6-2.4-8-6-8-11V5z" /><Path d="M8 12l3 3 5-6" /></>,
    sos: <><Path d="M10.3 3.5a2 2 0 013.4 0l8 14A2 2 0 0120 21H4a2 2 0 01-1.7-3.5z" /><Line x1="12" y1="8" x2="12" y2="13" /><Circle cx="12" cy="17" r="0.7" fill={color} /></>,
    home: <><Path d="M2 11l10-9 10 9M5 9v12h5v-7h4v7h5V9" /></>,
    break: <><Path d="M3 10h14v5a6 6 0 01-6 6H9a6 6 0 01-6-6zM17 11h2a3 3 0 010 6h-2M3 23h15M6 2c-3 3 3 3 0 6M11 1c-3 3 3 3 0 6M16 2c-3 3 3 3 0 6" /></>,
    toilet: <><Rect x="5" y="2" width="13" height="7" rx="1" /><Path d="M3 11h18c0 6-3 8-7 8l2 3H8l2-3c-4 0-7-2-7-8z" fill={color} /><Line x1="16" y1="5.5" x2="16.5" y2="5.5" /></>,
    friends: <><Circle cx="12" cy="6.5" r="3" /><Path d="M6 21v-3a6 6 0 0112 0v3z" /><Path d="M6 4a3 3 0 00-2 5M18 4a3 3 0 012 5M4 12a4 4 0 00-3 4v3h2M20 12a4 4 0 013 4v3h-2" /></>,
    walk: <><Circle cx="14" cy="3.5" r="2" /><Path d="M11 8l-3 5-4 1M11 8l4 5 5 1M11 8l1 8-5 6M12 16l5 6" /></>,
    rotate: <><Path d="M20 7a9 9 0 10.5 9M20 2v5h-5" /></>,
    reset: <><Path d="M4 8a8.5 8.5 0 11-1 8M4 3v5h5" /></>,
    message: <Path d="M4 3h16a2 2 0 012 2v12a2 2 0 01-2 2H9l-6 3v-3H2V5a2 2 0 012-2z" />,
    pulse: <Polyline points="1,12 6,12 9,4 14,20 17,12 23,12" />,
    battery: <><Rect x="2" y="6" width="18" height="12" rx="2" /><Path d="M22 10v4" /><Rect x="5" y="9" width="12" height="6" rx="0.5" fill={color} stroke="none" /></>,
    disconnect: <><Path d="M7 8L4 5M17 16l3 3M8 12l4-4M12 16l4-4M2 2l20 20" /></>,
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden={true}>{paths[name] || paths.pulse}</Svg>;
}
