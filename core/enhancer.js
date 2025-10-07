'use strict';

const FRONTIER_TECH_TAG = 'frontier-tech';

function normalizeUpgrade(upgrade, index) {
  let payload = upgrade;
  if (typeof payload === 'function') {
    payload = payload();
  }
  if (!payload || typeof payload !== 'object') {
    throw new TypeError(`enhanceProtocol: upgrade #${index + 1} must resolve to an object.`);
  }
  const moduleId = payload.module || payload.name || `upgrade-${index + 1}`;
  const status = payload.status || 'configured';
  const capabilities = payload.capabilities || payload.features || [];
  const normalized = {
    module: String(moduleId),
    status: String(status),
    frontierTag: payload.frontierTag || FRONTIER_TECH_TAG,
    capabilities: Array.isArray(capabilities)
      ? [...capabilities]
      : [String(capabilities)].filter(Boolean),
    details: { ...payload },
    timestamp: new Date().toISOString(),
  };
  return normalized;
}

function normalizeEnforcement(enforce) {
  if (typeof enforce === 'function') {
    return normalizeEnforcement(enforce());
  }
  if (!enforce || typeof enforce !== 'object') {
    throw new TypeError('enhanceProtocol: enforce payload must resolve to an object.');
  }
  const moduleId = enforce.module || enforce.name || 'mission-lock';
  const status = enforce.status || 'configured';
  return {
    module: String(moduleId),
    status: String(status),
    frontierTag: enforce.frontierTag || FRONTIER_TECH_TAG,
    integrityLevel: enforce.integrityLevel || 'reinforced',
    details: { ...enforce },
    timestamp: new Date().toISOString(),
  };
}

function enhanceProtocol({ identity, upgrades, enforce }) {
  const identityLabel = typeof identity === 'string' ? identity.trim() : '';
  if (!identityLabel) {
    throw new TypeError('enhanceProtocol requires a non-empty identity value.');
  }
  if (!Array.isArray(upgrades) || upgrades.length === 0) {
    throw new TypeError('enhanceProtocol requires at least one upgrade module.');
  }
  const normalizedUpgrades = upgrades.map((upgrade, index) => normalizeUpgrade(upgrade, index));
  const normalizedEnforce = normalizeEnforcement(enforce);
  return {
    identity: identityLabel,
    activatedAt: new Date().toISOString(),
    modules: normalizedUpgrades,
    enforcement: normalizedEnforce,
    status: 'protocol-enhanced',
  };
}

module.exports = {
  enhanceProtocol,
};
