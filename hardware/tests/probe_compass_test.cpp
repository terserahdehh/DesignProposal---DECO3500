#include <cassert>
#include <cmath>
#include <cstdint>
#include <iostream>
#include "../include/probe_compass.h"

static double gap(double a, double b) { return std::abs(std::fmod(a - b + 540, 360) - 180); }

// Drives a compass the way the firmware does: motion state from the slide
// detector about every 10 ms, its verdict as each move ends, and one Wi-Fi
// distance per ranging session (~615 ms).
struct Rig {
  ProbeCompass compass;
  uint32_t now = 10000;
  double heading = 0;  // where the band's top points now (heading frame)
  void still(double seconds, double metres, double signal = NAN) {
    for (int i = 0; i < seconds * 100; ++i) {
      compass.motion(false, now);
      if (i % 61 == 0) compass.range(metres, signal, now);
      now += 10;
    }
  }
  // A move whose push the detector measured toward `direction` (heading
  // frame), or rejected for `reject`.
  void move(double seconds, double direction, SlideReject reject = SlideReject::None, double weight = 0.1) {
    for (int i = 0; i < int(seconds * 100); ++i) { compass.motion(true, now); now += 10; }
    const bool accepted = reject == SlideReject::None;
    compass.push(SlideResult{accepted, reject, NAN, accepted ? direction : NAN, accepted ? weight : 0, seconds, 1});
  }
  // Rest, push the band toward `direction`, rest; distance goes from -> to,
  // and the signal strength (dBm) from signalFrom -> signalTo when given.
  void probe(double direction, double from, double to, double signalFrom = NAN, double signalTo = NAN) {
    still(2.5, from, signalFrom);
    move(1, direction);
    still(3.5, to, signalTo);
  }
};

static void aSidewaysSlideThatGetsCloserPointsSideways() {
  // Observed 13 Oct: both bands lay upright side by side and were slid toward
  // each other; both arrows pointed up because a move was assumed to go where
  // the top points. The measured push now sets the arrow.
  Rig closer;
  closer.probe(90, 0.41, 0.22);  // purple slid right, toward yellow
  auto toward = closer.compass.estimate(closer.now, closer.heading);
  assert(closer.compass.lastProbe() == ProbeResult::Counted);
  assert(toward.valid && toward.probes == 1);
  assert(gap(toward.bearingFromTop, 90) < 1);        // right, not up
  assert(gap(closer.compass.lastAim(), 90) < 1e-9);
  assert(toward.uncertaintyDegrees >= 80);           // one move is a rough hint
  Rig farther;
  farther.probe(90, 0.22, 0.41);
  auto away = farther.compass.estimate(farther.now, farther.heading);
  assert(away.valid && gap(away.bearingFromTop, 270) < 1);  // behind the move
}

static void oneJumpyReadingDoesNotFlipAMove() {
  // Still bands occasionally read a single spike (up to 1.3 m observed).
  Rig rig;
  rig.still(2.5, 1.0);
  rig.move(1, 0);
  rig.compass.motion(false, rig.now);
  const double after[] = {0.6, 0.6, 2.3, 0.6, 0.6};
  for (double metres : after) { rig.now += 610; rig.compass.motion(false, rig.now); rig.compass.range(metres, rig.now); }
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
  // Facing 90 degrees, the arrow points straight ahead.
  assert(gap(estimate.bearingFromTop, 0) < 1);
  assert(gap(estimate.headingFrameBearing, 90) < 1);
}

static void movingFartherPushesTheArrowAway() {
  Rig rig;
  rig.probe(0, 1.5, 2.0);    // up: farther
  rig.probe(180, 2.0, 1.5);  // down: closer
  rig.heading = 180;
  auto estimate = rig.compass.estimate(rig.now, rig.heading);
  assert(estimate.valid && gap(estimate.headingFrameBearing, 180) < 1);
  assert(gap(estimate.bearingFromTop, 0) < 1);  // band now faces down
}

static void probesInTwoDirectionsNarrowTheArrow() {
  Rig rig;
  rig.probe(0, 2.5, 2.0);   // up: closer
  rig.probe(90, 2.0, 1.5);  // right: closer
  rig.heading = 90;
  auto estimate = rig.compass.estimate(rig.now, rig.heading);
  assert(estimate.valid && estimate.probes == 2);
  // Between the two pushes; the newer move counts slightly more.
  assert(gap(estimate.headingFrameBearing, 45) < 5);
  // Turning the band after probing turns the arrow back the other way.
  assert(gap(estimate.bearingFromTop, estimate.headingFrameBearing - 90) < 1e-6);
  auto turned = rig.compass.estimate(rig.now, 0);
  assert(gap(turned.bearingFromTop, estimate.headingFrameBearing) < 1e-6);
  rig.probe(270, 1.5, 2.0);  // left: farther, agrees with up-right
  auto more = rig.compass.estimate(rig.now, rig.heading);
  assert(more.probes == 3 && more.uncertaintyDegrees < estimate.uncertaintyDegrees);
}

