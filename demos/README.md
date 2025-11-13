# Vaultfire Streamlit Demo

This directory contains the `vaultfire_demo.py` Streamlit app used to showcase Empathic Resonance Verifier (ERV) pilots, loyalty uplift projections, and live oracle emissions.

## Local development

```bash
pip install -r requirements.txt
streamlit run demos/vaultfire_demo.py
```

## Deploying to Streamlit Community Cloud

1. Push your fork to GitHub and open the repository in Streamlit Cloud.
2. Select **`demos/vaultfire_demo.py`** as the entry point.
3. Set the following optional secrets for live emissions (use sandbox/test credentials only):
   - `LIVE_MODE=1`
   - `PINATA_API_KEY`, `PINATA_SECRET`
   - `BASE_RPC_URL`, `PRIVATE_KEY`, `BASE_ORACLE_ADDRESS`
   > **Security warning:** Never supply production keys through Streamlit secrets. Use disposable test keys or route secrets through a managed vault (AWS KMS, GCP Secret Manager, HashiCorp Vault) for rehearsals.
4. Click **Deploy**. Streamlit will automatically install dependencies from `requirements.txt`.

## Deploying to Vercel

1. Install the [Vercel CLI](https://vercel.com/docs/cli) and authenticate (`vercel login`).
2. From the repository root run:

   ```bash
   vercel deploy --prebuilt
   ```

   The included `vercel.json` routes traffic to `streamlit run demos/vaultfire_demo.py --server.port $PORT`.
3. Configure environment variables in the Vercel dashboard if you need live mode credentials or a custom API endpoint (`VAULTFIRE_API`).
4. Promote the deployment with `vercel --prod` when ready.

## Health metrics

The sidebar automatically displays `/health/live_oracles` diagnostics when the Vaultfire API is reachable, falling back to local oracle health when offline.
