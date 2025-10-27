"""Stub telemetry module for Empathic Resonance Verifier integration tests."""

from __future__ import annotations

import hashlib
import json
import random
from datetime import datetime
from typing import Dict, List

import matplotlib.pyplot as plt
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from vaultfire.protocol.constants import MISSION_STATEMENT
from vaultfire.protocol.mission_resonance import MissionResonanceEngine

try:  # pragma: no cover - exercised via runtime path
    from fhe import encrypt
except ImportError:  # pragma: no cover - fallback behavior
    def encrypt(payload: str) -> str:
        """Deterministic stand-in for FHE encryption."""

        return f"fhe::encrypted::{payload}"


try:  # pragma: no cover - exercised via runtime path
    from zk_snark import generate_proof
except ImportError:  # pragma: no cover - fallback behavior
    def generate_proof(message: str) -> str:
        """Deterministic stand-in for zk-SNARK proof generation."""

        digest = hashlib.sha256(message.encode("utf-8")).hexdigest()
        return f"zk-proof::{digest}"


class PilotResonanceTelemetry:
    """Mock telemetry surface for the Empathic Resonance Verifier (ERV)."""

    def __init__(self, mission_anchor: str, *, consent: bool = True) -> None:
        """Initialize with the canonical mission statement and consent flag."""

        self.mission_anchor = mission_anchor
        self.consent = consent
        self.engine = MissionResonanceEngine()

    def fetch_mock_bio_data(self, user_wallet: str) -> Dict[str, str | float]:
        """Simulate a wallet-authorized bio-data retrieval."""

        if not self.consent:
            return {"wallet": user_wallet, "error": "privacy_opt_out"}

        seed = int(hashlib.sha256(user_wallet.encode("utf-8")).hexdigest()[:8], 16)
        rng = random.Random(seed)
        hrv = rng.uniform(0.6, 0.9)
        arousal = "calm" if rng.random() > 0.4 else "stress"
        timestamp = datetime.utcnow().isoformat()
        return {
            "wallet": user_wallet,
            "hrv": hrv,
            "arousal": arousal,
            "timestamp": timestamp,
        }

    def run_erv_simulation(self, bio_data: Dict[str, str | float]) -> tuple[float, str]:
        """Run the ERV simulation and return a resonance score and ciphertext."""

        if "error" in bio_data:
            return 0.0, "fhe::encrypted::blocked"

        hrv = float(bio_data.get("hrv", 0.0))
        arousal = str(bio_data.get("arousal", "neutral"))

        base_score = hrv
        if hrv > 0.8:
            base_score += 0.3
        if arousal == "calm":
            base_score += 0.1
        elif arousal == "stress":
            base_score -= 0.1

        resonance_score = max(0.0, min(1.0, base_score))

        bio_snapshot = json.dumps(bio_data, sort_keys=True)
        bio_hash = hashlib.sha256(bio_snapshot.encode("utf-8")).hexdigest()
        proof = generate_proof(bio_snapshot)

        self.engine.ingest_signal(
            source=bio_data.get("wallet", "mock-wallet"),
            technique="fhe-stream",
            score=resonance_score,
            metadata={"bio_hash": bio_hash, "proof": proof},
        )

        encrypted_payload = json.dumps(
            {
                "mission": self.mission_anchor,
                "score": resonance_score,
                "proof": proof,
            },
            sort_keys=True,
        )
        encrypted_result = encrypt(encrypted_payload)
        return resonance_score, encrypted_result

    def simulate_cascade(self, score: float, encrypted_res: str) -> bool:
        """Mock the guardian MPC cascade and Covenant Chain update."""

        consensus = score > 0.7
        if consensus:
            uplift = score * 1.5
            print(f"Covenant Chain attestation: +{uplift:.2f} loyalty XP :: {encrypted_res}")
        else:
            print("Guardian council withheld consensus due to low resonance score")
        return consensus

    def end_to_end_test(self, num_iters: int = 10) -> List[Dict[str, float | str]]:
        """Execute an end-to-end simulation loop for ERV telemetry."""

        results: List[Dict[str, float | str]] = []
        for idx in range(num_iters):
            wallet = f"0xTEST{idx:04X}"
            bio_data = self.fetch_mock_bio_data(wallet)
            if "error" in bio_data:
                results.append(
                    {
                        "wallet": wallet,
                        "score": 0.0,
                        "uplift": 0.0,
                        "status": "blocked",
                    }
                )
                continue

            score, encrypted_res = self.run_erv_simulation(bio_data)
            attested = self.simulate_cascade(score, encrypted_res)
            uplift = score * 1.5 if attested else 0.0
            results.append(
                {
                    "wallet": wallet,
                    "score": score,
                    "uplift": uplift,
                    "status": "attested" if attested else "blocked",
                }
            )
        return results

    def visualize_results(self, results: list[dict]) -> None:
        """Render dashboard-style histograms for ERV resonance telemetry."""

        if not results:
            print("No data for viz")
            return

        scores = [float(entry.get("score", 0.0)) for entry in results if "score" in entry]
        if not scores:
            print("No data for viz")
            return

        attested_uplifts = [
            float(entry.get("uplift", 0.0))
            for entry in results
            if entry.get("status") == "attested"
        ]

        plt.switch_backend("Agg")
        fig, axes = plt.subplots(1, 2, figsize=(12, 4))

        score_mean = float(np.mean(scores))
        score_median = float(np.median(scores))
        axes[0].hist(scores, bins=10, alpha=0.7, label="Scores", color="tab:purple")
        axes[0].axvline(score_mean, color="tab:blue", linestyle="--", label=f"Mean {score_mean:.2f}")
        axes[0].axvline(
            score_median,
            color="tab:orange",
            linestyle=":",
            label=f"Median {score_median:.2f}",
        )
        axes[0].set_title("ERV Resonance Gradients")
        axes[0].set_xlabel("Resonance Score")
        axes[0].set_ylabel("Frequency")
        axes[0].legend()
        axes[0].text(
            0.95,
            0.95,
            f"μ={score_mean:.2f}\nMed={score_median:.2f}",
            transform=axes[0].transAxes,
            ha="right",
            va="top",
            fontsize=9,
        )

        axes[1].set_title("Empathic Yield Boosts")
        axes[1].set_xlabel("Uplift Multiplier")
        axes[1].set_ylabel("Frequency")
        if attested_uplifts:
            uplift_mean = float(np.mean(attested_uplifts))
            uplift_median = float(np.median(attested_uplifts))
            axes[1].hist(
                attested_uplifts,
                bins=10,
                alpha=0.7,
                label="Uplifts",
                color="tab:green",
            )
            axes[1].axvline(
                uplift_mean,
                color="tab:blue",
                linestyle="--",
                label=f"Mean {uplift_mean:.2f}",
            )
            axes[1].axvline(
                uplift_median,
                color="tab:orange",
                linestyle=":",
                label=f"Median {uplift_median:.2f}",
            )
            axes[1].legend()
            axes[1].text(
                0.95,
                0.95,
                f"μ={uplift_mean:.2f}\nMed={uplift_median:.2f}",
                transform=axes[1].transAxes,
                ha="right",
                va="top",
                fontsize=9,
            )
        else:
            axes[1].text(
                0.5,
                0.5,
                "No attested uplifts",
                transform=axes[1].transAxes,
                ha="center",
                va="center",
                fontsize=10,
            )

        fig.suptitle(f"ERV Pilot Insights :: {self.mission_anchor}")
        plt.tight_layout()
        plt.savefig("erv_pilot_viz.png", dpi=150, bbox_inches="tight")
        plt.show()
        plt.close(fig)

    def interactive_viz(self, results: list[dict]) -> None:
        """Generate interactive Plotly visuals for guardian council review.

        Example:
            telemetry = PilotResonanceTelemetry(MISSION_STATEMENT)
            telemetry.interactive_viz(telemetry.end_to_end_test())
        """

        if not results:
            print("No data for interactive viz")
            return

        wallets = [str(entry.get("wallet", "unknown")) for entry in results]
        scores = [float(entry.get("score", 0.0)) for entry in results]
        uplifts = [float(entry.get("uplift", 0.0)) for entry in results]
        statuses = [str(entry.get("status", "unknown")) for entry in results]

        if not scores:
            print("No data for interactive viz")
            return

        color_palette = px.colors.qualitative.Safe
        color_map = {
            "attested": color_palette[0],
            "blocked": color_palette[3],
        }
        histogram_colors = [color_map.get(status, color_palette[5]) for status in statuses]
        hover_text = [
            f"Wallet: {wallet}<br>Status: {status}<br>Mission: {self.mission_anchor}"
            for wallet, status in zip(wallets, statuses)
        ]

        fig = make_subplots(
            rows=1,
            cols=2,
            subplot_titles=("Resonance Score Distribution", "Score vs Uplift Heatmap"),
        )

        fig.add_trace(
            go.Histogram(
                x=scores,
                marker=dict(color=histogram_colors),
                hovertext=hover_text,
                name="Resonance Scores",
            ),
            row=1,
            col=1,
        )

        z_matrix: list[list[float | None]] = []
        for idx, uplift in enumerate(uplifts):
            row: list[float | None] = []
            for score_index in range(len(scores)):
                row.append(uplift if score_index == idx else None)
            z_matrix.append(row)

        fig.add_trace(
            go.Heatmap(
                x=scores,
                y=wallets,
                z=z_matrix,
                colorscale="Viridis",
                colorbar=dict(title="Uplift"),
                hovertemplate=(
                    "Wallet: %{y}<br>Score: %{x:.2f}<br>Uplift: %{z:.2f}<br>Mission: "
                    f"{self.mission_anchor}"
                ),
                name="Score/Uplift",
            ),
            row=1,
            col=2,
        )

        score_mean = float(np.mean(scores))
        score_median = float(np.median(scores))
        uplift_mean = float(np.mean(uplifts)) if uplifts else 0.0
        uplift_median = float(np.median(uplifts)) if uplifts else 0.0

        fig.update_layout(
            title="Interactive ERV Guardian Review",
            bargap=0.1,
            hovermode="closest",
            template="plotly_dark",
        )
        fig.add_annotation(
            text=f"Score μ: {score_mean:.2f} | Median: {score_median:.2f}",
            x=0.2,
            y=1.1,
            xref="paper",
            yref="paper",
            showarrow=False,
        )
        fig.add_annotation(
            text=f"Uplift μ: {uplift_mean:.2f} | Median: {uplift_median:.2f}",
            x=0.8,
            y=1.1,
            xref="paper",
            yref="paper",
            showarrow=False,
        )

        fig.write_json("erv_interactive_viz.json")
        fig.show()


