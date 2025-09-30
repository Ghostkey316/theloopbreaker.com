import { createTrustedAuthMiddleware } from '../auth/authMiddleware';

describe('createTrustedAuthMiddleware', () => {
  const tokenService = {
    verifyAccessToken: jest.fn().mockReturnValue({ role: 'admin', wallet: '0x123' }),
  };
  const validator = {
    validate: jest.fn().mockResolvedValue({ origin: 'https://vaultfire.app' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('passes when token and trust validation succeed', async () => {
    const [limiter, middleware] = createTrustedAuthMiddleware({
      requiredRoles: ['admin'],
      tokenService,
      trust: validator,
    });

    const req: any = {
      headers: {
        authorization: 'Bearer token',
        origin: 'https://vaultfire.app',
        'x-vaultfire-session': JSON.stringify({ issuedAt: Date.now(), expiresAt: Date.now() + 1000 }),
        'x-vaultfire-signature': '0xabc',
      },
      body: { trustPayload: { resource: '/test' }, signature: '0xabc' },
      method: 'GET',
      originalUrl: '/test',
    };
    const res: any = { status: jest.fn().mockReturnValue({ json: jest.fn() }) };
    const next = jest.fn();

    await middleware(req, res, next);

    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('token');
    expect(validator.validate).toHaveBeenCalled();
    expect(req.user.role).toBe('admin');
    expect(req.trustContext.origin).toBe('https://vaultfire.app');
    expect(next).toHaveBeenCalled();
    expect(limiter).toBeDefined();
  });

  test('rejects unauthorized access when trust fails', async () => {
    const failingValidator = {
      validate: jest.fn().mockRejectedValue(new Error('no trust')),
    };
    const [, middleware] = createTrustedAuthMiddleware({
      requiredRoles: ['admin'],
      tokenService,
      trust: failingValidator,
    });

    const json = jest.fn();
    const res: any = { status: jest.fn().mockReturnValue({ json }) };
    const req: any = {
      headers: {
        authorization: 'Bearer token',
        origin: 'https://vaultfire.app',
        'x-vaultfire-session': JSON.stringify({ issuedAt: Date.now(), expiresAt: Date.now() + 1000 }),
      },
      body: {},
    };

    await middleware(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(Object) }));
  });

  test('falls back to legacy behaviour when trust config absent', async () => {
    const [limiter, middleware] = createTrustedAuthMiddleware({
      requiredRoles: ['admin'],
      tokenService,
    });

    const req: any = {
      headers: { authorization: 'Bearer token' },
      method: 'GET',
      originalUrl: '/no-trust',
    };
    const res: any = { status: jest.fn().mockReturnValue({ json: jest.fn() }) };
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(limiter).toBeDefined();
  });
});
