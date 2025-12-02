import base64
import json

from vaultfire.core.mirror_state import MirrorState


def test_signed_state_export_and_hooks():
    state = MirrorState(secret="mirror-secret")
    recorded = []
    state.register_hook(lambda entry: recorded.append(entry.state_hash))

    entry = state.log_prompt(
        session_id="session-2",
        prompt="Observe loyalty glow",
        response="Loyalty glow observed",
        alignment_score=99.5,
    )

    assert entry.receipt.startswith("receipt::")

    export = state.export_stealth(session_id="session-2")
    decoded = json.loads(base64.b64decode(export["export"]).decode())
    assert decoded[0]["state_hash"] == entry.state_hash
    assert export["proof"].startswith("zk-snark-proof::")
    assert recorded

