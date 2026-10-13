#include <cassert>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <string>
#include <vector>
#include "../include/ranging.h"

static FtmFrame frame(int64_t roundTripPs) {
  // Responder departure/arrival around a fixed 10 us initiator turnaround.
  const uint64_t t1 = 5000000, t2 = 7000000, t3 = t2 + 10000000;
  return {t1, t2, t3, uint64_t(int64_t(t1) + int64_t(t3 - t2) + roundTripPs)};
}

static std::vector<FtmFrame> frames(std::initializer_list<int64_t> values) {
  std::vector<FtmFrame> out;
  for (auto value : values) out.push_back(frame(value));
  return out;
}

static bool near(double a, double b, double tolerance = 1e-9) { return std::abs(a - b) <= tolerance; }

static void sessionEstimator() {
  // Signed round trips can be negative before calibration; they are not clamped.
  auto bimodal = frames({-21875, -20313, -18750, -9375, -7813, -21875, -20313, -18750,
                         -9375, -7813, -21875, -20313, -18750, -9375});
  auto session = rangeSession(bimodal.data(), int(bimodal.size()));
  assert(session.valid && session.frames == 14);
  // 20th percentile of the round trips (earliest arrivals) in one-way metres:
  // sorted index 2.6 lies between -21875 and -20313 ps.
  assert(near(session.rawMetres, (-21875 + 0.6 * 1562) * RANGE_PS_TO_METRES, 1e-6));
  assert(session.rawMetres < 0);

  // Frames with missing timestamps or implausible round trips are ignored.
  auto mixed = frames({1000, 1000, 1000, 1000, 1000, 1000, 1000, 5000000, -5000000});
  mixed.push_back({0, 7000000, 17000000, 17005000});
  mixed.push_back({5000000, 0, 17000000, 17005000});
  auto filtered = rangeSession(mixed.data(), int(mixed.size()));
  assert(!filtered.valid && filtered.frames == 7);

  auto enough = frames({1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000});
  auto ok = rangeSession(enough.data(), int(enough.size()));
  assert(ok.valid && ok.frames == RANGE_MIN_FRAMES && near(ok.rawMetres, 1000 * RANGE_PS_TO_METRES));
  assert(!rangeSession(nullptr, 0).valid);
  assert(!rangeSession(enough.data(), -1).valid);
}

static void calibration() {
  // Fitted to touching, 0.28 m and 1.2 m clear-line-of-sight desk positions.
  assert(calibratedRangeMetres(-3.226) < 0.05);
  assert(near(calibratedRangeMetres(-1.995), 0.40, 0.02));
  assert(near(calibratedRangeMetres(RANGE_CAL_LIMIT_RAW_METRES),
              RANGE_CAL_INTERCEPT_METRES + RANGE_CAL_SLOPE * RANGE_CAL_LIMIT_RAW_METRES));
  // Beyond the calibrated span the reading follows time of flight (slope 1).
  const double edge = calibratedRangeMetres(RANGE_CAL_LIMIT_RAW_METRES);
  assert(near(calibratedRangeMetres(RANGE_CAL_LIMIT_RAW_METRES + 10), edge + 10));
  // Never negative and monotonic across the whole span.
  assert(calibratedRangeMetres(-50) == 0);
  double previous = -1;
  for (double raw = -6; raw <= 30; raw += 0.01) {
    const double value = calibratedRangeMetres(raw);
    assert(value >= 0 && value + 1e-12 >= previous);
    previous = value;
  }
  assert(std::isnan(calibratedRangeMetres(NAN)));
}

static RangeSession session(double raw) { return {true, raw, 14}; }
static const RangeSession FAILED{false, 0, 0};

static void tracker() {
  RangeTracker tracker;
  auto empty = tracker.reading(1000);
  assert(!empty.valid && std::string(empty.state) == "waiting");

  const double touching = -3.226, apart = 0.169;
  tracker.addSession(session(touching), 1000);
  auto first = tracker.reading(1000);
  assert(first.valid && first.sessions == 1 && first.ageMillis == 0);
  assert(near(first.metres, calibratedRangeMetres(touching)));
  assert(first.uncertaintyMetres >= RANGE_NEAR_UNCERTAINTY_METRES);

  // Moving average over the latest three sessions reduces session noise.
  tracker.addSession(session(touching), 1600);
  tracker.addSession(session(apart), 2200);
  auto moving = tracker.reading(2200);
  const double expected = (2 * calibratedRangeMetres(touching) + calibratedRangeMetres(apart)) / 3;
  assert(moving.valid && near(moving.metres, expected));
  tracker.addSession(session(apart), 2800);
  tracker.addSession(session(apart), 3400);
  tracker.addSession(session(apart), 4000);
  auto settled = tracker.reading(4000);
  assert(near(settled.metres, calibratedRangeMetres(apart)));
  // Outside the near zone the documented calibration error dominates.
  assert(settled.uncertaintyMetres >= RANGE_FAR_UNCERTAINTY_METRES);

  // Stale: no successful session for longer than the TTL hides the reading.
  auto aging = tracker.reading(4000 + RANGE_TTL_MS - 1);
  assert(aging.valid && aging.ageMillis == RANGE_TTL_MS - 1);
  auto stale = tracker.reading(4000 + RANGE_TTL_MS);
  assert(!stale.valid && std::string(stale.state) == "stale");

  // Consecutive failures invalidate immediately and discard old samples.
  RangeTracker failing;
  failing.addSession(session(apart), 10000);
  for (int index = 1; index < RANGE_MAX_FAILURES; ++index) failing.addSession(FAILED, 10000 + index * 600);
  assert(failing.reading(11300).valid);
  failing.addSession(FAILED, 11800);
  auto lost = failing.reading(11800);
  assert(!lost.valid && std::string(lost.state) == "no_response");
  // Recovery uses only fresh measurements, not the pre-failure average.
  failing.addSession(session(touching), 12400);
  auto recovered = failing.reading(12400);
  assert(recovered.valid && recovered.sessions == 1);
  assert(near(recovered.metres, calibratedRangeMetres(touching)));

  // Wide disagreement between sessions widens the reported uncertainty.
  RangeTracker noisy;
  noisy.addSession(session(-3.2), 0);
  noisy.addSession(session(4.0), 600);
  noisy.addSession(session(-3.2), 1200);
  auto spread = noisy.reading(1200);
  assert(spread.valid && spread.uncertaintyMetres > RANGE_FAR_UNCERTAINTY_METRES);

  // millis() wraparound keeps ages correct.
  RangeTracker wrap;
  wrap.addSession(session(touching), 0xFFFFFF00u);
  auto wrapped = wrap.reading(0x00000100u);
  assert(wrapped.valid && wrapped.ageMillis == 0x200);
  assert(!wrap.reading(0xFFFFFF00u + RANGE_TTL_MS).valid);
}

int main() {
  sessionEstimator();
  calibration();
  tracker();
  std::cout << "PASS: FTM session estimator, desk calibration, moving average, stale/failure invalidation and recovery\n";
}
