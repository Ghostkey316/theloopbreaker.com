const { TrustValidator, TrustValidationError } = require('../trustValidator');
const { ethers } = require('ethers');

describe('TrustValidator', () => {
  const now = Date.now();
  const wallet = ethers.Wallet.createRandom();

  test('validates origin, session, and signature payload', async () => {
    const validator = new TrustValidator({
      allowedOrigins: ['https://vaultfire.app'],
      sessionWindowMs: 120000,
      clock: () => now,
    });

    const payload = { action: 'sync', id: 'abc123' };
    const message = JSON.stringify(payload, Object.keys(payload).sort());
    const signature = await wallet.signMessage(message);
    const session = { issuedAt: now - 2000, expiresAt: now + 60000, id: 'session-1' };

    const result = await validator.validate({
      origin: 'https://vaultfire.app',
      address: wallet.address,
      session,
      signature,
      payload,
    });

    expect(result.address).toBe(wallet.address);
    expect(result.session.tokenId).toBe('session-1');
  });

  test('rejects invalid origins', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['https://vaultfire.app'], clock: () => now });
    await expect(
      validator.validate({
        origin: 'https://malicious.invalid',
        address: wallet.address,
        session: { issuedAt: now, expiresAt: now + 1000 },
        signature: '0x0',
        payload: {},
      }),
    ).rejects.toThrow(TrustValidationError);
  });

  test('rejects expired sessions', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const session = { issuedAt: now - 360000, expiresAt: now - 1000 };
    const payload = { action: 'sync', id: 'expired' };
    const message = JSON.stringify(payload, Object.keys(payload).sort());
    const signature = await wallet.signMessage(message);
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session,
        signature,
        payload,
      }),
    ).rejects.toThrow('Session has expired');
  });

  test('rejects signature mismatches', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const session = { issuedAt: now - 1000, expiresAt: now + 1000 };
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session,
        signature: '0x1234',
        payload: {},
      }),
    ).rejects.toThrow('Invalid signature payload');
  });

  test('parses base64 encoded session tokens', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const rawSession = { issuedAt: now - 500, expiresAt: now + 500 };
    const encoded = Buffer.from(JSON.stringify(rawSession)).toString('base64');
    const message = JSON.stringify({ action: 'sync' });
    const signature = await wallet.signMessage(message);

    const result = await validator.validate({
      origin: 'https://vaultfire.app',
      address: wallet.address,
      session: encoded,
      signature,
      payload: { action: 'sync' },
    });

    expect(result.session.issuedAt).toBe(rawSession.issuedAt);
  });

  test('rejects sessions issued in the future', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const session = { issuedAt: now + 60_000, expiresAt: now + 120_000 };
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session,
        signature: await wallet.signMessage(JSON.stringify({ action: 'future' })),
        payload: { action: 'future' },
      }),
    ).rejects.toThrow('Session issued in the future');
  });

  test('rejects missing signature details', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session: { issuedAt: now - 1000, expiresAt: now + 1000 },
        signature: null,
        payload: {},
      }),
    ).rejects.toThrow('Signature missing');
  });

  test('rejects oversized session windows', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const session = { issuedAt: now - 1000, expiresAt: now + 1_500_000 };
    const message = JSON.stringify({ action: 'oversized' });
    const signature = await wallet.signMessage(message);
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session,
        signature,
        payload: { action: 'oversized' },
      }),
    ).rejects.toThrow('Session window exceeds maximum allowed duration');
  });

  test('allows wildcard origin patterns', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['https://partner.vaultfire.app*'], clock: () => now });
    const payload = { action: 'pattern' };
    const message = JSON.stringify(payload);
    const signature = await wallet.signMessage(message);
    const result = await validator.validate({
      origin: 'https://partner.vaultfire.app',
      address: wallet.address,
      session: { issuedAt: now - 1000, expiresAt: now + 1000 },
      signature,
      payload,
    });
    expect(result.origin).toBe('https://partner.vaultfire.app');
  });

  test('allows any origin when no allow list provided', async () => {
    const validator = new TrustValidator({ clock: () => now });
    const payload = { action: 'sync' };
    const signature = await wallet.signMessage(JSON.stringify(payload));
    const result = await validator.validate({
      origin: 'https://unlisted.origin',
      address: wallet.address,
      session: { issuedAt: now - 1000, expiresAt: now + 1000 },
      signature,
      payload,
    });
    expect(result.origin).toBe('https://unlisted.origin');
  });

  test('rejects when origin is empty even with allow list', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const payload = { action: 'sync' };
    const signature = await wallet.signMessage(JSON.stringify(payload));
    await expect(
      validator.validate({
        origin: '',
        address: wallet.address,
        session: { issuedAt: now - 1000, expiresAt: now + 1000 },
        signature,
        payload,
      }),
    ).rejects.toThrow('Origin not allowed for trust relay');
  });

  test('rejects when session token missing', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const payload = { action: 'sync' };
    const signature = await wallet.signMessage(JSON.stringify(payload));
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session: null,
        signature,
        payload,
      }),
    ).rejects.toThrow('Session token required');
  });

  test('rejects unsupported session token formats', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const payload = { action: 'sync' };
    const signature = await wallet.signMessage(JSON.stringify(payload));
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session: 'not-json-or-base64',
        signature,
        payload,
      }),
    ).rejects.toThrow('Session token format unsupported');
  });

  test('rejects session tokens missing issuedAt', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const payload = { action: 'sync' };
    const signature = await wallet.signMessage(JSON.stringify(payload));
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session: { expiresAt: now + 1000 },
        signature,
        payload,
      }),
    ).rejects.toThrow('Session issuedAt missing');
  });

  test('rejects session tokens missing expiresAt', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const payload = { action: 'sync' };
    const signature = await wallet.signMessage(JSON.stringify(payload));
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session: { issuedAt: now - 1000, expiresAt: 'invalid' },
        signature,
        payload,
      }),
    ).rejects.toThrow('Session expiresAt missing');
  });

  test('rejects session windows where expiry precedes issue', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const payload = { action: 'sync' };
    const signature = await wallet.signMessage(JSON.stringify(payload));
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session: { issuedAt: now, expiresAt: now - 1 },
        signature,
        payload,
      }),
    ).rejects.toThrow('Session expiresAt must be after issuedAt');
  });

  test('rejects when signature address mismatch', async () => {
    const otherWallet = ethers.Wallet.createRandom();
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const payload = { action: 'sync' };
    const signature = await otherWallet.signMessage(JSON.stringify(payload));
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session: { issuedAt: now - 1000, expiresAt: now + 1000 },
        signature,
        payload,
      }),
    ).rejects.toThrow('Signature does not match address');
  });

  test('rejects when address missing during signature validation', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const payload = { action: 'sync' };
    const signature = await wallet.signMessage(JSON.stringify(payload));
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: null,
        session: { issuedAt: now - 1000, expiresAt: now + 1000 },
        signature,
        payload,
      }),
    ).rejects.toThrow('Address required for trust validation');
  });

  test('rejects when session expiry has elapsed despite short window', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now, clockDriftMs: 0 });
    const payload = { action: 'sync' };
    const signature = await wallet.signMessage(JSON.stringify(payload));
    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session: { issuedAt: now - 1000, expiresAt: now - 10 },
        signature,
        payload,
      }),
    ).rejects.toThrow('Session expired');
  });

  test('rejects when hashing utilities unavailable', async () => {
    const validator = new TrustValidator({ allowedOrigins: ['*'], clock: () => now });
    const payload = { action: 'sync' };
    const signature = await wallet.signMessage(JSON.stringify(payload));
    const hashDescriptor = Object.getOwnPropertyDescriptor(ethers, 'hashMessage');
    const recoverDescriptor = Object.getOwnPropertyDescriptor(ethers, 'recoverAddress');
    const utilsDescriptor = Object.getOwnPropertyDescriptor(ethers, 'utils');
    try {
      if (hashDescriptor?.configurable) {
        Object.defineProperty(ethers, 'hashMessage', { value: undefined, configurable: true, writable: true });
      } else {
        ethers.hashMessage = undefined;
      }
      if (recoverDescriptor?.configurable) {
        Object.defineProperty(ethers, 'recoverAddress', { value: undefined, configurable: true, writable: true });
      } else {
        ethers.recoverAddress = undefined;
      }
      if (utilsDescriptor?.configurable) {
        Object.defineProperty(ethers, 'utils', { value: {}, configurable: true, writable: true });
      } else if (ethers.utils) {
        ethers.utils.hashMessage = undefined;
        ethers.utils.recoverAddress = undefined;
      }

      await expect(
        validator.validate({
          origin: 'https://vaultfire.app',
          address: wallet.address,
          session: { issuedAt: now - 1000, expiresAt: now + 1000 },
          signature,
          payload,
        }),
      ).rejects.toThrow('Invalid signature payload');
    } finally {
      if (hashDescriptor) {
        Object.defineProperty(ethers, 'hashMessage', hashDescriptor);
      }
      if (recoverDescriptor) {
        Object.defineProperty(ethers, 'recoverAddress', recoverDescriptor);
      }
      if (utilsDescriptor) {
        Object.defineProperty(ethers, 'utils', utilsDescriptor);
      }
    }
  });

  test('rejects when ethers dependency unavailable', async () => {
    jest.resetModules();
    jest.doMock('ethers', () => {
      throw new Error('missing');
    });

    let LocalTrustValidator;
    jest.isolateModules(() => {
      ({ TrustValidator: LocalTrustValidator } = require('../trustValidator'));
    });

    const validator = new LocalTrustValidator({ allowedOrigins: ['*'], clock: () => now });

    await expect(
      validator.validate({
        origin: 'https://vaultfire.app',
        address: wallet.address,
        session: { issuedAt: now - 1000, expiresAt: now + 1000 },
        signature: '0xdeadbeef',
        payload: {},
      }),
    ).rejects.toThrow('Signature verification unavailable');

    jest.resetModules();
  });
});
