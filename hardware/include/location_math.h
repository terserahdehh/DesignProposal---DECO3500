#pragma once
#include <cmath>
#include <limits>

struct Guidance { double metres; double bearing; };
inline Guidance guidance(double lat1, double lon1, double lat2, double lon2) {
  const double radians = 3.14159265358979323846 / 180.0;
  double a = lat1*radians, b = lat2*radians;
  double dlat = (lat2-lat1)*radians, dlon = (lon2-lon1)*radians;
  double h = std::pow(std::sin(dlat/2),2) + std::cos(a)*std::cos(b)*std::pow(std::sin(dlon/2),2);
  h = std::fmax(0.0, std::fmin(1.0, h));
  double bearing = std::atan2(std::sin(dlon)*std::cos(b), std::cos(a)*std::sin(b)-std::sin(a)*std::cos(b)*std::cos(dlon))/radians;
  return {6371000.0 * 2 * std::atan2(std::sqrt(h),std::sqrt(1-h)), std::fmod(bearing+360.0,360.0)};
}

struct DirectionQuality {
  bool usable;
  double combinedAccuracyMetres;
  double bearingUncertaintyDegrees;
};

// Geometry based on reported accuracy radii, not a guaranteed error bound or a
// calibrated confidence interval. Call only after validating/freshening fixes.
inline DirectionQuality directionQuality(double metres, double localAccuracyMetres,
                                         double peerAccuracyMetres) {
  DirectionQuality quality{false, std::numeric_limits<double>::quiet_NaN(), 180.0};
  if (!std::isfinite(localAccuracyMetres) || !std::isfinite(peerAccuracyMetres) ||
      localAccuracyMetres < 0 || peerAccuracyMetres < 0) return quality;
  const double combined = localAccuracyMetres + peerAccuracyMetres;
  if (!std::isfinite(combined)) return quality;
  quality.combinedAccuracyMetres = combined;

  const double pi = 3.14159265358979323846;
  const double earthRadiusMetres = 6371000.0; // Same spherical model as guidance().
  const double antipodalMetres = pi * earthRadiusMetres;
  // No useful direction within one metre, inside overlapping accuracy circles,
  // or when the uncertainty reaches an ambiguous antipodal position.
  if (!std::isfinite(metres) || metres <= 1.0 || metres <= combined ||
      metres >= antipodalMetres - 1.0 || antipodalMetres - metres <= combined)
    return quality;

  // Tangent to a spherical accuracy circle. At concert distances this reduces
  // to asin(combined / metres); near antipodes it avoids false precision.
  const double ratio = std::sin(combined / earthRadiusMetres) /
                       std::sin(metres / earthRadiusMetres);
  if (!std::isfinite(ratio) || ratio < 0.0 || ratio >= 1.0) return quality;
  quality.bearingUncertaintyDegrees = std::asin(ratio) * 180.0 / pi;
  quality.usable = std::isfinite(quality.bearingUncertaintyDegrees);
  return quality;
}
