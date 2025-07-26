import json
import hashlib
import tempfile
import unittest
from pathlib import Path

from vaultfire_securestore import SecureStore
from belief_trigger_engine import CHAIN_LOG_PATH, LOG_PATH
from geolock_filter import has_gps_exif


class SecureUploadTest(unittest.TestCase):
    def setUp(self):
        for p in (CHAIN_LOG_PATH, LOG_PATH):
            if p.exists():
                p.unlink()

    def test_encrypt_and_decrypt(self):
        with tempfile.TemporaryDirectory() as tmp:
            img_path = Path(tmp) / "test.bin"
            img_path.write_bytes(b"TESTGPSDATA")

            bucket = Path(tmp) / "bucket"
            store = SecureStore(b"0" * 32, bucket)
            meta = store.encrypt_and_store(
                img_path, "w1", "Spark", 11, chain_log=True
            )
            cid = meta["cid"]
            enc_file = bucket / f"{cid}.bin"
            self.assertTrue(enc_file.exists())
            decrypted = store.decrypt(cid, meta)
            self.assertFalse(has_gps_exif(decrypted))
            self.assertEqual(
                hashlib.sha256(decrypted).hexdigest(), meta["content_hash"]
            )
            chain = json.loads(CHAIN_LOG_PATH.read_text())[0]
            self.assertEqual(chain["wallet"], "w1")
            self.assertEqual(chain["timestamp"], meta["timestamp"])


if __name__ == "__main__":
    unittest.main()
