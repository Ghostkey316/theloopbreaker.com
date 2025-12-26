"""FastAPI server for metrics and health checks."""

from vaultfire.api.server import FASTAPI_AVAILABLE, app, create_app

__all__ = ["app", "create_app", "FASTAPI_AVAILABLE"]
