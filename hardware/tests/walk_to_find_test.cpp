#include <cassert>
#include <cmath>
#include <iostream>
#include <vector>
#include "../include/pdr.h"
#include "../include/walk_locate.h"

// SIMULATED end-to-end check of frame conventions: synthetic IMU samples for
// an L-shaped walk, ranges to a friend standing at (6, -2) m from the start,
// and the arrow drawn relative to where the band's top points afterwards.
struct Walker {
  WalkTracker tracker;
  uint32_t micros = 1000000;
  std::vector<WalkRange> ranges;
  void sample(double vertical, double clockwiseDps) {
    ImuReading reading{micros, {0, 0, -(1 + vertical)}, {-4.7, 0, 0.3 + clockwiseDps}};
    const int before = tracker.steps();
    tracker.update(reading);
    micros += 10000;
    if (tracker.steps() != before)
      ranges.push_back({tracker.x(), tracker.y(), std::hypot(6 - tracker.x(), -2 - tracker.y())});
  }
  void rest(double seconds) { for (int i = 0; i < seconds * 100; ++i) sample(0, 0); }
  void walk(double seconds) { for (int i = 0; i < seconds * 100; ++i) sample(0.25 * std::sin(4 * 3.14159265358979323846 * i / 100.0), 0); }
  void turn(double degrees) { for (int i = 0; i < 200; ++i) sample(0, degrees / 2); }
};

static double gap(double a, double b) { return std::abs(std::fmod(a - b + 540, 360) - 180); }

int main() {
  Walker walker;
  walker.rest(2);
  walker.tracker.reset();
  walker.ranges.push_back({0, 0, std::hypot(6, -2)});
  walker.walk(3);
  walker.turn(90);
  walker.walk(3);
  auto fix = locateFromWalk(walker.ranges.data(), int(walker.ranges.size()));
  assert(fix.valid);
  const double x = walker.tracker.x(), y = walker.tracker.y();
  const double truth = std::fmod(std::atan2(6 - x, -2 - y) * 180 / 3.14159265358979323846 + 360, 360);
  double arrow = walkArrowBearing(fix, x, y, walker.tracker.headingDegrees());
  assert(gap(arrow, truth - 90) < 3);  // facing east after the turn
  // Turning the wrist 90 degrees clockwise in place turns the arrow back 90.
  walker.turn(90);
  arrow = walkArrowBearing(fix, walker.tracker.x(), walker.tracker.y(), walker.tracker.headingDegrees());
  assert(gap(arrow, truth - 180) < 4);
  std::cout << "PASS (simulated): L-walk steps + turns + ranges give an arrow relative to the band's heading\n";
}
