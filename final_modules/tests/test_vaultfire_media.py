import json
import tempfile
import unittest
from pathlib import Path

import importlib.util
import sys

MODULE_PATH = Path(__file__).resolve().parents[1] / "vaultfire_media.py"
spec = importlib.util.spec_from_file_location("vaultfire_media", MODULE_PATH)
vm = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(vm)


class VaultfireMediaTest(unittest.TestCase):
    def test_generate_image_writes_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            result = vm.generate_image("test", "user.eth", out_dir=tmp_path)
            img = tmp_path / f"{result['output_id']}.png"
            meta = tmp_path / f"{result['output_id']}.json"
            self.assertTrue(meta.exists())
            # image file only written if Pillow available
            if img.exists():
                self.assertTrue(img.is_file())
            data = json.loads(meta.read_text())
            self.assertEqual(data["wallet"], "user.eth")

    def test_build_avatar_returns_id(self):
        result = vm.build_avatar("user.eth")
        self.assertIn("avatar_id", result)


if __name__ == "__main__":
    unittest.main()
