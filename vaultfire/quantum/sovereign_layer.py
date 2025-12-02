"""Vaultfire Quantum Sovereign Layer utilities.

This module introduces lightweight, dependency-free implementations that map to
Vaultfire's Quantum Sovereign Layer brief. Each component mirrors the requested
cryptographic and operational behaviors using deterministic hashes so the
behaviors can be validated in tests without heavy native bindings.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from hashlib import sha3_256
from pathlib import Path
from typing import Any, Iterable, Mapping, MutableMapping, Sequence


_DEF_ENCODE = "utf-8"


def _poseidon_hash(*parts: str) -> str:
    """Return a deterministic Poseidon-style hash placeholder."""

    joined = "|".join(parts)
    digest = sha3_256(joined.encode(_DEF_ENCODE)).hexdigest()
    return f"poseidon-{digest}"


@dataclass
class ZKProofRecord:
    proof_id: str
    signature_commitment: str
    alignment_hash: str
    zk_proof: str
    onchain_container: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "proof_id": self.proof_id,
            "signature_commitment": self.signature_commitment,
            "alignment_hash": self.alignment_hash,
            "zk_proof": self.zk_proof,
            "onchain_container": self.onchain_container,
        }


class ZKKeeper:
    """Manage DNA signature encryption and zkProof storage."""

    def __init__(self, container_path: str | Path = Path("manifest/zk_keeper_container.json")) -> None:
        self.container_path = Path(container_path)
        self.container_path.parent.mkdir(parents=True, exist_ok=True)

    def encrypt_dna_signature(self, dna_signature: str, *, salt: str) -> str:
        """Encrypt a DNA signature using a Poseidon-style hash."""

        return _poseidon_hash("dna", dna_signature.strip(), salt)

    def generate_alignment_proof(self, dna_signature: str, alignment_vector: Sequence[str]) -> ZKProofRecord:
        """Create zkProof metadata for alignment validation."""

        normalized_alignment = [item.strip().lower() for item in alignment_vector if item]
        alignment_hash = _poseidon_hash(*normalized_alignment)
        signature_commitment = self.encrypt_dna_signature(dna_signature, salt=alignment_hash[:12])
        zk_proof = _poseidon_hash(signature_commitment, alignment_hash)
        proof_id = f"zk-{sha3_256(signature_commitment.encode(_DEF_ENCODE)).hexdigest()[:12]}"
        return ZKProofRecord(
            proof_id=proof_id,
            signature_commitment=signature_commitment,
            alignment_hash=alignment_hash,
            zk_proof=zk_proof,
            onchain_container=str(self.container_path),
        )

    def _load_container(self) -> MutableMapping[str, Any]:
        if not self.container_path.exists():
            return {}
        try:
            data = json.loads(self.container_path.read_text())
        except json.JSONDecodeError:
            return {}
        if isinstance(data, dict):
            return data
        return {}

    def _write_container(self, payload: Mapping[str, Any]) -> None:
        encrypted_blob = _poseidon_hash(json.dumps(payload, sort_keys=True))
        wrapper = {"encrypted_payload": encrypted_blob, "payload": payload}
        self.container_path.write_text(json.dumps(wrapper, indent=2) + "\n")

    def store_proof(self, record: ZKProofRecord) -> Mapping[str, Any]:
        """Persist zkProof metadata into the encrypted onchain container."""

        container = self._load_container()
        container[record.proof_id] = record.to_dict()
        self._write_container(container)
        return container[record.proof_id]

    def rollback_if_tampered(self, expected_commitment: str, observed_commitment: str) -> Mapping[str, Any]:
        """Trigger rollback details when a signature commitment is altered."""

        tampered = expected_commitment != observed_commitment
        status = "rollback" if tampered else "validated"
        trace = {
            "status": status,
            "expected": expected_commitment,
            "observed": observed_commitment,
            "restored_signature": expected_commitment if tampered else observed_commitment,
        }
        if tampered:
            trace["reason"] = "Signature commitment mismatch detected"
        return trace


class MoralAlignmentSimulator:
    """Simulate scenario outcomes against Vaultfire's moral spine."""

    def __init__(self, output_dir: str | Path = Path("mas_output")) -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _weighted_score(belief_matrix: Sequence[Sequence[float]]) -> float:
        flat = [value for row in belief_matrix for value in row]
        if not flat:
            return 0.0
        return sum(flat) / len(flat)

    @staticmethod
    def _rollback_hash(trace_content: str, belief_matrix: Sequence[Sequence[float]]) -> str:
        encoded_matrix = json.dumps(belief_matrix, sort_keys=True)
        return _poseidon_hash(trace_content, encoded_matrix)

    def simulate(self, scenario_path: str | Path, belief_matrix: Sequence[Sequence[float]], moral_spine: Mapping[str, float] | None = None) -> Mapping[str, Any]:
        scenario = json.loads(Path(scenario_path).read_text())
        scenario_id = scenario.get("id", "anonymous_scenario")
        moral_frame = moral_spine or {"empathy": 0.33, "coherence": 0.33, "courage": 0.34}

        base_score = self._weighted_score(belief_matrix)
        spine_boost = sum(moral_frame.values())
        moral_confidence = round(base_score * spine_boost, 4)

        trace_lines = [f"scenario={scenario_id}", f"moral_spine={json.dumps(moral_frame, sort_keys=True)}", f"belief_rows={len(belief_matrix)}"]
        for idx, row in enumerate(belief_matrix):
            trace_lines.append(f"row[{idx}]={row}")
        trace_content = "\n".join(trace_lines)

        decision_trace_path = self.output_dir / "decision_trace.log"
        decision_trace_path.write_text(trace_content + "\n")

        rollback_hash = self._rollback_hash(trace_content, belief_matrix)
        scores = {
            "scenario_id": scenario_id,
            "moral_confidence_score": moral_confidence,
            "moral_frame": moral_frame,
            "rollback_hash": rollback_hash,
        }
        scores_path = self.output_dir / "moral_confidence_score.json"
        scores_path.write_text(json.dumps(scores, indent=2) + "\n")

        return {"trace": str(decision_trace_path), "scores": str(scores_path), **scores}


