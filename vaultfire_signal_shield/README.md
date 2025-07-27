# Vaultfire Signal Shield v1.0

"We don't fight fire with fire — we forge shields from belief."

This CLI monitors public platforms for mentions of Vaultfire, NS3, or Ghostkey316. It tags sentiment, calculates a hostility index, and suggests de-escalating responses.

- **Signal Loop Module** – pulls posts from X/Twitter and Reddit using API keys
- **Sentiment Core Engine** – tags posts as Supportive, Neutral, Caution, Hostile, or Escalating
- **Heat Gauge Dashboard** – prints the current hostility index and sample posts
- **Response Layer** – suggests a response when hostility exceeds a threshold
- **Loyalty Sync Plugin** – records defenders in `loyalty_ledger.csv`

Run with `node index.js`. API tokens are provided via environment variables.

