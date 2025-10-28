from __future__ import annotations

import hashlib
import os
from typing import Any, Iterable

import requests
import streamlit as st
from plotly.graph_objects import Figure, Heatmap, Histogram
from plotly.subplots import make_subplots

from services.symbiotic_sentience_interface import BASELINE_GRADIENT, SymbioticSentienceInterface, encrypt
from sim_pilots.pilot_resonance_telemetry import PilotResonanceTelemetry
from utils import live_oracle
from vaultfire.protocol.constants import MISSION_STATEMENT
CACHE_TTL = 60
if not hasattr(live_oracle, "emit"):
    def _emit(cid: str, zk_hash: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        client = live_oracle.get_live_oracle()
        if hasattr(client, "emit_event"):
            return client.emit_event(cid, zk_hash, context=context)
        return {"tx_hash": getattr(client, "sandbox_tx", "base::sandbox")}

    live_oracle.emit = _emit  # type: ignore[attr-defined]


def _cache_data(ttl: int):
    try:
        return st.cache_data(ttl=ttl, show_spinner=False)
    except AttributeError:  # pragma: no cover - streamlit fallback
        return lambda func: func
@_cache_data(ttl=CACHE_TTL)
def load_live_health(api_url: str | None = None) -> dict[str, Any]:
    base_url = (api_url or os.getenv("VAULTFIRE_API", "http://localhost:5000")).rstrip("/")
    try:
        resp = requests.get(f"{base_url}/health/live_oracles", timeout=5)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        client = live_oracle.get_live_oracle()
        return client.health_status() if hasattr(client, "health_status") else {"status": "unreachable"}
@_cache_data(ttl=CACHE_TTL)
def load_loyalty_summary(pilot: PilotResonanceTelemetry, samples: int = 6) -> list[dict[str, Any]]:
    return pilot.end_to_end_test(num_iters=max(1, samples))
def ensure_oracle_emit(cid: str, zk_hash: str, *, context: dict[str, Any] | None = None) -> dict[str, Any]:
    return live_oracle.emit(cid, zk_hash, context=context)
def build_interactive_viz(results: Iterable[dict[str, Any]]) -> Figure | None:
    rows = list(results)
    if not rows:
        return None
    wallets = [str(r.get("wallet", "unknown")) for r in rows]; scores = [float(r.get("score", 0.0)) for r in rows]
    uplifts = [float(r.get("uplift", 0.0)) for r in rows]; statuses = [str(r.get("status", "unknown")) for r in rows]
    fig = make_subplots(rows=1, cols=2, subplot_titles=("Resonance Scores", "Score vs Uplift"))
    colors = [ {"attested": "#8F54FF", "blocked": "#FF6B6B"}.get(status, "#4B4E6D") for status in statuses ]
    fig.add_trace(Histogram(x=scores, marker=dict(color=colors), hovertext=[f"Wallet: {w}<br>Status: {s}" for w, s in zip(wallets, statuses)], name="Scores"), row=1, col=1)
    fig.add_trace(Heatmap(x=scores, y=wallets, z=[[uplifts[i] if j == i else None for j in range(len(scores))] for i in range(len(uplifts))], colorscale="Viridis", name="Uplift"), row=1, col=2)
    fig.update_layout(template="plotly_dark", bargap=0.1)
    return fig
def main() -> None:
    st.set_page_config(page_title="Vaultfire ERV Pilots", layout="wide")
    pilot = PilotResonanceTelemetry(MISSION_STATEMENT); interface = SymbioticSentienceInterface(MISSION_STATEMENT)
    live_default = os.getenv("LIVE_MODE", "").lower() in {"1", "true", "yes", "on"}
    live_mode = bool(st.sidebar.toggle("Live Mode", value=live_default))
    os.environ["LIVE_MODE"] = "1" if live_mode else "0"
    st.sidebar.caption("Live Oracle Health"); st.sidebar.json(load_live_health())
    erv_tab, loyalty_tab, live_tab = st.tabs(["ERV Sim", "Loyalty Pilot", "Live Emit"])
    with erv_tab:
        sim_wallet = st.text_input("Pilot Wallet", "0xPILOT"); hrv = st.slider("Heart Rate Variability", 0.4, 1.0, 0.72, 0.01)
        arousal = st.selectbox("Arousal State", ("calm", "neutral", "stress"), index=0)
        score, cipher = pilot.run_erv_simulation({"wallet": sim_wallet or "0xPILOT", "hrv": hrv, "arousal": arousal})
        st.metric("Resonance Score", f"{score:.2f}"); st.code(cipher, language="text")
        viz = build_interactive_viz(load_loyalty_summary(pilot))
        if viz:
            st.plotly_chart(viz, use_container_width=True)
        st.caption("Interactive loyalty telemetry derived from ERV pilots.")
    with loyalty_tab:
        loyalty_wallet = st.text_input("Wallet Address", "0xLOYAL", key="loyal_wallet")
        score, _ = pilot.run_erv_simulation(pilot.fetch_mock_bio_data(loyalty_wallet or "0xLOYAL"))
        st.metric("Projected Loyalty XP Uplift", f"{score * 1.5:.2f} XP")
        st.dataframe(load_loyalty_summary(pilot, samples=8))
    with live_tab:
        live_wallet = st.text_input("Live Wallet", "0xLIVE", key="live_wallet")
        if st.button("Forge Neural Covenant"):
            intent = interface.capture_neural_intent(live_wallet or "0xLIVE")
            tuned = interface.co_evolve_moral_gradient(intent, BASELINE_GRADIENT)
            proof = str(intent["proof"]); payload = f"{tuned:.6f}|{proof}"
            cipher = encrypt(payload); zk_hash = cipher.hex() if isinstance(cipher, (bytes, bytearray)) else str(cipher)
            cid = hashlib.sha256(f"{interface.mission_anchor}:{proof}".encode("utf-8")).hexdigest()
            oracle = ensure_oracle_emit(cid, zk_hash, context={"gradient": tuned, "channel": "demo"})
            tx_hash = interface.forge_neural_covenant(tuned, proof)
            st.success(f"Tx {tx_hash} • CID {cid}"); st.json({"oracle": oracle, "intent": intent, "gradient": tuned})


if __name__ == "__main__":
    main()
