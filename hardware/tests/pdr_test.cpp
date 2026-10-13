#include <cassert>
#include <cmath>
#include <cstdint>
#include <iostream>
#include "../include/pdr.h"

// Synthetic 100 Hz samples. At rest these boards read gravity on -z and the
// gyroscopes have offsets (Nayaka measured -4.7 deg/s on x while still).
struct Sim {
  WalkTracker tracker;
  uint32_t micros = 1000000;
  double up[3] = {0, 0, -1};
  double bias[3] = {-4.7, 0, 0.3};
  void sample(double vertical, double clockwiseDps = 0, double wobble = 0) {
    ImuReading reading{micros, {}, {}};
    for (int axis = 0; axis < 3; ++axis) {
      reading.accel[axis] = up[axis] * (1 + vertical) + (axis == 0 ? wobble : 0);
      // Clockwise seen from above is negative rotation about "up".
      reading.gyro[axis] = bias[axis] - clockwiseDps * up[axis];
    }
    tracker.update(reading);
    micros += 10000;
  }
  void rest(double seconds) { for (int i = 0; i < seconds * 100; ++i) sample(0); }
  void walk(double seconds, double clockwiseDps = 0) {
    for (int i = 0; i < seconds * 100; ++i) sample(0.25 * std::sin(2 * 3.14159265358979323846 * 2 * i / 100.0), clockwiseDps);
  }
  void turn(double degrees, double seconds = 3) {
    for (int i = 0; i < seconds * 100; ++i) sample(0, degrees / seconds);
  }
};

static void restingBandCountsNothingAndLearnsGyroOffset() {
  Sim sim;
  sim.rest(3);
  assert(sim.tracker.steps() == 0 && sim.tracker.biasKnown());
  assert(std::abs(sim.tracker.headingDegrees()) < 1);
  sim.tracker.reset();
  sim.rest(30);
  assert(std::abs(sim.tracker.headingDegrees()) < 0.5);  // no drift while still
  assert(sim.tracker.x() == 0 && sim.tracker.y() == 0);
}

static void walkingCountsStepsForward() {
  Sim sim;
  sim.rest(2);
  sim.tracker.reset();
  sim.walk(5);  // 2 steps per second
  assert(sim.tracker.steps() >= 9 && sim.tracker.steps() <= 11);
  assert(std::abs(sim.tracker.x()) < 1e-9);
  assert(std::abs(sim.tracker.y() - sim.tracker.steps() * PDR_STEP_LENGTH_METRES) < 1e-9);
}

static void turningRotatesTheHeadingClockwise() {
  Sim sim;
  sim.rest(2);
  sim.tracker.reset();
  sim.turn(90);
  assert(std::abs(sim.tracker.headingDegrees() - 90) < 2);
  sim.turn(-180);
  assert(std::abs(sim.tracker.headingDegrees() + 90) < 3);
  assert(sim.tracker.steps() == 0);
}

static void anLShapedWalkTracesTheTurn() {
  Sim sim;
  sim.rest(2);
  sim.tracker.reset();
  sim.walk(2);
  const double forward = sim.tracker.y();
  sim.rest(0.5);
  sim.turn(90, 2);
  sim.walk(2);
  assert(forward > 2);
  assert(sim.tracker.x() > 2 && std::abs(sim.tracker.y() - forward) < 0.3);
}

static void deskVibrationIsNotAStep() {
  Sim sim;
  sim.rest(2);
  sim.tracker.reset();
  for (int i = 0; i < 500; ++i) sim.sample(0.03 * std::sin(2 * 3.14159265358979323846 * 10 * i / 100.0), 0, 0.02);
  assert(sim.tracker.steps() == 0);
}

int main() {
  restingBandCountsNothingAndLearnsGyroOffset();
  walkingCountsStepsForward();
  turningRotatesTheHeadingClockwise();
  anLShapedWalkTracesTheTurn();
  deskVibrationIsNotAStep();
  std::cout << "PASS: step counting, gyro offset learning, clockwise heading and L-shaped path\n";
}
