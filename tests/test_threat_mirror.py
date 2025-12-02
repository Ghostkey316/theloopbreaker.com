from pathlib import Path

from vaultfire.quantum.sovereign_layer import ThreatMirrorLoop


def test_threat_mirror_detects_tampering(tmp_path):
    module_path = tmp_path / "critical_module.py"
    module_path.write_text("SAFE=1\n")

    mirror = ThreatMirrorLoop(tmp_path / "threat_report.json")
    baseline = mirror.generate_baseline([module_path])

    module_path.write_text("SAFE=0\n")
    report = mirror.scan([module_path], baseline)

    assert report["lockdown"] is True
    assert str(module_path) in report["tampered"]
    assert report["moral_checksum"].startswith("poseidon-")
    assert Path(mirror.report_path).exists()
