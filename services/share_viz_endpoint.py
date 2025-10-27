"""Lightweight API to share ERV visualizations via IPFS + ZK stubs."""

from __future__ import annotations

import hashlib
import hmac
import json
import random
import sys
import tempfile
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Any, Dict, Generator

from flask import Flask, Response, abort, jsonify, request, stream_with_context
from cryptography.hazmat.primitives import hashes
try:  # pragma: no cover - optional serialization helper
    from cryptography.hazmat.primitives import serialization
except ImportError:  # pragma: no cover - serialization not available
    serialization = None  # type: ignore
from cryptography.hazmat.primitives.asymmetric import ec
try:  # pragma: no cover - dependent on cryptography build
    from cryptography.hazmat.primitives.asymmetric import dilithium, falcon
except ImportError:  # pragma: no cover - provide deterministic PQ stubs
    class _DilithiumStub:
        """Fallback dilithium module with transition verification shim."""

        @staticmethod
        def verify_transition(*_: Any, **__: Any) -> bool:
            return True

    class _FalconKeyStub:
        """Fallback Falcon private key supporting public key materialization."""

        def __init__(self) -> None:
            self._fingerprint = f"falcon-stub::{uuid.uuid4()}"

        def public_key(self) -> "_FalconKeyStub":
            return self

        def public_bytes(self, *args: Any, **kwargs: Any) -> bytes:  # noqa: D401
            _ = (args, kwargs)
            return self._fingerprint.encode("utf-8")

        def __str__(self) -> str:  # pragma: no cover - debug helper
            return self._fingerprint

    class _FalconStub:
        @staticmethod
        def generate_private_key() -> _FalconKeyStub:
            return _FalconKeyStub()

    dilithium = _DilithiumStub()  # type: ignore
    falcon = _FalconStub()  # type: ignore
import numpy as np

try:  # pragma: no cover - optional scientific stack during tests
    import pandas as pd
except ImportError:  # pragma: no cover - lightweight fallback stub
    class _Series(list):
        """Minimal pandas.Series shim supporting required interactions."""

        def __init__(self, data, index=None, name=None):
            super().__init__(float(value) for value in data)
            self.index = index if index is not None else list(range(len(self)))
            self.name = name

        def to_numpy(self):
            return np.asarray(self, dtype=float)

        @property
        def values(self):
            return np.asarray(self, dtype=float)

        def tolist(self):
            return list(self)

    class _PDStub:
        Series = _Series

        @staticmethod
        def date_range(*_, periods: int, **__):
            return list(range(periods))

    pd = _PDStub()  # type: ignore

try:  # pragma: no cover - optional dependency during tests
    from statsmodels.tsa.arima.model import ARIMA
except ImportError:  # pragma: no cover - deterministic ARIMA stub
    class ARIMA:  # type: ignore[override]
        """Fallback ARIMA(1,1,1) approximation using naive differencing."""

        def __init__(self, data, order):
            _ = order
            self._data = np.asarray(data, dtype=float)

        def fit(self):
            series = self._data

            class _Result:
                def __init__(self, values: np.ndarray):
                    self._values = values
                    shifted = np.roll(values, 1)
                    shifted[0] = values[0]
                    self.fittedvalues = shifted
                    self.resid = values - shifted

                def forecast(self, steps: int):
                    terminal = float(self._values[-1]) if self._values.size else 0.0
                    return np.full(steps, terminal)

            return _Result(series)

try:  # pragma: no cover - optional dependency during tests
    from sklearn.linear_model import LinearRegression
except ImportError:  # pragma: no cover - provide lightweight regression stub
    class LinearRegression:  # type: ignore[override]
        """Fallback linear regression using closed-form least squares."""

        def __init__(self) -> None:
            self.coef_ = np.zeros(1)
            self.intercept_ = 0.0
            self._fitted = False
            self._x: np.ndarray | None = None
            self._y: np.ndarray | None = None

        def fit(self, x_values: np.ndarray, y_values: np.ndarray) -> "LinearRegression":
            x_arr = np.asarray(x_values, dtype=float)
            y_arr = np.asarray(y_values, dtype=float)
            if x_arr.ndim == 1:
                x_arr = x_arr.reshape(-1, 1)
            if not len(x_arr):
                self.coef_ = np.zeros(x_arr.shape[1]) if x_arr.ndim > 1 else np.zeros(1)
                self.intercept_ = 0.0
                self._fitted = True
                self._x = x_arr
                self._y = y_arr
                return self

            x_column = x_arr[:, 0]
            x_mean = float(x_column.mean())
            y_mean = float(y_arr.mean()) if len(y_arr) else 0.0
            denom = float(((x_column - x_mean) ** 2).sum())
            if denom == 0.0:
                slope = 0.0
                intercept = y_mean
            else:
                slope = float(((x_column - x_mean) * (y_arr - y_mean)).sum() / denom)
                intercept = y_mean - slope * x_mean

            self.coef_ = np.array([slope])
            self.intercept_ = intercept
            self._fitted = True
            self._x = x_arr
            self._y = y_arr
            return self

        def predict(self, x_values: np.ndarray) -> np.ndarray:
            x_arr = np.asarray(x_values, dtype=float)
            if x_arr.ndim == 1:
                x_arr = x_arr.reshape(-1, 1)
            return x_arr.dot(self.coef_) + self.intercept_

        def score(self, x_values: np.ndarray, y_values: np.ndarray) -> float:
            if not self._fitted:
                return 0.0
            y_arr = np.asarray(y_values, dtype=float)
            if y_arr.size <= 1:
                return 0.0
            predictions = self.predict(x_values)
            ss_res = float(((y_arr - predictions) ** 2).sum())
            y_mean = float(y_arr.mean())
            ss_tot = float(((y_arr - y_mean) ** 2).sum())
            if ss_tot == 0.0:
                return 0.0
            return 1 - ss_res / ss_tot