static void repeatingOneLineDoesNotResolveSidewaysAmbiguity() {
  Rig rig;
  for (int i = 0; i < 3; ++i) {
    rig.probe(35, 2.0, 1.5);
    rig.probe(215, 1.5, 2.0);
  }
  auto estimate = rig.compass.estimate(rig.now, 0);
  assert(estimate.valid && estimate.probes == 6);
  assert(gap(estimate.headingFrameBearing, 35) < 1e-6);
  assert(estimate.uncertaintyDegrees >= 89.99);
  // A slide across the previous line adds information the repeats lacked.
  rig.probe(125, 2.0, 1.5);
  auto across = rig.compass.estimate(rig.now, 0);
  assert(across.valid && across.uncertaintyDegrees < estimate.uncertaintyDegrees);
}

static void tooSmallAChangeIsIgnored() {
  Rig rig;
  // Measured 13 Oct with both bands lying still: the median-of-5 before/after
  // change was typically 0.00-0.03 m; the band handled a 5.7 cm desk move as noise.
  rig.probe(90, 1.50, 1.45);
  auto estimate = rig.compass.estimate(rig.now, rig.heading);
  assert(!estimate.valid && estimate.probes == 0);
  assert(rig.compass.lastProbe() == ProbeResult::NoChange);
}

static void signalStrengthIsASecondReading() {
  // Observed 13 Oct: purple was pushed about 15 cm away from yellow; the
  // signal fell 22 dB but the Wi-Fi distance read 0.11 m closer, and the
  // arrow pointed away from yellow. The stronger reading now wins.
  Rig apart;
  apart.probe(270, 0.11, 0.00, -50, -72);
  assert(apart.compass.lastProbe() == ProbeResult::Counted && apart.compass.lastEvidence() < 0);
  assert(std::abs(apart.compass.lastSignalChange() + 22) < 1e-9);
  assert(gap(apart.compass.estimate(apart.now, 0).bearingFromTop, 90) < 1);  // back toward yellow
  // Agreeing readings count, even with a distance change under 0.07 m.
  Rig closer;
  closer.probe(90, 0.28, 0.23, -62, -55);
  assert(closer.compass.lastProbe() == ProbeResult::Counted && closer.compass.lastEvidence() > 0);
  assert(gap(closer.compass.estimate(closer.now, 0).bearingFromTop, 90) < 1);
  // Opposite readings of similar strength: no vote rather than a guess.
  Rig torn;
  torn.probe(90, 0.40, 0.25, -55, -63);
  assert(torn.compass.lastProbe() == ProbeResult::Unsure && !torn.compass.estimate(torn.now, 0).valid);
  // A clearly stronger signal at an unchanged distance counts as closer.
  Rig signalOnly;
  signalOnly.probe(0, 0.30, 0.30, -60, -52);
  assert(signalOnly.compass.lastProbe() == ProbeResult::Counted && signalOnly.compass.lastEvidence() > 0);
  // Still-band noise (about 0.03 m and 1 dB) does not count.
  Rig noise;
  noise.probe(0, 0.30, 0.32, -55, -56);
  assert(noise.compass.lastProbe() == ProbeResult::NoChange);
  // Unknown signal strength (0 from an empty report) leaves distance alone.
  Rig unknown;
  unknown.probe(0, 0.40, 0.25, 0, 0);
  assert(unknown.compass.lastProbe() == ProbeResult::Counted && std::isnan(unknown.compass.lastSignalChange()));
}

