"""Validation suite for the ShadowFrost expansion modules."""
from datetime import datetime, timedelta

from consent_plus import ConsentPlusMode
from deception_net import ShadowFrostDeceptionLayer
from frostmask import FrostmaskUtility
from shadowbridge import ShadowBridge


def test_dynamic_address_mutability_and_logging():
    layer = ShadowFrostDeceptionLayer()
    mutated = layer.mutate_address("0x1234", "mobile-hop")
    assert mutated.startswith("0x")
    # mutating with a different vector should produce a distinct record
    second = layer.mutate_address("0x1234", "wallet-hop")
    assert mutated != second
    assert len(layer.mutation_log) == 2


def test_stealth_rekeying_schedules():
    layer = ShadowFrostDeceptionLayer()
    lead = timedelta(minutes=7)
    schedule = layer.schedule_rekey("ghostkey316.eth", "mobile-sync", lead_time=lead)
    delta = schedule.next_rotation - datetime.utcnow()
    assert 0 < delta.total_seconds() <= lead.total_seconds() + 1
    assert schedule.mobile_channel and schedule.wallet_channel
    assert layer.pending_rekeys("ghostkey316.eth")[0] == schedule


def test_time_shifted_transaction_cloaking():
    layer = ShadowFrostDeceptionLayer()
    base = datetime.utcnow()
    txs = [
        {"id": "a", "timestamp": base},
        {"id": "b", "timestamp": base + timedelta(seconds=3)},
    ]
    cloaked = layer.cloak_transactions(txs, max_window=timedelta(seconds=60))
    assert len(cloaked) == 2
    assert all(item.cloaked_timestamp > item.original_timestamp for item in cloaked)
    assert cloaked[0].offset_seconds < cloaked[1].offset_seconds


def test_quantum_resistant_handshake_fallback():
    layer = ShadowFrostDeceptionLayer()
    result = layer.negotiate_quantum_fallback("peer:fingerprint")
    assert result.fallback_cipher in {"Kyber1024", "Falcon-1024"}
    assert "ghostkey316://override" in result.override_route
    assert result.status == "override-ready"


def test_frostmask_operations():
    utility = FrostmaskUtility()
    jam = utility.jam_signal(5, ["ns3", "vaultfire"], duration_seconds=240)
    assert jam.duration_seconds == 240
    decoys = utility.emit_decoy_contracts(2, "shadow-frost")
    assert decoys[-1].honeypot is True
    profile = utility.configure_honeypot("vaultfire-sink", 0.8, filters=["ns3", "audit"])
    assert profile.channel == "vaultfire-sink"
    activation = utility.apply_legal_fuzzing("eu-compliant")
    assert utility.legal_fuzzing_regions["eu-compliant"] == activation


def test_shadowbridge_sync_and_overrides():
    bridge = ShadowBridge()
    event = bridge.sync_layers(b"payload", source="ns3", destination="ghostshroud")
    assert event.source == "ns3"
    masked = bridge.mask_biometric("abc123")
    assert masked.startswith("obfuscate:")
    route = bridge.route_override("bpow20.cb.id")
    assert route.endswith("/00")
    custom_route = bridge.route_override("mission.control")
    assert custom_route.startswith("shadowbridge://override/mission.control")


def test_consent_plus_dashboard_and_kill_switch():
    consent = ConsentPlusMode()
    beacon = consent.emit_revocation_beacon("consent-001", reason="mission override")
    assert beacon.consent_id == "consent-001"
    event = consent.trigger_kill_switch("ghostshroud-cli")
    assert event.route.startswith("consentplus://")
    snapshot = consent.dashboard_snapshot()
    assert snapshot["revocations"] == "1"
    assert snapshot["kill_switches"] == "1"
    assert "beacon:consent-001" in snapshot
