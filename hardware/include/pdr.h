#pragma once
#include <cmath>
#include <stdint.h>

// Pedestrian dead reckoning for walk-to-find: counts steps from the vertical
// bounce and turns from the gyroscope about "up" (from gravity). It assumes
// the band's top points where the wearer walks and a fixed step length, so a
// path is an estimate; the walk solver checks it against Wi-Fi ranges.
struct ImuReading {
  uint32_t micros;
  double accel[3];  // g, body axes (specific force: reads "up" at rest)
  double gyro[3];   // deg/s, same axes
};

constexpr double PDR_STEP_LENGTH_METRES = 0.7;
constexpr double PDR_STEP_THRESHOLD_G = 0.10;
constexpr uint32_t PDR_MIN_STEP_MICROS = 300000;
constexpr double PDR_STILL_GYRO_DPS = 3.0;
constexpr double PDR_STILL_ACCEL_G = 0.02;
constexpr double PDR_STILL_SECONDS = 0.5;
constexpr double PDR_MAX_OFFSET_DPS = 10.0;

class WalkTracker {
  bool started_ = false, biasKnown_ = false, armed_ = true, above_ = false;
  uint32_t last_ = 0, lastStep_ = 0;
  double up_[3] = {0, 0, 1}, gravity_ = 1, normAverage_ = 1, gyroAverage_[3] = {}, bias_[3] = {};
  double stillSeconds_ = 0, heading_ = 0, x_ = 0, y_ = 0, vertical_ = 0;
  int steps_ = 0;

 public:
  // New walk origin and heading; keeps the learned gyro offset and gravity.
  void reset() {
    heading_ = x_ = y_ = 0;
    steps_ = 0;
    armed_ = true;
    above_ = false;
  }

  void update(const ImuReading &reading) {
    const double *a = reading.accel, *g = reading.gyro;
    const double norm = std::sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    if (!(norm > 0.2)) return;
    if (!started_) {
      started_ = true;
      last_ = reading.micros;
      for (int i = 0; i < 3; ++i) { up_[i] = a[i] / norm; gyroAverage_[i] = g[i]; }
      gravity_ = normAverage_ = norm;
      return;
    }
    const double dt = uint32_t(reading.micros - last_) / 1e6;
    last_ = reading.micros;
    if (!(dt > 0) || dt > 0.1) return;  // skip gaps rather than integrate them

    const double slow = dt / (0.6 + dt), fast = dt / (0.3 + dt);
    normAverage_ += (norm - normAverage_) * slow;
    double upLength = 0;
    for (int i = 0; i < 3; ++i) {
      gyroAverage_[i] += (g[i] - gyroAverage_[i]) * fast;
      up_[i] += (a[i] / norm - up_[i]) * slow;
      upLength += up_[i] * up_[i];
    }
    upLength = std::sqrt(upLength);
    for (double &component : up_) component /= upLength;

    // Still: steady gravity and no rotation. Before the offset is known, a
    // small constant reading is the offset; afterwards, turns are excluded.
    bool quiet = std::abs(norm - normAverage_) < PDR_STILL_ACCEL_G;
    for (int i = 0; i < 3; ++i)
      quiet = quiet && (biasKnown_ ? std::abs(g[i] - bias_[i]) < PDR_STILL_GYRO_DPS
                                   : std::abs(g[i]) < PDR_MAX_OFFSET_DPS && std::abs(g[i] - gyroAverage_[i]) < 1.0);
    stillSeconds_ = quiet ? stillSeconds_ + dt : 0;
    if (stillSeconds_ >= PDR_STILL_SECONDS) {
      for (int i = 0; i < 3; ++i) bias_[i] = biasKnown_ ? bias_[i] + (gyroAverage_[i] - bias_[i]) * 0.05 : gyroAverage_[i];
      gravity_ = biasKnown_ ? gravity_ + (normAverage_ - gravity_) * 0.05 : normAverage_;
      biasKnown_ = true;
    }

    double counterClockwise = 0, upward = 0;
    for (int i = 0; i < 3; ++i) { counterClockwise += (g[i] - bias_[i]) * up_[i]; upward += a[i] * up_[i]; }
    heading_ -= counterClockwise * dt;

    // Steps: one per peak of the low-passed vertical bounce.
    vertical_ += (upward - gravity_ - vertical_) * (dt / (1 / (2 * 3.14159265358979323846 * 5) + dt));
    if (armed_ && vertical_ > PDR_STEP_THRESHOLD_G) above_ = true;
    if (above_ && vertical_ < PDR_STEP_THRESHOLD_G * 0.5) {
      above_ = armed_ = false;
      if (!steps_ || uint32_t(reading.micros - lastStep_) >= PDR_MIN_STEP_MICROS) {
        const double radians = heading_ * 3.14159265358979323846 / 180;
        x_ += PDR_STEP_LENGTH_METRES * std::sin(radians);
        y_ += PDR_STEP_LENGTH_METRES * std::cos(radians);
        lastStep_ = reading.micros;
        ++steps_;
      }
    }
    if (!armed_ && vertical_ < 0) armed_ = true;
  }

  double headingDegrees() const { return std::fmod(std::fmod(heading_, 360.0) + 540.0, 360.0) - 180.0; }
  double x() const { return x_; }
  double y() const { return y_; }
  int steps() const { return steps_; }
  bool biasKnown() const { return biasKnown_; }
};
