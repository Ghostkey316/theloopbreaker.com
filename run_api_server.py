#!/usr/bin/env python3
"""Run the Vaultfire API server with metrics and health endpoints.

Usage:
    python run_api_server.py

Or with uvicorn directly:
    uvicorn vaultfire.api.server:app --host 0.0.0.0 --port 8000 --reload
"""
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

try:
    import uvicorn
except ImportError:
    logger.error("uvicorn not installed. Install with: pip install uvicorn")
    sys.exit(1)

try:
    from vaultfire.api import FASTAPI_AVAILABLE
    if not FASTAPI_AVAILABLE:
        logger.error("FastAPI not installed. Install with: pip install fastapi uvicorn")
        sys.exit(1)
except ImportError:
    logger.error("Vaultfire API module not found")
    sys.exit(1)


if __name__ == "__main__":
    logger.info("Starting Vaultfire API server...")
    logger.info("Metrics endpoint: http://localhost:8000/metrics")
    logger.info("Health endpoint: http://localhost:8000/health")
    logger.info("API docs: http://localhost:8000/docs")

    uvicorn.run(
        "vaultfire.api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
