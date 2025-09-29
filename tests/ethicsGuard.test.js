const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const createEthicsGuard = require('../middleware/ethicsGuard');

function createPolicyFile(policy) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-ethics-'));
  const filePath = path.join(dir, 'policy.json');
  fs.writeFileSync(filePath, JSON.stringify(policy));
  return filePath;
}

describe('Ethics guard middleware', () => {
  it('blocks intents flagged as exploit loops', async () => {
    const policyPath = createPolicyFile({ blockedReasons: ['exploit_loop'] });
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { role: 'partner', sub: 'user-1' };
      next();
    });
    app.use(createEthicsGuard({ policyPath }));
    app.get('/test', (req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test').set('X-Vaultfire-Reason', 'exploit_loop');
    expect(res.statusCode).toBe(451);
    expect(res.body.error.code).toBe('ethics.blocked_intent');
  });

  it('warns about automation but allows limited requests', async () => {
    const policyPath = createPolicyFile({ warnReasons: ['excessive_automation'], automation: { windowMs: 60000, maxRequests: 2 } });
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { role: 'partner', sub: 'user-1' };
      next();
    });
    app.use(createEthicsGuard({ policyPath }));
    app.get('/test', (req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test').set('X-Vaultfire-Reason', 'excessive_automation');
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-vaultfire-ethics-warning']).toBe('excessive_automation');
  });

  it('rate limits repeated automation attempts', async () => {
    const policyPath = createPolicyFile({ warnReasons: ['excessive_automation'], automation: { windowMs: 60000, maxRequests: 1 } });
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { role: 'partner', sub: 'user-1' };
      next();
    });
    app.use(createEthicsGuard({ policyPath }));
    app.get('/test', (req, res) => res.json({ ok: true }));

    await request(app).get('/test').set('X-Vaultfire-Reason', 'excessive_automation');
    const res = await request(app).get('/test').set('X-Vaultfire-Reason', 'excessive_automation');
    expect(res.statusCode).toBe(429);
  });
});
