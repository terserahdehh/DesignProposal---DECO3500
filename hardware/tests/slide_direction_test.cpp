#include <cassert>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <random>
#include <sstream>
#include <string>
#include <vector>
#include "../include/pdr.h"
#include "../include/slide_direction.h"
#include "../include/table_tracking.h"

static double gap(double a, double b) { return std::abs(std::fmod(a - b + 540, 360) - 180); }
static constexpr double kPi = 3.14159265358979323846;

// Feeds 112 Hz readings and collects every finished move.
struct Run {
  SlideDetector detector;
  std::vector<SlideResult> moves;
  void feed(const ImuReading &reading, double heading) {
    if (detector.update(reading, heading)) moves.push_back(detector.last());
  }
  int accepted() const {
    int count = 0;
    for (const SlideResult &move : moves) count += move.accepted;
    return count;
  }
  const SlideResult *first() const {
    for (const SlideResult &move : moves) if (move.accepted) return &move;
    return nullptr;
  }
};

// A band lying flat with a strap tilt: body x = -top, y = -right, z = -up.
// `push` moves it toward `pushDegrees` (clockwise from its top) with a smooth
// speed-up then slow-down over `seconds`, travelling `metres`.
struct Band {
  std::mt19937 random{7};
  std::normal_distribution<double> noise{0, 1};
  uint32_t micros = 1000000;
  double tiltDegrees = 4, tiltToward = 30;  // strap props one edge up
  double headingDegrees = 0;
  Run run;
  void reading(double top, double right, double lift, double turnRate, double tipRate) {
    // Gravity read as "up", tipped by the strap; the push adds to it.
    const double tip = tiltDegrees * kPi / 180, toward = tiltToward * kPi / 180;
    double up[3] = {-std::sin(tip) * std::cos(toward), -std::sin(tip) * std::sin(toward), -std::cos(tip)};
    ImuReading r{micros, {}, {}};
    const double linear[3] = {-top / 9.80665, -right / 9.80665, -lift / 9.80665};
    for (int k = 0; k < 3; ++k) r.accel[k] = up[k] + linear[k] + 0.0008 * noise(random);
    // Turning clockwise seen from above is negative about "up".
    for (int k = 0; k < 3; ++k) r.gyro[k] = 0.3 * noise(random) - turnRate * up[k];
    r.gyro[0] += tipRate;
    run.feed(r, headingDegrees);
    micros += 8929;  // 112 Hz
  }
  void rest(double seconds) { for (int i = 0; i < seconds * 112; ++i) reading(0, 0, 0, 0, 0); }
  void push(double pushDegrees, double metres = 0.15, double seconds = 1.0, double strapStepDegrees = 0) {
    const double peak = 2 * kPi * metres / (seconds * seconds), radians = pushDegrees * kPi / 180;
    const int samples = int(seconds * 112);
    for (int i = 0; i < samples; ++i) {
      const double a = peak * std::sin(2 * kPi * i / samples);
      // The strap may settle at a slightly different tilt during the push.
      const double step = i > samples / 2 && i <= samples / 2 + 11 ? strapStepDegrees / 11 : 0;
      tiltDegrees += step;
      reading(a * std::cos(radians), a * std::sin(radians), 0, 0, step * 112);
    }
  }
};

static void pushesInEveryDirectionAreMeasured() {
  for (int direction = 0; direction < 360; direction += 45) {
    Band band;
    band.headingDegrees = 30;  // the band was turned earlier
    band.rest(1.5);
    band.push(direction, 0.15, 1.0, 1.3);
    band.rest(1.5);
    assert(band.run.accepted() == 1);
    const SlideResult &slide = *band.run.first();
    assert(gap(slide.bearingFromTop, direction) < 10);
    assert(gap(slide.headingFrameBearing, direction + 30) < 10);
    assert(slide.weight > SLIDE_MIN_WEIGHT);
  }
  // Pushes of 0.4-1.5 s count, including hard flicks (not mistaken for lifts).
  Band slow;
  slow.rest(1.5);
  slow.push(90, 0.30, 1.5);
  slow.rest(1.5);
  assert(slow.run.accepted() == 1 && gap(slow.run.first()->bearingFromTop, 90) < 15);
  Band flick;
  flick.rest(1.5);
  flick.push(200, 0.15, 0.4);
  flick.rest(1.5);
  assert(flick.run.accepted() == 1 && gap(flick.run.first()->bearingFromTop, 200) < 10);
  // A perfectly smooth 3 s glide is too faint to measure: its steady middle
  // looks like a stop. Hand pushes are jerkier (the recorded 7 s one counted).
  Band glide;
  glide.rest(1.5);
  glide.push(90, 0.15, 3.0);
  glide.rest(1.5);
  assert(glide.run.accepted() == 0);
}

