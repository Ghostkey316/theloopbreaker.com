"""Entry point for ``python -m vaultfire_cli``."""

from .main import main


if __name__ == "__main__":  # pragma: no cover - script entrypoint
    raise SystemExit(main())

