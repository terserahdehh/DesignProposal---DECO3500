#include <Arduino.h>
#include <ArduinoJson.h>
#include <TFT_eSPI.h>
#include <Wire.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <vector>
#include <cfloat>
#include "pairing_keys.h"
#include "location_math.h"
#include "touch_press.h"
#include "direction_visuals.h"
#include "direction_layout.h"
#include "find_guidance.h"
#include "pdr.h"

// Pin profile verified against Waveshare's ESP32-S3-Touch-LCD-1.28 demo.
static const char *OWNERS[] = {"nayaka", "syifa"};
static const char *NAMES[] = {"Nayaka", "Syifa"};
static const uint8_t MACS[2][6] = {{0x8c,0xfd,0x49,0x9b,0xe7,0x40},{0x8c,0xfd,0x49,0x9b,0xee,0x84}};
constexpr uint8_t SELF = PULSE_OWNER, OTHER = 1-PULSE_OWNER;
constexpr uint16_t PAPER = 0xef7c, INK = 0x0863, PURPLE = 0xa2be, YELLOW = 0xfea2;
constexpr uint32_t MAGIC = 0x50424e44, LOCATION_TTL = 60000;
enum Kind : uint8_t { MESSAGE=1, ACK, HEARTBEAT, LOCATION, LOCATION_REQUEST, CLEAR_LOCATION };
struct __attribute__((packed)) Packet {
  uint32_t magic; uint8_t version, kind, owner; uint32_t sequence;
  char text[41]; double lat, lon; float accuracy; uint64_t timestamp;
  uint8_t valid, simulated;
};
static_assert(sizeof(Packet) <= 250, "ESP-NOW payload exceeds limit");
struct Position { double lat=0,lon=0; float accuracy=0; uint64_t timestamp=0; uint32_t received=0; bool valid=false, simulated=false; };
struct Preset { String id, text; };
Preset presets[8]; int presetCount=0, menuIndex=0, sosCount=0;
Position localPosition, peerPosition;
TFT_eSPI lcd; TFT_eSprite frame(&lcd); Preferences settings;
QueueHandle_t radioQueue;
struct ConfigLine { char text[2049]; };
QueueHandle_t configQueue;
BLECharacteristic *configChannel=nullptr,*signalChannel=nullptr;
BLEServer *bleServer=nullptr;
BLE2902 *configSubscription=nullptr;
volatile uint16_t bleConnectionId=0;
volatile esp_gatt_if_t bleInterface=ESP_GATT_IF_NONE;
volatile bool bleConnected=false,restartAdvertising=false;
volatile uint8_t lastBleDisconnectReason=0;
volatile uint32_t configWrites=0;
String bleInput,bleOutput;
volatile bool touchPending=false;
TouchPress touchPress;
bool touchAvailable=false, radioReady=false, dirty=true, unread=false;
uint32_t lastPeer=0, heartbeatAt=0, nextSequence=1, lastIncoming=0;
String incoming, result, view="home", previousView="home", pendingText;
uint32_t pendingSequence=0, pendingAt=0; int sendAttempts=0;
String serialLine;
uint32_t touchPresses=0,lastTouchAt=0;
uint32_t touchReports=0;uint8_t lastTouchGesture=0,lastTouchEvent=0,lastTouchFingers=0;
// Wi-Fi FTM ranging: each band answers as a hidden SoftAP and times the other.
struct FtmReport { uint8_t status,frames; int8_t rssi; uint32_t at; FtmFrame frame[32]; };
QueueHandle_t ftmQueue;
volatile bool ftmBusy=false;
uint32_t ftmStartedAt=0,ftmNextAt=0,ftmAttempts=0,ftmFailures=0;
uint8_t peerResponder[6];bool rangingReady=false;int8_t lastRangeRssi=0;
RangeTracker rangeTracker;
BeepScheduler beeper;bool beepSounding=false,pulseOn=false;
double demoBearing=NAN;  // labelled demo only; cleared when Find closes
String i2cDevices;int imuWhoAmI=-1;
#ifdef PULSE_BUZZER_PIN
constexpr int BUZZER_CHANNEL=4;
#endif
// QMI8658 accelerometer/gyroscope on the shared I2C bus: +/-4 g, +/-512 dps, 112 Hz.
constexpr uint8_t IMU_ADDRESS=0x6b;
struct ImuSample { uint32_t micros; int16_t accel[3], gyro[3]; };
QueueHandle_t imuQueue;bool imuReady=false,imuStreaming=false;uint32_t imuSamples=0;
// Walk-to-find: the seeker's path (steps + turns) and ranges taken along it.
WalkTracker walker;WalkRange walkRanges[WALK_MAX_SAMPLES];int walkCount=0;
WalkFix walkFix{false,"walk",NAN,NAN,NAN,NAN,NAN,NAN,180};
// Warmer/colder: aim the band's top, move forward, stop; distance change votes.
ProbeCompass prober;
const char *probeResultName(ProbeResult result){
  switch(result){
    case ProbeResult::Counted:return "counted";case ProbeResult::NoChange:return "no-change";
    case ProbeResult::Turned:return "turned";case ProbeResult::NotEnoughReadings:return "not-enough-readings";
    case ProbeResult::Interrupted:return "interrupted";default:return "none";
  }
}
bool imuWrite(uint8_t reg,uint8_t value){Wire.beginTransmission(IMU_ADDRESS);Wire.write(reg);Wire.write(value);return Wire.endTransmission()==0;}
bool imuRead(uint8_t reg,uint8_t *out,uint8_t count){
  Wire.beginTransmission(IMU_ADDRESS);Wire.write(reg);if(Wire.endTransmission(false)!=0)return false;
  if(Wire.requestFrom(IMU_ADDRESS,count)!=count)return false;for(uint8_t i=0;i<count;i++)out[i]=Wire.read();return true;
}
bool imuInit(){
  if(!imuWrite(0x60,0xb0))return false;delay(20);  // soft reset
  // CTRL1 auto-increment/little endian; CTRL2 4 g; CTRL3 512 dps (both 112 Hz);
  // CTRL5 low-pass at 13% of ODR; CTRL7 enables accelerometer and gyroscope.
  return imuWrite(0x02,0x40)&&imuWrite(0x03,0x16)&&imuWrite(0x04,0x56)&&imuWrite(0x06,0x77)&&imuWrite(0x08,0x03);
}
void imuTask(void*){
  TickType_t wake=xTaskGetTickCount();
  for(;;){
    uint8_t ready=0,raw[12];
    if(imuRead(0x2e,&ready,1)&&(ready&0x03)==0x03&&imuRead(0x35,raw,12)){
      ImuSample sample{micros(),{},{}};
      for(int axis=0;axis<3;axis++){sample.accel[axis]=int16_t(raw[2*axis]|raw[2*axis+1]<<8);sample.gyro[axis]=int16_t(raw[6+2*axis]|raw[7+2*axis]<<8);}
      xQueueSend(imuQueue,&sample,0);
    }
    vTaskDelayUntil(&wake,pdMS_TO_TICKS(4));
  }
}
void processImu(){
  ImuSample sample;
  while(imuQueue&&xQueueReceive(imuQueue,&sample,0)==pdTRUE){
    ImuReading reading{sample.micros,{},{}};
    for(int axis=0;axis<3;axis++){reading.accel[axis]=sample.accel[axis]/8192.0;reading.gyro[axis]=sample.gyro[axis]/64.0;}
    walker.update(reading);imuSamples++;
    prober.motion(walker.stillSeconds()<0.25,walker.headingDegrees(),millis());
    // Serial-only raw stream for tuning step detection; off unless requested.
    if(imuStreaming)Serial.printf("M,%lu,%d,%d,%d,%d,%d,%d,%d\n",(unsigned long)sample.micros,sample.accel[0],sample.accel[1],sample.accel[2],sample.gyro[0],sample.gyro[1],sample.gyro[2],walker.steps());
  }
}
void startWalk(){walker.reset();prober.reset();walkCount=0;walkFix=WalkFix{false,"walk",NAN,NAN,NAN,NAN,NAN,NAN,180};}
void addWalkRange(double metres){
  if(!imuReady||!std::isfinite(metres))return;
  const double x=walker.x(),y=walker.y();
  // One averaged sample per spot, so standing still cannot push out the walk.
  if(walkCount&&std::hypot(walkRanges[walkCount-1].x-x,walkRanges[walkCount-1].y-y)<0.3){
    WalkRange &spot=walkRanges[walkCount-1];spot.metres=(spot.metres+metres)/2;
  }else{
    if(walkCount==WALK_MAX_SAMPLES){memmove(walkRanges,walkRanges+1,sizeof(WalkRange)*(WALK_MAX_SAMPLES-1));walkCount--;}
    walkRanges[walkCount++]={x,y,metres};
  }
  walkFix=locateFromWalk(walkRanges,walkCount);
}
const char *walkHint(){
  if(!imuReady)return "No motion sensor";
  String reason=walkFix.reason;
  if(reason=="turn")return "Now TURN and walk on";
  if(reason=="inconsistent")return "Moved? Keep walking";
  if(reason=="near")return "Very close: look around";
  if(reason=="uncertain")return "Keep walking to aim";
  return "WALK + TURN to aim";
}
const char *probePhaseName(ProbePhase phase){
  switch(phase){case ProbePhase::Ready:return "ready";case ProbePhase::Moving:return "moving";case ProbePhase::Measuring:return "measuring";default:return "waiting";}
}
// Short status only: the arrow comes from ordinary moves, no aiming step.
const char *probeHint(){
  if(!imuReady)return "No motion sensor";
  if(prober.phase()==ProbePhase::Moving||prober.phase()==ProbePhase::Measuring)return "Measuring...";
  switch(prober.lastProbe()){
    case ProbeResult::Counted:return prober.lastChange()<0?"CLOSER this way":"FARTHER that way";
    case ProbeResult::NoChange:return "No change: move more";
    default:return "Move around to find";
  }
}

