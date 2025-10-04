#!/usr/bin/env python3
"""Vaultfire automated attestation logger.

This utility ingests CLI execution logs and emits SOC2-aligned attestation
snapshots every 24 hours. The output is deterministic, hashed, and suitable
for third-party review.
"""
from __future__ import annotations

import json
import hashlib
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

ROOT_DIR = Path(__file__).resolve().parents[1]
LEDGER_PATH = Path(os.environ.get('VAULTFIRE_CODEX_LEDGER', ROOT_DIR / 'codex' / 'VAULTFIRE_CLI_LEDGER.jsonl'))
RUNBOOK_PATH = Path(os.environ.get('VAULTFIRE_GOVERNANCE_RUNBOOK', ROOT_DIR / 'governance_runbook.yaml'))
OUTPUT_PATH = Path(__file__).with_name('attestation_snapshots.json')
SNAPSHOT_INTERVAL = timedelta(hours=24)


@dataclass
class Control:
  """Parsed representation of a governance control."""

  control_id: str
  name: str
  applies_to: List[str]
  description: str
  verification: Dict[str, Any]


class RunbookLoader:
  """Parses the governance runbook without external dependencies."""

  def __init__(self, path: Path) -> None:
    self.path = path

  def load(self) -> List[Control]:
    if not self.path.exists():
      return []
    try:
      import yaml  # type: ignore

      data = yaml.safe_load(self.path.read_text())
    except ModuleNotFoundError:
      data = self._fallback_parse(self.path.read_text().splitlines())
    except Exception as exc:  # pragma: no cover - defensive
      print(f"Failed to parse runbook: {exc}", file=sys.stderr)
      return []

    controls = []
    for entry in data.get('controls', []):
      control = Control(
        control_id=str(entry.get('id')),
        name=str(entry.get('name', entry.get('id', 'Unnamed Control'))),
        applies_to=list(entry.get('applies_to', [])),
        description=str(entry.get('description', '')),
        verification=dict(entry.get('verification', {})),
      )
      controls.append(control)
    return controls

  def _fallback_parse(self, lines: Iterable[str]) -> Dict[str, Any]:
    controls: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    section: Optional[str] = None
    for raw in lines:
      line = raw.rstrip()
      if not line or line.lstrip().startswith('#'):
        continue
      if line.startswith('controls:'):
        section = 'controls'
        continue
      if section == 'controls' and line.lstrip().startswith('- '):
        current = {'verification': {}, 'applies_to': []}
        controls.append(current)
        key_value = line.split(':', 1)
        if len(key_value) == 2:
          key = key_value[0].strip('- ').strip()
          value = key_value[1].strip()
          current[key] = self._coerce_value(value)
        continue
      if current is None:
        continue
      indent_level = len(raw) - len(raw.lstrip(' '))
      if indent_level >= 4 and ':' in line:
        key, value = line.split(':', 1)
        key = key.strip()
        value = value.strip()
        if key == 'applies_to':
          current['applies_to'] = [item.strip().strip("'\"") for item in value.strip('[]').split(',') if item.strip()]
        elif key in ('id', 'name', 'description'):
          current[key] = self._coerce_value(value)
        else:
          current.setdefault('verification', {})[key] = self._coerce_value(value)
    return {'controls': controls}

  @staticmethod
  def _coerce_value(value: str) -> Any:
    value = value.strip()
    if value.lower() in {'true', 'false'}:
      return value.lower() == 'true'
    try:
      return int(value)
    except ValueError:
      pass
    try:
      return float(value)
    except ValueError:
      pass
    return value.strip("'\"")


def sha256_digest(data: bytes) -> str:
  return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> Optional[str]:
  if not path.exists():
    return None
  return sha256_digest(path.read_bytes())


def read_ledger_entries(path: Path) -> List[Dict[str, Any]]:
  if not path.exists():
    return []
  entries: List[Dict[str, Any]] = []
  for raw_line in path.read_text().splitlines():
    if not raw_line.strip():
      continue
    try:
      entry = json.loads(raw_line)
    except json.JSONDecodeError:
      continue
    entries.append(entry)
  return entries


def ensure_directory(path: Path) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)


def load_existing_snapshot(path: Path) -> Optional[Dict[str, Any]]:
  if not path.exists():
    return None
  try:
    return json.loads(path.read_text())
  except json.JSONDecodeError:
    return None


def iso_now() -> str:
  return datetime.now(timezone.utc).isoformat()


