// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import {ProductionBeliefAttestationVerifier} from "../src/ProductionBeliefAttestationVerifier.sol";

/// @title SubmitProof
/// @notice Foundry script to submit a proof to the ProductionBeliefAttestationVerifier.
///
/// Usage:
///   forge script script/SubmitProof.s.sol:SubmitProof \
///     --rpc-url $BASE_RPC_URL \
///     --broadcast \
///     -vvvv
///
/// Required environment variables:
///   DEPLOYER_PRIVATE_KEY   — Private key of the submitting account.
///   VERIFIER_ADDRESS       — Address of the deployed ProductionBeliefAttestationVerifier.
///   PROOF_SEAL_HEX         — Hex-encoded seal from the prover (0x-prefixed).
///   PROOF_JOURNAL_HEX      — Hex-encoded journal from the prover (0x-prefixed).
contract SubmitProof is Script {
    function run() external {
        uint256 deployerKey    = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address verifierAddr   = vm.envAddress("VERIFIER_ADDRESS");
        bytes memory seal      = vm.envBytes("PROOF_SEAL_HEX");
        bytes memory journal   = vm.envBytes("PROOF_JOURNAL_HEX");

        ProductionBeliefAttestationVerifier verifier =
            ProductionBeliefAttestationVerifier(verifierAddr);

        vm.startBroadcast(deployerKey);

        bool success = verifier.verifyAttestation(seal, journal);

        vm.stopBroadcast();

        if (success) {
            console.log("=== Attestation Verified Successfully ===");
            console.log("Verifier:        ", verifierAddr);
            console.log("Attestation count:", verifier.attestationCount());
        } else {
            console.log("=== Attestation Verification Failed ===");
        }
    }
}
