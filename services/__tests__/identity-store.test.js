jest.mock('../logging', () => ({
  logger: {
    error: jest.fn(),
  },
}));

const { MongoWalletStore } = require('../identity-resolver/store');
const { logger } = require('../logging');

const createStubClient = () => {
  const collection = {
    createIndex: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue({}),
  };

  const db = jest.fn(() => ({ collection: jest.fn(() => collection) }));

  const client = {
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    db,
  };

  return { client, collection };
};

describe('MongoWalletStore', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('connects only once when init is called multiple times', async () => {
    const { client, collection } = createStubClient();
    const store = new MongoWalletStore({ client });

    await Promise.all([store.init(), store.init(), store.init()]);

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(collection.createIndex).toHaveBeenCalledTimes(2);
  });

  it('normalises wallet id before querying', async () => {
    const { client, collection } = createStubClient();
    collection.findOne.mockResolvedValue({ wallet: 'alice' });

    const store = new MongoWalletStore({ client });
    await store.init();
    const wallet = await store.getWallet('  Alice ');

    expect(wallet).toEqual({ wallet: 'alice' });
    expect(collection.findOne).toHaveBeenCalledWith({ wallet: 'alice' });
  });

  it('throws when getWallet is called with invalid id without logging', async () => {
    const { client } = createStubClient();
    const store = new MongoWalletStore({ client });
    await store.init();

    await expect(store.getWallet('   ')).rejects.toThrow('walletId must be a non-empty string');

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs and rethrows when collection lookup fails', async () => {
    const { client, collection } = createStubClient();
    const store = new MongoWalletStore({ client });
    await store.init();
    const failure = new Error('database down');
    collection.findOne.mockRejectedValue(failure);

    await expect(store.getWallet('vault')).rejects.toThrow(failure);

    expect(logger.error).toHaveBeenCalledWith('identity.store.mongo_failure', {
      walletId: 'vault',
      error: 'database down',
    });
  });

  it('normalises wallet payload on upsert', async () => {
    const { client, collection } = createStubClient();
    const store = new MongoWalletStore({ client });
    collection.findOne.mockResolvedValue({ wallet: 'bob', label: 'ally' });

    await store.init();
    const result = await store.upsertWallet({ wallet: 'Bob', label: 'ally' });

    expect(collection.updateOne).toHaveBeenCalledWith(
      { wallet: 'bob' },
      { $set: { wallet: 'bob', label: 'ally' } },
      { upsert: true },
    );
    expect(result).toEqual({ wallet: 'bob', label: 'ally' });
  });

  it('resets state after close', async () => {
    const { client } = createStubClient();
    const store = new MongoWalletStore({ client });

    await store.init();
    await store.close();

    expect(store.initialised).toBe(false);
    await store.init();
    expect(client.connect).toHaveBeenCalledTimes(2);
  });
});
