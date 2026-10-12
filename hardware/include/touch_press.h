#pragma once
#include <stdint.h>

// CST816S reports Down=0, Up=1 and Contact=2. A held finger may generate
// multiple interrupts. Contact also starts a press if its brief Down report
// was coalesced before polling, but release is required before another press.
class TouchPress {
  bool held_ = false;
public:
  bool observe(uint8_t event, uint8_t fingers) {
    if (event == 1 || fingers == 0) { held_ = false; return false; }
    if (fingers != 1 || event > 2 || held_) return false;
    held_ = true;
    return true;
  }
};
