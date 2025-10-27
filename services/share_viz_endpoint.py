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

try:  # pragma: no cover - transformers may be optional in minimal envs
    from transformers import pipeline
    HAS_TRANSFORMERS = True
except ImportError:  # pragma: no cover - provide deterministic stub
    pipeline = None  # type: ignore
    HAS_TRANSFORMERS = False

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
try:  # pragma: no cover - optional ML dependency
    import torch
    import torch.nn as nn
    HAS_TORCH = True
except ImportError:  # pragma: no cover - provide deterministic fallback
    torch = None  # type: ignore
    nn = None  # type: ignore
    HAS_TORCH = False

try:  # pragma: no cover - optional graph dependency
    import networkx as nx
    HAS_NETWORKX = True
except ImportError:  # pragma: no cover - deterministic graph stub
    HAS_NETWORKX = False

    class _GraphStub:
        """Minimal undirected graph supporting node and edge iteration."""

        def __init__(self) -> None:
            self._nodes: dict[Any, dict[str, Any]] = {}
            self._edges: set[tuple[Any, Any]] = set()

        def add_node(self, node_id: Any, **attrs: Any) -> None:
            self._nodes[node_id] = dict(attrs)

        def add_edge(self, source: Any, target: Any) -> None:
            ordered = tuple(sorted((source, target)))
            self._edges.add(ordered)

        def edges(self) -> list[tuple[Any, Any]]:
            return list(self._edges)

        def neighbors(self, node_id: Any) -> list[Any]:
            neighbors: list[Any] = []
            for source, target in self._edges:
                if source == node_id:
                    neighbors.append(target)
                elif target == node_id:
                    neighbors.append(source)
            return neighbors

        def nodes(self) -> list[Any]:  # pragma: no cover - compatibility shim
            return list(self._nodes)

    class _NXStub:
        Graph = _GraphStub

    nx = _NXStub()  # type: ignore[assignment]

try:  # pragma: no cover - optional GNN dependency
    import torch_geometric.nn as pyg_nn
    HAS_PYG = True
except ImportError:  # pragma: no cover - deterministic fallback
    HAS_PYG = False

    class _GCNConvStub:
        def __init__(self, *_: Any, **__: Any) -> None:  # noqa: D401
            pass

        def forward(self, features: Any, _edge_index: Any) -> Any:  # noqa: D401
            return features

        __call__ = forward

    class _PygNNStub:
        GCNConv = _GCNConvStub

    pyg_nn = _PygNNStub()  # type: ignore[assignment]

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


def _basic_sentiment_stub(texts: list[str]) -> list[dict[str, Any]]:
    """Provide a lightweight fallback sentiment classifier for audits."""

    results: list[dict[str, Any]] = []
    for text in texts:
        lowered = text.lower()
        if any(keyword in lowered for keyword in {"bias", "drift", "alarm"}):
            results.append({"label": "NEGATIVE", "score": 0.85})
        elif "protect" in lowered or "ethical" in lowered:
            results.append({"label": "POSITIVE", "score": 0.6})
        else:
            results.append({"label": "NEUTRAL", "score": 0.5})
    return results


def _resolve_sentiment_runner():
    """Return a callable sentiment pipeline with deterministic fallback."""

    if pipeline is None or not HAS_TRANSFORMERS:
        return _basic_sentiment_stub
    try:  # pragma: no cover - depends on optional transformers setup
        return pipeline("sentiment-analysis")
    except Exception:  # pragma: no cover - fallback when pipeline init fails
        return _basic_sentiment_stub


def _mock_narrative_texts(viz_cid: str, wallet_id: str, sample_size: int = 10) -> list[str]:
    """Construct anonymized guardian narrative summaries for audits."""

    base_fragments = [
        "Guardian notes: Ethical alignment strong",
        "Mission brief: Resonance steady across pilots",
        "Guardian reflection: Bias watch active",
        "Field log: Narrative cadence stabilizing",
        "Pilot memo: Protect community trust",
    ]
    seed_material = f"{viz_cid}:{wallet_id}:{MISSION_STATEMENT}".encode("utf-8")
    seed = int(hashlib.sha256(seed_material).hexdigest(), 16) % (2**32)
    rng = np.random.default_rng(seed)
    texts: list[str] = []
    for idx in range(sample_size):
        fragment = base_fragments[idx % len(base_fragments)]
        suffix = rng.choice(["steady", "balanced", "needs review", "guardian focus", "ethical pulse"])
        texts.append(f"{fragment} :: {suffix}")
    return texts


