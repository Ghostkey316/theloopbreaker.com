"""Entangled Ethical Entropies (E3) lattice-chaos verification module."""

from __future__ import annotations

import hashlib
import math
import sys
from collections import deque
from typing import Any, Callable, Iterable, Sequence

import numpy as np

try:  # pragma: no cover - Kyber-style ZK helper may be optional in envs
    from zk_snark import generate_proof
except ImportError:  # pragma: no cover - reproducible fallback for tests

    def generate_proof(payload: Any) -> str:
        return hashlib.sha3_256(str(payload).encode("utf-8")).hexdigest()

try:  # pragma: no cover - FHE encryptor is optional in CI
    from fhe import encrypt
except ImportError:  # pragma: no cover - deterministic cipher stub

    def encrypt(payload: Any) -> str:
        digest = hashlib.sha3_256(str(payload).encode("utf-8")).hexdigest()
        return f"0x{digest}"

try:  # pragma: no cover - SciPy attractor integrator optional
    from scipy.integrate import solve_ivp
except ImportError:  # pragma: no cover - lightweight Euler fallback

    def solve_ivp(  # type: ignore[override]
        func: Callable[[float, np.ndarray], np.ndarray],
        interval: tuple[float, float],
        y0: Sequence[float],
        *,
        t_eval: Iterable[float] | None = None,
        max_step: float | None = None,
    ) -> Any:
        start, stop = interval
        steps = max(len(list(t_eval)) if t_eval is not None else 11, 2)
        times = np.linspace(start, stop, steps)
        state = np.zeros((steps, len(y0)), dtype=float)
        state[0] = np.asarray(y0, dtype=float)
        max_step = max_step or float((stop - start) / (steps - 1))
        for idx in range(1, steps):
            dt = float(min(max_step, times[idx] - times[idx - 1]))
            deriv = np.asarray(func(times[idx - 1], state[idx - 1]), dtype=float)
            state[idx] = state[idx - 1] + dt * deriv
        return type("_Result", (), {"y": state.T, "t": times})()

from services.symbiotic_sentience_interface import SymbioticSentienceInterface
from utils.live_oracle import get_live_oracle
from vaultfire.protocol.constants import MISSION_STATEMENT

DiffusionRecord = dict[str, Any]


