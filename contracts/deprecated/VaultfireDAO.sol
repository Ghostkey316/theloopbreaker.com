// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";

/// @title Vaultfire Guardian governance token
/// @notice ERC20Votes token used by guardian council to steer mission evolutions.
contract VaultfireGuardianToken is AccessControl, ERC20Burnable, ERC20Permit, ERC20Votes {
    bytes32 public constant ATTESTOR_ROLE = keccak256("ATTESTOR_ROLE");

    event GuardianAttested(address indexed guardian, uint256 weight, string memo, uint256 newBalance);

    constructor(address admin)
        ERC20("Vaultfire Guardian", "VFG")
        ERC20Permit("Vaultfire Guardian")
    {
        require(admin != address(0), "admin_required");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Mint guardian voting weight to a wallet after an off-chain attestation.
    function attest(address guardian, uint256 weight, string calldata memo)
        external
        onlyRole(ATTESTOR_ROLE)
        returns (uint256 newBalance)
    {
        require(guardian != address(0), "guardian_required");
        require(weight > 0, "weight_required");
        _mint(guardian, weight);
        newBalance = balanceOf(guardian);
        emit GuardianAttested(guardian, weight, memo, newBalance);
    }

    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, amount);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}

/// @title VaultfireDAO
/// @notice Governor contract coordinating guardian votes on mission evolutions.
contract VaultfireDAO is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    /// @notice Threshold in basis points required for mission resonance updates.
    uint256 public constant RESONANCE_APPROVAL_BPS = 5_100;
    VaultfireGuardianToken public immutable guardianToken;
    address public immutable baseOracle;

    event ProposalCreated(uint256 indexed id, address indexed proposer);
    event MissionEvoProposal(
        uint256 indexed id,
        address indexed proposer,
        string[] virtues,
        uint256[] weights,
        string description
    );

    constructor(
        VaultfireGuardianToken token,
        TimelockController timelock,
        address baseOracleAddress
    )
        Governor("VaultfireDAO")
        GovernorSettings(14_400, 50_400, 0)
        GovernorVotes(token)
        GovernorVotesQuorumFraction(4)
        GovernorTimelockControl(timelock)
    {
        require(address(token) != address(0), "token_required");
        require(address(timelock) != address(0), "timelock_required");
        require(baseOracleAddress != address(0), "oracle_required");
        guardianToken = token;
        baseOracle = baseOracleAddress;
    }

    /// @notice Helper that builds and submits a mission evolution proposal targeting the Base oracle.
    function proposeMissionEvo(
        string[] calldata virtues,
        uint256[] calldata weights,
        string calldata description
    ) external returns (uint256 proposalId) {
        require(virtues.length == weights.length, "VaultfireDAO:length");
        require(virtues.length != 0, "VaultfireDAO:empty");

        address[] memory targets = new address[](1);
        targets[0] = baseOracle;

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("publishMissionEvo(string[],uint256[])", virtues, weights);

        proposalId = propose(targets, values, calldatas, description);
        emit MissionEvoProposal(proposalId, _msgSender(), virtues, weights, description);
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor) returns (uint256 proposalId) {
        proposalId = super.propose(targets, values, calldatas, description);
        emit ProposalCreated(proposalId, _msgSender());
    }

    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function _voteSucceeded(uint256 proposalId)
        internal
        view
        override(Governor, GovernorCountingSimple)
        returns (bool)
    {
        (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = super.proposalVotes(proposalId);
        uint256 total = againstVotes + forVotes + abstainVotes;
        if (total == 0) {
            return false;
        }
        return forVotes * 10_000 >= total * RESONANCE_APPROVAL_BPS;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
