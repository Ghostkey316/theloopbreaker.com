<!--
NON-NORMATIVE DOCUMENT

This file is historical/legacy/audit material and may contain aspirational language.
The canonical, current claims & limits are in: docs/CLAIMS_AND_LIMITS.md
-->

# Vaultfire Partner Port SDK

The Partner Port SDK allows external games to tap into Vaultfire features like XP rewards, loyalty tokens and quest progression.

## Usage
1. Generate an API key for your partner ID:
   ```python
   from partner_port import generate_api_key
   key = generate_api_key("mygame")
   ```
2. Initialize the port with the key:
   ```python
   from partner_port import PartnerPort
   port = PartnerPort("mygame", key)
   ```
3. Record XP, award loyalty and update quest progress:
   ```python
   port.record_xp("player1", 10)
   port.award_loyalty("player1", 1.0)
   port.quest_progress("player1", "dragon-hunt", 0.5)
   ```
4. Sync data on-chain when ready:
   ```python
   port.sync_onchain()
   ```
5. Merge guest progress into a permanent profile:
   ```python
   PartnerPort.merge_profiles("guest-abc", "player1")
   ```
