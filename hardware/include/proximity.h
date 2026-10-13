#pragma once
#include <cmath>
#include <stdint.h>

// One logarithmic curve drives the light and the beeps for every distance
// source, concentrated on the final approach: full at 0.2 m, dimmest (and
// slowest beeps) at 20 m, silent beyond. Squaring the level makes the near
// range visibly steeper on the LCD.
constexpr double PROXIMITY_NEAR_METRES = 0.2;
constexpr double PROXIMITY_FAR_METRES = 20.0;
constexpr double PROXIMITY_MIN_BRIGHTNESS = 0.12;
constexpr uint32_t BEEP_FASTEST_MS = 150;
constexpr uint32_t BEEP_SLOWEST_MS = 2000;
constexpr uint32_t BEEP_ON_MS = 40;
constexpr uint32_t BEEP_FLASH_MS = 120;  // visible ring pulse per beep

struct ProximityFeedback {
  bool active;
  double level, brightness;
  uint32_t beepIntervalMs;  // 0 = silent
};

inline ProximityFeedback proximityFeedback(bool usable, double metres) {
  if (!usable || !std::isfinite(metres) || metres < 0) return {false, 0, 0, 0};
  const double span = std::log(PROXIMITY_FAR_METRES / PROXIMITY_NEAR_METRES);
  const double position = std::log(std::fmax(metres, PROXIMITY_NEAR_METRES) / PROXIMITY_NEAR_METRES) / span;
  const double level = 1.0 - std::fmin(1.0, position);
  const double shaped = level * level;
  const double brightness = PROXIMITY_MIN_BRIGHTNESS + (1.0 - PROXIMITY_MIN_BRIGHTNESS) * shaped;
  const uint32_t interval = metres > PROXIMITY_FAR_METRES ? 0 :
    uint32_t(std::lround(BEEP_SLOWEST_MS * std::pow(double(BEEP_FASTEST_MS) / BEEP_SLOWEST_MS, shaped)));
  return {true, level, brightness, interval};
}

// Call every loop with the current interval. Returns true while a beep sounds.
// A shorter interval applies from the previous beep; recovery beeps at once.
class BeepScheduler {
  bool running_ = false;
  uint32_t lastStart_ = 0, count_ = 0, interval_ = 0;

 public:
  bool update(uint32_t intervalMs, uint32_t now) {
    interval_ = intervalMs;
    if (!intervalMs) {
      running_ = false;
      return false;
    }
    if (!running_ || uint32_t(now - lastStart_) >= intervalMs) {
      running_ = true;
      lastStart_ = now;
      ++count_;
    }
    return uint32_t(now - lastStart_) < BEEP_ON_MS;
  }
  // The visual pulse that accompanies each beep (bands have no buzzer).
  bool flashing(uint32_t now) const {
    if (!running_) return false;
    const uint32_t window = interval_ / 2 < BEEP_FLASH_MS ? interval_ / 2 : BEEP_FLASH_MS;
    return uint32_t(now - lastStart_) < window;
  }
  uint32_t count() const { return count_; }
};
