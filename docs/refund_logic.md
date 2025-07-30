# Refund Logic

The refund engine monitors partner hooks and service metrics to determine when a user
is eligible for a refund. All activity is logged for later auditing.

## Flow

1. **Trigger** – A partner or service reports a fault (e.g. `error_code >= 500`).
2. **Evaluation** – `should_refund()` checks latency and failure rates.
3. **State Check** – If refunds are frozen, only an authorized operator may
   bypass the freeze using an override key.
4. **Record** – A transaction log entry is created and written to `simulated_tx.json`.
5. **Audit** – Details are appended to `refund_audit.json`.
6. **Badge** – The recipient wallet receives a refund badge stored in
   `frontend/refund_badges.json`.

The logs are simple JSON files for demonstration. Production deployments should
use a proper database and secure logging pipeline.
