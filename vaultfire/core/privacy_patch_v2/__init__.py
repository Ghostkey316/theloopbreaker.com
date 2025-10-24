"""Privacy layer v2 flags and capability descriptors."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Sequence

__all__ = ["PrivacyPatch", "get_patch_manifest"]


@dataclass(frozen=True, slots=True)
class PrivacyPatch:
    version: str
    capabilities: Sequence[str]
    metadata: Mapping[str, str]


PATCH = PrivacyPatch(
    version="v2",
    capabilities=(
        "zbel_receipts",
        "x402_proxy_shield",
        "private_contributor_pools",
        "codex_memory_redaction",
        "noir_codex_support",
    ),
    metadata={
        "ghostkey_patch": "true",
        "x402_proxy": "enabled",
    },
)


def get_patch_manifest() -> PrivacyPatch:
    return PATCH
