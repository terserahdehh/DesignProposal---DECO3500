#pragma once
#include <algorithm>
#include <cmath>
#include <stdint.h>

// Walk-to-find: the seeker's own path (steps + gyroscope turns) and Wi-Fi
// ranges taken along it locate a friend who stays put, by trilateration.
// A turn in the walk is required: a straight walk cannot tell left from right.
struct WalkRange { double x, y, metres; };  // seeker position (walk frame) and range

constexpr int WALK_MIN_SAMPLES = 6;
constexpr int WALK_MAX_SAMPLES = 64;
constexpr double WALK_MIN_BASELINE_METRES = 1.5;
constexpr double WALK_HUBER_METRES = 1.0;
constexpr double WALK_MAX_SIGMA_METRES = 1.5;
constexpr double WALK_MIN_SIGMA_METRES = 0.5;
constexpr double WALK_MAX_BEARING_UNCERTAINTY_DEGREES = 45;
constexpr double WALK_AMBIGUITY_RATIO = 1.5;
// Closer than this, the proximity pulse already says "here" and a short walk
// cannot resolve a direction (a false arrow was observed when marching in place).
constexpr double WALK_NEAR_METRES = 2.0;

struct WalkFix {
  bool valid;
  const char *reason;  // ok, walk, turn, inconsistent, near, uncertain
  double x, y;         // friend position in the walk frame
  double sigmaMetres;
  double covXX, covXY, covYY;
  double bearingUncertaintyDegrees;  // 2-sigma, seen from the latest sample

  double bearingFrom(double px, double py) const {
    return std::fmod(std::atan2(x - px, y - py) * 180 / 3.14159265358979323846 + 360, 360);
  }
  double distanceFrom(double px, double py) const { return std::hypot(x - px, y - py); }
  double uncertaintyFrom(double px, double py) const {
    const double dx = x - px, dy = y - py, distance = std::hypot(dx, dy);
    if (!(distance > 0)) return 180;
    const double nx = dy / distance, ny = -dx / distance;  // across the line of sight
    const double across = nx * nx * covXX + 2 * nx * ny * covXY + ny * ny * covYY;
    return 2 * std::atan2(std::sqrt(std::fmax(0.0, across)), distance) * 180 / 3.14159265358979323846;
  }
};

// The arrow on the band: walk-frame bearing to the friend, relative to where
// the band's top points now (clockwise heading since the walk started).
inline double walkArrowBearing(const WalkFix &fix, double x, double y, double headingDegrees) {
  return std::fmod(std::fmod(fix.bearingFrom(x, y) - headingDegrees, 360.0) + 360.0, 360.0);
}

inline double walkResidual(const WalkRange &sample, double bx, double by) {
  return std::hypot(bx - sample.x, by - sample.y) - sample.metres;
}

inline double walkCost(const WalkRange *samples, int count, double bx, double by) {
  double cost = 0;
  for (int i = 0; i < count; ++i) {
    const double error = std::abs(walkResidual(samples[i], bx, by));
    cost += error <= WALK_HUBER_METRES ? 0.5 * error * error : WALK_HUBER_METRES * (error - 0.5 * WALK_HUBER_METRES);
  }
  return cost;
}

// Huber-weighted normal matrix J'WJ at a candidate position.
inline void walkNormal(const WalkRange *samples, int count, double bx, double by,
                       double &hxx, double &hxy, double &hyy, double *gx = nullptr, double *gy = nullptr) {
  hxx = hxy = hyy = 0;
  if (gx) *gx = *gy = 0;
  for (int i = 0; i < count; ++i) {
    const double dx = bx - samples[i].x, dy = by - samples[i].y, distance = std::fmax(1e-6, std::hypot(dx, dy));
    const double jx = dx / distance, jy = dy / distance, error = distance - samples[i].metres;
    const double weight = std::abs(error) <= WALK_HUBER_METRES ? 1.0 : WALK_HUBER_METRES / std::abs(error);
    hxx += weight * jx * jx; hxy += weight * jx * jy; hyy += weight * jy * jy;
    if (gx) { *gx += weight * jx * error; *gy += weight * jy * error; }
  }
}

inline void walkRefine(const WalkRange *samples, int count, double &bx, double &by) {
  double lambda = 1e-3;
  double cost = walkCost(samples, count, bx, by);
  for (int iteration = 0; iteration < 30; ++iteration) {
    double hxx, hxy, hyy, gx, gy;
    walkNormal(samples, count, bx, by, hxx, hxy, hyy, &gx, &gy);
    const double axx = hxx + lambda * (hxx + 1e-9), ayy = hyy + lambda * (hyy + 1e-9);
    const double det = axx * ayy - hxy * hxy;
    if (!(std::abs(det) > 1e-12)) break;
    const double stepX = -(ayy * gx - hxy * gy) / det, stepY = -(axx * gy - hxy * gx) / det;
    const double next = walkCost(samples, count, bx + stepX, by + stepY);
    if (next < cost) {
      bx += stepX; by += stepY; lambda = std::fmax(1e-6, lambda * 0.3);
      if (cost - next < 1e-10) break;
      cost = next;
    } else {
      lambda *= 10;
      if (lambda > 1e6) break;
    }
  }
}

