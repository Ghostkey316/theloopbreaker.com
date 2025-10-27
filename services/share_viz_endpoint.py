"""Lightweight API to share ERV visualizations via IPFS + ZK stubs."""

from __future__ import annotations

import hashlib
import json
import random
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Generator

from flask import Flask, Response, abort, jsonify, request, stream_with_context

try:  # pragma: no cover - optional dependency during tests
    import ipfshttpclient  # type: ignore
except ImportError:  # pragma: no cover - graceful fallback
    ipfshttpclient = None  # type: ignore

from vaultfire.protocol.constants import MISSION_STATEMENT

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SIM_PILOT_PATH = PROJECT_ROOT / "sim-pilots"

if str(SIM_PILOT_PATH) not in sys.path:
    sys.path.append(str(SIM_PILOT_PATH))

try:  # pragma: no cover - exercised in production environments
    from pilot_resonance_telemetry import PilotResonanceTelemetry  # type: ignore  # noqa: E402
except ModuleNotFoundError:  # pragma: no cover - lightweight test fallback
    class PilotResonanceTelemetry:  # type: ignore[override]
        """Minimal telemetry stub when rich viz dependencies are unavailable."""

        def __init__(self, mission_anchor: str, *, consent: bool = True) -> None:
            self.mission_anchor = mission_anchor
            self.consent = consent

        def fetch_mock_bio_data(self, user_wallet: str) -> dict[str, Any]:
            return {
                "wallet": user_wallet,
                "hrv": 0.82,
                "arousal": "calm",
                "timestamp": "stub",
            }

        def run_erv_simulation(self, bio_data: dict[str, Any]) -> tuple[float, str]:
            return 0.78, "fhe::encrypted::stub"

        def simulate_cascade(self, score: float, encrypted_res: str) -> bool:
            _ = encrypted_res
            return score > 0.7

        def end_to_end_test(self, num_iters: int = 6) -> list[dict[str, Any]]:
            return [
                {
                    "wallet": f"0x{idx:04X}",
                    "score": 0.5,
                    "uplift": 0.1,
                    "status": "attested",
                }
                for idx in range(num_iters)
            ]

        def interactive_viz(self, results: list[dict[str, Any]]) -> None:  # noqa: D401
            _ = results

app = Flask(__name__)

TelemetryClass = PilotResonanceTelemetry
PINNED_VIZ: Dict[str, Dict[str, Any]] = {}


def _connect_ipfs():
    """Create an IPFS client if available, otherwise return ``None``."""

    if ipfshttpclient is None:
        return None
    try:  # pragma: no cover - relies on external daemon
        return ipfshttpclient.connect()  # type: ignore[attr-defined]
    except Exception:  # pragma: no cover - fallback when IPFS not running
        return None


def _generate_cid(content: str) -> str:
    """Generate a deterministic CID-like hash for pinned artifacts."""

    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
    return f"Qm{digest[:44]}"


def _compute_zk_hash(results: list[dict[str, Any]], wallet_id: str, auth_hash: str) -> str:
    """Compute a zero-knowledge proof stub anchoring viz integrity."""

    payload = json.dumps(
        {"results": results, "wallet": wallet_id, "auth": auth_hash},
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _pin_artifacts(
    *,
    wallet_id: str,
    mission_anchor: str,
    results: list[dict[str, Any]],
    auth_hash: str,
) -> tuple[str, str]:
    """Persist visualization artifacts locally while mimicking IPFS pinning."""

    viz_json = json.dumps(
        {"mission_anchor": mission_anchor, "results": results},
        sort_keys=True,
    )
    viz_html = (
        "<html><body><h1>ERV Resonance Dashboard</h1><pre>"
        f"{json.dumps(results, indent=2)}</pre></body></html>"
    )

    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".html") as handle:
        handle.write(viz_html)
        temp_path = handle.name

    client = _connect_ipfs()
    if client is not None:  # pragma: no cover - requires live IPFS daemon
        try:
            client.add_bytes(viz_html.encode("utf-8"))  # type: ignore[attr-defined]
        except Exception:
            pass

    cid = _generate_cid(viz_html)
    zk_hash = _compute_zk_hash(results, wallet_id, auth_hash)

    PINNED_VIZ[cid] = {
        "wallet": wallet_id,
        "mission_anchor": mission_anchor,
        "results": results,
        "zk_hash": zk_hash,
        "auth_hash": auth_hash,
        "artifact_path": temp_path,
        "viz_json": viz_json,
    }
    return cid, zk_hash


