# Vaultfire Partner SDK

The `vaultfire_sdk` package bundles the onboarding API, partner hooks and
activation utilities so external projects can integrate quickly.

## Activation
1. Ensure `vaultfire-core/vaultfire_config.json` has `"ethics_anchor": true`.
2. Install dependencies with `pip install -r requirements.txt`.
3. Launch the API server:
   ```bash
   python3 -m vaultfire_sdk
   ```

For offline automation, run `activation_hook.py` with a JSON file or `-` for
stdin. The script outputs a pass/fail status object.

## API Routes
- `POST /onboard/partner`
- `POST /onboard/contributor`
- `POST /onboard/earner`
- `POST /mission`
- `POST /engagement`
- `POST /activate/simulate`
- `GET /credit/<identifier>`
- `GET /vaultfire_credits/<user_id>`
- `GET /status`

## Frontend Login Example
`frontend/pages/login_example.html` demonstrates wallet resolution for
ENS names or Coinbase IDs using `login_example.js`. Partners can adapt this
snippet to add wallet login support.
