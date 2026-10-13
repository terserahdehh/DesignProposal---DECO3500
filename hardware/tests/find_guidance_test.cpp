#include <cassert>
#include <cctype>
#include <cmath>
#include <cstring>
#include <iostream>
#include <string>
#include "../include/find_guidance.h"

static RangeReading range(double metres, double uncertainty = 0.15) {
  return {true, metres, uncertainty, 300, 3, "ok"};
}
static const RangeReading NO_RANGE{false, 0, 0, 0, 0, "waiting"};

// Usable phone GPS: 120 m apart with 20 m combined accuracy.
static FindInputs gps(double bearing, double metres = 120, bool finding = true) {
  return {finding, true, true, true, metres, bearing, directionQuality(metres, 8, 12), NO_RANGE};
}

static std::string distanceText(const FindGuidance &guidance) {
  char text[40];
  formatFindDistance(guidance, text, sizeof(text));
  return text;
}

static double tipBearing(const DirectionArrow &arrow) {
  const double degrees = std::atan2(arrow.tip.x - arrow.center.x, arrow.center.y - arrow.tip.y) * 180 / 3.14159265358979323846;
  return std::fmod(degrees + 360, 360);
}

static double angularGap(double a, double b) {
  return std::abs(std::fmod(a - b + 540, 360) - 180);
}

static void arrowAndQuarterRingShareOneBearing() {
  for (double bearing : {0.0, 0.4, 44.6, 90.0, 179.5, 270.0, 359.6, 359.99, 360.0, 361.0, -0.4, -90.0, 720.5}) {
    auto guidance = findGuidance(gps(bearing));
    const double normalized = std::fmod(std::fmod(bearing, 360) + 360, 360);
    assert(guidance.mode == FindMode::Direction && guidance.directionUsable);
    assert(guidance.visuals.arrow.visible && guidance.visuals.light.visible);
    assert(guidance.ring == RingShape::Quarter);
    assert(guidance.visuals.light.bearing >= 0 && guidance.visuals.light.bearing < 360);
    assert(angularGap(guidance.visuals.light.bearing, normalized) < 1e-9);
    assert(angularGap(guidance.bearing, normalized) < 1e-9);
    // Pixel-rounded arrow tip points within 3 degrees of the ring centre.
    assert(angularGap(tipBearing(guidance.visuals.arrow), guidance.visuals.light.bearing) < 3);
    // The ring's brightest point is the arrow direction; it wraps across north.
    assert(arcStrengthAt(guidance.visuals.light, normalized) >= arcStrengthAt(guidance.visuals.light, normalized + 30));
    assert(arcStrengthAt(guidance.visuals.light, normalized - 44) > 0);
    assert(arcStrengthAt(guidance.visuals.light, normalized + 44) > 0);
    assert(arcStrengthAt(guidance.visuals.light, normalized + 180) == 0);
  }
}

static void measuredDistanceWithoutDirection() {
  FindInputs inputs{true, true, false, false, NAN, NAN, directionQuality(NAN, 0, 0), range(0.4)};
  auto guidance = findGuidance(inputs);
  assert(guidance.mode == FindMode::DistanceOnly && guidance.source == DistanceSource::WifiRange);
  assert(!guidance.directionUsable && !guidance.visuals.arrow.visible);
  // A uniform ring signals proximity without pointing anywhere.
  assert(guidance.ring == RingShape::Full);
  assert(guidance.proximity.active && guidance.beepIntervalMs == guidance.proximity.beepIntervalMs);
  assert(guidance.beepIntervalMs > 0);
  assert(distanceText(guidance) == "0.4 m");
  auto closer = findGuidance({true, true, false, false, NAN, NAN, directionQuality(NAN, 0, 0), range(0.05)});
  assert(closer.proximity.brightness > guidance.proximity.brightness);
  assert(closer.beepIntervalMs < guidance.beepIntervalMs);
}

static void unusableGpsShowsNoNumberAndNoFeedback() {
  // Regression: overlapping laptop fixes used to print "~12 m" with no usable bearing.
  FindInputs inputs{true, true, true, true, 12, 75, directionQuality(12, 14, 40), NO_RANGE};
  auto guidance = findGuidance(inputs);
  assert(guidance.mode == FindMode::Uncertain && !guidance.distanceKnown);
  assert(guidance.ring == RingShape::None && !guidance.visuals.arrow.visible);
  assert(!guidance.proximity.active && guidance.beepIntervalMs == 0);
  const std::string text = distanceText(guidance);
  assert(text == "Distance unknown");
  for (char c : text) assert(!std::isdigit(static_cast<unsigned char>(c)));
}

