const { ethers } = require('ethers');

const mockQuery = jest.fn();
const mockPoolInstance = { query: mockQuery };
const mockPool = jest.fn(() => mockPoolInstance);

const mockSupabaseOrder = jest.fn();
const mockSupabaseUpsert = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseFrom = jest.fn(() => ({
  select: (...args) => {
    mockSupabaseSelect(...args);
    return { order: mockSupabaseOrder };
  },
  upsert: mockSupabaseUpsert,
}));

jest.mock(
  'pg',
  () => ({
    __esModule: true,
    Pool: mockPool,
  }),
  { virtual: true }
);

jest.mock(
  '@supabase/supabase-js',
  () => ({
    __esModule: true,
    createClient: jest.fn(() => ({
      from: mockSupabaseFrom,
    })),
  }),
  { virtual: true }
);

const {
  PostgresPartnerStorage,
  SupabasePartnerStorage,
} = require('../services/partnerStorage');

describe('Managed partner storage adapters', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockPool.mockClear();
    mockSupabaseOrder.mockReset();
    mockSupabaseSelect.mockReset();
    mockSupabaseUpsert.mockReset();
    mockSupabaseFrom.mockClear();
  });

  test('Postgres adapter persists and lists partners via pooled client', async () => {
    const telemetry = { record: jest.fn() };
    const storage = new PostgresPartnerStorage({
      connectionString: 'postgres://user:pass@host:5432/vaultfire',
      telemetry,
    });

    let persistedParams = null;
    mockQuery.mockImplementation(async (sql, params = []) => {
      const normalized = String(sql).trim().toLowerCase();
      if (normalized.startsWith('create table')) {
        return { rows: [] };
      }
      if (normalized.startsWith('insert into')) {
        persistedParams = params;
        return { rows: [] };
      }
      if (normalized.startsWith('select')) {
        const [wallet, ens, lastSync, multiplier, tier, status, payload, overrides] = persistedParams;
        return {
          rows: [
            {
              wallet,
              ens,
              lastSync,
              multiplier,
              tier,
              status,
              payload: JSON.parse(payload),
              configOverrides: overrides,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const record = {
      wallet: '0x8ba1f109551bd432803012645ac136ddd64dba72',
      ens: 'ally.vaultfire.eth',
      lastSync: new Date().toISOString(),
      multiplier: 2.5,
      tier: 'Allied',
      status: 'healthy',
      payload: { loyalty: 90 },
      configOverrides: true,
    };

    await storage.savePartner(record);
    const partners = await storage.listPartners();

    expect(mockPool).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), expect.any(Array));
    expect(partners).toHaveLength(1);
    expect(partners[0]).toMatchObject({
      wallet: ethers.getAddress(record.wallet),
      ens: record.ens,
      multiplier: record.multiplier,
      tier: record.tier,
      payload: record.payload,
      configOverrides: true,
    });
    const telemetryCall = telemetry.record.mock.calls.find(([event]) => event === 'storage.partner.saved');
    expect(telemetryCall).toBeTruthy();
    expect(telemetryCall[1]).toMatchObject({ provider: 'postgres', wallet: ethers.getAddress(record.wallet) });
  });

  test('Supabase adapter upserts and lists partners with telemetry metadata', async () => {
    const telemetry = { record: jest.fn() };
    const savedRows = [];
    mockSupabaseUpsert.mockImplementation(async (payload) => {
      savedRows.push(payload);
      return { error: null };
    });
    mockSupabaseOrder.mockImplementation(async () => ({ data: savedRows, error: null }));

    const storage = new SupabasePartnerStorage({
      url: 'https://example.supabase.co',
      serviceKey: 'service-key',
      telemetry,
    });

    const record = {
      wallet: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      ens: 'observer.audit.eth',
      lastSync: '2024-05-01T12:00:00.000Z',
      multiplier: 1.75,
      tier: 'Observer',
      status: 'healthy',
      payload: { ethics: 88 },
      configOverrides: false,
    };

    await storage.savePartner(record);
    const partners = await storage.listPartners();

    expect(mockSupabaseFrom).toHaveBeenCalledWith('vaultfire_partner_sync');
    expect(mockSupabaseSelect).toHaveBeenCalledWith(
      'wallet, ens, last_sync, multiplier, tier, status, payload, config_overrides'
    );
    expect(mockSupabaseUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ wallet: ethers.getAddress(record.wallet), tier: record.tier }),
      expect.objectContaining({ onConflict: 'wallet' })
    );
    expect(partners).toHaveLength(1);
    expect(partners[0]).toMatchObject({
      wallet: ethers.getAddress(record.wallet),
      ens: record.ens,
      multiplier: record.multiplier,
      payload: record.payload,
      configOverrides: false,
    });
    const telemetryCall = telemetry.record.mock.calls.find(([event]) => event === 'storage.partner.saved');
    expect(telemetryCall).toBeTruthy();
    expect(telemetryCall[1]).toMatchObject({ provider: 'supabase', wallet: ethers.getAddress(record.wallet) });
  });

  test('Supabase adapter surfaces upstream errors', async () => {
    mockSupabaseUpsert.mockResolvedValueOnce({ error: { message: 'permission denied' } });
    const storage = new SupabasePartnerStorage({
      url: 'https://example.supabase.co',
      serviceKey: 'service-key',
    });

    await expect(
      storage.savePartner({
        wallet: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        tier: 'Observer',
        multiplier: 1,
        status: 'healthy',
        payload: {},
      })
    ).rejects.toThrow('Supabase savePartner failed: permission denied');
  });
});
