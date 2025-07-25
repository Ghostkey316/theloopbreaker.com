import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from partner_plugins import mirrorforge_3d_output as m3d


class MirrorforgePromptTest(unittest.TestCase):
    def test_create_object_writes_model_and_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(m3d, "BASE_DIR", Path(tmp)):
                result = m3d.create_object(m3d.SAMPLE_OBJECTS[0], fmt="gltf", wallet="ghostkey316.eth")
                obj_dir = Path(tmp) / "ghostkey316.eth" / result["object_id"]
                model = obj_dir / "model.gltf"
                manifest = obj_dir / "manifest.json"
                self.assertTrue(model.exists())
                self.assertTrue(manifest.exists())
                data = json.loads(manifest.read_text())
                self.assertEqual(len(data), 1)
                self.assertEqual(data[0]["belief_id"], result["belief_id"])


if __name__ == "__main__":
    unittest.main()
