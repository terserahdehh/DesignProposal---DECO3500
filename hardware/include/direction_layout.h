#pragma once
#include <stdint.h>

struct RoundDisplayLabel {
  const char *text;
  int x, y;
  uint8_t font;
};

// Native font1 is 6x8 pixels per character. These complete text rectangles fit
// inside radius108, leaving the continuous direction light's inner radius109.
inline RoundDisplayLabel roundDisplayBranding() {
  return {"P U L S E B A N D", 120, 29, 1};
}
inline RoundDisplayLabel roundDisplayFooterLeft() {
  return {"TOGETHER,", 84, 199, 1};
}
inline RoundDisplayLabel roundDisplayFooterRight() {
  return {"FURTHER.", 155, 199, 1};
}

const int DIRECTION_ARC_INNER_RADIUS = 109;
const int DIRECTION_ARC_CORE_INNER_RADIUS = 111;
const int DIRECTION_ARC_CORE_OUTER_RADIUS = 115;
const int DIRECTION_ARC_OUTER_RADIUS = 117;
