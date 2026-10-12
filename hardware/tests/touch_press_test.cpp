#include <cassert>
#include <iostream>
#include "../include/touch_press.h"

int main() {
  TouchPress touch;
  assert(touch.observe(0, 1));
  for (int i = 0; i < 100; ++i) assert(!touch.observe(2, 1));
  assert(!touch.observe(0, 1));
  assert(!touch.observe(1, 1)); // A release can retain the reported point.
  assert(touch.observe(0, 1));
  assert(!touch.observe(1, 0));
  assert(touch.observe(0, 1));
  assert(!touch.observe(2, 0));
  assert(touch.observe(2, 1)); // A short Down can be coalesced before polling.
  assert(!touch.observe(2, 1));
  assert(!touch.observe(3, 1));
  assert(!touch.observe(0, 1));
  assert(!touch.observe(0, 2));
  assert(!touch.observe(1, 0));
  assert(touch.observe(0, 1));
  std::cout << "PASS: held contacts, repeated Down, release with/without a point, separate taps, coalesced Down, and invalid events\n";
}
