#pragma once
#include <cmath>
#include <stdint.h>
#include "slide_direction.h"

// Shared frame established explicitly by aligning both screen tops and
// placing Nayaka left of Syifa at a known centre-to-centre separation.
// Coordinates are estimated from motion, never inferred from signal strength.
class TableTracking {
  uint32_t session_ = 0, peerSequence_ = 0, peerAt_ = 0;
  double x_ = 0, y_ = 0, z_ = 0, peerX_ = 0, peerY_ = 0, peerZ_ = 0;
  bool valid_ = false, peerValid_ = false, peerMoving_ = false, peerSeen_ = false;
  bool threeDimensional_=false;
  mutable double lastBearing_ = 90, lastHeading_ = 0;
  mutable double lastDelta_[3] = {.3,0,0},lastScreenBearing_=90;
  void rememberDirection(uint32_t now) const {
    if((!peerSeen_||uint32_t(now-peerAt_)<=1500)&&
       std::sqrt((peerX_-x_)*(peerX_-x_)+(peerY_-y_)*(peerY_-y_)+(peerZ_-z_)*(peerZ_-z_))>=.05){
      lastDelta_[0]=peerX_-x_;lastDelta_[1]=peerY_-y_;lastDelta_[2]=peerZ_-z_;
    }
  }
 public:
  bool start(uint32_t session, unsigned owner, double separation, uint32_t now = 0) {
    if (!session || owner > 1 || !std::isfinite(separation) || separation < 0.05 || separation > 5) return false;
    session_ = session; x_ = owner ? separation : 0; y_ = z_ = 0;
    peerX_ = owner ? 0 : separation; peerY_ = peerZ_ = 0;
    valid_ = true; peerValid_ = peerSeen_ = peerMoving_ = false;
    threeDimensional_=false;
    peerSequence_ = peerAt_ = 0;
    peerAt_ = now;
    lastBearing_ = owner ? 270 : 90; lastHeading_ = 0;
    lastScreenBearing_=lastBearing_;lastDelta_[0]=owner?-separation:separation;lastDelta_[1]=lastDelta_[2]=0;
    return true;
  }
  void stop() { session_ = 0; valid_ = peerValid_ = peerSeen_ = false; }
  void slide(const SlideResult &s) {
    if (!session_) return;
    if(s.rotationCompensated)threeDimensional_=true;
    if (!s.accepted && !slidePositionUsable(s)) {
      if (s.reject == SlideReject::Lifted || s.reject == SlideReject::TooLong ||
          s.reject == SlideReject::Tipped || s.reject == SlideReject::Turned) valid_ = false;
      return;
    }
    if (!std::isfinite(s.displacementMetres) || s.displacementMetres > 1.5) { valid_ = false; return; }
    if(s.rotationCompensated && !s.accepted)valid_=false; // unverified free-hand estimate
    if (std::isfinite(s.displacementXMetres) && std::isfinite(s.displacementYMetres)) {
      x_ += s.displacementXMetres;
      y_ += s.displacementYMetres;
      if(std::isfinite(s.displacementZMetres))z_+=s.displacementZMetres;
    } else {
      if(!std::isfinite(s.headingFrameBearing)){valid_=false;return;}
      // Older callers/tests may supply only a measured length and bearing.
      const double angle = s.headingFrameBearing * 3.14159265358979323846 / 180;
      x_ += s.displacementMetres * std::sin(angle);
      y_ += s.displacementMetres * std::cos(angle);
    }
  }
  bool peer(uint32_t session, uint32_t sequence, double x, double y,
            bool valid, bool moving, uint32_t now, double z=0) {
    if (!session_ || session != session_ || !sequence || !std::isfinite(x) || !std::isfinite(y) ||
        std::abs(x) > 100 || std::abs(y) > 100 || !std::isfinite(z) || std::abs(z)>100 ||
        (peerSeen_ && int32_t(sequence - peerSequence_) <= 0)) return false;
    peerSequence_ = sequence; peerAt_ = now; peerSeen_ = true;
    peerX_ = x; peerY_ = y; peerZ_=z;peerValid_ = valid; peerMoving_ = moving;
    if(std::abs(z)>.001)threeDimensional_=true;
    return true;
  }
  const char *state(uint32_t now, bool moving) const {
    if (!session_) return "off";
    if (!valid_) return "realign";
    if (!peerSeen_) return "reset-position";
    if (uint32_t(now - peerAt_) > 1500) return "peer-stale";
    if (!peerValid_) return "peer-realign";
    if (moving || peerMoving_) return "moving";
    if (std::sqrt((peerX_-x_)*(peerX_-x_)+(peerY_-y_)*(peerY_-y_)+(peerZ_-z_)*(peerZ_-z_)) < 0.05) return "near";
    return "estimate";
  }
  double bearing(uint32_t now, double heading, bool moving) const {
    if (!session_) return NAN;
    if (std::isfinite(heading)) lastHeading_ = heading;
    (void)moving;
    // A missed/lifted movement lowers confidence; it does not prevent either
    // band's later measurable moves from changing the estimated relative
    // direction. Keep the last bearing only while the peer is stale or the
    // estimated positions coincide. R restores a known common arrangement.
    rememberDirection(now);
    if(std::hypot(lastDelta_[0],lastDelta_[1])>=.05)
      lastBearing_ = std::atan2(lastDelta_[0],lastDelta_[1])*180/3.14159265358979323846;
    return std::fmod(std::fmod(lastBearing_ - lastHeading_, 360.0) + 360.0, 360.0);
  }
  double bearingFromFrame(uint32_t now,const MotionMatrix &frame) const {
    if(!session_)return NAN;
    rememberDirection(now);
    double top=0,right=0;
    for(int k=0;k<3;++k){top-=lastDelta_[k]*frame.row[k][0];right-=lastDelta_[k]*frame.row[k][1];}
    if(std::isfinite(top)&&std::isfinite(right)&&std::hypot(top,right)>=.01)
      lastScreenBearing_=std::fmod(std::atan2(right,top)*180/3.14159265358979323846+360,360);
    return lastScreenBearing_;
  }
  uint32_t session() const { return session_; }
  bool valid() const { return valid_; }
  double x() const { return x_; }
  double y() const { return y_; }
  double z() const { return z_; }
  bool uses3D() const { return threeDimensional_; }
};
