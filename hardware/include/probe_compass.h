#pragma once
#include <cmath>
#include <stdint.h>
#include <utility>

// Warmer/colder compass: aim the top of the band, move it forward and stop.
// The measured distance before and after says whether that direction leads
// toward the friend. Probes in several directions add up to an arrow. The
// direction of each move is the band's aim (gyroscope heading); the
// accelerometer cannot tell which way a gentle hand slide went.
enum class ProbeResult : uint8_t { None, Counted, NoChange, Turned, NotEnoughReadings, Interrupted };
// What the wearer should do now: wait, move, or hold still while measuring.
enum class ProbePhase : uint8_t { Waiting, Ready, Moving, Measuring };

// Measured 13 Oct 2026 with both bands lying still on a desk: the median of
// 5 readings before vs 5 after typically changed by 0.00-0.03 m but by up to
// 0.10-0.18 m one time in twenty. The user prefers an arrow that sometimes
// errs over one that rarely appears.
constexpr double PROBE_MIN_CHANGE_METRES = 0.10;
// When headings while moving disagree more than this (|mean vector|, about
// +/-45 degrees of spread), the move's direction is where the top faced when
// it stopped rather than the average.
constexpr double PROBE_MIN_AIM_AGREEMENT = 0.7;
constexpr int PROBE_BEFORE_READINGS = 3;  // at least; up to PROBE_AFTER_READINGS
constexpr int PROBE_AFTER_READINGS = 5;
constexpr uint32_t PROBE_MIN_MOVE_MS = 150;
constexpr uint32_t PROBE_SETTLE_MS = 300;  // a session may straddle the stop
// Moves never expire while Find is open; an older move counts half as much
// every half-life, so newer moves win if the friend has moved.
constexpr double PROBE_HALF_LIFE_MS = 45000;
constexpr double PROBE_MAX_UNCERTAINTY_DEGREES = 100;
constexpr int PROBE_MAX = 8;

struct ProbeEstimate {
  bool valid;
  int probes;
  double headingFrameBearing;  // in the heading frame since Find opened
  double bearingFromTop;       // clockwise from the band's top right now
  double uncertaintyDegrees;
};

inline double probeAngleGap(double a, double b) { return std::abs(std::fmod(a - b + 540.0, 360.0) - 180.0); }

class ProbeCompass {
  enum class Phase : uint8_t { Resting, Moving, Settling };
  struct Probe { double heading, change; uint32_t at; };
  Phase phase_ = Phase::Resting;
  double still_[PROBE_AFTER_READINGS] = {};
  int stillCount_ = 0, afterCount_ = 0, count_ = 0;
  double after_[PROBE_AFTER_READINGS] = {};
  double before_ = NAN, aimSin_ = 0, aimCos_ = 0, lastChange_ = NAN;
  int aimSamples_ = 0;
  double lastHeading_ = 0;
  bool haveBefore_ = false;
  uint32_t moveStart_ = 0, moveEnd_ = 0;
  Probe probes_[PROBE_MAX] = {};
  ProbeResult last_ = ProbeResult::None;

  // The median ignores the occasional single spike of a still band.
  static double median(const double *values, int count) {
    double sorted[PROBE_AFTER_READINGS];
    for (int i = 0; i < count; ++i) sorted[i] = values[i];
    for (int i = 1; i < count; ++i)
      for (int j = i; j > 0 && sorted[j] < sorted[j - 1]; --j) std::swap(sorted[j], sorted[j - 1]);
    return count % 2 ? sorted[count / 2] : 0.5 * (sorted[count / 2 - 1] + sorted[count / 2]);
  }

  void startMove(double heading, uint32_t now, const double *readings, int readingCount) {
    haveBefore_ = readingCount >= PROBE_BEFORE_READINGS;
    before_ = haveBefore_ ? median(readings, readingCount) : NAN;
    aimSin_ = aimCos_ = 0;
    aimSamples_ = 0;
    addAim(heading);
    moveStart_ = now;
    phase_ = Phase::Moving;
  }

  void addAim(double heading) {
    lastHeading_ = heading;
    const double radians = heading * 3.14159265358979323846 / 180;
    aimSin_ += std::sin(radians);
    aimCos_ += std::cos(radians);
    ++aimSamples_;
  }

