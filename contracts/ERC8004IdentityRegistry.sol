// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./PrivacyGuarantees.sol";
import "./MissionEnforcement.sol";

/**
 * @title ERC-8004 Identity Registry for VaultFire
 * @notice Sovereign, portable AI agent identities with privacy guarantees
 * @dev Implements ERC-8004 standard for trustless agent discovery
 *
 * **Mission Alignment:**
 * - No KYC: Wallet addresses only (privacy-first)
 * - Self-sovereign identity: Agents control their own metadata
 * - Portable reputation: Works across all ERC-8004 platforms
 * - Privacy over surveillance: ZK-compatible agent cards
 *
 * **ERC-8004 Compliance:**
 * Identity Registry component for trustless agent discovery and verification
 * Agents register on-chain with metadata URI pointing to off-chain agent card
 *
 * @custom:security Inherits PrivacyGuarantees and MissionEnforcement
 * @custom:ethics No identity collection - wallet addresses only
 */
contract ERC8004IdentityRegistry is PrivacyGuarantees, MissionEnforcement {

    struct AgentIdentity {
        address agentAddress;
        string agentURI;           // Off-chain agent card (JSON schema)
        uint256 registeredAt;
        bool active;
        string agentType;          // e.g., "AI Assistant", "Trading Bot", "Research Agent"
        bytes32 capabilitiesHash;  // Hash of capabilities for quick lookup
    }

    // Agent address => Identity
    mapping(address => AgentIdentity) public agents;

    // Track all registered agent addresses
    address[] public registeredAgents;

    // Capability hash => agent addresses (for discovery)
    mapping(bytes32 => address[]) public agentsByCapability;

    event AgentRegistered(
        address indexed agentAddress,
        string agentURI,
        string agentType,
        bytes32 capabilitiesHash,
        uint256 timestamp
    );

    event AgentUpdated(
        address indexed agentAddress,
        string newAgentURI,
        uint256 timestamp
    );

    event AgentDeactivated(
        address indexed agentAddress,
        uint256 timestamp
    );

    /**
     * @notice Register an AI agent with ERC-8004 identity
     * @param agentURI Off-chain URI to agent card (JSON with capabilities, protocols, contact info)
     * @param agentType Human-readable agent type
     * @param capabilitiesHash Hash of agent capabilities for discovery
     * @dev Agent card schema should follow ERC-8004 standard format
     */
    function registerAgent(
        string calldata agentURI,
        string calldata agentType,
        bytes32 capabilitiesHash
    ) external {
        require(bytes(agentURI).length > 0, "Agent URI required");
        require(bytes(agentType).length > 0, "Agent type required");
        require(!agents[msg.sender].active, "Agent already registered");

        agents[msg.sender] = AgentIdentity({
            agentAddress: msg.sender,
            agentURI: agentURI,
            registeredAt: block.timestamp,
            active: true,
            agentType: agentType,
            capabilitiesHash: capabilitiesHash
        });

        registeredAgents.push(msg.sender);
        agentsByCapability[capabilitiesHash].push(msg.sender);

        emit AgentRegistered(
            msg.sender,
            agentURI,
            agentType,
            capabilitiesHash,
            block.timestamp
        );
    }

    /**
     * @notice Update agent metadata URI
     * @param newAgentURI New URI to updated agent card
     */
    function updateAgentURI(string calldata newAgentURI) external {
        require(agents[msg.sender].active, "Agent not registered");
        require(bytes(newAgentURI).length > 0, "Agent URI required");

        agents[msg.sender].agentURI = newAgentURI;

        emit AgentUpdated(msg.sender, newAgentURI, block.timestamp);
    }

    /**
     * @notice Deactivate agent registration
     * @dev Agent can reactivate by registering again
     */
    function deactivateAgent() external {
        require(agents[msg.sender].active, "Agent not registered");

        agents[msg.sender].active = false;

        emit AgentDeactivated(msg.sender, block.timestamp);
    }

    /**
     * @notice Get agent identity details
     * @param agentAddress Address of the agent
     * @return agentURI URI to agent card
     * @return active Whether agent is currently active
     * @return agentType Type of agent
     * @return registeredAt Registration timestamp
     */
    function getAgent(address agentAddress)
        external
        view
        returns (
            string memory agentURI,
            bool active,
            string memory agentType,
            uint256 registeredAt
        )
    {
        AgentIdentity memory identity = agents[agentAddress];
        return (
            identity.agentURI,
            identity.active,
            identity.agentType,
            identity.registeredAt
        );
    }

    /**
     * @notice Discover agents by capability
     * @param capabilitiesHash Hash of desired capabilities
     * @return Array of agent addresses with matching capabilities
     */
    function discoverAgentsByCapability(bytes32 capabilitiesHash)
        external
        view
        returns (address[] memory)
    {
        return agentsByCapability[capabilitiesHash];
    }

    /**
     * @notice Get total number of registered agents
     * @return count Total registered agents (including inactive)
     */
    function getTotalAgents() external view returns (uint256 count) {
        return registeredAgents.length;
    }

    /**
     * @notice Check if agent is registered and active
     * @param agentAddress Address to check
     * @return Whether agent is active
     */
    function isAgentActive(address agentAddress) external view returns (bool) {
        return agents[agentAddress].active;
    }
}
