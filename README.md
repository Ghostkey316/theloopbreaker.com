# Vaultfire Init

Vaultfire Init is the reference implementation of the Ghostkey protocol. It provides a modular framework for community coordination with a focus on transparency and ethical design.

## Features
- **Purpose Engine** – generates quests and tracks alignment scores
- **Cure Locker** – stores community-sourced healing methods with vote logs
- **Trust Engine** – records engagement and reputation in a transparent ledger
- **Plugin Architecture** – drop-in modules for external services or custom tools
- **Signal Fusion Engine** – merges local and partner signal vectors for replay
- **Vault License Shell** – validates alignment state and overlay sync
- **Ghostkey Learning Rule #1** – ensures the AI companion gently corrects
  misinformation while logging each pushback event
- **Resilience Modules** – monitor grid and GPU load, defend against behavior
  drift, and mirror multi-domain risks

## Repository Layout
- `engine/` – core protocol logic such as signal processing and reward engines
- `partner_plugins/` – optional plug-ins loaded at runtime
- `dashboards/` – generated analytics and path summaries
- `frontend/` – simple HTML pages for visualizing data
- `tools/` – helper scripts for maintenance and data cleanup

## Quick Start
1. Install Python 3.10+ and Node.js
2. Run `python3 system_integrity_check.py` to validate configuration
3. Execute `python3 run_full_system_validation.py` for a full readiness report
4. Execute `python3 vaultfire_system_ready.py --partner-mode <wallet>` to create a partner fork
5. Test the CLI onboarding with `node vaultfire_partner_onboard.js demo <wallet> "Morals Before Metrics."`

## Plug-in System
Place additional modules in `partner_plugins` to extend Vaultfire without modifying the core. Example helpers demonstrate text summarization and audio transcription. These examples are for demonstration only and do not represent an official partnership with any third-party service.

## Security Tools
- `security_monitor.py` records baseline file hashes and can repair modifications
- `system_watchdog.py` logs resource usage and checks for tampering

## Data Removal
Use `python3 tools/purge_user_data.py <user_id> --wallet mywallet.eth` to remove local records for a participant.

## Disclaimers
- This repository is production-ready software provided for learning and discussion
- Nothing here constitutes financial or medical advice
- Ambient data gathering requires opt-in consent from participants
- System logs may store limited personal data for reflective analysis
- Mentions of third-party services are examples only and do not signify any official partnership
- Plugin support is provided as-is with no guarantee of compatibility or continued maintenance
- Partners must perform their own compliance review before deploying
- Vaultfire modules may change without notice and are provided as-is
