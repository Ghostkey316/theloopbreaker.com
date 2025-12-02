from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Sequence


def _hash_pair(left: str, right: str) -> str:
    combined = "::".join(sorted([left, right]))
    return hashlib.sha3_256(combined.encode()).hexdigest()


def _canonical_payload(session_id: str, endpoint: str, payload: Mapping[str, object]) -> str:
    body = json.dumps({"session": session_id, "endpoint": endpoint, "payload": payload}, sort_keys=True)
    return hashlib.sha3_256(body.encode()).hexdigest()


@dataclass
class InteractionReceipt:
    session_id: str
    endpoint: str
    payload_hash: str
    merkle_root: str
    proof_path: List[str]

    def to_dict(self) -> Dict[str, object]:
        return {
            "session_id": self.session_id,
            "endpoint": self.endpoint,
            "payload_hash": self.payload_hash,
            "merkle_root": self.merkle_root,
            "proof_path": self.proof_path,
        }


class GenesisMeshVerifierEngine:
    """Maintains interaction hashes and produces verifiable receipts via a Merkle map."""

    def __init__(self, storage_path: Path | str):
        self.storage_path = Path(storage_path)
        self._interactions: List[Dict[str, object]] = []
        self._load()

    # ------------------------------------------------------------------
    # Core persistence
    # ------------------------------------------------------------------
    def _load(self) -> None:
        if self.storage_path.exists():
            try:
                self._interactions = json.loads(self.storage_path.read_text())
            except json.JSONDecodeError:
                self._interactions = []

    def _persist(self) -> None:
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self.storage_path.write_text(json.dumps(self._interactions, indent=2))

    # ------------------------------------------------------------------
    # Merkle tree helpers
    # ------------------------------------------------------------------
    def _build_tree(self) -> List[List[str]]:
        leaves = [entry["payload_hash"] for entry in self._interactions]
        if not leaves:
            return []
        tree: List[List[str]] = [leaves]
        while len(tree[-1]) > 1:
            current = tree[-1]
            level: List[str] = []
            for index in range(0, len(current), 2):
                left = current[index]
                right = current[index + 1] if index + 1 < len(current) else current[index]
                level.append(_hash_pair(left, right))
            tree.append(level)
        return tree

    def _proof_for(self, payload_hash: str) -> List[str]:
        tree = self._build_tree()
        if not tree:
            return []
        try:
            index = tree[0].index(payload_hash)
        except ValueError as exc:
            raise ValueError("payload_hash not found in interaction set") from exc

        proof: List[str] = []
        for level in tree[:-1]:
            sibling_index = index ^ 1
            sibling = level[sibling_index] if sibling_index < len(level) else level[index]
            proof.append(sibling)
            index //= 2
        return proof

    def _merkle_root(self) -> str:
        tree = self._build_tree()
        return tree[-1][0] if tree else ""

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------
    def record_interaction(self, session_id: str, endpoint: str, payload: Mapping[str, object]) -> InteractionReceipt:
        payload_hash = _canonical_payload(session_id, endpoint, payload)
        self._interactions.append(
            {
                "session_id": session_id,
                "endpoint": endpoint,
                "payload_hash": payload_hash,
            }
        )
        self._persist()
        proof = self._proof_for(payload_hash)
        root = self._merkle_root()
        return InteractionReceipt(session_id, endpoint, payload_hash, root, proof)

    def export_receipts(self, output_path: Path | str) -> Path:
        output = Path(output_path)
        receipts = [
            InteractionReceipt(
                entry["session_id"],
                entry["endpoint"],
                entry["payload_hash"],
                self._merkle_root(),
                self._proof_for(entry["payload_hash"]),
            ).to_dict()
            for entry in self._interactions
        ]
        output.write_text(json.dumps(receipts, indent=2))
        return output

    def public_proof_map(self) -> Dict[str, Sequence[str]]:
        return {entry["payload_hash"]: self._proof_for(entry["payload_hash"]) for entry in self._interactions}

    @staticmethod
    def verify_receipt(receipt: InteractionReceipt | Mapping[str, object]) -> bool:
        data = receipt if isinstance(receipt, Mapping) else receipt.to_dict()
        payload_hash = str(data["payload_hash"])
        proof_path: Iterable[str] = data.get("proof_path", [])
        merkle_root = str(data.get("merkle_root", ""))
        current = payload_hash
        for sibling in proof_path:
            current = _hash_pair(current, sibling)
        return current == merkle_root


# ----------------------------------------------------------------------
# CLI tools
# ----------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="GenesisMesh receipt exporter and verifier")
    subparsers = parser.add_subparsers(dest="command")

    export_parser = subparsers.add_parser("export", help="Export interaction receipts")
    export_parser.add_argument("--store", required=True, help="Path to stored interactions")
    export_parser.add_argument("--out", required=True, help="Where to write receipts")

    verify_parser = subparsers.add_parser("verify", help="Verify a receipt JSON blob")
    verify_parser.add_argument("--receipt", required=True, help="Path to receipt JSON")

    return parser


def run_cli(argv: List[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "export":
        engine = GenesisMeshVerifierEngine(Path(args.store))
        engine.export_receipts(Path(args.out))
        return 0

    if args.command == "verify":
        receipt_blob = json.loads(Path(args.receipt).read_text())
        if isinstance(receipt_blob, list):
            all_valid = all(GenesisMeshVerifierEngine.verify_receipt(item) for item in receipt_blob)
        else:
            all_valid = GenesisMeshVerifierEngine.verify_receipt(receipt_blob)
        return 0 if all_valid else 1

    parser.print_help()
    return 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(run_cli())
