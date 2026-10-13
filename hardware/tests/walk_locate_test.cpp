#include <cassert>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <vector>
#include "../include/walk_locate.h"

static const double PI_ = 3.14159265358979323846;

struct Rng {  // deterministic noise for repeatable tests
  uint32_t state;
  double uniform() { state = state * 1664525u + 1013904223u; return (state >> 8) / double(1 << 24); }
  double symmetric(double amplitude) { return (uniform() * 2 - 1) * amplitude; }
};

static std::vector<WalkRange> walk(const std::vector<std::pair<double, double>> &corners, double tx, double ty,
                                   double noise = 0, uint32_t seed = 1, double spacing = 0.7) {
  std::vector<WalkRange> out;
  Rng rng{seed};
  for (size_t leg = 0; leg + 1 < corners.size(); ++leg) {
    const double dx = corners[leg + 1].first - corners[leg].first, dy = corners[leg + 1].second - corners[leg].second;
    const int steps = std::max(1, int(std::lround(std::hypot(dx, dy) / spacing)));
    for (int step = (leg == 0 ? 0 : 1); step <= steps; ++step) {
      const double x = corners[leg].first + dx * step / steps, y = corners[leg].second + dy * step / steps;
      out.push_back({x, y, std::hypot(tx - x, ty - y) + rng.symmetric(noise)});
    }
  }
  return out;
}

static double bearingTo(double fromX, double fromY, double toX, double toY) {
  return std::fmod(std::atan2(toX - fromX, toY - fromY) * 180 / PI_ + 360, 360);
}

static double gap(double a, double b) { return std::abs(std::fmod(a - b + 540, 360) - 180); }

static void exactLShapedWalkFindsTheFriend() {
  // Walk 4 m forward then 4 m right; the friend stands at (6, -2).
  auto samples = walk({{0, 0}, {0, 4}, {4, 4}}, 6, -2);
  auto fix = locateFromWalk(samples.data(), int(samples.size()));
  assert(fix.valid && std::strcmp(fix.reason, "ok") == 0);
  assert(std::hypot(fix.x - 6, fix.y + 2) < 0.05);
  const auto &last = samples.back();
  assert(gap(fix.bearingFrom(last.x, last.y), bearingTo(4, 4, 6, -2)) < 1);
  assert(std::abs(fix.distanceFrom(last.x, last.y) - std::hypot(2, 6)) < 0.05);
}

static void noisyRangesStayWithinTheReportedUncertainty() {
  int within = 0, trials = 0;
  for (uint32_t seed = 1; seed <= 20; ++seed) {
    auto samples = walk({{0, 0}, {0, 5}, {5, 5}}, -3, 9, 0.8, seed);
    auto fix = locateFromWalk(samples.data(), int(samples.size()));
    if (!fix.valid) continue;
    ++trials;
    const auto &last = samples.back();
    const double error = gap(fix.bearingFrom(last.x, last.y), bearingTo(last.x, last.y, -3, 9));
    assert(error < 25);  // +/-0.8 m ranges over a 10 m L-walk
    assert(fix.bearingUncertaintyDegrees > 0 && fix.bearingUncertaintyDegrees <= WALK_MAX_BEARING_UNCERTAINTY_DEGREES);
    within += error <= fix.bearingUncertaintyDegrees;
  }
  assert(trials >= 17);           // noise rarely blocks a good L-walk
  assert(within >= trials * 0.8); // the reported 2-sigma covers most errors
}

static void straightWalkIsMirrorAmbiguous() {
  // A straight line cannot tell left from right: refuse instead of guessing.
  auto samples = walk({{0, 0}, {0, 8}}, 5, 4);
  auto fix = locateFromWalk(samples.data(), int(samples.size()));
  assert(!fix.valid && std::strcmp(fix.reason, "turn") == 0);
}

static void shortOrSparseWalksAreRefused() {
  auto tiny = walk({{0, 0}, {0, 0.7}, {0.7, 0.7}}, 5, 5);
  auto shortFix = locateFromWalk(tiny.data(), int(tiny.size()));
  assert(!shortFix.valid && std::strcmp(shortFix.reason, "walk") == 0);
  auto samples = walk({{0, 0}, {0, 4}, {4, 4}}, 6, -2);
  auto sparse = locateFromWalk(samples.data(), WALK_MIN_SAMPLES - 1);
  assert(!sparse.valid && std::strcmp(sparse.reason, "walk") == 0);
  assert(!locateFromWalk(nullptr, 0).valid);
}

