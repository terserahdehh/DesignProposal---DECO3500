const normalize = value => ((value % 360) + 360) % 360;
const DIRECTION_ARROW_PATH = 'M50 20 L70 80 L50 65 L30 80 Z';
function directionGlow(bearing, metres) {
  if (!Number.isFinite(bearing) || !Number.isFinite(metres) || metres < 0) return null;
  return { bearing: normalize(bearing), spanDegrees: 90,
    brightness: Math.max(0.2, 1 - 0.8 * Math.max(0, Math.min(1, (metres - 5) / 195))) };
}
function arcPath(bearing, radius = 46) {
  const point = angle => { const radians = normalize(angle) * Math.PI / 180; return `${(50 + Math.sin(radians) * radius).toFixed(4)} ${(50 - Math.cos(radians) * radius).toFixed(4)}`; };
  return `M ${point(bearing - 45)} A ${radius} ${radius} 0 0 1 ${point(bearing + 45)}`;
}
module.exports = { directionGlow, arcPath, DIRECTION_ARROW_PATH };
