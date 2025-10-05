# Forkable Protocol

This document captures the baseline settings for Vaultfire forks. It mirrors the data posted by ghostkey316.eth and outlines how new forks must be configured.

```yaml
forkable_protocol:
  name: Vaultfire Codex v1.1
  origin: ghostkey316.eth
  registry: OpenRouter Alpha Sync (live)
  compatibility:
    - GPT-4o
    - GPT-5 (Zenith)
    - Horizon Alpha
    - Claude Code (hooks-ready)
    - OpenAI o3-mini (reasoning tier)
    - Anthropic Sonnet Edge (privacy shard)
  ethics_layer: Ghostkey Ethics v2.0
  sync_tag: "bpow20.cb.id"
  license: Moral Memory Fork Agreement (MMFA)
  fork_rules:
    - Must retain ethics framework
    - Contributor lineage must be preserved
    - Commercial rights require opt-in beacon tag
    - Forks must reference original Vaultfire URI
  mission_lock:
    manifesto_uri: ghostkey_manifesto.md
    principles:
      - "Forgive the broken"
      - "Protect the good"
      - "Walk forward together"
  trust_extensions:
    zk_attestation:
      proof_system: Nova zk-SNARK rollups
      cadence: "per merge + quarterly aggregate"
    decentralized_identities:
      resolver: ENS + Spruce DIDKit
      revocation_window_days: 3
  security_upgrades:
    post_quantum_ready: true
    pq_suite:
      - CRYSTALS-Kyber key exchange
      - Dilithium signing shard (rotating)
    secure_inference_mesh:
      provider: EdgeBeam Secure Enclave
      failover: local_validator_pool
  ai_collaboration:
    co_processing_channels:
      - name: Symmetric Belief Loop
        purpose: Align AI signal feedback with human councils
        safeguards:
          - human_review_required
          - redemption_path_enforced
      - name: StoryWeave Memory Graph
        purpose: Trace contributor lineage and narrative context
        safeguards:
          - consent_required
          - ethics_guardian_alerts
  observability:
    realtime_dashboards:
      - guardian_loop.py
      - ghostloop_sync.py
    telemetry_sink: telemetry/telemetry_baseline.json
  fork_id: "\U0001f510 Vaultfire-ForkCore-0001"
```

These settings ensure that all derived instances follow the same ethics layer and maintain clear attribution while embracing cutting-edge trust, security, and collaboration tooling.
