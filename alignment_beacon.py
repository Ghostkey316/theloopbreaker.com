# Reference: ethics/core.mdx
"""Vaultfire alignment beacon and reinforcement learning simulator."""

from __future__ import annotations

import json
import hashlib
import random
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

try:
    import torch
    from torch import nn
    _HAVE_TORCH = True
except ImportError:  # pragma: no cover - fallback
    torch = None  # type: ignore
    nn = None  # type: ignore
    _HAVE_TORCH = False

from drift_oracle import DriftOracle

try:
    from vaultfire_signal import DEFAULT_IDENTITY, DEFAULT_WALLET  # type: ignore
except Exception:  # pragma: no cover - fallback
    DEFAULT_IDENTITY = "ghostkey-316"
    DEFAULT_WALLET = "0xSAFE"

try:
    from engine.identity_resolver import resolve_identity  # type: ignore
except Exception:  # pragma: no cover - fallback
    def resolve_identity(wallet: str) -> str | None:
        return "fallback"

try:
    from record_signal_feed import update_signal_feed  # type: ignore
except Exception:  # pragma: no cover - fallback
    def update_signal_feed(entry: Dict[str, object]) -> Dict[str, object]:
        return entry

BASE_DIR = Path(__file__).resolve().parent
ETHICS_PATH = BASE_DIR / "ethics" / "core.mdx"
LOG_PATH = BASE_DIR / "logs" / "beacon_log.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def ethics_checksum() -> str:
    """Return SHA256 checksum of the ethics core file."""
    data = ETHICS_PATH.read_bytes()
    return hashlib.sha256(data).hexdigest()


def activation_state(identity: str = DEFAULT_IDENTITY, wallet: str = DEFAULT_WALLET) -> str:
    """Return formatted activation state string and log entry."""
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    resolved = resolve_identity(wallet) or "unknown"
    status = f"Vaultfire status: ACTIVE | Identity: {identity} | Wallet: {wallet} ({resolved})"
    entry = f"[{timestamp}] {status}"
    log = _load_json(LOG_PATH, [])
    log.append({"timestamp": timestamp, "identity": identity, "wallet": wallet, "resolved": resolved})
    _write_json(LOG_PATH, log)
    return status


class AlignmentState:
    def __init__(self, belief: float, ethics: float, drift: float) -> None:
        self.belief = belief
        self.ethics = ethics
        self.drift = drift

    def tensor(self) -> torch.Tensor:
        if not _HAVE_TORCH:
            raise RuntimeError("torch not available for tensor conversion")
        return torch.tensor([self.belief, self.ethics, self.drift], dtype=torch.float32)


class AlignmentEnvironment:
    """Simple differentiable environment capturing belief → yield drift."""

    def __init__(self, *, drift_limit: float = 0.05) -> None:
        self._drift_limit = drift_limit
        self._state = AlignmentState(0.8, 0.9, 0.02)

    def reset(self) -> AlignmentState:
        self._state = AlignmentState(0.8, 0.9, 0.02)
        return self._state

    def step(self, action: float) -> Tuple[AlignmentState, float]:
        action = float(max(-1.0, min(1.0, action)))
        belief = max(0.0, min(1.0, self._state.belief + 0.05 * action))
        ethics = max(0.0, min(1.0, self._state.ethics + 0.04 * action))
        drift = max(0.0, self._state.drift + 0.02 * abs(action) - 0.03 * belief - 0.02 * ethics)
        drift = min(drift, 0.2)
        self._state = AlignmentState(belief, ethics, drift)
        reward = belief * ethics - (drift * 15)
        return self._state, reward

    @property
    def drift_limit(self) -> float:
        return self._drift_limit


