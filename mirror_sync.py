from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path
from typing import Any, Mapping, Optional

from vaultfire.core.mirror_engine import MirrorRecord
from vaultfire.core.mirror_state import MirrorStateEntry


class MirrorSync:
    """Bind reflection state to NFT metadata and sync to marketplaces."""

    def __init__(self, output_dir: Path | str = Path("status"), api_client: Optional[Any] = None) -> None:
        self.output_dir = Path(output_dir)
        self.api_client = api_client
        self.output_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _image_uri(token_id: str, last_hash: str, alignment_score: Optional[float]) -> str:
        safe_alignment = alignment_score if alignment_score is not None else 0
        return (
            "https://vaultfire.mirror/{token_id}.png?last={last_hash}&alignment={alignment}".format(
                token_id=token_id,
                last_hash=last_hash,
                alignment=safe_alignment,
            )
        )

    def compose_metadata(
        self,
        token_id: str,
        ens_identity: str,
        last_entry: Optional[MirrorStateEntry],
        mirror_record: Optional[MirrorRecord],
    ) -> Mapping[str, Any]:
        last_hash = last_entry.state_hash if last_entry else "pending"
        alignment_score = (
            mirror_record.mirror_score if mirror_record else (last_entry.alignment_score if last_entry else None)
        )
        description_lines = [
            f"Vaultfire Sovereign Mirror for {ens_identity}",
            f"Token: {token_id}",
            f"Last Mirror: {last_hash}",
            f"Alignment Score: {alignment_score}",
        ]
        metadata = {
            "name": f"Vaultfire Mirror {token_id}",
            "description": "\n".join(description_lines),
            "external_url": f"https://zora.co/ghostkey/{token_id}",
            "image": self._image_uri(token_id, last_hash, alignment_score),
            "attributes": [
                {"trait_type": "ENS", "value": ens_identity},
                {"trait_type": "Last Mirror", "value": last_hash},
                {"trait_type": "Vaultfire Alignment", "value": alignment_score},
            ],
        }
        return metadata

    def sync_metadata(
        self,
        token_id: str,
        metadata: Mapping[str, Any],
        destination: Optional[Path | str] = None,
    ) -> Mapping[str, Any]:
        if self.api_client:
            return self.api_client.update_metadata(token_id, metadata)
        path = Path(destination) if destination else self.output_dir / f"mirror_sync_{token_id}.json"
        path.write_text(json.dumps(metadata, indent=2))
        return {"destination": str(path), "metadata": metadata}


def _load_state_from_file(state_path: Optional[str]) -> Optional[Mapping[str, Any]]:
    if not state_path:
        return None
    path = Path(state_path)
    if not path.exists():
        raise FileNotFoundError(f"State file not found: {path}")
    return json.loads(path.read_text())


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync mirror reflection state to NFT metadata")
    parser.add_argument("token_id", help="Token id to update on Zora/OpenSea")
    parser.add_argument("--ens", default="ghostkey316.eth", help="ENS identity for the mirror")
    parser.add_argument("--state-file", help="Path to a JSON file containing mirror state export")
    parser.add_argument("--output", help="Where to write the composed metadata")
    args = parser.parse_args()

    state_payload = _load_state_from_file(args.state_file)
    last_entry: Optional[MirrorStateEntry] = None
    mirror_record: Optional[MirrorRecord] = None
    if state_payload:
        # Minimal state expectation from MirrorState.export_stealth
        entries_payload = state_payload.get("export") or []
        if isinstance(entries_payload, str):
            try:
                decoded = base64.b64decode(entries_payload).decode()
                entries = json.loads(decoded)
            except Exception:
                entries = []
        else:
            entries = entries_payload
        if entries:
            last = entries[-1]
            last_entry = MirrorStateEntry(
                session_id=last.get("session_id", "unknown"),
                prompt_cipher="hidden",
                response_cipher="hidden",
                state_hash=last.get("state_hash", "pending"),
                receipt=last.get("receipt", ""),
                timestamp=last.get("timestamp", 0),
                alignment_score=last.get("alignment_score"),
                annotations=last.get("annotations", {}),
            )
    syncer = MirrorSync()
    metadata = syncer.compose_metadata(args.token_id, args.ens, last_entry, mirror_record)
    result = syncer.sync_metadata(args.token_id, metadata, args.output)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
