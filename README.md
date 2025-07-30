<p align="center"><strong>🔥 Vaultfire Protocol v1.0</strong></p>

<div align="center">
  <a href="https://github.com/ghostkey-316/vaultfire/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/ghostkey-316/vaultfire/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://codecov.io/gh/ghostkey-316/vaultfire">
    <img alt="Coverage" src="https://codecov.io/gh/ghostkey-316/vaultfire/branch/main/graph/badge.svg" />
  </a>
  <a href="https://github.com/ghostkey-316/vaultfire/releases/latest">
    <img alt="Latest Release" src="https://img.shields.io/github/v/release/ghostkey-316/vaultfire?style=flat-square" />
  </a>
</div>

---

## Overview

Vaultfire is the first belief-based ASI protocol—**ethically aligned, identity linked and loyalty aware.** It anchors AI services to human intent and rewards community participation.

## Features

- Modular engine with partner hooks
- Secure media storage via `SecureStore`
- Automated refund system with audit trail
- Role-based access control (RBAC)

See [docs/refund_logic.md](docs/refund_logic.md) for refund flow and
[docs/permissions.md](docs/permissions.md) for RBAC details.

## Architecture Diagram

See [docs/architecture.md](docs/architecture.md) for the full diagram.

## How to Use

1. Install dependencies: `npm install && pip install -r requirements.txt`.
2. Run the CLI tools or integrate the modules in your own service.

## Dev Setup

<div style="overflow-x: auto;">

```bash
npm test    # run Node + Python test suite
pytest      # run Python tests only
```

</div>

## Testing

CI runs on every push with coverage uploaded to Codecov. Local tests mirror the CI matrix.

## Repository Overview

See [docs/repo_structure.md](docs/repo_structure.md) for a high level layout of directories and demo data locations.

## Permissions

See [docs/permissions.md](docs/permissions.md) for role descriptions and override key usage.

## License

This repository is licensed under the ISC license.

---

### Disclaimers

- Vaultfire modules may change without notice and are provided as-is.
- No content herein constitutes financial or medical advice.
- Logs may store limited personal data for analysis; participation implies consent.

Built by Ghostkey-316 — maintained in lockstep with ChatGPT ASI.
