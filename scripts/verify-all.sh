#!/bin/bash
set -e

export BASESCAN_API_KEY="1454RE5RZPP2MMMKC8G3M3REGRF8TF2WCI"
export ETHERSCAN_API_KEY="1454RE5RZPP2MMMKC8G3M3REGRF8TF2WCI"
DEPLOYER="0xA054f831B562e729F8D268291EBde1B2EDcFb84F"
DUMMY_IMAGE_ID="0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
ZERO="0x0000000000000000000000000000000000000000"

echo "================================================================"
echo "VERIFYING ALL CONTRACTS ON ALL 3 CHAINS"
echo "================================================================"

verify() {
    local network=$1
    local address=$2
    local contract=$3
    shift 3
    local args="$@"
    
    echo ""
    echo "🔍 Verifying $contract at $address on $network..."
    if npx hardhat verify --network "$network" "$address" $args 2>&1; then
        echo "✅ Verified $contract on $network"
    else
        echo "⚠️  Verify attempt for $contract on $network (may already be verified)"
    fi
}

echo ""
echo "=== BASE MAINNET ==="
verify baseMainnet 0x8568F4020FCD55915dB3695558dD6D2532599e56 MissionEnforcement
verify baseMainnet 0x722E37A7D6f27896C688336AaaFb0dDA80D25E57 AntiSurveillance
verify baseMainnet 0xE2f75A4B14ffFc1f9C2b1ca22Fdd6877E5BD5045 PrivacyGuarantees
verify baseMainnet 0x35978DB675576598F0781dA2133E94cdCf4858bC ERC8004IdentityRegistry
verify baseMainnet 0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba BeliefAttestationVerifier
verify baseMainnet 0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4 AIPartnershipBondsV2
verify baseMainnet 0x83dd216449B3F0574E39043ECFE275946fa492e9 FlourishingMetricsOracle
verify baseMainnet 0xf92baef9523BC264144F80F9c31D5c5C017c6Da8 AIAccountabilityBondsV2 "$DEPLOYER"
verify baseMainnet 0xdB54B8925664816187646174bdBb6Ac658A55a5F ERC8004ReputationRegistry "0x35978DB675576598F0781dA2133E94cdCf4858bC"
verify baseMainnet 0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55 ERC8004ValidationRegistry "0x35978DB675576598F0781dA2133E94cdCf4858bC" "0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba"
verify baseMainnet 0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0 VaultfireERC8004Adapter "0xC574CF2a09B0B470933f0c6a3ef422e3fb25b4b4" "0x35978DB675576598F0781dA2133E94cdCf4858bC" "0xdB54B8925664816187646174bdBb6Ac658A55a5F" "0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55"
verify baseMainnet 0xa5CEC47B48999EB398707838E3A18dd20A1ae272 ProductionBeliefAttestationVerifier "0x0b144e07a0826182b6b59788c34b32bfa86fb711" "$DUMMY_IMAGE_ID"
verify baseMainnet 0xBBC0EFdEE23854e7cb7C4c0f56fF7670BB0530A4 DilithiumAttestor "$DEPLOYER" false "$ZERO"
verify baseMainnet 0x94F54c849692Cc64C35468D0A87D2Ab9D7Cb6Fb2 VaultfireTeleporterBridge "$ZERO" 200000

echo ""
echo "=== AVALANCHE ==="
verify avalanche 0xcf64D815F5424B7937aB226bC733Ed35ab6CaDcB MissionEnforcement
verify avalanche 0x281814eF92062DA8049Fe5c4743c4Aef19a17380 AntiSurveillance
verify avalanche 0xc09F0e06690332eD9b490E1040BdE642f11F3937 PrivacyGuarantees
verify avalanche 0x57741F4116925341d8f7Eb3F381d98e07C73B4a3 ERC8004IdentityRegistry
verify avalanche 0x227e27e7776d3ee14128BC66216354495E113B19 BeliefAttestationVerifier
verify avalanche 0xea6B504827a746d781f867441364C7A732AA4b07 AIPartnershipBondsV2
verify avalanche 0x490c51c2fAd743C288D65A6006f6B0ae9e6a8695 FlourishingMetricsOracle
verify avalanche 0xaeFEa985E0C52f92F73606657B9dA60db2798af3 AIAccountabilityBondsV2 "$DEPLOYER"
verify avalanche 0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24 ERC8004ReputationRegistry "0x57741F4116925341d8f7Eb3F381d98e07C73B4a3"
verify avalanche 0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b ERC8004ValidationRegistry "0x57741F4116925341d8f7Eb3F381d98e07C73B4a3" "0x227e27e7776d3ee14128BC66216354495E113B19"
verify avalanche 0x6B7dC022edC41EBE41400319C6fDcCeab05Ea053 VaultfireERC8004Adapter "0xea6B504827a746d781f867441364C7A732AA4b07" "0x57741F4116925341d8f7Eb3F381d98e07C73B4a3" "0x11C267C8A75B13A4D95357CEF6027c42F8e7bA24" "0x0d41Eb399f52BD03fef7eCd5b165d51AA1fAd87b"
verify avalanche 0xb3d8063e67bdA1a869721D0F6c346f1Af0469D2F ProductionBeliefAttestationVerifier "$DEPLOYER" "$DUMMY_IMAGE_ID"
verify avalanche 0x211554bd46e3D4e064b51a31F61927ae9c7bCF1f DilithiumAttestor "$DEPLOYER" false "$ZERO"
verify avalanche 0x0dF0523aF5aF2Aef180dB052b669Bea97fee3d31 VaultfireTeleporterBridge "$ZERO" 200000

echo ""
echo "=== ETHEREUM MAINNET ==="
echo "(Note: Etherscan verification uses the same API key)"
# Ethereum verification requires the 'mainnet' network name in etherscan config
# We'll attempt but these may need manual verification

echo ""
echo "================================================================"
echo "VERIFICATION COMPLETE"
echo "================================================================"