static void restingTwistingAndLiftingGiveNoDirection() {
  Band resting;
  resting.rest(30);
  assert(resting.run.moves.empty());
  // Turning the band in place back and forth, as fingers do when adjusting it.
  Band twisted;
  twisted.rest(1.5);
  for (int i = 0; i < 224; ++i) {
    const double rate = 60 * std::sin(2 * kPi * i / 112);
    twisted.headingDegrees += rate / 112;
    twisted.reading(0.05 * std::sin(2 * kPi * i / 112), 0, 0, rate, 0);
  }
  twisted.rest(1.5);
  assert(!twisted.run.moves.empty() && twisted.run.accepted() == 0);
  // Picked up: tipped 15 degrees and bounced up and down while it moves.
  Band lifted;
  lifted.rest(1.5);
  for (int i = 0; i < 112; ++i) {
    const double tipRate = i < 56 ? 15 : -15;
    lifted.tiltDegrees += tipRate / 112;
    lifted.reading(std::sin(2 * kPi * i / 112), 0, 2 * std::sin(kPi * i / 112), 0, tipRate);
  }
  lifted.rest(1.5);
  assert(lifted.run.accepted() == 0 && lifted.run.moves.back().reject == SlideReject::Lifted);
  // Tipped up on one edge and back on the table: no up-and-down movement.
  Band tipped;
  tipped.rest(1.5);
  for (int i = 0; i < 112; ++i) {
    const double tipRate = i < 56 ? 20 : -20;
    tipped.tiltDegrees += tipRate / 112;
    tipped.reading(0.3 * std::sin(2 * kPi * i / 112), 0, 0, 0, tipRate);
  }
  tipped.rest(1.5);
  assert(tipped.run.accepted() == 0 && tipped.run.moves.back().reject == SlideReject::Tipped);
  // Turning more than 45 degrees while moving.
  Band turned;
  turned.rest(1.5);
  for (int i = 0; i < 112; ++i) {
    turned.headingDegrees += 90.0 / 112;
    turned.reading(std::sin(2 * kPi * i / 112), 0, 0, 90, 0);
  }
  turned.rest(1.5);
  assert(turned.run.accepted() == 0 && turned.run.moves.back().reject == SlideReject::Turned);
}

static void endlessHandlingIsNotAMove() {
  Band band;
  band.rest(1.5);
  for (int i = 0; i < 14 * 112; ++i) band.reading(0.5 * std::sin(i * 0.3), 0.5 * std::cos(i * 0.21), 0, 0, 0);
  assert(!band.run.moves.empty() && band.run.moves.front().reject == SlideReject::TooLong);
  assert(std::isnan(band.run.moves.front().bearingFromTop));
}

static void headingWrapAndResetAreHandled() {
  Band band;
  band.headingDegrees = 179;
  band.rest(1.5);
  band.headingDegrees = -179;  // the gyro heading wrapped while still
  band.rest(0.6);
  band.push(0);
  band.rest(1.5);
  assert(band.run.accepted() == 1 && gap(band.run.first()->headingFrameBearing, 181) < 10);
  band.run.detector.reset();
  assert(!band.run.detector.moving() && std::isnan(band.run.detector.last().bearingFromTop));
}

static void restToRestDisplacementUsesFullAcceleration() {
  for (int direction=0; direction<360; direction+=45) {
    Band band;
    band.rest(1.5);
    band.push(direction,.30,1.0);
    band.rest(1.5);
    assert(band.run.accepted()==1);
    assert(std::abs(band.run.first()->displacementMetres-.30)<.03);
    const double angle=direction*kPi/180;
    assert(std::abs(band.run.first()->displacementXMetres-.30*std::sin(angle))<.03);
    assert(std::abs(band.run.first()->displacementYMetres-.30*std::cos(angle))<.03);
  }
}

static void recordedForwardAndBackwardPreserveBothSigns() {
  const std::string here=__FILE__;
  std::ifstream in(here.substr(0,here.find_last_of('/'))+"/fixtures/forward-back-2026-10-14.txt");
  assert(in);
  std::string line,window;
  Run run;WalkTracker walker;int windows=0;
  auto check=[&](){
    std::vector<SlideResult> measured;
    for(const auto &move:run.moves)if(move.accepted)measured.push_back(move);
    assert(measured.size()==2);
    assert(measured[0].displacementYMetres>.20);
    assert(measured[1].displacementYMetres<-.20);
    for(const auto &move:measured)assert(std::abs(move.displacementXMetres)<.06);
    TableTracking a,b;
    a.start(1,0,.3);b.start(1,1,.3);
    const bool movingNayaka=window=="nayaka";
    TableTracking &moving=movingNayaka?a:b;
    moving.slide(measured[0]);
    a.peer(1,1,b.x(),b.y(),true,false,100);
    b.peer(1,1,a.x(),a.y(),true,false,100);
    assert(gap(a.bearing(100,0,false),90)>20);
    assert(gap(b.bearing(100,0,false),270)>20);
    moving.slide(measured[1]);
    a.peer(1,2,b.x(),b.y(),true,false,200);
    b.peer(1,2,a.x(),a.y(),true,false,200);
    assert(std::abs(moving.y())<.06);
    assert(gap(a.bearing(200,0,false),90)<12);
    assert(gap(b.bearing(200,0,false),270)<12);
    std::cout<<"  recorded "<<window<<": dy="<<measured[0].displacementYMetres<<", "<<measured[1].displacementYMetres<<"; both arrows respond and return\n";
  };
  while(std::getline(in,line)){
    if(line.empty()||line[0]=='#')continue;
    if(line.rfind("window ",0)==0){
      if(!window.empty())check();
      window=line.substr(7);run=Run{};walker=WalkTracker{};++windows;continue;
    }
    std::istringstream fields(line);long values[7];for(auto &v:values)fields>>v;
    ImuReading reading{uint32_t(values[0]),{values[1]/8192.0,values[2]/8192.0,values[3]/8192.0},{values[4]/64.0,values[5]/64.0,values[6]/64.0}};
    walker.update(reading);run.feed(reading,walker.headingDegrees());
  }
  check();assert(windows==3);
}

