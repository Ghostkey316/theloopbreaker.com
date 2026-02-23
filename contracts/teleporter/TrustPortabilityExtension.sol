// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./ITeleporterMessenger.sol";
import "./ITeleporterReceiver.sol";

/**
 * @title TrustPortabilityExtension
 * @author Vaultfire Protocol — Security Audit Enhancement 2026
 * @notice Cross-chain trust portability layer for the Vaultfire Protocol.
 *
 * @dev This contract extends the VaultfireTeleporterBridge with three critical
 *      trust-data message types that were missing from the original implementation:
 *
 *      1. SYNC_TRUST_TIER     — Computed trust tier (Exemplary/Highly Trusted/Trusted/
 *                               Registered/Unverified) + raw score, synced cross-chain
 *                               so an agent verified on Base is recognized on Avalanche
 *                               without re-staking.
 *
 *      2. SYNC_VNS_IDENTITY   — VNS name (.vns) ↔ address binding, expiry, and identity
 *                               type (Human/AI Agent/Companion), relayed via Teleporter
 *                               so VNS names resolve on all chains.
 *
 *      3. SYNC_ZK_ATTESTATION — On-chain ZK proof attestation results (isBeliefSovereign),
 *                               allowing a ZK-verified belief on one chain to be recognized
 *                               on all chains without re-proving.
 *
 * Architecture:
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │                    Cross-Chain Trust Flow                            │
 * │                                                                      │
 * │  Base Chain                        Avalanche Chain                  │
 * │  ──────────                        ────────────────                 │
 * │  Agent earns Exemplary tier   ──►  TrustPortabilityExtension        │
 * │  VNS: alice.vns registered    ──►  receives SYNC_TRUST_TIER         │
 * │  ZK proof: belief attested    ──►  receives SYNC_VNS_IDENTITY       │
 * │                                    receives SYNC_ZK_ATTESTATION     │
 * │                                    ↓                                │
 * │                                    isTrustTierRecognized(alice)     │
 * │                                    → true (Exemplary, score=95)     │
 * │                                    resolveVNS("alice.vns")          │
 * │                                    → alice's address                │
 * │                                    isBeliefAttested(beliefHash)     │
 * │                                    → true (ZK-verified on Base)     │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Security:
 *   • onlyAuthorizedRelayer on all send functions (prevents fake trust injection)
 *   • Replay protection via message hash deduplication
 *   • Source chain verification on receive
 *   • Pausable for emergency shutdown
 *   • Trust tier attestations include source chain ID for auditability
 *   • VNS expiry is enforced — expired names do not resolve cross-chain
 *
 * @custom:audit-enhancement ENHANCEMENT-001 — Cross-chain trust portability (2026-02-23)
 * @custom:competition Avalanche Build Games 2026 — "Write Once, Trust Everywhere"
 */
