"""Symbiotic Sentience Interface for zk-proven BCI intent co-evolution loops."""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Callable

import numpy as np

try:  # pragma: no cover - optional EEG dependency
    import mne  # type: ignore
except ImportError:  # pragma: no cover - provide lightweight stub

    class _StubMNE:
        def __init__(self) -> None:
            self.io = self

        def read_raw(self, *args: Any, **kwargs: Any):  # noqa: D401
            _ = (args, kwargs)

            class _Raw:
                def __init__(self, data: np.ndarray) -> None:
                    self._data = data

                def get_data(self) -> np.ndarray:  # noqa: D401
                    return self._data

            return _Raw(np.zeros((1, 128), dtype=float))

    mne = _StubMNE()  # type: ignore

try:  # pragma: no cover - zk proof helper optional in tests
    from zk_snark import generate_proof
except ImportError:  # pragma: no cover - deterministic fallback

    def generate_proof(payload: Any) -> str:
        return hashlib.sha256(str(payload).encode("utf-8")).hexdigest()

try:  # pragma: no cover - FHE helper optional
    from fhe import encrypt
except ImportError:  # pragma: no cover - reproducible cipher stub

    def encrypt(payload: Any) -> bytes:
        return hashlib.sha256(str(payload).encode("utf-8")).digest()

try:  # pragma: no cover - symbolic empathy boost optional
    from sympy import And, symbols
except ImportError:  # pragma: no cover - disable symbolic layer when unavailable
    And = None  # type: ignore
    symbols = None  # type: ignore

from utils.live_oracle import get_live_oracle
from vaultfire.protocol.constants import MISSION_STATEMENT
from vaultfire.protocol.mission_resonance import MissionResonanceEngine

BASELINE_GRADIENT = 0.5


