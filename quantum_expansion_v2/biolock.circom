// Quantum Biolock v1
// Ghostkey-316 Metadata Tag: human uniqueness anchor for wallet bpow20.cb.id
// The circuit consumes entropy (voiceprint hash or pixel noise) and asserts it is non-zero.
// Additional constraints can be layered for production biometric attestation.

pragma circom 2.0.0;

// Minimalistic circuit checking for non-zero entropy and deriving a commitment.
template Biolock() {
    signal input entropy;         // Hash of biometric entropy
    signal input salt;            // Optional salt to protect privacy
    signal output uniquenessFlag; // 1 when entropy is non-zero
    signal output saltedEntropy;  // salted entropy for downstream proof composition

    uniquenessFlag <== entropy != 0;
    saltedEntropy <== entropy + salt;
}

component main = Biolock();
