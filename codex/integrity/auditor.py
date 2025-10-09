"""Forensic audit tooling for the Vaultfire Codex."""
from __future__ import annotations

import ast
import datetime as dt
import hashlib
import json
import os
import shutil
import subprocess
import textwrap
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, List, Sequence

ALLOWED_MODES = {"core", "hard", "ultra"}
ALLOWED_DEPTHS = {"shallow", "standard", "line_by_line"}

# ``hardcore`` has historically been used as an alias for ``hard`` when invoking
# the audit from external tooling. Supporting the alias avoids breaking
# downstream scripts while still normalizing to the canonical mode values.
MODE_ALIASES = {"hardcore": "hard"}


@dataclass(slots=True)
class ModuleAuditFinding:
    """Structured result for a single module inspection."""

    path: str
    function_signatures: List[Dict[str, object]]
    imports: List[str]
    classes: List[str]
    cli_bindings: List[str]
    json_schema_links: List[str]
    smart_wallet_integrity: Dict[str, object]
    mirror_routing_logic: Dict[str, object]
    dependency_chain: List[str]
    line_metrics: Dict[str, object]
    notes: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, object]:
        data = asdict(self)
        data["path"] = self.path
        return data


@dataclass(slots=True)
class AuditReport:
    """Aggregate metadata for a full forensic audit run."""

    mode: str
    depth: str
    timestamp: str
    log_path: Path
    bundle_path: Path
    modules_scanned: int
    pytest_status: Dict[str, object]
    fix_flag_enabled: bool
    findings: Sequence[ModuleAuditFinding]
    fallback_actions: List[str] = field(default_factory=list)

    def to_dict(self, include_findings: bool = False) -> Dict[str, object]:
        payload = {
            "mode": self.mode,
            "depth": self.depth,
            "timestamp": self.timestamp,
            "log_path": str(self.log_path),
            "bundle_path": str(self.bundle_path),
            "modules_scanned": self.modules_scanned,
            "pytest_status": self.pytest_status,
            "fix_flag_enabled": self.fix_flag_enabled,
            "fallback_actions": self.fallback_actions,
        }
        if include_findings:
            payload["findings"] = [finding.to_dict() for finding in self.findings]
        else:
            payload["findings"] = len(self.findings)
        return payload


def run_full_forensic_audit(
    mode: str,
    depth: str,
    output: str | os.PathLike[str],
    *,
    fix: bool = False,
) -> AuditReport:
    """Execute a full forensic inspection of the Vaultfire Codex stack.

    The audit inspects all known Codex modules, records structured findings,
    and emits both machine-readable logs and a human-readable diagnostic bundle.
    The ``fix`` flag is accepted for future auto-repair workflows but is
    currently informational only.
    """

    normalized_mode = mode.lower()
    normalized_mode = MODE_ALIASES.get(normalized_mode, normalized_mode)
    normalized_depth = depth.lower()
    if normalized_mode not in ALLOWED_MODES:
        allowed = ", ".join(sorted(ALLOWED_MODES))
        raise ValueError(f"Unsupported audit mode '{mode}'. Expected one of: {allowed}.")
    if normalized_depth not in ALLOWED_DEPTHS:
        allowed = ", ".join(sorted(ALLOWED_DEPTHS))
        raise ValueError(f"Unsupported audit depth '{depth}'. Expected one of: {allowed}.")

    repo_root = Path(__file__).resolve().parents[2]
    codex_root = repo_root / "codex"
    vaultfire_codex_root = repo_root / "vaultfire_codex"
    module_paths = _discover_modules([codex_root, vaultfire_codex_root], repo_root)

    timestamp = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    logs_dir = repo_root / "audit_logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    slug = timestamp.replace(":", "-")
    log_path = logs_dir / f"vaultfire_forensic_{normalized_mode}_{normalized_depth}_{slug}.jsonl"

    output_root = Path(output)
    bundle_dir = output_root / "diagnostic_bundle"
    bundle_dir.mkdir(parents=True, exist_ok=True)

    findings: List[ModuleAuditFinding] = []
    with log_path.open("w", encoding="utf-8") as log_file:
        for module_path in module_paths:
            finding = _inspect_module(module_path, normalized_depth, repo_root)
            findings.append(finding)
            json.dump(finding.to_dict(), log_file, sort_keys=True)
            log_file.write("\n")

    pytest_status, fallback_actions = _execute_pytest(repo_root)

    report = AuditReport(
        mode=normalized_mode,
        depth=normalized_depth,
        timestamp=timestamp,
        log_path=log_path,
        bundle_path=bundle_dir,
        modules_scanned=len(findings),
        pytest_status=pytest_status,
        fix_flag_enabled=fix,
        findings=findings,
        fallback_actions=fallback_actions,
    )

    _write_human_bundle(report, findings)

    return report


