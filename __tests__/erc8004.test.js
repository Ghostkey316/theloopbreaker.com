'use strict';

const { ethers } = require('ethers');

const {
  parseAgentRegistry,
  fetchAgentRegistrationFromUri,
  discoverErc8004Agent,
  resolveIpfsUri,
  validateRemoteUrl,
  isPrivateHost,
} = require('../services/erc8004');

describe('ERC-8004 integration', () => {
  test('parseAgentRegistry parses eip155 registry string', () => {
    const parsed = parseAgentRegistry('eip155:8453:0x0000000000000000000000000000000000000001');
    expect(parsed).toEqual({
      namespace: 'eip155',
      chainId: 8453,
      identityRegistry: '0x0000000000000000000000000000000000000001',
    });
  });

  test('resolveIpfsUri maps to gateway', () => {
    expect(resolveIpfsUri('ipfs://bafybeigdyr', 'https://example.com')).toBe('https://example.com/ipfs/bafybeigdyr');
  });

  test('isPrivateHost catches localhost and private ranges', () => {
    expect(isPrivateHost('localhost')).toBe(true);
    expect(isPrivateHost('127.0.0.1')).toBe(true);
    expect(isPrivateHost('10.0.0.5')).toBe(true);
    expect(isPrivateHost('192.168.1.10')).toBe(true);
    expect(isPrivateHost('172.16.0.1')).toBe(true);
    expect(isPrivateHost('172.31.9.9')).toBe(true);
    expect(isPrivateHost('172.32.0.1')).toBe(false);
    expect(isPrivateHost('example.com')).toBe(false);
  });

  test('validateRemoteUrl blocks http by default and blocks private hosts', () => {
    expect(() => validateRemoteUrl('http://example.com/agent.json')).toThrow('agent-registration-disallowed-scheme');
    expect(() => validateRemoteUrl('https://127.0.0.1/agent.json')).toThrow('agent-registration-disallowed-host');
  });

  test('validateRemoteUrl can allow http when enabled', () => {
    const url = validateRemoteUrl('http://example.com/agent.json', { allowHttp: true, allowPrivate: true });
    expect(url.protocol).toBe('http:');
  });

  test('fetchAgentRegistrationFromUri supports data:application/json;base64', async () => {
    const payload = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: 'myAgent',
      description: 'hello',
      services: [{ name: 'web', endpoint: 'https://example.com' }],
      x402Support: false,
      active: true,
    };
    const uri = `data:application/json;base64,${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
    const registration = await fetchAgentRegistrationFromUri(uri);
    expect(registration.name).toBe('myAgent');
    expect(registration.services).toEqual([
      { name: 'web', endpoint: 'https://example.com', version: null, skills: undefined, domains: undefined },
    ]);
  });

  test('fetchAgentRegistrationFromUri blocks http url by default (ssrf guard)', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn();

    await expect(fetchAgentRegistrationFromUri('http://example.com/agent.json')).rejects.toThrow(
      'agent-registration-disallowed-scheme',
    );

    global.fetch = originalFetch;
  });

  test('discoverErc8004Agent returns a Vaultfire-friendly record', async () => {
    const agentRegistry = 'eip155:8453:0x00000000000000000000000000000000000000AA';
    const tokenUriPayload = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: 'mirror-agent',
      description: 'A demo agent',
      services: [
        { name: 'A2A', endpoint: 'https://agent.example/.well-known/agent-card.json', version: '0.3.0' },
        { name: 'MCP', endpoint: 'https://mcp.agent.example/', version: '2025-06-18' },
      ],
      x402Support: false,
      active: true,
    };
    const tokenUri = `data:application/json;base64,${Buffer.from(JSON.stringify(tokenUriPayload)).toString('base64')}`;
    const owner = '0x0000000000000000000000000000000000000b0b';

    const provider = {
      call: jest.fn(async ({ to, data }) => {
        const sig = String(data).slice(0, 10).toLowerCase();
        // ownerOf(uint256)
        if (sig === ethers.id('ownerOf(uint256)').slice(0, 10)) {
          return ethers.AbiCoder.defaultAbiCoder().encode(['address'], [owner]);
        }
        // tokenURI(uint256)
        if (sig === ethers.id('tokenURI(uint256)').slice(0, 10)) {
          return ethers.AbiCoder.defaultAbiCoder().encode(['string'], [tokenUri]);
        }
        throw new Error(`unexpected selector ${sig} for ${to}`);
      }),
    };

    const result = await discoverErc8004Agent({
      agentRegistry,
      agentId: 1,
      provider,
    });

    expect(result.standard).toBe('ERC-8004');
    expect(result.owner).toBe(ethers.getAddress(owner));
    expect(result.registration.name).toBe('mirror-agent');
    expect(result.vaultfireIdentity.id).toBe('eip155:8453:0x00000000000000000000000000000000000000AA:1');
    expect(Array.isArray(result.vaultfireIdentity.endpoints)).toBe(true);
  });
});
