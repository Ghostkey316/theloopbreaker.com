from __future__ import annotations

import pytest

from utils.dao_gov import VaultfireDAOClient, VaultfireDAOConfig


class _FakeRawHash:
    def __init__(self, value: str) -> None:
        self._value = value

    def hex(self) -> str:  # pragma: no cover - exercised indirectly
        return self._value


class _FakeSigned:
    rawTransaction = b"raw"


class _FakeEth:
    def __init__(self) -> None:
        self.gas_price = 100
        self._nonce = 0
        self._account = type("Acct", (), {"address": "0xacc"})()
        self.account = self
        self.last_signed = None
        self.last_sent = None

    def from_key(self, _key: str):
        return self._account

    def get_transaction_count(self, _address: str) -> int:
        return self._nonce

    def sign_transaction(self, tx: dict, *, private_key: str | None = None):
        self.last_signed = (tx, private_key)
        return _FakeSigned()

    def send_raw_transaction(self, _payload: bytes):
        self.last_sent = _payload
        self._nonce += 1
        return _FakeRawHash("0xtest")


class _FakeWeb3:
    def __init__(self) -> None:
        self.eth = _FakeEth()

    def to_checksum_address(self, address: str) -> str:
        return address


class _SpyContract:
    def __init__(self) -> None:
        self.functions = self
        self.calls: dict[str, tuple] = {}
        self.last_tx: dict | None = None

    def proposeMissionEvo(self, virtues, weights, description):
        self.calls["propose"] = (list(virtues), list(weights), description)
        return _SpyFunction(self)

    def castVote(self, proposal_id, support):
        self.calls["vote"] = (proposal_id, support)
        return _SpyFunction(self)


class _SpyFunction:
    def __init__(self, parent: _SpyContract) -> None:
        self.parent = parent

    def build_transaction(self, params: dict):
        self.parent.last_tx = dict(params)
        return {"from": params["from"], "nonce": params["nonce"], "gas": params["gas"]}


def _live_config() -> VaultfireDAOConfig:
    return VaultfireDAOConfig(
        rpc_url="http://localhost:8545",
        private_key="0x123",
        dao_address="0xdao",
        abi=[],
        sandbox_mode=False,
    )


def test_propose_evo_builds_payload_and_emits():
    contract = _SpyContract()
    web3 = _FakeWeb3()
    events: list[dict] = []
    client = VaultfireDAOClient(_live_config(), emitter=events.append, web3_client=web3, contract=contract)

    tx_hash = client.propose_evo({"empathy": 0.6, "courage": 0.4}, "Boost empathy")

    assert tx_hash == "0xtest"
    assert contract.calls["propose"] == (["empathy", "courage"], [6000, 4000], "Boost empathy")
    assert contract.last_tx["gas"] == 400_000
    assert events[-1]["dao_vote"]["action"] == "propose"
    assert events[-1]["dao_vote"]["weights_map"]["empathy"] == pytest.approx(0.6)


def test_vote_on_proposal_streams_support_flag():
    contract = _SpyContract()
    web3 = _FakeWeb3()
    events: list[dict] = []
    client = VaultfireDAOClient(_live_config(), emitter=events.append, web3_client=web3, contract=contract)

    tx_hash = client.vote_on_proposal(42, True)

    assert tx_hash == "0xtest"
    assert contract.calls["vote"] == (42, 1)
    assert events[-1]["dao_vote"]["support"] == 1


def test_invalid_weights_raise():
    client = VaultfireDAOClient(_live_config(), web3_client=_FakeWeb3(), contract=_SpyContract())
    with pytest.raises(ValueError):
        client.propose_evo({}, "bad")
    with pytest.raises(ValueError):
        client.propose_evo({"": 1}, "bad")
    with pytest.raises(ValueError):
        client.propose_evo({"virtue": 0}, "bad")


def test_sandbox_mode_returns_placeholder():
    config = VaultfireDAOConfig(rpc_url=None, private_key=None, dao_address=None, abi=[], sandbox_mode=True)
    client = VaultfireDAOClient(config)
    assert client.propose_evo({"empathy": 1}, "demo") == "dao::sandbox"
    assert client.vote_on_proposal(1, False) == "dao::sandbox"
