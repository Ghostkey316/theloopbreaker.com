#!/usr/bin/env python3
"""Decrypt Vaultfire encrypted payloads using passphrase vault or hardware key."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from vaultfire.encryption import decrypt_mapping, decrypt_token, set_runtime_passphrase


def _load_secret(path: str | None) -> str | None:
    if not path:
        return None
    try:
        secret = Path(path).expanduser().read_text(encoding="utf-8").strip()
    except OSError:
        raise SystemExit(f"Unable to read secret from {path}")
    if not secret:
        raise SystemExit(f"Secret source at {path} is empty")
    return secret


def _configure_passphrase(args: argparse.Namespace) -> None:
    if args.passphrase:
        set_runtime_passphrase(args.passphrase)
        return
    if args.vault:
        secret = _load_secret(args.vault)
        set_runtime_passphrase(secret)
        return
    if args.hardware_key:
        secret = _load_secret(args.hardware_key)
        set_runtime_passphrase(secret)
        return


def _load_payload(path: Path) -> Any:
    text = path.read_text(encoding="utf-8")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text.strip()


def _decrypt_value(value: Any, component: str | None) -> Any:
    if isinstance(value, str) and value.startswith("ENC::"):
        if not component:
            raise SystemExit("Component required to decrypt raw encrypted token")
        return decrypt_token(component, value)
    if isinstance(value, dict):
        if value.get("__vaultfire_encrypted__"):
            inferred = value.get("encryption", {}).get("component")
            use_component = component or inferred
            if not use_component:
                raise SystemExit("Encrypted mapping missing component metadata")
            return decrypt_mapping(value)
    return value


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path, help="Path to the encrypted payload or config")
    parser.add_argument("--component", help="Override component name for raw tokens")
    parser.add_argument("--passphrase", help="Passphrase to decrypt with")
    parser.add_argument("--vault", help="Path to passphrase vault file")
    parser.add_argument("--hardware-key", help="Path to hardware key export")
    parser.add_argument("--output", type=Path, help="Optional path to write decrypted JSON")
    args = parser.parse_args(argv)

    _configure_passphrase(args)
    payload = _load_payload(args.path)
    component = args.component
    if isinstance(payload, dict) and payload.get("encryption"):
        component = component or payload.get("encryption", {}).get("component")
    decrypted = _decrypt_value(payload, component)
    if isinstance(decrypted, str):
        output_text = decrypted
    else:
        output_text = json.dumps(decrypted, indent=2, sort_keys=True)

    if args.output:
        args.output.write_text(output_text, encoding="utf-8")
    else:
        sys.stdout.write(output_text)
        if not output_text.endswith("\n"):
            sys.stdout.write("\n")
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    raise SystemExit(main())
