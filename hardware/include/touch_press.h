#pragma once
#include <stdint.h>

// CST816S reports Down=0, Up=1, Contact=2 and SingleClick gesture=5.
// Raw Down/Contact reports can be noise or a stale wake report. Dispatch only
// the controller-confirmed click on release, once per separate tap.
class TouchPress {
  bool clickLatched_ = false;
public:
  bool observe(uint8_t event, uint8_t fingers, uint8_t gesture = 0) {
    if (fingers > 1 || event > 2) return false;
    if (fingers == 1 && event != 1) {
      if (gesture != 5) clickLatched_ = false;
      return false;
    }
    if (gesture != 5 || clickLatched_) return false;
    clickLatched_ = true;
    return true;
  }
};
