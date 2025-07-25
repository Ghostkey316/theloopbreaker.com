# Retail Revival Mode

`vaultfire_module_retail_revival_v1` introduces an optional layer for hybrid and physical retail experiences. It is disabled by default and can be toggled per partner using `final_modules.retail_revival_mode.set_retail_revival_enabled`.

## Features
- Offline-friendly prompts returned by `offline_prompt` for analog displays.
- AI-guided storytelling via `retail_story_snippet(theme, context)`.
- Loyalty syncing and memory updates when `record_visit` logs a physical check-in.
- Configurable nostalgia overlays such as `nostalgia_overlay('mall_90s')`.
- Safe by design – if the mode is disabled, calls fallback without altering core data.

Logs are stored in `final_modules/retail_revival_visits.json` and `final_modules/retail_revival_config.json`.

## Disclaimers
- Hardware integrations are not included.
- Loyalty calculations are simulated with local logs.
- This module does not provide financial or legal advice.

