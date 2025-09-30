const originalConsole = { ...console };

describe('rewards/stream CLI', () => {
  let ethersMock;

  beforeEach(() => {
    jest.resetModules();
    console.log = jest.fn();
    console.table = jest.fn();
    console.error = jest.fn();

    ethersMock = createEthersMock();
    jest.doMock('ethers', () => ({ ethers: ethersMock.namespace }));
  });

  afterAll(() => {
    console.log = originalConsole.log;
    console.table = originalConsole.table;
    console.error = originalConsole.error;
  });

  test('simulates without executing transaction', async () => {
    const { main } = require('../rewards/stream');
    const summary = await main([
      'node',
      'stream.js',
      '--recipient',
      '0xRecipient',
      '--amount',
      '10',
      '--duration',
      '100',
      '--stream',
      '0xStream',
      '--token',
      '0xToken',
      '--simulate-only',
    ]);

    expect(summary.amount).toBeDefined();
    expect(ethersMock.namespace.parseUnits).toHaveBeenCalledWith('10', 18);
    expect(ethersMock.lastStreamContract).toBeDefined();
    expect(ethersMock.lastStreamContract.streamReward).not.toHaveBeenCalled();
  });

  test('executes on-chain stream when not a dry run', async () => {
    const { main } = require('../rewards/stream');
    ethersMock.lastTokenContract.allowance.mockResolvedValueOnce(0n);

    ethersMock.lastTokenContract.allowance.mockResolvedValueOnce(10n ** 20n);

    await main([
      'node',
      'stream.js',
      '--recipient',
      '0xRecipient',
      '--amount',
      '5',
      '--duration',
      '50',
      '--stream',
      '0xStream',
      '--token',
      '0xToken',
      '--private-key',
      '0xabcdef',
    ]);

    expect(ethersMock.lastTokenContract.allowance).toHaveBeenCalled();
    expect(ethersMock.lastTokenContract.approve).toHaveBeenCalled();
    expect(ethersMock.lastStreamContract.streamReward).toHaveBeenCalled();
    expect(ethersMock.lastStreamContract.claimable).toHaveBeenCalled();
  });

  test('throws when required parameters missing and honours gas override', async () => {
    const { main } = require('../rewards/stream');
    await expect(
      main(['node', 'stream.js', '--simulate-only']),
    ).rejects.toThrow('Recipient address is required');

    ethersMock.lastTokenContract.allowance.mockResolvedValueOnce(10n ** 20n);

    await main([
      'node',
      'stream.js',
      '--recipient',
      '0xRecipient',
      '--amount',
      '5',
      '--duration',
      '25',
      '--stream',
      '0xStream',
      '--token',
      '0xToken',
      '--private-key',
      '0xabcdef',
      '--gas-price',
      '5',
    ]);

    expect(ethersMock.namespace.parseUnits).toHaveBeenCalledWith('5', 'gwei');
    expect(ethersMock.lastTokenContract.approve).not.toHaveBeenCalled();
  });
});

function createEthersMock() {
  const parseUnits = jest.fn((value, unit) => {
    if (typeof unit === 'string') {
      if (unit === 'gwei') {
        return BigInt(Math.floor(Number(value) * 1e9));
      }
      throw new Error(`unsupported unit ${unit}`);
    }
    const decimals = Number(unit ?? 18);
    return BigInt(Math.floor(Number(value) * 10 ** decimals));
  });
  const formatUnits = jest.fn((value, decimals) => (Number(value) / 10 ** decimals).toString());

  class MockProvider {
    constructor(url) {
      this.url = url;
    }
  }

  class MockWallet {
    constructor(privateKey, provider) {
      this.privateKey = privateKey;
      this.provider = provider;
      this.address = '0xautomation';
    }
    async getAddress() {
      return this.address;
    }
  }

  const tokenContract = {
    decimals: jest.fn().mockResolvedValue(18),
    allowance: jest.fn().mockResolvedValue(0n),
    approve: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue({}) }),
  };

  const streamContract = {
    streamReward: jest.fn().mockResolvedValue({
      hash: '0xhash',
      wait: jest.fn().mockResolvedValue({ blockNumber: 123, transactionHash: '0xhash' }),
    }),
    claimable: jest.fn().mockResolvedValue(0n),
  };

  class MockContract {
    constructor(address, abi, signerOrProvider) {
      this.address = address;
      this.abi = abi;
      this.signerOrProvider = signerOrProvider;
      if (abi.some((entry) => entry.includes('streamReward'))) {
        ethersMock.lastStreamContract = streamContract;
        return streamContract;
      }
      ethersMock.lastTokenContract = tokenContract;
      return tokenContract;
    }
  }

  const ethersMock = {
    namespace: {
      parseUnits,
      formatUnits,
      JsonRpcProvider: MockProvider,
      Wallet: MockWallet,
      Contract: MockContract,
    },
    lastTokenContract: tokenContract,
    lastStreamContract: streamContract,
  };

  return ethersMock;
}