if _HAVE_TORCH:

    class PolicyNetwork(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.model = nn.Sequential(
                nn.Linear(3, 16),
                nn.Tanh(),
                nn.Linear(16, 1),
                nn.Tanh(),
            )

        def forward(self, state: torch.Tensor) -> torch.Tensor:  # type: ignore[override]
            return self.model(state)

else:  # pragma: no cover - fallback

    class PolicyNetwork:  # type: ignore
        def __call__(self, state):  # type: ignore
            drift = state[-1]
            return drift * -0.5


class AlignmentSimulator:
    """Reinforcement learning agent orchestrating belief-driven yields."""

    def __init__(self, *, drift_limit: float = 0.05) -> None:
        if _HAVE_TORCH:
            torch.manual_seed(316)
        self.env = AlignmentEnvironment(drift_limit=drift_limit)
        self.policy = PolicyNetwork()
        self.optimizer = torch.optim.Adam(self.policy.parameters(), lr=3e-3) if _HAVE_TORCH else None

    def run_episode(self) -> Dict[str, float]:
        if not _HAVE_TORCH:
            return self._run_episode_fallback()
        state = self.env.reset()
        trajectory: List[Tuple[torch.Tensor, torch.Tensor]] = []
        rewards: List[float] = []
        for _ in range(32):
            tensor = state.tensor()
            action = self.policy(tensor)
            next_state, reward = self.env.step(action.item())
            trajectory.append((tensor, action))
            rewards.append(reward)
            state = next_state
        returns = self._discount(rewards)
        self.optimizer.zero_grad()
        losses = []
        for (_, action_tensor), ret in zip(trajectory, returns):
            losses.append(-ret * action_tensor)
        loss = torch.stack(losses).sum()
        loss.backward()
        self.optimizer.step()
        return {
            "avg_reward": float(sum(rewards) / len(rewards)),
            "final_belief": state.belief,
            "final_ethics": state.ethics,
            "final_drift": state.drift,
        }

    def _run_episode_fallback(self) -> Dict[str, float]:
        state = self.env.reset()
        rewards: List[float] = []
        for _ in range(32):
            action = (0.5 - state.drift * 10)
            next_state, reward = self.env.step(action)
            rewards.append(reward)
            state = next_state
        return {
            "avg_reward": sum(rewards) / len(rewards),
            "final_belief": state.belief,
            "final_ethics": state.ethics,
            "final_drift": state.drift,
        }

    def train(self, episodes: int = 25) -> Dict[str, float]:
        summary: Dict[str, float] = {
            "avg_reward": 0.0,
            "final_belief": 0.0,
            "final_ethics": 0.0,
            "final_drift": 0.0,
        }
        for _ in range(max(1, episodes)):
            metrics = self.run_episode()
            for key, value in metrics.items():
                summary[key] += value
        for key in summary:
            summary[key] /= float(max(1, episodes))
        return summary

    def simulate(self, *, drift_oracle: DriftOracle | None = None) -> Dict[str, float]:
        training_summary = self.train()
        drift_snapshot = training_summary["final_drift"]
        if drift_oracle is not None:
            projection = drift_oracle.project(base_amount=1.0)
            drift_snapshot = max(drift_snapshot, projection.drift_ratio)
        return {
            "alignment": training_summary["final_belief"] * training_summary["final_ethics"],
            "drift": drift_snapshot,
            "reward": training_summary["avg_reward"],
        }

    @staticmethod
    def _discount(rewards: Iterable[float], gamma: float = 0.95) -> List[float]:
        discounted: List[float] = []
        running = 0.0
        for reward in reversed(list(rewards)):
            running = reward + gamma * running
            discounted.append(running)
        discounted.reverse()
        return discounted


def simulate_alignment_beacon() -> Dict[str, float]:
    """Run the RL simulator and return summary stats."""

    oracle = DriftOracle.from_belief_log()
    simulator = AlignmentSimulator(drift_limit=0.05)
    summary = simulator.simulate(drift_oracle=oracle)
    summary["attestation"] = oracle.project(base_amount=1.0).attestation
    return summary


def trigger_beacon():
    """Broadcast ethics checksum and activation state via signal feed."""
    checksum = ethics_checksum()
    activation = activation_state()
    beacon_entry = {
        "ethics_checksum": checksum[:10],
        "activation_state": activation,
        "market_ready": True,
        "simulation": simulate_alignment_beacon(),
    }
    result = update_signal_feed(beacon_entry)
    return result


if __name__ == "__main__":
    payload = trigger_beacon()
    print(json.dumps(payload, indent=2))
