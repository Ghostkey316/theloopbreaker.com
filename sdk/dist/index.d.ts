type Intent = Record<string, unknown>;
type PilotRun = {
    wallet: string;
    gradient: number;
    tx: string;
    status: string;
};
export declare class SymbioticForge {
    private wallet;
    private engine;
    private gradient;
    private oracle?;
    constructor(wallet: string, live?: boolean);
    private instantiateWallet;
    private tuneGradient;
    private forgeNeuralCovenant;
    private endToEndTest;
    attestMoralLoop(intent: Intent): Promise<string>;
    runPilotSim(pilotType?: string): Promise<{
        pilot: string;
        runs: PilotRun[];
        oracleTx?: string;
    }>;
}
export default SymbioticForge;
