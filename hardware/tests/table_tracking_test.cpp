#include <cassert>
#include <cmath>
#include <iostream>
#include "../include/table_tracking.h"

static double gap(double a, double b) { return std::abs(std::fmod(a-b+540,360)-180); }
static void weakReturnsAndLaterMovesDoNotFreezeTracking() {
  TableTracking a,b;a.start(9,0,.3);b.start(9,1,.3);
  auto exchange=[&](uint32_t sequence){
    assert(a.peer(9,sequence,b.x(),b.y(),b.valid(),false,100));
    assert(b.peer(9,sequence,a.x(),a.y(),a.valid(),false,100));
  };
  a.slide({true,SlideReject::None,0,0,.1,2,1,.2,0,.2});exchange(1);
  const double away=a.bearing(100,0,false);
  SlideResult returning{false,SlideReject::TooSmall,180,180,.008,2,1,.2,0,-.2};
  assert(slidePositionUsable(returning));
  a.slide(returning);exchange(2);
  assert(gap(a.bearing(100,0,false),90)<1e-6);
  assert(gap(b.bearing(100,0,false),270)<1e-6);
  assert(gap(away,90)>20);
  // Noise is not promoted into a movement, even with signed components.
  a.slide({false,SlideReject::TooGentle,0,0,0,1,0,.001,0,.001});
  assert(a.y()==0);
  a.slide({false,SlideReject::Lifted,NAN,NAN,0,1,0});exchange(3);
  assert(!a.valid());
  // Keep the uncertainty flag, but allow the OTHER band's fresh movement to
  // change both estimates instead of freezing at a pre-lift bearing.
  b.slide({true,SlideReject::None,0,0,.1,2,1,.2,0,.2});exchange(4);
  assert(gap(a.bearing(100,0,false),90)>20);
  assert(gap(b.bearing(100,0,false),270)>20);
  a.slide({false,SlideReject::TooGentle,0,0,.008,2,1,.2,0,.2});exchange(5);
  assert(!a.valid() && std::abs(a.y()-.2)<1e-9);
  assert(gap(a.bearing(100,0,false),90)<1e-6);
  assert(gap(b.bearing(100,0,false),270)<1e-6);
}
static void signedDisplacementInEveryDirectionUpdatesBothBands() {
  for(int owner=0;owner<2;++owner){
    for(int direction=0;direction<360;direction+=45){
      TableTracking a,b;a.start(7,0,.3);b.start(7,1,.3);
      const double angle=direction*3.14159265358979323846/180;
      const double dx=.12*std::sin(angle),dy=.12*std::cos(angle);
      // A misleading filtered bearing must not replace the signed vector.
      (owner?b:a).slide({true,SlideReject::None,270,270,.1,1,1,.12,dx,dy});
      assert(a.peer(7,1,b.x(),b.y(),true,false,100));
      assert(b.peer(7,1,a.x(),a.y(),true,false,100));
      assert(std::abs((owner?b:a).x()-(owner?.3:0)-dx)<1e-9);
      assert(std::abs((owner?b:a).y()-dy)<1e-9);
      const double bearing=std::atan2(b.x()-a.x(),b.y()-a.y())*180/3.14159265358979323846;
      assert(gap(a.bearing(100,0,false),bearing)<1e-6);
      assert(gap(b.bearing(100,0,false),bearing+180)<1e-6);
      if(std::abs(dy)>.01){assert(gap(a.bearing(100,0,false),90)>10);assert(gap(b.bearing(100,0,false),270)>10);}
      (owner?b:a).slide({true,SlideReject::None,270,270,.1,1,1,.12,-dx,-dy});
      a.peer(7,2,b.x(),b.y(),true,false,200);b.peer(7,2,a.x(),a.y(),true,false,200);
      assert(gap(a.bearing(200,0,false),90)<1e-6 && gap(b.bearing(200,0,false),270)<1e-6);
    }
  }
  TableTracking a,b;a.start(8,0,.3);b.start(8,1,.3);
  a.slide({true,SlideReject::None,0,0,.1,1,1,.2,.12,.16});
  b.slide({true,SlideReject::None,0,0,.1,1,1,.2,.12,.16});
  a.peer(8,1,b.x(),b.y(),true,false,100);b.peer(8,1,a.x(),a.y(),true,false,100);
  assert(gap(a.bearing(100,0,false),90)<1e-6 && gap(b.bearing(100,0,false),270)<1e-6);
}
int main() {
  weakReturnsAndLaterMovesDoNotFreezeTracking();
  signedDisplacementInEveryDirectionUpdatesBothBands();
  TableTracking a, b;
  assert(!a.start(0,0,.3));
  assert(a.start(42,0,.3) && b.start(42,1,.3));
  assert(gap(a.bearing(100,0,false),90)<1e-6); // visible from known reset arrangement
  assert(a.peer(42,1,b.x(),b.y(),true,false,100));
  assert(b.peer(42,1,a.x(),a.y(),true,false,100));
  assert(gap(a.bearing(100,0,false),90)<1e-6);
  assert(gap(b.bearing(100,0,false),270)<1e-6);
  // Only Syifa moves UP. Nayaka's position does not change, but its arrow does.
  b.slide({true,SlideReject::None,0,0,.1,1,1,.3});
  assert(a.peer(42,2,b.x(),b.y(),true,false,200));
  assert(gap(a.bearing(200,0,false),45)<1e-6);
  assert(gap(b.bearing(200,0,false),225)<1e-6);
  assert(gap(a.bearing(200,90,false),315)<1e-6);
  // Both move: exchange absolute coordinates, without counting a retransmit twice.
  a.slide({true,SlideReject::None,90,90,.1,1,1,.1});
  assert(b.peer(42,2,a.x(),a.y(),true,false,300));
  assert(!a.peer(42,1,.3,0,true,false,300));
  assert(!a.peer(43,3,20,20,true,false,300));
  assert(std::isfinite(a.bearing(200,0,true)));
  assert(a.peer(42,3,b.x(),b.y(),true,true,300));
  assert(std::isfinite(a.bearing(300,0,false)));
  assert(a.peer(42,4,b.x(),b.y(),true,false,400));
  assert(std::isfinite(a.bearing(400,0,false)));
  const double remembered=a.bearing(400,0,false);
  assert(gap(a.bearing(1901,0,false),remembered)<1e-6);
  assert(gap(a.bearing(5401,0,false),remembered)<1e-6);
  assert(gap(a.bearing(5401,90,false),remembered-90)<1e-6);
  b.slide({false,SlideReject::Lifted,NAN,NAN,0,1,0});
  assert(!b.valid());
  assert(a.peer(42,5,b.x(),b.y(),false,false,500));
  assert(gap(a.bearing(500,0,false),remembered)<1e-6);
  assert(std::isfinite(b.bearing(500,0,false))); // local tracking loss also retains it
  a.stop(); assert(a.session()==0);
  TableTracking waiting;
  assert(waiting.start(43,0,.3,100000));
  assert(std::isfinite(waiting.bearing(1000000,0,false)));
  // R restores both positions, headings and validity with a new shared session.
  assert(a.start(44,0,.3,1000000) && b.start(44,1,.3,1000000));
  assert(a.x()==0 && a.y()==0 && b.x()==.3 && b.y()==0 && a.valid() && b.valid());
  assert(gap(a.bearing(1000000,0,false),90)<1e-6);
  assert(gap(b.bearing(1000000,0,false),270)<1e-6);
  // Coincident estimates have no new bearing: keep the previous finite arrow.
  assert(a.peer(44,1,0,0,true,false,1000001));
  assert(gap(a.bearing(1000001,0,false),90)<1e-6);
  assert(std::isfinite(a.bearing(1000001,NAN,true)));
  std::cout << "PASS: shared motion, retained arrows during movement/loss/coincidence, rotation, stale/reordered telemetry and paired reset\n";
}
