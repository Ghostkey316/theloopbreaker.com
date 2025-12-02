// Guardian Ring circuit for Vaultfire Quantum Defense
// Utilises Poseidon hash to align spine, yield receipt, and loop nonce commitments

pragma circom 2.1.4;

include "circomlib/poseidon.circom";

template GuardianRing() {
    // Public inputs representing the attested state of the Vaultfire spine
    signal input spine_hash;
    signal input yield_receipt;
    signal input loop_nonce;

    // Output commitment binding the inputs together
    signal output alignment;

    // Poseidon hash is selected for speed and succinct constraints
    component poseidon = Poseidon(3);
    poseidon.inputs[0] <== spine_hash;
    poseidon.inputs[1] <== yield_receipt;
    poseidon.inputs[2] <== loop_nonce;

    // Expose the Poseidon commitment as the alignment proof anchor
    alignment <== poseidon.out;
}

// Default entrypoint
component main = GuardianRing();
