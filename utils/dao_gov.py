"""Vaultfire DAO governance helpers for guardian mission evolutions."""

from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Sequence

try:  # pragma: no cover - optional dependency in some environments
    from web3 import Web3
    from web3.middleware import geth_poa_middleware
except ImportError:  # pragma: no cover - maintain import surface
    Web3 = None  # type: ignore
    geth_poa_middleware = None  # type: ignore

DEFAULT_DAO_ABI: list[dict[str, Any]] = [
    {
        "inputs": [
            {"internalType": "string[]", "name": "virtues", "type": "string[]"},
            {"internalType": "uint256[]", "name": "weights", "type": "uint256[]"},
            {"internalType": "string", "name": "description", "type": "string"},
        ],
        "name": "proposeMissionEvo",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "proposalId", "type": "uint256"},
            {"internalType": "uint8", "name": "support", "type": "uint8"},
        ],
        "name": "castVote",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


@dataclass(slots=True)
class VaultfireDAOConfig:
    """Runtime configuration for interacting with the VaultfireDAO contract."""

    rpc_url: str | None
    private_key: str | None
    dao_address: str | None
    abi: Sequence[dict[str, Any]]
    sandbox_mode: bool

    @classmethod
    def from_env(cls) -> "VaultfireDAOConfig":
        """Load configuration using environment variables."""

        sandbox_mode = os.getenv("VAULTFIRE_DAO_SANDBOX", "").lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        abi_payload = os.getenv("VAULTFIRE_DAO_ABI")
        abi: Sequence[dict[str, Any]] = DEFAULT_DAO_ABI
        if abi_payload:
            try:
                parsed = json.loads(abi_payload)
                if isinstance(parsed, list):
                    abi = parsed
            except json.JSONDecodeError:
                pass
        return cls(
            rpc_url=os.getenv("VAULTFIRE_DAO_RPC_URL") or os.getenv("BASE_RPC_URL"),
            private_key=os.getenv("VAULTFIRE_DAO_PRIVATE_KEY") or os.getenv("PRIVATE_KEY"),
            dao_address=os.getenv("VAULTFIRE_DAO_ADDRESS"),
            abi=abi,
            sandbox_mode=sandbox_mode,
        )


