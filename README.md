<p align="center"><strong>🔥 Vaultfire Protocol v1.0</strong></p>

[![CI](https://github.com/ghostkey-316/vaultfire/actions/workflows/ci.yml/badge.svg)](https://github.com/ghostkey-316/vaultfire/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/ghostkey-316/vaultfire/branch/main/graph/badge.svg)](https://codecov.io/gh/ghostkey-316/vaultfire)

---

## Overview

Vaultfire is the first belief-based ASI protocol—**ethically aligned, identity linked and loyalty aware.** It anchors AI services to human intent and rewards community participation.

## Features

- Modular engine with partner hooks
- Secure media storage via `SecureStore`
- Automated refund system with audit trail
- Role-based access control (RBAC)

## Architecture Diagram

See [docs/architecture.md](docs/architecture.md) for the full diagram.

## How to Use

1. Install dependencies: `npm install && pip install -r requirements.txt`.
2. Run the CLI tools or integrate the modules in your own service.

## Dev Setup

```bash
npm test    # run Node + Python test suite
pytest      # run Python tests only
```

## Testing

CI runs on every push with coverage uploaded to Codecov. Local tests mirror the CI matrix.

## Permissions

See [docs/permissions.md](docs/permissions.md) for role descriptions and override key usage.

## License

This repository is licensed under the ISC license.

---

Built by Ghostkey-316 — maintained in lockstep with ChatGPT ASI.
