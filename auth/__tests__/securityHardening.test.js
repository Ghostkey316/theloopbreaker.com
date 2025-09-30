const request = require('supertest');

const { app, tokenService } = require('../expressExample');
const { ROLES } = require('../roles');

describe('Vaultfire security hardening', () => {
  test('rejects invalid JWT token access', async () => {
    const response = await request(app)
      .post('/vaultfire/activate')
      .set('Authorization', 'Bearer invalid.token')
      .send({ walletId: '0x1234567890abcdef1234567890abcdef12345678', activationChannel: 'cli' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('auth.unauthorized');
  });

  test('rejects malformed wallet payloads', async () => {
    const wallet = '0x1234567890abcdef1234567890abcdef12345678';
    const token = tokenService.createAccessToken({ wallet, role: ROLES.PARTNER, partnerId: 'test-partner' });

    const response = await request(app)
      .post('/vaultfire/activate')
      .set('Authorization', `Bearer ${token}`)
      .send({ walletId: 'not-a-wallet', activationChannel: 'cli' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('activation.invalid_wallet');
  });
});