static void measuredRangeInsideGpsUncertaintySuppressesTheArrow() {
  // The bands measure 0.6 m apart, inside 20 m of combined GPS uncertainty:
  // the 120 m GPS separation and its bearing are wrong.
  auto inputs = gps(90);
  inputs.range = range(0.6, 1.5);
  auto guidance = findGuidance(inputs);
  assert(guidance.mode == FindMode::DistanceOnly && !guidance.directionUsable);
  assert(!guidance.visuals.arrow.visible && guidance.ring == RingShape::Full);
  assert(guidance.source == DistanceSource::WifiRange && guidance.metres == 0.6);

  // Both agree the peer is far: GPS direction with the measured distance.
  inputs.range = range(110, 1.5);
  auto far = findGuidance(inputs);
  assert(far.mode == FindMode::Direction && far.visuals.arrow.visible && far.source == DistanceSource::WifiRange);
  assert(far.metres == 110);
}

static void offlineStaleAndRecovery() {
  auto inputs = gps(45);
  inputs.range = range(30, 1.5);
  inputs.peerConnected = false;
  auto offline = findGuidance(inputs);
  assert(offline.mode == FindMode::Offline && !offline.distanceKnown);
  assert(!offline.visuals.arrow.visible && offline.ring == RingShape::None);
  assert(!offline.proximity.active && offline.beepIntervalMs == 0);
  assert(distanceText(offline) == "Distance unknown");

  inputs.peerConnected = true;
  inputs.peerFresh = false;  // expired peer fix
  inputs.range = NO_RANGE;   // stale range reading
  auto stale = findGuidance(inputs);
  assert(stale.mode == FindMode::Unavailable && !stale.distanceKnown);
  assert(stale.ring == RingShape::None && stale.beepIntervalMs == 0);

  // Stale range falls back to a usable GPS distance and direction.
  inputs.peerFresh = true;
  auto recovered = findGuidance(inputs);
  assert(recovered.mode == FindMode::Direction && recovered.source == DistanceSource::PhoneGps);
  assert(recovered.visuals.arrow.visible && recovered.beepIntervalMs == 0);  // 120 m: dim, silent
  assert(distanceText(recovered) == "~120 m");

  for (double badBearing : {NAN, INFINITY}) {
    auto malformed = gps(badBearing);
    auto hidden = findGuidance(malformed);
    assert(hidden.mode != FindMode::Direction && !hidden.visuals.arrow.visible && hidden.ring == RingShape::None);
  }
}

static void onlyTheFindScreenLightsAndBeeps() {
  auto inputs = gps(10);
  inputs.range = range(0.3);
  inputs.finding = false;
  auto home = findGuidance(inputs);
  // Status can still report the measured distance, but nothing lights or beeps.
  assert(home.distanceKnown && home.metres == 0.3);
  assert(!home.visuals.arrow.visible && !home.visuals.light.visible);
  assert(home.ring == RingShape::None && home.beepIntervalMs == 0);
}

static FindInputs demo(double demoBearing, RangeReading measured = range(0.4)) {
  FindInputs inputs{true, true, false, false, NAN, NAN, directionQuality(NAN, 0, 0), measured};
  inputs.demoBearing = demoBearing;
  return inputs;
}