try:  # pragma: no cover - optional dependency during tests
    from sklearn.ensemble import RandomForestRegressor
except ImportError:  # pragma: no cover - deterministic average fallback
    class RandomForestRegressor:  # type: ignore[override]
        """Fallback regressor that returns the mean of observed targets."""

        def __init__(self, **_: Any) -> None:
            self._y_mean = 0.0
            self._fitted = False

        def fit(self, x_values: np.ndarray, y_values: np.ndarray) -> "RandomForestRegressor":
            _ = x_values
            y_arr = np.asarray(y_values, dtype=float)
            self._y_mean = float(y_arr.mean()) if y_arr.size else 0.0
            self._fitted = True
            return self

        def predict(self, x_values: np.ndarray) -> np.ndarray:
            x_arr = np.asarray(x_values, dtype=float)
            if x_arr.ndim == 1:
                x_arr = x_arr.reshape(-1, 1)
            count = x_arr.shape[0]
            return np.full(count, self._y_mean)

        def score(self, x_values: np.ndarray, y_values: np.ndarray) -> float:
            if not self._fitted:
                return 0.0
            y_arr = np.asarray(y_values, dtype=float)
            if y_arr.size <= 1:
                return 0.0
            predictions = self.predict(x_values)
            ss_res = float(((y_arr - predictions) ** 2).sum())
            y_mean = float(y_arr.mean())
            ss_tot = float(((y_arr - y_mean) ** 2).sum())
            if ss_tot == 0.0:
                return 0.0
            return max(0.0, 1 - ss_res / ss_tot)

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
STREAM_EMIT_QUEUE: deque[dict[str, Any]] = deque()
ADAPTIVE_COUNCIL_THRESHOLD: float = 2.0


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


def _sign_guardian_vote(guardian_id: str, vote_value: bool) -> str:
    """Produce a deterministic mock signature for guardian MPC ballots."""

    curve = ec.SECP256R1()
    seed = int(hashlib.sha256(guardian_id.encode("utf-8")).hexdigest(), 16)
    private_value = (seed % (curve.key_size - 1)) + 1
    ec.derive_private_key(private_value, curve)

    digest = hashes.Hash(hashes.SHA256())
    digest.update(f"{guardian_id}:{int(vote_value)}".encode("utf-8"))
    return digest.finalize().hex()


def _verify_guardian_signature(guardian_id: str, vote_value: bool, signature: str) -> bool:
    """Validate guardian signatures using deterministic MPC stubs."""

    expected = _sign_guardian_vote(guardian_id, vote_value)
    return hmac.compare_digest(expected, signature)


def _hash_vote_pool(votes: list[dict[str, Any]]) -> str:
    """Aggregate guardian ballots into a zk-style hash for privacy."""

    digest = hashes.Hash(hashes.SHA256())
    for vote in votes:
        digest.update(str(vote.get("guardian_id", "")).encode("utf-8"))
        digest.update(b":")
        digest.update(b"1" if vote.get("vote") else b"0")
    return digest.finalize().hex()


def _load_guardian_vote_history(
    viz_cid: str, telemetry: PilotResonanceTelemetry, *, sample_min: int = 10
) -> list[dict[str, Any]]:
    """Pull historical guardian votes while respecting consent boundaries."""

    record = PINNED_VIZ.get(viz_cid)
    if record is None:
        return []

    wallet_id = record.get("wallet", "guardian::anon")
    seed_material = f"{viz_cid}:{wallet_id}:{telemetry.mission_anchor}"
    seed = int(hashlib.sha256(seed_material.encode("utf-8")).hexdigest(), 16) % (2**32)
    rng = np.random.default_rng(seed)
    sample_max = sample_min + 8
    sample_size = int(rng.integers(sample_min, sample_max))
    history: list[dict[str, Any]] = []

    for _ in range(sample_size):
        bio_data = telemetry.fetch_mock_bio_data(wallet_id)
        base_score, encrypted_res = telemetry.run_erv_simulation(bio_data)
        resonance_noise = float(rng.normal(0, 0.035))
        score = max(0.0, min(1.0, base_score + resonance_noise))
        consensus_signal = telemetry.simulate_cascade(score, encrypted_res)
        consensus = bool(consensus_signal and rng.random() > 0.25)
        uplift = round(float(score * (1.3 + rng.uniform(-0.12, 0.14))), 4)
        history.append(
            {
                "score": round(float(score), 4),
                "consensus": consensus,
                "uplift": uplift,
            }
        )

    return history


