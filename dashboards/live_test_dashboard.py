"""Streamlit dashboard for live telemetry visibility."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import streamlit as st

LOG_PATH = Path(__file__).resolve().parents[1] / "logs" / "pilot_live_metrics.json"
TRACE_LOG = Path(__file__).resolve().parents[1] / "logs" / "live_pilot_traces.log"

st.set_page_config(page_title="Vaultfire Live Pilot Dashboard", layout="wide")
st.title("Vaultfire Live Pilot Dashboard")

st.sidebar.header("Telemetry Controls")
refresh_rate = st.sidebar.slider("Auto-refresh (seconds)", min_value=5, max_value=120, value=30, step=5)


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        try:
            return json.load(handle)
        except json.JSONDecodeError:
            return {}


def load_recent_traces(limit: int = 25) -> list[str]:
    if not TRACE_LOG.exists():
        return []
    lines = TRACE_LOG.read_text(encoding="utf-8").strip().splitlines()
    return list(reversed([line for line in lines if line.strip()]))[:limit]


summary = load_json(LOG_PATH)
if not summary:
    st.warning("No telemetry summary found yet. Trigger an activation flow to populate metrics.")
else:
    meta_col, totals_col = st.columns(2)
    meta_col.metric("Last Export", summary.get("last_exported_at", "unknown"))
    totals = summary.get("event_totals", {})
    totals_col.metric("Tracked Event Types", len(totals))

    st.subheader("Event Totals")
    st.json(totals)

    st.subheader("Recent Trace Identifiers")
    st.write(summary.get("recent_traces", []))

st.sidebar.write("Last refresh: ", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%SZ"))
st.sidebar.info("Telemetry summaries auto-publish every 24h or faster if configured.")
st.sidebar.code(f"Refresh every {refresh_rate} seconds")

recent_logs = load_recent_traces()
if recent_logs:
    st.subheader("Raw Trace Log (latest 25 entries)")
    for entry in recent_logs:
        st.code(entry)
else:
    st.info("Trace log is empty. Once the pilot is running, traces will appear here.")
