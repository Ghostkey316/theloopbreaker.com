'use strict';

let partnerHookUrl = null;
let customFetch = null;

function resolveFetch() {
  if (customFetch) {
    return customFetch;
  }
  // eslint-disable-next-line global-require
  const fetch = require('node-fetch');
  return typeof fetch === 'function' ? fetch : fetch.default;
}

const adapter = {
  init(partnerUrl, options = {}) {
    if (!partnerUrl && !options.partnerUrl) {
      throw new Error('partner_hook_adapter.init requires a partnerUrl value.');
    }
    partnerHookUrl = partnerUrl || options.partnerUrl;
    if (options.fetch) {
      customFetch = options.fetch;
    }
    return { partnerHookUrl };
  },

  async writeTelemetry(entry = {}) {
    if (!partnerHookUrl) {
      throw new Error('partner_hook_adapter not initialised. Call init(partnerUrl) first.');
    }
    const fetchImpl = resolveFetch();
    const response = await fetchImpl(partnerHookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(entry),
    });
    if (!response.ok) {
      const error = new Error(`Partner hook responded with status ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response;
  },
};

module.exports = adapter;
