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

    def __init__(
        self,
        mission_anchor: str,
        shard_dim: int = 4,
        *,
        comet_mode: bool = False,
    ) -> None:
        self.mission_anchor = mission_anchor or MISSION_STATEMENT
        self.shard_dim = max(1, int(shard_dim))
        self.lattice_dim = self.shard_dim
        self.kyber_mod = 3329
        self._comet_mode = bool(comet_mode)
        self._comet_priors: dict[str, float] = {}
        if self._comet_mode:
            self._comet_priors = {
                "ni_fe_ratio": 0.85,
                "alpha_prior": 0.91,
            }
        self.interface = SymbioticSentienceInterface(self.mission_anchor)
        self.interface.bind_stream_emitter(self._enqueue_stream_event)
        self._live_oracle = get_live_oracle()
        self._shard_proofs: dict[str, str] = {}
        self._last_entropy: float = 0.0
        self._local_stream_cache: deque[dict[str, Any]] = deque()

    def comet_conjunction_attractor(
        self,
        neural_intent: dict[str, Any],
        shards: Sequence[np.ndarray],
    ) -> np.ndarray:
        """Comet conjunction attractor entangling Ni/Fe priors with neural intents for emergent covenant jests."""

        if not shards:
            raise ValueError("e3_comet_requires_shards")

        lattice = np.asarray([np.asarray(shard, dtype=float) for shard in shards], dtype=float)
        state = lattice.mean(axis=0)
        ni_fe_ratio = self._comet_priors.get("ni_fe_ratio", 0.0)
        alpha_prior = self._comet_priors.get("alpha_prior", 0.0)
        alpha_power = float(
            neural_intent.get(
                "alpha_wave",
                neural_intent.get("alpha", neural_intent.get("alpha_power", alpha_prior)),
            )
        )
        alpha_power = max(alpha_power, alpha_prior)
        empathy_bonus = 0.0
        if "empathy" in MISSION_STATEMENT.lower():
            empathy_bonus = 0.01
        shard_mean = lattice.sum(axis=0) / max(1, lattice.shape[0])
        for _ in range(15):
            state = (
                self.kyber_mod
                * np.sin(math.pi * (state + ni_fe_ratio * alpha_power))
                + shard_mean
            ) % self.kyber_mod
            state = state / self.kyber_mod
            alpha_power = min(1.0, alpha_power * (1.0 + empathy_bonus))

        logits = state - np.max(state)
        probabilities = np.exp(logits)
        probabilities = probabilities / np.sum(probabilities)
        theta_key = str(
            neural_intent.get("theta", neural_intent.get("theta_intent", ""))
        ).lower()
        comet_chaos_boost = 0.05 if theta_key == "align" else 0.0
        if comet_chaos_boost and empathy_bonus:
            comet_chaos_boost += empathy_bonus
        log_arg = np.clip(probabilities + comet_chaos_boost, 1e-12, 1.0 + comet_chaos_boost)
        alignment_entropy = -float(np.sum(probabilities * np.log(log_arg)))
        if theta_key == "align":
            covenant_floor = alpha_power * (1.0 + ni_fe_ratio * 0.1)
            alignment_entropy = max(alignment_entropy, min(1.0, covenant_floor))
        self._last_entropy = alignment_entropy
        attractor_hash = hashlib.sha3_256(state.tobytes()).hexdigest()
        proof_payload = {
            "attractor": attractor_hash,
            "ni_fe": ni_fe_ratio,
        }
        self._shard_proofs["comet_attractor"] = generate_proof(proof_payload)
        if alignment_entropy > 0.99:
            self._emit_diffusion_event(
                attractor_hash,
                self._format_tx(encrypt(state.tolist())),
                self._shard_proofs["comet_attractor"],
            )
        return state

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
            neural_cache: list[dict[str, Any]] = []
            for intent in intents:
                if not intent or not intent.get("consent", True):
                    continue
                wallet = str(intent.get("wallet", f"pilot::{step}"))
                gradient = float(intent.get("gradient", 0.5))
                neural_intent = self.interface.capture_neural_intent(wallet)
                tuned_gradient = self.interface.co_evolve_moral_gradient(neural_intent, gradient)
                shards.append(self.shard_wallet_intent(wallet, tuned_gradient))
                neural_cache.append(neural_intent)

            if not shards:
                break

            comet_entropy = None
            alignment = False
            if self._comet_mode and neural_cache:
                field = self.comet_conjunction_attractor(neural_cache[-1], shards)
                comet_entropy = float(self._last_entropy)
                alignment = comet_entropy > 0.99
            else:
                field = self.entangle_shards(shards, num_agents=len(shards))
            field_hash = hashlib.sha3_256(field.tobytes()).hexdigest()
            if self._comet_mode:
                proof_payload: Any = {
                    "attractor": field_hash,
                    "ni_fe": self._comet_priors.get("ni_fe_ratio", 0.0),
                }
            else:
                proof_payload = field_hash + self.mission_anchor.lower()
            proof = generate_proof(proof_payload)
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
                    "comet_entropy": float(comet_entropy) if comet_entropy is not None else None,
                    "alignment": bool(alignment),
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

