#include <cassert>
#include <cmath>
#include <cstdint>
#include <iostream>
#include "../include/probe_compass.h"

static double gap(double a, double b) { return std::abs(std::fmod(a - b + 540, 360) - 180); }

// Drives a compass the way the firmware does: motion state from the IMU about
// every 10 ms and one Wi-Fi distance per ranging session (~615 ms).
struct Rig {
  ProbeCompass compass;
  uint32_t now = 10000;
  double heading = 0;
  void still(double seconds, double metres) {
    for (int i = 0; i < seconds * 100; ++i) {
      compass.motion(false, heading, now);
      if (i % 61 == 0) compass.range(metres, now);
      now += 10;
    }
  }
  void move(double seconds, double turnDegrees = 0) {
    const int steps = int(seconds * 100);
    for (int i = 0; i < steps; ++i) {
      heading += turnDegrees / steps;
      compass.motion(true, heading, now);
      now += 10;
    }
  }
  // Aim the top at `aim`, push forward, stop; distance goes from -> to.
  void probe(double aim, double from, double to) {
    heading = aim;
    still(2, from);
    move(1);
    still(2.5, to);
  }
};

static void oneProbeIsCountedButShowsNoArrow() {
  // Observed: a single accidental move while arranging the bands showed an
  // arrow pointing down while the friend was to the left. One probe cannot
  // tell left from down, so it never shows an arrow on its own.
  Rig rig;
  rig.probe(90, 2.0, 1.5);
  auto one = rig.compass.estimate(rig.now, rig.heading);
  assert(!one.valid && one.probes == 1 && rig.compass.lastProbe() == ProbeResult::Counted);
  // A second probe along almost the same aim still cannot.
  rig.probe(110, 1.5, 1.0);
  assert(!rig.compass.estimate(rig.now, rig.heading).valid);
}

static void movingCloserPullsTheArrowThere() {
  Rig rig;
  rig.probe(90, 2.0, 1.5);   // toward the friend: closer
  rig.probe(270, 1.5, 2.0);  // away from the friend: farther
  rig.heading = 90;
  auto estimate = rig.compass.estimate(rig.now, rig.heading);
  assert(estimate.valid && estimate.probes == 2);
  // Facing 90 degrees again, the arrow points straight ahead.
  assert(gap(estimate.bearingFromTop, 0) < 1);
  assert(gap(estimate.headingFrameBearing, 90) < 1);
}

static void movingFartherPushesTheArrowAway() {
  Rig rig;
  rig.probe(0, 1.5, 2.0);    // up: farther
  rig.probe(180, 2.0, 1.5);  // down: closer
  auto estimate = rig.compass.estimate(rig.now, rig.heading);
  assert(estimate.valid && gap(estimate.headingFrameBearing, 180) < 1);
  assert(gap(estimate.bearingFromTop, 0) < 1);  // band now faces down
}

static void probesInTwoDirectionsNarrowTheArrow() {
  Rig rig;
  rig.probe(0, 2.5, 2.0);   // up: closer
  rig.probe(90, 2.0, 1.5);  // right: closer
  auto estimate = rig.compass.estimate(rig.now, rig.heading);
  assert(estimate.valid && estimate.probes == 2);
  assert(gap(estimate.headingFrameBearing, 45) < 1);
  // Turning the band after probing turns the arrow back the other way.
  assert(gap(estimate.bearingFromTop, 45 - 90) < 1);
  auto turned = rig.compass.estimate(rig.now, 0);
  assert(gap(turned.bearingFromTop, 45) < 1);
  rig.probe(270, 1.5, 2.0);  // left: farther, agrees with up-right
  auto more = rig.compass.estimate(rig.now, rig.heading);
  assert(more.probes == 3 && more.uncertaintyDegrees < estimate.uncertaintyDegrees);
}

