import json
import unittest
import tempfile
from pathlib import Path
import importlib
import os

ar = importlib.import_module("vaultfire.refund.auto_refund")


class AutoRefundTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.audit = base / "audit.json"
        self.tx = base / "tx.json"
        self.state = base / "state.json"
        self.badge = base / "badge.json"
        self.rbac = base / "rbac.json"
        # redirect module level paths
        ar.AUDIT_LOG_PATH = self.audit
        ar.TX_LOG_PATH = self.tx
        ar.STATE_PATH = self.state
        ar.BADGE_PATH = self.badge
        import vaultfire.access.rbac as rbac
        rbac.RBAC_PATH = self.rbac
        rbac.save_roles({"admin": "Admin"})
        os.environ["VAULTFIRE_OVERRIDE_KEY"] = "testkey"

    def tearDown(self):
        self.tmp.cleanup()

    def test_mock_error_503_triggers_refund(self):
        result = ar.auto_refund(
            "user1",
            "mock_error_503",
            admin_override=True,
            user_id="admin",
            override_key=os.environ.get("VAULTFIRE_OVERRIDE_KEY", "testkey"),
        )
        self.assertEqual(result["status"], "success")
        audit = json.loads(self.audit.read_text())
        self.assertEqual(audit[0]["wallet"], "user1")
        tx = json.loads(self.tx.read_text())
        self.assertEqual(tx[0]["wallet"], "user1")
        badge = json.loads(self.badge.read_text())
        self.assertIn("user1", badge)


if __name__ == "__main__":
    unittest.main()
