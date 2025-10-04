"""Streamlit dashboard to visualize reward streams and compliance attestations."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
ATTESTATION_PATH = ROOT / 'compliance' / 'attestation_snapshots.json'
LEDGER_PATH = ROOT / 'codex' / 'VAULTFIRE_CLI_LEDGER.jsonl'


def load_attestations() -> Dict[str, Any]:
  if not ATTESTATION_PATH.exists():
    return {'generated_at': None, 'snapshots': []}
  return json.loads(ATTESTATION_PATH.read_text())


def load_ledger() -> List[Dict[str, Any]]:
  if not LEDGER_PATH.exists():
    return []
  entries: List[Dict[str, Any]] = []
  for raw in LEDGER_PATH.read_text().splitlines():
    if not raw.strip():
      continue
    try:
      entries.append(json.loads(raw))
    except json.JSONDecodeError:
      continue
  return entries


def main() -> None:
  st.set_page_config(page_title='Vaultfire Reward & Compliance Monitor', layout='wide')
  st.title('Vaultfire Reward Streams & Compliance Attestations')

  attestations = load_attestations()
  ledger = load_ledger()

  col1, col2, col3 = st.columns(3)
  col1.metric('Ledger Entries', f"{len(ledger):,}")
  col2.metric('Attestation Snapshots', f"{len(attestations.get('snapshots', [])):,}")
  generated_at = attestations.get('generated_at')
  if generated_at:
    timestamp = datetime.fromisoformat(generated_at.replace('Z', '+00:00'))
    col3.metric('Last Snapshot (UTC)', timestamp.strftime('%Y-%m-%d %H:%M:%S'))
  else:
    col3.metric('Last Snapshot (UTC)', 'N/A')

  st.subheader('Latest Attestation Entries')
  snapshots = attestations.get('snapshots', [])
  if snapshots:
    st.dataframe(
      [
        {
          'Process': snap.get('process_id'),
          'Command': snap.get('command'),
          'Timestamp': snap.get('timestamp'),
          'Status': snap.get('status'),
          'Identity Verified': snap.get('identity_match'),
        }
        for snap in snapshots[-25:]
      ]
    )
  else:
    st.info('No attestation snapshots available yet. Run compliance/auto_attestation.py to generate one.')

  st.subheader('SOC2 Control Evidence')
  if snapshots:
    control_rows = []
    for snap in snapshots[-25:]:
      for control in snap.get('soc2_controls', []):
        control_rows.append(
          {
            'Process': snap.get('process_id'),
            'Control': f"{control.get('id')} — {control.get('name')}",
            'Status': control.get('status'),
            'Evidence': json.dumps(control.get('evidence', {}), indent=2),
          }
        )
    if control_rows:
      st.dataframe(control_rows)
    else:
      st.info('Controls present but no evidence captured. Ensure auto_attestation.py has run against populated logs.')
  else:
    st.info('Generate an attestation snapshot to review control evidence.')

  st.subheader('Raw Ledger (Last 50 Entries)')
  if ledger:
    st.code('\n'.join(json.dumps(entry, indent=2) for entry in ledger[-50:]))
  else:
    st.info('No CLI ledger entries recorded yet.')


if __name__ == '__main__':
  main()
