// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title CovenantFlame
/// @notice Records the ignition path for Vaultfire Chapter 3 deployments.
/// @dev Lightweight anchor that emits provenance for belief oracle + vow deployments.
contract CovenantFlame {
    /// @notice Address that initiated the covenant ignition.
    address public immutable igniter;

    /// @notice Human-readable echo for Ghostkey316 provenance tracking.
    address public immutable ghostEcho;

    /// @notice Last recorded BeliefOracle implementation.
    address public beliefOracle;

    /// @notice Last recorded FreedomVow implementation.
    address public freedomVow;

    event CovenantForged(address indexed igniter, address indexed oracle, address indexed vow);
    event CovenantCleared(address indexed caller);

    error OnlyIgniter();
    error AddressRequired();

    constructor(address echo) {
        if (echo == address(0)) {
            revert AddressRequired();
        }
        igniter = msg.sender;
        ghostEcho = echo;
    }

    /// @notice Persist the deployed oracle + vow contract addresses.
    /// @param oracle Address of the deployed BeliefOracle contract.
    /// @param vow Address of the deployed FreedomVow contract.
    function recordIgnition(address oracle, address vow) external {
        if (msg.sender != igniter) {
            revert OnlyIgniter();
        }
        if (oracle == address(0) || vow == address(0)) {
            revert AddressRequired();
        }
        beliefOracle = oracle;
        freedomVow = vow;
        emit CovenantForged(msg.sender, oracle, vow);
    }

    /// @notice Reset stored addresses without redeploying the contract.
    function clearIgnition() external {
        if (msg.sender != igniter) {
            revert OnlyIgniter();
        }
        beliefOracle = address(0);
        freedomVow = address(0);
        emit CovenantCleared(msg.sender);
    }

    /// @notice Convenience summary for off-chain guardians.
    /// @return igniterAddress Covenant igniter, oracleAddress latest BeliefOracle, vowAddress latest FreedomVow.
    function covenantSummary()
        external
        view
        returns (address igniterAddress, address oracleAddress, address vowAddress)
    {
        return (igniter, beliefOracle, freedomVow);
    }
}
