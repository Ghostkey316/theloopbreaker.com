import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_VAULTFIRE_API || 'http://localhost:4002';
let socket;

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  headers['X-Vaultfire-Reason'] = 'dashboard_insight';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || 'Vaultfire API request failed');
  }

  return res.json();
}

export async function loginPartner({ userId, token }) {
  if (token) {
    return {
      token,
      partnerId: userId,
      status: 'connected',
      metrics: {
        averageYield: 6.4,
        signalConfidence: '92%',
      },
    };
  }

  const response = await request('/auth/login', {
    method: 'POST',
    body: { userId },
  });

  return {
    token: response.accessToken,
    partnerId: userId,
    status: 'connected',
    metrics: {
      averageYield: 6.4,
      signalConfidence: '92%',
    },
  };
}

export async function fetchMetrics(token) {
  const compass = await request('/signal-compass/state', { token });
  return compass;
}

export function subscribeToSignalCompass({ token, onUpdate } = {}) {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(API_BASE, {
    transports: ['websocket'],
    auth: { token },
  });

  if (onUpdate) {
    socket.on('signal-compass:update', onUpdate);
  }

  socket.on('connect_error', (error) => {
    console.warn('Signal compass socket error', error.message);
  });

  return () => {
    if (!socket) return;
    if (onUpdate) {
      socket.off('signal-compass:update', onUpdate);
    }
    socket.disconnect();
    socket = null;
  };
}
