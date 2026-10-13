#include <cassert>
#include <cmath>
#include <cstdint>
#include <iostream>
#include "../include/proximity.h"

static void feedbackCurve() {
  auto touching = proximityFeedback(true, 0.03);
  assert(touching.active && touching.level == 1 && touching.brightness == 1);
  assert(touching.beepIntervalMs == BEEP_FASTEST_MS);
  auto edge = proximityFeedback(true, PROXIMITY_FAR_METRES);
  assert(edge.active && edge.level == 0 && std::abs(edge.brightness - PROXIMITY_MIN_BRIGHTNESS) < 1e-12);
  assert(edge.beepIntervalMs == BEEP_SLOWEST_MS);

  // Visible on a desk (observed: a 0.98 -> 0.73 change looked "the same"):
  // from about 1 m to touching at least doubles the light and makes the
  // beeps at least four times faster.
  assert(touching.brightness >= 2 * proximityFeedback(true, 1.0).brightness);
  assert(4 * touching.beepIntervalMs <= proximityFeedback(true, 1.0).beepIntervalMs);
  // Observed: touching read 0.3 m and half a metre apart read 0.6 m, and the
  // change was not visible. That half metre must slow the pulses by 1.7x.
  assert(10 * proximityFeedback(true, 0.6).beepIntervalMs >= 17 * proximityFeedback(true, 0.3).beepIntervalMs);
  // Final-approach cues: full at 0.2 m, slowest at 20 m.
  assert(proximityFeedback(true, 0.2).brightness == 1 && proximityFeedback(true, 0.2).beepIntervalMs == BEEP_FASTEST_MS);
  assert(proximityFeedback(true, 20).beepIntervalMs == BEEP_SLOWEST_MS && proximityFeedback(true, 21).beepIntervalMs == 0);

  // Brighter and faster at every closer distance, including desk-scale
  // changes that the old 5 m full-brightness floor could not show.
  auto previous = proximityFeedback(true, PROXIMITY_FAR_METRES);
  for (double metres = PROXIMITY_FAR_METRES - 0.05; metres > PROXIMITY_NEAR_METRES; metres -= 0.05) {
    auto next = proximityFeedback(true, metres);
    assert(next.brightness > previous.brightness);
    assert(next.beepIntervalMs <= previous.beepIntervalMs);
    previous = next;
  }
  assert(proximityFeedback(true, 0.4).brightness > proximityFeedback(true, 1.3).brightness);
  assert(proximityFeedback(true, 0.4).beepIntervalMs < proximityFeedback(true, 1.3).beepIntervalMs);
  assert(proximityFeedback(true, 1.3).beepIntervalMs < proximityFeedback(true, 5).beepIntervalMs);

  // Too far away for useful proximity cues: dim light, no beeps.
  auto far = proximityFeedback(true, 200);
  assert(far.active && std::abs(far.brightness - PROXIMITY_MIN_BRIGHTNESS) < 1e-12 && far.beepIntervalMs == 0);
  assert(PROXIMITY_MIN_BRIGHTNESS > 0.05);  // still visible when far

  // Unusable or malformed distances never produce light or sound.
  for (double invalid : {double(NAN), double(INFINITY), -double(INFINITY), -0.01}) {
    auto off = proximityFeedback(true, invalid);
    assert(!off.active && off.brightness == 0 && off.beepIntervalMs == 0);
  }
  auto unusable = proximityFeedback(false, 0.3);
  assert(!unusable.active && unusable.brightness == 0 && unusable.beepIntervalMs == 0);
  static_assert(BEEP_ON_MS < BEEP_FASTEST_MS, "each beep must end before the next starts");
}

static void beepTiming() {
  BeepScheduler beeps;
  assert(!beeps.update(0, 0) && beeps.count() == 0);
  // The first usable interval beeps immediately, then waits for the interval.
  assert(beeps.update(500, 1000) && beeps.count() == 1);
  assert(beeps.update(500, 1000 + BEEP_ON_MS - 1));
  assert(!beeps.update(500, 1000 + BEEP_ON_MS));
  assert(!beeps.update(500, 1499));
  assert(beeps.update(500, 1500) && beeps.count() == 2);
  // Approaching shortens the next gap without waiting for the old interval.
  assert(!beeps.update(200, 1650));
  assert(beeps.update(200, 1700) && beeps.count() == 3);
  // Unusable measurement silences immediately, even mid-beep.
  assert(!beeps.update(0, 1710));
  assert(!beeps.update(0, 5000) && beeps.count() == 3);
  // Recovery starts again at once rather than after a stale interval.
  assert(beeps.update(300, 5001) && beeps.count() == 4);
  // Without a buzzer the ring flashes on each beep: long enough to see, and
  // never longer than half the interval so fast pulses stay distinct.
  BeepScheduler flash;
  assert(!flash.flashing(0));
  flash.update(1000, 0);
  assert(flash.flashing(0) && flash.flashing(BEEP_FLASH_MS - 1) && !flash.flashing(BEEP_FLASH_MS));
  flash.update(150, 1000);
  assert(flash.flashing(1000 + 74) && !flash.flashing(1000 + 75));
  flash.update(0, 1100);
  assert(!flash.flashing(1100));
  static_assert(BEEP_FLASH_MS >= 80, "a visible flash outlasts one LCD frame");
  // millis() wraparound.
  BeepScheduler wrap;
  assert(wrap.update(400, 0xFFFFFF00u));
  assert(!wrap.update(400, 0x00000080u));
  assert(wrap.update(400, 0x00000090u) && wrap.count() == 2);
}

int main() {
  feedbackCurve();
  beepTiming();
  std::cout << "PASS: logarithmic proximity brightness/beep curve, invalid suppression and beep scheduling\n";
}
