#include <cassert>
#include <cmath>
#include <iostream>
#include "../include/direction_arc.h"

int main() {
  auto north = directionArc(true, true, true, true, true, 0, 100);
  assert(north.visible && north.spanDegrees == 90);
  assert(arcStrengthAt(north, 0) > 0);
  assert(arcStrengthAt(north, 359) > 0); // Arc wraps across north.
  assert(arcStrengthAt(north, 45) > 0);
  assert(arcStrengthAt(north, 46) == 0);
  assert(arcStrengthAt(north, 180) == 0);
  auto east = directionArc(true, true, true, true, true, 90, 100);
  assert(arcStrengthAt(east, 90) > arcStrengthAt(east, 45));
  assert(arcStrengthAt(east, 0) == 0);
  auto near = directionArc(true, true, true, true, true, 90, 5);
  auto medium = directionArc(true, true, true, true, true, 90, 50);
  auto far = directionArc(true, true, true, true, true, 90, 200);
  assert(near.brightness > medium.brightness && medium.brightness > far.brightness);
  assert(near.brightness == 1 && far.brightness >= 0.19);
  for (int blocked = 0; blocked < 5; ++blocked) {
    bool inputs[] = {true, true, true, true, true}; inputs[blocked] = false;
    auto off = directionArc(inputs[0], inputs[1], inputs[2], inputs[3], inputs[4], 90, 10);
    assert(!off.visible && arcStrengthAt(off, 90) == 0);
  }
  assert(!directionArc(true, true, true, true, true, NAN, 10).visible);
  assert(!directionArc(true, true, true, true, true, 90, -1).visible);
  assert(!directionArc(true, true, true, true, true, 90, INFINITY).visible);
  assert(arcColour565(0xFEA2, 1) == 0xFEA2); // Syifa yellow.
  assert(arcColour565(0xA2BE, 1) == 0xA2BE); // Nayaka purple.
  assert(arcColour565(0xFEA2, 0) == 0);
  std::cout << "PASS: quarter arc wrap, moving bearing, proximity brightness, colour and invalid/offline suppression\n";
}
