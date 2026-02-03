/**
 * Reference integration (Express)
 *
 * Goals:
 * - never log raw statements
 * - hash user-provided statement locally
 * - store only beliefHash + txHash
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { Wallet } from 'ethers';
import { VaultfireSafeSDK, ModuleType } from '../vaultfire';

const app = express();
app.use(express.json({ limit: '16kb' }));

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const vaultfire = new VaultfireSafeSDK({
  chain: 'base-sepolia',
  privacySalt: process.env.VAULTFIRE_PRIVACY_SALT,
});

vaultfire.connect(new Wallet(process.env.PRIVATE_KEY!));

app.post('/verify', async (req, res) => {
  // Prefer: client sends only beliefHash.
  // This example accepts a statement for convenience, but DO NOT log it.
  const statement = String(req.body?.statement ?? '');

  if (!statement || statement.length > 500) {
    return res.status(400).json({ error: 'invalid_statement' });
  }

  try {
    const result = await vaultfire.verifyStatement({
      statement,
      moduleId: ModuleType.GENERIC,
    });

    // Store only hashes/txs (example):
    // await db.insert({ beliefHash: vaultfire.hashStatement(statement), txHash: result.txHash })

    return res.json({
      verified: result.verified,
      txHash: result.txHash,
      beliefHash: vaultfire.hashStatement(statement),
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'unknown_error' });
  }
});

app.listen(3000, () => {
  // eslint-disable-next-line no-console
  console.log('Listening on http://localhost:3000');
});
