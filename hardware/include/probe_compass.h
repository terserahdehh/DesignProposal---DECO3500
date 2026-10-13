#pragma once
#include <cmath>
#include <stdint.h>

// Warmer/colder compass: aim the top of the band, move it forward and stop.
// The measured distance before and after says whether that direction leads
// toward the friend. Probes in several directions add up to an arrow. The
// direction of each move is the band's aim (gyroscope heading); the
// accelerometer cannot tell which way a gentle hand slide went.
enum class ProbeResult : uint8_t { None, Counted, NoChange, Turned, NotEnoughReadings, Interrupted };
// What the wearer should do now: wait, move, or hold still while measuring.
enum class ProbePhase : uint8_t { Waiting, Ready, Moving, Measuring };

// Measured 13 Oct 2026 with both bands lying still on a desk: a before/after
// change reached 0.14-0.25 m one time in ten (people nearby alter the radio
// path), so smaller changes are not evidence of a direction.
constexpr double PROBE_MIN_CHANGE_METRES = 0.3;
constexpr double PROBE_MAX_TURN_DEGREES = 45;
constexpr int PROBE_BEFORE_READINGS = 2;
constexpr int PROBE_AFTER_READINGS = 3;
constexpr uint32_t PROBE_MIN_MOVE_MS = 150;
constexpr uint32_t PROBE_MAX_MOVE_MS = 6000;
constexpr uint32_t PROBE_SETTLE_MS = 300;  // a session may straddle the stop
constexpr uint32_t PROBE_LIFETIME_MS = 60000;
constexpr double PROBE_MAX_UNCERTAINTY_DEGREES = 100;
constexpr int PROBE_MAX = 8;
// One probe cannot tell left from right: an arrow needs probes aimed this far apart.
constexpr double PROBE_MIN_AIM_SPREAD_DEGREES = 45;

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
  double still_[3] = {};
  int stillCount_ = 0, afterCount_ = 0, count_ = 0;
  double after_[PROBE_AFTER_READINGS] = {};
  double before_ = NAN, aim_ = 0, maxTurn_ = 0, lastChange_ = NAN;
  bool haveBefore_ = false;
  uint32_t moveStart_ = 0, moveEnd_ = 0;
  Probe probes_[PROBE_MAX] = {};
  ProbeResult last_ = ProbeResult::None;

  static double mean(const double *values, int count) {
    double sum = 0;
    for (int i = 0; i < count; ++i) sum += values[i];
    return sum / count;
  }

  void startMove(double heading, uint32_t now, const double *readings, int readingCount) {
    haveBefore_ = readingCount >= PROBE_BEFORE_READINGS;
    before_ = haveBefore_ ? mean(readings, readingCount) : NAN;
    aim_ = heading;
    maxTurn_ = 0;
    moveStart_ = now;
    phase_ = Phase::Moving;
  }

  void finish(uint32_t now) {
    const double after = mean(after_, afterCount_);
    lastChange_ = haveBefore_ ? after - before_ : NAN;
    if (maxTurn_ > PROBE_MAX_TURN_DEGREES) last_ = ProbeResult::Turned;
    else if (!haveBefore_) last_ = ProbeResult::NotEnoughReadings;
    else if (std::abs(after - before_) < PROBE_MIN_CHANGE_METRES) last_ = ProbeResult::NoChange;
    else {
      if (count_ == PROBE_MAX) {
        for (int i = 1; i < PROBE_MAX; ++i) probes_[i - 1] = probes_[i];
        --count_;
      }
      probes_[count_++] = {aim_, after - before_, now};
      last_ = ProbeResult::Counted;
    }
    // The settled readings are the next probe's starting distance.
    for (int i = 0; i < afterCount_ && i < 3; ++i) still_[i] = after_[i];
    stillCount_ = afterCount_ < 3 ? afterCount_ : 3;
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
        // Moved again before the distance settled: drop this probe.
        last_ = ProbeResult::Interrupted;
        double readings[PROBE_AFTER_READINGS];
        for (int i = 0; i < afterCount_; ++i) readings[i] = after_[i];
        const int readingCount = afterCount_;
        afterCount_ = 0;
        startMove(heading, now, readings, readingCount);
      } else {
        maxTurn_ = std::fmax(maxTurn_, probeAngleGap(heading, aim_));
        if (uint32_t(now - moveStart_) > PROBE_MAX_MOVE_MS) {
          last_ = ProbeResult::Interrupted;
          haveBefore_ = false;
        }
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
      if (stillCount_ == 3) { still_[0] = still_[1]; still_[1] = still_[2]; stillCount_ = 2; }
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
      if (uint32_t(now - probes_[i].at) >= PROBE_LIFETIME_MS) continue;
      // Closer (negative change) votes toward the aim; farther votes away.
      const double radians = probes_[i].heading * 3.14159265358979323846 / 180;
      vx -= probes_[i].change * std::sin(radians);
      vy -= probes_[i].change * std::cos(radians);
      total += std::abs(probes_[i].change);
      ++result.probes;
    }
    if (!result.probes) return result;
    double spread = 0;
    for (int i = 0; i < count_; ++i)
      for (int j = i + 1; j < count_; ++j)
        if (uint32_t(now - probes_[i].at) < PROBE_LIFETIME_MS && uint32_t(now - probes_[j].at) < PROBE_LIFETIME_MS)
          spread = std::fmax(spread, probeAngleGap(probes_[i].heading, probes_[j].heading));
    if (spread < PROBE_MIN_AIM_SPREAD_DEGREES) return result;
    const double agreement = std::hypot(vx, vy) / total;
    if (!(agreement > 0)) return result;
    const double scatter = std::sqrt(-2 * std::log(std::fmin(1.0, agreement))) * 180 / 3.14159265358979323846;
    result.uncertaintyDegrees = std::fmax(90 / std::sqrt(double(result.probes)), scatter);
    if (result.uncertaintyDegrees > PROBE_MAX_UNCERTAINTY_DEGREES) return result;
    result.headingFrameBearing = std::fmod(std::atan2(vx, vy) * 180 / 3.14159265358979323846 + 360, 360);
    result.bearingFromTop = std::fmod(std::fmod(result.headingFrameBearing - currentHeading, 360.0) + 360.0, 360.0);
    result.valid = true;
    return result;
  }

  ProbeResult lastProbe() const { return last_; }
};