# --------------------
# Pytest-compatible tests
# --------------------

def test_fetch_mock_bio_data() -> None:
    """The mock bio data should be deterministic for a wallet."""

    telemetry = PilotResonanceTelemetry(MISSION_STATEMENT)
    first = telemetry.fetch_mock_bio_data("0xABC123")
    second = telemetry.fetch_mock_bio_data("0xABC123")
    assert first["hrv"] == second["hrv"]
    assert first["arousal"] == second["arousal"]
    assert "hrv" in first and 0.6 <= first["hrv"] <= 0.9


def test_fetch_mock_bio_data_privacy_opt_out() -> None:
    """Consent toggle should disable bio-data collection."""

    telemetry = PilotResonanceTelemetry(MISSION_STATEMENT, consent=False)
    result = telemetry.fetch_mock_bio_data("0xNOPE")
    assert result["error"] == "privacy_opt_out"


def test_run_erv_simulation_generates_ciphertext() -> None:
    """ERV simulation should produce a bounded score and ciphertext payload."""

    telemetry = PilotResonanceTelemetry(MISSION_STATEMENT)
    bio = {
        "wallet": "0xTEST",
        "hrv": 0.85,
        "arousal": "calm",
        "timestamp": datetime.utcnow().isoformat(),
    }
    score, encrypted_res = telemetry.run_erv_simulation(bio)
    assert 0.0 <= score <= 1.0
    assert "encrypted" in encrypted_res


