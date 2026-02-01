'use strict';

const { ethers } = require('ethers');

const IDENTITY_REGISTRY_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
];

function parseAgentRegistry(agentRegistry) {
  if (typeof agentRegistry !== 'string' || !agentRegistry.trim()) {
    throw new TypeError('agentRegistry must be a non-empty string');
  }

  const parts = agentRegistry.split(':').map((part) => part.trim());
  if (parts.length !== 3) {
    throw new Error('agentRegistry must be in the form {namespace}:{chainId}:{identityRegistry}');
  }

  const [namespace, chainIdRaw, identityRegistryRaw] = parts;
  if (!namespace) {
    throw new Error('agentRegistry namespace is required');
  }
  if (namespace !== 'eip155') {
    throw new Error(`Unsupported agentRegistry namespace: ${namespace}`);
  }

  const chainId = Number(chainIdRaw);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error('agentRegistry chainId must be a positive integer');
  }

  if (typeof identityRegistryRaw !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(identityRegistryRaw)) {
    throw new Error('agentRegistry identityRegistry must be a 0x-prefixed address');
  }

  const identityRegistry = ethers.getAddress(identityRegistryRaw);

  return {
    namespace,
    chainId,
    identityRegistry,
  };
}

function resolveIpfsUri(uri, gatewayBase) {
  const gateway = (gatewayBase || process.env.VF_IPFS_GATEWAY || 'https://ipfs.io').replace(/\/$/, '');
  const withoutScheme = uri.replace(/^ipfs:\/\//i, '');
  if (!withoutScheme) {
    throw new Error('ipfs-uri-empty');
  }
  return `${gateway}/ipfs/${withoutScheme}`;
}

function decodeDataJsonUri(uri) {
  // Supports: data:application/json;base64,....
  const match = uri.match(/^data:application\/json(?:;charset=[^;]+)?;base64,(.*)$/i);
  if (!match) {
    throw new Error('unsupported-data-uri');
  }
  const payload = Buffer.from(match[1], 'base64').toString('utf8');
  return JSON.parse(payload);
}

function normalizeAgentRegistration(registration) {
  if (!registration || typeof registration !== 'object') {
    throw new Error('invalid-registration');
  }

  const type = typeof registration.type === 'string' ? registration.type.trim() : '';
  const name = typeof registration.name === 'string' ? registration.name.trim() : '';

  if (!type) {
    throw new Error('registration.type required');
  }
  if (!name) {
    throw new Error('registration.name required');
  }

  const services = Array.isArray(registration.services) ? registration.services : [];
  const normalizedServices = services
    .filter((service) => service && typeof service === 'object')
    .map((service) => ({
      name: typeof service.name === 'string' ? service.name.trim() : '',
      endpoint: typeof service.endpoint === 'string' ? service.endpoint.trim() : '',
      version: typeof service.version === 'string' ? service.version.trim() : null,
      skills: Array.isArray(service.skills) ? service.skills : undefined,
      domains: Array.isArray(service.domains) ? service.domains : undefined,
    }))
    .filter((service) => service.name && service.endpoint);

  return {
    ...registration,
    type,
    name,
    description: typeof registration.description === 'string' ? registration.description.trim() : '',
    image: typeof registration.image === 'string' ? registration.image.trim() : '',
    active: registration.active !== undefined ? Boolean(registration.active) : true,
    x402Support: Boolean(registration.x402Support),
    services: normalizedServices,
  };
}

async function fetchAgentRegistrationFromUri(uri, options = {}) {
  if (typeof uri !== 'string' || !uri.trim()) {
    throw new TypeError('agentURI must be a non-empty string');
  }

  const agentUri = uri.trim();

  if (agentUri.startsWith('data:')) {
    const decoded = decodeDataJsonUri(agentUri);
    return normalizeAgentRegistration(decoded);
  }

  const resolvedUrl = agentUri.startsWith('ipfs://')
    ? resolveIpfsUri(agentUri, options.ipfsGateway)
    : agentUri;

  const response = await fetch(resolvedUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`agent-registration-fetch-failed:${response.status}`);
  }

  const payload = await response.json();
  return normalizeAgentRegistration(payload);
}

async function discoverErc8004Agent({ agentRegistry, agentId, rpcUrl, provider, ipfsGateway } = {}) {
  const parsed = parseAgentRegistry(agentRegistry);
  const id = typeof agentId === 'bigint' ? agentId : BigInt(agentId);

  if (!provider && !rpcUrl) {
    throw new Error('rpcUrl or provider required');
  }

  const resolvedProvider = provider || new ethers.JsonRpcProvider(rpcUrl);

  const iface = new ethers.Interface(IDENTITY_REGISTRY_ABI);
  const ownerData = iface.encodeFunctionData('ownerOf', [id]);
  const uriData = iface.encodeFunctionData('tokenURI', [id]);

  const [ownerRaw, uriRaw] = await Promise.all([
    resolvedProvider.call({ to: parsed.identityRegistry, data: ownerData }),
    resolvedProvider.call({ to: parsed.identityRegistry, data: uriData }),
  ]);

  const owner = iface.decodeFunctionResult('ownerOf', ownerRaw)[0];
  const tokenUri = iface.decodeFunctionResult('tokenURI', uriRaw)[0];

  const registration = await fetchAgentRegistrationFromUri(tokenUri, { ipfsGateway });

  return {
    standard: 'ERC-8004',
    agentRegistry: `${parsed.namespace}:${parsed.chainId}:${parsed.identityRegistry}`,
    chainId: parsed.chainId,
    identityRegistry: parsed.identityRegistry,
    agentId: id.toString(),
    owner: owner ? ethers.getAddress(owner) : null,
    agentURI: tokenUri,
    registration,
    // A minimal Vaultfire-friendly identity shape.
    vaultfireIdentity: {
      kind: 'agent',
      namespace: 'erc8004',
      id: `${parsed.namespace}:${parsed.chainId}:${parsed.identityRegistry}:${id.toString()}`,
      owner: owner ? ethers.getAddress(owner) : null,
      name: registration.name,
      endpoints: registration.services,
      active: registration.active,
    },
  };
}

module.exports = {
  parseAgentRegistry,
  fetchAgentRegistrationFromUri,
  discoverErc8004Agent,
  normalizeAgentRegistration,
  resolveIpfsUri,
};
