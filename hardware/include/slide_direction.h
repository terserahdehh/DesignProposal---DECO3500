#pragma once
#include <algorithm>
#include <cmath>
#include <stdint.h>
#include "pdr.h"
#include "rest_motion.h"

// Which way a band lying flat was pushed across a table, from the
// accelerometer. Integrating a hand move into a distance failed on these
// boards (strap tilt, gyro drift), but the push itself is clear: its
// acceleration lies along one line, and speeding up comes before slowing
// down. A jerky stick-slip push has no clean line; then the net movement
// between the two rests gives the direction. Recorded 13 Oct 2026: pushes
// toward a band's right, left and top measured 86-93, 266 and 354 degrees, a
// wobbling push to the right 113 degrees, and lifts and twists in the hand
// were all rejected.
//
// Body axes of the QMI8658 on the Waveshare ESP32-S3-Touch-LCD-1.28, from
// those pushes: screen top = -x, screen right = -y, out of the screen = -z.
enum class SlideReject : uint8_t { None, TooLong, Lifted, Tipped, Turned, TooGentle, TooSmall };

struct SlideResult {
  bool accepted;
  SlideReject reject;
  double bearingFromTop;       // clockwise from the band's top when the push began
  double headingFrameBearing;  // the same direction in the gyroscope heading frame
  double weight;               // rough size of the movement, for combining pushes
  double seconds;
  double straightness;         // 1 = all acceleration along one line, 0 = none
  double displacementMetres = NAN; // rest-to-rest integration, experimental
  double displacementXMetres = NAN, displacementYMetres = NAN; // signed heading-frame motion
  double displacementZMetres = 0;
  bool rotationCompensated = false;
};

// Position tracking uses the full rest-to-rest integral, not the strength of
// the separate high-pass direction vote. A slow return can have a clear signed
// displacement while that vote fails. Keep lifts/tilts/turns rejected.
inline bool slidePositionUsable(const SlideResult &s) {
  const bool measured = s.rotationCompensated || s.accepted || s.reject == SlideReject::TooGentle || s.reject == SlideReject::TooSmall;
  return measured && std::isfinite(s.displacementMetres) && s.displacementMetres >= 0.015 &&
         s.displacementMetres <= 1.5 && std::isfinite(s.displacementXMetres) &&
         std::isfinite(s.displacementYMetres);
}

constexpr double SLIDE_RATE_HZ = 56;           // IMU samples averaged in pairs
constexpr int SLIDE_WINDOW = 17;               // 0.3 s steadiness window
constexpr int SLIDE_PRE = 28;                  // 0.5 s kept from before a move is noticed
constexpr int SLIDE_END = 6;                   // 0.4 s of steady samples ends a move
constexpr int SLIDE_MAX = 672;                 // 12 s
constexpr int SLIDE_REST = 8;                  // rest samples averaged at each end
constexpr int SLIDE_MEDIAN = 33;               // 0.6 s running median removes strap tilt
// Still on a desk, 0.3 s of readings varied by 0.0006-0.0018 g and 0.35 deg/s.
constexpr double SLIDE_STEADY_G = 0.0025;
constexpr double SLIDE_STEADY_DPS = 2.0;
// Lifting shook the band up and down by 0.3-0.5 g; desk pushes moved it
// vertically under 0.05 g. Tipping it on the table (11-26 degrees), or a fast
// twist as a finger lets go (163 deg/s, read as 6+ degrees of tilt), moves it
// up and down under 0.03 g: tipped, but still where it was.
constexpr double SLIDE_MAX_TILT_DEGREES = 6;
constexpr double SLIDE_MAX_SHAKE_G = 0.08;
constexpr double SLIDE_MAX_TURN_DEGREES = 45;
constexpr double SLIDE_MIN_PEAK = 0.15;        // m/s^2 after removing slow tilt
// Real pushes scored 0.05-0.13; twists of a band held in place under 0.003.
constexpr double SLIDE_MIN_WEIGHT = 0.02;
// Clean pushes scored 0.38-0.75; a wobbling stick-slip push 0.15.
constexpr double SLIDE_MIN_STRAIGHTNESS = 0.3;

