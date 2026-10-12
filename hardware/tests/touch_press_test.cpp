#include <cassert>
#include <iostream>
#include "../include/touch_press.h"

int main() {
  TouchPress touch;
  assert(!touch.observe(0, 1));
  for (int i = 0; i < 100; ++i) assert(!touch.observe(2, 1));
  assert(!touch.observe(0, 1));
  assert(!touch.observe(1, 0)); // Unconfirmed noise is not a tap.
  assert(!touch.observe(0, 1));
  assert(touch.observe(1, 1, 5)); // A confirmed click release may retain a point.
  assert(!touch.observe(1, 1, 5)); // Duplicate IRQ cannot repeat the action.
  assert(!touch.observe(0, 1));
  assert(touch.observe(1, 0, 5));
  assert(!touch.observe(1, 0));
  assert(!touch.observe(0, 1));
  assert(!touch.observe(2, 0));
  assert(!touch.observe(2, 1)); // Lone stale Contact never becomes a press.
  assert(!touch.observe(2, 1));
  assert(!touch.observe(1, 0, 12)); // Long press is not repeated SOS confirmation.
  assert(!touch.observe(3, 1));
  assert(!touch.observe(0, 1));
  assert(!touch.observe(0, 2));
  assert(!touch.observe(1, 0));
  TouchPress coalesced;
  assert(coalesced.observe(1, 0, 5)); // Controller-confirmed click despite missed Down.
  assert(!coalesced.observe(1, 0, 5));
  int confirmations=0;
  for(int i=0;i<3;i++) { assert(!touch.observe(0,1)); if(touch.observe(1,0,5))confirmations++; }
  assert(confirmations==3);
  std::cout << "PASS: confirmed release clicks, noise/contact suppression, held fingers, duplicate reports and three separate taps\n";
}
