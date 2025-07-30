# Partner Deployment Guide

This guide outlines how partners can deploy Vaultfire modules.

## Installation
1. Clone the repository.
2. Install Python dependencies with `pip install -r requirements.txt`.
3. Install Node dependencies with `npm install`.
4. Run `git config core.hooksPath .githooks` to enable hooks.

## Integration Points
- Onboarding API at `onboarding_api.py`.
- Companion API from `final_modules/companion_api.py`.
- Fitness and Music layers under `docs/fitness_layer.md` and `docs/music_layer.md`.
- Plugin framework via `partner_plugins/`.

## Example Use Case
A sports brand installs Vaultfire and uses the Fitness Layer to
reward weekly workouts while the Companion API provides motivational
messages. Onboarding connects user wallets and the plugin framework
tracks campaign rewards.
