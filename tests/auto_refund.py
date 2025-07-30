"""Demo script for automated refund simulation."""
from __future__ import annotations

import json

from vaultfire.refund.auto_refund import auto_refund, freeze_refunds, unfreeze_refunds


def demo() -> None:
    """Run a demo refund operation."""
    freeze_refunds()
    result = auto_refund("demo.eth", "demo_error", admin_override=True)
    unfreeze_refunds()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    demo()