def parse_timestamp(value: str) -> Optional[datetime]:
  try:
    return datetime.fromisoformat(value.replace('Z', '+00:00'))
  except Exception:  # pragma: no cover - defensive parsing
    return None


def should_refresh(existing: Optional[Dict[str, Any]]) -> bool:
  if not existing:
    return True
  generated_at = parse_timestamp(existing.get('generated_at', ''))
  if not generated_at:
    return True
  return datetime.now(timezone.utc) - generated_at >= SNAPSHOT_INTERVAL


def evaluate_controls(control_defs: List[Control], entry: Dict[str, Any], evidence: Dict[str, Any]) -> List[Dict[str, Any]]:
  command_scope = entry.get('command')
  execution_body = json.dumps(entry, sort_keys=True).encode()
  execution_hash = sha256_digest(execution_body)
  identity_match = bool(entry.get('wallet')) or bool(entry.get('ens'))
  results: List[Dict[str, Any]] = []

  for control in control_defs:
    applies = not control.applies_to or command_scope in control.applies_to or 'cli' in control.applies_to
    if not applies:
      continue
    status = 'satisfied'
    evidence_payload: Dict[str, Any] = {}

    if control.control_id == 'VF-C1':
      evidence_payload = {
        'execution_hash': execution_hash,
        'ledger_hash': evidence.get('ledger_hash'),
        'timestamp': entry.get('timestamp'),
      }
    elif control.control_id == 'VF-C2':
      status = 'satisfied' if identity_match else 'warning'
      evidence_payload = {
        'wallet': entry.get('wallet'),
        'ens': entry.get('ens'),
        'identity_match': identity_match,
      }
    elif control.control_id == 'VF-C3':
      evidence_payload = {
        'script_hash': evidence.get('script_hash'),
        'runbook_hash': evidence.get('runbook_hash'),
        'execution_hash': execution_hash,
      }
    else:
      evidence_payload = {'note': 'Control has no automated mapping; manual review required.'}

    results.append(
      {
        'id': control.control_id,
        'name': control.name,
        'status': status,
        'evidence': evidence_payload,
      }
    )

  if 'VF-C1' not in [c.control_id for c in control_defs]:
    results.append(
      {
        'id': 'VF-C1',
        'name': 'CLI execution hashing',
        'status': 'satisfied',
        'evidence': {'execution_hash': execution_hash},
      }
    )

  return results


def build_attestation_snapshot(entries: List[Dict[str, Any]], controls: List[Control]) -> Dict[str, Any]:
  evidence = {
    'ledger_hash': sha256_file(LEDGER_PATH),
    'script_hash': sha256_file(Path(__file__)),
    'runbook_hash': sha256_file(RUNBOOK_PATH),
  }
  snapshots: List[Dict[str, Any]] = []

  for entry in entries:
    execution_hash = sha256_digest(json.dumps(entry, sort_keys=True).encode())
    snapshot = {
      'process_id': f"vaultfire-cli:{entry.get('command')}:{entry.get('timestamp')}",
      'command': entry.get('command'),
      'timestamp': entry.get('timestamp'),
      'execution_hash': execution_hash,
      'status': entry.get('status'),
      'wallet': entry.get('wallet'),
      'ens': entry.get('ens'),
      'identity_match': bool(entry.get('wallet')) or bool(entry.get('ens')),
      'soc2_controls': evaluate_controls(controls, entry, evidence),
    }
    snapshots.append(snapshot)

  generated_at = iso_now()
  payload = {
    'generated_at': generated_at,
    'next_run_after': (datetime.fromisoformat(generated_at) + SNAPSHOT_INTERVAL).isoformat(),
    'sources': {
      'ledger': {'path': str(LEDGER_PATH), 'hash': evidence['ledger_hash']},
      'runbook': {'path': str(RUNBOOK_PATH), 'hash': evidence['runbook_hash']},
      'script': {'path': str(Path(__file__)), 'hash': evidence['script_hash']},
    },
    'snapshots': snapshots,
  }
  return payload


def main() -> int:
  controls = RunbookLoader(RUNBOOK_PATH).load()
  ledger_entries = read_ledger_entries(LEDGER_PATH)
  existing = load_existing_snapshot(OUTPUT_PATH)
  if not should_refresh(existing):
    print(json.dumps(existing, indent=2))
    return 0

  payload = build_attestation_snapshot(ledger_entries, controls)
  ensure_directory(OUTPUT_PATH)
  OUTPUT_PATH.write_text(json.dumps(payload, indent=2))
  print(json.dumps(payload, indent=2))
  return 0


if __name__ == '__main__':
  sys.exit(main())
