import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from start_table_tracking import reset_pair


class Pair:
    def __init__(self):
        self.calls=[]
        self.sessions={}
        self.wrong_owner=None
        self.hidden=None

    def command(self,owner,command,payload):
        self.calls.append((owner,command,payload))
        if command=="motion_start":
            self.sessions[owner]=payload["session"]
        return {"owner":self.wrong_owner or owner,"sensors":{"imu":{"present":True}},
                "directionArrowVisible":owner in self.sessions and owner!=self.hidden,
                "find":{"motion":{"session":self.sessions.get(owner,0),"active":owner in self.sessions}}}


class ResetTests(unittest.TestCase):
    def test_reset_uses_one_shared_frame_and_validates_both_first(self):
        pair=Pair()
        states=reset_pair(pair,30)
        self.assertEqual([c[:2] for c in pair.calls[:2]],[("nayaka","status"),("syifa","status")])
        starts=[c for c in pair.calls if c[1]=="motion_start"]
        self.assertEqual([c[0] for c in starts],["nayaka","syifa"])
        self.assertEqual(starts[0][2],starts[1][2])
        self.assertEqual(starts[0][2]["separationMetres"],.3)
        self.assertGreater(starts[0][2]["session"],0)
        self.assertTrue(all(s["directionArrowVisible"] for s in states.values()))

    def test_wrong_device_rejects_reset_before_either_band_is_changed(self):
        pair=Pair();pair.wrong_owner="unknown"
        with self.assertRaises(RuntimeError):reset_pair(pair,30)
        self.assertFalse(any(c[1]=="motion_start" for c in pair.calls))

    def test_missing_arrow_acknowledgement_is_reported_without_blanking_other_band(self):
        pair=Pair();pair.hidden="syifa"
        with self.assertRaises(RuntimeError):reset_pair(pair,30)
        self.assertFalse(any(c[1]=="motion_stop" for c in pair.calls))


if __name__=="__main__":unittest.main()