static void tooSmallAChangeIsIgnored() {
  Rig rig;
  // Measured 13 Oct with both bands lying still: before/after changes reached
  // 0.14 m (yellow) and 0.25 m (purple) one time in ten; a desk move is no larger.
  rig.probe(90, 1.50, 1.25);
  auto estimate = rig.compass.estimate(rig.now, rig.heading);
  assert(!estimate.valid && estimate.probes == 0);
  assert(rig.compass.lastProbe() == ProbeResult::NoChange);
}

static void turningWhileMovingOrShortRestsDiscardTheProbe() {
  Rig turned;
  turned.heading = 0;
  turned.still(2, 0.6);
  turned.move(1, 60);  // aim is ambiguous after a 60 degree turn
  turned.still(2.5, 0.3);
  assert(!turned.compass.estimate(turned.now, turned.heading).valid);
  assert(turned.compass.lastProbe() == ProbeResult::Turned);

  Rig hurried;
  hurried.compass.motion(false, 0, hurried.now);
  hurried.compass.range(0.6, hurried.now);  // only one reading before moving
  hurried.now += 300;
  hurried.move(1);
  hurried.still(2.5, 0.3);
  assert(!hurried.compass.estimate(hurried.now, 0).valid);
  assert(hurried.compass.lastProbe() == ProbeResult::NotEnoughReadings);

  Rig restless;
  restless.still(2, 0.6);
  restless.move(1);
  restless.still(0.7, 0.3);  // moves again before the distance settles
  restless.move(1);
  restless.still(2.5, 0.3);
  // The interrupted probe is dropped; the second one has a settled start.
  auto estimate = restless.compass.estimate(restless.now, 0);
  assert(estimate.probes <= 1);
}

static void oldProbesExpireAndResetClearsEverything() {
  Rig rig;
  rig.probe(90, 2.0, 1.5);
  rig.probe(0, 1.5, 1.9);
  assert(rig.compass.estimate(rig.now, 90).valid);
  assert(!rig.compass.estimate(rig.now + PROBE_LIFETIME_MS, 90).valid);
  rig.probe(90, 2.0, 1.5);
  rig.compass.reset();
  assert(!rig.compass.estimate(rig.now, 90).valid && rig.compass.estimate(rig.now, 90).probes == 0);
}

static void invalidDistancesAreIgnored() {
  Rig rig;
  rig.heading = 90;
  rig.still(2, 1.0);
  rig.compass.range(NAN, rig.now);
  rig.compass.range(-1, rig.now);
  rig.move(1);
  rig.still(2.5, 0.5);
  assert(rig.compass.estimate(rig.now, 90).probes == 1);
}

static void phasesGuideTheWearer() {
  Rig rig;
  rig.heading = 90;
  assert(rig.compass.phase() == ProbePhase::Waiting);
  rig.still(2, 1.0);
  assert(rig.compass.phase() == ProbePhase::Ready);
  rig.move(0.5);
  assert(rig.compass.phase() == ProbePhase::Moving);
  rig.compass.motion(false, rig.heading, rig.now);
  assert(rig.compass.phase() == ProbePhase::Measuring);
  rig.still(2.5, 0.5);
  assert(rig.compass.phase() == ProbePhase::Ready);
  assert(rig.compass.lastProbe() == ProbeResult::Counted && rig.compass.lastChange() < 0);
  rig.probe(270, 0.5, 1.0);
  assert(rig.compass.lastChange() > 0);
}

int main() {
  phasesGuideTheWearer();
  oneProbeIsCountedButShowsNoArrow();
  movingCloserPullsTheArrowThere();
  movingFartherPushesTheArrowAway();
  probesInTwoDirectionsNarrowTheArrow();
  tooSmallAChangeIsIgnored();
  turningWhileMovingOrShortRestsDiscardTheProbe();
  oldProbesExpireAndResetClearsEverything();
  invalidDistancesAreIgnored();
  std::cout << "PASS: warmer/colder probes, two-direction narrowing, noise, turns, short rests, expiry and reset\n";
}
