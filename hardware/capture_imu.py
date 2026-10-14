#!/usr/bin/env python3
"""Record owner-verified raw IMU data. Close other USB controllers first.

The optional stop file ends capture as soon as it appears. Streaming is disabled
and USB is released on exit. No positions or stored messages are changed.
"""
import argparse
import json
from pathlib import Path
import threading
import time

from bridge import BandBridge, OWNERS, open_serial


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--stop-file",type=Path)
    parser.add_argument("--seconds",type=int,default=300)
    args=parser.parse_args()
    if not 5<=args.seconds<=600:parser.error("--seconds must be 5 to 600")
    args.output.parent.mkdir(parents=True,exist_ok=True)
    owners={};counts={};lock=threading.Lock()
    with args.output.open("x") as log:
        args.output.chmod(0o600)
        def record(value):
            with lock:log.write(json.dumps(value)+"\n")
        class RecordedSerial:
            def __init__(self,port,baud):
                object.__setattr__(self,"device",open_serial(port,baud))
                object.__setattr__(self,"port",port)
                object.__setattr__(self,"buffer",b"")
            def __getattr__(self,name):return getattr(self.device,name)
            def __setattr__(self,name,value):
                if name in ("device","port","buffer"):object.__setattr__(self,name,value)
                else:setattr(self.device,name,value)
            def readline(self,size):
                chunk=self.device.readline(size);self.buffer+=chunk
                while b"\n" in self.buffer:
                    line,self.buffer=self.buffer.split(b"\n",1)
                    if not line.startswith(b"M,"):continue
                    try:raw=[int(v) for v in line.split(b",")[1:]]
                    except ValueError:continue
                    owner=owners.get(self.port)
                    if owner is None or len(raw)!=8:continue
                    record({"owner":owner,"receivedAt":int(time.time()*1000),"raw":raw})
                    counts[owner]=counts.get(owner,0)+1
                return chunk
        bridge=BandBridge(serial_factory=RecordedSerial);bridge.start()
        try:
            deadline=time.monotonic()+15
            while time.monotonic()<deadline:
                with bridge.lock:ready=all(o in bridge.connections for o in OWNERS)
                if ready:break
                time.sleep(.2)
            else:raise RuntimeError("Both bands must be connected")
            with bridge.lock:
                for owner in OWNERS:owners[bridge.connections[owner].port]=owner
            for owner in OWNERS:
                record({"owner":owner,"initial":bridge.command(owner,"status",{})})
                bridge.command(owner,"imu_stream",{"on":True})
            print("IMU_CAPTURE_READY: move the bands now; capture remains open until stopped.",flush=True)
            deadline=time.monotonic()+args.seconds
            while time.monotonic()<deadline and not (args.stop_file and args.stop_file.exists()):
                with lock:log.flush()
                time.sleep(.1)
        finally:
            for owner in OWNERS:
                try:
                    bridge.command(owner,"imu_stream",{"on":False})
                    record({"owner":owner,"final":bridge.command(owner,"status",{})})
                except Exception:pass
            bridge.close()
        print(json.dumps({"samples":counts,"file":str(args.output)}),flush=True)


if __name__=="__main__":main()
