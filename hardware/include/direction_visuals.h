#pragma once
#include <limits>
#include "direction_arc.h"
#include "direction_arrow.h"

struct DirectionVisuals {
  DirectionArc light;
  DirectionArrow arrow;
};

// Both visuals describe the same trusted, fresh peer position. A usable last
// fix alone does not keep an arrow visible after the live peer link is lost.
inline DirectionVisuals directionVisuals(bool finding, bool connected, bool localFresh,
                                         bool peerFresh, bool usable, double bearing,
                                         double metres) {
  DirectionVisuals visuals{
    directionArc(finding, connected, localFresh, peerFresh, usable, bearing, metres),
    directionArrow(std::numeric_limits<double>::quiet_NaN())
  };
  if (visuals.light.visible) visuals.arrow = directionArrow(visuals.light.bearing);
  return visuals;
}
