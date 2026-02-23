// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./ITeleporterMessenger.sol";
import "./ITeleporterReceiver.sol";

/**
 * @title VaultfireTeleporterBridge
 * @author Vaultfire Protocol — Build Games 2026
 * @notice Cross-chain trust portability bridge using Avalanche Teleporter (ICM).
 *
 * @dev Enables AI agent trust state to be synchronized between Base mainnet
 * and Avalanche C-Chain. When an agent registers, bonds, earns reputation,
 * or gets validated on one chain, the bridge relays that state to the other
 * chain so the agent's trust is recognized everywhere.
 *
 * Architecture:
 * ┌─────────────┐   Teleporter / Relayer   ┌─────────────┐
 * │  Base Bridge │ ◄─────────────────────► │  Avax Bridge │
 * │  (relayer)   │                          │  (ICM native)│
 * └──────┬───────┘                          └──────┬───────┘
 *        │                                         │
 *   Local Vaultfire                           Local Vaultfire
 *   Contracts (Base)                          Contracts (Avax)
 *
 * On Avalanche C-Chain the bridge implements ITeleporterReceiver for native
 * Teleporter interop with any Avalanche L1.  For Base↔Avalanche transport
 * an authorized off-chain relayer submits messages via `relayMessage()`.
 *
 * Message types:
 *   0 — SYNC_AGENT_REGISTRATION
 *   1 — SYNC_PARTNERSHIP_BOND
 *   2 — SYNC_ACCOUNTABILITY_BOND
 *   3 — SYNC_REPUTATION
 *   4 — SYNC_VALIDATION
 *
 * Security:
 *   • Owner-controlled relayer whitelist
 *   • Nonce-based replay protection
 *   • Source-chain + sender verification
 *   • Pausable for emergency shutdown
 *   • Message hash deduplication
 *
 * @custom:security Access-controlled relayer pattern with replay protection
 * @custom:competition Avalanche Build Games 2026 — first cross-chain trust portability
 */
