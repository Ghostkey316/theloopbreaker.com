/**
 * Reference integration (Next.js Route Handler)
 *
 * Copy into: app/api/vaultfire/verify/route.ts
 *
 * Notes:
 * - Do not log statements.
 * - Use VAULTFIRE_PRIVACY_SALT to mitigate guessing attacks.
 */

import { NextResponse } from 'next/server';
import { Wallet } from 'ethers';
import { VaultfireSafeSDK, ModuleType } from '@vaultfire/sdk';

const vaultfire = new VaultfireSafeSDK({
  chain: 'base-sepolia',
  privacySalt: process.env.VAULTFIRE_PRIVACY_SALT,
});

vaultfire.connect(new Wallet(process.env.PRIVATE_KEY!));

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { statement?: unknown };
  const statement = String(body.statement ?? '');

  if (!statement || statement.length > 500) {
    return NextResponse.json({ error: 'invalid_statement' }, { status: 400 });
  }

  const result = await vaultfire.verifyStatement({
    statement,
    moduleId: ModuleType.GENERIC,
  });

  return NextResponse.json({
    verified: result.verified,
    txHash: result.txHash,
    beliefHash: vaultfire.hashStatement(statement),
  });
}
