# Vaultfire Partner Activation Drop

This bundle provides a minimal partner-focused upload system for Vaultfire v1.0.
It mirrors the core secure upload pipeline and belief triggers from the main
repository so partners can run integration tests independently.

## Contents
- `secure_upload/` – webhook and secure store implementation
- `tests/` – pytest suite covering the upload pipeline
- `build_drop.sh` – helper script to create a zip archive
- `vaultfire_drop.json` – metadata about this release