contract VaultfireTeleporterBridge is ITeleporterReceiver {

    // ═══════════════════════════════════════════════════════════════════════
    //  ENUMS
    // ═══════════════════════════════════════════════════════════════════════

    enum MessageType {
        SYNC_AGENT_REGISTRATION,   // 0
        SYNC_PARTNERSHIP_BOND,     // 1
        SYNC_ACCOUNTABILITY_BOND,  // 2
        SYNC_REPUTATION,           // 3
        SYNC_VALIDATION            // 4
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STRUCTS — Cross-chain payloads
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Envelope that wraps every cross-chain message.
     * @param messageType  Discriminator for payload decoding.
     * @param sourceChainId  EVM chain ID of the originating chain.
     * @param nonce  Per-bridge monotonic nonce for replay protection.
     * @param timestamp  Block timestamp on the source chain.
     * @param sender  Address that initiated the bridge call on the source chain.
     * @param payload  ABI-encoded type-specific data.
     */
    struct BridgeMessage {
        MessageType messageType;
        uint256 sourceChainId;
        uint256 nonce;
        uint256 timestamp;
        address sender;
        bytes payload;
    }

    /// @notice Payload for SYNC_AGENT_REGISTRATION
    struct AgentRegistrationPayload {
        address agentAddress;
        string agentURI;
        string agentType;
        bytes32 capabilitiesHash;
        uint256 registeredAt;
    }

    /// @notice Payload for SYNC_PARTNERSHIP_BOND
    struct PartnershipBondPayload {
        uint256 bondId;
        address human;
        address aiAgent;
        string purpose;
        uint256 createdAt;
        bool active;
    }

    /// @notice Payload for SYNC_ACCOUNTABILITY_BOND
    struct AccountabilityBondPayload {
        uint256 bondId;
        address aiCompany;
        string companyName;
        uint256 quarterlyRevenue;
        uint256 stakeAmount;
        uint256 createdAt;
        bool active;
    }

    /// @notice Payload for SYNC_REPUTATION
    struct ReputationPayload {
        address agentAddress;
        uint256 totalFeedbacks;
        uint256 averageRating;
        uint256 verifiedFeedbacks;
        uint256 lastUpdated;
    }

    /// @notice Payload for SYNC_VALIDATION
    struct ValidationPayload {
        uint256 requestId;
        address agentAddress;
        uint8 status;          // ValidationStatus enum value
        uint256 approvalsCount;
        uint256 rejectionsCount;
        uint256 timestamp;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Contract owner (deployer)
    address public owner;

    /// @notice Whether the bridge is paused
    bool public paused;

    /// @notice Monotonic nonce for outbound messages (replay protection)
    uint256 public outboundNonce;

    /// @notice Address of the Teleporter messenger on this chain (zero on non-Avalanche chains)
    address public teleporterMessenger;

    /// @notice Blockchain ID of the remote chain (Teleporter bytes32 format)
    bytes32 public remoteBlockchainID;

    /// @notice Address of the peer bridge contract on the remote chain
    address public remoteBridgeAddress;

    /// @notice EVM chain ID of the remote chain
    uint256 public remoteChainId;

    /// @notice Required gas limit for Teleporter message execution on destination
    uint256 public requiredGasLimit;

    // ── Relayer whitelist ──────────────────────────────────────────────────
    mapping(address => bool) public authorizedRelayers;
    address[] public relayerList;

    // ── Replay protection ──────────────────────────────────────────────────
    /// @notice Tracks processed message hashes to prevent replay
    mapping(bytes32 => bool) public processedMessages;

    /// @notice Highest inbound nonce seen from the remote chain
    uint256 public lastProcessedNonce;

    // ── Synced state (mirror of remote chain) ──────────────────────────────

    /// @notice Agents synced from remote chain: agentAddress => registration payload
    mapping(address => AgentRegistrationPayload) public syncedAgents;
    address[] public syncedAgentList;

    /// @notice Partnership bonds synced from remote chain: bondId => payload
    mapping(uint256 => PartnershipBondPayload) public syncedPartnershipBonds;
    uint256[] public syncedPartnershipBondIds;

    /// @notice Accountability bonds synced from remote chain: bondId => payload
    mapping(uint256 => AccountabilityBondPayload) public syncedAccountabilityBonds;
    uint256[] public syncedAccountabilityBondIds;

    /// @notice Reputation synced from remote chain: agentAddress => payload
    mapping(address => ReputationPayload) public syncedReputations;
    address[] public syncedReputationAgents;

    /// @notice Validation synced from remote chain: requestId => payload
    mapping(uint256 => ValidationPayload) public syncedValidations;
    uint256[] public syncedValidationIds;

    // ═══════════════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event MessageSent(
        uint256 indexed nonce,
        MessageType indexed messageType,
        bytes32 messageHash,
        uint256 destinationChainId
    );

    event MessageReceived(
        uint256 indexed nonce,
        MessageType indexed messageType,
        bytes32 messageHash,
        uint256 sourceChainId
    );

    event AgentSynced(address indexed agentAddress, string agentType, uint256 sourceChainId);
    event PartnershipBondSynced(uint256 indexed bondId, address human, address aiAgent, uint256 sourceChainId);
    event AccountabilityBondSynced(uint256 indexed bondId, address aiCompany, uint256 sourceChainId);
    event ReputationSynced(address indexed agentAddress, uint256 averageRating, uint256 sourceChainId);
    event ValidationSynced(uint256 indexed requestId, address agentAddress, uint8 status, uint256 sourceChainId);

    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event BridgePaused(address indexed by);
    event BridgeUnpaused(address indexed by);
    event RemoteConfigured(bytes32 remoteBlockchainID, address remoteBridgeAddress, uint256 remoteChainId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ═══════════════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "VaultfireBridge: caller is not the owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "VaultfireBridge: bridge is paused");
        _;
    }

    modifier onlyAuthorizedRelayer() {
        require(authorizedRelayers[msg.sender], "VaultfireBridge: unauthorized relayer");
        _;
    }

    modifier onlyTeleporter() {
        require(
            teleporterMessenger != address(0) && msg.sender == teleporterMessenger,
            "VaultfireBridge: caller is not TeleporterMessenger"
        );
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @param _teleporterMessenger  Address of TeleporterMessenger on this chain.
     *        Set to address(0) on non-Avalanche chains (e.g. Base).
     * @param _requiredGasLimit  Gas limit for Teleporter message execution on the
     *        destination chain.  Recommended: 500_000.
     */
    constructor(address _teleporterMessenger, uint256 _requiredGasLimit) {
        owner = msg.sender;
        teleporterMessenger = _teleporterMessenger;
        requiredGasLimit = _requiredGasLimit;

        // Owner is automatically an authorized relayer
        authorizedRelayers[msg.sender] = true;
        relayerList.push(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ADMIN — Configuration
    // ═══════════════════════════════════════════════════════════════════════

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "VaultfireBridge: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @notice Configure the remote (peer) bridge.
     * @param _remoteBlockchainID  Teleporter blockchain ID of the remote chain.
     *        For non-Avalanche chains use keccak256(abi.encodePacked(chainId)).
     * @param _remoteBridgeAddress  Address of the VaultfireTeleporterBridge on the remote chain.
     * @param _remoteChainId  EVM chain ID of the remote chain.
     */
    function setRemoteBridge(
        bytes32 _remoteBlockchainID,
        address _remoteBridgeAddress,
        uint256 _remoteChainId
    ) external onlyOwner {
        require(_remoteBridgeAddress != address(0), "VaultfireBridge: zero address");
        remoteBlockchainID = _remoteBlockchainID;
        remoteBridgeAddress = _remoteBridgeAddress;
        remoteChainId = _remoteChainId;
        emit RemoteConfigured(_remoteBlockchainID, _remoteBridgeAddress, _remoteChainId);
    }

    function setRequiredGasLimit(uint256 _gasLimit) external onlyOwner {
        requiredGasLimit = _gasLimit;
    }

    function setTeleporterMessenger(address _messenger) external onlyOwner {
        teleporterMessenger = _messenger;
    }

    // ── Relayer management ─────────────────────────────────────────────────

    function addRelayer(address relayer) external onlyOwner {
        require(relayer != address(0), "VaultfireBridge: zero address");
        require(!authorizedRelayers[relayer], "VaultfireBridge: already authorized");
        authorizedRelayers[relayer] = true;
        relayerList.push(relayer);
        emit RelayerAdded(relayer);
    }

    function removeRelayer(address relayer) external onlyOwner {
        require(authorizedRelayers[relayer], "VaultfireBridge: not authorized");
        authorizedRelayers[relayer] = false;
        // Remove from list
        for (uint256 i = 0; i < relayerList.length; i++) {
            if (relayerList[i] == relayer) {
                relayerList[i] = relayerList[relayerList.length - 1];
                relayerList.pop();
                break;
            }
        }
        emit RelayerRemoved(relayer);
    }

    function getRelayerCount() external view returns (uint256) {
        return relayerList.length;
    }

    // ── Pause ──────────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        paused = true;
        emit BridgePaused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit BridgeUnpaused(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  OUTBOUND — Send trust state to remote chain
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Send an agent registration to the remote chain.
     */
    /// @custom:audit-fix HIGH-002 — Added onlyAuthorizedRelayer to prevent arbitrary trust-data injection (2026-02-23)
    function sendAgentRegistration(
        address agentAddress,
        string calldata agentURI,
        string calldata agentType,
        bytes32 capabilitiesHash,
        uint256 registeredAt
    ) external onlyAuthorizedRelayer whenNotPaused returns (uint256 nonce) {
        AgentRegistrationPayload memory payload = AgentRegistrationPayload({
            agentAddress: agentAddress,
            agentURI: agentURI,
            agentType: agentType,
            capabilitiesHash: capabilitiesHash,
            registeredAt: registeredAt
        });
        return _sendMessage(MessageType.SYNC_AGENT_REGISTRATION, abi.encode(payload));
    }

    /**
     * @notice Send a partnership bond to the remote chain.
     */
    /// @custom:audit-fix HIGH-002 — Added onlyAuthorizedRelayer
    function sendPartnershipBond(
        uint256 bondId,
        address human,
        address aiAgent,
        string calldata purpose,
        uint256 createdAt,
        bool active
    ) external onlyAuthorizedRelayer whenNotPaused returns (uint256 nonce) {
        PartnershipBondPayload memory payload = PartnershipBondPayload({
            bondId: bondId,
            human: human,
            aiAgent: aiAgent,
            purpose: purpose,
            createdAt: createdAt,
            active: active
        });
        return _sendMessage(MessageType.SYNC_PARTNERSHIP_BOND, abi.encode(payload));
    }

    /**
     * @notice Send an accountability bond to the remote chain.
     */
    /// @custom:audit-fix HIGH-002 — Added onlyAuthorizedRelayer
    function sendAccountabilityBond(
        uint256 bondId,
        address aiCompany,
        string calldata companyName,
        uint256 quarterlyRevenue,
        uint256 stakeAmount,
        uint256 createdAt,
        bool active
    ) external onlyAuthorizedRelayer whenNotPaused returns (uint256 nonce) {
        AccountabilityBondPayload memory payload = AccountabilityBondPayload({
            bondId: bondId,
            aiCompany: aiCompany,
            companyName: companyName,
            quarterlyRevenue: quarterlyRevenue,
            stakeAmount: stakeAmount,
            createdAt: createdAt,
            active: active
        });
        return _sendMessage(MessageType.SYNC_ACCOUNTABILITY_BOND, abi.encode(payload));
    }

    /**
     * @notice Send a reputation update to the remote chain.
     */
    /// @custom:audit-fix HIGH-002 — Added onlyAuthorizedRelayer
    function sendReputation(
        address agentAddress,
        uint256 totalFeedbacks,
        uint256 averageRating,
        uint256 verifiedFeedbacks,
        uint256 lastUpdated
    ) external onlyAuthorizedRelayer whenNotPaused returns (uint256 nonce) {
        ReputationPayload memory payload = ReputationPayload({
            agentAddress: agentAddress,
            totalFeedbacks: totalFeedbacks,
            averageRating: averageRating,
            verifiedFeedbacks: verifiedFeedbacks,
            lastUpdated: lastUpdated
        });
        return _sendMessage(MessageType.SYNC_REPUTATION, abi.encode(payload));
    }

    /**
     * @notice Send a validation status update to the remote chain.
     */
    /// @custom:audit-fix HIGH-002 — Added onlyAuthorizedRelayer
    function sendValidation(
        uint256 requestId,
        address agentAddress,
        uint8 status,
        uint256 approvalsCount,
        uint256 rejectionsCount,
        uint256 timestamp
    ) external onlyAuthorizedRelayer whenNotPaused returns (uint256 nonce) {
        ValidationPayload memory payload = ValidationPayload({
            requestId: requestId,
            agentAddress: agentAddress,
            status: status,
            approvalsCount: approvalsCount,
            rejectionsCount: rejectionsCount,
            timestamp: timestamp
        });
        return _sendMessage(MessageType.SYNC_VALIDATION, abi.encode(payload));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  INBOUND — Receive trust state from remote chain
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice ITeleporterReceiver implementation — called by TeleporterMessenger
     *         on Avalanche when a native Teleporter message arrives.
     */
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external override onlyTeleporter whenNotPaused {
        require(sourceBlockchainID == remoteBlockchainID, "VaultfireBridge: unknown source chain");
        require(originSenderAddress == remoteBridgeAddress, "VaultfireBridge: unknown sender");
        _processInboundMessage(message);
    }

    /**
     * @notice Relayer-based message delivery for cross-ecosystem bridges
     *         (e.g. Base → Avalanche or Avalanche → Base).
     * @param encodedMessage  The ABI-encoded BridgeMessage.
     */
    function relayMessage(
        bytes calldata encodedMessage
    ) external onlyAuthorizedRelayer whenNotPaused {
        _processInboundMessage(encodedMessage);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  VIEW — Query synced state
    // ═══════════════════════════════════════════════════════════════════════

    function getSyncedAgent(address agent) external view returns (AgentRegistrationPayload memory) {
        return syncedAgents[agent];
    }

    function getSyncedPartnershipBond(uint256 bondId) external view returns (PartnershipBondPayload memory) {
        return syncedPartnershipBonds[bondId];
    }

    function getSyncedAccountabilityBond(uint256 bondId) external view returns (AccountabilityBondPayload memory) {
        return syncedAccountabilityBonds[bondId];
    }

    function getSyncedReputation(address agent) external view returns (ReputationPayload memory) {
        return syncedReputations[agent];
    }

    function getSyncedValidation(uint256 requestId) external view returns (ValidationPayload memory) {
        return syncedValidations[requestId];
    }

    function getSyncedAgentCount() external view returns (uint256) {
        return syncedAgentList.length;
    }

    function getSyncedPartnershipBondCount() external view returns (uint256) {
        return syncedPartnershipBondIds.length;
    }

    function getSyncedAccountabilityBondCount() external view returns (uint256) {
        return syncedAccountabilityBondIds.length;
    }

    function getSyncedReputationCount() external view returns (uint256) {
        return syncedReputationAgents.length;
    }

    function getSyncedValidationCount() external view returns (uint256) {
        return syncedValidationIds.length;
    }

    /**
     * @notice Check if an agent is recognized on this chain (either native or synced).
     */
    function isAgentRecognized(address agent) external view returns (bool) {
        return syncedAgents[agent].agentAddress != address(0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  INTERNAL — Message construction & processing
    // ═══════════════════════════════════════════════════════════════════════

    function _sendMessage(
        MessageType messageType,
        bytes memory payload
    ) internal returns (uint256 nonce) {
        require(remoteBridgeAddress != address(0), "VaultfireBridge: remote not configured");

        nonce = ++outboundNonce;

        BridgeMessage memory bridgeMsg = BridgeMessage({
            messageType: messageType,
            sourceChainId: block.chainid,
            nonce: nonce,
            timestamp: block.timestamp,
            sender: msg.sender,
            payload: payload
        });

        bytes memory encoded = abi.encode(bridgeMsg);
        bytes32 msgHash = keccak256(encoded);

        // If Teleporter is available, send via native ICM
        if (teleporterMessenger != address(0)) {
            _sendViaTeleporter(encoded);
        }
        // Otherwise the off-chain relayer picks up the event

        emit MessageSent(nonce, messageType, msgHash, remoteChainId);
    }

    function _sendViaTeleporter(bytes memory encoded) internal {
        TeleporterMessageInput memory input = TeleporterMessageInput({
            destinationBlockchainID: remoteBlockchainID,
            destinationAddress: remoteBridgeAddress,
            feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
            requiredGasLimit: requiredGasLimit,
            allowedRelayerAddresses: new address[](0),
            message: encoded
        });

        ITeleporterMessenger(teleporterMessenger).sendCrossChainMessage(input);
    }

    function _processInboundMessage(bytes calldata encoded) internal {
        BridgeMessage memory bridgeMsg = abi.decode(encoded, (BridgeMessage));

        // Replay protection: check message hash
        bytes32 msgHash = keccak256(encoded);
        require(!processedMessages[msgHash], "VaultfireBridge: message already processed");
        processedMessages[msgHash] = true;

        // Nonce ordering check (allow out-of-order but track highest)
        if (bridgeMsg.nonce > lastProcessedNonce) {
            lastProcessedNonce = bridgeMsg.nonce;
        }

        // Source chain verification
        require(bridgeMsg.sourceChainId == remoteChainId, "VaultfireBridge: wrong source chain");

        // Route to type-specific handler
        if (bridgeMsg.messageType == MessageType.SYNC_AGENT_REGISTRATION) {
            _handleAgentRegistration(bridgeMsg);
        } else if (bridgeMsg.messageType == MessageType.SYNC_PARTNERSHIP_BOND) {
            _handlePartnershipBond(bridgeMsg);
        } else if (bridgeMsg.messageType == MessageType.SYNC_ACCOUNTABILITY_BOND) {
            _handleAccountabilityBond(bridgeMsg);
        } else if (bridgeMsg.messageType == MessageType.SYNC_REPUTATION) {
            _handleReputation(bridgeMsg);
        } else if (bridgeMsg.messageType == MessageType.SYNC_VALIDATION) {
            _handleValidation(bridgeMsg);
        } else {
            revert("VaultfireBridge: unknown message type");
        }

        emit MessageReceived(
            bridgeMsg.nonce,
            bridgeMsg.messageType,
            msgHash,
            bridgeMsg.sourceChainId
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  INTERNAL — Type-specific handlers
    // ═══════════════════════════════════════════════════════════════════════

    function _handleAgentRegistration(BridgeMessage memory bridgeMsg) internal {
        AgentRegistrationPayload memory p = abi.decode(bridgeMsg.payload, (AgentRegistrationPayload));
        require(p.agentAddress != address(0), "VaultfireBridge: zero agent address");

        // Store if new; update if existing
        if (syncedAgents[p.agentAddress].agentAddress == address(0)) {
            syncedAgentList.push(p.agentAddress);
        }
        syncedAgents[p.agentAddress] = p;

        emit AgentSynced(p.agentAddress, p.agentType, bridgeMsg.sourceChainId);
    }

    function _handlePartnershipBond(BridgeMessage memory bridgeMsg) internal {
        PartnershipBondPayload memory p = abi.decode(bridgeMsg.payload, (PartnershipBondPayload));

        if (syncedPartnershipBonds[p.bondId].bondId == 0) {
            syncedPartnershipBondIds.push(p.bondId);
        }
        syncedPartnershipBonds[p.bondId] = p;

        emit PartnershipBondSynced(p.bondId, p.human, p.aiAgent, bridgeMsg.sourceChainId);
    }

    function _handleAccountabilityBond(BridgeMessage memory bridgeMsg) internal {
        AccountabilityBondPayload memory p = abi.decode(bridgeMsg.payload, (AccountabilityBondPayload));

        if (syncedAccountabilityBonds[p.bondId].bondId == 0) {
            syncedAccountabilityBondIds.push(p.bondId);
        }
        syncedAccountabilityBonds[p.bondId] = p;

        emit AccountabilityBondSynced(p.bondId, p.aiCompany, bridgeMsg.sourceChainId);
    }

    function _handleReputation(BridgeMessage memory bridgeMsg) internal {
        ReputationPayload memory p = abi.decode(bridgeMsg.payload, (ReputationPayload));
        require(p.agentAddress != address(0), "VaultfireBridge: zero agent address");

        if (syncedReputations[p.agentAddress].agentAddress == address(0)) {
            syncedReputationAgents.push(p.agentAddress);
        }
        syncedReputations[p.agentAddress] = p;

        emit ReputationSynced(p.agentAddress, p.averageRating, bridgeMsg.sourceChainId);
    }

    function _handleValidation(BridgeMessage memory bridgeMsg) internal {
        ValidationPayload memory p = abi.decode(bridgeMsg.payload, (ValidationPayload));

        if (syncedValidations[p.requestId].requestId == 0) {
            syncedValidationIds.push(p.requestId);
        }
        syncedValidations[p.requestId] = p;

        emit ValidationSynced(p.requestId, p.agentAddress, p.status, bridgeMsg.sourceChainId);
    }
}
