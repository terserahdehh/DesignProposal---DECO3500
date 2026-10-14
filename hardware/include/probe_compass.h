#pragma once
#include <cmath>
#include <stdint.h>
#include <utility>
#include "slide_direction.h"

// Warmer/colder compass: slide the band across the table and stop. The
// measured distance and signal strength before and after say whether that
// direction leads toward the friend. Probes in several directions add up to
// an arrow. The direction of each move is the measured push (SlideDetector),
// not where the band's top points: on 13 Oct sideways slides left both arrows
// pointing up.
enum class ProbeResult : uint8_t { None, Counted, NoChange, Turned, NotEnoughReadings, Interrupted, Unmeasured, Unsure };
// What the wearer should do now: wait, move, or hold still while measuring.
enum class ProbePhase : uint8_t { Waiting, Ready, Moving, Measuring };

// Measured 13 Oct 2026 with both bands lying still on a desk: the median of
// 5 readings before vs 5 after typically changed by 0.00-0.03 m but by up to
// 0.10-0.18 m one time in twenty. A move also needs a measured push, so noise
// alone cannot count; a real 0.08 m approach was missed at 0.10 m. The user
// prefers an arrow that sometimes errs over one that rarely appears.
constexpr double PROBE_MIN_CHANGE_METRES = 0.07;
// Signal strength is a second warmer/colder reading. In five measured desk
// pushes of about 15 cm it rose 6-9 dB when closer and fell 5-22 dB when
// farther, always the right way; the Wi-Fi distance was wrong once (a push
// apart that weakened the signal by 22 dB read 0.11 m closer). Still bands
// varied by about 1 dB. Each 0.07 m or 4 dB counts as one unit of evidence.
constexpr double PROBE_SIGNAL_STEP_DB = 4;
constexpr double PROBE_MAX_DISTANCE_UNITS = 10, PROBE_MAX_SIGNAL_UNITS = 5;
// Readings pointing opposite ways with similar strength: no vote.
constexpr double PROBE_CONFLICT_RATIO = 0.5;
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
  double still_[PROBE_AFTER_READINGS] = {}, stillSignal_[PROBE_AFTER_READINGS] = {};
  int stillCount_ = 0, afterCount_ = 0, count_ = 0;
  double after_[PROBE_AFTER_READINGS] = {}, afterSignal_[PROBE_AFTER_READINGS] = {};
  double before_ = NAN, beforeSignal_ = NAN, pushX_ = 0, pushY_ = 0;
  double lastChange_ = NAN, lastSignalChange_ = NAN, lastEvidence_ = NAN, lastAim_ = NAN;
  bool haveBefore_ = false, spoiled_ = false;
  uint32_t moveStart_ = 0, moveEnd_ = 0;
  Probe probes_[PROBE_MAX] = {};
  ProbeResult last_ = ProbeResult::None;

  // The median ignores the occasional single spike of a still band. Missing
  // (NAN) values are skipped; too few known values give NAN.
  static double median(const double *values, int count) {
    double sorted[PROBE_AFTER_READINGS];
    int known = 0;
    for (int i = 0; i < count; ++i) if (std::isfinite(values[i])) sorted[known++] = values[i];
    if (known < PROBE_BEFORE_READINGS) return NAN;
    for (int i = 1; i < known; ++i)
      for (int j = i; j > 0 && sorted[j] < sorted[j - 1]; --j) std::swap(sorted[j], sorted[j - 1]);
    return known % 2 ? sorted[known / 2] : 0.5 * (sorted[known / 2 - 1] + sorted[known / 2]);
  }

  static double clamp(double value, double limit) { return std::fmax(-limit, std::fmin(limit, value)); }

  void startMove(uint32_t now) {
    haveBefore_ = stillCount_ >= PROBE_BEFORE_READINGS;
    before_ = haveBefore_ ? median(still_, stillCount_) : NAN;
    beforeSignal_ = haveBefore_ ? median(stillSignal_, stillCount_) : NAN;
    pushX_ = pushY_ = 0;
    spoiled_ = false;
    moveStart_ = now;
    phase_ = Phase::Moving;
  }

  void finish(uint32_t now) {
    const double after = median(after_, afterCount_), afterSignal = median(afterSignal_, afterCount_);
    lastChange_ = haveBefore_ ? after - before_ : NAN;
    lastSignalChange_ = haveBefore_ ? afterSignal - beforeSignal_ : NAN;
    // Positive evidence = closer: a shorter distance or a stronger signal.
    const double distance = clamp(-lastChange_ / PROBE_MIN_CHANGE_METRES, PROBE_MAX_DISTANCE_UNITS);
    const double signal = std::isfinite(lastSignalChange_) ? clamp(lastSignalChange_ / PROBE_SIGNAL_STEP_DB, PROBE_MAX_SIGNAL_UNITS) : 0;
    const bool conflict = distance * signal < 0 &&
                          std::fmin(std::abs(distance), std::abs(signal)) > PROBE_CONFLICT_RATIO * std::fmax(std::abs(distance), std::abs(signal));
    lastEvidence_ = haveBefore_ ? distance + signal : NAN;
    // Pushes within one move add up; a lift or turn leaves its way unknown.
    const bool measured = !spoiled_ && std::hypot(pushX_, pushY_) > 1e-9;
    const double aim = measured ? std::fmod(std::atan2(pushX_, pushY_) * 180 / 3.14159265358979323846 + 360, 360) : NAN;
    lastAim_ = aim;
    if (!haveBefore_) last_ = ProbeResult::NotEnoughReadings;
    else if (!measured) last_ = ProbeResult::Unmeasured;
    else if (conflict) last_ = ProbeResult::Unsure;
    else if (std::abs(lastEvidence_) < 1) last_ = ProbeResult::NoChange;
    else {
      if (count_ == PROBE_MAX) {
        for (int i = 1; i < PROBE_MAX; ++i) probes_[i - 1] = probes_[i];
        --count_;
      }
      // Stored as an equivalent distance change: negative = closer.
      probes_[count_++] = {aim, -lastEvidence_ * PROBE_MIN_CHANGE_METRES, now};
      last_ = ProbeResult::Counted;
    }
    // The settled readings are the next probe's starting distance.
    for (int i = 0; i < afterCount_; ++i) { still_[i] = after_[i]; stillSignal_[i] = afterSignal_[i]; }
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
    lastChange_ = lastSignalChange_ = lastEvidence_ = lastAim_ = NAN;
    spoiled_ = false;
  }

  ProbePhase phase() const {
    if (phase_ == Phase::Moving) return ProbePhase::Moving;
    if (phase_ == Phase::Settling) return ProbePhase::Measuring;
    return stillCount_ >= PROBE_BEFORE_READINGS ? ProbePhase::Ready : ProbePhase::Waiting;
  }
  double lastChange() const { return lastChange_; }              // metres; negative = closer
  double lastSignalChange() const { return lastSignalChange_; }  // dB; positive = closer
  double lastEvidence() const { return lastEvidence_; }          // units; positive = closer
  double lastAim() const { return lastAim_; }                    // heading frame; NAN if unmeasured

  // A finished push from the SlideDetector. A lift off the table or endless
  // handling means this move went somewhere unknown. Twitches, tipping and
  // turning in place leave the band where it was, so they are ignored:
  // observed 13 Oct, a finger letting go twisted a band right after a push.
  void push(const SlideResult &slide) {
    if (phase_ == Phase::Resting) return;
    if (slide.accepted) {
      const double radians = slide.headingFrameBearing * 3.14159265358979323846 / 180;
      pushX_ += slide.weight * std::sin(radians);
      pushY_ += slide.weight * std::cos(radians);
    } else if (slide.reject == SlideReject::Lifted || slide.reject == SlideReject::TooLong) {
      spoiled_ = true;
    }
  }

  void motion(bool moving, uint32_t now) {
    if (moving) {
      if (phase_ == Phase::Resting) startMove(now);
      else if (phase_ == Phase::Settling) {
        // A short pause: the same move continues from its original start.
        afterCount_ = 0;
        phase_ = Phase::Moving;
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

  // One ranging session: distance and its signal strength (dBm, NAN if unknown).
  void range(double metres, double signal, uint32_t now) {
    if (!std::isfinite(metres) || metres < 0) return;
    if (!std::isfinite(signal) || signal >= 0) signal = NAN;
    if (phase_ == Phase::Resting) {
      if (stillCount_ == PROBE_AFTER_READINGS) {
        for (int i = 1; i < PROBE_AFTER_READINGS; ++i) { still_[i - 1] = still_[i]; stillSignal_[i - 1] = stillSignal_[i]; }
        --stillCount_;
      }
      still_[stillCount_] = metres;
      stillSignal_[stillCount_++] = signal;
    } else if (phase_ == Phase::Settling && uint32_t(now - moveEnd_) >= PROBE_SETTLE_MS) {
      after_[afterCount_] = metres;
      afterSignal_[afterCount_++] = signal;
      if (afterCount_ == PROBE_AFTER_READINGS) finish(now);
    }
  }
  void range(double metres, uint32_t now) { range(metres, NAN, now); }

  ProbeEstimate estimate(uint32_t now, double currentHeading) const {
    ProbeEstimate result{false, 0, NAN, NAN, 180};
    double vx = 0, vy = 0, total = 0;
    double xx = 0, xy = 0, yy = 0;
    for (int i = 0; i < count_; ++i) {
      const double weight = std::pow(0.5, uint32_t(now - probes_[i].at) / PROBE_HALF_LIFE_MS);
      // Closer (negative change) votes toward the aim; farther votes away.
      const double radians = probes_[i].heading * 3.14159265358979323846 / 180;
      vx -= weight * probes_[i].change * std::sin(radians);
      vy -= weight * probes_[i].change * std::cos(radians);
      total += weight * std::abs(probes_[i].change);
      // Moving back and forth along one line never resolves which side of
      // that line the friend occupies. Count independent directions, rather
      // than treating repeated slides as increasingly precise bearings.
      const double evidence = weight * std::abs(probes_[i].change);
      xx += evidence * std::sin(radians) * std::sin(radians);
      xy += evidence * std::sin(radians) * std::cos(radians);
      yy += evidence * std::cos(radians) * std::cos(radians);
      ++result.probes;
    }
    if (!result.probes) return result;
    const double agreement = std::hypot(vx, vy) / total;
    if (!(agreement > 1e-6)) return result;  // moves cancel out: no direction
    const double scatter = std::sqrt(-2 * std::log(std::fmin(1.0, agreement))) * 180 / 3.14159265358979323846;
    const double coverage = std::fmax(0.0, std::fmin(1.0, 4 * (xx * yy - xy * xy) / (total * total)));
    // A heuristic spread, not a calibrated confidence interval. One line
    // stays a broad hint; perpendicular slides can narrow it.
    const double independent = 1 + coverage * (result.probes - 1);
    result.uncertaintyDegrees = std::fmin(PROBE_MAX_UNCERTAINTY_DEGREES, std::fmax(90 / std::sqrt(independent), scatter));
    result.headingFrameBearing = std::fmod(std::atan2(vx, vy) * 180 / 3.14159265358979323846 + 360, 360);
    result.bearingFromTop = std::fmod(std::fmod(result.headingFrameBearing - currentHeading, 360.0) + 360.0, 360.0);
    result.valid = true;
    return result;
  }

  ProbeResult lastProbe() const { return last_; }
};