static void rangeOutliersDoNotFlipTheArrow() {
  auto samples = walk({{0, 0}, {0, 4}, {4, 4}}, 6, -2, 0.3, 7);
  samples[3].metres += 6;  // multipath spikes like the 0.62 m desk reading
  samples[9].metres += 5;
  auto fix = locateFromWalk(samples.data(), int(samples.size()));
  assert(fix.valid);
  const auto &last = samples.back();
  assert(gap(fix.bearingFrom(last.x, last.y), bearingTo(4, 4, 6, -2)) < 15);
}

static void aMovingFriendMakesTheFitInconsistent() {
  // The friend walks away during the seeker's walk: no single point fits.
  auto samples = walk({{0, 0}, {0, 4}, {4, 4}}, 6, -2);
  for (size_t i = 0; i < samples.size(); ++i) samples[i].metres += 0.6 * i;
  auto fix = locateFromWalk(samples.data(), int(samples.size()));
  assert(!fix.valid && std::strcmp(fix.reason, "inconsistent") == 0);
}

static void marchingInPlaceNextToTheFriendShowsNoArrow() {
  // Observed on Syifa's band: 9 counted steps while marching on the spot,
  // heading drifting 64 -> -13 degrees, friend ~0.5 m away the whole time.
  // A short arc fitted a point mid-path and briefly showed a false arrow.
  Rng rng{3};
  double x = 0, y = 0, heading = 64;
  std::vector<WalkRange> samples{{0, 0, 0.5}};
  for (int step = 1; step <= 9; ++step) {
    heading -= 8.5;
    x += 0.7 * std::sin(heading * PI_ / 180);
    y += 0.7 * std::cos(heading * PI_ / 180);
    samples.push_back({x, y, 0.5 + rng.symmetric(0.15)});
    if (step < 3) continue;  // every growing window must refuse
    auto fix = locateFromWalk(samples.data(), int(samples.size()));
    assert(!fix.valid);
  }
  // A walk far longer than twice the measured distance cannot have happened
  // around a friend that close: the path or the steps are wrong.
  auto last = locateFromWalk(samples.data(), int(samples.size()));
  assert(std::strcmp(last.reason, "inconsistent") == 0 || std::strcmp(last.reason, "near") == 0);
}

static void recordedMarchWindowFromSyifasBandShowsNoArrow() {
  // Real samples (13 Oct 2026, firmware telemetry): 7 counted-step positions
  // and calibrated Wi-Fi ranges while marching on the spot. The firmware of
  // that day showed a false arrow here for 41 sessions.
  const WalkRange recorded[] = {{0.00, 0.00, 1.52}, {0.08, 0.70, 0.00}, {0.19, 1.39, 0.11}, {0.12, 2.08, 0.84},
                                {0.21, 2.78, 0.69}, {0.46, 3.43, 0.44}, {0.81, 4.04, 0.56}};
  for (int count = WALK_MIN_SAMPLES; count <= 7; ++count) assert(!locateFromWalk(recorded, count).valid);
}

static void anImpossibleWalkIsInconsistent() {
  // Points 4 m apart cannot both be within 1.2 m of one friend.
  auto samples = walk({{0, 0}, {0, 4}, {4, 4}}, 6, -2);
  for (auto &sample : samples) sample.metres = 1.2;
  auto fix = locateFromWalk(samples.data(), int(samples.size()));
  assert(!fix.valid && std::strcmp(fix.reason, "inconsistent") == 0);
}

static void aCloseFriendNeedsNoArrow() {
  // Friend 1.2 m from the end of a proper L-walk: the pulse says "here".
  auto samples = walk({{0, 0}, {0, 4}, {4, 4}}, 4.5, 5.1);
  auto fix = locateFromWalk(samples.data(), int(samples.size()));
  assert(!fix.valid && std::strcmp(fix.reason, "near") == 0);
}

int main() {
  marchingInPlaceNextToTheFriendShowsNoArrow();
  recordedMarchWindowFromSyifasBandShowsNoArrow();
  anImpossibleWalkIsInconsistent();
  aCloseFriendNeedsNoArrow();
  exactLShapedWalkFindsTheFriend();
  noisyRangesStayWithinTheReportedUncertainty();
  straightWalkIsMirrorAmbiguous();
  shortOrSparseWalksAreRefused();
  rangeOutliersDoNotFlipTheArrow();
  aMovingFriendMakesTheFitInconsistent();
  std::cout << "PASS: walk-to-find trilateration, uncertainty, mirror ambiguity, short walks, outliers and moving friend\n";
}