contract TrustPortabilityExtension is ITeleporterReceiver {

    // ═══════════════════════════════════════════════════════════════════════
    //  ENUMS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Trust tier levels matching the off-chain computation in TrustVerification.tsx
    enum TrustTier {
        Unverified,     // 0 — score < 15
        Registered,     // 1 — score 15–39
        Trusted,        // 2 — score 40–59
        HighlyTrusted,  // 3 — score 60–79
        Exemplary       // 4 — score >= 80
    }

    /// @notice VNS identity type
    enum IdentityType {
        Human,      // 0
        AIAgent,    // 1
        Companion   // 2
    }

    /// @notice Extended message types for trust portability
    enum TrustMessageType {
        SYNC_TRUST_TIER,       // 0 — trust tier + score
        SYNC_VNS_IDENTITY,     // 1 — VNS name ↔ address binding
        SYNC_ZK_ATTESTATION    // 2 — ZK proof attestation result
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Envelope for all trust portability messages
    struct TrustMessage {
        TrustMessageType messageType;
        uint256 sourceChainId;
        uint256 nonce;
        uint256 timestamp;
        address sender;
        bytes payload;
    }

    /// @notice Payload for SYNC_TRUST_TIER
    /// @dev Trust tier is computed off-chain from bond counts, reputation, and validation
    ///      status, then attested on-chain by an authorized relayer. The destination chain
    ///      stores this as a recognized trust level without needing to re-query all bonds.
    struct TrustTierPayload {
        address subject;            // The agent/human whose tier is being synced
        TrustTier tier;             // Computed trust tier
        uint256 score;              // Raw score (0–100)
        uint256 activeBondCount;    // Number of active partnership bonds (for auditability)
        uint256 averageRating;      // Reputation average rating (0–10000 basis points)
        uint256 verifiedFeedbacks;  // Number of verified feedbacks
        uint256 computedAt;         // Timestamp when tier was computed on source chain
        uint256 expiresAt;          // Expiry: tier must be re-synced after this time
        uint256 sourceChainId;      // Chain where the tier was computed
    }

    /// @notice Payload for SYNC_VNS_IDENTITY
    /// @dev VNS names are registered on Base (primary chain) and relayed to all other chains.
    ///      The destination chain stores the binding and can resolve names without bridging.
    struct VNSIdentityPayload {
        address owner;              // Address that owns this VNS name
        string name;                // Full VNS name (e.g., "alice.vns")
        bytes32 nameHash;           // keccak256(name) for efficient lookup
        IdentityType identityType;  // Human / AI Agent / Companion
        uint256 registeredAt;       // Registration timestamp on source chain
        uint256 expiresAt;          // Expiry (0 = permanent)
        uint256 sourceChainId;      // Chain where name was registered
        address paymentAddress;     // Payment address for x402 (may differ from owner)
    }

    /// @notice Payload for SYNC_ZK_ATTESTATION
    /// @dev When a ZK proof is verified on-chain via BeliefAttestationVerifier.attestBelief(),
    ///      the attestation result (isBeliefSovereign) can be relayed cross-chain so the
    ///      belief is recognized everywhere without re-proving.
    struct ZKAttestationPayload {
        address prover;             // Address that proved the belief
        bytes32 beliefHash;         // Hash of the attested belief
        bool zkVerified;            // Whether a ZK proof was used (vs signature-only)
        uint256 attestedAt;         // Timestamp of attestation on source chain
        uint256 sourceChainId;      // Chain where proof was verified
        bytes32 verifierImageId;    // RISC Zero image ID of the verifier (for auditability)
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════════════════════════════════

    address public owner;
    bool public paused;
    uint256 public outboundNonce;
    address public teleporterMessenger;
    bytes32 public remoteBlockchainID;
    address public remoteBridgeAddress;
    uint256 public remoteChainId;
    uint256 public requiredGasLimit;

    // ── Relayer whitelist ──────────────────────────────────────────────────
    mapping(address => bool) public authorizedRelayers;

    // ── Replay protection ──────────────────────────────────────────────────
    mapping(bytes32 => bool) public processedMessages;

    // ── Synced trust tiers ─────────────────────────────────────────────────
    /// @notice Synced trust tiers: subject => TrustTierPayload
    mapping(address => TrustTierPayload) public syncedTrustTiers;
    address[] public syncedTrustTierSubjects;

    // ── Synced VNS identities ──────────────────────────────────────────────
    /// @notice VNS name hash => payload (for name-to-address resolution)
    mapping(bytes32 => VNSIdentityPayload) public syncedVNSByNameHash;
    /// @notice Address => VNS name hash (for address-to-name resolution)
    mapping(address => bytes32) public syncedVNSByAddress;
    bytes32[] public syncedVNSNameHashes;

    // ── Synced ZK attestations ─────────────────────────────────────────────
    /// @notice beliefHash => prover => ZKAttestationPayload
    mapping(bytes32 => mapping(address => ZKAttestationPayload)) public syncedZKAttestations;
    /// @notice prover => list of belief hashes attested cross-chain
    mapping(address => bytes32[]) public proverAttestations;

    // ═══════════════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event TrustTierSynced(
        address indexed subject,
        TrustTier tier,
        uint256 score,
        uint256 sourceChainId,
        uint256 expiresAt
    );

    event VNSIdentitySynced(
        address indexed owner,
        string name,
        bytes32 indexed nameHash,
        IdentityType identityType,
        uint256 sourceChainId
    );

    event ZKAttestationSynced(
        address indexed prover,
        bytes32 indexed beliefHash,
        bool zkVerified,
        uint256 sourceChainId
    );

    event TrustMessageSent(
        uint256 indexed nonce,
        TrustMessageType indexed messageType,
        bytes32 messageHash,
        uint256 destinationChainId
    );

    event TrustMessageReceived(
        uint256 indexed nonce,
        TrustMessageType indexed messageType,
        bytes32 messageHash,
        uint256 sourceChainId
    );

    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ═══════════════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "TrustPortability: not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "TrustPortability: paused");
        _;
    }

    modifier onlyAuthorizedRelayer() {
        require(authorizedRelayers[msg.sender], "TrustPortability: unauthorized relayer");
        _;
    }

    modifier onlyTeleporter() {
        require(
            teleporterMessenger != address(0) && msg.sender == teleporterMessenger,
            "TrustPortability: not TeleporterMessenger"
        );
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    constructor(address _teleporterMessenger, uint256 _requiredGasLimit) {
        owner = msg.sender;
        teleporterMessenger = _teleporterMessenger;
        requiredGasLimit = _requiredGasLimit;
        authorizedRelayers[msg.sender] = true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ADMIN
    // ═══════════════════════════════════════════════════════════════════════

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "TrustPortability: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setRemoteBridge(
        bytes32 _remoteBlockchainID,
        address _remoteBridgeAddress,
        uint256 _remoteChainId
    ) external onlyOwner {
        require(_remoteBridgeAddress != address(0), "TrustPortability: zero address");
        remoteBlockchainID = _remoteBlockchainID;
        remoteBridgeAddress = _remoteBridgeAddress;
        remoteChainId = _remoteChainId;
    }

    function setRequiredGasLimit(uint256 _gasLimit) external onlyOwner {
        requiredGasLimit = _gasLimit;
    }

    function setTeleporterMessenger(address _messenger) external onlyOwner {
        teleporterMessenger = _messenger;
    }

    function addRelayer(address relayer) external onlyOwner {
        require(relayer != address(0), "TrustPortability: zero address");
        require(!authorizedRelayers[relayer], "TrustPortability: already authorized");
        authorizedRelayers[relayer] = true;
        emit RelayerAdded(relayer);
    }

    function removeRelayer(address relayer) external onlyOwner {
        require(authorizedRelayers[relayer], "TrustPortability: not authorized");
        authorizedRelayers[relayer] = false;
        emit RelayerRemoved(relayer);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  OUTBOUND — Send trust data to remote chain
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Relay a computed trust tier to the remote chain.
     * @dev Called by an authorized relayer after computing the trust tier off-chain
     *      from bond counts, reputation scores, and validation status on the source chain.
     *
     *      The tier expires after `tierValiditySeconds` to prevent stale data from
     *      persisting indefinitely. Recommended: 7 days (604800 seconds).
     *
     * @param subject           The agent/human whose tier is being synced
     * @param tier              Computed trust tier (0=Unverified ... 4=Exemplary)
     * @param score             Raw score (0–100)
     * @param activeBondCount   Number of active partnership bonds
     * @param averageRating     Reputation average rating (0–10000 basis points)
     * @param verifiedFeedbacks Number of verified feedbacks
     * @param tierValiditySeconds How long this tier attestation is valid (recommended: 7 days)
     */
    function sendTrustTier(
        address subject,
        TrustTier tier,
        uint256 score,
        uint256 activeBondCount,
        uint256 averageRating,
        uint256 verifiedFeedbacks,
        uint256 tierValiditySeconds
    ) external onlyAuthorizedRelayer whenNotPaused returns (uint256 nonce) {
        require(subject != address(0), "TrustPortability: zero subject");
        require(score <= 100, "TrustPortability: score out of range");
        require(tierValiditySeconds > 0, "TrustPortability: zero validity");

        TrustTierPayload memory payload = TrustTierPayload({
            subject: subject,
            tier: tier,
            score: score,
            activeBondCount: activeBondCount,
            averageRating: averageRating,
            verifiedFeedbacks: verifiedFeedbacks,
            computedAt: block.timestamp,
            expiresAt: block.timestamp + tierValiditySeconds,
            sourceChainId: block.chainid
        });

        return _sendTrustMessage(TrustMessageType.SYNC_TRUST_TIER, abi.encode(payload));
    }

    /**
     * @notice Relay a VNS identity binding to the remote chain.
     * @dev Called by an authorized relayer when a new VNS name is registered or updated
     *      on the source chain. The destination chain stores the binding for local resolution.
     *
     * @param owner_        Address that owns this VNS name
     * @param name          Full VNS name (e.g., "alice.vns")
     * @param identityType  Identity type (Human=0, AIAgent=1, Companion=2)
     * @param registeredAt  Registration timestamp on source chain
     * @param expiresAt     Expiry timestamp (0 = permanent)
     * @param paymentAddress Payment address for x402 (may differ from owner)
     */
    function sendVNSIdentity(
        address owner_,
        string calldata name,
        IdentityType identityType,
        uint256 registeredAt,
        uint256 expiresAt,
        address paymentAddress
    ) external onlyAuthorizedRelayer whenNotPaused returns (uint256 nonce) {
        require(owner_ != address(0), "TrustPortability: zero owner");
        require(bytes(name).length > 0, "TrustPortability: empty name");

        bytes32 nameHash = keccak256(bytes(name));

        VNSIdentityPayload memory payload = VNSIdentityPayload({
            owner: owner_,
            name: name,
            nameHash: nameHash,
            identityType: identityType,
            registeredAt: registeredAt,
            expiresAt: expiresAt,
            sourceChainId: block.chainid,
            paymentAddress: paymentAddress == address(0) ? owner_ : paymentAddress
        });

        return _sendTrustMessage(TrustMessageType.SYNC_VNS_IDENTITY, abi.encode(payload));
    }

    /**
     * @notice Relay a ZK attestation result to the remote chain.
     * @dev Called by an authorized relayer after a belief has been attested on-chain
     *      via BeliefAttestationVerifier.attestBelief(). The destination chain stores
     *      the attestation so the belief is recognized without re-proving.
     *
     * @param prover          Address that proved the belief
     * @param beliefHash      Hash of the attested belief
     * @param zkVerified      Whether a ZK proof was used (vs signature-only)
     * @param attestedAt      Timestamp of attestation on source chain
     * @param verifierImageId RISC Zero image ID of the verifier (for auditability)
     */
    function sendZKAttestation(
        address prover,
        bytes32 beliefHash,
        bool zkVerified,
        uint256 attestedAt,
        bytes32 verifierImageId
    ) external onlyAuthorizedRelayer whenNotPaused returns (uint256 nonce) {
        require(prover != address(0), "TrustPortability: zero prover");
        require(beliefHash != bytes32(0), "TrustPortability: zero belief hash");

        ZKAttestationPayload memory payload = ZKAttestationPayload({
            prover: prover,
            beliefHash: beliefHash,
            zkVerified: zkVerified,
            attestedAt: attestedAt,
            sourceChainId: block.chainid,
            verifierImageId: verifierImageId
        });

        return _sendTrustMessage(TrustMessageType.SYNC_ZK_ATTESTATION, abi.encode(payload));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  INBOUND — Receive trust data from remote chain
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Receive a trust portability message via Avalanche Teleporter (ICM).
     * @dev Implements ITeleporterReceiver for native Avalanche L1 interop.
     */
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external override onlyTeleporter whenNotPaused {
        require(originSenderAddress == remoteBridgeAddress, "TrustPortability: wrong origin");
        _processTrustMessage(message);
    }

    /**
     * @notice Receive a trust portability message via authorized off-chain relayer.
     * @dev Used for Base↔Avalanche transport where Teleporter is not available.
     */
    function relayTrustMessage(bytes calldata encoded)
        external
        onlyAuthorizedRelayer
        whenNotPaused
    {
        _processTrustMessage(encoded);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  VIEW — Query synced trust data
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Check if an agent's trust tier is recognized on this chain.
     * @dev Returns false if the tier has expired (stale data protection).
     * @param subject The agent/human to check
     * @return recognized True if a non-expired trust tier is stored
     * @return tier The recognized trust tier
     * @return score The raw score (0–100)
     */
    function isTrustTierRecognized(address subject)
        external
        view
        returns (bool recognized, TrustTier tier, uint256 score)
    {
        TrustTierPayload memory p = syncedTrustTiers[subject];
        if (p.subject == address(0)) return (false, TrustTier.Unverified, 0);
        if (p.expiresAt > 0 && block.timestamp > p.expiresAt) return (false, TrustTier.Unverified, 0);
        return (true, p.tier, p.score);
    }

    /**
     * @notice Resolve a VNS name to an address on this chain.
     * @dev Returns address(0) if the name is not found or has expired.
     * @param name Full VNS name (e.g., "alice.vns")
     * @return owner_ The address that owns this VNS name
     * @return identityType The identity type
     * @return paymentAddress The payment address for x402
     */
    function resolveVNS(string calldata name)
        external
        view
        returns (address owner_, IdentityType identityType, address paymentAddress)
    {
        bytes32 nameHash = keccak256(bytes(name));
        VNSIdentityPayload memory p = syncedVNSByNameHash[nameHash];
        if (p.owner == address(0)) return (address(0), IdentityType.Human, address(0));
        if (p.expiresAt > 0 && block.timestamp > p.expiresAt) return (address(0), IdentityType.Human, address(0));
        return (p.owner, p.identityType, p.paymentAddress);
    }

    /**
     * @notice Reverse-resolve an address to its VNS name on this chain.
     * @param subject The address to look up
     * @return name The VNS name (empty string if not found)
     */
    function reverseResolveVNS(address subject)
        external
        view
        returns (string memory name)
    {
        bytes32 nameHash = syncedVNSByAddress[subject];
        if (nameHash == bytes32(0)) return "";
        VNSIdentityPayload memory p = syncedVNSByNameHash[nameHash];
        if (p.expiresAt > 0 && block.timestamp > p.expiresAt) return "";
        return p.name;
    }

    /**
     * @notice Check if a belief has been ZK-attested cross-chain.
     * @param beliefHash Hash of the belief to check
     * @param prover     Address of the prover
     * @return attested  True if the belief is attested
     * @return zkVerified True if a ZK proof was used (vs signature-only)
     * @return sourceChainId Chain where the proof was originally verified
     */
    function isBeliefAttested(bytes32 beliefHash, address prover)
        external
        view
        returns (bool attested, bool zkVerified, uint256 sourceChainId)
    {
        ZKAttestationPayload memory p = syncedZKAttestations[beliefHash][prover];
        if (p.prover == address(0)) return (false, false, 0);
        return (true, p.zkVerified, p.sourceChainId);
    }

    /**
     * @notice Get all beliefs attested by a prover cross-chain.
     * @param prover Address of the prover
     * @return beliefHashes Array of belief hashes
     */
    function getProverAttestations(address prover)
        external
        view
        returns (bytes32[] memory beliefHashes)
    {
        return proverAttestations[prover];
    }

    /**
     * @notice Get the full synced trust tier payload for a subject.
     */
    function getSyncedTrustTier(address subject)
        external
        view
        returns (TrustTierPayload memory)
    {
        return syncedTrustTiers[subject];
    }

    /**
     * @notice Get the full synced VNS identity payload for a name.
     */
    function getSyncedVNSByName(string calldata name)
        external
        view
        returns (VNSIdentityPayload memory)
    {
        return syncedVNSByNameHash[keccak256(bytes(name))];
    }

    /**
     * @notice Get the count of synced trust tier subjects.
     */
    function getSyncedTrustTierCount() external view returns (uint256) {
        return syncedTrustTierSubjects.length;
    }

    /**
     * @notice Get the count of synced VNS names.
     */
    function getSyncedVNSCount() external view returns (uint256) {
        return syncedVNSNameHashes.length;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  INTERNAL — Message construction & processing
    // ═══════════════════════════════════════════════════════════════════════

    function _sendTrustMessage(
        TrustMessageType messageType,
        bytes memory payload
    ) internal returns (uint256 nonce) {
        require(remoteBridgeAddress != address(0), "TrustPortability: remote not configured");

        nonce = ++outboundNonce;

        TrustMessage memory msg_ = TrustMessage({
            messageType: messageType,
            sourceChainId: block.chainid,
            nonce: nonce,
            timestamp: block.timestamp,
            sender: msg.sender,
            payload: payload
        });

        bytes memory encoded = abi.encode(msg_);
        bytes32 msgHash = keccak256(encoded);

        if (teleporterMessenger != address(0)) {
            _sendViaTeleporter(encoded);
        }

        emit TrustMessageSent(nonce, messageType, msgHash, remoteChainId);
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

    function _processTrustMessage(bytes calldata encoded) internal {
        TrustMessage memory msg_ = abi.decode(encoded, (TrustMessage));

        bytes32 msgHash = keccak256(encoded);
        require(!processedMessages[msgHash], "TrustPortability: already processed");
        processedMessages[msgHash] = true;

        require(msg_.sourceChainId == remoteChainId, "TrustPortability: wrong source chain");

        if (msg_.messageType == TrustMessageType.SYNC_TRUST_TIER) {
            _handleTrustTier(msg_);
        } else if (msg_.messageType == TrustMessageType.SYNC_VNS_IDENTITY) {
            _handleVNSIdentity(msg_);
        } else if (msg_.messageType == TrustMessageType.SYNC_ZK_ATTESTATION) {
            _handleZKAttestation(msg_);
        } else {
            revert("TrustPortability: unknown message type");
        }

        emit TrustMessageReceived(msg_.nonce, msg_.messageType, msgHash, msg_.sourceChainId);
    }

    function _handleTrustTier(TrustMessage memory msg_) internal {
        TrustTierPayload memory p = abi.decode(msg_.payload, (TrustTierPayload));
        require(p.subject != address(0), "TrustPortability: zero subject");
        require(p.score <= 100, "TrustPortability: score out of range");

        // Track new subjects
        if (syncedTrustTiers[p.subject].subject == address(0)) {
            syncedTrustTierSubjects.push(p.subject);
        }

        syncedTrustTiers[p.subject] = p;

        emit TrustTierSynced(p.subject, p.tier, p.score, p.sourceChainId, p.expiresAt);
    }

    function _handleVNSIdentity(TrustMessage memory msg_) internal {
        VNSIdentityPayload memory p = abi.decode(msg_.payload, (VNSIdentityPayload));
        require(p.owner != address(0), "TrustPortability: zero owner");
        require(p.nameHash != bytes32(0), "TrustPortability: zero name hash");

        // Track new names
        if (syncedVNSByNameHash[p.nameHash].owner == address(0)) {
            syncedVNSNameHashes.push(p.nameHash);
        }

        syncedVNSByNameHash[p.nameHash] = p;
        syncedVNSByAddress[p.owner] = p.nameHash;

        emit VNSIdentitySynced(p.owner, p.name, p.nameHash, p.identityType, p.sourceChainId);
    }

    function _handleZKAttestation(TrustMessage memory msg_) internal {
        ZKAttestationPayload memory p = abi.decode(msg_.payload, (ZKAttestationPayload));
        require(p.prover != address(0), "TrustPortability: zero prover");
        require(p.beliefHash != bytes32(0), "TrustPortability: zero belief hash");

        // Track new attestations per prover
        if (syncedZKAttestations[p.beliefHash][p.prover].prover == address(0)) {
            proverAttestations[p.prover].push(p.beliefHash);
        }

        syncedZKAttestations[p.beliefHash][p.prover] = p;

        emit ZKAttestationSynced(p.prover, p.beliefHash, p.zkVerified, p.sourceChainId);
    }
}
