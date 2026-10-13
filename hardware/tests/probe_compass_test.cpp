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
    still(2.5, from);
    move(1);
    still(3.5, to);
  }
};

static void oneMoveIsEnoughForAnArrow() {
  // The user's rule: move one way; closer means the arrow points there,
  // farther means it points away from there.
  Rig closer;
  closer.probe(90, 1.0, 0.6);
  auto toward = closer.compass.estimate(closer.now, closer.heading);
  assert(toward.valid && toward.probes == 1);
  assert(gap(toward.bearingFromTop, 0) < 1);         // straight ahead
  assert(gap(toward.headingFrameBearing, 90) < 1);
  assert(toward.uncertaintyDegrees >= 80);           // one move is a rough hint
  Rig farther;
  farther.probe(90, 0.6, 1.0);
  auto away = farther.compass.estimate(farther.now, farther.heading);
  assert(away.valid && gap(away.bearingFromTop, 180) < 1);  // behind the move
}

static void oneJumpyReadingDoesNotFlipAMove() {
  // Still bands occasionally read a single spike (up to 1.3 m observed).
  Rig rig;
  rig.heading = 90;
  rig.still(2.5, 1.0);
  rig.move(1);
  rig.compass.motion(false, rig.heading, rig.now);
  const double after[] = {0.6, 0.6, 2.3, 0.6, 0.6};
  for (double metres : after) { rig.now += 610; rig.compass.motion(false, rig.heading, rig.now); rig.compass.range(metres, rig.now); }
  auto estimate = rig.compass.estimate(rig.now, rig.heading);
  assert(rig.compass.lastProbe() == ProbeResult::Counted && rig.compass.lastChange() < 0);
  assert(estimate.valid && gap(estimate.bearingFromTop, 0) < 1);
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
  // Between the two aims; the newer move counts slightly more.
  assert(gap(estimate.headingFrameBearing, 45) < 5);
  // Turning the band after probing turns the arrow back the other way.
  assert(gap(estimate.bearingFromTop, estimate.headingFrameBearing - 90) < 1e-6);
  auto turned = rig.compass.estimate(rig.now, 0);
  assert(gap(turned.bearingFromTop, estimate.headingFrameBearing) < 1e-6);
  rig.probe(270, 1.5, 2.0);  // left: farther, agrees with up-right
  auto more = rig.compass.estimate(rig.now, rig.heading);
  assert(more.probes == 3 && more.uncertaintyDegrees < estimate.uncertaintyDegrees);
}

static void tooSmallAChangeIsIgnored() {
  Rig rig;
  // Measured 13 Oct with both bands lying still: the median-of-5 before/after
  // change was typically 0.00-0.03 m; the band handled a 5.7 cm desk move as noise.
  rig.probe(90, 1.50, 1.43);
  auto estimate = rig.compass.estimate(rig.now, rig.heading);
  assert(!estimate.valid && estimate.probes == 0);
  assert(rig.compass.lastProbe() == ProbeResult::NoChange);
}

static void turningWhileMovingOrShortRestsDiscardTheProbe() {
  // Observed: the yellow band spun while being handled and every move was
  // thrown away. Now the direction is where its top faced when it stopped.
  Rig turned;
  turned.heading = 0;
  turned.still(2, 0.6);
  turned.move(1, 180);
  turned.still(3.5, 0.3);
  auto spun = turned.compass.estimate(turned.now, turned.heading);
  assert(turned.compass.lastProbe() == ProbeResult::Counted);
  assert(spun.valid && gap(spun.headingFrameBearing, 180) < 1 && gap(spun.bearingFromTop, 0) < 1);

  Rig hurried;
  hurried.compass.motion(false, 0, hurried.now);
  hurried.compass.range(0.6, hurried.now);  // only one reading before moving
  hurried.now += 300;
  hurried.move(1);
  hurried.still(3.5, 0.3);
  assert(!hurried.compass.estimate(hurried.now, 0).valid);
  assert(hurried.compass.lastProbe() == ProbeResult::NotEnoughReadings);
}

