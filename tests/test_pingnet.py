import json
from pathlib import Path

from vaultfire.quantum.sovereign_layer import QuantumRelayPingNet


def test_quantum_relay_pingnet_logs_liveness(tmp_path, monkeypatch):
    log_path = tmp_path / "relay_logs" / "liveness.json"
    pingnet = QuantumRelayPingNet(log_path)

    trusted_nodes = ["node-alpha", "node-beta"]
    latencies = {"node-alpha": 12.5, "node-beta": 78.3}
    records = pingnet.broadcast_and_validate(trusted_nodes, latencies)

    assert len(records) == 2
    for record in records:
        assert record["zk_timestamp_proof"].startswith("zkts-")
        assert record["liveness"] is True

    stored = json.loads(Path(log_path).read_text())
    assert stored[0]["node"] == "node-alpha"
    assert stored[1]["latency_millis"] == 78.3
