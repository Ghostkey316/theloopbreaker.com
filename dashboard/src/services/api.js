import { io } from 'socket.io-client';

const runtimeEnv =
  (typeof globalThis !== 'undefined' && globalThis.__VAULTFIRE_DASHBOARD_ENV__) ||
  (typeof process !== 'undefined' && process.env) ||
  {};

const API_BASE = runtimeEnv.VITE_VAULTFIRE_API || runtimeEnv.VAULTFIRE_API_BASE || 'http://localhost:4050';
let socket;
let socketRefCount = 0;

async function request(path, { method = 'GET', body, headers } = {}) {
  const requestHeaders = { 'Content-Type': 'application/json', ...(headers || {}) };
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error?.message || 'Vaultfire request failed';
    throw new Error(message);
  }

  return response.json();
}

function getSocket() {
  if (!socket) {
    socket = io(API_BASE, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });
  }
  socketRefCount += 1;
  return socket;
}

function releaseSocket() {
  if (socketRefCount > 0) {
    socketRefCount -= 1;
  }
  if (socketRefCount <= 0 && socket) {
    socket.disconnect();
    socket = null;
    socketRefCount = 0;
  }
}

export async function syncBeliefPayload(payload, { mode } = {}) {
  const headers = {};
  if (mode) {
    headers['X-Vaultfire-Mode'] = mode;
  }
  return request('/vaultfire/sync-belief', { method: 'POST', body: payload, headers });
}

export async function fetchSyncStatus() {
  return request('/vaultfire/sync-status');
}

export function subscribeToSync({ onSync, onError } = {}) {
  const instance = getSocket();

  if (onSync) {
    instance.on('belief-sync', onSync);
  }

  const errorHandler = (error) => {
    if (onError) {
      onError(error.message);
    } else {
      console.warn('Belief sync socket error', error.message);
    }
  };
  instance.on('connect_error', errorHandler);

  return () => {
    if (!instance) return;
    if (onSync) {
      instance.off('belief-sync', onSync);
    }
    instance.off('connect_error', errorHandler);
    releaseSocket();
  };
}

export function subscribeToObservability({ onUpdate, onError } = {}) {
  const instance = getSocket();

  if (onUpdate) {
    instance.on('observability:update', onUpdate);
  }

  const errorHandler = (error) => {
    if (onError) {
      onError(error.message);
    } else {
      console.warn('Observability socket error', error.message);
    }
  };
  instance.on('connect_error', errorHandler);

  return () => {
    if (!instance) return;
    if (onUpdate) {
      instance.off('observability:update', onUpdate);
    }
    instance.off('connect_error', errorHandler);
    releaseSocket();
  };
}

export async function fetchObservability() {
  return request('/vaultfire/observability');
}

export async function fetchSecurityPosture() {
  return request('/security/posture');
}

export async function fetchHandshakeSecret() {
  return request('/security/handshake');
}

export async function fetchStagingProfiles() {
  return request('/security/test-ens');
}

if (typeof module !== 'undefined') {
  module.exports = {
    syncBeliefPayload,
    fetchSyncStatus,
    subscribeToSync,
    subscribeToObservability,
    fetchObservability,
    fetchSecurityPosture,
    fetchHandshakeSecret,
    fetchStagingProfiles,
  };
}