  void finish(uint32_t now) {
    const double after = median(after_, afterCount_);
    lastChange_ = haveBefore_ ? after - before_ : NAN;
    const bool steadyAim = std::hypot(aimSin_, aimCos_) >= PROBE_MIN_AIM_AGREEMENT * aimSamples_;
    const double aim = steadyAim ? std::fmod(std::atan2(aimSin_, aimCos_) * 180 / 3.14159265358979323846 + 360, 360)
                                 : std::fmod(std::fmod(lastHeading_, 360.0) + 360.0, 360.0);
    if (!haveBefore_) last_ = ProbeResult::NotEnoughReadings;
    else if (std::abs(after - before_) < PROBE_MIN_CHANGE_METRES) last_ = ProbeResult::NoChange;
    else {
      if (count_ == PROBE_MAX) {
        for (int i = 1; i < PROBE_MAX; ++i) probes_[i - 1] = probes_[i];
        --count_;
      }
      probes_[count_++] = {aim, after - before_, now};
      last_ = ProbeResult::Counted;
    }
    // The settled readings are the next probe's starting distance.
    for (int i = 0; i < afterCount_; ++i) still_[i] = after_[i];
    stillCount_ = afterCount_;
    afterCount_ = 0;
    phase_ = Phase::Resting;
  }

 public:
  void reset() {
    phase_ = Phase::Resting;
    stillCount_ = afterCount_ = count_ = 0;
    haveBefore_ = false;
    last_ = ProbeResult::None;
    lastChange_ = NAN;
  }

  ProbePhase phase() const {
    if (phase_ == Phase::Moving) return ProbePhase::Moving;
    if (phase_ == Phase::Settling) return ProbePhase::Measuring;
    return stillCount_ >= PROBE_BEFORE_READINGS ? ProbePhase::Ready : ProbePhase::Waiting;
  }
  double lastChange() const { return lastChange_; }  // metres; negative = closer

  void motion(bool moving, double heading, uint32_t now) {
    if (moving) {
      if (phase_ == Phase::Resting) startMove(heading, now, still_, stillCount_);
      else if (phase_ == Phase::Settling) {
        // A short pause: the same move continues from its original start.
        afterCount_ = 0;
        phase_ = Phase::Moving;
        addAim(heading);
      } else {
        addAim(heading);
      }
      return;
    }
    if (phase_ != Phase::Moving) return;
    if (uint32_t(now - moveStart_) < PROBE_MIN_MOVE_MS) {
      phase_ = Phase::Resting;  // a twitch, not a move: keep the readings
      return;
    }
    moveEnd_ = now;
    afterCount_ = 0;
    phase_ = Phase::Settling;
  }

  void range(double metres, uint32_t now) {
    if (!std::isfinite(metres) || metres < 0) return;
    if (phase_ == Phase::Resting) {
      if (stillCount_ == PROBE_AFTER_READINGS) {
        for (int i = 1; i < PROBE_AFTER_READINGS; ++i) still_[i - 1] = still_[i];
        --stillCount_;
      }
      still_[stillCount_++] = metres;
    } else if (phase_ == Phase::Settling && uint32_t(now - moveEnd_) >= PROBE_SETTLE_MS) {
      after_[afterCount_++] = metres;
      if (afterCount_ == PROBE_AFTER_READINGS) finish(now);
    }
  }

  ProbeEstimate estimate(uint32_t now, double currentHeading) const {
    ProbeEstimate result{false, 0, NAN, NAN, 180};
    double vx = 0, vy = 0, total = 0;
    for (int i = 0; i < count_; ++i) {
      const double weight = std::pow(0.5, uint32_t(now - probes_[i].at) / PROBE_HALF_LIFE_MS);
      // Closer (negative change) votes toward the aim; farther votes away.
      const double radians = probes_[i].heading * 3.14159265358979323846 / 180;
      vx -= weight * probes_[i].change * std::sin(radians);
      vy -= weight * probes_[i].change * std::cos(radians);
      total += weight * std::abs(probes_[i].change);
      ++result.probes;
    }
    if (!result.probes) return result;
    const double agreement = std::hypot(vx, vy) / total;
    if (!(agreement > 1e-6)) return result;  // moves cancel out: no direction
    const double scatter = std::sqrt(-2 * std::log(std::fmin(1.0, agreement))) * 180 / 3.14159265358979323846;
    // Kept visible even when moves disagree, with the uncertainty capped.
    result.uncertaintyDegrees = std::fmin(PROBE_MAX_UNCERTAINTY_DEGREES, std::fmax(90 / std::sqrt(double(result.probes)), scatter));
    result.headingFrameBearing = std::fmod(std::atan2(vx, vy) * 180 / 3.14159265358979323846 + 360, 360);
    result.bearingFromTop = std::fmod(std::fmod(result.headingFrameBearing - currentHeading, 360.0) + 360.0, 360.0);
    result.valid = true;
    return result;
  }

  ProbeResult lastProbe() const { return last_; }
};
