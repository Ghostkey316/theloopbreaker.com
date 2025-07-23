#!/usr/bin/env python3
"""Basic static validation across Vaultfire Python modules."""
from __future__ import annotations

import ast
import json
import os
from pathlib import Path
from typing import Dict, List, Set

REPO_ROOT = Path(__file__).resolve().parent


def gather_python_files() -> list[Path]:
    files = []
    for path in REPO_ROOT.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        if path.name == "python_system_validate.py":
            continue
        files.append(path)
    return files


def check_syntax(path: Path):
    try:
        text = path.read_text()
        ast.parse(text)
        return None
    except SyntaxError as e:
        return f"{e.msg} at line {e.lineno}"


def collect_imports(tree: ast.AST) -> list[str]:
    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.append(node.module)
    return imports


def check_suspicious(tree: ast.AST) -> list[str]:
    alerts: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Name) and func.id in {"eval", "exec"}:
                alerts.append(f"use of {func.id}()")
            elif isinstance(func, ast.Attribute) and func.attr in {"system", "popen"}:
                alerts.append(f"subprocess call {func.attr}()")
    return alerts


def build_graph(files: list[Path]):
    graph: dict[str, list[str]] = {}
    syntax_errors: dict[str, str] = {}
    suspicious: dict[str, list[str]] = {}
    for path in files:
        text = path.read_text()
        try:
            tree = ast.parse(text)
        except SyntaxError as e:
            syntax_errors[str(path)] = f"{e.msg} at line {e.lineno}"
            continue
        imports = collect_imports(tree)
        graph[str(path)] = [imp for imp in imports]
        alert = check_suspicious(tree)
        if alert:
            suspicious[str(path)] = alert
    return graph, syntax_errors, suspicious


def detect_cycles(graph: dict[str, list[str]]):
    cycles: list[list[str]] = []
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node: str, stack: list[str]):
        if node in visiting:
            cycle = stack[stack.index(node):] + [node]
            cycles.append(cycle)
            return
        if node in visited:
            return
        visiting.add(node)
        for neighbor in graph.get(node, []):
            # only check cycles within repo modules
            neighbor_path = REPO_ROOT / (neighbor.replace(".", "/") + ".py")
            if neighbor_path.exists():
                visit(str(neighbor_path), stack + [str(neighbor_path)])
        visiting.remove(node)
        visited.add(node)

    for node in graph:
        visit(node, [node])
    return cycles


def main() -> int:
    files = gather_python_files()
    graph, syntax_errors, suspicious = build_graph(files)
    cycles = detect_cycles(graph)
    report = {
        "modules_checked": len(files),
        "syntax_errors": syntax_errors,
        "suspicious_ops": suspicious,
        "cycles": cycles,
    }
    print(json.dumps(report, indent=2))
    issues = syntax_errors or suspicious or cycles
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
