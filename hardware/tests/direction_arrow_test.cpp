#include <cassert>
#include <cmath>
#include <iostream>
#include "../include/direction_arrow.h"

int main() {
  const auto north = directionArrow(0);
  assert(north.visible);
  assert(north.center.x == 120 && north.center.y == 141);
  assert(north.tip.x == 120 && north.tip.y == 119);
  assert(north.left.x == 108 && north.left.y == 159);
  assert(north.right.x == 132 && north.right.y == 159);
  assert(north.right.x - north.left.x == 24); // Twice the previous width.
  assert(north.left.y - north.tip.y == 40); // Previously 22 pixels tall.
  const auto east = directionArrow(90);
  assert(east.tip.x == 142 && east.tip.y == 141);
  const auto south = directionArrow(180);
  assert(south.tip.x == 120 && south.tip.y == 163);
  const auto west = directionArrow(270);
  assert(west.tip.x == 98 && west.tip.y == 141);
  for (int degree = -360; degree <= 720; ++degree) {
    const auto arrow = directionArrow(degree);
    assert(arrow.visible);
    for (const auto point : {arrow.tip, arrow.left, arrow.right}) {
      assert(point.x >= 98 && point.x <= 142);
      assert(point.y >= 119 && point.y <= 163); // Clear of text at 114/170/180.
    }
  }
  assert(!directionArrow(NAN).visible && !directionArrow(INFINITY).visible);
  std::cout << "PASS: larger centered arrow and all bearing bounds leave labels unobstructed\n";
}
