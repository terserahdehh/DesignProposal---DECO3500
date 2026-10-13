#pragma once
#include <cmath>
#include <cstdio>
#include <stdint.h>
#include "direction_visuals.h"
#include "location_math.h"
#include "proximity.h"
#include "ranging.h"
#include "walk_locate.h"
#include "probe_compass.h"

enum class FindMode : uint8_t { Offline, Unavailable, Uncertain, DistanceOnly, Direction, DemoDirection, WalkEstimate, ProbeEstimate };
enum class DistanceSource : uint8_t { None, WifiRange, PhoneGps };
enum class RingShape : uint8_t { None, Quarter, Full };

struct FindInputs {
  bool finding, peerConnected, localFresh, peerFresh;
  double gpsMetres, gpsBearing;
  DirectionQuality gpsQuality;
  RangeReading range;
  double demoBearing = NAN;  // set by the wearer with < and >; never measured
  // Walk-to-find estimate, already relative to the band's current heading.
  double walkBearing = NAN, walkUncertaintyDegrees = NAN;
  // Warmer/colder probes, also relative to the band's current heading.
  double probeBearing = NAN, probeUncertaintyDegrees = NAN;
};

struct FindGuidance {
  FindMode mode;
  DistanceSource source;
  bool distanceKnown;
  double metres, uncertaintyMetres;
  bool directionUsable;
  double bearing;  // north-referenced; only phone GPS supplies one
  DirectionVisuals visuals;
  RingShape ring;
  ProximityFeedback proximity;
  uint32_t beepIntervalMs;  // 0 unless the Find screen is open
  bool demoDirection;
  double demoBearing;
  bool walkEstimate;
  double walkUncertaintyDegrees;
  bool probeEstimate;
  double probeUncertaintyDegrees;
};

// One decision feeds the LCD, status JSON and beeps. Usable phone GPS gives a
// north-up direction; a consistent walk-to-find fix gives an estimated one;
// Wi-Fi ranging alone gives distance with a non-directional ring. The
// labelled demo shows a chosen direction, lit by the measured distance.
inline FindGuidance findGuidance(const FindInputs &in) {
  FindGuidance guidance{FindMode::Offline, DistanceSource::None, false, NAN, NAN, false, NAN,
                        directionVisuals(false, false, false, false, false, NAN, NAN), RingShape::None,
                        proximityFeedback(false, NAN), 0, false, NAN, false, NAN, false, NAN};
  if (!in.peerConnected) return guidance;
  const bool locations = in.localFresh && in.peerFresh;
  const bool ranged = in.range.valid && std::isfinite(in.range.metres) && in.range.metres >= 0 &&
                      std::isfinite(in.range.uncertaintyMetres);
  bool direction = locations && in.gpsQuality.usable && std::isfinite(in.gpsBearing) &&
                   std::isfinite(in.gpsMetres) && in.gpsMetres >= 0;
  // A measured separation inside the GPS uncertainty means the GPS separation
  // and its bearing are wrong, however usable the fixes look on their own.
  if (direction && ranged && in.range.metres + in.range.uncertaintyMetres <= in.gpsQuality.combinedAccuracyMetres)
    direction = false;

  if (ranged) {
    guidance.source = DistanceSource::WifiRange;
    guidance.metres = in.range.metres;
    guidance.uncertaintyMetres = in.range.uncertaintyMetres;
  } else if (direction) {
    guidance.source = DistanceSource::PhoneGps;
    guidance.metres = in.gpsMetres;
    guidance.uncertaintyMetres = in.gpsQuality.combinedAccuracyMetres;
  }
  guidance.distanceKnown = guidance.source != DistanceSource::None;
  // Estimates need a current measured distance and yield to a real direction.
  const bool walk = !direction && ranged && std::isfinite(in.walkBearing) &&
                    in.walkUncertaintyDegrees >= 0 && in.walkUncertaintyDegrees <= WALK_MAX_BEARING_UNCERTAINTY_DEGREES;
  const bool probe = !direction && !walk && ranged && std::isfinite(in.probeBearing) &&
                     in.probeUncertaintyDegrees >= 0 && in.probeUncertaintyDegrees <= PROBE_MAX_UNCERTAINTY_DEGREES;
  const bool demo = !direction && !walk && !probe && ranged && std::isfinite(in.demoBearing);
  guidance.mode = direction ? FindMode::Direction : walk ? FindMode::WalkEstimate : probe ? FindMode::ProbeEstimate
                : demo ? FindMode::DemoDirection : ranged ? FindMode::DistanceOnly
                : locations ? FindMode::Uncertain : FindMode::Unavailable;
  guidance.directionUsable = direction;
  if (direction) guidance.bearing = std::fmod(std::fmod(in.gpsBearing, 360.0) + 360.0, 360.0);
  guidance.demoDirection = demo;
  if (demo) guidance.demoBearing = std::fmod(std::fmod(in.demoBearing, 360.0) + 360.0, 360.0);
  guidance.walkEstimate = walk;
  if (walk) guidance.walkUncertaintyDegrees = in.walkUncertaintyDegrees;
  guidance.probeEstimate = probe;
  if (probe) guidance.probeUncertaintyDegrees = in.probeUncertaintyDegrees;
  guidance.proximity = proximityFeedback(guidance.distanceKnown, guidance.metres);
  if (!in.finding) return guidance;

  if (direction || walk || probe || demo) {
    const double shown = direction ? in.gpsBearing : walk ? in.walkBearing : probe ? in.probeBearing : in.demoBearing;
    guidance.visuals = directionVisuals(true, true, true, true, true, shown, guidance.metres);
    if (guidance.visuals.light.visible) guidance.ring = RingShape::Quarter;
  } else if (ranged) {
    guidance.ring = RingShape::Full;
  }
  guidance.beepIntervalMs = guidance.proximity.active ? guidance.proximity.beepIntervalMs : 0;
  return guidance;
}

