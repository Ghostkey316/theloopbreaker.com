<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Repository Overview

This repository groups Vaultfire core modules and partner integrations into distinct folders:

- **core/** – Python engine modules
- **frontend/** – Web assets and bundled scripts
- **tests/** and **__tests__/** – Python and Node test suites
- **docs/** – Architecture, RBAC, and refund logic docs
- **scripts/** – Automation and setup scripts

Logs and demo data under `logs/` and JSON files are kept small for sample purposes. Production deployments should redirect logs to a secure database.