def event_stream(
    wallet_id: str,
    telemetry: PilotResonanceTelemetry,
    mission_anchor: str,
    auth_hash: str,
    *,
    loop_max: int | None = None,
) -> Generator[str, None, None]:
    """Yield SSE-formatted ERV cascade updates for guardian clients."""

    rng = random.Random()
    consent_hash = hashlib.sha256(
        f"{wallet_id}:{telemetry.consent}".encode("utf-8")
    ).hexdigest()
    iterations = 0

    try:
        while True:
            if loop_max is not None and iterations >= loop_max:
                break

            iterations += 1
            bio_data = telemetry.fetch_mock_bio_data(wallet_id)
            if "error" in bio_data:
                if loop_max is None or iterations < loop_max:
                    time.sleep(5)
                continue

            score, encrypted_res = telemetry.run_erv_simulation(bio_data)
            attested = telemetry.simulate_cascade(score, encrypted_res)
            if not attested:
                if loop_max is None or iterations < loop_max:
                    time.sleep(5)
                continue

            uplift = round(score * 1.5, 4)
            gradient_shift = rng.uniform(-0.05, 0.05)
            viz_payload = {
                "wallet": wallet_id,
                "mission_anchor": mission_anchor,
                "mission_statement": MISSION_STATEMENT,
                "gradient_shift": gradient_shift,
                "timestamp": bio_data.get("timestamp"),
            }
            viz_json = json.dumps(viz_payload, sort_keys=True)
            results_stub = [
                {
                    "score": score,
                    "uplift": uplift,
                    "status": "attested",
                    "mission_anchor": mission_anchor,
                }
            ]
            zk_hash = _compute_zk_hash(results_stub, wallet_id, auth_hash)
            event_body = {
                "score": score,
                "uplift": uplift,
                "status": "attested",
                "viz_update": viz_json,
                "mission_anchor": mission_anchor,
                "mission_statement": MISSION_STATEMENT,
                "zk_hash": zk_hash,
                "guardian_sync": "resonance_update",
                "consent_hash": consent_hash,
                "oracle_stub": "base::pending",
            }
            yield f"data: {json.dumps(event_body)}\n\n"

            if loop_max is None or iterations < loop_max:
                time.sleep(5)
    except GeneratorExit:
        return
    except Exception as exc:  # pragma: no cover - defensive streaming guard
        error_payload = {"status": "error", "detail": str(exc)}
        yield f"data: {json.dumps(error_payload)}\n\n"


@app.route("/stream_viz/<wallet_id>", methods=["GET"])
def stream_viz(wallet_id: str) -> Response:
    """Stream live ERV cascades over SSE for lightweight guardian syncs."""

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        abort(401, "wallet_auth_missing")

    consent_header = request.headers.get("X-Consent", "true").lower()
    consent = consent_header not in {"false", "0", "no"}
    if not consent:
        abort(403, "consent_required")

    mission_anchor = MISSION_STATEMENT
    telemetry = TelemetryClass(mission_anchor, consent=consent)
    if not getattr(telemetry, "consent", True):
        abort(403, "consent_required")

    auth_hash = hashlib.sha256(auth_header.encode("utf-8")).hexdigest()
    loop_max_cfg = app.config.get("STREAM_LOOP_MAX")
    loop_max = loop_max_cfg if isinstance(loop_max_cfg, int) else None

    generator = event_stream(
        wallet_id,
        telemetry,
        mission_anchor,
        auth_hash,
        loop_max=loop_max,
    )
    response = Response(
        stream_with_context(generator),
        mimetype="text/event-stream",
    )
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Authorization, X-Consent"
    response.headers["Connection"] = "keep-alive"
    return response


@app.route("/share_viz/<wallet_id>", methods=["POST"])
def share_viz(wallet_id: str):
    """Pin ERV visualizations to IPFS and return attestation metadata."""

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        abort(401, "wallet_auth_missing")

    payload = request.get_json(silent=True) or {}
    consent = payload.get("consent", True)
    if not consent:
        abort(403, "consent_required")

    mission_anchor = payload.get("mission_anchor") or MISSION_STATEMENT
    results = payload.get("results") or []

    telemetry = TelemetryClass(mission_anchor, consent=consent)
    if not results:
        results = telemetry.end_to_end_test(num_iters=6)
    telemetry.interactive_viz(results)

    auth_hash = hashlib.sha256(auth_header.encode("utf-8")).hexdigest()
    cid, zk_hash = _pin_artifacts(
        wallet_id=wallet_id,
        mission_anchor=mission_anchor,
        results=results,
        auth_hash=auth_hash,
    )

    attest_url = f"{request.url_root.rstrip('/')}/attest_viz/{cid}"
    response = {
        "ipfs_cid": cid,
        "zk_hash": zk_hash,
        "attest_url": attest_url,
        "mission_anchor": mission_anchor,
        "mission_statement": MISSION_STATEMENT,
    }
    return jsonify(response), 200


@app.route("/attest_viz/<ipfs_cid>", methods=["GET"])
def attest_viz(ipfs_cid: str):
    """Validate pinned visualization integrity and mission alignment."""

    record = PINNED_VIZ.get(ipfs_cid)
    if record is None:
        abort(404, "viz_not_found")

    if record["mission_anchor"] != MISSION_STATEMENT:
        abort(403, "mission_drift_detected")

    expected_hash = _compute_zk_hash(record["results"], record["wallet"], record["auth_hash"])
    if expected_hash != record["zk_hash"]:
        abort(403, "zk_hash_mismatch")

    return jsonify(
        {
            "ipfs_cid": ipfs_cid,
            "mission_anchor": record["mission_anchor"],
            "results_count": len(record["results"]),
            "zk_hash": record["zk_hash"],
            "status": "attested",
            "mission_statement": MISSION_STATEMENT,
        }
    )


# Future Base oracle integration hook placeholder

def dispatch_to_base_oracle(cid: str, zk_hash: str) -> None:  # pragma: no cover - stubbed
    """Placeholder for relaying attested dashboards to Base oracle feeds."""

    _ = (cid, zk_hash)  # No-op stub keeps surface area ready for Web3 hook


if __name__ == "__main__":
    app.run(debug=True, port=5001)
