from __future__ import annotations

import json

from codex.integrity.auditor import AuditReport, run_full_forensic_audit


def test_run_full_forensic_audit_creates_artifacts(tmp_path):
    output_dir = tmp_path / "audit"
    report = run_full_forensic_audit("core", "standard", output_dir)

    assert isinstance(report, AuditReport)
    assert report.mode == "core"
    assert report.depth == "standard"
    assert report.modules_scanned > 0
    assert "status" in report.pytest_status

    assert report.log_path.exists()
    assert report.bundle_path.exists()

    summary_path = report.bundle_path / "summary.json"
    assert summary_path.exists()
    summary_data = json.loads(summary_path.read_text(encoding="utf-8"))
    assert summary_data["mode"] == "core"
    assert summary_data["depth"] == "standard"
    assert summary_data["findings"] == report.modules_scanned

    module_index_path = report.bundle_path / "module_index.json"
    assert module_index_path.exists()
    module_index = json.loads(module_index_path.read_text(encoding="utf-8"))
    assert isinstance(module_index, list)
    assert any(
        entry["path"].endswith("codex/integrity/auditor.py") for entry in module_index
    )

    bundle_log_copy = report.bundle_path / report.log_path.name
    assert bundle_log_copy.exists()
    assert bundle_log_copy.read_text(encoding="utf-8").strip()


def test_run_full_forensic_audit_accepts_hardcore_alias(tmp_path):
    output_dir = tmp_path / "alias_audit"
    report = run_full_forensic_audit("hardcore", "line_by_line", output_dir)

    assert report.mode == "hard"
