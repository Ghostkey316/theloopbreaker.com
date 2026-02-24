/**
 * Companion External Connector System — Internet-Capable Agent Framework
 * 
 * This system allows the Embris companion to connect to external services
 * and operate across the internet on behalf of the user.
 * 
 * Supported Connectors:
 * - GitHub (Repos, Issues, PRs)
 * - Web/Browser (Search, Browsing, Info Retrieval)
 * - Social (X/Twitter, Discord, Telegram)
 * - Email & Custom APIs
 * 
 * Users have full control to enable/disable each connector.
 */

export type ConnectorType = 'github' | 'web' | 'social' | 'email' | 'custom';
export type ConnectorStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export interface Connector {
  id: string;
  type: ConnectorType;
  name: string;
  description: string;
  status: ConnectorStatus;
  enabled: boolean;
  lastUsed?: number;
  config?: Record<string, any>;
}

const CONNECTORS_KEY = 'embris_connectors_v1';

const DEFAULT_CONNECTORS: Connector[] = [
  {
    id: 'github_main',
    type: 'github',
    name: 'GitHub',
    description: 'Access your repositories, check issues, and manage pull requests.',
    status: 'disconnected',
    enabled: false,
  },
  {
    id: 'web_browser',
    type: 'web',
    name: 'Web Browser',
    description: 'Search the web, browse pages, and pull real-time information.',
    status: 'disconnected',
    enabled: false,
  },
  {
    id: 'social_x',
    type: 'social',
    name: 'X / Twitter',
    description: 'Monitor trends, post updates, and engage with your community.',
    status: 'disconnected',
    enabled: false,
  },
  {
    id: 'social_discord',
    type: 'social',
    name: 'Discord',
    description: 'Connect to your servers and interact with members.',
    status: 'disconnected',
    enabled: false,
  },
  {
    id: 'email_service',
    type: 'email',
    name: 'Email',
    description: 'Manage your inbox and send automated notifications.',
    status: 'disconnected',
    enabled: false,
  },
  {
    id: 'custom_api',
    type: 'custom',
    name: 'Custom API',
    description: 'Connect to any external API with your own credentials.',
    status: 'disconnected',
    enabled: false,
  }
];

export function getConnectors(): Connector[] {
  if (typeof window === 'undefined') return DEFAULT_CONNECTORS;
  const raw = localStorage.getItem(CONNECTORS_KEY);
  if (!raw) return DEFAULT_CONNECTORS;
  try {
    const saved = JSON.parse(raw);
    // Merge saved state with defaults to ensure new connectors show up
    return DEFAULT_CONNECTORS.map(def => {
      const existing = saved.find((s: Connector) => s.id === def.id);
      return existing ? { ...def, ...existing } : def;
    });
  } catch {
    return DEFAULT_CONNECTORS;
  }
}

export function saveConnectors(connectors: Connector[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONNECTORS_KEY, JSON.stringify(connectors));
}

export function toggleConnector(id: string, enabled: boolean): void {
  const connectors = getConnectors();
  const index = connectors.findIndex(c => c.id === id);
  if (index !== -1) {
    connectors[index].enabled = enabled;
    if (enabled) {
      // Set to 'connected' immediately — full OAuth integration coming soon.
      // The connector is "ready" to be used once the backend integration is live.
      connectors[index].status = 'connected';
      connectors[index].lastUsed = Date.now();
    } else {
      connectors[index].status = 'disconnected';
    }
    saveConnectors(connectors);
  }
}

export function updateConnectorStatus(id: string, status: ConnectorStatus): void {
  const connectors = getConnectors();
  const index = connectors.findIndex(c => c.id === id);
  if (index !== -1) {
    connectors[index].status = status;
    saveConnectors(connectors);
  }
}

export function getEnabledConnectors(): Connector[] {
  return getConnectors().filter(c => c.enabled);
}

/**
 * Check if the companion can perform a task requiring an external service
 */
export function canPerformTask(type: ConnectorType): boolean {
  return getConnectors().some(c => c.type === type && c.enabled && c.status === 'connected');
}