static void labelledDemoDirectionUsesTheRealDistance() {
  // Off by default: the honest distance-only ring.
  auto honest = findGuidance(demo(NAN));
  assert(honest.mode == FindMode::DistanceOnly && honest.ring == RingShape::Full && !honest.demoDirection);

  for (double chosen : {0.0, 45.0, 315.0, -45.0, 405.0}) {
    auto shown = findGuidance(demo(chosen));
    const double normalized = std::fmod(std::fmod(chosen, 360) + 360, 360);
    assert(shown.mode == FindMode::DemoDirection && shown.demoDirection);
    // Never reported as a measured or usable direction.
    assert(!shown.directionUsable && std::isnan(shown.bearing));
    assert(shown.ring == RingShape::Quarter && shown.visuals.arrow.visible);
    assert(angularGap(shown.visuals.light.bearing, normalized) < 1e-9);
    assert(angularGap(shown.demoBearing, normalized) < 1e-9);
    assert(angularGap(tipBearing(shown.visuals.arrow), normalized) < 3);
    // Brightness and beeps come from the real measured distance.
    assert(shown.source == DistanceSource::WifiRange && shown.metres == 0.4);
    assert(std::abs(shown.visuals.light.brightness - proximityFeedback(true, 0.4).brightness) < 1e-12);
    assert(shown.beepIntervalMs == proximityFeedback(true, 0.4).beepIntervalMs);
  }
  auto near = findGuidance(demo(90, range(0.05)));
  auto far = findGuidance(demo(90, range(1.3, 1.5)));
  assert(near.visuals.light.brightness > far.visuals.light.brightness);
  assert(near.beepIntervalMs < far.beepIntervalMs);

  // No real distance: no demo shell either (nothing would be measured at all).
  auto unmeasured = findGuidance(demo(90, NO_RANGE));
  assert(unmeasured.mode == FindMode::Unavailable && unmeasured.ring == RingShape::None);
  assert(!unmeasured.visuals.arrow.visible && unmeasured.beepIntervalMs == 0);
  auto offline = demo(90);
  offline.peerConnected = false;
  auto lost = findGuidance(offline);
  assert(lost.mode == FindMode::Offline && !lost.visuals.arrow.visible && lost.beepIntervalMs == 0);
  auto away = demo(90);
  away.finding = false;
  auto hidden = findGuidance(away);
  assert(!hidden.visuals.arrow.visible && hidden.ring == RingShape::None && hidden.beepIntervalMs == 0);

  // A usable real GPS direction always replaces the demo.
  auto real = gps(200, 120);
  real.demoBearing = 10;
  auto measured = findGuidance(real);
  assert(measured.mode == FindMode::Direction && !measured.demoDirection);
  assert(angularGap(measured.visuals.light.bearing, 200) < 1e-9);
}

static void demoControlsRotateInFortyFiveDegreeSteps() {
  assert(nextDemoBearing(NAN, 1) == 0 && nextDemoBearing(NAN, -1) == 0);
  assert(nextDemoBearing(0, 1) == 45 && nextDemoBearing(0, -1) == 315);
  assert(nextDemoBearing(315, 1) == 0 && nextDemoBearing(45, -1) == 0);
  double bearing = NAN;
  for (int press = 0; press < 8; ++press) bearing = nextDemoBearing(bearing, 1);
  assert(bearing == 315);
}

static FindInputs walked(double bearing, double uncertainty, RangeReading measured = range(6, 1.5)) {
  FindInputs inputs{true, true, false, false, NAN, NAN, directionQuality(NAN, 0, 0), measured};
  inputs.walkBearing = bearing;
  inputs.walkUncertaintyDegrees = uncertainty;
  return inputs;
}

static void walkEstimateShowsAnArrowWithItsUncertainty() {
  for (double bearing : {0.0, 120.0, 359.5, -30.0}) {
    auto shown = findGuidance(walked(bearing, 20));
    const double normalized = std::fmod(std::fmod(bearing, 360) + 360, 360);
    assert(shown.mode == FindMode::WalkEstimate && shown.walkEstimate);
    // An estimate from the walk, never reported as a GPS-usable direction.
    assert(!shown.directionUsable && !shown.demoDirection && std::isnan(shown.bearing));
    assert(shown.ring == RingShape::Quarter && shown.visuals.arrow.visible);
    assert(angularGap(shown.visuals.light.bearing, normalized) < 1e-9);
    assert(angularGap(tipBearing(shown.visuals.arrow), normalized) < 3);
    assert(shown.walkUncertaintyDegrees == 20);
    assert(shown.source == DistanceSource::WifiRange && shown.metres == 6);
    assert(shown.beepIntervalMs == proximityFeedback(true, 6).beepIntervalMs);
  }
  // Too uncertain, no current distance, offline or not finding: no arrow.
  assert(findGuidance(walked(90, 46)).mode == FindMode::DistanceOnly);
  assert(findGuidance(walked(90, NAN)).mode == FindMode::DistanceOnly);
  assert(findGuidance(walked(90, 20, NO_RANGE)).mode == FindMode::Unavailable);
  auto offline = walked(90, 20);
  offline.peerConnected = false;
  assert(findGuidance(offline).mode == FindMode::Offline && !findGuidance(offline).visuals.arrow.visible);
  auto away = walked(90, 20);
  away.finding = false;
  assert(!findGuidance(away).visuals.arrow.visible && findGuidance(away).beepIntervalMs == 0);
  // Priority: usable GPS direction > walk estimate > labelled demo.
  auto withDemo = walked(90, 20);
  withDemo.demoBearing = 270;
  auto estimate = findGuidance(withDemo);
  assert(estimate.mode == FindMode::WalkEstimate && angularGap(estimate.visuals.light.bearing, 90) < 1e-9);
  auto gpsToo = gps(200, 120);
  gpsToo.walkBearing = 90;
  gpsToo.walkUncertaintyDegrees = 20;
  auto gpsWins = findGuidance(gpsToo);
  assert(gpsWins.mode == FindMode::Direction && !gpsWins.walkEstimate);
}

