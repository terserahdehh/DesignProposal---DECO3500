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
#include "direction_arc.h"
#include "direction_arrow.h"

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

bool fresh(const Position &p) { return p.valid && uint32_t(millis()-p.received)<LOCATION_TTL; }
bool peerConnected() { return lastPeer && uint32_t(millis()-lastPeer)<7000; }
DirectionArc currentDirectionArc() {
  if(view!="find"||!peerConnected()||!fresh(localPosition)||!fresh(peerPosition))return {false,0,90,0};
  Guidance g=guidance(localPosition.lat,localPosition.lon,peerPosition.lat,peerPosition.lon);
  DirectionQuality q=directionQuality(g.metres,localPosition.accuracy,peerPosition.accuracy);
  return directionArc(true,true,true,true,q.usable,g.bearing,g.metres);
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
void status(JsonDocument &doc) {
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
  doc["directionArrowVisible"]=false;
  if(fresh(localPosition)&&fresh(peerPosition)){
    Guidance g=guidance(localPosition.lat,localPosition.lon,peerPosition.lat,peerPosition.lon);
    DirectionQuality q=directionQuality(g.metres,localPosition.accuracy,peerPosition.accuracy);
    auto p=doc.createNestedObject("guidance");p["metres"]=g.metres;p["available"]=true;p["usable"]=q.usable;
    if(q.usable)p["bearing"]=g.bearing;
    p["bearingUncertaintyDegrees"]=q.bearingUncertaintyDegrees;
    p["northReferenced"]=true;p["simulated"]=localPosition.simulated||peerPosition.simulated;
    if(std::isfinite(q.combinedAccuracyMetres))p["accuracy"]=q.combinedAccuracyMetres;
    doc["directionArrowVisible"]=view=="find"&&peerConnected()&&q.usable;
  }
  DirectionArc arc=currentDirectionArc();auto light=doc.createNestedObject("directionLight");
  light["visible"]=arc.visible;light["colour"]=OTHER==0?"purple":"yellow";
  light["bearing"]=arc.bearing;light["spanDegrees"]=arc.spanDegrees;
  light["brightness"]=arc.brightness;light["northReferenced"]=true;
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
    else if(menuIndex==0){view="find";transmit(packet(LOCATION_REQUEST));}
    else view="confirm";
  }else if(view=="confirm"){
    if(key=="ok"){if(!sendMessage(presets[menuIndex-1].text)){view="result";result=pendingSequence?"Please wait":"Peer offline";}}
    else view="menu";
  }else view="home";
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
String distanceText(double metres){return metres>=1000?"~"+String(metres/1000,1)+" km":"~"+String(metres,0)+" m";}
String accuracyText(double metres){
  if(!std::isfinite(metres))return "GPS accuracy unavailable";
  if(metres>=10000)return "GPS accuracy > 10 km";
  return metres>=1000?"GPS +/- "+String(metres/1000,1)+" km":"GPS +/- "+String(metres,0)+" m";
}
void render(){
  frame.fillSprite(INK);frame.fillCircle(120,120,119,PAPER);frame.drawCircle(120,120,112,0xd69a);
  frame.setTextDatum(MC_DATUM);frame.setTextColor(0x8c71,PAPER);frame.drawString("P U L S E B A N D",120,25,1);
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
    label("FIND "+String(NAMES[OTHER]),120,103,OTHER==0?PURPLE:YELLOW);
    if(!peerConnected()){
      label("Peer offline",120,130);label("Keep both bands powered",120,154,0xbdf7,1);
    }else if(!fresh(localPosition)||!fresh(peerPosition)){
      label("Location unavailable",120,130);label("Share both on /phone",120,154,0xbdf7);label("No GPS on this band",120,174,0xbdf7,1);
    }else{
      Guidance g=guidance(localPosition.lat,localPosition.lon,peerPosition.lat,peerPosition.lon);
      DirectionQuality q=directionQuality(g.metres,localPosition.accuracy,peerPosition.accuracy);
      if(q.usable){
        DirectionArrow arrow=directionArrow(g.bearing);
        if(arrow.visible)frame.fillTriangle(arrow.tip.x,arrow.tip.y,arrow.left.x,arrow.left.y,arrow.right.x,arrow.right.y,OTHER==0?PURPLE:YELLOW);
        label(distanceText(g.metres)+" | ~"+String(g.bearing,0)+" deg N",120,114,0xbdf7,1);
        String accuracy=accuracyText(q.combinedAccuracyMetres);
        accuracy.replace("GPS accuracy > 10 km","GPS >10km");accuracy.replace(" km","km");accuracy.replace(" m","m");
        label(accuracy+" | +/-"+String(q.bearingUncertaintyDegrees,0)+"deg",120,170,0xbdf7,1);
      }else{
        label(distanceText(g.metres),120,128);label("GPS too uncertain",120,147,0xbdf7);
        label(accuracyText(q.combinedAccuracyMetres),120,160,0xbdf7,1);
      }
      label((localPosition.simulated||peerPosition.simulated)?"SIMULATED LOCATION":"NORTH UP - phone GPS",120,q.usable?180:176,0xbdf7,1);
    }
  }else if(view=="sos"){
    label("SEND SOS?",120,115,0xf208,4);label("Press OK "+String(3-sosCount)+" more",120,144);label("< or > cancels",120,172,0xbdf7);
  }else {wrapped(result,125);label("OK to return",120,172,0xbdf7);}
  frame.fillTriangle(120,192,105,216,135,216,0xf208);frame.setTextColor(0xffff,0xf208);frame.setTextDatum(MC_DATUM);frame.drawString("!",120,205,2);
  frame.setTextColor(0x7bef,PAPER);frame.drawString("TOGETHER, FURTHER.",120,222,1);
  DirectionArc arc=currentDirectionArc();
  if(arc.visible){
    uint16_t colour=OTHER==0?PURPLE:YELLOW;
    // North at the top, clockwise bearing. A 90-degree arc with a bright
    // centre and feathered ends; the remaining circumference stays neutral.
    for(int step=-90;step<=90;step++){
      double degrees=arc.bearing+step*0.5,angle=degrees*PI/180;
      double strength=arcStrengthAt(arc,degrees);
      for(int radius=109;radius<=117;radius++){
        double halo=(radius>=111&&radius<=115)?1.0:0.35;
        int x=120+std::lround(std::sin(angle)*radius),y=120-std::lround(std::cos(angle)*radius);
        frame.drawPixel(x,y,arcColour565(colour,strength*halo));
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
  DynamicJsonDocument request(3072);DynamicJsonDocument reply(4096);
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
  // Bluetooth coexistence in IDF 4.4 requires modem sleep enabled. With no AP
  // association, ESP-NOW still listens on the selected channel.
  WiFi.mode(WIFI_STA);WiFi.disconnect();esp_wifi_set_ps(WIFI_PS_MIN_MODEM);esp_wifi_set_channel(1,WIFI_SECOND_CHAN_NONE);
  radioQueue=xQueueCreate(12,sizeof(Packet));
  uint8_t ownMac[6];esp_wifi_get_mac(WIFI_IF_STA,ownMac);
  if(memcmp(ownMac,MACS[SELF],6)==0 && radioQueue && esp_now_init()==ESP_OK){
    esp_now_set_pmk(PAIR_KEY);esp_now_peer_info_t peer{};memcpy(peer.peer_addr,MACS[OTHER],6);memcpy(peer.lmk,PAIR_KEY,16);peer.channel=1;peer.encrypt=true;peer.ifidx=WIFI_IF_STA;
    radioReady=esp_now_add_peer(&peer)==ESP_OK;if(radioReady)esp_now_register_recv_cb(onRadio);
  }
  // A random sequence seed prevents rebooted peers confusing new messages with old ones.
  nextSequence=esp_random()|1;setupBluetooth();render();DynamicJsonDocument hello(4096);hello["type"]="status";status(hello);output(hello);
}
void loop(){
  processRadio();pollTouch();processBluetooth();
  while(Serial.available()){
    char c=Serial.read();if(c=='\n'){command(serialLine);serialLine="";}else if(c!='\r'){if(serialLine.length()<3072)serialLine+=c;else serialLine="";}
  }
  uint32_t now=millis();
  if(now-heartbeatAt>=2000){heartbeatAt=now;transmit(packet(HEARTBEAT));sharePosition();dirty=true;DynamicJsonDocument state(4096);state["type"]="status";status(state);output(state);}
  if(pendingSequence && now-pendingAt>=700){
    if(sendAttempts>=4){pendingSequence=0;result="Delivery unconfirmed";dirty=true;event("send_failed",pendingText);}
    else{Packet p=packet(MESSAGE,pendingSequence);pendingText.toCharArray(p.text,sizeof(p.text));transmit(p);pendingAt=now;sendAttempts++;}
  }
  if(dirty)render();delay(5);
}
