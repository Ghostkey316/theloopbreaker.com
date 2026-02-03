<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Ethics Middleware Guardrails

The `middleware/ethicsGuard.js` middleware enforces intent-driven guardrails for
Vaultfire APIs. Partners include the header `X-Vaultfire-Reason` to indicate the
intent of a request and optional `X-Vaultfire-Purpose` text for audit trails.

## Decision logging

Each request writes a structured log entry to `logs/ethics-guard.log` (override
with the `logPath` option). Entries now include:

- `decision` – `allowed`, `warned`, or `blocked`
- `decisionReason` – quick diagnostic for policy hits
- `purpose` – partner supplied justification, mirrored to ethics telemetry

Blocked intents return HTTP `451` with error code `ethics.blocked_intent`. Warned
intents continue but include `X-Vaultfire-Ethics-Warning` and are rate limited by
partner identity.

## Example usage

```js
const createEthicsGuard = require('../middleware/ethicsGuard');
const guard = createEthicsGuard({
  policyPath: './middleware/guardrail-policy.json',
  logPath: './logs/ethics-guard.log',
});
```

The Jest test `tests/ethicsGuard.test.js` demonstrates the blocked/warned flows
and verifies purpose-based decision logging.