// A friend who moves leaves a smooth trend in the residuals instead of the
// independent session-to-session noise of Wi-Fi ranging (sign runs test).
inline bool walkResidualsTrend(const WalkRange *samples, int count, double bx, double by) {
  int positive = 0, negative = 0, runs = 0, previous = 0;
  double peak = 0;
  for (int i = 0; i < count; ++i) {
    const double error = walkResidual(samples[i], bx, by);
    peak = std::fmax(peak, std::abs(error));
    const int sign = error >= 0 ? 1 : -1;
    (sign > 0 ? positive : negative)++;
    if (sign != previous) ++runs;
    previous = sign;
  }
  if (count < 8 || peak < 0.5 || !positive || !negative) return false;
  const double pairs = 2.0 * positive * negative;
  const double expected = 1 + pairs / count;
  const double variance = pairs * (pairs - count) / (double(count) * count * (count - 1));
  return variance > 0 && (runs - expected) / std::sqrt(variance) < -2.5;
}

inline WalkFix locateFromWalk(const WalkRange *samples, int count) {
  WalkFix fix{false, "walk", NAN, NAN, NAN, NAN, NAN, NAN, 180};
  if (!samples || count < WALK_MIN_SAMPLES) return fix;
  if (count > WALK_MAX_SAMPLES) { samples += count - WALK_MAX_SAMPLES; count = WALK_MAX_SAMPLES; }
  double extent = 0;
  for (int i = 0; i < count; ++i)
    for (int j = i + 1; j < count; ++j)
      extent = std::fmax(extent, std::hypot(samples[i].x - samples[j].x, samples[i].y - samples[j].y));
  if (extent < WALK_MIN_BASELINE_METRES) return fix;
  // Two walk points can be no further apart than the sum of their distances
  // to the same friend. Breaking that means the counted steps did not move
  // the wearer (e.g. marching on the spot) or the friend moved.
  for (int i = 0; i < count; ++i)
    for (int j = i + 1; j < count; ++j)
      if (std::hypot(samples[i].x - samples[j].x, samples[i].y - samples[j].y) >
          samples[i].metres + samples[j].metres + 3 * WALK_MIN_SIGMA_METRES) {
        fix.reason = "inconsistent";
        return fix;
      }
  // Measured close right now: the pulse says "here"; no walk arrow.
  if (samples[count - 1].metres < WALK_NEAR_METRES) { fix.reason = "near"; return fix; }

  // Start from 36 directions around the latest position; keep the best two
  // distinct minima. Near-equal minima are the left/right mirror ambiguity.
  const WalkRange &last = samples[count - 1];
  const double seedRadius = std::fmax(last.metres, 0.5);
  double bestX = NAN, bestY = NAN, bestCost = INFINITY, otherCost = INFINITY;
  double candidates[36][3];
  for (int k = 0; k < 36; ++k) {
    const double angle = k * 10 * 3.14159265358979323846 / 180;
    double bx = last.x + seedRadius * std::sin(angle), by = last.y + seedRadius * std::cos(angle);
    walkRefine(samples, count, bx, by);
    candidates[k][0] = bx; candidates[k][1] = by; candidates[k][2] = walkCost(samples, count, bx, by);
    if (candidates[k][2] < bestCost) { bestCost = candidates[k][2]; bestX = bx; bestY = by; }
  }
  const double separation = std::fmax(1.0, 0.25 * std::hypot(bestX - last.x, bestY - last.y));
  for (auto &candidate : candidates)
    if (std::hypot(candidate[0] - bestX, candidate[1] - bestY) > separation) otherCost = std::fmin(otherCost, candidate[2]);
  fix.x = bestX; fix.y = bestY;

  // Robust spread of the residuals (outliers do not inflate it).
  double absolute[WALK_MAX_SAMPLES];
  for (int i = 0; i < count; ++i) absolute[i] = std::abs(walkResidual(samples[i], bestX, bestY));
  std::sort(absolute, absolute + count);
  const double median = count % 2 ? absolute[count / 2] : 0.5 * (absolute[count / 2 - 1] + absolute[count / 2]);
  const double robust = 1.4826 * median;
  fix.sigmaMetres = std::fmax(WALK_MIN_SIGMA_METRES, robust);
  if (robust > WALK_MAX_SIGMA_METRES || walkResidualsTrend(samples, count, bestX, bestY)) {
    fix.reason = "inconsistent";
    return fix;
  }
  if (otherCost < WALK_AMBIGUITY_RATIO * bestCost + 0.02 * count) { fix.reason = "turn"; return fix; }

  double hxx, hxy, hyy;
  walkNormal(samples, count, bestX, bestY, hxx, hxy, hyy);
  const double det = hxx * hyy - hxy * hxy;
  if (!(det > 1e-9)) { fix.reason = "turn"; return fix; }
  const double variance = fix.sigmaMetres * fix.sigmaMetres;
  fix.covXX = variance * hyy / det; fix.covYY = variance * hxx / det; fix.covXY = -variance * hxy / det;
  if (fix.distanceFrom(last.x, last.y) < WALK_NEAR_METRES) { fix.reason = "near"; return fix; }
  fix.bearingUncertaintyDegrees = fix.uncertaintyFrom(last.x, last.y);
  if (fix.bearingUncertaintyDegrees > WALK_MAX_BEARING_UNCERTAINTY_DEGREES) { fix.reason = "uncertain"; return fix; }
  fix.valid = true;
  fix.reason = "ok";
  return fix;
}
