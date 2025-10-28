import { Contract, InterfaceAbi, JsonRpcProvider, Wallet, ethers } from "ethers";

export type MissionWeights = Record<string, number>;
export type DaoStreamEmitter = (payload: Record<string, unknown>) => void;

const DEFAULT_ABI: InterfaceAbi = [
  "function proposeMissionEvo(string[] virtues, uint256[] weights, string description) returns (uint256)",
  "function castVote(uint256 proposalId, uint8 support)",
];

export class VaultfireDAO {
  private readonly contract: Contract;
  private readonly emitter?: DaoStreamEmitter;

  constructor(contract: Contract, emitter?: DaoStreamEmitter) {
    this.contract = contract;
    this.emitter = emitter;
  }

  static connect(address: string, signerOrProvider: ethers.Signer | ethers.Provider, abi: InterfaceAbi = DEFAULT_ABI, emitter?: DaoStreamEmitter): VaultfireDAO {
    const contract = new Contract(address, abi, signerOrProvider);
    return new VaultfireDAO(contract, emitter);
  }

  async proposeEvo(weights: MissionWeights, description = "Vaultfire mission evolution"): Promise<ethers.TransactionResponse> {
    const { virtues, scaled } = this.prepareWeights(weights);
    const tx = await this.contract.proposeMissionEvo(virtues, scaled, description);
    this.emit("propose", tx.hash, { virtues, weights, description });
    return tx;
  }

  async voteOnProposal(proposalId: bigint | number, support: boolean): Promise<ethers.TransactionResponse> {
    const supportFlag = support ? 1 : 0;
    const id = typeof proposalId === "bigint" ? proposalId : BigInt(proposalId);
    const tx = await this.contract.castVote(id, supportFlag);
    this.emit("vote", tx.hash, { proposalId: id, support: supportFlag });
    return tx;
  }

  private prepareWeights(weights: MissionWeights): { virtues: string[]; scaled: bigint[] } {
    const entries = Object.entries(weights);
    if (!entries.length) {
      throw new Error("weights must include at least one virtue");
    }
    const virtues: string[] = [];
    const scaled: bigint[] = [];
    for (const [virtue, raw] of entries) {
      if (!virtue) {
        throw new Error("virtue names must be non-empty strings");
      }
      virtues.push(virtue);
      scaled.push(this.scaleWeight(raw));
    }
    return { virtues, scaled };
  }

  private scaleWeight(value: number): bigint {
    if (!Number.isFinite(value)) {
      throw new Error("weight must be a finite number");
    }
    if (value > 1) {
      return BigInt(Math.trunc(value));
    }
    const scaled = Math.round(value * 10_000);
    if (scaled <= 0) {
      throw new Error("weight must be positive");
    }
    return BigInt(scaled);
  }

  private emit(action: string, tx: string, context: Record<string, unknown>): void {
    if (!this.emitter) {
      return;
    }
    this.emitter({ dao_vote: { action, tx, ...context } });
  }
}

export async function buildWallet(rpcUrl: string, privateKey: string): Promise<Wallet> {
  const provider = new JsonRpcProvider(rpcUrl);
  return new Wallet(privateKey, provider);
}
