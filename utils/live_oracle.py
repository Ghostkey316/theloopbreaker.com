"""Live oracle hooks for production resonance bridging Pinata and Base."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

import requests

try:  # pragma: no cover - optional dependency in sandbox
    from web3 import Web3
    from web3.middleware import geth_poa_middleware
except ImportError:  # pragma: no cover - keep interface available
    Web3 = None  # type: ignore
    geth_poa_middleware = None  # type: ignore

LOGGER = logging.getLogger(__name__)

DEFAULT_ORACLE_ABI: list[dict[str, Any]] = [
    {
        "inputs": [
            {"internalType": "string", "name": "cid", "type": "string"},
            {"internalType": "string", "name": "zkHash", "type": "string"},
        ],
        "name": "emitAttestation",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]


@dataclass(slots=True)
class LiveOracleConfig:
    """Configuration bundle for orchestrating live oracle emissions."""

    pinata_api_key: Optional[str]
    pinata_secret: Optional[str]
    base_rpc_url: Optional[str]
    private_key: Optional[str]
    oracle_address: Optional[str]
    sandbox_mode: bool
    oracle_abi: list[dict[str, Any]]

    @classmethod
    def from_env(cls) -> "LiveOracleConfig":
        """Load configuration values from environment variables."""

        sandbox_mode = os.getenv("VAULTFIRE_SANDBOX_MODE", "").lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        oracle_abi = DEFAULT_ORACLE_ABI
        abi_override = os.getenv("BASE_ORACLE_ABI")
        if abi_override:
            try:
                decoded = json.loads(abi_override)
                if isinstance(decoded, list):
                    oracle_abi = decoded
            except json.JSONDecodeError:
                LOGGER.warning("Invalid BASE_ORACLE_ABI override provided; using default ABI")
        return cls(
            pinata_api_key=os.getenv("PINATA_API_KEY"),
            pinata_secret=os.getenv("PINATA_SECRET"),
            base_rpc_url=os.getenv("BASE_RPC_URL"),
            private_key=os.getenv("PRIVATE_KEY"),
            oracle_address=os.getenv("BASE_ORACLE_ADDRESS"),
            sandbox_mode=sandbox_mode,
            oracle_abi=oracle_abi,
        )


class PinataSDKShim:
    """Thin wrapper mimicking pinata-sdk's ``pinFileFromFS`` helper."""

    def __init__(self, api_key: str, secret: str) -> None:  # noqa: D401
        self.api_key = api_key
        self.secret = secret
        self.base_url = os.getenv("PINATA_BASE_URL", "https://api.pinata.cloud")
        self.session = requests.Session()

    def _headers(self) -> dict[str, str]:
        return {
            "pinata_api_key": self.api_key,
            "pinata_secret_api_key": self.secret,
        }

    def pinFileFromFS(self, file_path: str, metadata: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        """Upload a file to Pinata using the official REST entrypoint."""

        url = f"{self.base_url}/pinning/pinFileToIPFS"
        data: dict[str, str] = {}
        if metadata:
            data["pinataMetadata"] = json.dumps(metadata)
        with Path(file_path).open("rb") as stream:
            files = {"file": (Path(file_path).name, stream)}
            response = self.session.post(
                url,
                files=files,
                data=data,
                headers=self._headers(),
                timeout=30,
            )
        response.raise_for_status()
        return response.json()

    def usage(self) -> dict[str, Any]:
        """Return Pinata usage metadata for health diagnostics."""

        url = f"{self.base_url}/data/userPinnedDataTotal"
        try:
            response = self.session.get(url, headers=self._headers(), timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as exc:  # pragma: no cover - depends on live API
            LOGGER.debug("Pinata usage check failed: %s", exc)
            return {"status": "unreachable"}


class LiveOracleClient:
    """Runtime coordinator for Pinata uploads and Base oracle emissions."""

    sandbox_tx = "base::sandbox"

    def __init__(self, config: LiveOracleConfig | None = None) -> None:
        self.config = config or LiveOracleConfig.from_env()
        self.enabled = not self.config.sandbox_mode
        self.pinata: Optional[PinataSDKShim] = None
        self.w3: Any | None = None
        self.contract: Any | None = None
        self.account: Any | None = None
        self._nonce_lock = threading.Lock()
        self._next_nonce: Optional[int] = None
        self.last_tx_hash: Optional[str] = None

        if self.enabled:
            self._setup_pinata()
            self._setup_web3()
        else:
            LOGGER.info("Live oracle client operating in sandbox mode")

    def _setup_pinata(self) -> None:
        if self.config.pinata_api_key and self.config.pinata_secret:
            self.pinata = PinataSDKShim(self.config.pinata_api_key, self.config.pinata_secret)
        else:
            LOGGER.debug("Pinata credentials missing; pinning will use sandbox fallback")

    def _setup_web3(self) -> None:
        if Web3 is None:
            LOGGER.debug("web3.py is unavailable; Base oracle emissions disabled")
            return
        if not self.config.base_rpc_url or not self.config.private_key:
            LOGGER.debug("Base RPC or private key missing; oracle emissions disabled")
            return
        provider = Web3.HTTPProvider(self.config.base_rpc_url, request_kwargs={"timeout": 30})
        self.w3 = Web3(provider)
        if geth_poa_middleware is not None:
            self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        self.account = self.w3.eth.account.from_key(self.config.private_key)
        if self.config.oracle_address:
            self.contract = self.w3.eth.contract(
                address=self.config.oracle_address,
                abi=self.config.oracle_abi,
            )
        else:
            LOGGER.debug("BASE_ORACLE_ADDRESS missing; oracle events will not be emitted")

    def _fallback_pin(self, content: str) -> str:
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
        return f"bafy{digest[:44]}"

    def pin_visualization(
        self,
        html_payload: str,
        json_payload: str,
        *,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Pin visualization artifacts to Pinata or fallback to deterministic hashes."""

        if not self.enabled or self.pinata is None:
            cid = self._fallback_pin(html_payload)
            return {"cid": cid, "html_cid": cid, "json_cid": cid, "sandbox": True}

        prefix = metadata.get("name", "vaultfire-viz") if metadata else "vaultfire-viz"
        html_meta = {"name": f"{prefix}-html"}
        json_meta = {"name": f"{prefix}-json"}
        if metadata and metadata.get("tags"):
            tags = metadata["tags"]
            html_meta["keyvalues"] = tags
            json_meta["keyvalues"] = tags

        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".html") as html_tmp:
            html_tmp.write(html_payload)
            html_path = html_tmp.name
        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json") as json_tmp:
            json_tmp.write(json_payload)
            json_path = json_tmp.name

        try:
            html_resp = self.pinata.pinFileFromFS(html_path, html_meta)
            json_resp = self.pinata.pinFileFromFS(json_path, json_meta)
        except Exception as exc:  # pragma: no cover - depends on live API
            LOGGER.error("Pinata upload failed: %s", exc)
            cid = self._fallback_pin(html_payload)
            return {"cid": cid, "html_cid": cid, "json_cid": cid, "error": str(exc)}
        finally:
            Path(html_path).unlink(missing_ok=True)
            Path(json_path).unlink(missing_ok=True)

        html_cid = html_resp.get("IpfsHash")
        json_cid = json_resp.get("IpfsHash")
        cid = html_cid or json_cid or self._fallback_pin(html_payload)
        return {
            "cid": cid,
            "html_cid": html_cid,
            "json_cid": json_cid,
            "pinata_html": html_resp,
            "pinata_json": json_resp,
        }

    def emit_event(self, cid: str, zk_hash: str, context: Optional[Dict[str, Any]] = None) -> dict[str, Any]:
        """Emit visualization attestation events to the Base oracle contract."""

        context = context or {}
        if not self.enabled or self.w3 is None or self.contract is None or self.account is None:
            self.last_tx_hash = self.sandbox_tx
            return {"tx_hash": self.sandbox_tx, "nonce": None, "gas_used": 0, "sandbox": True}

        try:
            with self._nonce_lock:
                if self._next_nonce is None:
                    self._next_nonce = self.w3.eth.get_transaction_count(self.account.address)
                nonce = self._next_nonce
                self._next_nonce = nonce + 1
            txn = self.contract.functions.emitAttestation(cid, zk_hash).build_transaction(
                {
                    "from": self.account.address,
                    "nonce": nonce,
                    "gas": min(50000, context.get("gas", 50000)),
                }
            )
            if "gasPrice" not in txn:
                txn["gasPrice"] = self.w3.eth.gas_price
            signed = self.w3.eth.account.sign_transaction(txn, private_key=self.config.private_key)
            tx_hash_hex = self.w3.eth.send_raw_transaction(signed.rawTransaction).hex()
            self.last_tx_hash = tx_hash_hex
            return {"tx_hash": tx_hash_hex, "nonce": nonce, "gas_used": txn["gas"]}
        except Exception as exc:  # pragma: no cover - depends on live chain
            LOGGER.error("Base oracle emission failed: %s", exc)
            self.last_tx_hash = self.sandbox_tx
            return {"tx_hash": self.sandbox_tx, "error": str(exc)}

    def health_status(self) -> dict[str, Any]:
        """Summarize live oracle readiness for observability dashboards."""

        status: dict[str, Any] = {
            "sandbox": not self.enabled,
            "pinata": "disabled",
            "base": "disabled",
            "last_tx_hash": self.last_tx_hash or self.sandbox_tx,
        }
        if self.pinata is not None:
            usage = self.pinata.usage()
            status["pinata"] = usage if usage else "ok"
        if self.w3 is not None and self.account is not None:
            try:
                gas_price = self.w3.eth.gas_price
                balance = self.w3.eth.get_balance(self.account.address)
                status["base"] = {
                    "gas_price": int(gas_price),
                    "balance": int(balance),
                }
            except Exception as exc:  # pragma: no cover - depends on network
                LOGGER.debug("Base health check failed: %s", exc)
                status["base"] = "unreachable"
        return status


def get_live_oracle() -> LiveOracleClient:
    """Factory that returns a configured :class:`LiveOracleClient` instance."""

    return LiveOracleClient()