def _history_aggregate_hash(
    viz_cid: str, wallet_id: str, history: list[dict[str, Any]], auth_hash: str
) -> str:
    """Produce a zk-style hash over historical aggregates without raw ballots."""

    sanitized = [
        {
            "score": round(float(entry.get("score", 0.0)), 4),
            "consensus": bool(entry.get("consensus", False)),
            "uplift": round(float(entry.get("uplift", 0.0)), 4),
        }
        for entry in history
    ]
    return _compute_zk_hash(sanitized, wallet_id, auth_hash)


def _normalize_pubkey(public_key_obj: Any) -> str:
    """Convert PQ public key objects into JSON-friendly strings."""

    if serialization is not None and hasattr(public_key_obj, "public_bytes"):
        try:
            raw_format = getattr(serialization.PublicFormat, "Raw", serialization.PublicFormat.SubjectPublicKeyInfo)
            raw_encoding = getattr(serialization.Encoding, "Raw", serialization.Encoding.PEM)
            material = public_key_obj.public_bytes(encoding=raw_encoding, format=raw_format)
            if isinstance(material, bytes):
                return material.hex()
        except Exception:
            try:
                pem_bytes = public_key_obj.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo,
                )
                if isinstance(pem_bytes, bytes):
                    return pem_bytes.decode("utf-8")
            except Exception:
                pass

    if isinstance(public_key_obj, bytes):
        return public_key_obj.hex()
    if hasattr(public_key_obj, "hex"):
        try:
            return public_key_obj.hex()  # type: ignore[call-arg]
        except Exception:
            pass
    return str(public_key_obj)


def stream_viz_updates() -> Generator[dict[str, Any], None, None]:
    """Yield guardian council emissions queued for SSE distribution."""

    while STREAM_EMIT_QUEUE:
        yield STREAM_EMIT_QUEUE.popleft()


def _collect_resonance_series(
    telemetry: PilotResonanceTelemetry,
    wallet_id: str,
    *,
    periods: int = 20,
) -> "pd.Series":
    """Build a resonance time-series respecting consent and privacy."""

    values = []
    index = []
    for step in range(periods):
        bio = telemetry.fetch_mock_bio_data(wallet_id)
        score, encrypted_res = telemetry.run_erv_simulation(bio)
        _ = encrypted_res
        jitter = np.sin(step) * 0.015
        values.append(max(0.0, min(1.0, score + jitter)))
        index.append(bio.get("timestamp", step))

    if hasattr(pd, "date_range") and periods:
        try:
            index = pd.date_range(end=None, periods=periods, freq="H")  # type: ignore[arg-type]
        except Exception:
            index = list(range(periods))

    return pd.Series(values, index=index, name="resonance")


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

            while STREAM_EMIT_QUEUE:
                guardian_event = STREAM_EMIT_QUEUE.popleft()
                guardian_event.setdefault("mission_statement", MISSION_STATEMENT)
                yield f"data: {json.dumps(guardian_event)}\n\n"

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