inline double slideWrap(double degrees) { return std::fmod(std::fmod(degrees, 360.0) + 540.0, 360.0) - 180.0; }

class SlideDetector {
  struct Sample { float accel[3], gyro[3], heading,frame[3][3];bool framed=false; };
  Sample ring_[SLIDE_PRE] = {};
  Sample buffer_[SLIDE_MAX] = {};
  // Analysis scratch, kept out of the 8 KB loop-task stack.
  float tiltPath_[SLIDE_MAX] = {}, x_[SLIDE_MAX] = {}, y_[SLIDE_MAX] = {}, hx_[SLIDE_MAX] = {}, hy_[SLIDE_MAX] = {};
  float world_[SLIDE_MAX][3] = {};
  int ringCount_ = 0, ringNext_ = 0, count_ = 0, steadyCount_ = 0;
  bool moving_ = false, pending_ = false, halfPair_ = false, haveHeading_ = false;
  double pair_[6] = {};
  MotionMatrix pairFrame_;bool pairFramed_=false;
  double heading_ = 0;
  SlideResult last_{false, SlideReject::None, NAN, NAN, 0, 0, 0};

  static constexpr double kPi = 3.14159265358979323846;
  static double dot(const double *a, const double *b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  const Sample &recent(int back) const { return ring_[(ringNext_ - 1 - back + 2 * SLIDE_PRE) % SLIDE_PRE]; }

  // Gravity and rotation both unchanged over the last 0.3 s.
  void steadiness(bool &accelSteady, bool &steady) const {
    accelSteady = steady = false;
    if (ringCount_ < SLIDE_WINDOW) return;
    double mean[6] = {}, square[3] = {};
    for (int i = 0; i < SLIDE_WINDOW; ++i) {
      const Sample &s = recent(i);
      for (int k = 0; k < 3; ++k) { mean[k] += s.accel[k]; square[k] += double(s.accel[k]) * s.accel[k]; mean[3 + k] += s.gyro[k]; }
    }
    double spread = 0;
    for (int k = 0; k < 3; ++k) {
      mean[k] /= SLIDE_WINDOW;
      mean[3 + k] /= SLIDE_WINDOW;
      spread = std::fmax(spread, std::sqrt(std::fmax(0.0, square[k] / SLIDE_WINDOW - mean[k] * mean[k])));
    }
    accelSteady = spread < SLIDE_STEADY_G;
    double turn = 0;
    for (int i = 0; i < SLIDE_WINDOW; ++i)
      for (int k = 0; k < 3; ++k) turn = std::fmax(turn, std::abs(recent(i).gyro[k] - mean[3 + k]));
    steady = accelSteady && turn < SLIDE_STEADY_DPS;
  }

  void process(const Sample &sample) {
    ring_[ringNext_] = sample;
    ringNext_ = (ringNext_ + 1) % SLIDE_PRE;
    if (ringCount_ < SLIDE_PRE) ++ringCount_;
    bool accelSteady, steady;
    steadiness(accelSteady, steady);
    if (!moving_) {
      if (ringCount_ == SLIDE_PRE && !steady) {
        moving_ = true;
        count_ = steadyCount_ = 0;
        for (int i = SLIDE_PRE - 1; i >= 0; --i) buffer_[count_++] = recent(i);
      }
      return;
    }
    buffer_[count_++] = sample;
    // Twisting in place moves nothing; only the accelerometer must settle.
    steadyCount_ = accelSteady ? steadyCount_ + 1 : 0;
    const bool ended = steadyCount_ >= SLIDE_END;
    if (ended || count_ == SLIDE_MAX) {
      last_ = analyse(ended);
      pending_ = true;
      moving_ = false;
    }
  }

  // Running median of one component, for removing slow strap tilt.
  static double medianAround(const float *values, int count, int at) {
    const int from = std::max(0, at - SLIDE_MEDIAN / 2), to = std::min(count, at + SLIDE_MEDIAN / 2 + 1);
    float window[SLIDE_MEDIAN];
    int n = 0;
    for (int i = from; i < to; ++i) window[n++] = values[i];
    std::nth_element(window, window + n / 2, window + n);
    return window[n / 2];
  }

  SlideResult analyse(bool ended) {
    SlideResult result{false, SlideReject::TooLong, NAN, NAN, 0, (count_ - 1) / SLIDE_RATE_HZ, 0};
    if (!ended) return result;
    const int n = count_;
    // Preserve a separate 3-axis estimate even when a table-only direction
    // vote rejects a lift/tilt/turn. Warmer/colder votes remain rejected.
    MotionMatrix initial;
    for(int a=0;a<3;++a)for(int b=0;b<3;++b)initial.row[a][b]=buffer_[0].frame[a][b];
    const MotionVector motion=restMotion(buffer_,n,SLIDE_RATE_HZ,SLIDE_REST,world_,buffer_[0].framed?&initial:nullptr);
    if(motion.valid){
      result.displacementXMetres=motion.x;result.displacementYMetres=motion.y;result.displacementZMetres=motion.z;
      result.displacementMetres=std::sqrt(motion.x*motion.x+motion.y*motion.y+motion.z*motion.z);
      result.headingFrameBearing=std::fmod(std::atan2(motion.x,motion.y)*180/kPi+360,360);
      result.bearingFromTop=std::fmod(result.headingFrameBearing-buffer_[SLIDE_REST].heading+720,360);
      result.rotationCompensated=true;
    }
    double g0[3] = {}, g1[3] = {}, bias[3] = {};
    for (int i = 0; i < SLIDE_REST; ++i)
      for (int k = 0; k < 3; ++k) {
        g0[k] += buffer_[i].accel[k] / SLIDE_REST;
        g1[k] += buffer_[n - 1 - i].accel[k] / SLIDE_REST;
        bias[k] += buffer_[i].gyro[k] / SLIDE_REST;
      }
    const double gravity = std::sqrt(dot(g0, g0));
    if (!(gravity > 0.2)) { result.reject = SlideReject::Lifted; return result; }
    double up[3];  // the accelerometer reads "up" at rest
    for (int k = 0; k < 3; ++k) up[k] = g0[k] / gravity;
    const double dt = 1 / SLIDE_RATE_HZ;

    // Lifting tips the band; pushing it across a table barely does.
    double tilt[3] = {}, shake = 0, maxTilt = 0;
    float *tiltPath = tiltPath_;
    tiltPath[0] = 0;
    for (int i = 0; i < n; ++i) {
      double w[3], accel[3];
      for (int k = 0; k < 3; ++k) { w[k] = buffer_[i].gyro[k] - bias[k]; accel[k] = buffer_[i].accel[k]; }
      const double along = dot(w, up);
      double rate = 0;
      for (int k = 0; k < 3; ++k) {
        const double horizontal = w[k] - along * up[k];
        tilt[k] += horizontal * dt;
        rate += horizontal * horizontal;
      }
      if (i) tiltPath[i] = float(tiltPath[i - 1] + std::sqrt(rate) * dt);
      maxTilt = std::fmax(maxTilt, std::sqrt(dot(tilt, tilt)));
      // Up-and-down only: a hard sideways push is not a lift.
      shake = std::fmax(shake, std::abs(dot(accel, up) - gravity));
    }
    const double turn = slideWrap(buffer_[n - 1].heading - buffer_[SLIDE_REST].heading);
    if (shake > SLIDE_MAX_SHAKE_G) { result.reject = SlideReject::Lifted; return result; }
    if (maxTilt > SLIDE_MAX_TILT_DEGREES) { result.reject = SlideReject::Tipped; return result; }
    if (std::abs(turn) > SLIDE_MAX_TURN_DEGREES) { result.reject = SlideReject::Turned; return result; }

    // Screen top and right, laid flat on the table.
    double top[3] = {-1, 0, 0}, right[3] = {0, -1, 0};
    const double topUp = dot(top, up);
    for (int k = 0; k < 3; ++k) top[k] -= topUp * up[k];
    const double topLength = std::sqrt(dot(top, top));
    for (int k = 0; k < 3; ++k) top[k] /= topLength;
    const double rightUp = dot(right, up), rightTop = dot(right, top);
    for (int k = 0; k < 3; ++k) right[k] -= rightUp * up[k] + rightTop * top[k];
    const double rightLength = std::sqrt(dot(right, right));
    for (int k = 0; k < 3; ++k) right[k] /= rightLength;

    // Horizontal acceleration (m/s^2) in the band's frame at the start. Any
    // change of resting tilt is spread over the moments the band tipped.
    float *x = x_, *y = y_;
    const double startHeading = buffer_[SLIDE_REST].heading;
    for (int i = 0; i < n; ++i) {
      const double share = tiltPath[n - 1] > 1e-9 ? tiltPath[i] / tiltPath[n - 1] : double(i) / (n - 1);
      double linear[3];
      for (int k = 0; k < 3; ++k) linear[k] = (buffer_[i].accel[k] - (g0[k] + share * (g1[k] - g0[k]))) * 9.80665;
      const double alongTop = dot(linear, top), alongRight = dot(linear, right);
      const double turned = slideWrap(buffer_[i].heading - startHeading) * kPi / 180;
      x[i] = float(alongRight * std::cos(turned) + alongTop * std::sin(turned));
      y[i] = float(-alongRight * std::sin(turned) + alongTop * std::cos(turned));
    }
    float *hx = hx_, *hy = hy_;
    double mx = 0, my = 0;
    for (int i = 0; i < n; ++i) {
      hx[i] = float(x[i] - medianAround(x, n, i));
      hy[i] = float(y[i] - medianAround(y, n, i));
      mx += hx[i] / n;
      my += hy[i] / n;
    }
    // The line of the push: main axis of the horizontal acceleration.
    double sxx = 0, syy = 0, sxy = 0;
    for (int i = 0; i < n; ++i) {
      sxx += (hx[i] - mx) * (hx[i] - mx);
      syy += (hy[i] - my) * (hy[i] - my);
      sxy += (hx[i] - mx) * (hy[i] - my);
    }
    const double angle = 0.5 * std::atan2(2 * sxy, sxx - syy);
    const double ax = std::cos(angle), ay = std::sin(angle);
    const double spread = std::sqrt((sxx - syy) * (sxx - syy) + 4 * sxy * sxy);
    const double straightness = sxx + syy > 0 ? spread / (sxx + syy) : 0;
    result.straightness = straightness;
    // Net movement from rest to rest: -sum((t - mean t) * a dt) per axis,
    // positive along a direction when speeding up came first.
    double moveX = 0, moveY = 0, peak = 0, rawX = 0, rawY = 0;
    for (int i = 0; i < n; ++i) {
      const double lag = (i - (n - 1) / 2.0) * dt * dt;
      moveX -= lag * (hx[i] - mx);
      moveY -= lag * (hy[i] - my);
      rawX -= lag * x[i];
      rawY -= lag * y[i];
      peak = std::fmax(peak, std::abs(hx[i] * ax + hy[i] * ay));
    }
    // A clean push: its line, pointing the way it moved. Otherwise the net movement.
    const bool clean = straightness >= SLIDE_MIN_STRAIGHTNESS;
    const double sign = moveX * ax + moveY * ay > 0 ? 1 : -1;
    const double dx = clean ? sign * ax : moveX, dy = clean ? sign * ay : moveY;
    result.bearingFromTop = std::fmod(std::atan2(dx, dy) * 180 / kPi + 360, 360);
    result.headingFrameBearing = std::fmod(std::fmod(startHeading + result.bearingFromTop, 360.0) + 360.0, 360.0);
    // Preserve both signed displacement components for position tracking.
    // The high-pass direction vote can reverse a smooth forward slide: a
    // recorded forward/back pair yielded TWO backward votes on 14 October.
    // Projecting onto that vote and taking abs() discarded the true Y sign.
    // Raw acceleration here already removes gravity and compensates turns.
    const double initialAngle = startHeading * kPi / 180;
    result.displacementXMetres = rawX * std::cos(initialAngle) + rawY * std::sin(initialAngle);
    result.displacementYMetres = -rawX * std::sin(initialAngle) + rawY * std::cos(initialAngle);
    result.displacementMetres = std::hypot(rawX, rawY);
    result.displacementZMetres = 0;result.rotationCompensated=false;
    result.weight = std::hypot(moveX, moveY);
    if (peak < SLIDE_MIN_PEAK) result.reject = SlideReject::TooGentle;
    else if (result.weight < SLIDE_MIN_WEIGHT) result.reject = SlideReject::TooSmall;
    else result.reject = SlideReject::None;
    result.accepted = result.reject == SlideReject::None;
    if(buffer_[0].framed && g0[2]/gravity>-std::cos(15*kPi/180)){
      result.displacementMetres=motion.valid?std::sqrt(motion.x*motion.x+motion.y*motion.y+motion.z*motion.z):NAN;
      result.displacementXMetres=motion.valid?motion.x:NAN;result.displacementYMetres=motion.valid?motion.y:NAN;
      result.displacementZMetres=motion.valid?motion.z:NAN;result.rotationCompensated=motion.valid;
    }
    return result;
  }

 public:
  void reset() {
    ringCount_ = ringNext_ = count_ = steadyCount_ = 0;
    moving_ = pending_ = halfPair_ = haveHeading_ = false;
    last_ = SlideResult{false, SlideReject::None, NAN, NAN, 0, 0, 0};
  }

  // Feed every IMU reading with the gyroscope heading (degrees, clockwise).
  // Returns true when a move has just ended; read it with last().
  bool update(const ImuReading &reading, double headingDegrees,const MotionMatrix *frame=nullptr) {
    if (!std::isfinite(headingDegrees)) return false;
    // Keep the heading continuous across the +/-180 degree wrap.
    heading_ = haveHeading_ ? heading_ + slideWrap(headingDegrees - heading_) : headingDegrees;
    haveHeading_ = true;
    if (!halfPair_) {
      for (int k = 0; k < 3; ++k) { pair_[k] = reading.accel[k]; pair_[3 + k] = reading.gyro[k]; }
      halfPair_ = true;
      pairFramed_=frame!=nullptr;if(frame)pairFrame_=*frame;
      return false;
    }
    Sample sample{};
    for (int k = 0; k < 3; ++k) {
      sample.accel[k] = float((pair_[k] + reading.accel[k]) / 2);
      sample.gyro[k] = float((pair_[3 + k] + reading.gyro[k]) / 2);
    }
    sample.heading = float(heading_);
    sample.framed=frame&&pairFramed_;
    if(sample.framed)for(int a=0;a<3;++a)for(int b=0;b<3;++b)sample.frame[a][b]=float((frame->row[a][b]+pairFrame_.row[a][b])*.5);
    halfPair_ = false;
    pending_ = false;
    process(sample);
    return pending_;
  }

  bool moving() const { return moving_; }
  const SlideResult &last() const { return last_; }
};

inline const char *slideRejectName(SlideReject reject) {
  switch (reject) {
    case SlideReject::None: return "measured";
    case SlideReject::TooLong: return "too-long";
    case SlideReject::Lifted: return "lifted";
    case SlideReject::Tipped: return "tipped";
    case SlideReject::Turned: return "turned";
    case SlideReject::TooGentle: return "too-gentle";
    default: return "too-small";
  }
}
