import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_VAULTFIRE_API || 'http://localhost:4050';
let socket;

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error?.message || 'Vaultfire request failed';
    throw new Error(message);
  }

  return response.json();
}

export async function syncBeliefPayload(payload) {
  return request('/vaultfire/sync-belief', { method: 'POST', body: payload });
}

export async function fetchSyncStatus() {
  return request('/vaultfire/sync-status');
}

export function subscribeToSync({ onSync, onError } = {}) {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(API_BASE, {
    transports: ['websocket'],
    reconnectionAttempts: 5,
  });

  if (onSync) {
    socket.on('belief-sync', onSync);
  }

  socket.on('connect_error', (error) => {
    if (onError) {
      onError(error.message);
    } else {
      console.warn('Belief sync socket error', error.message);
    }
  });

  return () => {
    if (!socket) return;
    if (onSync) {
      socket.off('belief-sync', onSync);
    }
    socket.disconnect();
    socket = null;
  };
}
