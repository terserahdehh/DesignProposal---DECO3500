const normalize = value => ((value % 360) + 360) % 360;
// The symmetric outer diamond keeps the visible bounds centred at diagonal
// bearings too. The broad head and narrow tail identify the pointing end.
// Its radius also clears the quarter-ring's inner halo edge at 42.5 units.
const DIRECTION_ARROW_PATH = 'M50 15 L75 50 L60 50 L50 85 L40 50 L25 50 Z';
// Same curve as the firmware (hardware/include/proximity.h).
const NEAR_METRES = 0.2, FAR_METRES = 20, MIN_BRIGHTNESS = 0.12;
function proximityBrightness(metres) {
  if (!Number.isFinite(metres) || metres < 0) return null;
  const position = Math.log(Math.max(metres, NEAR_METRES) / NEAR_METRES) / Math.log(FAR_METRES / NEAR_METRES);
  const level = 1 - Math.min(1, position);
  return MIN_BRIGHTNESS + (1 - MIN_BRIGHTNESS) * level * level;
}
function directionGlow(bearing, metres) {
  if (!Number.isFinite(bearing) || !Number.isFinite(metres) || metres < 0) return null;
  return { bearing: normalize(bearing), spanDegrees: 90, brightness: proximityBrightness(metres) };
}
function arcPath(bearing, radius = 46) {
  const point = angle => { const radians = normalize(angle) * Math.PI / 180; return `${(50 + Math.sin(radians) * radius).toFixed(4)} ${(50 - Math.cos(radians) * radius).toFixed(4)}`; };
  return `M ${point(bearing - 45)} A ${radius} ${radius} 0 0 1 ${point(bearing + 45)}`;
}
module.exports = { directionGlow, proximityBrightness, arcPath, DIRECTION_ARROW_PATH };
