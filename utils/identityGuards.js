const BANNED_IDENTITY_PATTERNS = [
  'email',
  'phone',
  'passport',
  'kyc',
  'ssi',
  'did',
  'oauth',
  'cognito',
  'firebase',
  'digitalid',
  'identity',
  'biometric',
  'socialsecurity',
  'nationalid',
  'fullname',
  'surname',
  'legalname',
];

function assertWalletOnlyData(data, { context = 'payload' } = {}) {
  if (!data || typeof data !== 'object') {
    return;
  }

  const stack = [{ node: data, path: context }];
  while (stack.length) {
    const { node, path } = stack.pop();
    if (!node || typeof node !== 'object') {
      // eslint-disable-next-line no-continue
      continue;
    }
    for (const key of Object.keys(node)) {
      const normalizedKey = key.toLowerCase();
      if (['wallet', 'ens', 'metrics', 'payload', 'message', 'signature'].includes(normalizedKey)) {
        const value = node[key];
        if (value && typeof value === 'object') {
          stack.push({ node: value, path: `${path}.${key}` });
        }
        // eslint-disable-next-line no-continue
        continue;
      }
      if (BANNED_IDENTITY_PATTERNS.some((pattern) => normalizedKey.includes(pattern))) {
        throw new Error(`Field '${path}.${key}' is not permitted. Wallet + ENS only.`);
      }
      const value = node[key];
      if (value && typeof value === 'object') {
        stack.push({ node: value, path: `${path}.${key}` });
      }
    }
  }
}

module.exports = {
  assertWalletOnlyData,
  BANNED_IDENTITY_PATTERNS,
};