class QuantumRelayPingNet:
    """Broadcast Vaultfire pings and validate responses via zkTimestamp proofs."""

    def __init__(self, log_path: str | Path = Path("relay_logs/liveness.json")) -> None:
        self.log_path = Path(log_path)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _timestamp() -> str:
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    @staticmethod
    def _zk_timestamp_proof(node: str, timestamp: str) -> str:
        digest = sha3_256(f"{node}:{timestamp}".encode(_DEF_ENCODE)).hexdigest()
        return f"zkts-{digest[:24]}"

    def _load_log(self) -> list[Mapping[str, Any]]:
        if not self.log_path.exists():
            return []
        try:
            data = json.loads(self.log_path.read_text())
        except json.JSONDecodeError:
            return []
        if isinstance(data, list):
            return data
        return []

    def _write_log(self, entries: Sequence[Mapping[str, Any]]) -> None:
        self.log_path.write_text(json.dumps(entries, indent=2) + "\n")

    def broadcast_and_validate(self, trusted_nodes: Sequence[str], round_trip_latencies: Mapping[str, float] | None = None) -> list[Mapping[str, Any]]:
        latencies = round_trip_latencies or {}
        existing = self._load_log()
        for node in trusted_nodes:
            timestamp = self._timestamp()
            zk_proof = self._zk_timestamp_proof(node, timestamp)
            latency = float(latencies.get(node, 42.0))
            entry = {
                "node": node,
                "timestamp": timestamp,
                "zk_timestamp_proof": zk_proof,
                "latency_millis": latency,
                "liveness": latency < 250,
            }
            existing.append(entry)
        self._write_log(existing)
        return existing


class ThreatMirrorLoop:
    """Scan critical modules for unauthorized changes and trigger lockdowns."""

    def __init__(self, report_path: str | Path = Path("manifest/threat_report.json")) -> None:
        self.report_path = Path(report_path)
        self.report_path.parent.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _checksum_path(path: Path) -> str:
        content = path.read_text()
        return _poseidon_hash(path.name, content)

    @staticmethod
    def _moral_checksum(results: Mapping[str, str]) -> str:
        return _poseidon_hash(json.dumps(results, sort_keys=True))

    def generate_baseline(self, targets: Iterable[Path]) -> dict[str, str]:
        baseline: dict[str, str] = {}
        for path in targets:
            baseline[str(path)] = self._checksum_path(path)
        return baseline

    def scan(self, targets: Iterable[Path], baseline: Mapping[str, str]) -> Mapping[str, Any]:
        scan_results = []
        tampered: list[str] = []
        current_checksums: dict[str, str] = {}

        for path in targets:
            checksum = self._checksum_path(path)
            current_checksums[str(path)] = checksum
            expected = baseline.get(str(path))
            if expected and expected != checksum:
                tampered.append(str(path))
            scan_results.append({
                "path": str(path),
                "checksum": checksum,
                "expected": expected,
                "tampered": expected is not None and expected != checksum,
            })

        moral_checksum = self._moral_checksum(current_checksums)
        lockdown = bool(tampered)
        report = {
            "moral_checksum": moral_checksum,
            "lockdown": lockdown,
            "tampered": tampered,
            "trace": scan_results,
        }
        if lockdown:
            report["lockdown_reason"] = "Unauthorized mutation detected"
        self.report_path.write_text(json.dumps(report, indent=2) + "\n")
        return report


class EthosReceiptGenerator:
    """Create signed ethos receipts derived from DNA signatures."""

    def __init__(self, output_path: str | Path = Path("manifest/ethos_receipt.vfr")) -> None:
        self.output_path = Path(output_path)
        self.output_path.parent.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _derive_curve_keys(dna_signature: str) -> Mapping[str, str]:
        private_hint = sha3_256(f"priv:{dna_signature}".encode(_DEF_ENCODE)).hexdigest()
        public_point = sha3_256(f"pub:{private_hint}".encode(_DEF_ENCODE)).hexdigest()
        return {
            "curve_public_key": f"ec-pub-{public_point[:40]}",
            "curve_private_hint": f"ec-priv-{private_hint[:24]}",
        }

    def generate_receipt(self, identity: str, wallet: str, dna_signature: str, genesis_signature: str) -> Mapping[str, Any]:
        keys = self._derive_curve_keys(dna_signature)
        dna_hash = _poseidon_hash("dna", dna_signature)
        identity_digest = sha3_256(f"{identity}:{wallet}:{dna_hash}".encode(_DEF_ENCODE)).hexdigest()
        chain_hash = sha3_256(f"{identity_digest}:{genesis_signature}".encode(_DEF_ENCODE)).hexdigest()

        receipt = {
            "identity": identity,
            "wallet": wallet,
            "dna_hash": dna_hash,
            "genesis_signature": genesis_signature,
            "curve_public_key": keys["curve_public_key"],
            "proof": f"ethos-{identity_digest[:32]}",
            "chain_hash": f"chain-{chain_hash[:48]}",
        }
        self.output_path.write_text(json.dumps(receipt, indent=2) + "\n")
        return receipt


__all__ = [
    "ZKKeeper",
    "ZKProofRecord",
    "MoralAlignmentSimulator",
    "QuantumRelayPingNet",
    "ThreatMirrorLoop",
    "EthosReceiptGenerator",
]
