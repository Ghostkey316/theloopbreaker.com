"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbioticForge = void 0;
const ethers_1 = require("ethers");
class MissionResonanceEngine {
    constructor() {
        this.signals = [];
    }
    ingest(score) {
        this.signals.push(Math.max(0, Math.min(1, score)));
    }
    resonance() {
        if (this.signals.length === 0) {
            return 0;
        }
        const total = this.signals.reduce((acc, value) => acc + value, 0);
        return Number((total / this.signals.length).toFixed(4));
    }
}
class LiveOracleClient {
    emitEvent(cid, zkHash, context) {
        const payload = JSON.stringify({ cid, zkHash, context });
        const digest = ethers_1.ethers.id(payload);
        return { txHash: `0x${digest.slice(2, 66)}`, context };
    }
}
function seededRandom(seedKey) {
    let seed = Number.parseInt(seedKey.slice(2, 10), 16) || 1;
    return () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        const normalized = (seed >>> 0) % 1000;
        return normalized / 1000;
    };
}
function deriveProof(intent) {
    const entries = Object.entries(intent ?? {}).sort(([a], [b]) => a.localeCompare(b));
    return ethers_1.ethers.id(JSON.stringify(entries));
}
class SymbioticForge {
    constructor(wallet, live = false) {
        this.gradient = 0.5;
        this.wallet = this.instantiateWallet(wallet);
        this.engine = new MissionResonanceEngine();
        if (live) {
            this.oracle = new LiveOracleClient();
        }
    }
    instantiateWallet(key) {
        try {
            return new ethers_1.Wallet(key);
        }
        catch {
            const digest = (0, ethers_1.keccak256)((0, ethers_1.toUtf8Bytes)(key));
            return new ethers_1.Wallet(digest);
        }
    }
    async tuneGradient(intent) {
        const alpha = Number(intent['alpha_power'] ?? 0.5);
        const theta = String(intent['theta_intent'] ?? 'align');
        let tuned = this.gradient;
        tuned += theta === 'align' ? alpha * 0.2 : -0.1 * (1 - alpha);
        tuned = Math.max(0, Math.min(1, Number(tuned.toFixed(6))));
        this.engine.ingest(tuned);
        this.gradient = tuned;
        return tuned;
    }
    forgeNeuralCovenant(tuned, intent) {
        const proof = String(intent?.['proof'] ?? deriveProof(intent));
        const payload = `${tuned.toFixed(6)}|${proof}`;
        const digest = ethers_1.ethers.id(payload);
        return `0x${digest.slice(2, 66)}`;
    }
    async endToEndTest(pilotType) {
        const baseline = this.gradient;
        const seed = ethers_1.ethers.id(`${pilotType}:${this.wallet.address}`);
        const rng = seededRandom(seed);
        const runs = [];
        try {
            for (let index = 0; index < 3; index += 1) {
                const theta = rng() > 0.25 ? 'align' : 'diverge';
                const alpha = Number((0.55 + rng() * 0.35).toFixed(3));
                const intent = {
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
        }
        finally {
            this.gradient = baseline;
        }
    }
    async attestMoralLoop(intent) {
        const tuned = await this.tuneGradient(intent);
        return this.forgeNeuralCovenant(tuned, intent);
    }
    async runPilotSim(pilotType = 'loyalty') {
        const runs = await this.endToEndTest(pilotType);
        let oracleTx;
        if (this.oracle) {
            const digest = ethers_1.ethers.id(JSON.stringify({ pilot: pilotType, runs }));
            const emission = this.oracle.emitEvent(`sdk::${pilotType}`, digest, { runs: runs.length });
            oracleTx = emission.txHash;
        }
        return { pilot: pilotType, runs, oracleTx };
    }
}
exports.SymbioticForge = SymbioticForge;
exports.default = SymbioticForge;