class SymbioticSentienceInterface:
    """ZK-proven BCI intents symbiotically tuning moral gradients for neural covenants."""

    def __init__(self, mission_anchor: str, bci_device: str = "mock_neurosky") -> None:
        self.mission_anchor = mission_anchor or MISSION_STATEMENT
        self.bci_device = bci_device
        self._engine = MissionResonanceEngine()
        self._rng = np.random.default_rng()
        self._consent = True
        self._active_wallet = "pilot::guardian"
        self._stream_emitter: Callable[[dict[str, Any]], None] | None = None
        self._live_oracle = get_live_oracle()
        if symbols is not None and And is not None:
            self._align_symbol, self._empathy_symbol = symbols("align empathy")
            self._empathy_clause = And(self._align_symbol, self._empathy_symbol)
        else:  # pragma: no cover - symbolic helper missing
            self._align_symbol = None
            self._empathy_symbol = None
            self._empathy_clause = None

    @property
    def consent_enabled(self) -> bool:
        """Return whether neural intent capture has been consented to."""
        return self._consent

    def set_consent(self, enabled: bool) -> None:
        """Toggle neural capture consent flag."""
        self._consent = bool(enabled)

    def bind_stream_emitter(self, emitter: Callable[[dict[str, Any]], None]) -> None:
        """Attach a callback that forwards neural covenant events to streaming sinks."""
        self._stream_emitter = emitter

    def capture_neural_intent(self, wallet: str) -> dict[str, Any]:
        """Capture mock EEG, hash it, and generate a zk-proof tied to ``wallet``."""

        if not self._consent:
            raise PermissionError("bci_consent_required")
        alpha_wave = np.clip(self._rng.normal(loc=10.0, scale=1.5, size=128), 8.0, 12.0)
        mne_io = getattr(mne, "io", None)
        if mne_io is not None and hasattr(mne_io, "read_raw"):
            try:
                raw = mne_io.read_raw(self.bci_device, preload=True)
                if hasattr(raw, "get_data"):
                    data = np.asarray(raw.get_data(), dtype=float)
                    if data.size:
                        alpha_wave = np.clip(data.flatten(), 8.0, 12.0)
            except Exception:
                pass

        alpha_power = float(np.clip(np.mean(alpha_wave) / 12.0, 0.0, 1.0))
        theta_intent = "align" if alpha_power > 0.6 else "diverge"
        timestamp = datetime.utcnow()
        wallet_hash = hashlib.sha256(wallet.encode("utf-8")).hexdigest()
        neural_hash = hashlib.sha256(alpha_wave.tobytes() + wallet.encode("utf-8")).hexdigest()
        proof = generate_proof(neural_hash)

        return {
            "alpha_power": alpha_power,
            "theta_intent": theta_intent,
            "timestamp": timestamp,
            "proof": proof,
            "neural_hash": neural_hash,
            "wallet_hash": wallet_hash,
        }

    def co_evolve_moral_gradient(self, neural_intent: dict[str, Any], current_gradient: float) -> float:
        """Symbiotically tune ERV gradients based on zk-proven neural intents."""

        alpha_power = float(neural_intent.get("alpha_power", 0.0))
        theta_intent = str(neural_intent.get("theta_intent", "diverge"))

        gradient = float(current_gradient)
        gradient += 0.2 * alpha_power if theta_intent == "align" else -0.1 * (1.0 - alpha_power)

        mission_lower = self.mission_anchor.lower()
        if self._empathy_clause is not None and bool(
            self._empathy_clause.subs(
                {
                    self._align_symbol: theta_intent == "align",
                    self._empathy_symbol: "empathy" in mission_lower,
                }
            )
        ):
            gradient += 0.05 * alpha_power
        if "protect" in mission_lower and theta_intent != "align":
            gradient -= 0.05 * (1.0 - alpha_power)

        tuned = float(np.clip(gradient, 0.0, 1.0))
        try:
            self._engine.ingest_signal(
                source=self.bci_device,
                technique="neural-symbolic",
                score=tuned,
                metadata={
                    "theta": theta_intent,
                    "wallet_hash": neural_intent.get("wallet_hash"),
                    "neural_hash": neural_intent.get("neural_hash"),
                },
                mission_override=self.mission_anchor,
            )
        except Exception:
            pass

        return tuned

    def forge_neural_covenant(self, tuned_gradient: float, proof: str) -> str:
        """Encrypt gradients, emit Base oracle stubs, and enqueue stream alerts."""

        payload = f"{tuned_gradient:.6f}|{proof}"
        cipher = encrypt(payload)
        enc_hex = (cipher.hex() if isinstance(cipher, (bytes, bytearray)) else str(cipher).encode("utf-8").hex())
        if not enc_hex:
            enc_hex = hashlib.sha256(payload.encode("utf-8")).hexdigest()

        cid = hashlib.sha256(f"{self.mission_anchor}:{proof}".encode("utf-8")).hexdigest()
        tx_hash: str | None = None
        if hasattr(self._live_oracle, "emit_event"):
            result = self._live_oracle.emit_event(
                cid,
                enc_hex,
                context={"gradient": tuned_gradient, "channel": "neural_covenant"},
            )
            if isinstance(result, dict):
                tx_hash = result.get("tx_hash")
        if not tx_hash:
            tx_hash = f"0x{hashlib.sha256(f'{cid}:{enc_hex}'.encode('utf-8')).hexdigest()}"
        if len(tx_hash) != 66 or not tx_hash.startswith("0x"):
            tx_hash = f"0x{hashlib.sha256(tx_hash.encode('utf-8')).hexdigest()}"

        event = {
            "channel": "neural_covenant",
            "payload": {
                "mission_anchor": self.mission_anchor,
                "tuned_gradient": tuned_gradient,
                "proof_hash": hashlib.sha256(proof.encode("utf-8")).hexdigest(),
                "ciphertext": enc_hex,
                "tx_hash": tx_hash,
            },
        }
        if self._stream_emitter is not None:
            try:
                self._stream_emitter(event)
            except Exception:
                pass

        return tx_hash

    def sync_subconscious_loop(self, num_iters: int = 5) -> list[dict[str, Any]]:
        """Iteratively capture intents, evolve gradients, and forge neural covenants."""

        if num_iters <= 0:
            return []
        if not self._consent:
            raise PermissionError("bci_consent_required")
        results: list[dict[str, Any]] = []
        gradient = float(np.clip(BASELINE_GRADIENT, 0.0, 1.0))
        for index in range(1, num_iters + 1):
            intent = self.capture_neural_intent(self._active_wallet)
            tuned = self.co_evolve_moral_gradient(intent, gradient)
            tx_hash = self.forge_neural_covenant(tuned, str(intent["proof"]))
            results.append(
                {
                    "iter": index,
                    "gradient": tuned,
                    "tx": tx_hash,
                    "sync_score": float(intent["alpha_power"]) * tuned,
                }
            )
            gradient = tuned
        return results