def _discover_modules(candidate_roots: Sequence[Path], repo_root: Path) -> List[Path]:
    modules: List[Path] = []
    for root in candidate_roots:
        if not root.exists():
            continue
        modules.extend(sorted(p for p in root.rglob("*.py") if p.is_file()))
    # Ensure deterministic ordering across runs by sorting by relative path.
    modules.sort(key=lambda p: str(p.relative_to(repo_root)))
    return modules


def _inspect_module(path: Path, depth: str, repo_root: Path) -> ModuleAuditFinding:
    relative_path = str(path.relative_to(repo_root))
    source = path.read_text(encoding="utf-8")
    notes: List[str] = []
    errors: List[str] = []

    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        errors.append(
            f"syntax_error:{exc.msg} (line {exc.lineno}, column {exc.offset})"
        )
        return ModuleAuditFinding(
            path=relative_path,
            function_signatures=[],
            imports=[],
            classes=[],
            cli_bindings=[],
            json_schema_links=[],
            smart_wallet_integrity={"status": "unparsable", "references": 0},
            mirror_routing_logic={"status": "unparsable", "references": 0},
            dependency_chain=[],
            line_metrics=_line_metrics(source),
            notes=notes,
            errors=errors,
        )

    functions = _collect_function_signatures(tree)
    imports = _collect_imports(tree)
    classes = sorted({node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)})
    json_links = _collect_json_links(tree)
    cli_bindings = _detect_cli_bindings(source, imports)

    if not functions:
        notes.append("no_functions_detected")
    if not classes:
        notes.append("no_classes_detected")

    smart_wallet = _evaluate_keyword_presence(source, "wallet", depth)
    mirror_logic = _evaluate_keyword_presence(source, "mirror", depth)

    dependency_chain = imports.copy()

    return ModuleAuditFinding(
        path=relative_path,
        function_signatures=functions,
        imports=imports,
        classes=classes,
        cli_bindings=cli_bindings,
        json_schema_links=json_links,
        smart_wallet_integrity=smart_wallet,
        mirror_routing_logic=mirror_logic,
        dependency_chain=dependency_chain,
        line_metrics=_line_metrics(source),
        notes=notes,
        errors=errors,
    )


def _collect_function_signatures(tree: ast.AST) -> List[Dict[str, object]]:
    signatures: List[Dict[str, object]] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            signatures.append(
                {
                    "name": node.name,
                    "async": isinstance(node, ast.AsyncFunctionDef),
                    "lineno": node.lineno,
                    "args": _format_arguments(node.args),
                }
            )
    signatures.sort(key=lambda entry: (entry["lineno"], entry["name"]))
    return signatures


def _format_arguments(args: ast.arguments) -> Dict[str, List[str]]:
    positional = [arg.arg for arg in args.posonlyargs + args.args]
    keyword_only = [arg.arg for arg in args.kwonlyargs]
    vararg = args.vararg.arg if args.vararg else None
    kwarg = args.kwarg.arg if args.kwarg else None
    defaults = len(args.defaults)
    kw_defaults = [value is not None for value in args.kw_defaults]
    return {
        "positional": positional,
        "keyword_only": keyword_only,
        "vararg": vararg,
        "kwarg": kwarg,
        "defaults": defaults,
        "kw_defaults": kw_defaults,
    }


def _collect_imports(tree: ast.AST) -> List[str]:
    imports: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if module:
                imports.add(module)
    return sorted(imports)


def _collect_json_links(tree: ast.AST) -> List[str]:
    links: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            value = node.value
            if value.endswith(".json"):
                links.add(value)
    return sorted(links)


