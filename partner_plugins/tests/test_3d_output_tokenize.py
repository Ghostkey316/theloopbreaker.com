import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from partner_plugins import mirrorforge_3d_output as m3d


class MirrorforgeTokenizeTest(unittest.TestCase):
    def test_tokenizable_flags_in_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(m3d, "BASE_DIR", Path(tmp)):
                result = m3d.create_object(
                    "test cube",
                    fmt="gltf",
                    wallet="ghostkey316.eth",
                    tokenizable=True,
                    watermark=True,
                    timed_reveal=True,
                    partner_lock=True,
                )
                obj_dir = Path(tmp) / "ghostkey316.eth" / result["object_id"]
                manifest = obj_dir / "manifest.json"
                data = json.loads(manifest.read_text())
                self.assertTrue(data[0]["tokenizable"])
                self.assertTrue(data[0]["watermark"])
                self.assertTrue(data[0]["timed_reveal"])
                self.assertTrue(data[0]["partner_lock"])
                self.assertIsNotNone(data[0].get("token"))


if __name__ == "__main__":
    unittest.main()
