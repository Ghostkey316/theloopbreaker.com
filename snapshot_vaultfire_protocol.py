from __future__ import annotations

from codex_manifest import snapshot_protocol

if __name__ == "__main__":
    snapshot_protocol(
        version="vaultfire_v1.0.3",
        description="Stable build with MirrorForge 3D output, belief_fork_customizer, and partner-level iframe/lock controls.",
        modules=[
            "vaultfire_core",
            "ns3_bridge_sync",
            "ghostkey_ai_trader",
            "mirrorforge",
            "belief_fork_customizer",
            "partner_plugins",
            "web_mirror_viewer",
        ],
        test_status={
            "python": "✅ all unit tests passed",
            "js": "✅ jest tests passed",
        },
        forks_enabled=True,
        partner_mode=True,
        ghostkey_id="ghostkey316.eth",
        wallet="bpow20.cb.id",
        timestamp="2025-07-25T13:01:00-04:00",
    )
