"""Global toggle for mobile execution mode."""

import os

MOBILE_MODE = os.environ.get("MOBILE_MODE", "1") == "1"

__all__ = ["MOBILE_MODE"]
