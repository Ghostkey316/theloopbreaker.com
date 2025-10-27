import pytest
from unittest.mock import MagicMock


@pytest.fixture
def mock_wallet_metadata():
    """Provide a reusable wallet metadata stub for tests that expect ENS context."""

    return MagicMock(ens="ghostkey316.eth", nft_id="0x123...vaultfire_badge")