class VaultfireDAOClient:
    """Web3.py wrapper that coordinates mission evolution proposals and votes."""

    sandbox_tx = "dao::sandbox"

    def __init__(
        self,
        config: VaultfireDAOConfig | None = None,
        *,
        emitter: Callable[[dict[str, Any]], None] | None = None,
        web3_client: Any | None = None,
        contract: Any | None = None,
    ) -> None:
        self.config = config or VaultfireDAOConfig.from_env()
        self.emitter = emitter
        self.enabled = not self.config.sandbox_mode
        self.w3: Any | None = None
        self.contract: Any | None = None
        self.account: Any | None = None
        self._nonce_lock = threading.Lock()
        self._next_nonce: int | None = None
        self.last_tx_hash: str | None = None

        if not self.enabled:
            return

        if web3_client is not None:
            self.w3 = web3_client
        elif Web3 is not None and self.config.rpc_url:
            provider = Web3.HTTPProvider(self.config.rpc_url, request_kwargs={"timeout": 30})
            self.w3 = Web3(provider)
            if geth_poa_middleware is not None:
                self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        elif Web3 is None:
            self.enabled = False
            return
        else:
            self.enabled = False

        if not self.enabled or self.w3 is None:
            return

        if self.config.private_key:
            self.account = self.w3.eth.account.from_key(self.config.private_key)
        else:
            default = getattr(self.w3.eth, "default_account", None)
            if default:
                self.account = type("_Account", (), {"address": default})()  # pragma: no cover - convenience path
            self.enabled = False

        if contract is not None:
            self.contract = contract
        elif self.config.dao_address and self.config.abi:
            address = self.w3.to_checksum_address(self.config.dao_address)
            self.contract = self.w3.eth.contract(address=address, abi=list(self.config.abi))

        if self.account is None or self.contract is None or not self.config.private_key:
            self.enabled = False

    def propose_evo(
        self,
        new_weights: Mapping[str, float | int],
        description: str = "Vaultfire mission evolution"
    ) -> str:
        """Submit a mission evolution proposal targeting the Base oracle."""

        virtues, weights = self._normalize_weights(new_weights)
        weights_map = {str(key): float(value) if isinstance(value, (int, float)) else value for key, value in new_weights.items()}
        payload = {
            "virtues": virtues,
            "weights": weights,
            "description": description,
            "weights_map": weights_map,
        }

        if not self.enabled or self.w3 is None or self.contract is None or self.account is None:
            self.last_tx_hash = self.sandbox_tx
            self._emit("propose", self.sandbox_tx, payload)
            return self.sandbox_tx

        tx_hash = self._transact(
            self.contract.functions.proposeMissionEvo(virtues, weights, description),
            gas=400_000,
        )
        self._emit("propose", tx_hash, payload)
        return tx_hash

    def vote_on_proposal(self, proposal_id: int, support: bool) -> str:
        """Cast a guardian vote on the provided proposal identifier."""

        if proposal_id < 0:
            raise ValueError("proposal_id must be non-negative")
        support_flag = 1 if support else 0
        payload = {"proposal_id": int(proposal_id), "support": support_flag}

        if not self.enabled or self.w3 is None or self.contract is None or self.account is None:
            self.last_tx_hash = self.sandbox_tx
            self._emit("vote", self.sandbox_tx, payload)
            return self.sandbox_tx

        tx_hash = self._transact(
            self.contract.functions.castVote(int(proposal_id), support_flag),
            gas=150_000,
        )
        self._emit("vote", tx_hash, payload)
        return tx_hash

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------
    def _transact(self, fn: Any, *, gas: int) -> str:
        if self.w3 is None or self.account is None:
            return self.sandbox_tx
        with self._nonce_lock:
            if self._next_nonce is None:
                self._next_nonce = self.w3.eth.get_transaction_count(self.account.address)
            nonce = self._next_nonce
            self._next_nonce = nonce + 1
        tx = fn.build_transaction({"from": self.account.address, "nonce": nonce, "gas": gas})
        if "gasPrice" not in tx and hasattr(self.w3.eth, "gas_price"):
            tx["gasPrice"] = self.w3.eth.gas_price
        if not self.config.private_key:
            raise RuntimeError("VAULTFIRE_DAO_PRIVATE_KEY is required for live transactions")
        signed = self.w3.eth.account.sign_transaction(tx, private_key=self.config.private_key)
        raw_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        tx_hash = raw_hash.hex() if hasattr(raw_hash, "hex") else str(raw_hash)
        self.last_tx_hash = tx_hash
        return tx_hash

    def _emit(self, action: str, tx_hash: str, payload: Mapping[str, Any]) -> None:
        if self.emitter is None:
            return
        event = {"dao_vote": {"action": action, "tx": tx_hash}}
        event["dao_vote"].update(payload)
        try:
            self.emitter(event)
        except Exception:  # pragma: no cover - defensive guard
            pass

    @staticmethod
    def _normalize_weights(new_weights: Mapping[str, float | int]) -> tuple[list[str], list[int]]:
        if not isinstance(new_weights, Mapping) or not new_weights:
            raise ValueError("new_weights must be a non-empty mapping")
        virtues: list[str] = []
        weights: list[int] = []
        for key, raw_value in new_weights.items():
            virtue = str(key).strip()
            if not virtue:
                raise ValueError("virtue names must be non-empty strings")
            scaled = VaultfireDAOClient._scale_weight(raw_value)
            virtues.append(virtue)
            weights.append(scaled)
        return virtues, weights

    @staticmethod
    def _scale_weight(value: float | int) -> int:
        if isinstance(value, bool):
            raise ValueError("boolean weights are not supported")
        if isinstance(value, int):
            if value <= 0:
                raise ValueError("weight must be positive")
            return value
        scaled = int(round(float(value) * 10_000))
        if scaled <= 0:
            raise ValueError("weight must be positive")
        return scaled


__all__ = ["VaultfireDAOClient", "VaultfireDAOConfig"]