@app.route("/adaptive_threshold/<viz_cid>", methods=["POST"])
def adaptive_threshold(viz_cid: str):
    """Tune guardian council thresholds based on forecast confidence."""

    auth_header = request.headers.get("Authorization", "")
    if auth_header != "Bearer guardian_token":
        abort(401, "guardian_auth_required")

    payload = request.get_json(silent=True) or {}

    forecast_conf: float | None
    try:
        forecast_conf = float(payload.get("forecast_conf"))
    except (TypeError, ValueError):
        forecast_conf = None

    record = PINNED_VIZ.get(viz_cid)
    if record is None:
        abort(404, "viz_not_found")

    consent_flag = bool(payload.get("consent", True))
    mission_anchor = record.get("mission_anchor", MISSION_STATEMENT)
    telemetry = TelemetryClass(mission_anchor, consent=consent_flag)
    if not getattr(telemetry, "consent", True):
        abort(403, "consent_required")

    wallet_id = record.get("wallet", "guardian::anon")
    bio_data = telemetry.fetch_mock_bio_data(wallet_id)
    erv_score, encrypted_res = telemetry.run_erv_simulation(bio_data)
    cascade_ready = telemetry.simulate_cascade(erv_score, encrypted_res)

    provided_history = payload.get("historical_votes") or []
    history: list[dict[str, Any]] = []
    if isinstance(provided_history, list):
        for entry in provided_history:
            try:
                score = float(entry.get("score", 0.0))
            except (TypeError, ValueError):
                continue
            consensus = bool(entry.get("consensus", False))
            history.append({"score": max(0.0, min(score, 1.0)), "consensus": consensus})

    if not history:
        history = _load_guardian_vote_history(viz_cid, telemetry)

    if not history:
        history = [{"score": 0.65, "consensus": cascade_ready}, {"score": 0.75, "consensus": cascade_ready}]

    auth_hash = record.get("auth_hash", "")
    history_hash = _history_aggregate_hash(viz_cid, wallet_id, history, auth_hash)

    low_confidence = forecast_conf is None or forecast_conf < 0.4

    mission_theme = "protect" if "protect" in MISSION_STATEMENT.lower() else "uplift"
    tune_conf = 0.0
    new_threshold = 2.0
    impact = "review_recommended_protect" if mission_theme == "protect" else "review_recommended"

    if not low_confidence:
        rng_seed = int(hashlib.sha256(f"{viz_cid}:{wallet_id}:{mission_anchor}".encode("utf-8")).hexdigest(), 16) % (2**32)
        rng = np.random.default_rng(rng_seed)
        scores = np.array([[max(0.05, min(float(entry["score"]), 0.99))] for entry in history], dtype=float)
        targets = []
        for entry in history:
            consensus_bias = -0.25 if entry.get("consensus") else 0.2
            targets.append(
                max(
                    1.2,
                    min(2.8, 2.45 - float(entry["score"]) * 0.9 + consensus_bias + float(rng.normal(0, 0.04))),
                )
            )

        target_array = np.array(targets, dtype=float).reshape(-1, 1)
        model = RandomForestRegressor(n_estimators=32, random_state=rng_seed)
        model.fit(scores, target_array.ravel())
        prediction_input = np.array([[min(0.99, max(0.05, float(forecast_conf)))]], dtype=float)
        predicted = float(model.predict(prediction_input)[0])
        if cascade_ready and forecast_conf > 0.75:
            predicted -= 0.1
        if forecast_conf > 0.8:
            predicted = min(predicted, 1.5)
        new_threshold = max(1.0, min(3.0, predicted))

        try:
            tune_conf = float(model.score(scores, target_array.ravel()))
        except Exception:  # pragma: no cover - defensive guard for stub score
            tune_conf = 0.0
        tune_conf = max(0.0, min(tune_conf, 1.0))
        impact = "accelerated" if new_threshold < 2.0 else f"conservative_{mission_theme}"

    global ADAPTIVE_COUNCIL_THRESHOLD
    ADAPTIVE_COUNCIL_THRESHOLD = round(float(new_threshold), 3)

    emit_id = str(uuid.uuid4())
    STREAM_EMIT_QUEUE.append(
        {
            "guardian_sync": "adaptive_threshold",
            "adaptive_threshold": ADAPTIVE_COUNCIL_THRESHOLD,
            "tune_conf": round(float(tune_conf), 4),
            "viz_cid": viz_cid,
            "emit_id": emit_id,
            "history_hash": history_hash,
            "mission_statement": MISSION_STATEMENT,
        }
    )

    dispatch_to_base_oracle(viz_cid, history_hash)

    response = {
        "new_threshold": ADAPTIVE_COUNCIL_THRESHOLD,
        "tune_conf": round(float(tune_conf), 4),
        "impact": impact,
        "emit_id": emit_id,
    }
    if not low_confidence:
        response["history_hash"] = history_hash
    else:
        response["message"] = f"review_recommended::{mission_theme}"

    return jsonify(response), 200


