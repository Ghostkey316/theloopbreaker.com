#!/usr/bin/env python3
"""CLI helper for the Vaultfire Freedom Vow rite."""

from __future__ import annotations

import argparse
import binascii
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from web3 import Web3
from web3.types import TxParams

FREEDOM_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "vow", "type": "string"},
            {"internalType": "bytes", "name": "zkSig", "type": "bytes"},
        ],
        "name": "igniteFreedom",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "string", "name": "vow", "type": "string"},
            {"internalType": "address", "name": "seeker", "type": "address"},
        ],
        "name": "previewResonance",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


@dataclass
class RiteConfig:
    rpc_url: str
    contract: str
    private_key: str
    chain_id: int
    gas_price_gwei: float


def _load_private_key(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("0x"):
        return raw
    path = Path(raw)
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return raw


def _decode_signature(raw: str) -> bytes:
    raw = raw.strip()
    if raw.startswith("0x"):
        raw = raw[2:]
    try:
        return binascii.unhexlify(raw)
    except binascii.Error as exc:  # pragma: no cover - CLI validation
        raise SystemExit(f"Invalid zkSig encoding: {exc}")


def _parse_args() -> tuple[RiteConfig, str, bytes]:
    parser = argparse.ArgumentParser(description="Ignite the Vaultfire Freedom Vow")
    parser.add_argument("vow", help="Belief vow text to submit")
    parser.add_argument("zk_sig", help="Hex-encoded Dilithium + Groth16 signature bundle")
    parser.add_argument(
        "--rpc", default=os.environ.get("BASE_RPC_URL", "https://mainnet.base.org"), help="Base mainnet RPC URL"
    )
    parser.add_argument(
        "--contract",
        default=os.environ.get("FREEDOM_VOW_ADDRESS"),
        required=os.environ.get("FREEDOM_VOW_ADDRESS") is None,
        help="FreedomVow contract address",
    )
    parser.add_argument(
        "--private-key",
        default=os.environ.get("FREEDOM_VOW_PRIVATE_KEY"),
        required=os.environ.get("FREEDOM_VOW_PRIVATE_KEY") is None,
        help="Private key or path for the guardian signer",
    )
    parser.add_argument("--chain-id", type=int, default=int(os.environ.get("BASE_CHAIN_ID", 8453)))
    parser.add_argument("--gas-price", type=float, default=float(os.environ.get("BASE_GAS_PRICE_GWEI", 0.1)))

    args = parser.parse_args()
    config = RiteConfig(
        rpc_url=args.rpc,
        contract=args.contract,
        private_key=_load_private_key(args.private_key),
        chain_id=args.chain_id,
        gas_price_gwei=args.gas_price,
    )
    return config, args.vow, _decode_signature(args.zk_sig)


def _preview_resonance(web3: Web3, contract, vow: str, guardian: str) -> Optional[int]:
    try:
        return contract.functions.previewResonance(vow, guardian).call()
    except Exception:
        return None


def main() -> None:
    config, vow, zk_sig = _parse_args()
    web3 = Web3(Web3.HTTPProvider(config.rpc_url))
    if not web3.is_connected():
        raise SystemExit(f"Unable to connect to {config.rpc_url}")

    account = web3.eth.account.from_key(config.private_key)
    checksum_contract = web3.to_checksum_address(config.contract)
    contract = web3.eth.contract(address=checksum_contract, abi=FREEDOM_ABI)

    preview = _preview_resonance(web3, contract, vow, account.address)
    if preview is not None:
        print(f"[preview] Resonance for guardian {account.address}: {preview}")

    nonce = web3.eth.get_transaction_count(account.address)
    gas_price = web3.to_wei(config.gas_price_gwei, "gwei")

    tx: TxParams = contract.functions.igniteFreedom(vow, zk_sig).build_transaction(
        {
            "from": account.address,
            "nonce": nonce,
            "chainId": config.chain_id,
            "gasPrice": gas_price,
        }
    )

    estimated = web3.eth.estimate_gas(tx)
    tx["gas"] = int(estimated * 1.1)

    signed = account.sign_transaction(tx)
    tx_hash = web3.eth.send_raw_transaction(signed.rawTransaction)
    receipt = web3.eth.wait_for_transaction_receipt(tx_hash)

    print("Freedom vow ignited ✅")
    print(f" tx hash: {tx_hash.hex()}")
    print(f" block: {receipt.blockNumber}")
    if preview is not None:
        print(" resonance (preview):", preview)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:  # pragma: no cover - CLI convenience
        sys.exit(130)