static void recordedWeakReturnStillUpdatesBothPositions() {
  const std::string here=__FILE__;
  std::ifstream in(here.substr(0,here.find_last_of('/'))+"/fixtures/weak-return-2026-10-14.txt");
  assert(in);Run run;WalkTracker walker;std::string line;
  while(std::getline(in,line)) {
    if(line.empty()||line[0]=='#')continue;
    std::istringstream fields(line);long v[7];for(long &value:v)fields>>value;
    ImuReading r{uint32_t(v[0]),{v[1]/8192.0,v[2]/8192.0,v[3]/8192.0},{v[4]/64.0,v[5]/64.0,v[6]/64.0}};
    walker.update(r);run.feed(r,walker.headingDegrees());
  }
  TableTracking a,b;a.start(2,0,.3);b.start(2,1,.3);
  int usable=0;bool recoveredReturn=false;uint32_t sequence=0;
  for(const auto &move:run.moves) {
    if(!slidePositionUsable(move))continue;
    const double previousY=a.y();
    a.slide(move);++sequence;
    a.peer(2,sequence,b.x(),b.y(),true,false,100);
    b.peer(2,sequence,a.x(),a.y(),true,false,100);
    ++usable;
    if(!move.accepted && move.reject==SlideReject::TooSmall) {
      assert(move.displacementYMetres<-.03);
      assert(a.y()<previousY-.03);
      assert(gap(a.bearing(100,0,false),b.bearing(100,0,false)+180)<1e-6);
      recoveredReturn=true;
    }
  }
  assert(usable==2 && recoveredReturn);
}

// The pushes the user made on 13 Oct, replayed through the firmware's gyro
// heading and the detector.
static void recordedPushes() {
  const std::string here = __FILE__;
  std::ifstream in(here.substr(0, here.find_last_of('/')) + "/fixtures/slides-2026-10-13.txt");
  assert(in);
  std::string line, window;
  WalkTracker walker;
  Run run;
  auto check = [&]() {
    if (window == "right") {
      assert(run.accepted() == 1 && gap(run.first()->bearingFromTop, 90) < 15);
      std::cout << "  recorded push right: " << run.first()->bearingFromTop << " deg\n";
      std::cout << "  experimental displacement: " << run.first()->displacementMetres << " m\n";
    } else if (window == "top") {
      assert(run.accepted() == 1 && gap(run.first()->bearingFromTop, 0) < 15);
      std::cout << "  recorded push toward top: " << run.first()->bearingFromTop << " deg\n";
    } else if (window == "right-wobbly") {
      // No clean line; the net movement still went right (true 90 degrees).
      assert(run.accepted() == 1 && gap(run.first()->bearingFromTop, 90) < 30);
      assert(run.first()->straightness < SLIDE_MIN_STRAIGHTNESS);
      std::cout << "  recorded wobbly push right: " << run.first()->bearingFromTop << " deg\n";
    } else if (window == "lifted") {
      assert(run.accepted() == 0);
      bool lifted = false;
      for (const SlideResult &move : run.moves) lifted = lifted || move.reject == SlideReject::Lifted;
      assert(lifted);
    }
  };
  int windows = 0;
  while (std::getline(in, line)) {
    if (line.empty() || line[0] == '#') continue;
    if (line.rfind("window ", 0) == 0) {
      if (!window.empty()) check();
      std::istringstream name(line.substr(7));
      name >> window;
      run = Run{};
      walker = WalkTracker{};
      ++windows;
      continue;
    }
    std::istringstream fields(line);
    long v[7];
    for (long &value : v) fields >> value;
    ImuReading r{uint32_t(v[0]), {v[1] / 8192.0, v[2] / 8192.0, v[3] / 8192.0}, {v[4] / 64.0, v[5] / 64.0, v[6] / 64.0}};
    walker.update(r);
    run.feed(r, walker.headingDegrees());
  }
  check();
  assert(windows == 4);
}

int main() {
  pushesInEveryDirectionAreMeasured();
  restingTwistingAndLiftingGiveNoDirection();
  endlessHandlingIsNotAMove();
  headingWrapAndResetAreHandled();
  restToRestDisplacementUsesFullAcceleration();
  recordedPushes();
  recordedForwardAndBackwardPreserveBothSigns();
  recordedWeakReturnStillUpdatesBothPositions();
  std::cout << "PASS: slide direction in 8 directions, slow and quick pushes, twists, lifts, turns, wrap, recorded pushes\n";
}
