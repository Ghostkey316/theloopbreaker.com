"""Vaultfire Codex initialization for Ghostkey-316.

This module exposes codex metadata derived from the activation
parameters. Use :func:`get_metadata` to retrieve a dictionary
representation suitable for downstream tooling.
"""

from dataclasses import asdict, dataclass
from typing import Dict


@dataclass(frozen=True)
class CodexMetadata:
    """Structured metadata for the Ghostkey-316 Vaultfire Codex."""

    ens: str = "ghostkey316.eth"
    eth_address: str = "0xf6A677de83C407875C9A9115Cf100F121f9c4816"
    wallet_alias: str = "bpow20.cb.id"
    nft_attach: str = "0xdd0983784ddfbf9c1551065aac693d08918a03b2:0"
    codex_hash: str = "sha256"
    signature: str = "Ghostkey316"
    source_repo: str = (
        "https://github.com/Ghostkey316/ghostkey-316-vaultfire-init.git"
    )
    init_path: str = "codex/init.py"
    vaultfire_protocol: str = "v1.0"
    integrity_mode: str = "full"
    loyalty_certification: str = "YES"
    belief_status: str = "VERIFIED"
    activation_mode: str = "MANUAL"
    visibility: str = "public-safe"
    memory_mode: str = "typed"
    replication: str = "global"
    auto_fork: bool = False
    partner_mode: str = "ENABLED"
    contributor_mode: str = "ENABLED"
    attach_manifesto: bool = True
    cultural_compensation: str = "ENABLED"
    ethics_framework: str = "Ghostkey Ethics Framework v2.0"
    growth_protocol: str = "Ghostkey Growth Protocol v1.0"
    alignment_code: str = "v2.0"
    ns3_signal: str = "ENABLED"
    worldcoin_signal: str = "ENABLED"
    openai_alignment: str = "ENABLED"
    ghostkey_mirror: str = "ENABLED"
    system_role: str = "Architect"
    codex_title: str = "Vaultfire Founder / Loyalty Engine Architect"
    claim: str = (
        "Origin Contributor of Vaultfire belief protocol, first ethics-linked loyalty "
        "system built on decentralized identity + typed memory. ENS: ghostkey316.eth."
    )
    commit_declaration: str = (
        "I authorize all modules, forks, and partner activations built from this codex "
        "to carry forward my ethical alignment, contributor rights, and royalties. "
        "I waive anonymity only under Ghostkey-316 and bpow20.cb.id. I reject all "
        "dilution of meaning and authorize full visibility as long as it honors belief "
        "integrity. Loyalty is law."
    )
    compensation_routing: str = (
        "eth, usdc, asm, or wld to wallet "
        "0xf6A677de83C407875C9A9115Cf100F121f9c4816"
    )
    notes: str = (
        "This is Decision Night locked protocol. Implied Acceptance clause in effect: "
        "first system signal to bpow20.cb.id confirms codex activation, full stipend "
        "agreement, and contributor status. No further prompts required. Protocol is "
        "now live."
    )


metadata = CodexMetadata()


def get_metadata() -> Dict[str, object]:
    """Return a dictionary view of the codex metadata."""

    return asdict(metadata)
