#pragma once
#include <cmath>

struct ArrowPoint { int x, y; };
struct DirectionArrow {
  bool visible;
  ArrowPoint center, tip, left, right;
};

// Center of the 162 x 94 LCD content panel. Rotation stays inside a 44 px
// square so heading/accuracy labels and the quarter-circle light remain clear.
inline DirectionArrow directionArrow(double bearing) {
  DirectionArrow arrow{false, {120, 141}, {}, {}, {}};
  if (!std::isfinite(bearing)) return arrow;
  const double angle = std::fmod(bearing, 360.0) * 3.14159265358979323846 / 180.0;
  const double s = std::sin(angle), c = std::cos(angle);
  const auto point = [](double x, double y) {
    return ArrowPoint{120 + int(std::lround(x)), 141 + int(std::lround(y))};
  };
  arrow.visible = true;
  arrow.tip = point(22 * s, -22 * c);
  arrow.left = point(-18 * s - 12 * c, 18 * c - 12 * s);
  arrow.right = point(-18 * s + 12 * c, 18 * c + 12 * s);
  return arrow;
}