def _detect_cli_bindings(source: str, imports: List[str]) -> List[str]:
    bindings: List[str] = []
    lowered_source = source.lower()
    if "click" in imports or "@click.command" in lowered_source:
        bindings.append("click")
    if "typer" in imports or "@typer.command" in lowered_source:
        bindings.append("typer")
    if "argparse" in imports or "argumentparser" in lowered_source:
        bindings.append("argparse")
    if "fire" in imports or "fire.cli" in lowered_source:
        bindings.append("fire")
    return sorted(set(bindings))


def _evaluate_keyword_presence(source: str, keyword: str, depth: str) -> Dict[str, object]:
    hits: List[Dict[str, object]] = []
    keyword_lower = keyword.lower()
    for index, line in enumerate(source.splitlines(), start=1):
        if keyword_lower in line.lower():
            hits.append({"line": index, "context": line.strip()})
    status = "referenced" if hits else "not_detected"
    if depth == "shallow":
        return {"status": status, "references": len(hits)}
    return {
        "status": status,
        "references": len(hits),
        "locations": hits,
    }


def _line_metrics(source: str) -> Dict[str, object]:
    lines = source.splitlines()
    non_empty = sum(1 for line in lines if line.strip())
    return {
        "line_count": len(lines),
        "non_empty": non_empty,
        "sha256": hashlib.sha256(source.encode("utf-8")).hexdigest(),
    }


def _execute_pytest(repo_root: Path) -> tuple[Dict[str, object], List[str]]:
    fallback_actions: List[str] = []
    if os.environ.get("PYTEST_CURRENT_TEST"):
        status = {
            "status": "skipped",
            "reason": "nested_pytest_invocation_detected",
        }
        fallback_actions.append("integrity_mirror")
        return status, fallback_actions

    try:
        completed = subprocess.run(
            ["pytest", "--maxfail=1", "-q"],
            cwd=repo_root,
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        fallback_actions.append("integrity_mirror")
        return {
            "status": "unavailable",
            "reason": "pytest_not_found",
        }, fallback_actions

    stdout_digest = hashlib.sha256(completed.stdout.encode("utf-8")).hexdigest()
    stderr_digest = hashlib.sha256(completed.stderr.encode("utf-8")).hexdigest()
    status = {
        "status": "passed" if completed.returncode == 0 else "failed",
        "returncode": completed.returncode,
        "stdout_digest": stdout_digest,
        "stderr_digest": stderr_digest,
    }
    if completed.returncode != 0:
        fallback_actions.append("integrity_mirror")
        status["stdout_tail"] = completed.stdout.strip().splitlines()[-10:]
        status["stderr_tail"] = completed.stderr.strip().splitlines()[-10:]
    return status, fallback_actions


def _write_human_bundle(report: AuditReport, findings: Sequence[ModuleAuditFinding]) -> None:
    report_summary_path = report.bundle_path / "summary.json"
    with report_summary_path.open("w", encoding="utf-8") as summary_file:
        json.dump(report.to_dict(include_findings=False), summary_file, indent=2)

    summary_text = textwrap.dedent(
        f"""
        Vaultfire Codex Forensic Audit
        Timestamp: {report.timestamp}
        Mode: {report.mode}
        Depth: {report.depth}
        Modules scanned: {report.modules_scanned}
        Pytest status: {report.pytest_status['status']}
        Fix flag scaffolded: {report.fix_flag_enabled}
        Fallback actions: {', '.join(report.fallback_actions) or 'none'}
        Log file: {report.log_path}
        """
    ).strip()

    with (report.bundle_path / "summary.txt").open("w", encoding="utf-8") as text_file:
        text_file.write(summary_text + "\n")

    module_index = [
        {
            "path": finding.path,
            "functions": len(finding.function_signatures),
            "imports": len(finding.imports),
            "classes": len(finding.classes),
            "cli_bindings": finding.cli_bindings,
            "json_schema_links": finding.json_schema_links,
            "smart_wallet_status": finding.smart_wallet_integrity["status"],
            "mirror_status": finding.mirror_routing_logic["status"],
            "notes": finding.notes,
            "errors": finding.errors,
        }
        for finding in findings
    ]

    with (report.bundle_path / "module_index.json").open("w", encoding="utf-8") as index_file:
        json.dump(module_index, index_file, indent=2)

    # Provide a local copy of the raw log inside the bundle for convenience.
    shutil.copy2(report.log_path, report.bundle_path / report.log_path.name)
