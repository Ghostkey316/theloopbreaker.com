from loop_bridge import LoopBridge


def test_loop_bridge_relay_and_entropy():
    fingerprints = []

    def seed_callback(seed: str) -> None:
        fingerprints.append(seed)

    bridge = LoopBridge("mirror-drift", seed_callback=seed_callback)

    mirror_payload = bridge.relay_to_mirror({"msg": "hello"})
    ghostops_payload = bridge.relay_to_ghostops({"msg": "secret"})

    bridge.rotate_alignment_seed("seed-1")

    assert mirror_payload.channel == "mirror-drift"
    assert mirror_payload.fingerprint
    assert ghostops_payload.content["mode"] == "active"
    assert ghostops_payload.fingerprint
    assert fingerprints == ["seed-1"]

    entropy = bridge.belief_entropy([0.5, 0.3, 0.2])
    assert 0 < entropy < 2