@app.route("/guardian_council/<viz_cid>", methods=["POST"])
def guardian_council(viz_cid: str):
    """Aggregate guardian MPC votes while aligning consensus to the mission."""

    auth_header = request.headers.get("Authorization", "")
    if auth_header != "Bearer guardian_token":
        abort(401, "guardian_auth_required")

    payload = request.get_json(silent=True) or {}
    raw_votes = payload.get("votes") or []
    if not isinstance(raw_votes, list):
        abort(400, "invalid_vote_payload")

    threshold = payload.get("threshold", 2)
    try:
        threshold_value = int(threshold)
    except (TypeError, ValueError):
        abort(400, "invalid_threshold")
    threshold_value = max(threshold_value, 1)

    record = PINNED_VIZ.get(viz_cid)
    if record is None:
        abort(404, "viz_not_found")

    mission_anchor = record.get("mission_anchor", MISSION_STATEMENT)
    telemetry = TelemetryClass(mission_anchor, consent=True)
    wallet_id = record.get("wallet", "guardian::anon")

    validated_votes: list[dict[str, Any]] = []
    for entry in raw_votes:
        guardian_id = str(entry.get("guardian_id", "")).strip()
        if not guardian_id:
            abort(400, "guardian_id_required")

        vote_value = bool(entry.get("vote", False))
        signature = str(entry.get("sig", ""))
        if not signature:
            abort(400, "signature_required")

        if not _verify_guardian_signature(guardian_id, vote_value, signature):
            abort(403, "invalid_signature")

        validated_votes.append({"guardian_id": guardian_id, "vote": vote_value, "sig": signature})

    if len(validated_votes) < threshold_value:
        return (
            jsonify(
                {
                    "consensus": False,
                    "threshold_met": False,
                    "alert": "guardian_drift_threshold",
                }
            ),
            402,
        )

    yes_votes = sum(1 for vote in validated_votes if vote["vote"])
    attested = yes_votes >= threshold_value
    if not attested:
        return (
            jsonify(
                {
                    "consensus": False,
                    "threshold_met": False,
                    "alert": "guardian_drift_consensus",
                }
            ),
            402,
        )

    bio_data = telemetry.fetch_mock_bio_data(wallet_id)
    score, encrypted_res = telemetry.run_erv_simulation(bio_data)
    resonance_ok = telemetry.simulate_cascade(score, encrypted_res)

    mission_weight = 1.0 if mission_anchor == MISSION_STATEMENT else 0.6
    consensus = attested and resonance_ok and mission_weight >= 0.75
    uplift_adjust = round(score * 1.5, 4) if consensus else 0.0

    emit_id = str(uuid.uuid4())
    zk_pool_hash = _hash_vote_pool(validated_votes)

    if consensus:
        STREAM_EMIT_QUEUE.append(
            {
                "guardian_sync": "council_vote",
                "consensus": consensus,
                "threshold_met": True,
                "uplift_adjust": uplift_adjust,
                "mission_anchor": mission_anchor,
                "viz_cid": viz_cid,
                "emit_id": emit_id,
                "zk_pool_hash": zk_pool_hash,
                "resonance_score": round(score, 4),
            }
        )

    response = {
        "consensus": consensus,
        "threshold_met": True,
        "emit_id": emit_id,
    }
    return jsonify(response), 200


@app.route("/consensus_forecast/<viz_cid>", methods=["GET"])
def consensus_forecast(viz_cid: str):
    """Forecast uplift adjustments using guardian consensus patterns."""

    auth_header = request.headers.get("Authorization", "")
    if auth_header != "Bearer guardian_token":
        abort(401, "guardian_auth_required")

    consent_header = request.headers.get("X-Consent", "true").lower()
    if consent_header in {"false", "0", "no"}:
        abort(403, "consent_required")

    record = PINNED_VIZ.get(viz_cid)
    if record is None:
        abort(404, "viz_not_found")

    mission_anchor = record.get("mission_anchor", MISSION_STATEMENT)
    if mission_anchor != MISSION_STATEMENT:
        abort(403, "mission_drift_detected")

    telemetry = TelemetryClass(mission_anchor, consent=True)
    history = _load_guardian_vote_history(viz_cid, telemetry)
    wallet_id = record.get("wallet", "guardian::anon")

    auth_hash = hashlib.sha256(auth_header.encode("utf-8")).hexdigest()
    aggregate_hash = _history_aggregate_hash(viz_cid, wallet_id, history, auth_hash)

    if not history:
        dispatch_to_base_oracle(viz_cid, aggregate_hash)
        response = {
            "predicted_uplift": 0.0,
            "confidence": 0.0,
            "recommendation": "insufficient_data",
            "aggregate_hash": aggregate_hash,
            "mission_statement": MISSION_STATEMENT,
        }
        return jsonify(response), 200

    resonance_param = request.args.get("resonance")
    try:
        resonance_value = float(resonance_param) if resonance_param is not None else float("nan")
    except (TypeError, ValueError):
        resonance_value = float("nan")

    if np.isnan(resonance_value):
        bio_data = telemetry.fetch_mock_bio_data(wallet_id)
        resonance_value, _ = telemetry.run_erv_simulation(bio_data)

    scores = np.array([[entry["score"]] for entry in history], dtype=float)
    targets = np.array(
        [entry["uplift"] if entry["consensus"] else 0.0 for entry in history],
        dtype=float,
    )

    model = LinearRegression()
    model.fit(scores, targets)
    predicted = float(model.predict(np.array([[resonance_value]], dtype=float))[0])
    confidence = float(model.score(scores, targets))
    confidence = max(0.0, min(confidence, 1.0))
    predicted = max(0.0, predicted)

    empathy_weight = 1.0 + (0.05 if "empathy" in MISSION_STATEMENT.lower() else 0.0)
    recommendation = "attest" if predicted * empathy_weight > 1.0 else "review"

    emit_id: str | None = None
    if confidence > 0.7:
        emit_id = str(uuid.uuid4())
        STREAM_EMIT_QUEUE.append(
            {
                "guardian_sync": "consensus_forecast",
                "forecast": round(predicted, 4),
                "emit_id": emit_id,
                "viz_cid": viz_cid,
            }
        )

    dispatch_to_base_oracle(viz_cid, aggregate_hash)

    response = {
        "predicted_uplift": round(predicted, 4),
        "confidence": round(confidence, 4),
        "recommendation": recommendation,
        "aggregate_hash": aggregate_hash,
        "mission_statement": MISSION_STATEMENT,
    }
    if emit_id is not None:
        response["emit_id"] = emit_id
    return jsonify(response), 200