static void shortPausesDoNotBreakAMove() {
  // Observed: moving the yellow band from 0.88 m to touching with 0.5-0.7 s
  // pauses was dropped as "interrupted" and the 0.9 m change was lost.
  Rig rig;
  rig.heading = 30;
  rig.still(2.5, 0.9);
  rig.move(0.8);
  rig.still(0.6, 0.6);
  rig.move(0.8);
  rig.still(0.7, 0.3);
  rig.move(0.5);
  rig.still(3.5, 0.05);
  auto estimate = rig.compass.estimate(rig.now, rig.heading);
  assert(rig.compass.lastProbe() == ProbeResult::Counted && estimate.probes == 1);
  assert(std::abs(rig.compass.lastChange() + 0.85) < 1e-9);
  assert(estimate.valid && gap(estimate.bearingFromTop, 0) < 1);
}

static void longHandlingStillCounts() {
  // Observed: holding and turning a band for over 15 s was "interrupted".
  Rig rig;
  rig.heading = 45;
  rig.still(2.5, 0.8);
  for (int i = 0; i < 12; ++i) { rig.move(1.5); rig.still(0.6, 0.6); }
  rig.still(3.5, 0.5);
  assert(rig.compass.lastProbe() == ProbeResult::Counted);
  auto estimate = rig.compass.estimate(rig.now, 45);
  assert(estimate.valid && gap(estimate.bearingFromTop, 0) < 1);
}

static void theDirectionIsWhereTheTopPointedWhileMoving() {
  // No aiming step: a gentle turn while moving averages out.
  Rig rig;
  rig.heading = 80;
  rig.still(2.5, 1.0);
  rig.move(1, 20);  // 80 -> 100 degrees
  rig.still(3.5, 0.6);
  auto estimate = rig.compass.estimate(rig.now, 90);
  assert(estimate.valid && std::abs(estimate.headingFrameBearing - 90) < 1.5);
  assert(gap(estimate.bearingFromTop, 0) < 1.5);
}

static void theArrowStaysAndNewerMovesTakeOver() {
  // Observed: the arrow vanished exactly 60 s after its move while the user
  // was still testing. The arrow now stays until Find closes; older moves
  // just count for less, so a newer move wins if the friend has moved.
  Rig rig;
  rig.probe(90, 1.0, 0.6);
  auto later = rig.compass.estimate(rig.now + 10 * 60000, 90);
  assert(later.valid && gap(later.headingFrameBearing, 90) < 1);
  rig.now += 5 * 60000;
  rig.probe(270, 1.0, 0.6);  // friend is now the other way
  auto now = rig.compass.estimate(rig.now, 270);
  assert(now.valid && gap(now.headingFrameBearing, 270) < 1);
  // Strongly disagreeing moves keep an arrow with a capped uncertainty.
  Rig mixed;
  mixed.probe(0, 1.0, 0.6);
  mixed.probe(120, 1.0, 0.6);
  mixed.probe(240, 1.0, 0.7);
  auto rough = mixed.compass.estimate(mixed.now, 0);
  assert(rough.valid && rough.uncertaintyDegrees <= PROBE_MAX_UNCERTAINTY_DEGREES);
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
  rig.still(3.5, 0.5);
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
  rig.still(3.5, 0.5);
  assert(rig.compass.phase() == ProbePhase::Ready);
  assert(rig.compass.lastProbe() == ProbeResult::Counted && rig.compass.lastChange() < 0);
  rig.probe(270, 0.5, 1.0);
  assert(rig.compass.lastChange() > 0);
}

int main() {
  phasesGuideTheWearer();
  oneMoveIsEnoughForAnArrow();
  oneJumpyReadingDoesNotFlipAMove();
  movingCloserPullsTheArrowThere();
  movingFartherPushesTheArrowAway();
  probesInTwoDirectionsNarrowTheArrow();
  tooSmallAChangeIsIgnored();
  turningWhileMovingOrShortRestsDiscardTheProbe();
  shortPausesDoNotBreakAMove();
  theDirectionIsWhereTheTopPointedWhileMoving();
  longHandlingStillCounts();
  theArrowStaysAndNewerMovesTakeOver();
  invalidDistancesAreIgnored();
  std::cout << "PASS: warmer/colder probes, two-direction narrowing, noise, turns, short rests, expiry and reset\n";
}
