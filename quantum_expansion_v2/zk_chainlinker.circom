// Vaultfire Quantum Expansion Phase 2 - ZK Chainlinker
// Ghostkey-316 Metadata Tag: wallet bpow20.cb.id linkage across Base/Zora/NS3
// This circuit is a prototype intended for illustrating cross-domain identity linking.
// It enforces that the provided identity commitment matches the registered Ghostkey-316 anchor
// and that the requested domain flag is enabled in the witness.

pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

// The circuit expects a Poseidon commitment of the Ghostkey identity and a domain selector.
// Output: signal that validates the identity link for the chosen domain.
template Chainlinker() {
    // Public inputs
    signal input identityCommitment;       // Poseidon(commitment) for Ghostkey-316
    signal input domainFlag;               // 0 = Base, 1 = Zora, 2 = NS3 (encoded as small integer)

    // Private witness
    signal input expectedIdentity;         // The canonical Ghostkey-316 commitment
    signal input allowedDomains[3];        // Boolean flags for enabled domains

    // Internal signals
    signal isIdentityMatch;
    signal isDomainAllowed;

    // Verify identity matches expected commitment
    isIdentityMatch <== identityCommitment === expectedIdentity;

    // Domain allowance check
    isDomainAllowed <== allowedDomains[domainFlag];

    // Export verification result
    signal output linkValid;
    linkValid <== isIdentityMatch * isDomainAllowed;
}

component main = Chainlinker();
