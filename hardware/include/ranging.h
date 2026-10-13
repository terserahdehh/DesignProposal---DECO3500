#pragma once
#include <algorithm>
#include <cmath>
#include <stdint.h>

// Wi-Fi Fine Timing Measurement (802.11mc) between the two bands: each band
// answers as a hidden SoftAP responder and times round trips to the other.
// It measures separation only; it cannot tell which direction the peer is.
struct FtmFrame { uint64_t t1, t2, t3, t4; };  // picoseconds, from the FTM report
struct RangeSession { bool valid; double rawMetres; int frames; };

constexpr double RANGE_PS_TO_METRES = 0.299792458 / 2.0 / 1000.0;  // one-way
constexpr int RANGE_MIN_FRAMES = 8;
constexpr int RANGE_MAX_FRAMES = 64;
constexpr int64_t RANGE_MAX_ABS_RTT_PS = 2000000;

// The 20th percentile favours the earliest (direct-path) arrivals. Raw values
// are signed: at short range the uncalibrated round trip is negative.
inline RangeSession rangeSession(const FtmFrame *frames, int count) {
  RangeSession session{false, NAN, 0};
  if (!frames || count <= 0) return session;
  double rtt[RANGE_MAX_FRAMES];
  int n = 0;
  for (int index = 0; index < count && n < RANGE_MAX_FRAMES; ++index) {
    const FtmFrame &frame = frames[index];
    if (!frame.t1 || !frame.t2 || !frame.t3 || !frame.t4) continue;
    const int64_t value = int64_t(frame.t4 - frame.t1) - int64_t(frame.t3 - frame.t2);
    if (value <= -RANGE_MAX_ABS_RTT_PS || value >= RANGE_MAX_ABS_RTT_PS) continue;
    rtt[n++] = double(value);
  }
  session.frames = n;
  if (n < RANGE_MIN_FRAMES) return session;
  std::sort(rtt, rtt + n);
  const double position = (n - 1) * 0.2;
  const int low = int(position), high = std::min(low + 1, n - 1);
  session.rawMetres = (rtt[low] + (rtt[high] - rtt[low]) * (position - low)) * RANGE_PS_TO_METRES;
  session.valid = std::isfinite(session.rawMetres);
  return session;
}

// Fitted on 13 Oct 2026 to these two boards lying flat in clear line of sight
// on a desk: touching, 0.28 m and 1.2 m. Held-out positions read 0.62 m as
// about 2.0 m (multipath) and an obstructed 0.25 m as about 0.6 m. Beyond the
// fitted span the reading assumes pure time of flight and is uncalibrated.
constexpr double RANGE_CAL_SLOPE = 0.350;
constexpr double RANGE_CAL_INTERCEPT_METRES = 1.098;
constexpr double RANGE_CAL_LIMIT_RAW_METRES = 0.169;
constexpr double RANGE_CALIBRATED_UP_TO_METRES = 1.2;

inline double calibratedRangeMetres(double raw) {
  if (!std::isfinite(raw)) return NAN;
  const double edge = RANGE_CAL_INTERCEPT_METRES + RANGE_CAL_SLOPE * RANGE_CAL_LIMIT_RAW_METRES;
  const double value = raw <= RANGE_CAL_LIMIT_RAW_METRES ? RANGE_CAL_INTERCEPT_METRES + RANGE_CAL_SLOPE * raw
                                                          : edge + (raw - RANGE_CAL_LIMIT_RAW_METRES);
  return std::fmax(0.0, value);
}

struct RangeReading {
  bool valid;
  double metres, uncertaintyMetres;
  uint32_t ageMillis;
  int sessions;
  const char *state;  // ok, waiting, stale, no_response
};

constexpr uint32_t RANGE_TTL_MS = 2500;
constexpr int RANGE_WINDOW = 3;
constexpr int RANGE_MAX_FAILURES = 3;
// Measured repeatability near touching, and the held-out error elsewhere.
constexpr double RANGE_NEAR_ZONE_METRES = 0.4;
constexpr double RANGE_NEAR_UNCERTAINTY_METRES = 0.15;
constexpr double RANGE_FAR_UNCERTAINTY_METRES = 1.5;

class RangeTracker {
  double window_[RANGE_WINDOW] = {};
  int count_ = 0, next_ = 0, failures_ = 0;
  uint32_t lastValid_ = 0;
  bool lost_ = false;

 public:
  void addSession(const RangeSession &session, uint32_t now) {
    if (session.valid && std::isfinite(session.rawMetres)) {
      window_[next_] = calibratedRangeMetres(session.rawMetres);
      next_ = (next_ + 1) % RANGE_WINDOW;
      count_ = std::min(count_ + 1, RANGE_WINDOW);
      failures_ = 0;
      lastValid_ = now;
      lost_ = false;
      return;
    }
    if (++failures_ >= RANGE_MAX_FAILURES) {
      count_ = next_ = 0;
      lost_ = true;
    }
  }

  RangeReading reading(uint32_t now) const {
    RangeReading reading{false, NAN, NAN, 0, count_, lost_ ? "no_response" : "waiting"};
    if (!count_) return reading;
    reading.ageMillis = now - lastValid_;
    if (reading.ageMillis >= RANGE_TTL_MS) {
      reading.state = "stale";
      return reading;
    }
    double sum = 0, squares = 0;
    for (int index = 0; index < count_; ++index) sum += window_[index];
    const double mean = sum / count_;
    for (int index = 0; index < count_; ++index) squares += (window_[index] - mean) * (window_[index] - mean);
    const double floor = mean <= RANGE_NEAR_ZONE_METRES ? RANGE_NEAR_UNCERTAINTY_METRES : RANGE_FAR_UNCERTAINTY_METRES;
    reading.metres = mean;
    reading.uncertaintyMetres = std::fmax(floor, 2 * std::sqrt(squares / count_));
    reading.valid = true;
    reading.state = "ok";
    return reading;
  }
};
