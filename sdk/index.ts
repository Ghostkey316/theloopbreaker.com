import { ethers, Wallet, toUtf8Bytes, keccak256 } from 'ethers';

type Intent = Record<string, unknown>;

type PilotRun = {
  wallet: string;
  gradient: number;
  tx: string;
  status: string;
};

class MissionResonanceEngine {
  private signals: number[] = [];

  ingest(score: number): void {
    this.signals.push(Math.max(0, Math.min(1, score)));
  }

  resonance(): number {
    if (this.signals.length === 0) {
      return 0;
    }
    const total = this.signals.reduce((acc, value) => acc + value, 0);
    return Number((total / this.signals.length).toFixed(4));
  }
}

class LiveOracleClient {
  emitEvent(cid: string, zkHash: string, context?: Record<string, unknown>): { txHash: string; context?: Record<string, unknown> } {
    const payload = JSON.stringify({ cid, zkHash, context });
    const digest = ethers.id(payload);
    return { txHash: `0x${digest.slice(2, 66)}`, context };
  }
}

function seededRandom(seedKey: string): () => number {
  let seed = Number.parseInt(seedKey.slice(2, 10), 16) || 1;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const normalized = (seed >>> 0) % 1000;
    return normalized / 1000;
  };
}

function deriveProof(intent: Intent | undefined): string {
  const entries = Object.entries(intent ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return ethers.id(JSON.stringify(entries));
}

export class SymbioticForge {
  private wallet: Wallet;
  private engine: MissionResonanceEngine;
  private gradient = 0.5;
  private oracle?: LiveOracleClient;

  constructor(wallet: string, live = false) {
    this.wallet = this.instantiateWallet(wallet);
    this.engine = new MissionResonanceEngine();
    if (live) {
      this.oracle = new LiveOracleClient();
    }
  }

  private instantiateWallet(key: string): Wallet {
    try {
      return new Wallet(key);
    } catch {
      const digest = keccak256(toUtf8Bytes(key));
      return new Wallet(digest);
    }
  }

  private async tuneGradient(intent: Intent): Promise<number> {
    const alpha = Number(intent['alpha_power'] ?? 0.5);
    const theta = String(intent['theta_intent'] ?? 'align');
    let tuned = this.gradient;
    tuned += theta === 'align' ? alpha * 0.2 : -0.1 * (1 - alpha);
    tuned = Math.max(0, Math.min(1, Number(tuned.toFixed(6))));
    this.engine.ingest(tuned);
    this.gradient = tuned;
    return tuned;
  }

  private forgeNeuralCovenant(tuned: number, intent?: Intent): string {
    const proof = String(intent?.['proof'] ?? deriveProof(intent));
    const payload = `${tuned.toFixed(6)}|${proof}`;
    const digest = ethers.id(payload);
    return `0x${digest.slice(2, 66)}`;
  }

  private async endToEndTest(pilotType: string): Promise<PilotRun[]> {
    const baseline = this.gradient;
    const seed = ethers.id(`${pilotType}:${this.wallet.address}`);
    const rng = seededRandom(seed);
    const runs: PilotRun[] = [];
    try {
      for (let index = 0; index < 3; index += 1) {
        const theta = rng() > 0.25 ? 'align' : 'diverge';
        const alpha = Number((0.55 + rng() * 0.35).toFixed(3));
        const intent: Intent = {
          alpha_power: alpha,
          theta_intent: theta,
          proof: `${pilotType}-${index}-${this.wallet.address}`,
        };
        const tx = await this.attestMoralLoop(intent);
        runs.push({
          wallet: `${this.wallet.address}::${pilotType}::${index}`,
          gradient: this.gradient,
          tx,
          status: theta === 'align' ? 'attested' : 'pending',
        });
      }
      return runs;
    } finally {
      this.gradient = baseline;
    }
  }

  async attestMoralLoop(intent: Intent): Promise<string> {
    const tuned = await this.tuneGradient(intent);
    return this.forgeNeuralCovenant(tuned, intent);
  }

  async runPilotSim(pilotType = 'loyalty'): Promise<{ pilot: string; runs: PilotRun[]; oracleTx?: string }> {
    const runs = await this.endToEndTest(pilotType);
    let oracleTx: string | undefined;
    if (this.oracle) {
      const digest = ethers.id(JSON.stringify({ pilot: pilotType, runs }));
      const emission = this.oracle.emitEvent(`sdk::${pilotType}`, digest, { runs: runs.length });
      oracleTx = emission.txHash;
    }
    return { pilot: pilotType, runs, oracleTx };
  }
}

export default SymbioticForge;
