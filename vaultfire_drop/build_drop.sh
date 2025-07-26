#!/bin/sh
set -e
zip -r vaultfire_partner_drop.zip secure_upload tests docs signal_log.py vaultfire_drop.json requirements.txt package.json