def test_simulate_cascade_and_end_to_end_flow(capfd) -> None:
    """Cascade consensus should align with resonance score and propagate to reports."""

    telemetry = PilotResonanceTelemetry(MISSION_STATEMENT)
    results = telemetry.end_to_end_test(num_iters=2)
    assert len(results) == 2
    for entry in results:
        assert entry["status"] in {"attested", "blocked"}
        assert "wallet" in entry

    telemetry.simulate_cascade(0.8, "enc")
    telemetry.simulate_cascade(0.5, "enc")
    out, _ = capfd.readouterr()
    assert "Covenant Chain" in out
    assert "withheld" in out


def test_visualize_results_empty(monkeypatch, tmp_path, capsys) -> None:
    """Visualizing with no data should short-circuit without artifacts."""

    telemetry = PilotResonanceTelemetry(MISSION_STATEMENT)
    monkeypatch.chdir(tmp_path)

    telemetry.visualize_results([])

    captured = capsys.readouterr()
    assert "No data for viz" in captured.out
    assert not (tmp_path / "erv_pilot_viz.png").exists()


def test_visualize_results_sample_data(monkeypatch, tmp_path) -> None:
    """A populated dataset should produce the visualization artifact."""

    telemetry = PilotResonanceTelemetry(MISSION_STATEMENT)
    monkeypatch.chdir(tmp_path)

    sample_results = [
        {"wallet": "0x1", "score": 0.82, "uplift": 1.23, "status": "attested"},
        {"wallet": "0x2", "score": 0.64, "uplift": 0.0, "status": "blocked"},
        {"wallet": "0x3", "score": 0.91, "uplift": 1.37, "status": "attested"},
    ]

    show_calls: list[None] = []
    monkeypatch.setattr(plt, "show", lambda: show_calls.append(None))

    telemetry.visualize_results(sample_results)

    artifact = tmp_path / "erv_pilot_viz.png"
    assert artifact.exists()
    assert show_calls