def _sentiment_to_scalar(result: dict[str, Any]) -> float:
    """Convert classifier output to a normalized neutrality scalar."""

    label = str(result.get("label", "")).upper()
    score = float(result.get("score", 0.5))
    scaled = (score - 0.5) * 2.0
    if "NEG" in label:
        return -abs(scaled or score)
    if "POS" in label:
        return abs(scaled or score)
    return 0.0


def _temporal_weave_forecast(
    series_array: np.ndarray, sequence_length: int, forecast_steps: int
) -> tuple[list[float], float]:
    """Generate temporal weave forecasts using Torch when available."""

    if series_array.size < sequence_length + forecast_steps:
        return [], 0.0

    if not HAS_TORCH:
        base = float(series_array[-1])
        increments = np.linspace(0.0, 0.04, forecast_steps)
        predictions = np.clip(base + increments, 0.0, 1.0)
        return predictions.tolist(), 0.75

    torch.manual_seed(42)
    series_mean = float(series_array.mean())
    series_std = float(series_array.std() + 1e-6)
    normalized = (series_array - series_mean) / series_std
    tensor_series = torch.tensor(normalized, dtype=torch.float32).view(-1, 1)

    sequences: list[torch.Tensor] = []
    targets: list[torch.Tensor] = []
    for idx in range(len(tensor_series) - sequence_length):
        sequences.append(tensor_series[idx : idx + sequence_length])
        targets.append(tensor_series[idx + sequence_length])

    if not sequences:
        return [], 0.0

    train_x = torch.stack(sequences).unsqueeze(-1)
    train_y = torch.stack(targets).view(-1)

    class TemporalWeaveNet(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.lstm = nn.LSTM(1, 50, 1, batch_first=True)
            self.readout = nn.Linear(50, 1)

        def forward(self, features: torch.Tensor) -> torch.Tensor:  # noqa: D401
            output, _ = self.lstm(features)
            return self.readout(output[:, -1, :])

    model = TemporalWeaveNet()
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

    losses: list[float] = []
    for _ in range(40):
        optimizer.zero_grad()
        prediction = model(train_x).squeeze(-1)
        loss = criterion(prediction, train_y)
        loss.backward()
        optimizer.step()
        losses.append(float(loss.item()))

    last_window = tensor_series[-sequence_length:].unsqueeze(0)
    preds_normalized: list[float] = []
    with torch.no_grad():
        window = last_window.clone()
        for _ in range(forecast_steps):
            next_pred = float(model(window).squeeze().item())
            preds_normalized.append(next_pred)
            next_tensor = torch.tensor([[next_pred]], dtype=torch.float32)
            window = torch.cat([window[:, 1:, :], next_tensor.view(1, 1, 1)], dim=1)

    predicted_values = [
        float(np.clip(pred * series_std + series_mean, 0.0, 1.0))
        for pred in preds_normalized
    ]
    weave_conf = float(np.clip(np.exp(-np.mean(losses)), 0.0, 1.0))
    return predicted_values, weave_conf


def _federated_mean(scores: list[float]) -> tuple[float, float]:
    """Compute a federated mean and zk-style homomorphic sum."""

    if not scores:
        return 0.0, 0.0

    arr = np.asarray(scores, dtype=float)
    zk_sum = float(arr.sum())
    return float(arr.mean()), zk_sum


def _graph_diversity_score(
    node_gradients: list[float],
    edges: list[tuple[str, str]],
    node_index: dict[str, int],
) -> float:
    """Estimate diversity score across guardian vote gradients."""

    if not node_gradients:
        return 0.0

    gradient_array = np.asarray(node_gradients, dtype=float)
    std_component = float(np.clip(np.std(gradient_array) * 2.0, 0.0, 1.0))

    edge_diffs: list[float] = []
    for source, target in edges:
        if source not in node_index or target not in node_index:
            continue
        source_idx = node_index[source]
        target_idx = node_index[target]
        diff = abs(float(gradient_array[source_idx]) - float(gradient_array[target_idx]))
        edge_diffs.append(diff)

    neighbor_component = (
        float(np.clip(np.mean(edge_diffs), 0.0, 1.0)) if edge_diffs else std_component
    )
    gnn_component = neighbor_component

    if HAS_TORCH and HAS_PYG and torch is not None and edges:
        try:
            feature_tensor = torch.tensor(gradient_array, dtype=torch.float32).view(-1, 1)
            edge_index_pairs: list[list[int]] = []
            for source, target in edges:
                if source not in node_index or target not in node_index:
                    continue
                source_idx = node_index[source]
                target_idx = node_index[target]
                edge_index_pairs.append([source_idx, target_idx])
                edge_index_pairs.append([target_idx, source_idx])

            if edge_index_pairs:
                edge_index = (
                    torch.tensor(edge_index_pairs, dtype=torch.long).t().contiguous()
                )
                conv = pyg_nn.GCNConv(1, 1)
                with torch.no_grad():
                    conv_output = conv(feature_tensor, edge_index)
                    gnn_diff = torch.abs(conv_output - feature_tensor).mean().item()
                    gnn_component = float(np.clip(gnn_diff, 0.0, 1.0))
        except Exception:
            gnn_component = neighbor_component

    score = float(np.clip((std_component + neighbor_component + gnn_component) / 3.0, 0.0, 1.0))
    return score


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


@app.route("/narrative_neutrality_audit/<viz_cid>", methods=["GET"])
def narrative_neutrality_audit(viz_cid: str):
    """Run a BERT-style neutrality audit on guardian narratives."""

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
    texts = list(record.get("narratives") or _mock_narrative_texts(viz_cid, wallet_id))
    auth_hash = hashlib.sha256(auth_header.encode("utf-8")).hexdigest()

    if not texts:
        aggregate_hash = _compute_zk_hash([], wallet_id, auth_hash)
        dispatch_to_base_oracle(viz_cid, aggregate_hash)
        response = {
            "neutrality_score": 0.0,
            "bias_alert": False,
            "balanced_recommendation": "neutral",
            "message": "no_narratives",
            "text_aggregate_hash": aggregate_hash,
            "narrative_count": 0,
            "mission_statement": MISSION_STATEMENT,
        }
        return jsonify(response), 200

    runner = _resolve_sentiment_runner()
    raw_results = runner(texts)
    if not isinstance(raw_results, list):
        raw_results = list(raw_results)

    scalars = [_sentiment_to_scalar(result) for result in raw_results if isinstance(result, dict)]
    avg_score = float(sum(scalars) / len(scalars)) if scalars else 0.0
    abs_avg = abs(avg_score)
    bias_alert = abs_avg > 0.5
    is_neutral = abs_avg < 0.2
    recommendation = "neutral" if is_neutral else "rebalance"

    hashed_entries = [
        {
            "hash": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            "length": len(text),
        }
        for text in texts
    ]
    aggregate_hash = _compute_zk_hash(hashed_entries, wallet_id, auth_hash)

    bio_data = telemetry.fetch_mock_bio_data(wallet_id)
    erv_score, encrypted_res = telemetry.run_erv_simulation(bio_data)
    adjusted_erv = max(0.0, erv_score - 0.1) if not is_neutral else erv_score
    telemetry.simulate_cascade(adjusted_erv, encrypted_res)

    mission_clause = "protect" if "protect" in MISSION_STATEMENT.lower() else "safeguard"
    emit_id: str | None = None
    if bias_alert:
        emit_id = str(uuid.uuid4())
        STREAM_EMIT_QUEUE.append(
            {
                "narrative_alert": True,
                "score": round(avg_score, 4),
                "emit_id": emit_id,
                "viz_cid": viz_cid,
                "mission_statement": MISSION_STATEMENT,
            }
        )

    audit_record = {
        "timestamp": time.time(),
        "neutrality": round(avg_score, 4),
        "bias_alert": bias_alert,
        "aggregate_hash": aggregate_hash,
    }
    record.setdefault("narrative_audits", []).append(audit_record)

    dispatch_to_base_oracle(viz_cid, aggregate_hash)

    response = {
        "neutrality_score": round(avg_score, 4),
        "bias_alert": bias_alert,
        "balanced_recommendation": recommendation,
        "resonance_baseline": round(erv_score, 4),
        "resonance_adjusted": round(adjusted_erv, 4),
        "text_aggregate_hash": aggregate_hash,
        "narrative_count": len(texts),
        "mission_statement": MISSION_STATEMENT,
        "recommendation_detail": f"{mission_clause} {MISSION_STATEMENT} narratives against bias",
    }
    if emit_id is not None:
        response["emit_id"] = emit_id
    return jsonify(response), 200


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


@app.route("/resonance_fusion_layer/<viz_cid>", methods=["POST"])
def resonance_fusion_layer(viz_cid: str):
    """Blend ERV gradients using weighted and neural fusion for pilots."""

    auth_header = request.headers.get("Authorization", "")
    if auth_header != "Bearer guardian_token":
        abort(401, "guardian_auth_required")

    payload = request.get_json(silent=True) or {}
    raw_gradients = payload.get("individual_gradients") or []
    raw_weights = payload.get("fusion_weights") or []

    if not isinstance(raw_gradients, list) or not raw_gradients:
        abort(400, "gradients_required")
    if not isinstance(raw_weights, list) or len(raw_weights) != len(raw_gradients):
        abort(400, "invalid_fusion_weights")

    try:
        gradient_values = [float(value) for value in raw_gradients]
    except (TypeError, ValueError):
        abort(400, "invalid_gradient_values")

    try:
        weight_values = [float(value) for value in raw_weights]
    except (TypeError, ValueError):
        abort(400, "invalid_weight_values")

    record = PINNED_VIZ.get(viz_cid)
    if record is None:
        abort(404, "viz_not_found")

    mission_anchor = record.get("mission_anchor", MISSION_STATEMENT)
    wallet_id = record.get("wallet", "guardian::anon")
    consent_flag = bool(record.get("consent", True))
    telemetry = TelemetryClass(mission_anchor, consent=consent_flag)
    if not getattr(telemetry, "consent", True):
        abort(403, "consent_required")

    weight_array = np.asarray(weight_values, dtype=float)
    gradient_array = np.asarray(gradient_values, dtype=float)

    weights_sum = float(weight_array.sum())
    if abs(weights_sum) <= 1e-9:
        normalized_weights = np.full(weight_array.shape, 1.0 / max(len(weight_array), 1), dtype=float)
    else:
        normalized_weights = weight_array / weights_sum

    try:
        weighted_avg = float(np.average(gradient_array, weights=normalized_weights))
    except ZeroDivisionError:
        weighted_avg = float(gradient_array.mean())
    weighted_avg = max(0.0, min(weighted_avg, 1.0))

    input_dim = gradient_array.size
    if input_dim == 0:
        abort(400, "gradients_required")

    if HAS_TORCH:
        class ResonanceFusionNet(nn.Module):
            def __init__(self, dimensions: int):
                super().__init__()
                self.layer = nn.Linear(dimensions, 1)
                self.activation = nn.Sigmoid()

            def forward(self, features: torch.Tensor) -> torch.Tensor:  # noqa: D401
                return self.activation(self.layer(features))

        model = ResonanceFusionNet(input_dim)
        gradient_tensor = torch.tensor(gradient_array, dtype=torch.float32).unsqueeze(0)
        normalized_tensor = torch.tensor(normalized_weights, dtype=torch.float32).view(1, -1)

        with torch.no_grad():
            model.layer.weight.copy_(normalized_tensor)
            model.layer.bias.zero_()
            fusion_score = float(model(gradient_tensor).squeeze().item())
    else:
        fusion_score = float(np.clip(weighted_avg, 0.0, 1.0))

    hybrid_score = float(np.clip((weighted_avg + fusion_score) / 2.0, 0.0, 1.0))

    record.setdefault("fusion_layer_hybrids", []).append(
        {
            "timestamp": time.time(),
            "weighted_average": round(weighted_avg, 4),
            "fusion_score": round(fusion_score, 4),
            "hybrid_score": round(hybrid_score, 4),
        }
    )
    record["last_hybrid_score"] = hybrid_score

    bio_data = telemetry.fetch_mock_bio_data(wallet_id)
    baseline_score, encrypted_res = telemetry.run_erv_simulation(bio_data)
    resonance_ready = telemetry.simulate_cascade(baseline_score, encrypted_res)

    emit_id = str(uuid.uuid4())
    STREAM_EMIT_QUEUE.append(
        {
            "guardian_sync": "resonance_fusion",
            "viz_cid": viz_cid,
            "wallet": wallet_id,
            "weighted_average": round(weighted_avg, 4),
            "fusion_score": round(fusion_score, 4),
            "hybrid_score": round(hybrid_score, 4),
            "baseline_score": round(float(baseline_score), 4),
            "resonance_ready": bool(resonance_ready),
            "fusion_weights": [round(float(value), 4) for value in normalized_weights.tolist()],
            "emit_id": emit_id,
            "mission_anchor": mission_anchor,
        }
    )

    response = {
        "viz_cid": viz_cid,
        "wallet": wallet_id,
        "weighted_average": round(weighted_avg, 4),
        "fusion_score": round(fusion_score, 4),
        "hybrid_score": round(hybrid_score, 4),
        "baseline_score": round(float(baseline_score), 4),
        "resonance_ready": bool(resonance_ready),
        "fusion_weights": [round(float(value), 4) for value in normalized_weights.tolist()],
        "emit_id": emit_id,
        "mission_statement": MISSION_STATEMENT,
    }
    return jsonify(response), 200


@app.route("/temporal_resonance_weave/<viz_cid>", methods=["GET"])
def temporal_resonance_weave(viz_cid: str):
    """Project temporal resonance trends with lightweight LSTM weaving."""

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
    telemetry = TelemetryClass(mission_anchor, consent=bool(record.get("consent", True)))
    if not getattr(telemetry, "consent", True):
        abort(403, "consent_required")

    wallet_id = record.get("wallet", "guardian::anon")
    history_entries = list(record.get("belief_evolution", []))
    if not history_entries:
        series_stub = _collect_resonance_series(telemetry, wallet_id, periods=24)
        history_entries = [
            {"timestamp": str(ts), "score": float(val)}
            for ts, val in zip(getattr(series_stub, "index", range(len(series_stub))), series_stub)
        ]

    scores = [float(entry.get("score", 0.0)) for entry in history_entries if "score" in entry]
    if not scores:
        scores = [0.5]

    bio_snapshot = telemetry.fetch_mock_bio_data(wallet_id)
    gradient_now, encrypted_res = telemetry.run_erv_simulation(bio_snapshot)
    _ = encrypted_res
    scores.append(float(max(0.0, min(1.0, gradient_now))))

    series_array = np.asarray(scores, dtype=float)

    sequence_length = 10
    forecast_steps = 5
    predicted_values, weave_conf = _temporal_weave_forecast(
        series_array, sequence_length, forecast_steps
    )
    if not predicted_values:
        return jsonify({"weave_conf": 0.0, "insufficient_history": True}), 200

    mission_vectors = {
        "empathy": np.linspace(0.75, 0.95, forecast_steps),
        "protect": np.linspace(0.7, 0.9, forecast_steps),
    }
    correlation_scores: dict[str, float] = {}
    prediction_vector = np.asarray(predicted_values, dtype=float)
    for clause, template in mission_vectors.items():
        denom = float(np.linalg.norm(prediction_vector) * np.linalg.norm(template))
        if denom == 0.0:
            score = 0.0
        else:
            score = float(np.clip(np.dot(prediction_vector, template) / denom, 0.0, 1.0))
        correlation_scores[clause] = round(score, 4)

    dominant_clause = "protect" if "protect" in MISSION_STATEMENT.lower() else "empathy"
    dominant_score = correlation_scores.get(dominant_clause, 0.0)
    alert = dominant_score < 0.6

    fusion_reference = float(record.get("last_hybrid_score", dominant_score))
    dispatch_payload = [
        {"step": idx, "score": value}
        for idx, value in enumerate(predicted_values, start=1)
    ]
    zk_proof = _compute_zk_hash(dispatch_payload, wallet_id, record.get("auth_hash", ""))

    timestamp = time.time()
    record.setdefault("belief_evolution", []).extend(
        {
            "timestamp": timestamp + idx,
            "score": value,
            "source": "temporal_weave",
            "hybrid_bridge": fusion_reference,
        }
        for idx, value in enumerate(predicted_values)
    )

    response = {
        "predicted_trend": [round(value, 4) for value in predicted_values],
        "correlation_scores": correlation_scores,
        "weave_conf": round(weave_conf, 4),
        "alert": alert,
        "mission_statement": MISSION_STATEMENT,
        "zk_proof": zk_proof,
    }

    if weave_conf > 0.7:
        emit_id = str(uuid.uuid4())
        STREAM_EMIT_QUEUE.append(
            {
                "guardian_sync": "temporal_weave",
                "temporal_weave": True,
                "trend_forecast": response["predicted_trend"],
                "emit_id": emit_id,
                "mission_statement": MISSION_STATEMENT,
            }
        )
        dispatch_to_base_oracle(viz_cid, zk_proof)
        response["emit_id"] = emit_id

    response["correlation_scores"]["fusion_bridge"] = round(fusion_reference, 4)

    return jsonify(response), 200


@app.route("/collective_empathy_oracle/<viz_cid>", methods=["GET"])
def collective_empathy_oracle(viz_cid: str):
    """Compute a collective empathy baseline anchored to ``MISSION_STATEMENT``."""

    auth_header = request.headers.get("Authorization", "")
    if auth_header != "Bearer guardian_token":
        abort(401, "guardian_auth_required")

    record = PINNED_VIZ.get(viz_cid)
    mission_anchor = record.get("mission_statement", MISSION_STATEMENT) if record else MISSION_STATEMENT

    telemetry = TelemetryClass(mission_anchor, consent=True)
    if not getattr(telemetry, "consent", True):
        abort(403, "consent_required")

    guardian_sources = list(getattr(telemetry, "guardian_pool", []))
    if not guardian_sources:
        seed_material = f"{viz_cid}:{mission_anchor}"
        seed = int(hashlib.sha256(seed_material.encode("utf-8")).hexdigest(), 16) % (2**32)
        rng = np.random.default_rng(seed)
        count = int(rng.integers(5, 11))
        guardian_sources = []
        for idx in range(count):
            guardian_sources.append(
                {
                    "guardian_id": f"guardian::{idx:02d}",
                    "hrv": round(float(rng.uniform(0.74, 0.94)), 4),
                    "arousal": "steady" if idx % 2 == 0 else "focused",
                }
            )

    contributions: list[float] = []
    for source in guardian_sources:
        if not bool(source.get("consent", True)):
            continue
        guardian_id = str(source.get("guardian_id", f"guardian::{uuid.uuid4()}"))
        bio_snapshot = telemetry.fetch_mock_bio_data(guardian_id)
        merged_bio = {**bio_snapshot, **source, "guardian_id": guardian_id}
        erv_score, encrypted_res = telemetry.run_erv_simulation(merged_bio)
        if hasattr(telemetry, "simulate_cascade"):
            attested = telemetry.simulate_cascade(erv_score, encrypted_res)
            if not attested:
                continue
        gradient = float(np.clip(source.get("score", erv_score), 0.0, 1.0))
        contributions.append(gradient)

    contributors = len(contributions)
    if contributors == 0:
        return jsonify({"collective_score": 0.5, "empathy_baseline": "awaiting_council", "contributors": 0}), 200

    avg_score, zk_sum = _federated_mean(contributions)
    mission_text = mission_anchor.lower()
    mission_weight = 1.0
    if "empathy" in mission_text:
        mission_weight = 1.08

    collective_resonance = float(np.clip(avg_score * mission_weight, 0.0, 1.0))
    empathy_baseline = "high" if collective_resonance > 0.8 else "steady"
    zk_proof = hashlib.sha256(f"{viz_cid}:{zk_sum:.6f}".encode("utf-8")).hexdigest()

    if collective_resonance > 0.7:
        STREAM_EMIT_QUEUE.append(
            {
                "guardian_sync": "collective_empathy",
                "collective_empathy": round(collective_resonance, 4),
                "emit_id": str(uuid.uuid4()),
                "mission_statement": mission_anchor,
                "zk_proof": zk_proof,
            }
        )

    response = {
        "collective_score": round(collective_resonance, 4),
        "empathy_baseline": empathy_baseline,
        "contributors": contributors,
    }
    return jsonify(response), 200


@app.route("/echo_chamber_detector/<viz_cid>", methods=["POST"])
def echo_chamber_detector(viz_cid: str):
    """Detect potential echo chambers within guardian vote graphs."""

    auth_header = request.headers.get("Authorization", "")
    if auth_header != "Bearer guardian_token":
        abort(401, "guardian_auth_required")

    record = PINNED_VIZ.get(viz_cid)
    if record is None:
        abort(404, "viz_not_found")

    mission_anchor = record.get("mission_anchor", MISSION_STATEMENT)
    consent_flag = bool(record.get("consent", True))
    telemetry = TelemetryClass(mission_anchor, consent=consent_flag)
    if not getattr(telemetry, "consent", True):
        abort(403, "consent_required")

    payload = request.get_json(silent=True) or {}
    vote_graph = payload.get("vote_graph")
    if not isinstance(vote_graph, dict):
        abort(400, "graph_invalid")

    nodes = vote_graph.get("nodes") or []
    edges = vote_graph.get("edges") or []
    if not isinstance(nodes, list) or not isinstance(edges, list):
        abort(400, "graph_invalid")

    fallback_gradient = record.get("last_hybrid_score")
    if fallback_gradient is None and isinstance(record.get("results"), list):
        try:
            fallback_gradient = float(
                np.mean(
                    [
                        float(entry.get("score", 0.5))
                        for entry in record["results"]
                        if isinstance(entry, dict)
                    ]
                )
            )
        except (TypeError, ValueError):
            fallback_gradient = None
    if fallback_gradient is None:
        fallback_gradient = 0.5

    graph = nx.Graph()
    node_gradients: list[float] = []
    node_index: dict[str, int] = {}

    for node in nodes:
        if not isinstance(node, dict):
            abort(400, "graph_invalid")
        raw_guardian = node.get("guardian_id")
        if not raw_guardian:
            abort(400, "graph_invalid")
        guardian_id = str(raw_guardian)
        if guardian_id in node_index:
            continue

        gradient_value: float
        if "gradient" in node and node["gradient"] is not None:
            try:
                gradient_value = float(node["gradient"])
            except (TypeError, ValueError):
                abort(400, "graph_invalid")
        else:
            bio_snapshot = telemetry.fetch_mock_bio_data(guardian_id)
            erv_score, encrypted_res = telemetry.run_erv_simulation(bio_snapshot)
            if hasattr(telemetry, "simulate_cascade") and not telemetry.simulate_cascade(
                erv_score, encrypted_res
            ):
                gradient_value = float(fallback_gradient)
            else:
                gradient_value = float(erv_score)

        gradient_value = float(np.clip(gradient_value, 0.0, 1.0))
        graph.add_node(guardian_id, gradient=gradient_value)
        node_index[guardian_id] = len(node_index)
        node_gradients.append(gradient_value)

    if not node_index:
        abort(400, "graph_invalid")

    normalized_edges: list[tuple[str, str]] = []
    for edge in edges:
        if not isinstance(edge, (list, tuple)) or len(edge) != 2:
            abort(400, "graph_invalid")
        source_raw, target_raw = edge
        source = str(source_raw)
        target = str(target_raw)
        if source not in node_index or target not in node_index or source == target:
            abort(400, "graph_invalid")
        graph.add_edge(source, target)
        normalized_edges.append((source, target))

    try:
        diversity_threshold = float(payload.get("diversity_threshold", 0.3))
    except (TypeError, ValueError):
        diversity_threshold = 0.3
    diversity_threshold = float(np.clip(diversity_threshold, 0.0, 1.0))

    homogeneity_score = _graph_diversity_score(node_gradients, normalized_edges, node_index)
    homogeneity_score = float(np.clip(homogeneity_score, 0.0, 1.0))
    echo_alert = homogeneity_score < diversity_threshold

    recommendation = (
        f"diversify guardians to protect {MISSION_STATEMENT} from bias"
        if echo_alert
        else f"balanced guardians protect {MISSION_STATEMENT}"
    )

    aggregate_payload = {
        "node_count": len(node_gradients),
        "avg_gradient": round(float(np.mean(node_gradients)), 4),
        "std_gradient": round(float(np.std(node_gradients)), 4),
        "threshold": diversity_threshold,
    }
    auth_hash = str(record.get("auth_hash", "guardian::aggregate"))
    wallet_id = str(record.get("wallet", "guardian::anon"))
    zk_graph_hash = _compute_zk_hash([aggregate_payload], wallet_id, auth_hash)

    response: dict[str, Any] = {
        "homogeneity_score": round(homogeneity_score, 4),
        "echo_alert": echo_alert,
        "diversity_recommendation": recommendation,
        "zk_graph_hash": zk_graph_hash,
    }

    if echo_alert:
        emit_id = str(uuid.uuid4())
        STREAM_EMIT_QUEUE.append(
            {
                "guardian_sync": "echo_chamber",
                "echo_alert": True,
                "score": round(homogeneity_score, 4),
                "viz_cid": viz_cid,
                "emit_id": emit_id,
            }
        )
        dispatch_to_base_oracle(viz_cid, zk_graph_hash)
        response["emit_id"] = emit_id

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
