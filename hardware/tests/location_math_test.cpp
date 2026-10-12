#include "../include/location_math.h"
#include <cassert>
#include <iostream>
#include <limits>

void directionQualityCases() {
  const double pi = 3.14159265358979323846;
  const double antipodalMetres = pi * 6371000.0;
  auto clear = directionQuality(100.0, 8.0, 12.0);
  assert(clear.usable && clear.combinedAccuracyMetres == 20.0);
  assert(std::abs(clear.bearingUncertaintyDegrees - 11.5369590328) < 1e-8);
  // Swapping the two radii must not change the reported quality.
  auto reverse = directionQuality(100.0, 12.0, 8.0);
  assert(reverse.usable && reverse.bearingUncertaintyDegrees == clear.bearingUncertaintyDegrees);
  auto lessPrecise = directionQuality(100.0, 25.0, 25.0);
  assert(lessPrecise.usable && std::abs(lessPrecise.bearingUncertaintyDegrees - 30.0) < 1e-8);
  assert(lessPrecise.bearingUncertaintyDegrees > clear.bearingUncertaintyDegrees);
  auto farther = directionQuality(200.0, 8.0, 12.0);
  assert(farther.usable && farther.bearingUncertaintyDegrees < clear.bearingUncertaintyDegrees);
  auto zeroRadius = directionQuality(100.0, 0.0, 0.0);
  assert(zeroRadius.usable && zeroRadius.bearingUncertaintyDegrees == 0.0);

  // Touching/overlapping reported circles cannot establish a useful direction.
  for (double separation : {0.0, 10.0, 19.999, 20.0}) {
    auto overlap = directionQuality(separation, 8.0, 12.0);
    assert(!overlap.usable && overlap.combinedAccuracyMetres == 20.0);
    assert(overlap.bearingUncertaintyDegrees == 180.0);
  }
  auto barelySeparate = directionQuality(20.001, 8.0, 12.0);
  assert(barelySeparate.usable && barelySeparate.bearingUncertaintyDegrees > 89.0);
  for (double separation : {0.0, 1e-9, 0.999, 1.0})
    assert(!directionQuality(separation, 0.0, 0.0).usable);
  assert(directionQuality(1.001, 0.0, 0.0).usable);

  // Valid but enormous separations/radii, antipodes and sum overflow fail closed.
  assert(!directionQuality(antipodalMetres, 0.0, 0.0).usable);
  assert(!directionQuality(antipodalMetres - 0.5, 0.0, 0.0).usable);
  assert(!directionQuality(antipodalMetres + 1.0, 0.0, 0.0).usable);
  assert(!directionQuality(antipodalMetres - 1000.0, 500.0, 500.0).usable);
  auto nearAntipode = directionQuality(antipodalMetres - 1000.0, 250.0, 250.0);
  assert(nearAntipode.usable);
  assert(std::abs(nearAntipode.bearingUncertaintyDegrees - 30.0) < 1e-6);
  assert(directionQuality(antipodalMetres / 2.0, 0.0, 0.0).usable);
  const double largest = std::numeric_limits<double>::max();
  assert(!directionQuality(largest, 8.0, 12.0).usable);
  assert(!directionQuality(100.0, largest, 0.0).usable);
  auto overflow = directionQuality(100.0, largest, largest);
  assert(!overflow.usable && std::isnan(overflow.combinedAccuracyMetres));

  const double nan = std::numeric_limits<double>::quiet_NaN();
  const double infinity = std::numeric_limits<double>::infinity();
  for (double invalid : {-1.0, -infinity, infinity, nan}) {
    assert(!directionQuality(invalid, 8.0, 12.0).usable);
    auto badLocal = directionQuality(100.0, invalid, 12.0);
    auto badPeer = directionQuality(100.0, 8.0, invalid);
    assert(!badLocal.usable && !badPeer.usable);
    assert(std::isnan(badLocal.combinedAccuracyMetres) && std::isnan(badPeer.combinedAccuracyMetres));
    assert(badLocal.bearingUncertaintyDegrees == 180.0 && badPeer.bearingUncertaintyDegrees == 180.0);
  }
  // Use an actual geometry result to exercise integration without changing guidance().
  auto separation = guidance(-27.497, 153.013, -27.498, 153.014);
  auto nearby = directionQuality(separation.metres, 8.0, 12.0);
  assert(nearby.usable && nearby.bearingUncertaintyDegrees > 0.0 && nearby.bearingUncertaintyDegrees < 90.0);
  assert(!directionQuality(separation.metres, 100.0, 100.0).usable);
}

int main() {
  auto same=guidance(-27.497,153.013,-27.497,153.013);
  assert(same.metres==0 && std::isfinite(same.bearing));
  auto north=guidance(0,0,1,0);
  assert(std::abs(north.metres-111194.9266)<0.01 && std::abs(north.bearing)<0.01);
  auto east=guidance(0,0,0,1);
  assert(std::abs(east.metres-north.metres)<0.01 && std::abs(east.bearing-90)<0.01);
  auto west=guidance(0,1,0,0);
  assert(std::abs(west.bearing-270)<0.01);
  auto dateline=guidance(0,179.9,0,-179.9);
  assert(std::abs(dateline.metres-22238.9853)<0.01 && std::abs(dateline.bearing-90)<0.01);
  auto poles=guidance(90,0,-90,0);
  assert(std::isfinite(poles.metres) && std::isfinite(poles.bearing));
  auto a=guidance(-27.497,153.013,-27.498,153.014),b=guidance(-27.498,153.014,-27.497,153.013);
  assert(std::abs(a.metres-b.metres)<0.01 && a.bearing>=0 && a.bearing<360);
  directionQualityCases();
  std::cout << "Location geometry: 7 cases and direction-quality boundaries passed\n";
}
