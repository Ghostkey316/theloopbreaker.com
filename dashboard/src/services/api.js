import { io } from 'socket.io-client';

const runtimeEnv =
  (typeof globalThis !== 'undefined' && globalThis.__VAULTFIRE_DASHBOARD_ENV__) ||
  (typeof process !== 'undefined' && process.env) ||
  {};

const API_BASE = runtimeEnv.VITE_VAULTFIRE_API || runtimeEnv.VAULTFIRE_API_BASE || 'http://localhost:4050';
const DEFAULT_METADATA_BUDGET = 2400;
let socket;
let socketRefCount = 0;

function estimateViewportBudget() {
  if (typeof window !== 'undefined' && window.innerWidth && window.innerHeight) {
    const area = window.innerWidth * window.innerHeight;
    const normalized = Math.max(960, Math.floor(area * 0.45));
    return Math.min(6400, normalized);
  }
  return DEFAULT_METADATA_BUDGET;
}

function clampMetadataForViewport(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const budget = estimateViewportBudget();
  const serialized = JSON.stringify(metadata);
  if (serialized.length <= budget) {
    return metadata;
  }

  const trimmed = {};
  let used = 2; // account for braces in JSON string
  for (const [key, value] of Object.entries(metadata)) {
    const chunk = JSON.stringify({ [key]: value });
    const chunkSize = chunk.length;
    if (used + chunkSize > budget) {
      continue;
    }
    trimmed[key] = value;
    used += chunkSize;
  }

  trimmed.__truncated__ = true;
  trimmed.__originalBytes__ = serialized.length;
  trimmed.__budget__ = budget;
  return trimmed;
}

function enforceViewportBudget(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }
  const safePayload = { ...payload };
  if (safePayload.metadata) {
    safePayload.metadata = clampMetadataForViewport(safePayload.metadata);
  }
  if (safePayload.meta) {
    safePayload.meta = clampMetadataForViewport(safePayload.meta);
  }
  return safePayload;
}

function isIosDevice() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !window.MSStream;
}

function hintHapticFeedback(pattern = 'impactMedium') {
  try {
    if (typeof window === 'undefined') {
      return false;
    }
    if (window.navigator?.vibrate) {
      if (pattern === 'impactMedium') {
        window.navigator.vibrate([12, 20, 12]);
      } else {
        window.navigator.vibrate(20);
      }
      return true;
    }
    const handler = window.webkit?.messageHandlers?.vaultfireHaptics;
    if (handler?.postMessage && isIosDevice()) {
      handler.postMessage({ type: pattern });
      return true;
    }
  } catch (error) {
    console.warn('Unable to dispatch haptic feedback hint', error);
  }
  return false;
}

function shouldTriggerHaptics(options, payload) {
  if (options && Object.prototype.hasOwnProperty.call(options, 'triggerHaptics')) {
    return Boolean(options.triggerHaptics);
  }
  if (payload && typeof payload === 'object' && payload.metadata?.triggerHaptics === false) {
    return false;
  }
  return true;
}

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

export async function syncBeliefPayload(payload, { mode, triggerHaptics } = {}) {
  const headers = {};
  if (mode) {
    headers['X-Vaultfire-Mode'] = mode;
  }
  const safePayload = enforceViewportBudget(payload);
  const response = await request('/vaultfire/sync-belief', { method: 'POST', body: safePayload, headers });
  if (shouldTriggerHaptics({ triggerHaptics }, safePayload)) {
    hintHapticFeedback('impactMedium');
  }
  return response;
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
    enforceViewportBudget,
    clampMetadataForViewport,
    hintHapticFeedback,
  };
}
