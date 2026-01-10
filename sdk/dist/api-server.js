"use strict";
/**
 * Vaultfire REST API Server
 *
 * Provides HTTP endpoints for non-Web3 integrations
 * Allows traditional apps to access Vaultfire trust layer without crypto wallets
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultfireAPIServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const ethers_1 = require("ethers");
const vaultfire_1 = require("./vaultfire");
// ============================================================================
// API Server
// ============================================================================
class VaultfireAPIServer {
    constructor(config = {}) {
        this.config = {
            port: config.port || 3001,
            chain: config.chain || 'base',
            privateKey: config.privateKey || process.env.VAULTFIRE_PRIVATE_KEY,
            rateLimitWindow: config.rateLimitWindow || 15,
            rateLimitMax: config.rateLimitMax || 100,
            webhookUrl: config.webhookUrl || process.env.VAULTFIRE_WEBHOOK_URL,
        };
        this.app = (0, express_1.default)();
        this.sdk = new vaultfire_1.VaultfireSDK({ chain: this.config.chain });
        // Connect signer if available
        if (this.config.privateKey) {
            this.signer = new ethers_1.Wallet(this.config.privateKey);
            this.sdk.connect(this.signer);
        }
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        // CORS
        this.app.use((0, cors_1.default)());
        // JSON body parser
        this.app.use(express_1.default.json({ limit: '10mb' }));
        // Rate limiting
        const limiter = (0, express_rate_limit_1.default)({
            windowMs: this.config.rateLimitWindow * 60 * 1000,
            max: this.config.rateLimitMax,
            message: { error: 'Too many requests, please try again later.' },
        });
        this.app.use('/api/', limiter);
        // Request logging
        this.app.use((req, _res, next) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            next();
        });
    }
    setupRoutes() {
        // Health check
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'healthy',
                chain: this.config.chain,
                timestamp: new Date().toISOString(),
            });
        });
        // Get chain configuration
        this.app.get('/api/v1/config', (_req, res) => {
            try {
                const config = this.sdk.getChainConfig();
                res.json({ success: true, data: config });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
        // Get available modules
        this.app.get('/api/v1/modules', async (_req, res) => {
            try {
                const modules = await this.sdk.getModules();
                res.json({ success: true, data: modules });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
        // Verify belief (POST)
        this.app.post('/api/v1/verify', async (req, res) => {
            try {
                const { statement, moduleId = vaultfire_1.ModuleType.GENERIC, metadata } = req.body;
                if (!statement) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: statement',
                    });
                }
                if (!this.signer) {
                    return res.status(503).json({
                        success: false,
                        error: 'Server not configured with signer. Set VAULTFIRE_PRIVATE_KEY.',
                    });
                }
                // Hash the belief
                const beliefHash = this.sdk.hashBelief(statement);
                // Create attestation
                const attestation = {
                    beliefHash,
                    moduleId,
                    metadata,
                };
                // Verify
                const result = await this.sdk.verifyBelief(attestation);
                if (!result.verified) {
                    return res.status(500).json({
                        success: false,
                        error: result.error || 'Verification failed',
                    });
                }
                const response = {
                    success: true,
                    data: {
                        txHash: result.txHash,
                        beliefHash,
                        verified: result.verified,
                        gasUsed: result.gasUsed?.toString(),
                        attestationId: result.attestationId,
                    },
                };
                // Send webhook if configured
                if (this.config.webhookUrl) {
                    this.sendWebhook(this.config.webhookUrl, {
                        event: 'belief.verified',
                        data: response.data,
                        timestamp: new Date().toISOString(),
                    }).catch(console.error);
                }
                res.json(response);
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
        // Check if belief is sovereign
        this.app.get('/api/v1/sovereign/:beliefHash', async (req, res) => {
            try {
                const { beliefHash } = req.params;
                if (!beliefHash || !beliefHash.startsWith('0x')) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid beliefHash format',
                    });
                }
                const isSovereign = await this.sdk.isSovereign(beliefHash);
                res.json({
                    success: true,
                    data: {
                        beliefHash,
                        isSovereign,
                    },
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
        // Get attestations by address
        this.app.get('/api/v1/attestations/:address', async (req, res) => {
            try {
                const { address } = req.params;
                const limit = parseInt(req.query.limit) || 100;
                if (!ethers_1.ethers.isAddress(address)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid Ethereum address',
                    });
                }
                const attestations = await this.sdk.getAttestations(address, limit);
                res.json({
                    success: true,
                    data: {
                        address,
                        count: attestations.length,
                        attestations,
                    },
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
        // Estimate gas
        this.app.post('/api/v1/estimate-gas', async (req, res) => {
            try {
                const { statement, moduleId = vaultfire_1.ModuleType.GENERIC } = req.body;
                if (!statement) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: statement',
                    });
                }
                const beliefHash = this.sdk.hashBelief(statement);
                const gas = await this.sdk.estimateGas({ beliefHash, moduleId });
                res.json({
                    success: true,
                    data: {
                        beliefHash,
                        estimatedGas: gas.toString(),
                        estimatedGwei: '~61000', // Based on benchmarks
                    },
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
        // Hash utility endpoint
        this.app.post('/api/v1/hash', (req, res) => {
            try {
                const { statement } = req.body;
                if (!statement) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: statement',
                    });
                }
                const hash = this.sdk.hashBelief(statement);
                res.json({
                    success: true,
                    data: {
                        statement,
                        hash,
                    },
                });
            }
            catch (error) {
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
        // 404 handler
        this.app.use((_req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
            });
        });
    }
    async sendWebhook(url, payload) {
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        }
        catch (error) {
            console.error('Webhook delivery failed:', error);
        }
    }
    start() {
        this.app.listen(this.config.port, () => {
            console.log(`
┌────────────────────────────────────────────────────┐
│  🔥 Vaultfire API Server                           │
│                                                     │
│  Status:  Running                                   │
│  Chain:   ${this.config.chain.padEnd(41)}│
│  Port:    ${this.config.port.toString().padEnd(41)}│
│  Signer:  ${(this.signer ? '✓ Connected' : '✗ Not configured').padEnd(41)}│
│                                                     │
│  Endpoints:                                         │
│  • GET  /health                                     │
│  • GET  /api/v1/config                              │
│  • GET  /api/v1/modules                             │
│  • POST /api/v1/verify                              │
│  • GET  /api/v1/sovereign/:hash                     │
│  • GET  /api/v1/attestations/:address               │
│  • POST /api/v1/estimate-gas                        │
│  • POST /api/v1/hash                                │
│                                                     │
│  Docs: https://docs.vaultfire.io                    │
└────────────────────────────────────────────────────┘
      `);
        });
    }
}
exports.VaultfireAPIServer = VaultfireAPIServer;
// ============================================================================
// CLI Entry Point
// ============================================================================
if (require.main === module) {
    const server = new VaultfireAPIServer({
        port: parseInt(process.env.PORT || '3001'),
        chain: process.env.VAULTFIRE_CHAIN || 'base',
    });
    server.start();
}
exports.default = VaultfireAPIServer;
