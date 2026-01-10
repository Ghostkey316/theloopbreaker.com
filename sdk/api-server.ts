/**
 * Vaultfire REST API Server
 *
 * Provides HTTP endpoints for non-Web3 integrations
 * Allows traditional apps to access Vaultfire trust layer without crypto wallets
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ethers, Wallet } from 'ethers';
import { VaultfireSDK, ModuleType, BeliefAttestation } from './vaultfire';

// ============================================================================
// Types
// ============================================================================

interface APIConfig {
  port: number;
  chain: 'base' | 'base-sepolia' | 'base-goerli';
  privateKey?: string;
  rateLimitWindow?: number; // minutes
  rateLimitMax?: number; // requests per window
  webhookUrl?: string;
}

interface VerifyRequest {
  statement: string;
  moduleId?: number;
  metadata?: Record<string, unknown>;
}

interface AttestationResponse {
  success: boolean;
  data?: {
    txHash: string;
    beliefHash: string;
    verified: boolean;
    gasUsed?: string;
    attestationId?: string;
  };
  error?: string;
}

// ============================================================================
// API Server
// ============================================================================

export class VaultfireAPIServer {
  private app: express.Application;
  private sdk: VaultfireSDK;
  private config: APIConfig;
  private signer?: Wallet;

  constructor(config: Partial<APIConfig> = {}) {
    this.config = {
      port: config.port || 3001,
      chain: config.chain || 'base',
      privateKey: config.privateKey || process.env.VAULTFIRE_PRIVATE_KEY,
      rateLimitWindow: config.rateLimitWindow || 15,
      rateLimitMax: config.rateLimitMax || 100,
      webhookUrl: config.webhookUrl || process.env.VAULTFIRE_WEBHOOK_URL,
    };

    this.app = express();
    this.sdk = new VaultfireSDK({ chain: this.config.chain });

    // Connect signer if available
    if (this.config.privateKey) {
      this.signer = new Wallet(this.config.privateKey);
      this.sdk.connect(this.signer);
    }

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(cors());

    // JSON body parser
    this.app.use(express.json({ limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimitWindow! * 60 * 1000,
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

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        chain: this.config.chain,
        timestamp: new Date().toISOString(),
      });
    });

    // Get chain configuration
    this.app.get('/api/v1/config', (_req: Request, res: Response) => {
      try {
        const config = this.sdk.getChainConfig();
        res.json({ success: true, data: config });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get available modules
    this.app.get('/api/v1/modules', async (_req: Request, res: Response) => {
      try {
        const modules = await this.sdk.getModules();
        res.json({ success: true, data: modules });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Verify belief (POST)
    this.app.post('/api/v1/verify', async (req: Request, res: Response) => {
      try {
        const { statement, moduleId = ModuleType.GENERIC, metadata }: VerifyRequest = req.body;

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
        const attestation: BeliefAttestation = {
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

        const response: AttestationResponse = {
          success: true,
          data: {
            txHash: result.txHash!,
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
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Check if belief is sovereign
    this.app.get('/api/v1/sovereign/:beliefHash', async (req: Request, res: Response) => {
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
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get attestations by address
    this.app.get('/api/v1/attestations/:address', async (req: Request, res: Response) => {
      try {
        const { address } = req.params;
        const limit = parseInt(req.query.limit as string) || 100;

        if (!ethers.isAddress(address)) {
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
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Estimate gas
    this.app.post('/api/v1/estimate-gas', async (req: Request, res: Response) => {
      try {
        const { statement, moduleId = ModuleType.GENERIC }: VerifyRequest = req.body;

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
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Hash utility endpoint
    this.app.post('/api/v1/hash', (req: Request, res: Response) => {
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
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
      });
    });
  }

  private async sendWebhook(url: string, payload: unknown): Promise<void> {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Webhook delivery failed:', error);
    }
  }

  start(): void {
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

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const server = new VaultfireAPIServer({
    port: parseInt(process.env.PORT || '3001'),
    chain: (process.env.VAULTFIRE_CHAIN as any) || 'base',
  });

  server.start();
}

export default VaultfireAPIServer;
