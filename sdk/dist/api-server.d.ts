/**
 * Vaultfire REST API Server
 *
 * Provides HTTP endpoints for non-Web3 integrations
 * Allows traditional apps to access Vaultfire trust layer without crypto wallets
 */
interface APIConfig {
    port: number;
    chain: 'base' | 'base-sepolia' | 'base-goerli';
    privateKey?: string;
    rateLimitWindow?: number;
    rateLimitMax?: number;
    webhookUrl?: string;
}
export declare class VaultfireAPIServer {
    private app;
    private sdk;
    private config;
    private signer?;
    constructor(config?: Partial<APIConfig>);
    private setupMiddleware;
    private setupRoutes;
    private sendWebhook;
    start(): void;
}
export default VaultfireAPIServer;
