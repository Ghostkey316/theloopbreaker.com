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

  // Common variant: ipfs://ipfs/<CID>
  const normalized = withoutScheme.replace(/^ipfs\//i, '');
  return `${gateway}/ipfs/${normalized}`;
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

function isPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return true;

  // Obvious localhost/loopback
  if (host === 'localhost' || host === '::1') return true;

  // IPv4 loopback and private ranges (simple string check)
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  const m172 = host.match(/^172\.(\d+)\./);
  if (m172) {
    const oct = Number(m172[1]);
    if (Number.isInteger(oct) && oct >= 16 && oct <= 31) return true;
  }

  // Link-local
  if (/^169\.254\./.test(host)) return true;

  return false;
}

function validateRemoteUrl(targetUrl, options = {}) {
  const { allowHttp = false, allowPrivate = false, allowedHosts } = options;

  let url;
  try {
    url = new URL(targetUrl);
  } catch {
    throw new Error('agent-registration-invalid-url');
  }

  const scheme = url.protocol.toLowerCase();
  const isHttps = scheme === 'https:';
  const isHttp = scheme === 'http:';

  if (!(isHttps || (allowHttp && isHttp))) {
    throw new Error('agent-registration-disallowed-scheme');
  }

  const host = url.hostname;

  if (!allowPrivate && isPrivateHost(host)) {
    throw new Error('agent-registration-disallowed-host');
  }

  if (Array.isArray(allowedHosts) && allowedHosts.length > 0) {
    const normalized = host.toLowerCase();
    const ok = allowedHosts.some((h) => String(h).toLowerCase() === normalized);
    if (!ok) {
      throw new Error('agent-registration-host-not-allowlisted');
    }
  }

  return url;
}

async function readResponseTextWithLimit(response, maxBytes) {
  const limit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 1024 * 1024; // 1MB default

  const headerLen = response.headers && response.headers.get ? response.headers.get('content-length') : null;
  if (headerLen && Number(headerLen) > limit) {
    throw new Error('agent-registration-too-large');
  }

  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > limit) {
      throw new Error('agent-registration-too-large');
    }
    return text;
  }

  let total = 0;
  const chunks = [];

  // Node fetch Response.body is a ReadableStream with async iterator support.
  for await (const chunk of response.body) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > limit) {
      throw new Error('agent-registration-too-large');
    }
    chunks.push(buf);
  }

  return Buffer.concat(chunks).toString('utf8');
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

  // Basic SSRF guardrails. NOTE: this does not do DNS resolution to detect private IPs.
  const url = validateRemoteUrl(resolvedUrl, {
    allowHttp: Boolean(options.allowHttp),
    allowPrivate: Boolean(options.allowPrivate),
    allowedHosts: options.allowedHosts,
  });

  const controller = new AbortController();
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 12_000;
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`agent-registration-fetch-failed:${response.status}`);
    }

    const text = await readResponseTextWithLimit(response, options.maxBytes);

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('agent-registration-invalid-json');
    }

    return normalizeAgentRegistration(payload);
  } catch (err) {
    if (err && (err.name === 'AbortError' || String(err).includes('AbortError'))) {
      throw new Error('agent-registration-timeout');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverErc8004Agent({ agentRegistry, agentId, rpcUrl, provider, ipfsGateway, fetchOptions } = {}) {
  const parsed = parseAgentRegistry(agentRegistry);

  let id;
  try {
    id = typeof agentId === 'bigint' ? agentId : BigInt(agentId);
  } catch {
    throw new Error('invalid-agentId');
  }

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

  const registration = await fetchAgentRegistrationFromUri(tokenUri, { ipfsGateway, ...(fetchOptions || {}) });

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
  // exported for testing/inspection
  validateRemoteUrl,
  isPrivateHost,
};