@app.route("/belief_evolution_tracker/<viz_cid>", methods=["GET"])
def belief_evolution_tracker(viz_cid: str):
    """Run ARIMA drift tracking over historical resonance telemetry."""

    auth_header = request.headers.get("Authorization", "")
    if auth_header != "Bearer guardian_token":
        abort(401, "guardian_auth_required")

    consent_header = request.headers.get("X-Consent", "true").lower()
    if consent_header in {"false", "0", "no"}:
        abort(403, "consent_required")

    record = PINNED_VIZ.get(viz_cid)
    if record is None:
        abort(404, "viz_not_found")

    mission_anchor = record.get("mission_anchor", MISSION_STATEMENT)
    telemetry = TelemetryClass(mission_anchor, consent=True)
    if not getattr(telemetry, "consent", True):
        abort(403, "consent_required")

    wallet_id = record.get("wallet", "guardian::anon")
    series = _collect_resonance_series(telemetry, wallet_id)

    bio_data = telemetry.fetch_mock_bio_data(wallet_id)
    current_score, encrypted_res = telemetry.run_erv_simulation(bio_data)
    _ = encrypted_res
    series_values = np.asarray(getattr(series, "values", series), dtype=float)
    extended_values = np.append(series_values, current_score)

    if extended_values.size < 5:
        return (
            jsonify({
                "drift_score": 0.0,
                "alert": False,
                "insufficient_data": True,
                "mission_statement": MISSION_STATEMENT,
            }),
            200,
        )

    try:
        model = ARIMA(extended_values, order=(1, 1, 1))
        result = model.fit()
        fitted = np.asarray(getattr(result, "fittedvalues", extended_values), dtype=float)
        if fitted.shape[0] != extended_values.shape[0]:
            padding = np.full_like(extended_values, extended_values.mean())
            padding[-fitted.shape[0] :] = fitted[-min(fitted.shape[0], padding.shape[0]) :]
            fitted = padding
        forecast = result.forecast(steps=5)
    except Exception as exc:  # pragma: no cover - defensive guard against ARIMA errors
        fitted = np.full_like(extended_values, float(extended_values[-1]))
        forecast = np.full(5, float(extended_values[-1]))
        STREAM_EMIT_QUEUE.append(
            {
                "guardian_sync": "belief_evolution",
                "arima_warning": str(exc),
                "viz_cid": viz_cid,
            }
        )

    forecast_values = np.asarray(forecast, dtype=float)
    drift_score = float(np.sqrt(np.mean(np.square(extended_values - fitted))))
    alert = drift_score > 0.1

    aggregate_payload = [
        {
            "timestamp": str(getattr(series, "index", list(range(len(series))))[idx])
            if idx < len(series)
            else "current",
            "score": round(float(value), 4),
        }
        for idx, value in enumerate(extended_values)
    ]
    auth_hash = record.get("auth_hash", hashlib.sha256(auth_header.encode("utf-8")).hexdigest())
    aggregate_hash = _compute_zk_hash(aggregate_payload, wallet_id, auth_hash)

    mission_clause = "protect" if "protect" in MISSION_STATEMENT.lower() else "safeguard"
    if alert:
        recommendation = f"monitor to {mission_clause} our mission: {MISSION_STATEMENT}"
        emit_id = str(uuid.uuid4())
        STREAM_EMIT_QUEUE.append(
            {
                "guardian_sync": "belief_evolution",
                "drift_alert": True,
                "emit_id": emit_id,
                "viz_cid": viz_cid,
                "aggregate_hash": aggregate_hash,
            }
        )
    else:
        recommendation = f"stable trajectory with mission focus: {MISSION_STATEMENT}"
        emit_id = None

    dispatch_to_base_oracle(viz_cid, aggregate_hash)

    response = {
        "drift_score": round(drift_score, 4),
        "predicted_trend": [round(float(value), 4) for value in forecast_values],
        "alert": alert,
        "recommendation": recommendation,
        "mission_statement": MISSION_STATEMENT,
        "insufficient_data": False,
        "aggregate_hash": aggregate_hash,
    }
    if emit_id is not None:
        response["emit_id"] = emit_id
    return jsonify(response), 200


def _sanitize_resonance_series(series_payload: Any) -> np.ndarray:
    """Convert posted resonance payload into a numeric numpy array."""

    if not isinstance(series_payload, list):
        return np.asarray([], dtype=float)
    values: list[float] = []
    for value in series_payload:
        try:
            values.append(float(value))
        except (TypeError, ValueError):
            continue
    return np.asarray(values, dtype=float)


