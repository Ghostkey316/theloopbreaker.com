# Vaultfire Hardening Fixes

## Summary
- Introduced authenticated handshake discovery with HMAC-signed responses.
- Added admin-only rotation status endpoint with sanitized metadata.
- Documented operational readiness (ops/ folder) and runtime requirements.
- Enhanced storage adapters with optional dependency handling and preflight checks.
- Elevated the repository-wide `cookie` override to `1.0.2`, clearing GHSA-pxg6-pf52-xh8x without relying on sandbox fallbacks.

## Reference Trail

| PR | Title | Commit | Merged (UTC) | Reviewers |
| --- | --- | --- | --- | --- |
| [#391](https://github.com/Ghostkey316/vaultfire/pull/391) | add `/handshake` endpoint and HMAC support | `951cabaf40300a52a3ed6cb82ea4d052e42ed965` | 2025-09-30T04:11:28Z | @ghostkey-security, @vaultfire-ops |
| [#407](https://github.com/Ghostkey316/vaultfire/pull/407) | chore(security): upgrade cookie override to 1.0.2 | `6871a5f5db1c73a0b42ddfdc25f2779bd501664e` | 2025-10-01T01:55:52Z | @vaultfire-sec-review |

## Checklist
- [x] `/vaultfire/handshake` requires bearer token or API key
- [x] Rotation metadata moved to `/vaultfire/admin/rotation-status`
- [x] Responses signed via `X-Vaultfire-Signature`
- [x] Tests prevent unauthenticated handshake access
- [x] Operational docs and deployment scripts added
- [x] Optional dependencies documented and validated via preflight check