// < and > rotate the labelled demo direction in 45-degree steps from north.
inline double nextDemoBearing(double current, int step) {
  if (!std::isfinite(current)) return 0;
  return std::fmod(std::fmod(current + 45.0 * step, 360.0) + 360.0, 360.0);
}

inline const char *findModeName(FindMode mode) {
  switch (mode) {
    case FindMode::Direction: return "direction";
    case FindMode::DemoDirection: return "demo-direction";
    case FindMode::WalkEstimate: return "walk-estimate";
    case FindMode::ProbeEstimate: return "probe-estimate";
    case FindMode::DistanceOnly: return "distance";
    case FindMode::Uncertain: return "uncertain";
    case FindMode::Unavailable: return "unavailable";
    default: return "offline";
  }
}

inline const char *distanceSourceName(DistanceSource source) {
  return source == DistanceSource::WifiRange ? "wifi-ftm" : source == DistanceSource::PhoneGps ? "phone-gps" : "none";
}

inline const char *ringShapeName(RingShape ring) {
  return ring == RingShape::Quarter ? "quarter" : ring == RingShape::Full ? "full" : "none";
}

// Never print a number for a distance that is not currently known.
inline int formatFindDistance(const FindGuidance &guidance, char *out, size_t size) {
  if (!guidance.distanceKnown || !std::isfinite(guidance.metres)) return std::snprintf(out, size, "Distance unknown");
  if (guidance.source == DistanceSource::WifiRange)
    return std::snprintf(out, size, guidance.metres < 10 ? "%.1f m" : "%.0f m", guidance.metres);
  if (guidance.metres >= 1000) return std::snprintf(out, size, "~%.1f km", guidance.metres / 1000);
  return std::snprintf(out, size, "~%.0f m", guidance.metres);
}

inline int formatFindUncertainty(const FindGuidance &guidance, char *out, size_t size) {
  if (!guidance.distanceKnown || !std::isfinite(guidance.uncertaintyMetres)) return std::snprintf(out, size, "%s", "");
  const char *source = guidance.source == DistanceSource::WifiRange ? "Wi-Fi timing" : "phone GPS";
  const double value = guidance.uncertaintyMetres;
  const char *format = value < 1 ? "+/-%.2f m %s" : value < 10 ? "+/-%.1f m %s" : "+/-%.0f m %s";
  return std::snprintf(out, size, format, value, source);
}