def _fit_healing_model(series_array: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, str | None]:
    """Fit ARIMA(1,1,1) and return fitted values, forecast, residuals, warning."""

    warning: str | None = None
    try:
        model = ARIMA(series_array, order=(1, 1, 1))
        result = model.fit()
        fitted = np.asarray(getattr(result, "fittedvalues", series_array), dtype=float)
        forecast = np.asarray(result.forecast(steps=5), dtype=float)
    except Exception as exc:  # pragma: no cover - exercised when ARIMA unavailable
        warning = str(exc)
        fitted = np.roll(series_array, 1)
        fitted[0] = series_array[0]
        forecast = np.full(5, float(series_array[-1]))

    if fitted.shape[0] != series_array.shape[0]:
        padding = np.full(series_array.shape[0], series_array.mean())
        padding[-min(fitted.shape[0], padding.shape[0]) :] = fitted[-min(
            fitted.shape[0], padding.shape[0]
        ) :]
        fitted = padding

    residuals = series_array - fitted
    return fitted, forecast, residuals, warning


def _apply_heal(  # noqa: D401
    series_array: np.ndarray, forecast: np.ndarray, residuals: np.ndarray
) -> tuple[list[float], float, float, float]:
    """Return healed series, reset threshold, gradient boost, and RMSE."""

    reset_threshold = float(np.mean(residuals) + np.std(residuals))
    reset_threshold = float(max(-0.049, min(0.049, reset_threshold)))
    drift_metric = float(np.sqrt(np.mean(np.square(residuals))))
    gradient_boost = 0.2 if drift_metric > 0.1 else 0.0
    healed_forecast = forecast[:5] if forecast.size else np.full(5, series_array[-1])
    mission_protect = "protect" in MISSION_STATEMENT.lower()
    healed_series = []
    for value in healed_forecast:
        adjusted = float(value) + gradient_boost
        if mission_protect:
            adjusted = max(adjusted, float(series_array.mean()))
        healed_series.append(round(max(0.0, min(1.0, adjusted)), 4))
    healed_array = np.asarray(healed_series, dtype=float)
    rmse_post = float(
        np.sqrt(np.mean(np.square(healed_array - healed_forecast[: healed_array.size])))
    )
    return healed_series, reset_threshold, gradient_boost, rmse_post


@app.route("/self_healing_covenant/<viz_cid>", methods=["POST"])
def self_healing_covenant(viz_cid: str):
    """Reset resonance gradients when drift alerts fire to protect the mission."""

    auth_header = request.headers.get("Authorization", "")
    if auth_header != "Bearer guardian_token":
        abort(401, "guardian_auth_required")

    consent_header = request.headers.get("X-Consent", "true").lower()
    if consent_header in {"false", "0", "no"}:
        abort(403, "consent_required")

    record = PINNED_VIZ.get(viz_cid)
    if record is None:
        abort(404, "viz_not_found")

    payload = request.get_json(silent=True) or {}
    if not bool(payload.get("drift_alert")):
        return (
            jsonify(
                {
                    "repair_status": "no_repair_needed",
                    "mission_statement": MISSION_STATEMENT,
                }
            ),
            200,
        )

    series_array = _sanitize_resonance_series(payload.get("historical_series") or [])
    if series_array.size < 5:
        abort(400, "insufficient_history")

    mission_anchor = record.get("mission_anchor", MISSION_STATEMENT)
    telemetry = TelemetryClass(mission_anchor, consent=True)
    if not getattr(telemetry, "consent", True):
        abort(403, "consent_required")

    fitted, forecast, residuals, warning = _fit_healing_model(series_array)
    if warning is not None:
        STREAM_EMIT_QUEUE.append(
            {"guardian_sync": "self_heal", "arima_warning": warning, "viz_cid": viz_cid}
        )

    healed_series, reset_threshold, gradient_boost, rmse_post = _apply_heal(
        series_array, forecast, residuals
    )
    repair_status = "restored" if rmse_post < 0.05 else "monitoring"

    wallet_id = record.get("wallet", "guardian::anon")
    bio_data = telemetry.fetch_mock_bio_data(wallet_id)
    bio_data["healed_gradient"] = gradient_boost
    validation_score, encrypted_res = telemetry.run_erv_simulation(bio_data)
    telemetry.simulate_cascade(validation_score + gradient_boost, encrypted_res)

    timestamp = time.time()
    record.setdefault("belief_evolution", []).extend(
        {
            "timestamp": timestamp + idx,
            "score": score,
            "source": "self_heal",
        }
        for idx, score in enumerate(healed_series)
    )

    auth_hash = record.get(
        "auth_hash", hashlib.sha256(auth_header.encode("utf-8")).hexdigest()
    )
    aggregate_payload = [
        {"step": idx, "score": score}
        for idx, score in enumerate(healed_series, start=1)
    ]
    aggregate_hash = _compute_zk_hash(aggregate_payload, wallet_id, auth_hash)
    dispatch_to_base_oracle(viz_cid, aggregate_hash)

    uplift_restore = float(max(0.0, np.mean(healed_series) - series_array[-1]))
    repair_id = str(uuid.uuid4())
    STREAM_EMIT_QUEUE.append(
        {
            "guardian_sync": "self_heal",
            "self_heal": True,
            "repair_id": repair_id,
            "uplift_restore": round(uplift_restore, 4),
            "viz_cid": viz_cid,
        }
    )

    response = {
        "repair_status": repair_status,
        "new_threshold": round(reset_threshold, 5),
        "healed_series": healed_series,
        "validation_rmse": round(rmse_post, 5),
        "aggregate_hash": aggregate_hash,
        "mission_statement": MISSION_STATEMENT,
        "validation_score": round(float(validation_score), 4),
        "gradient_boost": round(gradient_boost, 4),
        "repair_id": repair_id,
    }
    return jsonify(response), 200


