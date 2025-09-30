# Vaultfire Hardening Fixes

## Summary
- Introduced authenticated handshake discovery with HMAC-signed responses.
- Added admin-only rotation status endpoint with sanitized metadata.
- Documented operational readiness (ops/ folder) and runtime requirements.
- Enhanced storage adapters with optional dependency handling and preflight checks.

## References
- PR: _link pending_
- Commit: _fill with final commit hash when merged_

## Checklist
- [x] `/vaultfire/handshake` requires bearer token or API key
- [x] Rotation metadata moved to `/vaultfire/admin/rotation-status`
- [x] Responses signed via `X-Vaultfire-Signature`
- [x] Tests prevent unauthenticated handshake access
- [x] Operational docs and deployment scripts added
- [x] Optional dependencies documented and validated via preflight check