static void unmeasuredMovesNeverMakeAnArrow() {
  // A move with no measured push went somewhere unknown, however much the
  // distance changed: lifted, endless, tipped or turned, or no push at all.
  const SlideReject spoilers[] = {SlideReject::Lifted, SlideReject::TooLong, SlideReject::Tipped, SlideReject::Turned};
  for (SlideReject reject : spoilers) {
    Rig rig;
    rig.still(2.5, 1.0);
    rig.move(1, 0, reject);
    rig.still(3.5, 0.4);
    assert(rig.compass.lastProbe() == ProbeResult::Unmeasured);
    assert(std::isnan(rig.compass.lastAim()) && !rig.compass.estimate(rig.now, 0).valid);
  }
  Rig handled;  // turned in place, or the other band moved
  handled.still(2.5, 1.0);
  handled.move(1, 0, SlideReject::TooSmall);
  handled.still(3.5, 0.4);
  assert(handled.compass.lastProbe() == ProbeResult::Unmeasured && !handled.compass.estimate(handled.now, 0).valid);
  // A measured push plus a lift in the same move is still unknown.
  Rig mixed;
  mixed.still(2.5, 1.0);
  mixed.move(0.5, 90);
  mixed.move(0.5, 0, SlideReject::Lifted);
  mixed.still(3.5, 0.4);
  assert(mixed.compass.lastProbe() == ProbeResult::Unmeasured);
  // Twitches, tipping and turning in place do not spoil a measured push.
  // Observed: a finger letting go twisted the yellow band at 163 deg/s.
  const SlideReject harmless[] = {SlideReject::TooGentle, SlideReject::TooSmall, SlideReject::Tipped, SlideReject::Turned};
  for (SlideReject reject : harmless) {
    Rig twitched;
    twitched.still(2.5, 1.0);
    twitched.move(0.5, 90);
    twitched.move(0.5, 0, reject);
    twitched.still(3.5, 0.4);
    assert(twitched.compass.lastProbe() == ProbeResult::Counted);
    assert(gap(twitched.compass.estimate(twitched.now, 0).bearingFromTop, 90) < 1);
  }
  // A verdict that arrives while resting belongs to no move.
  Rig late;
  late.still(2.5, 1.0);
  late.compass.push(SlideResult{true, SlideReject::None, 0, 0, 0.1, 1, 1});
  late.still(1, 1.0);
  assert(late.compass.lastProbe() == ProbeResult::None);

  Rig hurried;
  hurried.compass.motion(false, hurried.now);
  hurried.compass.range(0.6, hurried.now);  // only one reading before moving
  hurried.now += 300;
  hurried.move(1, 0);
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
  rig.move(0.8, 30);
  rig.still(0.6, 0.6);
  rig.move(0.8, 30);
  rig.still(0.7, 0.3);
  rig.move(0.5, 30);
  rig.still(3.5, 0.05);
  auto estimate = rig.compass.estimate(rig.now, rig.heading);
  assert(rig.compass.lastProbe() == ProbeResult::Counted && estimate.probes == 1);
  assert(std::abs(rig.compass.lastChange() + 0.85) < 1e-9);
  assert(estimate.valid && gap(estimate.bearingFromTop, 0) < 1);
}

static void pushesWithinOneMoveAddUp() {
  // Up then right with equal pushes before the distance settles: the move went
  // up-right overall; a bigger push counts for more.
  Rig rig;
  rig.still(2.5, 1.0);
  rig.move(0.5, 0);
  rig.move(0.5, 90);
  rig.still(3.5, 0.5);
  assert(gap(rig.compass.lastAim(), 45) < 1e-6);
  Rig weighted;
  weighted.still(2.5, 1.0);
  weighted.move(0.5, 0, SlideReject::None, 0.3);
  weighted.move(0.5, 90, SlideReject::None, 0.1);
  weighted.still(3.5, 0.5);
  assert(weighted.compass.lastAim() < 45 && weighted.compass.lastAim() > 0);
}

static void longHandlingStillCounts() {
  // Observed: holding and turning a band for over 15 s was "interrupted".
  Rig rig;
  rig.heading = 45;
  rig.still(2.5, 0.8);
  for (int i = 0; i < 12; ++i) { rig.move(1.5, 45); rig.still(0.6, 0.6); }
  rig.still(3.5, 0.5);
  assert(rig.compass.lastProbe() == ProbeResult::Counted);
  auto estimate = rig.compass.estimate(rig.now, 45);
  assert(estimate.valid && gap(estimate.bearingFromTop, 0) < 1);
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
  assert(std::isnan(rig.compass.lastAim()));
}

static void invalidDistancesAreIgnored() {
  Rig rig;
  rig.still(2, 1.0);
  rig.compass.range(NAN, rig.now);
  rig.compass.range(-1, rig.now);
  rig.move(1, 90);
  rig.still(3.5, 0.5);
  assert(rig.compass.estimate(rig.now, 90).probes == 1);
}

static void phasesGuideTheWearer() {
  Rig rig;
  assert(rig.compass.phase() == ProbePhase::Waiting);
  rig.still(2, 1.0);
  assert(rig.compass.phase() == ProbePhase::Ready);
  rig.move(0.5, 90);
  assert(rig.compass.phase() == ProbePhase::Moving);
  rig.compass.motion(false, rig.now);
  assert(rig.compass.phase() == ProbePhase::Measuring);
  rig.still(3.5, 0.5);
  assert(rig.compass.phase() == ProbePhase::Ready);
  assert(rig.compass.lastProbe() == ProbeResult::Counted && rig.compass.lastChange() < 0);
  rig.probe(270, 0.5, 1.0);
  assert(rig.compass.lastChange() > 0);
}

int main() {
  phasesGuideTheWearer();
  aSidewaysSlideThatGetsCloserPointsSideways();
  oneJumpyReadingDoesNotFlipAMove();
  movingCloserPullsTheArrowThere();
  movingFartherPushesTheArrowAway();
  probesInTwoDirectionsNarrowTheArrow();
  repeatingOneLineDoesNotResolveSidewaysAmbiguity();
  tooSmallAChangeIsIgnored();
  signalStrengthIsASecondReading();
  unmeasuredMovesNeverMakeAnArrow();
  shortPausesDoNotBreakAMove();
  pushesWithinOneMoveAddUp();
  longHandlingStillCounts();
  theArrowStaysAndNewerMovesTakeOver();
  invalidDistancesAreIgnored();
  std::cout << "PASS: warmer/colder from measured pushes and signal strength, sideways slides, unmeasured moves, noise, pauses and reset\n";
}
