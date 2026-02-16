// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import {ProductionBeliefAttestationVerifier} from "../src/ProductionBeliefAttestationVerifier.sol";

/// @title DeployProductionVerifier
/// @notice Foundry deployment script for the ProductionBeliefAttestationVerifier.
///
/// Usage:
///   forge script script/Deploy.s.sol:DeployProductionVerifier \
///     --rpc-url $BASE_RPC_URL \
///     --broadcast \
///     --verify \
///     --etherscan-api-key $BASESCAN_API_KEY \
///     -vvvv
///
/// Required environment variables:
///   DEPLOYER_PRIVATE_KEY   — Private key of the deploying account.
///   IMAGE_ID               — Image ID of the compiled guest program (bytes32 hex).
///   RISC_ZERO_VERIFIER     — (Optional) Override the verifier address.
///                            Defaults to the Base Mainnet RiscZeroVerifierRouter.
contract DeployProductionVerifier is Script {
    /// @dev RiscZeroVerifierRouter on Base Mainnet (chain ID 8453).
    address constant BASE_MAINNET_VERIFIER =
        0x0b144e07a0826182b6b59788c34b32bfa86fb711;

    function run() external {
        // ---- Read environment variables ----
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        bytes32 imageId     = vm.envBytes32("IMAGE_ID");

        address verifierAddr = vm.envOr(
            "RISC_ZERO_VERIFIER",
            BASE_MAINNET_VERIFIER
        );

        // ---- Deploy ----
        vm.startBroadcast(deployerKey);

        ProductionBeliefAttestationVerifier verifier =
            new ProductionBeliefAttestationVerifier(verifierAddr, imageId);

        vm.stopBroadcast();

        // ---- Log deployment info ----
        console.log("=== Deployment Complete ===");
        console.log("ProductionBeliefAttestationVerifier:", address(verifier));
        console.log("RiscZeroVerifier:                   ", verifierAddr);
        console.log("Image ID:                           ");
        console.logBytes32(imageId);
        console.log("Owner:                              ", verifier.owner());
        console.log("Chain ID:                           ", block.chainid);
    }
}
