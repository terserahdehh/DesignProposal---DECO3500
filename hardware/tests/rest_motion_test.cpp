#include <cassert>
#include <cmath>
#include <iostream>
#include <vector>
#include <fstream>
#include <sstream>
#include <string>
#include "../include/rest_motion.h"
#include "../include/table_tracking.h"
#include "../include/pdr.h"

struct Sample { float accel[3],gyro[3],heading; };
constexpr double pi=3.14159265358979323846;

// Independent analytical body-Y rotation: R = R0 * Ry(theta), where the
// QMI8658's -x/-y/-z initially point screen top/right/up. The sensor rotates
// 120 degrees through vertical while translating in known world directions.
static MotionVector experiment(double dx,double dy,double dz,double turn,double heading=0) {
  std::vector<Sample> samples;
  for(int i=0;i<112;++i){
    const bool moving=i>=28&&i<84;
    const double fraction=moving?(i-28+.5)/56.0:(i<28?0:1);
    const double theta=turn*fraction*pi/180;
    const double wave=moving?2*pi*std::sin(2*pi*(i-28)/56.0):0;
    const double ax=dx*wave/9.80665,ay=dy*wave/9.80665,az=dz*wave/9.80665;
    Sample s{{float(-std::cos(theta)*ay+std::sin(theta)*(1+az)),float(-ax),float(-std::sin(theta)*ay-std::cos(theta)*(1+az))},
             {.4f,float((moving?turn:0)-.7),.2f},float(heading)};
    samples.push_back(s);
  }
  float scratch[112][3];
  return restMotion(samples.data(),samples.size(),56,8,scratch);
}

static void recordedLiftDoesNotDiscardTheForwardHalf() {
  const std::string here=__FILE__;
  std::ifstream in(here.substr(0,here.find_last_of('/'))+"/fixtures/lift-return-2026-10-14.txt");
  assert(in);WalkTracker wrist;SlideDetector detector;std::vector<SlideResult> moves;std::string line;
  while(std::getline(in,line)){
    if(line.empty()||line[0]=='#')continue;
    std::istringstream fields(line);long v[7];for(long &value:v)fields>>value;
    ImuReading r{uint32_t(v[0]),{v[1]/8192.0,v[2]/8192.0,v[3]/8192.0},{v[4]/64.0,v[5]/64.0,v[6]/64.0}};
    wrist.update(r);
    if(detector.update(r,wrist.headingDegrees(),&wrist.orientation())&&slidePositionUsable(detector.last()))moves.push_back(detector.last());
  }
  assert(moves.size()==2);
  assert(!moves[0].accepted && moves[0].rotationCompensated && moves[0].displacementYMetres>.2);
  assert(moves[1].displacementYMetres<-.2);
  TableTracking a,b;a.start(13,0,.3);b.start(13,1,.3);
  a.slide(moves[0]);b.peer(13,1,a.x(),a.y(),a.valid(),false,100,a.z());
  assert(a.bearing(100,0,false)>120 && b.bearing(100,0,false)>300);
  a.slide(moves[1]);b.peer(13,2,a.x(),a.y(),a.valid(),false,100,a.z());
  assert(std::abs(a.y())<.08);
  assert(std::abs(a.bearing(100,0,false)-90)<20);
  assert(std::abs(b.bearing(100,0,false)-270)<20);
}

int main() {
  recordedLiftDoesNotDiscardTheForwardHalf();
  WalkTracker wrist;uint32_t micros=1000000;
  for(int i=0;i<224;++i){wrist.update({micros,{0,0,-1},{.4,-.7,.2}});micros+=8929;}
  wrist.reset();
  for(int i=0;i<112;++i){
    const double angle=120.*(i+1)/112*pi/180;
    wrist.update({micros,{std::sin(angle),0,-std::cos(angle)},{.4,119.3,.2}});micros+=8929;
  }
  assert(std::abs(wrist.orientation().row[1][0]+std::cos(120*pi/180))<.02);
  assert(std::abs(wrist.orientation().row[1][2]+std::sin(120*pi/180))<.02);
  TableTracking sideways;sideways.start(12,0,.3);
  assert(std::abs(sideways.bearingFromFrame(100,wrist.orientation())-90)<1);
  for(double turn:{0.,30.,120.,-120.}) {
    const auto move=experiment(.12,.2,.1,turn);
    assert(move.valid);
    assert(std::abs(move.x-.12)<.005 && std::abs(move.y-.2)<.005 && std::abs(move.z-.1)<.005);
    const auto rotation=experiment(0,0,0,turn);
    assert(rotation.valid && std::hypot(rotation.x,rotation.y)<.001 && std::abs(rotation.z)<.001);
  }
  const auto rotated=experiment(.12,.2,.1,120,90);
  assert(rotated.valid && std::abs(rotated.x-.2)<.005 && std::abs(rotated.y+.12)<.005);
  TableTracking a,b;a.start(10,0,.3);b.start(10,1,.3);
  SlideResult lift{false,SlideReject::Lifted,0,0,0,2,0,.2,0,.2,.1,true};
  lift.headingFrameBearing=NAN; // no horizontal top azimuth when screen is vertical
  assert(slidePositionUsable(lift));
  b.slide(lift);
  assert(std::abs(b.y()-.2)<1e-9 && std::abs(b.z()-.1)<1e-9 && !b.valid());
  a.peer(10,1,b.x(),b.y(),false,false,100,b.z());
  b.peer(10,1,a.x(),a.y(),true,false,100,a.z());
  assert(a.bearing(100,0,false)<60 && b.bearing(100,0,false)>210);
  MotionMatrix flat;const double up[3]={0,0,-1};assert(motionFrame(up,0,flat));
  assert(std::abs(a.bearingFromFrame(100,flat)-a.bearing(100,0,false))<1e-9);
  // Height is projected into a tilted screen's plane; directly out of a flat
  // screen has no representable 2D bearing and retains the previous arrow.
  TableTracking height;height.start(11,0,.3);height.peer(11,1,0,0,true,false,100,.3);
  assert(height.bearingFromFrame(100,flat)==90);
  const double tippedUp[3]={-std::sqrt(.5),0,-std::sqrt(.5)};
  MotionMatrix tipped;assert(motionFrame(tippedUp,0,tipped));
  assert(std::abs(height.bearingFromFrame(100,tipped))<1e-6);
  const double vertical[3]={-1,0,0};assert(!motionFrame(vertical,0,tipped));
  std::cout<<"PASS: three-axis rest motion, 120-degree pitch, no translation from pure rotation, shared height and screen projection\n";
}
