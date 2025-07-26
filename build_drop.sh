#!/bin/sh
set -e
zip -r vaultfire_activation.zip secure_upload docs/activation_drop vaultfire_drop.json signal_log.py
