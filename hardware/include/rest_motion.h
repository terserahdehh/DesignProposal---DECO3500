#pragma once
#include <cmath>

// Experimental rest-to-rest inertial displacement. A known reset supplies
// heading; gravity supplies tilt. Gyroscope rotation carries acceleration
// into that common frame before subtracting gravity. This is dead reckoning,
// not an independent position measurement.
struct MotionMatrix { double row[3][3] = {}; };
struct MotionVector { double x=0,y=0,z=0;bool valid=false; };

inline bool motionFrame(const double *gravity, double heading, MotionMatrix &frame) {
  double length=0;for(int k=0;k<3;++k)length+=gravity[k]*gravity[k];
  length=std::sqrt(length);
  if(!(length>.2)||!std::isfinite(heading))return false;
  double up[3],top[3]={-1,0,0};
  for(int k=0;k<3;++k)up[k]=gravity[k]/length;
  const double projection=-up[0];
  double topLength=0;
  for(int k=0;k<3;++k){top[k]-=projection*up[k];topLength+=top[k]*top[k];}
  topLength=std::sqrt(topLength);
  // A vertical screen top has no horizontal azimuth in this model.
  if(!(topLength>.1))return false;
  for(double &value:top)value/=topLength;
  const double right[3]={top[1]*up[2]-top[2]*up[1],top[2]*up[0]-top[0]*up[2],top[0]*up[1]-top[1]*up[0]};
  const double angle=heading*3.14159265358979323846/180;
  for(int k=0;k<3;++k){
    frame.row[0][k]=right[k]*std::cos(angle)+top[k]*std::sin(angle);
    frame.row[1][k]=-right[k]*std::sin(angle)+top[k]*std::cos(angle);
    frame.row[2][k]=up[k];
  }
  return true;
}

inline void rotateMotionFrame(MotionMatrix &frame,const double *rate,double dt) {
  const double speed=std::sqrt(rate[0]*rate[0]+rate[1]*rate[1]+rate[2]*rate[2]);
  if(!(speed>1e-12))return;
  double axis[3];for(int k=0;k<3;++k)axis[k]=rate[k]/speed;
  const double angle=speed*dt*3.14159265358979323846/180;
  const double c=std::cos(angle),s=std::sin(angle);
  for(auto &row:frame.row){
    const double projection=row[0]*axis[0]+row[1]*axis[1]+row[2]*axis[2];
    const double cross[3]={row[1]*axis[2]-row[2]*axis[1],row[2]*axis[0]-row[0]*axis[2],row[0]*axis[1]-row[1]*axis[0]};
    for(int k=0;k<3;++k)row[k]=row[k]*c+cross[k]*s+axis[k]*projection*(1-c);
  }
}

inline void correctMotionUp(MotionMatrix &frame,const double *gravity,double gain) {
  double norm=0;for(int k=0;k<3;++k)norm+=gravity[k]*gravity[k];norm=std::sqrt(norm);
  if(!(norm>.2))return;
  double predicted[3]={};
  for(int a=0;a<3;++a)for(int b=0;b<3;++b)predicted[a]+=frame.row[a][b]*gravity[b]/norm;
  const double horizontal=std::hypot(predicted[0],predicted[1]);
  if(!(horizontal>1e-10))return;
  const double axis[3]={predicted[1]/horizontal,-predicted[0]/horizontal,0};
  const double angle=std::atan2(horizontal,predicted[2])*gain,c=std::cos(angle),s=std::sin(angle);
  for(int col=0;col<3;++col){
    double v[3];for(int k=0;k<3;++k)v[k]=frame.row[k][col];
    const double projection=v[0]*axis[0]+v[1]*axis[1];
    const double cross[3]={axis[1]*v[2],-axis[0]*v[2],axis[0]*v[1]-axis[1]*v[0]};
    for(int k=0;k<3;++k)frame.row[k][col]=v[k]*c+cross[k]*s+axis[k]*projection*(1-c);
  }
}

template<typename Sample>
MotionVector restMotion(const Sample *samples,int count,double rate,int rest,float (*world)[3],const MotionMatrix *initial=nullptr) {
  MotionVector result;
  if(count<2*rest||!(rate>0))return result;
  double gravity[3]={},bias[3]={};
  for(int i=0;i<rest;++i)for(int k=0;k<3;++k){gravity[k]+=samples[i].accel[k]/rest;bias[k]+=samples[i].gyro[k]/rest;}
  MotionMatrix frame;
  if(initial)frame=*initial;
  else if(!motionFrame(gravity,samples[rest].heading,frame))return result;
  const double dt=1/rate;
  for(int i=0;i<count;++i){
    if(i){
      double gyro[3];for(int k=0;k<3;++k)gyro[k]=(samples[i-1].gyro[k]+samples[i].gyro[k])*.5-bias[k];
      rotateMotionFrame(frame,gyro,dt);
    }
    for(int axis=0;axis<3;++axis){
      double value=0;for(int k=0;k<3;++k)value+=frame.row[axis][k]*samples[i].accel[k];
      world[i][axis]=float(value*9.80665);
    }
  }
  double beginning[3]={},ending[3]={},move[3]={};
  for(int i=0;i<rest;++i)for(int k=0;k<3;++k){beginning[k]+=world[i][k]/rest;ending[k]+=world[count-1-i][k]/rest;}
  for(int i=0;i<count;++i){
    const double share=double(i)/(count-1);
    const double lag=(i-(count-1)/2.0)*dt*dt;
    for(int k=0;k<3;++k)move[k]-=lag*(world[i][k]-(beginning[k]+share*(ending[k]-beginning[k])));
  }
  result.x=move[0];result.y=move[1];result.z=move[2];
  result.valid=std::isfinite(result.x)&&std::isfinite(result.y)&&std::isfinite(result.z)&&
               std::sqrt(result.x*result.x+result.y*result.y+result.z*result.z)<=1.5;
  return result;
}
