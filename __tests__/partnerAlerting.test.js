const fs = require('fs');
const path = require('path');

const alertsPath = path.join(__dirname, '..', 'status', 'alerts.jsonl');
const webhooksPath = path.join(__dirname, '..', 'status', 'webhooks.json');

function resetAlertCenter() {
  fs.rmSync(alertsPath, { force: true });
  fs.rmSync(webhooksPath, { force: true });
  jest.resetModules();
}

describe('partner alerting', () => {
  beforeEach(() => {
    resetAlertCenter();
  });

  it('records alerts and forwards them to registered webhooks', async () => {
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true }));
    jest.doMock('node-fetch', () => fetchMock);

    const { notifyPartner, registerPartnerWebhook, getRecentAlerts } = require('../utils/notifyPartner');
    const alertCenter = require('../services/partner-alerts/alertCenter');
    alertCenter.alerts.length = 0;
    alertCenter.webhooks.clear();

    registerPartnerWebhook({ partnerId: 'jest', url: 'https://alerts.demo/hook', headers: { Authorization: 'token' } });
    const alert = await notifyPartner({ module: 'token', message: 'Issuance failed', details: { amount: 10 } });
    expect(alert.type).toBe('error');

    const events = getRecentAlerts();
    expect(events.some((event) => event.message === 'Issuance failed')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://alerts.demo/hook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'content-type': 'application/json', Authorization: 'token' }),
      })
    );
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload).toMatchObject({ module: 'token', message: 'Issuance failed' });
  });
});
