import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def pytest_addoption(parser: pytest.Parser) -> None:
    """Register custom command line options for the Vaultfire test suite."""

    parser.addoption(
        "--identity",
        action="store",
        default="",
        help="Identity tag used for simulated trial activations.",
    )


@pytest.fixture()
def identity(request: pytest.FixtureRequest) -> str:
    """Expose the requested identity tag to tests that simulate live traffic."""

    return request.config.getoption("identity")
