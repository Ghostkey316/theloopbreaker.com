import json
import os
import tempfile
import unittest
from pathlib import Path

from partner_plugins import partner_protocol_shell as pps


class ProtocolShellTest(unittest.TestCase):
    def test_setup_and_sync(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.environ["PARTNER_PROTOCOL_DIR"] = tmp
            pps.TESTBED_DIR = Path(tmp)
            cfg = pps.setup_shell(
                "Vaultfire_v27.2",
                "Ghostkey-316",
                "ghostkey316.eth",
                "bpow20.cb.id",
            )
            tb = Path(tmp) / "Ghostkey-316_Vaultfire_v27.2"
            self.assertTrue(tb.exists())
            data = json.loads((tb / "partner_shell_config.json").read_text())
            self.assertTrue(data["plugin_ready"])
            pps.sync_echo(tb)
            self.assertTrue((tb / "echo_synced").exists())
            pps.register_fallback(tb, "https://remote.example")
            fb = json.loads((tb / "remote_fallback.json").read_text())
            self.assertEqual(fb["endpoint"], "https://remote.example")
            del os.environ["PARTNER_PROTOCOL_DIR"]


if __name__ == "__main__":
    unittest.main()