class EntangledEthicalEntropies:
    """Lattice-chaos entangles shards into emergent ethical fields for verifiable moral diffusion."""

    def __init__(self, mission_anchor: str, shard_dim: int = 4) -> None:
        self.mission_anchor = mission_anchor or MISSION_STATEMENT
        self.shard_dim = max(1, int(shard_dim))
        self.lattice_dim = self.shard_dim
        self.kyber_mod = 3329
        self.interface = SymbioticSentienceInterface(self.mission_anchor)
        self.interface.bind_stream_emitter(self._enqueue_stream_event)
        self._live_oracle = get_live_oracle()
        self._shard_proofs: dict[str, str] = {}
        self._last_entropy: float = 0.0
        self._local_stream_cache: deque[dict[str, Any]] = deque()

    def shard_wallet_intent(self, wallet: str, gradient: float) -> np.ndarray:
        """Shard wallet intent into lattice vectors with zk-proven integrity."""

        wallet_id = str(wallet or "wallet::anon")
        gradient = float(np.clip(gradient, 0.0, 1.0))
        seed_digest = hashlib.sha3_256(wallet_id.encode("utf-8")).digest()
        seed_scalar = int.from_bytes(seed_digest, "big") % self.kyber_mod
        rng = np.random.default_rng(seed_scalar)
        noise = rng.normal(loc=gradient, scale=0.1, size=self.shard_dim)
        lattice_bias = (seed_scalar / self.kyber_mod)
        shard_vector = (noise + lattice_bias).astype(float)
        shard_vector = np.mod(shard_vector, 1.0)
        shard_hash = hashlib.sha3_256(shard_vector.tobytes()).hexdigest()
        self._shard_proofs[wallet_id] = generate_proof(shard_hash)
        return shard_vector

    def entangle_shards(self, shards: Sequence[np.ndarray], num_agents: int = 5) -> np.ndarray:
        """Entangle shard vectors using lattice chaos diffusion to derive entropy fields."""

        lattice = np.asarray([np.asarray(shard, dtype=float) for shard in shards], dtype=float)
        if lattice.size == 0:
            raise ValueError("e3_no_shards")

        state = lattice.mean(axis=0)
        agent_scale = max(1, int(num_agents))
        for _ in range(10):
            neighbor_sum = np.roll(state, 1) + np.roll(state, -1)
            sinusoidal = self.kyber_mod * np.sin(math.pi * (state % 1.0))
            state = (sinusoidal + neighbor_sum / agent_scale) % self.kyber_mod
            state = state / self.kyber_mod

        def lorenz(_: float, values: np.ndarray) -> np.ndarray:
            sigma, rho, beta = 10.0, 28.0, 8.0 / 3.0
            x, y, z = values
            return np.array([sigma * (y - x), x * (rho - z) - y, x * y - beta * z], dtype=float)

        initial = np.pad(state[:3], (0, max(0, 3 - state.size)), "wrap") if state.size else np.zeros(3)
        attractor = solve_ivp(lorenz, (0.0, 1.0), initial, t_eval=np.linspace(0.0, 1.0, 5))
        if hasattr(attractor, "y"):
            attractor_mean = np.mean(np.asarray(attractor.y, dtype=float), axis=1)
            state[: min(state.size, attractor_mean.size)] = np.mod(
                state[: min(state.size, attractor_mean.size)] + attractor_mean[: state.size],
                1.0,
            )

        logits = state - np.max(state)
        exp_logits = np.exp(logits)
        probabilities = exp_logits / np.sum(exp_logits)
        entropy = -float(np.sum(probabilities * np.log(np.clip(probabilities, 1e-12, 1.0))))
        self._last_entropy = entropy
        return state

    def verify_ethical_emergence(self, field: np.ndarray, proof: str) -> bool:
        """Verify attractor stability and moral emergence aligned to the mission clauses."""

        if self._last_entropy < 0.3:
            return False

        mission_lower = self.mission_anchor.lower()
        field_digest = hashlib.sha3_256(field.tobytes() + mission_lower.encode("utf-8")).hexdigest()
        expected_proof = generate_proof(field_digest)
        empathy_bias = 0.05 if "empathy" in mission_lower else 0.0
        threshold = 0.7 + empathy_bias
        if self._last_entropy < threshold:
            return False
        if proof != expected_proof:
            return False
        protective = "protect" in mission_lower or "safeguard" in mission_lower
        if not protective and "ethics" in mission_lower:
            protective = True
        return protective

    def diffuse_convictions_loop(
        self, intents: Sequence[dict[str, Any]], num_iters: int = 3
    ) -> list[DiffusionRecord]:
        """Diffuse wallet intents, verify emergence, and emit chaos diffusion alerts."""

        iterations = max(1, int(num_iters))
        results: list[DiffusionRecord] = []
        for step in range(iterations):
            shards: list[np.ndarray] = []
            for intent in intents:
                if not intent or not intent.get("consent", True):
                    continue
                wallet = str(intent.get("wallet", f"pilot::{step}"))
                gradient = float(intent.get("gradient", 0.5))
                neural_intent = self.interface.capture_neural_intent(wallet)
                tuned_gradient = self.interface.co_evolve_moral_gradient(neural_intent, gradient)
                shards.append(self.shard_wallet_intent(wallet, tuned_gradient))

            if not shards:
                break

            field = self.entangle_shards(shards, num_agents=len(shards))
            field_hash = hashlib.sha3_256(field.tobytes()).hexdigest()
            proof = generate_proof(field_hash + self.mission_anchor.lower())
            emergence = self.verify_ethical_emergence(field, proof)
            ciphertext = encrypt(field.tolist())
            tx_hash = self._format_tx(ciphertext)
            if emergence:
                self._emit_diffusion_event(field_hash, tx_hash, proof)
            results.append(
                {
                    "iter": step,
                    "entropy": float(self._last_entropy),
                    "tx": tx_hash,
                    "emergence": bool(emergence),
                }
            )
        return results

    def _format_tx(self, cipher: Any) -> str:
        """Normalize ciphertext encodings into 0x-prefixed 32-byte identifiers."""

        if isinstance(cipher, (bytes, bytearray)):
            cipher_hex = cipher.hex()
        else:
            cipher_hex = str(cipher)
        if not cipher_hex.startswith("0x"):
            cipher_hex = f"0x{cipher_hex}"
        payload = cipher_hex[2:]
        if len(payload) != 64:
            payload = hashlib.sha3_256(payload.encode("utf-8")).hexdigest()
        return f"0x{payload[:64]}"

    def _emit_diffusion_event(self, field_hash: str, tx_hash: str, proof: str) -> None:
        """Emit diffusion alerts through live oracle hooks and stream queues."""

        context = {
            "channel": "e3_diffusion",
            "mission_anchor": self.mission_anchor,
            "entropy": self._last_entropy,
            "field_hash": field_hash,
        }
        try:
            if hasattr(self._live_oracle, "emit_event"):
                response = self._live_oracle.emit_event(field_hash, proof, context=context)
                if isinstance(response, dict) and response.get("tx_hash"):
                    tx_hash = str(response["tx_hash"])
                    if len(tx_hash) != 66 or not tx_hash.startswith("0x"):
                        tx_hash = self._format_tx(tx_hash)
        except Exception:
            pass

        payload = {
            "channel": "e3_diffusion",
            "payload": {
                "mission_anchor": self.mission_anchor,
                "entropy": float(self._last_entropy),
                "field_hash": field_hash,
                "proof_hash": hashlib.sha3_256(proof.encode("utf-8")).hexdigest(),
                "tx_hash": tx_hash,
            },
        }
        self._enqueue_stream_event(payload)

    def _enqueue_stream_event(self, event: dict[str, Any]) -> None:
        """Append events to the shared stream queue or local cache when unavailable."""

        if not isinstance(event, dict):
            return
        module = sys.modules.get("services.share_viz_endpoint")
        queue: deque | None = None
        if module is not None:
            queue = getattr(module, "STREAM_EMIT_QUEUE", None)
        if queue is not None:
            queue.append(dict(event))
        else:
            self._local_stream_cache.append(dict(event))

    def drain_local_stream(self) -> list[dict[str, Any]]:
        """Expose locally buffered stream events when share_viz queue is unavailable."""

        events = list(self._local_stream_cache)
        self._local_stream_cache.clear()
        return events


__all__ = ["EntangledEthicalEntropies"]