bool fresh(const Position &p) { return p.valid && uint32_t(millis()-p.received)<LOCATION_TTL; }
bool peerConnected() { return lastPeer && uint32_t(millis()-lastPeer)<7000; }
FindGuidance currentGuidance(DirectionQuality *quality=nullptr) {
  bool localFresh=fresh(localPosition),peerFresh=fresh(peerPosition);
  Guidance g{NAN,NAN};DirectionQuality q{false,NAN,180};
  if(localFresh&&peerFresh){g=guidance(localPosition.lat,localPosition.lon,peerPosition.lat,peerPosition.lon);q=directionQuality(g.metres,localPosition.accuracy,peerPosition.accuracy);}
  if(quality)*quality=q;
  FindInputs inputs{view=="find",peerConnected(),localFresh,peerFresh,g.metres,g.bearing,q,rangeTracker.reading(millis()),demoBearing};
  if(walkFix.valid){
    inputs.walkBearing=walkArrowBearing(walkFix,walker.x(),walker.y(),walker.headingDegrees());
    inputs.walkUncertaintyDegrees=walkFix.uncertaintyFrom(walker.x(),walker.y());
  }
  ProbeEstimate probe=prober.estimate(millis(),walker.headingDegrees());
  if(probe.valid){inputs.probeBearing=probe.bearingFromTop;inputs.probeUncertaintyDegrees=probe.uncertaintyDegrees;}
  return findGuidance(inputs);
}
void output(JsonDocument &doc) {
  doc["owner"]=OWNERS[SELF]; serializeJson(doc,Serial); Serial.println();
  if(bleConnected){String line;serializeJson(doc,line);if(bleOutput.length()+line.length()<20000)bleOutput+=line+"\n";}
}
void event(const char *type, const String &text="") {
  StaticJsonDocument<384> doc; doc["type"]=type; doc["text"]=text; doc["view"]=view;
  doc["incoming"]=incoming; doc["unread"]=unread; doc["sequence"]=pendingSequence;
  output(doc);
}
void positionJson(JsonObject out, const Position &p) {
  out["valid"]=fresh(p); out["lat"]=p.lat; out["lon"]=p.lon; out["accuracy"]=p.accuracy;
  out["timestamp"]=p.timestamp; out["simulated"]=p.simulated;
}
void hardwareJson(JsonDocument &doc) {
  auto sensors=doc.createNestedObject("sensors");
  sensors["touch"]=touchAvailable?"CST816S":nullptr;
  auto imu=sensors.createNestedObject("imu");imu["present"]=imuWhoAmI==0x05;imu["model"]="QMI8658";imu["whoAmI"]=imuWhoAmI;
  imu["provides"]="accelerometer, gyroscope";
  sensors["i2c"]=i2cDevices;sensors["magnetometer"]=false;sensors["gps"]=false;
  sensors["ranging"]=rangingReady?"wifi-ftm":nullptr;sensors["rangingResponder"]=WiFi.softAPmacAddress();
  auto heading=doc.createNestedObject("heading");heading["available"]=false;
  heading["reason"]="No magnetometer or direction-finding radio: GPS arrows are north-up; walk estimates are relative to turns since Find opened";
  auto audio=doc.createNestedObject("audio");
#ifdef PULSE_BUZZER_PIN
  audio["output"]="gpio-buzzer";audio["pin"]=PULSE_BUZZER_PIN;
#else
  audio["output"]="none";audio["reason"]="No buzzer or speaker is fitted; build with PULSE_BUZZER_PIN to drive one";
#endif
}
void measurementJson(JsonDocument &doc,const FindGuidance &g) {
  RangeReading r=rangeTracker.reading(millis());
  auto range=doc.createNestedObject("range");
  range["method"]="wifi-ftm";range["valid"]=r.valid;range["state"]=rangingReady?r.state:"unavailable";
  if(r.valid){range["metres"]=r.metres;range["uncertaintyMetres"]=r.uncertaintyMetres;}
  range["ageMillis"]=r.ageMillis;range["sessions"]=r.sessions;range["rssi"]=lastRangeRssi;
  range["attempts"]=ftmAttempts;range["failures"]=ftmFailures;range["calibratedUpToMetres"]=RANGE_CALIBRATED_UP_TO_METRES;
  auto proximity=doc.createNestedObject("proximity");
  proximity["active"]=g.proximity.active;proximity["source"]=distanceSourceName(g.source);
  if(g.proximity.active){proximity["metres"]=g.metres;proximity["uncertaintyMetres"]=g.uncertaintyMetres;proximity["brightness"]=g.proximity.brightness;}
  proximity["beepIntervalMillis"]=g.beepIntervalMs;
#ifdef PULSE_BUZZER_PIN
  proximity["audible"]=g.beepIntervalMs>0;
#else
  proximity["audible"]=false;
#endif
  auto find=doc.createNestedObject("find");
  find["mode"]=findModeName(g.mode);find["ring"]=ringShapeName(g.ring);find["directionUsable"]=g.directionUsable;
  if(g.directionUsable)find["bearing"]=g.bearing;
  find["demoDirection"]=g.demoDirection;if(g.demoDirection)find["demoBearing"]=g.demoBearing;
  find["walkEstimate"]=g.walkEstimate;
  if(g.walkEstimate){find["walkBearing"]=g.visuals.light.bearing;find["walkUncertaintyDegrees"]=g.walkUncertaintyDegrees;}
  auto walk=find.createNestedObject("walk");
  walk["state"]=imuReady?walkFix.reason:"no-imu";walk["samples"]=walkCount;walk["steps"]=walker.steps();
  walk["headingDegrees"]=walker.headingDegrees();walk["x"]=walker.x();walk["y"]=walker.y();
  find["probeEstimate"]=g.probeEstimate;
  if(g.probeEstimate){find["probeBearing"]=g.visuals.light.bearing;find["probeUncertaintyDegrees"]=g.probeUncertaintyDegrees;}
  auto probe=find.createNestedObject("probe");
  probe["last"]=imuReady?probeResultName(prober.lastProbe()):"no-imu";
  probe["probes"]=prober.estimate(millis(),walker.headingDegrees()).probes;
  probe["phase"]=probePhaseName(prober.phase());
  if(std::isfinite(prober.lastChange()))probe["lastChangeMetres"]=prober.lastChange();
}
void status(JsonDocument &doc,bool full=true) {
  if(full)hardwareJson(doc);
  doc["mac"]=WiFi.macAddress(); doc["peer"]=OWNERS[OTHER]; doc["peerConnected"]=peerConnected();
  doc["uptimeMillis"]=millis();
  doc["model"]="ESP32-S3-Touch-LCD-1.28"; doc["touchAvailable"]=touchAvailable;
  doc["touchPresses"]=touchPresses;doc["lastTouchAt"]=lastTouchAt;
  doc["touchReports"]=touchReports;doc["lastTouchGesture"]=lastTouchGesture;
  doc["lastTouchEvent"]=lastTouchEvent;doc["lastTouchFingers"]=lastTouchFingers;
  doc["radioReady"]=radioReady; doc["view"]=view; doc["incoming"]=incoming;
  doc["bluetoothConnected"]=bleConnected;doc["bluetoothDisconnectReason"]=lastBleDisconnectReason;doc["bluetoothConfigWrites"]=configWrites;
  doc["unread"]=unread; doc["notificationLed"] = unread ? (OTHER==0 ? "purple" : "yellow") : "off";
  doc["result"]=result; doc["presetCount"]=presetCount; doc["menuIndex"]=menuIndex;
  auto items=doc.createNestedArray("messages");
  for(int i=0;i<presetCount;i++){auto p=items.createNestedObject();p["id"]=presets[i].id;p["text"]=presets[i].text;}
  positionJson(doc.createNestedObject("location"),localPosition);
  positionJson(doc.createNestedObject("peerLocation"),peerPosition);
  FindGuidance g=currentGuidance();
  measurementJson(doc,g);
  doc["directionArrowVisible"]=g.visuals.arrow.visible;
  if(fresh(localPosition)&&fresh(peerPosition)){
    Guidance fixes=guidance(localPosition.lat,localPosition.lon,peerPosition.lat,peerPosition.lon);
    DirectionQuality q=directionQuality(fixes.metres,localPosition.accuracy,peerPosition.accuracy);
    auto p=doc.createNestedObject("guidance");p["metres"]=fixes.metres;p["available"]=true;p["usable"]=q.usable;
    if(q.usable)p["bearing"]=fixes.bearing;
    p["bearingUncertaintyDegrees"]=q.bearingUncertaintyDegrees;
    p["northReferenced"]=true;p["simulated"]=localPosition.simulated||peerPosition.simulated;
    if(std::isfinite(q.combinedAccuracyMetres))p["accuracy"]=q.combinedAccuracyMetres;
  }
  auto light=doc.createNestedObject("directionLight");
  light["visible"]=g.ring!=RingShape::None;light["shape"]=ringShapeName(g.ring);light["colour"]=OTHER==0?"purple":"yellow";
  light["brightness"]=g.ring==RingShape::Full?g.proximity.brightness:g.visuals.light.brightness;
  if(g.ring==RingShape::Quarter){light["bearing"]=g.visuals.light.bearing;light["spanDegrees"]=g.visuals.light.spanDegrees;}
  light["northReferenced"]=g.ring==RingShape::Quarter&&g.directionUsable;light["demo"]=g.demoDirection;
}
Packet packet(Kind kind,uint32_t sequence=0) { Packet p{};p.magic=MAGIC;p.version=1;p.kind=kind;p.owner=SELF;p.sequence=sequence;return p; }
bool transmit(const Packet &p) { return radioReady && esp_now_send(MACS[OTHER],reinterpret_cast<const uint8_t*>(&p),sizeof(p))==ESP_OK; }
void sharePosition() {
  Packet p=packet(LOCATION);p.valid=fresh(localPosition);p.lat=localPosition.lat;p.lon=localPosition.lon;
  p.accuracy=localPosition.accuracy;p.timestamp=localPosition.timestamp;p.simulated=localPosition.simulated;transmit(p);
}
bool sendMessage(const String &text) {
  if(pendingSequence || !radioReady || !peerConnected()) return false;
  pendingSequence=nextSequence++;if(!nextSequence)nextSequence=1;
  pendingText=text;pendingAt=millis();sendAttempts=1;
  Packet p=packet(MESSAGE,pendingSequence);text.toCharArray(p.text,sizeof(p.text));
  transmit(p);result="Sending...";view="result";dirty=true;return true;
}
void onRadio(const uint8_t *mac,const uint8_t *data,int len) {
  if(len!=sizeof(Packet)||memcmp(mac,MACS[OTHER],6)!=0)return;
  Packet p;memcpy(&p,data,sizeof(p));
  if(p.magic!=MAGIC||p.version!=1||p.owner!=OTHER||p.kind<MESSAGE||p.kind>CLEAR_LOCATION)return;
  xQueueSend(radioQueue,&p,0);
}
void processRadio() {
  Packet p;
  while(xQueueReceive(radioQueue,&p,0)==pdTRUE){
    lastPeer=millis();
    if(p.kind==MESSAGE){
      if(!p.sequence || !memchr(p.text,0,sizeof(p.text)))continue;
      bool valid=true;for(const char *c=p.text;*c;c++)if(*c<32||*c>126)valid=false;
      if(!valid)continue;
      if(p.sequence!=lastIncoming){
        lastIncoming=p.sequence;if(!unread)previousView=view;
        incoming=p.text;unread=true;view="incoming";dirty=true;
        const char* signals[]={"I'm Safe","Toilet","Taking a Break","Going Home","Meet Me","SOS - I need help"};
        if(bleConnected&&signalChannel)for(int i=0;i<6;i++)if(incoming==signals[i]){uint8_t code=i+1;signalChannel->setValue(&code,1);signalChannel->notify();break;}
        StaticJsonDocument<384> doc;doc["type"]="message";doc["from"]=OWNERS[OTHER];doc["text"]=incoming;doc["sequence"]=p.sequence;output(doc);
      }
      transmit(packet(ACK,p.sequence));
    }else if(p.kind==ACK && p.sequence==pendingSequence && pendingSequence){
      pendingSequence=0;result="Received by band";dirty=true;event("sent",pendingText);
    }else if(p.kind==LOCATION){
      if(!std::isfinite(p.lat)||!std::isfinite(p.lon)||p.lat < -90||p.lat>90||p.lon < -180||p.lon>180||!std::isfinite(p.accuracy)||p.accuracy<0)continue;
      bool sameFix=peerPosition.valid&&p.valid&&peerPosition.timestamp==p.timestamp&&peerPosition.lat==p.lat&&peerPosition.lon==p.lon;
      uint32_t received=sameFix?peerPosition.received:millis();
      peerPosition={p.lat,p.lon,p.accuracy,p.timestamp,received,bool(p.valid),bool(p.simulated)};dirty=true;
    }else if(p.kind==LOCATION_REQUEST)sharePosition();
    else if(p.kind==CLEAR_LOCATION){peerPosition.valid=false;dirty=true;}
  }
}
void onFtmReport(arduino_event_t *event){
  // Runs on the Wi-Fi event task; copy the frames and free the report here.
  static FtmReport report;
  wifi_event_ftm_report_t *source=&event->event_info.wifi_ftm_report;
  report.status=source->status;report.at=millis();report.frames=0;report.rssi=0;
  if(source->ftm_report_data){
    int count=source->ftm_report_num_entries>32?32:source->ftm_report_num_entries;int rssiSum=0;
    for(int i=0;i<count;i++){auto &d=source->ftm_report_data[i];report.frame[i]={d.t1,d.t2,d.t3,d.t4};rssiSum+=d.rssi;}
    report.frames=count;if(count)report.rssi=rssiSum/count;
    free(source->ftm_report_data);source->ftm_report_data=nullptr;
  }
  xQueueSend(ftmQueue,&report,0);ftmBusy=false;
}
void rangeEvent(const FtmReport &report,const RangeSession &session){
  // Serial-only telemetry for live accuracy/latency checks; not sent over BLE.
  RangeReading reading=rangeTracker.reading(report.at);FindGuidance g=currentGuidance();
  StaticJsonDocument<1024> doc;doc["type"]="range";doc["owner"]=OWNERS[SELF];doc["t"]=report.at;
  doc["status"]=report.status;doc["frames"]=session.frames;doc["rssi"]=report.rssi;
  if(session.valid)doc["rawMetres"]=session.rawMetres;
  doc["valid"]=reading.valid;doc["state"]=reading.state;
  if(reading.valid){doc["metres"]=reading.metres;doc["uncertaintyMetres"]=reading.uncertaintyMetres;}
  doc["mode"]=findModeName(g.mode);doc["view"]=view;doc["ring"]=ringShapeName(g.ring);
  doc["brightness"]=g.ring==RingShape::Full?g.proximity.brightness:g.visuals.light.brightness;
  doc["beepIntervalMillis"]=g.beepIntervalMs;
  auto walk=doc.createNestedObject("walk");
  walk["state"]=walkFix.reason;walk["samples"]=walkCount;walk["steps"]=walker.steps();
  walk["heading"]=walker.headingDegrees();walk["x"]=walker.x();walk["y"]=walker.y();
  if(g.walkEstimate){walk["bearing"]=g.visuals.light.bearing;walk["uncertainty"]=g.walkUncertaintyDegrees;}
  ProbeEstimate estimate=prober.estimate(report.at,walker.headingDegrees());
  auto probe=doc.createNestedObject("probe");
  probe["last"]=probeResultName(prober.lastProbe());probe["probes"]=estimate.probes;
  probe["still"]=walker.stillSeconds();probe["phase"]=probePhaseName(prober.phase());
  if(std::isfinite(prober.lastChange()))probe["change"]=prober.lastChange();
  if(estimate.valid){probe["bearing"]=estimate.bearingFromTop;probe["uncertainty"]=estimate.uncertaintyDegrees;}
  serializeJson(doc,Serial);Serial.println();
}
void processRanging(){
  FtmReport report;
  while(xQueueReceive(ftmQueue,&report,0)==pdTRUE){
    RangeSession session=report.status==FTM_STATUS_SUCCESS?rangeSession(report.frame,report.frames):RangeSession{false,NAN,0};
    if(!session.valid)ftmFailures++;
    if(report.frames)lastRangeRssi=report.rssi;
    rangeTracker.addSession(session,report.at);
    if(view=="find"){
      dirty=true;
      if(session.valid){
        const double metres=calibratedRangeMetres(session.rawMetres);
        addWalkRange(metres);prober.range(metres,report.at);
      }
    }
    rangeEvent(report,session);
  }
  uint32_t now=millis();
  if(ftmBusy&&now-ftmStartedAt>3000){ftmBusy=false;ftmFailures++;rangeTracker.addSession({false,NAN,0},now);}
  if(!rangingReady||ftmBusy||int32_t(now-ftmNextAt)<0)return;
  wifi_ftm_initiator_cfg_t config{};memcpy(config.resp_mac,peerResponder,6);
  config.channel=1;config.frm_count=16;config.burst_period=2;
  // Jitter keeps the two bands from starting sessions in lock step.
  ftmStartedAt=now;ftmNextAt=now+500+esp_random()%200;ftmAttempts++;
  if(esp_wifi_ftm_initiate_session(&config)==ESP_OK)ftmBusy=true;
  else{ftmFailures++;rangeTracker.addSession({false,NAN,0},now);}
}
void button(const String &key) {
  if(unread){unread=false;incoming="";view=previousView;dirty=true;event("dismissed");return;}
  if(key=="sos"){view="sos";sosCount=0;}
  else if(view=="sos"){
    if(key=="ok"){if(++sosCount==3){if(!sendMessage("SOS - I need help")){view="result";result="Peer offline";}sosCount=0;}}
    else {view="home";sosCount=0;}
  }else if(view=="home"){
    view="menu";menuIndex=key=="back"?presetCount:0;
  }else if(view=="menu"){
    if(key=="back")menuIndex=(menuIndex+presetCount)%(presetCount+1);
    else if(key=="next")menuIndex=(menuIndex+1)%(presetCount+1);
    else if(menuIndex==0){view="find";startWalk();transmit(packet(LOCATION_REQUEST));}
    else view="confirm";
  }else if(view=="confirm"){
    if(key=="ok"){if(!sendMessage(presets[menuIndex-1].text)){view="result";result=pendingSequence?"Please wait":"Peer offline";}}
    else view="menu";
  }else if(view=="find"&&(key=="back"||key=="next")){
    demoBearing=nextDemoBearing(demoBearing,key=="next"?1:-1);
  }else view="home";
  if(view!="find")demoBearing=NAN;
  dirty=true;
}
String touchButton(int x,int y) {
  if(x<0||x>=240||y<0||y>=240)return "";
  if(y>=43&&y<=89){if(x<86)return "back";if(x>154)return "next";return "ok";}
  if(x>=94&&x<=146&&y>=188&&y<=225)return "sos";
  // Tap the message itself to dismiss, or select the central menu item.
  if(x>=38&&x<=202&&y>=94&&y<=188)return "ok";
  return "";
}
void IRAM_ATTR onTouch(){touchPending=true;}
void pollTouch(){
  if(!touchPending)return;touchPending=false;
  Wire.beginTransmission(0x15);Wire.write(0x01);if(Wire.endTransmission(false)!=0)return;
  if(Wire.requestFrom(0x15,6)!=6)return;
  uint8_t b[6];for(auto &v:b)v=Wire.read();
  touchReports++;lastTouchGesture=b[0];lastTouchEvent=b[2]>>6;lastTouchFingers=b[1];
  if(!touchPress.observe(lastTouchEvent,lastTouchFingers,lastTouchGesture))return;
  static uint32_t lastTouch=0;
  if(uint32_t(millis()-lastTouch)<220)return;
  int x=((b[2]&15)<<8)|b[3],y=((b[4]&15)<<8)|b[5];
  if(x<240&&y<240){String key=touchButton(x,y);if(key.length()){lastTouch=millis();lastTouchAt=lastTouch;touchPresses++;button(key);}}
}
void label(const String &text,int x,int y,uint16_t color=0xffff,int font=2){frame.setTextColor(color,INK);frame.setTextDatum(MC_DATUM);frame.drawString(text,x,y,font);}
std::vector<String> wrapLines(const String &text,int font){
  std::vector<String> lines;String line="";int pos=0;
  while(pos<int(text.length())){
    int end=text.indexOf(' ',pos);if(end<0)end=text.length();String word=text.substring(pos,end);
    if(line.length() && frame.textWidth(line+" "+word,font)>145){lines.push_back(line);line="";}
    while(frame.textWidth(word,font)>145){
      int take=1;while(take<int(word.length())&&frame.textWidth(word.substring(0,take+1),font)<=145)take++;
      lines.push_back(word.substring(0,take));word=word.substring(take);
    }
    line+=(line.length()?" ":"")+word;
    pos=end+1;
  }
  if(line.length())lines.push_back(line);
  return lines;
}
void wrapped(const String &text,int y,uint16_t color=0xffff){
  int font=2;auto lines=wrapLines(text,font);
  // All 40 characters must fit above the hint, including wide unbroken words.
  if(lines.size()>2){font=1;lines=wrapLines(text,font);}
  for(const auto &line:lines){label(line,120,y,color,font);y+=font==2?17:13;}
}
String rangeStateText(){
  if(!rangingReady)return "Wi-Fi ranging unavailable";
  String state=rangeTracker.reading(millis()).state;
  return state=="no_response"?"Wi-Fi ranging: no reply":"Wi-Fi ranging: "+state;
}
String accuracyText(double metres){
  if(!std::isfinite(metres))return "GPS accuracy unavailable";
  if(metres>=10000)return "GPS accuracy > 10 km";
  return metres>=1000?"GPS +/- "+String(metres/1000,1)+" km":"GPS +/- "+String(metres,0)+" m";
}
FindMode renderedMode=FindMode::Offline;RingShape renderedRing=RingShape::None;ProbePhase renderedPhase=ProbePhase::Waiting;
void render(){
  DirectionQuality quality;FindGuidance g=currentGuidance(&quality);
  renderedMode=g.mode;renderedRing=g.ring;renderedPhase=prober.phase();
  const uint16_t peerColour=OTHER==0?PURPLE:YELLOW;
  // With no buzzer fitted, the ring flashes on each beep and dims between.
  const double pulse=g.beepIntervalMs?(pulseOn?1.0:0.35):1.0;
  frame.fillSprite(INK);frame.fillCircle(120,120,119,PAPER);
  if(g.ring==RingShape::Full){
    // Uniform proximity ring that points nowhere: halo, core, halo, as exact
    // concentric circles under the face so edges stay clean.
    const double b=g.proximity.brightness*pulse;
    frame.fillCircle(120,120,DIRECTION_ARC_OUTER_RADIUS,arcColour565(peerColour,b*0.35));
    frame.fillCircle(120,120,DIRECTION_ARC_CORE_OUTER_RADIUS,arcColour565(peerColour,b));
    frame.fillCircle(120,120,DIRECTION_ARC_CORE_INNER_RADIUS-1,arcColour565(peerColour,b*0.35));
    frame.fillCircle(120,120,DIRECTION_ARC_INNER_RADIUS-1,PAPER);
  }else frame.drawCircle(120,120,112,0xd69a);
  RoundDisplayLabel branding=roundDisplayBranding();
  frame.setTextDatum(MC_DATUM);frame.setTextColor(0x8c71,PAPER);frame.drawString(branding.text,branding.x,branding.y,branding.font);
  auto control=[](int x,const char *text){frame.fillRoundRect(x-23,50,46,31,9,0xc638);frame.setTextColor(INK,0xc638);frame.setTextDatum(MC_DATUM);frame.drawString(text,x,66,2);};
  control(57,"<");control(120,"OK");control(183,">");
  const int lx[]={48,192,48,192},ly[]={48,48,192,192};const uint16_t colors[]={PURPLE,0xf208,0x3666,YELLOW};
  for(int i=0;i<4;i++){bool active=(i==0&&OTHER==0||i==3&&OTHER==1)&&unread;frame.fillCircle(lx[i],ly[i],active?10:6,active?colors[i]:0xa534);if(active)frame.drawCircle(lx[i],ly[i],13,colors[i]);}
  frame.fillRoundRect(39,94,162,94,9,INK);frame.drawRoundRect(39,94,162,94,9,0x6b6d);
  if(view=="home"){
    label(NAMES[SELF],120,113,SELF==0?PURPLE:YELLOW,4);label("Together, further.",120,139);label(peerConnected()?String(NAMES[OTHER])+" connected":"Waiting for peer",120,165,0xbdf7);
  }else if(view=="menu"){
    label(String(menuIndex+1)+" / "+String(presetCount+1),120,109,0xbdf7);
    wrapped(menuIndex==0?"Find Direction":presets[menuIndex-1].text,137);label("OK to select",120,174,0xbdf7);
  }else if(view=="confirm"){
    label("SEND TO "+String(NAMES[OTHER]),120,109,0xbdf7);wrapped(presets[menuIndex-1].text,135);label("OK send / < cancel",120,174,0xbdf7);
  }else if(view=="incoming"){
    label("FROM "+String(NAMES[OTHER]),120,106,OTHER==0?PURPLE:YELLOW);wrapped(incoming,127);label("Tap to dismiss",120,177,0xbdf7);
  }else if(view=="find"){
    label("FIND "+String(NAMES[OTHER]),120,103,peerColour);
    char distance[40],detail[48];formatFindDistance(g,distance,sizeof(distance));formatFindUncertainty(g,detail,sizeof(detail));
    bool simulated=localPosition.simulated||peerPosition.simulated;
    if(g.mode==FindMode::Offline){
      label("Peer offline",120,130);label("Keep both bands powered",120,154,0xbdf7,1);
    }else if(g.mode==FindMode::Direction){
      DirectionArrow arrow=g.visuals.arrow;
      frame.fillTriangle(arrow.tip.x,arrow.tip.y,arrow.left.x,arrow.left.y,arrow.right.x,arrow.right.y,peerColour);
      label(simulated?"SIMULATED LOCATION":"NORTH UP ~"+String(g.bearing,0)+" deg +/-"+String(quality.bearingUncertaintyDegrees,0),120,114,0xbdf7,1);
      label(distance,120,172,0xffff,2);label(detail,120,183,0xbdf7,1);
    }else if(g.mode==FindMode::WalkEstimate){
      DirectionArrow arrow=g.visuals.arrow;
      frame.fillTriangle(arrow.tip.x,arrow.tip.y,arrow.left.x,arrow.left.y,arrow.right.x,arrow.right.y,peerColour);
      label("WALK ESTIMATE +/-"+String(g.walkUncertaintyDegrees,0)+" deg",120,114,0x07ff,1);
      label(distance,120,172,0xffff,2);label(detail,120,183,0xbdf7,1);
    }else if(g.mode==FindMode::ProbeEstimate){
      DirectionArrow arrow=g.visuals.arrow;
      frame.fillTriangle(arrow.tip.x,arrow.tip.y,arrow.left.x,arrow.left.y,arrow.right.x,arrow.right.y,peerColour);
      label("WARMER/COLDER +/-"+String(g.probeUncertaintyDegrees,0),120,114,0x07ff,1);
      label(distance,120,172,0xffff,2);label(probeHint(),120,183,0xbdf7,1);
    }else if(g.mode==FindMode::DemoDirection){
      DirectionArrow arrow=g.visuals.arrow;
      frame.fillTriangle(arrow.tip.x,arrow.tip.y,arrow.left.x,arrow.left.y,arrow.right.x,arrow.right.y,peerColour);
      label("DEMO - NOT MEASURED",120,114,0xfd20,1);
      String measured=String(detail);measured.replace(" Wi-Fi timing"," WiFi");
      label(distance,120,172,0xffff,2);label(measured+" | < > turn",120,183,0xbdf7,1);
    }else if(g.mode==FindMode::DistanceOnly){
      label(distance,120,128,peerColour,4);label(detail,120,150,0xbdf7,1);
      label(probeHint(),120,161,0x07ff,1);label(walkHint(),120,172,0xbdf7,1);
      label("< > : demo direction",120,183,0xbdf7,1);
    }else if(g.mode==FindMode::Uncertain){
      label(distance,120,126);label("GPS too uncertain",120,145,0xbdf7);
      label(accuracyText(quality.combinedAccuracyMetres),120,160,0xbdf7,1);
      label(simulated?"SIMULATED LOCATION":rangeStateText(),120,172,0xbdf7,1);
    }else{
      label(distance,120,126);label(rangeStateText(),120,146,0xbdf7,1);
      label("Share both on /phone",120,160,0xbdf7,1);label("No GPS or compass on band",120,172,0xbdf7,1);
    }
  }else if(view=="sos"){
    label("SEND SOS?",120,115,0xf208,4);label("Press OK "+String(3-sosCount)+" more",120,144);label("< or > cancels",120,172,0xbdf7);
  }else {wrapped(result,125);label("OK to return",120,172,0xbdf7);}
  frame.fillTriangle(120,192,105,216,135,216,0xf208);frame.setTextColor(0xffff,0xf208);frame.setTextDatum(MC_DATUM);frame.drawString("!",120,205,2);
  frame.setTextColor(0x7bef,PAPER);
  RoundDisplayLabel footerLeft=roundDisplayFooterLeft(),footerRight=roundDisplayFooterRight();
  frame.drawString(footerLeft.text,footerLeft.x,footerLeft.y,footerLeft.font);
  frame.drawString(footerRight.text,footerRight.x,footerRight.y,footerRight.font);
  if(g.ring==RingShape::Quarter){
    DirectionArc arc=g.visuals.light;
    // North at the top, clockwise bearing. A 90-degree arc with a bright
    // centre and feathered ends; the remaining circumference stays neutral.
    for(int step=-90;step<=90;step++){
      double degrees=arc.bearing+step*0.5,angle=degrees*PI/180;
      double strength=arcStrengthAt(arc,degrees)*pulse;
      for(int radius=DIRECTION_ARC_INNER_RADIUS;radius<=DIRECTION_ARC_OUTER_RADIUS;radius++){
        double halo=(radius>=DIRECTION_ARC_CORE_INNER_RADIUS&&radius<=DIRECTION_ARC_CORE_OUTER_RADIUS)?1.0:0.35;
        int x=120+std::lround(std::sin(angle)*radius),y=120-std::lround(std::cos(angle)*radius);
        frame.drawPixel(x,y,arcColour565(peerColour,strength*halo));
      }
    }
  }
  frame.pushSprite(0,0);dirty=false;
}
bool printable(const String &s,int max){if(s.length()==0||s.length()>max)return false;for(unsigned char c:s)if(c<32||c>126)return false;return true;}
String snapshotPixels(){
  if(dirty)render();String data;data.reserve(24000);
  uint16_t last=frame.readPixel(0,0),count=1;char run[9];
  for(int i=1;i<240*240;i++){
    uint16_t pixel=frame.readPixel(i%240,i/240);
    if(pixel==last){count++;continue;}
    snprintf(run,sizeof(run),"%04x%04x",count,last);data+=run;
    if(data.length()>50000)return "";
    last=pixel;count=1;
  }
  snprintf(run,sizeof(run),"%04x%04x",count,last);data+=run;return data;
}
bool loadPresets(JsonArrayConst items){
  if(items.isNull()||items.size()>8)return false;
  Preset next[8];int n=0;
  for(JsonObjectConst item:items){String id=item["id"]|"",text=item["text"]|"";if(!printable(id,32)||!printable(text,40)||!text.length())return false;for(int j=0;j<n;j++)if(next[j].id==id)return false;next[n++]={id,text};}
  for(int i=0;i<n;i++)presets[i]=next[i];presetCount=n;menuIndex=0;previousView="home";if(view=="confirm"||view=="menu")view="home";dirty=true;return true;
}
void command(const String &line){
  DynamicJsonDocument request(3072);DynamicJsonDocument reply(6144);
  if(deserializeJson(request,line)){reply["type"]="response";reply["ok"]=false;reply["error"]="Invalid JSON";output(reply);return;}
  reply["type"]="response";reply["id"]=request["id"];reply["ok"]=true;
  if(request.containsKey("owner") && String(request["owner"].as<const char*>())!=OWNERS[SELF]){reply["ok"]=false;reply["error"]="Wrong band owner";output(reply);return;}
  String cmd=request["cmd"]|"";
  if(cmd=="hello"||cmd=="status")status(reply);
  else if(cmd=="presets"){
    // Validate before replacing the old list; NVS writes finish before acknowledgement.
    JsonArrayConst items=request["messages"];
    Preset before[8];int beforeCount=presetCount;for(int i=0;i<presetCount;i++)before[i]=presets[i];
    if(!loadPresets(items)){reply["ok"]=false;reply["error"]="Use up to 8 unique presets, ASCII text 1-40 chars and ids 1-32 chars";}
    else{String encoded;serializeJson(items,encoded);if(settings.putString("presets",encoded)==0){presetCount=beforeCount;for(int i=0;i<presetCount;i++)presets[i]=before[i];reply["ok"]=false;reply["error"]="Preset storage failed";}else status(reply);}
  }else if(cmd=="location"||cmd=="demo_location"){
    double lat=request["lat"]|999.0,lon=request["lon"]|999.0,acc=request["accuracy"]|-1.0;
    uint64_t timestamp=request["timestamp"]|uint64_t(0);
    if(!std::isfinite(lat)||!std::isfinite(lon)||!std::isfinite(acc)||lat < -90||lat>90||lon < -180||lon>180||acc<0||acc>FLT_MAX||!timestamp||(cmd=="location"&&request["simulated"].as<bool>())){reply["ok"]=false;reply["error"]="Invalid phone position";}
    else{
      bool sameFix=localPosition.valid&&localPosition.timestamp==timestamp&&localPosition.lat==lat&&localPosition.lon==lon;
      uint32_t received=sameFix?localPosition.received:millis();
      localPosition={lat,lon,float(acc),timestamp,received,true,cmd=="demo_location"};
      if(!fresh(localPosition)){reply["ok"]=false;reply["error"]="Phone fix expired; obtain a new position";}
      sharePosition();dirty=true;status(reply);
    }
  }else if(cmd=="clear_location"){localPosition.valid=false;transmit(packet(CLEAR_LOCATION));dirty=true;status(reply);}
  else if(cmd=="send"){
    String text=request["text"]|"";if(!printable(text,40)||!sendMessage(text)){reply["ok"]=false;reply["error"]="Invalid message, peer offline, or a send is pending";}else {reply["queued"]=true;reply["sequence"]=pendingSequence;}
  }else if(cmd=="control"){
    String key=request["button"]|"";if(key!="back"&&key!="next"&&key!="ok"&&key!="sos"){reply["ok"]=false;reply["error"]="Unknown button";}else{button(key);status(reply);}
  }else if(cmd=="tap"){
    String key=touchButton(request["x"]|-1,request["y"]|-1);if(!key.length()){reply["ok"]=false;reply["error"]="Outside a control";}else{button(key);status(reply);}
  }else if(cmd=="frame_snapshot"){
    // Capture in one main-loop operation so touches cannot tear a row-by-row image.
    String pixels=snapshotPixels();
    if(!pixels.length()){reply["ok"]=false;reply["error"]="Frame is too complex for serial capture";}
    else{
      DynamicJsonDocument capture(pixels.length()+1024);
      capture["type"]="response";capture["id"]=request["id"];capture["ok"]=true;
      capture["width"]=240;capture["height"]=240;capture["encoding"]="rgb565-rle";
      capture["view"]=view;capture["incoming"]=incoming;capture["unread"]=unread;capture["pixels"]=pixels;
      if(capture.overflowed()){reply["ok"]=false;reply["error"]="Frame capture allocation failed";}
      else{output(capture);return;}
    }
  }else if(cmd=="imu_stream"){
    imuStreaming=request["on"]|false;reply["imuReady"]=imuReady;reply["imuSamples"]=imuSamples;
  }else if(cmd=="frame_row"){
    int row=request["row"]|-1;if(row<0||row>=240){reply["ok"]=false;reply["error"]="Invalid row";}else{if(dirty)render();String data;data.reserve(960);char hex[5];for(int x=0;x<240;x++){snprintf(hex,5,"%04x",frame.readPixel(x,row));data+=hex;}reply["pixels"]=data;}
  }else{reply["ok"]=false;reply["error"]="Unknown command";}
  output(reply);
}
class BandServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*,esp_ble_gatts_cb_param_t *event)override{
    bleConnected=true;bleConnectionId=event->connect.conn_id;
    esp_ble_conn_update_params_t parameters{};memcpy(parameters.bda,event->connect.remote_bda,6);
    parameters.min_int=0x18;parameters.max_int=0x28;parameters.latency=0;parameters.timeout=400;
    esp_ble_gap_update_conn_params(&parameters);
  }
  void onDisconnect(BLEServer*,esp_ble_gatts_cb_param_t *event)override{
    bleConnected=false;lastBleDisconnectReason=event->disconnect.reason;restartAdvertising=true;
  }
};
class ConfigCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic*,esp_ble_gatts_cb_param_t *event)override{
    configWrites++;
    // Read the immutable GATT event, not the shared characteristic value.
    for(int i=0;i<event->write.len;i++){
      char c=event->write.value[i];
      if(c=='\n'){
        // BLE callbacks run on a 3 KB task stack. Allocate the large line on
        // the heap and queue it for processing on the main application task.
        auto *line=new(std::nothrow) ConfigLine;
        if(line){bleInput.toCharArray(line->text,sizeof(line->text));xQueueSend(configQueue,line,0);delete line;}
        bleInput="";
      }else if(c!='\r'){if(bleInput.length()<2048)bleInput+=c;else bleInput="";}
    }
  }
};
class SignalCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic*,esp_ble_gatts_cb_param_t *event)override{
    if(event->write.len!=1)return;uint8_t code=event->write.value[0];
    const char *texts[]={"I'm Safe","Toilet","Taking a Break","Going Home","Meet Me","SOS - I need help"};
    if(code<1||code>6)return;
    auto *line=new(std::nothrow) ConfigLine;
    if(line){snprintf(line->text,sizeof(line->text),"{\"cmd\":\"send\",\"text\":\"%s\"}",texts[code-1]);xQueueSend(configQueue,line,0);delete line;}
  }
};
void onRawGattEvent(esp_gatts_cb_event_t event,esp_gatt_if_t interface,esp_ble_gatts_cb_param_t*){
  if(event==ESP_GATTS_REG_EVT||event==ESP_GATTS_CONNECT_EVT)bleInterface=interface;
}
void setupBluetooth(){
  configQueue=xQueueCreate(3,sizeof(ConfigLine));if(!configQueue)return;
  bleInput.reserve(2048);bleOutput.reserve(4096);
  String advertised=String("PulseBand-")+NAMES[SELF];BLEDevice::init(advertised.c_str());BLEDevice::setMTU(185);
  BLEDevice::setCustomGattsHandler(onRawGattEvent);
  bleServer=BLEDevice::createServer();bleServer->setCallbacks(new BandServerCallbacks());
  BLEService *service=bleServer->createService("b97b0001-7a62-4f1a-9b9c-0b13e9de3500");
  signalChannel=service->createCharacteristic("b97b0002-7a62-4f1a-9b9c-0b13e9de3500",BLECharacteristic::PROPERTY_WRITE|BLECharacteristic::PROPERTY_NOTIFY);
  signalChannel->addDescriptor(new BLE2902());signalChannel->setCallbacks(new SignalCallbacks());
  configChannel=service->createCharacteristic("b97b0003-7a62-4f1a-9b9c-0b13e9de3500",BLECharacteristic::PROPERTY_WRITE|BLECharacteristic::PROPERTY_NOTIFY);
  configSubscription=new BLE2902();configChannel->addDescriptor(configSubscription);configChannel->setCallbacks(new ConfigCallbacks());service->start();
  BLEAdvertising *advertising=BLEDevice::getAdvertising();advertising->addServiceUUID(service->getUUID());advertising->setScanResponse(true);advertising->start();
}
void processBluetooth(){
  if(restartAdvertising){restartAdvertising=false;bleInput="";bleOutput="";BLEDevice::startAdvertising();}
  ConfigLine line;while(configQueue && xQueueReceive(configQueue,&line,0)==pdTRUE)command(line.text);
  static uint32_t lastNotify=0;
  if(bleConnected&&bleInterface!=ESP_GATT_IF_NONE&&configChannel&&configSubscription->getNotifications()&&bleOutput.length()&&millis()-lastNotify>=12){
    String chunk=bleOutput.substring(0,20);
    // Sending the supplied buffer directly prevents simultaneous client writes
    // overwriting the notification payload between setValue() and notify().
    esp_err_t sent=esp_ble_gatts_send_indicate(bleInterface,bleConnectionId,configChannel->getHandle(),chunk.length(),reinterpret_cast<uint8_t*>(const_cast<char*>(chunk.c_str())),false);
    if(sent==ESP_OK)bleOutput.remove(0,chunk.length());lastNotify=millis();
  }
}
void setup(){
  Serial.begin(115200);serialLine.reserve(3072);settings.begin("pulseband",false);
  DynamicJsonDocument stored(2048);String saved=settings.isKey("presets")?settings.getString("presets",""):"";
  if(deserializeJson(stored,saved)||!loadPresets(stored.as<JsonArrayConst>())){
    const char* ids[]={"safe","toilet","break","home","meet"};const char* texts[]={"I'm Safe","Toilet","Taking a Break","Going Home","Meet Me"};presetCount=5;for(int i=0;i<5;i++)presets[i]={ids[i],texts[i]};
  }
  lcd.init();lcd.setRotation(0);pinMode(2,OUTPUT);digitalWrite(2,HIGH);
  frame.setColorDepth(16);if(!frame.createSprite(240,240)){Serial.println("Frame allocation failed");while(true)delay(1000);}
  Wire.begin(6,7);pinMode(13,OUTPUT);digitalWrite(13,HIGH);delay(50);digitalWrite(13,LOW);delay(5);digitalWrite(13,HIGH);delay(50);
  Wire.beginTransmission(0x15);touchAvailable=Wire.endTransmission()==0;
  if(touchAvailable){
    Wire.beginTransmission(0x15);Wire.write(0xfe);Wire.write(1);bool configured=Wire.endTransmission()==0;
    // Include motion/gesture IRQs so SingleClick completion is reported.
    Wire.beginTransmission(0x15);Wire.write(0xfa);Wire.write(0x70);touchAvailable=Wire.endTransmission()==0&&configured;
  }
  pinMode(5,INPUT_PULLUP);attachInterrupt(digitalPinToInterrupt(5),onTouch,RISING);
  // Report what is actually on the shared I2C bus (touch 0x15, QMI8658 0x6B).
  for(int address=8;address<0x78;address++){Wire.beginTransmission(address);if(Wire.endTransmission()==0){char hex[6];snprintf(hex,sizeof(hex),"%s0x%02x",i2cDevices.length()?" ":"",address);i2cDevices+=hex;}}
  {uint8_t who=0;if(imuRead(0x00,&who,1))imuWhoAmI=who;}
  imuQueue=xQueueCreate(64,sizeof(ImuSample));
  imuReady=imuWhoAmI==0x05&&imuQueue&&imuInit();
  if(imuReady)xTaskCreatePinnedToCore(imuTask,"imu",3072,nullptr,2,nullptr,1);
#ifdef PULSE_BUZZER_PIN
  ledcSetup(BUZZER_CHANNEL,2700,8);ledcAttachPin(PULSE_BUZZER_PIN,BUZZER_CHANNEL);ledcWrite(BUZZER_CHANNEL,0);
#endif
  // Bluetooth coexistence in IDF 4.4 requires modem sleep enabled. With no AP
  // association, ESP-NOW still listens on the selected channel. The hidden,
  // password-protected SoftAP only answers FTM ranging; nothing joins it.
  ftmQueue=xQueueCreate(2,sizeof(FtmReport));if(ftmQueue)WiFi.onEvent(onFtmReport,ARDUINO_EVENT_WIFI_FTM_REPORT);
  WiFi.mode(WIFI_AP_STA);
  String secret;for(int i=0;i<24;i++)secret+=char('a'+esp_random()%26);
  bool responder=WiFi.softAP((String("PulseBand-range-")+OWNERS[SELF]).c_str(),secret.c_str(),1,1,1,true);
  WiFi.disconnect();esp_wifi_set_ps(WIFI_PS_MIN_MODEM);esp_wifi_set_channel(1,WIFI_SECOND_CHAN_NONE);
  // IDF derives the SoftAP MAC by setting the locally administered bit of the
  // station MAC (two universal MACs); verified as 8E:FD:49:... on both boards.
  memcpy(peerResponder,MACS[OTHER],6);peerResponder[0]|=0x02;
  radioQueue=xQueueCreate(12,sizeof(Packet));
  uint8_t ownMac[6];esp_wifi_get_mac(WIFI_IF_STA,ownMac);
  if(memcmp(ownMac,MACS[SELF],6)==0 && radioQueue && esp_now_init()==ESP_OK){
    esp_now_set_pmk(PAIR_KEY);esp_now_peer_info_t peer{};memcpy(peer.peer_addr,MACS[OTHER],6);memcpy(peer.lmk,PAIR_KEY,16);peer.channel=1;peer.encrypt=true;peer.ifidx=WIFI_IF_STA;
    radioReady=esp_now_add_peer(&peer)==ESP_OK;if(radioReady)esp_now_register_recv_cb(onRadio);
  }
  // Range only the verified paired band, and only with a working responder.
  rangingReady=radioReady&&responder&&ftmQueue;
  // A random sequence seed prevents rebooted peers confusing new messages with old ones.
  nextSequence=esp_random()|1;setupBluetooth();render();DynamicJsonDocument hello(6144);hello["type"]="status";status(hello);output(hello);
}
void loop(){
  processRadio();pollTouch();processBluetooth();processImu();processRanging();
  if(walkFix.valid){
    // The friend has moved (or the path drifted) if the live distance no
    // longer matches the located spot: hide the arrow until a new fit.
    RangeReading live=rangeTracker.reading(millis());
    if(live.valid&&std::abs(walkFix.distanceFrom(walker.x(),walker.y())-live.metres)>2*walkFix.sigmaMetres+live.uncertaintyMetres){
      walkFix.valid=false;walkFix.reason="inconsistent";dirty=true;
    }
  }
  while(Serial.available()){
    char c=Serial.read();if(c=='\n'){command(serialLine);serialLine="";}else if(c!='\r'){if(serialLine.length()<3072)serialLine+=c;else serialLine="";}
  }
  uint32_t now=millis();
  if(now-heartbeatAt>=2000){heartbeatAt=now;transmit(packet(HEARTBEAT));sharePosition();dirty=true;DynamicJsonDocument state(6144);state["type"]="status";status(state,false);output(state);}
  FindGuidance g=currentGuidance();
  // Expiry or loss must clear the ring promptly, not at the next heartbeat.
  if(view=="find"&&(g.mode!=renderedMode||g.ring!=renderedRing||prober.phase()!=renderedPhase))dirty=true;
  bool sounding=beeper.update(g.beepIntervalMs,now);
  bool flash=beeper.flashing(now);
  if(flash!=pulseOn){pulseOn=flash;if(view=="find")dirty=true;}
#ifdef PULSE_BUZZER_PIN
  if(sounding!=beepSounding)ledcWrite(BUZZER_CHANNEL,sounding?128:0);
#endif
  beepSounding=sounding;
  if(pendingSequence && now-pendingAt>=700){
    if(sendAttempts>=4){pendingSequence=0;result="Delivery unconfirmed";dirty=true;event("send_failed",pendingText);}
    else{Packet p=packet(MESSAGE,pendingSequence);pendingText.toCharArray(p.text,sizeof(p.text));transmit(p);pendingAt=now;sendAttempts++;}
  }
  if(dirty)render();delay(5);
}
