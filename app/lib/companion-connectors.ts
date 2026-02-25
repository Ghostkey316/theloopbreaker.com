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

/**
 * Get connector config value
 */
export function getConnectorConfig(id: string, key: string): string | undefined {
  const connectors = getConnectors();
  const connector = connectors.find(c => c.id === id);
  return connector?.config?.[key];
}

/**
 * Set connector config value
 */
export function setConnectorConfig(id: string, key: string, value: string): void {
  const connectors = getConnectors();
  const index = connectors.findIndex(c => c.id === id);
  if (index !== -1) {
    if (!connectors[index].config) connectors[index].config = {};
    connectors[index].config![key] = value;
    saveConnectors(connectors);
  }
}

/**
 * Execute a connector task. Returns a result string.
 * Currently provides simulated responses — real API integration
 * will be added when backend endpoints are available.
 * The connector must be enabled and connected to execute.
 */
export interface ConnectorTaskResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export async function executeConnectorTask(
  connectorId: string,
  task: string,
  params?: Record<string, string>
): Promise<ConnectorTaskResult> {
  const connectors = getConnectors();
  const connector = connectors.find(c => c.id === connectorId);

  if (!connector) {
    return { success: false, message: `Connector '${connectorId}' not found.` };
  }

  if (!connector.enabled || connector.status !== 'connected') {
    return {
      success: false,
      message: `The ${connector.name} connector is not enabled. Enable it in the Companion Panel to use this feature.`,
    };
  }

  // Update lastUsed timestamp
  const idx = connectors.findIndex(c => c.id === connectorId);
  if (idx !== -1) {
    connectors[idx].lastUsed = Date.now();
    saveConnectors(connectors);
  }

  // Simulated task execution per connector type
  // These will be replaced with real API calls when backend is ready
  switch (connector.type) {
    case 'github':
      return {
        success: true,
        message: `GitHub connector is active. Task: "${task}". Full GitHub API integration (repos, issues, PRs) is coming soon. The connector is ready and waiting for the backend endpoint.`,
        data: { connector: 'github', task, timestamp: Date.now() },
      };

    case 'web':
      return {
        success: true,
        message: `Web Browser connector is active. Task: "${task}". Web search and browsing integration is coming soon. The connector is ready and waiting for the backend endpoint.`,
        data: { connector: 'web', task, timestamp: Date.now() },
      };

    case 'social':
      return {
        success: true,
        message: `${connector.name} connector is active. Task: "${task}". Social media integration is coming soon. The connector is ready and waiting for the backend endpoint.`,
        data: { connector: connector.id, task, timestamp: Date.now() },
      };

    case 'email':
      return {
        success: true,
        message: `Email connector is active. Task: "${task}". Email integration is coming soon. The connector is ready and waiting for the backend endpoint.`,
        data: { connector: 'email', task, timestamp: Date.now() },
      };

    case 'custom':
      return {
        success: true,
        message: `Custom API connector is active. Task: "${task}". Configure your API endpoint in the connector settings. Full custom API integration is coming soon.`,
        data: { connector: 'custom', task, params, timestamp: Date.now() },
      };

    default:
      return { success: false, message: `Unknown connector type: ${connector.type}` };
  }
}

/**
 * Get a human-readable status summary for all connectors
 */
export function getConnectorsSummary(): string {
  const connectors = getConnectors();
  const enabled = connectors.filter(c => c.enabled);
  const disabled = connectors.filter(c => !c.enabled);

  let summary = `**Connectors Status:**\n`;
  summary += `Active: ${enabled.length} | Inactive: ${disabled.length}\n\n`;

  if (enabled.length > 0) {
    summary += `**Active Connectors:**\n`;
    for (const c of enabled) {
      const lastUsed = c.lastUsed ? new Date(c.lastUsed).toLocaleDateString() : 'never';
      summary += `• ${c.name} — ${c.status} (last used: ${lastUsed})\n`;
    }
  }

  if (disabled.length > 0) {
    summary += `\n**Available (not enabled):**\n`;
    for (const c of disabled) {
      summary += `• ${c.name} — ${c.description}\n`;
    }
  }

  return summary;
}
