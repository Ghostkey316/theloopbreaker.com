# Vaultfire Architecture

This document provides a high-level overview of the main modules and call flow of the Vaultfire protocol.

```
Client -> CLI/Web -> API Layer -> Core Engine -> Modules
                                    |-> Refund Engine
                                    |-> Access Control
                                    |-> SecureStore
                                    `-> Partner Hooks
```

1. **API Layer** – Entry point for all external requests.
2. **Core Engine** – Coordinates modules and maintains protocol state.
3. **Refund Engine** – Handles automated refunds and logs.
4. **Access Control** – Verifies permissions for sensitive actions.
5. **SecureStore** – Encrypts media, signs metadata, and now exposes a high-throughput validation helper with automatic retry buffering for transient storage faults.
6. **Partner Hooks** – Optional integrations for external partners.

Logs and state files are stored in the repo for demonstration but should
be redirected to a database in production.
