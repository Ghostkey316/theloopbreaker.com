class EnvironmentSecretsProvider {
  getSecret(key) {
    return process.env[key];
  }
}

class SecretsManager {
  constructor({ providers } = {}) {
    this.providers = Array.isArray(providers) && providers.length ? providers : [new EnvironmentSecretsProvider()];
  }

  getSecret(key, { fallback, required = false } = {}) {
    for (const provider of this.providers) {
      if (!provider || typeof provider.getSecret !== 'function') {
        continue;
      }
      const value = provider.getSecret(key);
      if (value !== undefined && value !== null) {
        return value;
      }
    }
    if (fallback !== undefined) {
      return fallback;
    }
    if (required) {
      throw new Error(`Secret ${key} not found`);
    }
    return undefined;
    // TODO(secrets-vault-migration): extend to async providers (HashiCorp Vault, HSM) while preserving interface parity.
  }

  list(keys = []) {
    return keys
      .map((key) => this.getSecret(key))
      .filter((value) => value !== undefined && value !== null && String(value).length > 0);
  }
}

module.exports = { SecretsManager, EnvironmentSecretsProvider };
