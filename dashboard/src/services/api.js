import { io } from 'socket.io-client';

const runtimeEnv =
  (typeof globalThis !== 'undefined' && globalThis.__VAULTFIRE_DASHBOARD_ENV__) ||
  (typeof process !== 'undefined' && process.env) ||
  {};

const API_BASE = runtimeEnv.VITE_VAULTFIRE_API || runtimeEnv.VAULTFIRE_API_BASE || 'http://localhost:4050';
const DEFAULT_METADATA_BUDGET = 2400;
const METADATA_PADDING_RATIO = 0.1;
const MAX_METADATA_DEPTH = 4;
const DEFAULT_STATUS_METADATA = {
  manifest: {
    name: 'Vaultfire Protocol',
    semanticVersion: '0.0.0',
    releaseDate: null,
    ethicsTags: ['ethics-anchor'],
    scopeTags: ['pilot'],
  },
  ethics: { tags: ['ethics-anchor'] },
  scope: { tags: ['pilot'] },
};
const NULL_TELEMETRY_FALLBACKS = {
  syncStatus: { status: 'unknown', sessions: [], sandbox: { active: false } },
  observability: { status: 'offline', streams: [], lastUpdated: null },
  securityPosture: { status: 'unknown', checks: [], lastScan: null },
  handshakeSecret: { status: 'unavailable', secret: null, rotation: null },
  stagingProfiles: { profiles: [], source: 'fallback' },
};
let socket;
let socketRefCount = 0;

function estimateViewportBudget() {
  if (typeof window !== 'undefined' && window.innerWidth && window.innerHeight) {
    const area = window.innerWidth * window.innerHeight;
    const baseBudget = Math.max(960, Math.floor(area * 0.45));
    const deviceRatio = typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : 1;
    const adjusted = baseBudget / Math.max(1, deviceRatio * 0.9);
    return Math.min(6400, Math.floor(adjusted));
  }
  return DEFAULT_METADATA_BUDGET;
}

function shrinkValueForBudget(value, budget, depth = 0) {
  if (budget <= 0 || depth > MAX_METADATA_DEPTH) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const estimated = value.length * 2;
    if (estimated <= budget) {
      return value;
    }
    const sliceLength = Math.max(1, Math.floor(budget / 2));
    return `${value.slice(0, sliceLength)}…`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [];
    }
    const result = [];
    let used = 2; // [] braces
    for (const item of value) {
      const remaining = budget - used;
      if (remaining <= 0) {
        break;
      }
      const shrunk = shrinkValueForBudget(item, Math.floor(remaining * (1 - METADATA_PADDING_RATIO)), depth + 1);
      if (typeof shrunk === 'undefined') {
        break;
      }
      const candidateSize = JSON.stringify(shrunk).length + (result.length ? 1 : 0);
      if (used + candidateSize > budget) {
        break;
      }
      result.push(shrunk);
      used += candidateSize;
    }
    return result;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'object') {
    return clampMetadataForViewport(
      value,
      Math.max(0, Math.floor(budget * (1 - METADATA_PADDING_RATIO))),
      { root: false, depth: depth + 1 }
    );
  }

  return undefined;
}

function clampMetadataForViewport(metadata, budget = estimateViewportBudget(), options = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const { root = true, depth = 0 } = options;
  if (depth > MAX_METADATA_DEPTH) {
    return {};
  }

  const serialized = JSON.stringify(metadata);
  if (serialized.length <= budget) {
    return JSON.parse(serialized);
  }

  const trimmed = {};
  let used = 2; // account for braces in JSON string
  let truncated = false;

  for (const [key, value] of Object.entries(metadata)) {
    const remaining = budget - used;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const shrunk = shrinkValueForBudget(value, Math.floor(remaining * (1 - METADATA_PADDING_RATIO)), depth + 1);
    if (typeof shrunk === 'undefined') {
      truncated = true;
      continue;
    }
    const candidateSize = JSON.stringify({ [key]: shrunk }).length;
    if (used + candidateSize > budget) {
      truncated = true;
      continue;
    }
    trimmed[key] = shrunk;
    used += candidateSize;
    if (shrunk !== value) {
      truncated = true;
    }
  }

  if (!root) {
    return trimmed;
  }

  trimmed.__budget__ = budget;
  trimmed.__originalBytes__ = serialized.length;
  trimmed.__renderedKeys__ = Object.keys(trimmed).filter((key) => !key.startsWith('__'));
  trimmed.__truncated__ = truncated || trimmed.__originalBytes__ > budget;

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

function computeTouchTargetHint() {
  if (typeof window === 'undefined') {
    return { minSize: 48, recommendedSpacing: 14, density: 'standard' };
  }
  const width = window.innerWidth || 360;
  const ratio = typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : 1;
  const minSize = Math.max(44, Math.round(width / (ratio * 8)));
  const recommendedSpacing = Math.max(12, Math.round(minSize * 0.6));
  const density = width < 480 ? 'cozy' : width < 768 ? 'standard' : 'spacious';
  return { minSize, recommendedSpacing, density };
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
      } else if (pattern === 'notificationSuccess') {
        window.navigator.vibrate([8, 8, 8, 24]);
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

export function getTouchTargetHint() {
  return computeTouchTargetHint();
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

  const payload = await response.json();

  if (payload == null) {
    return null;
  }

  if (method === 'GET' && path === '/status') {
    const manifest = {
      ...DEFAULT_STATUS_METADATA.manifest,
      ...(payload.manifest || {}),
    };
    const ethicsTags = payload.ethics?.tags || manifest.ethicsTags || DEFAULT_STATUS_METADATA.ethics.tags;
    const scopeTags = payload.scope?.tags || manifest.scopeTags || DEFAULT_STATUS_METADATA.scope.tags;
    payload.manifest = manifest;
    payload.ethics = { tags: ethicsTags };
    payload.scope = { tags: scopeTags };
  }

  return payload;
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
    const pattern = isIosDevice() ? 'impactMedium' : 'notificationSuccess';
    hintHapticFeedback(pattern);
  }
  return response;
}

export async function fetchSyncStatus() {
  const payload = await request('/vaultfire/sync-status');
  if (payload == null) {
    return { ...NULL_TELEMETRY_FALLBACKS.syncStatus };
  }
  return payload;
}

export async function fetchStatus() {
  const payload = await request('/status');
  if (payload == null) {
    return {
      manifest: { ...DEFAULT_STATUS_METADATA.manifest },
      ethics: { ...DEFAULT_STATUS_METADATA.ethics },
      scope: { ...DEFAULT_STATUS_METADATA.scope },
    };
  }
  return payload;
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
  const payload = await request('/vaultfire/observability');
  if (payload == null) {
    return { ...NULL_TELEMETRY_FALLBACKS.observability };
  }
  return payload;
}

export async function fetchSecurityPosture() {
  const payload = await request('/security/posture');
  if (payload == null) {
    return { ...NULL_TELEMETRY_FALLBACKS.securityPosture };
  }
  return payload;
}

export async function fetchHandshakeSecret() {
  const payload = await request('/security/handshake');
  if (payload == null) {
    return { ...NULL_TELEMETRY_FALLBACKS.handshakeSecret };
  }
  return payload;
}

export async function fetchStagingProfiles() {
  const payload = await request('/security/test-ens');
  if (payload == null) {
    return { ...NULL_TELEMETRY_FALLBACKS.stagingProfiles };
  }
  return payload;
}

if (typeof module !== 'undefined') {
  module.exports = {
    syncBeliefPayload,
    fetchSyncStatus,
    fetchStatus,
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