def test_interactive_viz_empty(capsys, monkeypatch, tmp_path) -> None:
    """Interactive visualization should short-circuit on empty input."""

    telemetry = PilotResonanceTelemetry(MISSION_STATEMENT)
    monkeypatch.chdir(tmp_path)

    telemetry.interactive_viz([])

    captured = capsys.readouterr()
    assert "No data for interactive viz" in captured.out
    assert not (tmp_path / "erv_interactive_viz.json").exists()


def test_interactive_viz_sample(monkeypatch, tmp_path) -> None:
    """Interactive visualization should export a JSON artifact for dashboards."""

    telemetry = PilotResonanceTelemetry(MISSION_STATEMENT)
    monkeypatch.chdir(tmp_path)

    sample_results = [
        {"wallet": "0xAAA", "score": 0.75, "uplift": 1.1, "status": "attested"},
        {"wallet": "0xBBB", "score": 0.42, "uplift": 0.0, "status": "blocked"},
    ]

    show_calls: list[str] = []
    monkeypatch.setattr(go.Figure, "show", lambda self: show_calls.append("shown"))

    telemetry.interactive_viz(sample_results)

    artifact = tmp_path / "erv_interactive_viz.json"
    assert artifact.exists()
    exported = json.loads(artifact.read_text())
    assert "data" in exported and "layout" in exported
    assert show_calls