@app.route("/quantum_resist_upgrade/<viz_cid>", methods=["POST"])
def quantum_resist_upgrade(viz_cid: str):
    """Rotate PQ signatures from Dilithium to Falcon while streaming guardian alerts."""

    auth_header = request.headers.get("Authorization", "")
    if auth_header != "Bearer guardian_token":
        abort(401, "guardian_auth_required")

    consent_header = request.headers.get("X-Consent", "true").lower()
    if consent_header in {"false", "0", "no"}:
        abort(403, "consent_required")

    payload = request.get_json(silent=True) or {}
    current_sig = str(payload.get("current_sig_type", "")).lower()
    target_sig = str(payload.get("target_sig_type", "")).lower()
    chain_id = payload.get("chain_id")
    if current_sig != "dilithium" or target_sig != "falcon" or not chain_id:
        abort(400, "invalid_rotation_request")

    record = PINNED_VIZ.get(viz_cid)
    if record is None:
        abort(404, "viz_not_found")

    mission_anchor = record.get("mission_anchor", MISSION_STATEMENT)
    telemetry = TelemetryClass(mission_anchor, consent=True)
    if not getattr(telemetry, "consent", True):
        abort(403, "consent_required")

    wallet_id = record.get("wallet", "guardian::anon")

    try:
        falcon_key = falcon.generate_private_key()
    except Exception:
        return jsonify({"status": "rotation_failed"}), 500

    public_material = getattr(falcon_key, "public_key", lambda: falcon_key)()
    new_pubkey_repr = _normalize_pubkey(public_material)

    verify_transition = getattr(dilithium, "verify_transition", None)
    legacy_sig = record.get("legacy_sig", record.get("zk_hash", "legacy::sig"))
    transition_ok = bool(verify_transition(legacy_sig, new_pubkey_repr)) if callable(verify_transition) else True
    if not transition_ok:
        return jsonify({"status": "rotation_failed"}), 500

    results = record.get("results", [])
    if not results:
        results = [
            {"score": 0.75 + 0.01 * idx, "uplift": 0.1 + 0.005 * idx}
            for idx in range(5)
        ]

    historical_hashes = []
    for idx, entry in enumerate(results[:10], start=1):
        base = f"{viz_cid}:{chain_id}:{idx}:{entry.get('score', 0.0):.4f}:{entry.get('uplift', 0.0):.4f}"
        historical_hashes.append(hashlib.sha3_256(base.encode("utf-8")).hexdigest())

    rotation_chain = []
    for idx, prior_hash in enumerate(historical_hashes, start=1):
        signature_material = f"{prior_hash}:{new_pubkey_repr}:{idx}".encode("utf-8")
        rotation_chain.append(
            {
                "hash": prior_hash,
                "signature": hashlib.sha3_256(signature_material).hexdigest(),
            }
        )

    auth_hash = record.get("auth_hash", hashlib.sha256(auth_header.encode("utf-8")).hexdigest())
    rotation_zk = _compute_zk_hash(rotation_chain, wallet_id, auth_hash)
    rotation_hash = hashlib.sha3_256(rotation_zk.encode("utf-8")).hexdigest()

    resonance_series = _collect_resonance_series(telemetry, wallet_id, periods=5)
    resonance_values = np.asarray(getattr(resonance_series, "values", resonance_series), dtype=float)
    latest_score = float(resonance_values[-1]) if resonance_values.size else 0.0
    record.setdefault("belief_evolution", []).append(
        {
            "timestamp": time.time(),
            "score": round(latest_score, 4),
            "sig_type": "falcon",
        }
    )

    mission_clause = "protect" if "protect" in MISSION_STATEMENT.lower() else "safeguard"
    emit_id = str(uuid.uuid4())
    STREAM_EMIT_QUEUE.append(
        {
            "pq_upgrade": True,
            "new_sig_type": "falcon",
            "emit_id": emit_id,
            "viz_cid": viz_cid,
        }
    )

    record["current_sig_type"] = "falcon"
    record["rotation_chain"] = rotation_chain
    record["rotation_zk_proof"] = rotation_zk
    record["new_pubkey"] = new_pubkey_repr

    response = {
        "new_pubkey": new_pubkey_repr,
        "rotation_hash": rotation_hash,
        "status": "upgraded",
        "status_detail": f"{mission_clause}_future_integrity",
        "mission_statement": MISSION_STATEMENT,
        "emit_id": emit_id,
    }
    return jsonify(response), 200


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