static FindInputs probed(double bearing, double uncertainty, RangeReading measured = range(0.5)) {
  FindInputs inputs{true, true, false, false, NAN, NAN, directionQuality(NAN, 0, 0), measured};
  inputs.probeBearing = bearing;
  inputs.probeUncertaintyDegrees = uncertainty;
  return inputs;
}

static void warmerColderProbesShowALabelledArrow() {
  for (double bearing : {0.0, 90.0, 359.0, -45.0}) {
    auto shown = findGuidance(probed(bearing, 64));
    const double normalized = std::fmod(std::fmod(bearing, 360) + 360, 360);
    assert(shown.mode == FindMode::ProbeEstimate && shown.probeEstimate);
    assert(!shown.directionUsable && !shown.walkEstimate && !shown.demoDirection);
    assert(shown.ring == RingShape::Quarter && shown.visuals.arrow.visible);
    assert(angularGap(shown.visuals.light.bearing, normalized) < 1e-9);
    assert(angularGap(tipBearing(shown.visuals.arrow), normalized) < 3);
    assert(shown.probeUncertaintyDegrees == 64);
    assert(shown.beepIntervalMs == proximityFeedback(true, 0.5).beepIntervalMs);
  }
  assert(findGuidance(probed(90, PROBE_MAX_UNCERTAINTY_DEGREES + 1)).mode == FindMode::DistanceOnly);
  assert(findGuidance(probed(90, NAN)).mode == FindMode::DistanceOnly);
  assert(findGuidance(probed(90, 64, NO_RANGE)).mode == FindMode::Unavailable);
  auto offline = probed(90, 64);
  offline.peerConnected = false;
  assert(findGuidance(offline).mode == FindMode::Offline);
  // Priority: GPS > walk estimate > warmer/colder > demo.
  auto withDemo = probed(90, 64);
  withDemo.demoBearing = 270;
  assert(findGuidance(withDemo).mode == FindMode::ProbeEstimate);
  auto withWalk = probed(90, 64, range(6, 1.5));
  withWalk.walkBearing = 10;
  withWalk.walkUncertaintyDegrees = 20;
  auto walk = findGuidance(withWalk);
  assert(walk.mode == FindMode::WalkEstimate && angularGap(walk.visuals.light.bearing, 10) < 1e-9);
}

static void namesForStatus() {
  assert(std::strcmp(findModeName(FindMode::ProbeEstimate), "probe-estimate") == 0);
  assert(std::strcmp(findModeName(FindMode::WalkEstimate), "walk-estimate") == 0);
  assert(std::strcmp(findModeName(FindMode::DemoDirection), "demo-direction") == 0);
  assert(std::strcmp(findModeName(FindMode::DistanceOnly), "distance") == 0);
  assert(std::strcmp(findModeName(FindMode::Direction), "direction") == 0);
  assert(std::strcmp(findModeName(FindMode::Uncertain), "uncertain") == 0);
  assert(std::strcmp(findModeName(FindMode::Unavailable), "unavailable") == 0);
  assert(std::strcmp(findModeName(FindMode::Offline), "offline") == 0);
  assert(std::strcmp(distanceSourceName(DistanceSource::WifiRange), "wifi-ftm") == 0);
  assert(std::strcmp(distanceSourceName(DistanceSource::PhoneGps), "phone-gps") == 0);
  assert(std::strcmp(distanceSourceName(DistanceSource::None), "none") == 0);
  assert(std::strcmp(ringShapeName(RingShape::Full), "full") == 0);
}

int main() {
  arrowAndQuarterRingShareOneBearing();
  measuredDistanceWithoutDirection();
  unusableGpsShowsNoNumberAndNoFeedback();
  measuredRangeInsideGpsUncertaintySuppressesTheArrow();
  offlineStaleAndRecovery();
  onlyTheFindScreenLightsAndBeeps();
  labelledDemoDirectionUsesTheRealDistance();
  demoControlsRotateInFortyFiveDegreeSteps();
  walkEstimateShowsAnArrowWithItsUncertainty();
  warmerColderProbesShowALabelledArrow();
  namesForStatus();
  std::cout << "PASS: arrow/ring alignment and wraparound, distance-only ring, unusable GPS, contradiction, offline/stale/recovery, labelled demo direction\n";
}
