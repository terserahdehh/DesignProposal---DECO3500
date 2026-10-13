#include <cassert>
#include <cmath>
#include <iostream>
#include "../include/direction_visuals.h"
#include "../include/location_math.h"

int main() {
  auto shown = directionVisuals(true, true, true, true, true, 90, 100);
  assert(shown.arrow.visible && shown.light.visible);
  assert(shown.arrow.tip.x == 142 && shown.arrow.tip.y == 141);
  assert(shown.light.bearing == 90 && shown.light.spanDegrees == 90);

  // Regression: an accurate, still-fresh last fix must not leave a stale arrow
  // visible when peer heartbeats stop, while the directional light goes dark.
  auto offline = directionVisuals(true, false, true, true, true, 90, 100);
  assert(!offline.arrow.visible && !offline.light.visible);
  for (unsigned combination = 0; combination < 32; ++combination) {
    bool flags[5];
    for (int index = 0; index < 5; ++index) flags[index] = (combination & (1u << index)) != 0;
    auto visuals = directionVisuals(flags[0], flags[1], flags[2], flags[3], flags[4], 90, 100);
    assert(visuals.arrow.visible == visuals.light.visible);
    assert(visuals.arrow.visible == (combination == 31));
  }
  for (double invalid : {NAN, INFINITY, -INFINITY}) {
    auto badBearing = directionVisuals(true, true, true, true, true, invalid, 100);
    auto badDistance = directionVisuals(true, true, true, true, true, 90, invalid);
    assert(!badBearing.arrow.visible && !badBearing.light.visible);
    assert(!badDistance.arrow.visible && !badDistance.light.visible);
  }
  auto badDistance = directionVisuals(true, true, true, true, true, 90, -1);
  assert(!badDistance.arrow.visible && !badDistance.light.visible);
  auto wrapped = directionVisuals(true, true, true, true, true, -90, 100);
  assert(wrapped.light.bearing == 270);
  assert(wrapped.arrow.tip.x == 98 && wrapped.arrow.tip.y == 141);

  auto quality = directionQuality(10, 14, 40);
  auto uncertain = directionVisuals(true, true, true, true, quality.usable, 90, 10);
  assert(!uncertain.arrow.visible && !uncertain.light.visible);
  auto near = directionVisuals(true, true, true, true, true, 90, 5);
  auto far = directionVisuals(true, true, true, true, true, 90, 200);
  assert(near.light.brightness == 1 && std::abs(far.light.brightness - 0.2) < 1e-12);
  std::cout << "PASS: arrow/light share peer, freshness and accuracy gates; brightness unchanged\n";
}
