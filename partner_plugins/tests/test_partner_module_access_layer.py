import json
import tempfile
import unittest
from pathlib import Path

from enable_partner_module_access_layer import enable_partner_module_access_layer


class PartnerAccessLayerTest(unittest.TestCase):
    def test_enable_creates_config_and_log(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base / "vaultfire-core").mkdir()
            (base / "partner_modules").mkdir()
            (base / "dashboards").mkdir()
            (base / "vaultfire-core" / "vaultfire_config.json").write_text("{}")
            result = enable_partner_module_access_layer(base)

            cfg = json.loads((base / "vaultfire-core" / "vaultfire_config.json").read_text())
            self.assertTrue(cfg.get("partner_module_access_layer"))

            modules = json.loads((base / "partner_modules" / "edge_opt_in.json").read_text())
            self.assertEqual(len(modules), 5)
            self.assertTrue(all(m["trust_tag"] == "Edge Mode: Declared" for m in modules))

            log = json.loads((base / "dashboards" / "partner_opt_in_log.json").read_text())
            self.assertEqual(log[-1]["modules"], [m["name"] for m in modules])
            self.assertIn("config", result)


if __name__ == "__main__":
    unittest.main()
