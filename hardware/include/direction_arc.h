#pragma once
#include <cmath>
#include <stdint.h>

struct DirectionArc {
  bool visible;
  double bearing, spanDegrees, brightness;
};

inline DirectionArc directionArc(bool finding, bool connected, bool localFresh,
                                 bool peerFresh, bool usable, double bearing, double metres) {
  DirectionArc arc{false, 0, 90, 0};
  if (!finding || !connected || !localFresh || !peerFresh || !usable ||
      !std::isfinite(bearing) || !std::isfinite(metres) || metres < 0) return arc;
  arc.visible = true;
  arc.bearing = std::fmod(std::fmod(bearing, 360.0) + 360.0, 360.0);
  // Smooth increase across the useful festival range: full at 5 m, dim at 200 m.
  arc.brightness = 1.0 - 0.8 * std::fmax(0.0, std::fmin(1.0, (metres - 5.0) / 195.0));
  return arc;
}

inline double arcStrengthAt(const DirectionArc &arc, double angle) {
  if (!arc.visible || !std::isfinite(angle)) return 0;
  double delta = std::fmod(std::fmod(angle - arc.bearing + 180.0, 360.0) + 360.0, 360.0) - 180.0;
  if (std::abs(delta) > arc.spanDegrees / 2) return 0;
  return arc.brightness * (1.0 - 0.75 * std::abs(delta) / (arc.spanDegrees / 2));
}

inline uint16_t arcColour565(uint16_t colour, double strength) {
  strength = std::fmax(0.0, std::fmin(1.0, strength));
  uint16_t r = std::lround(((colour >> 11) & 31) * strength);
  uint16_t g = std::lround(((colour >> 5) & 63) * strength);
  uint16_t b = std::lround((colour & 31) * strength);
  return (r << 11) | (g << 5) | b;
}
