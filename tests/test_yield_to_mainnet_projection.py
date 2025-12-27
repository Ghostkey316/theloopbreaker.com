import json
from datetime import datetime, timezone

import pytest

try:
    import fastapi  # type: ignore  # noqa: F401  (import check for availability)
except ModuleNotFoundError:  # pragma: no cover - environment without optional deps
    fastapi = None  # type: ignore

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore  # noqa: F401
    from cryptography.exceptions import InvalidTag  # type: ignore  # noqa: F401
    HAS_CRYPTOGRAPHY = True
except (ImportError, ModuleNotFoundError):  # pragma: no cover - environment without optional deps
    HAS_CRYPTOGRAPHY = False

if fastapi is not None and HAS_CRYPTOGRAPHY:
    from scripts.run_yield_pipeline import pipeline
else:  # pragma: no cover - executed only when optional deps missing
    pipeline = None


@pytest.mark.skipif(
    fastapi is None or not HAS_CRYPTOGRAPHY,
    reason="[optional] fastapi and cryptography are required for yield pipeline tests",
)
@pytest.mark.asyncio
async def test_yield_to_mainnet_projection(tmp_path):
    source = tmp_path / 'logs'
    destination = tmp_path / 'cases'
    source.mkdir()

    log_payload = {
        'mission_id': 'mission-alpha',
        'pilot_id': 'pilot-1',
        'belief_id': 'engage-alpha',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'trigger_event': 'activation',
        'ghostscore_delta': 1.25,
        'activation_signals': [],
    }

    with (source / 'mission-alpha.json').open('w', encoding='utf-8') as handle:
        json.dump(log_payload, handle)

    result = await pipeline('https://base-mainnet.mock', source=source, destination=destination)

    assert result.zk_proof['circuit'] == 'vaultfire-yield-anonymizer'
    assert result.studies
    assert result.projection
    assert result.projection[0]['mission_hash'] == result.studies[0]['mission_hash']
    assert all(entry['projected_apr'] >= 0 for entry in result.projection)
