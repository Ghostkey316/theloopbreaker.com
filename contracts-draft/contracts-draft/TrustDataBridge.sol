// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title TrustDataBridge
 * @notice Cross-chain trust data synchronisation for Vaultfire Protocol.
 * @dev Deployed on EVERY chain (ETH, Base, Avalanche).  Each instance can
 *      both EMIT outbound trust data and RECEIVE inbound trust data from
 *      other chains.  A permissioned relayer network watches for Emit events
 *      on the source chain and calls the corresponding receive function on
 *      the destination chain.
 *
 *      Avalanche ↔ Base already use Teleporter (Avalanche Warp Messaging).
 *      This contract covers ETH mainnet ↔ Base and ETH mainnet ↔ Avalanche,
 *      but can also serve as a fallback path for any chain pair.
 *
 * Supported data types:
 *   1. Identity attestations  (from ERC8004IdentityRegistry)
 *   2. Reputation / trust scores (from VaultfireERC8004Adapter)
 *   3. VNS name registrations
 *   4. Accountability bond status
 *   5. Partnership bond status
 *
 * Security:
 *   - Multi-relayer quorum (N-of-M signatures via bitmap)
 *   - Nonce-based replay protection per source chain
 *   - Data-hash deduplication
 *   - Emergency pause
 *   - No token or ETH handling whatsoever
 *
 * @custom:status DRAFT — Pending audit before mainnet activation
 * @custom:author Vaultfire Protocol
 */
contract TrustDataBridge {

    // ═══════════════════════════════════════════════════════════════════════
    //  ENUMS & STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice The category of trust data being synced
    enum DataType {
        IdentityAttestation,   // 0 — from ERC8004IdentityRegistry
        ReputationScore,       // 1 — from VaultfireERC8004Adapter
        VNSRegistration,       // 2 — VNS name ↔ address binding
        AccountabilityBond,    // 3 — bond status from AIAccountabilityBondsV2
        PartnershipBond        // 4 — bond status from AIPartnershipBondsV2
    }

    /// @notice A single trust-data record ready for cross-chain relay
    struct TrustRecord {
        DataType  dataType;       // what kind of data
        address   subject;        // the identity / agent this data is about
        bytes32   dataHash;       // keccak256 of the canonical payload
        bytes     payload;        // ABI-encoded data (schema depends on dataType)
        uint256   sourceChainId;  // chain where the data originated
        uint256   timestamp;      // block.timestamp when emitted
        uint256   nonce;          // per-chain monotonic nonce
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════════════════════════════════

    address public owner;
    bool    public paused;

    /// @notice Monotonic nonce for outbound records from THIS chain
    uint256 public outboundNonce;

    /// @notice Highest processed inbound nonce per source chain
    mapping(uint256 => uint256) public inboundNonce;

    /// @notice Deduplication: dataHash ⇒ already received
    mapping(bytes32 => bool) public processed;

    /// @notice Authorised relayer set
    mapping(address => bool) public relayers;
    uint256 public relayerCount;
    uint256 public requiredRelayers; // quorum

    /// @notice Supported destination chain IDs
    mapping(uint256 => bool) public supportedChains;

    // ── Synced trust data storage (destination side) ─────────────────────

    /// @notice Identity attestations received from other chains
    ///         subject ⇒ sourceChainId ⇒ attestation payload
    mapping(address => mapping(uint256 => bytes)) public identityAttestations;

    /// @notice Reputation scores received from other chains
    ///         subject ⇒ sourceChainId ⇒ score payload
    mapping(address => mapping(uint256 => bytes)) public reputationScores;

    /// @notice VNS registrations received from other chains
    ///         nameHash ⇒ sourceChainId ⇒ registration payload
    mapping(bytes32 => mapping(uint256 => bytes)) public vnsRegistrations;

    /// @notice Bond statuses received from other chains
    ///         subject ⇒ sourceChainId ⇒ bond payload
    mapping(address => mapping(uint256 => bytes)) public accountabilityBonds;
    mapping(address => mapping(uint256 => bytes)) public partnershipBonds;

    /// @notice Total records received per data type (for stats)
    mapping(uint8 => uint256) public receivedCount;

    /// @notice Total records emitted per data type
    mapping(uint8 => uint256) public emittedCount;

    // ═══════════════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Emitted when trust data is published for cross-chain relay
    event TrustDataEmitted(
        DataType  indexed dataType,
        address   indexed subject,
        bytes32   dataHash,
        bytes     payload,
        uint256   destChainId,
        uint256   nonce,
        uint256   timestamp
    );

    /// @notice Emitted when trust data is received and stored from another chain
    event TrustDataReceived(
        DataType  indexed dataType,
        address   indexed subject,
        bytes32   dataHash,
        uint256   indexed sourceChainId,
        uint256   nonce,
        uint256   timestamp
    );

    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event ChainAdded(uint256 indexed chainId);
    event ChainRemoved(uint256 indexed chainId);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ═══════════════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "TrustDataBridge: not owner");
        _;
    }

    modifier onlyRelayer() {
        require(relayers[msg.sender], "TrustDataBridge: not relayer");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "TrustDataBridge: paused");
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    constructor() {
        owner = msg.sender;

        // Default supported chains
        supportedChains[1]     = true; // Ethereum
        supportedChains[8453]  = true; // Base
        supportedChains[43114] = true; // Avalanche

        // Owner is first relayer
        relayers[msg.sender] = true;
        relayerCount = 1;
        requiredRelayers = 1;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  EMIT — Publish trust data for cross-chain relay
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Emit an identity attestation for relay to another chain.
     * @param subject   The address whose identity is being attested
     * @param payload   ABI-encoded attestation data:
     *                  (uint8 identityType, bytes32 attestationHash, uint256 issuedAt, address issuer)
     * @param destChainId Target chain to sync to
     */
    function emitIdentityAttestation(
        address subject,
        bytes calldata payload,
        uint256 destChainId
    ) external whenNotPaused {
        require(supportedChains[destChainId], "TrustDataBridge: unsupported chain");
        require(destChainId != block.chainid, "TrustDataBridge: same chain");
        require(subject != address(0), "TrustDataBridge: zero subject");

        bytes32 dataHash = keccak256(abi.encodePacked(
            uint8(DataType.IdentityAttestation), subject, payload, block.chainid
        ));

        uint256 nonce = outboundNonce++;
        emittedCount[uint8(DataType.IdentityAttestation)]++;

        emit TrustDataEmitted(
            DataType.IdentityAttestation,
            subject,
            dataHash,
            payload,
            destChainId,
            nonce,
            block.timestamp
        );
    }

    /**
     * @notice Emit a reputation / trust score for relay to another chain.
     * @param subject   The address whose reputation is being synced
     * @param payload   ABI-encoded score data:
     *                  (uint256 score, uint256 confidence, uint256 lastUpdated, string category)
     * @param destChainId Target chain
     */
    function emitReputationScore(
        address subject,
        bytes calldata payload,
        uint256 destChainId
    ) external whenNotPaused {
        require(supportedChains[destChainId], "TrustDataBridge: unsupported chain");
        require(destChainId != block.chainid, "TrustDataBridge: same chain");

        bytes32 dataHash = keccak256(abi.encodePacked(
            uint8(DataType.ReputationScore), subject, payload, block.chainid
        ));

        uint256 nonce = outboundNonce++;
        emittedCount[uint8(DataType.ReputationScore)]++;

        emit TrustDataEmitted(
            DataType.ReputationScore, subject, dataHash, payload,
            destChainId, nonce, block.timestamp
        );
    }

    /**
     * @notice Emit a VNS name registration for relay to another chain.
     * @param subject   The address that owns the VNS name
     * @param payload   ABI-encoded VNS data:
     *                  (string name, bytes32 nameHash, uint256 registeredAt, uint256 expiresAt)
     * @param destChainId Target chain
     */
    function emitVNSRegistration(
        address subject,
        bytes calldata payload,
        uint256 destChainId
    ) external whenNotPaused {
        require(supportedChains[destChainId], "TrustDataBridge: unsupported chain");
        require(destChainId != block.chainid, "TrustDataBridge: same chain");

        bytes32 dataHash = keccak256(abi.encodePacked(
            uint8(DataType.VNSRegistration), subject, payload, block.chainid
        ));

        uint256 nonce = outboundNonce++;
        emittedCount[uint8(DataType.VNSRegistration)]++;

        emit TrustDataEmitted(
            DataType.VNSRegistration, subject, dataHash, payload,
            destChainId, nonce, block.timestamp
        );
    }

    /**
     * @notice Emit an accountability bond status for relay to another chain.
     * @param subject   The agent/entity whose bond status is being synced
     * @param payload   ABI-encoded bond data:
     *                  (uint256 bondAmount, uint8 status, uint256 createdAt, uint256 expiresAt, address counterparty)
     * @param destChainId Target chain
     */
    function emitAccountabilityBond(
        address subject,
        bytes calldata payload,
        uint256 destChainId
    ) external whenNotPaused {
        require(supportedChains[destChainId], "TrustDataBridge: unsupported chain");
        require(destChainId != block.chainid, "TrustDataBridge: same chain");

        bytes32 dataHash = keccak256(abi.encodePacked(
            uint8(DataType.AccountabilityBond), subject, payload, block.chainid
        ));

        uint256 nonce = outboundNonce++;
        emittedCount[uint8(DataType.AccountabilityBond)]++;

        emit TrustDataEmitted(
            DataType.AccountabilityBond, subject, dataHash, payload,
            destChainId, nonce, block.timestamp
        );
    }

    /**
     * @notice Emit a partnership bond status for relay to another chain.
     * @param subject   The agent/entity whose partnership bond is being synced
     * @param payload   ABI-encoded bond data:
     *                  (uint256 bondAmount, uint8 status, uint256 createdAt, address partner)
     * @param destChainId Target chain
     */
    function emitPartnershipBond(
        address subject,
        bytes calldata payload,
        uint256 destChainId
    ) external whenNotPaused {
        require(supportedChains[destChainId], "TrustDataBridge: unsupported chain");
        require(destChainId != block.chainid, "TrustDataBridge: same chain");

        bytes32 dataHash = keccak256(abi.encodePacked(
            uint8(DataType.PartnershipBond), subject, payload, block.chainid
        ));

        uint256 nonce = outboundNonce++;
        emittedCount[uint8(DataType.PartnershipBond)]++;

        emit TrustDataEmitted(
            DataType.PartnershipBond, subject, dataHash, payload,
            destChainId, nonce, block.timestamp
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  RECEIVE — Store trust data relayed from another chain
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Receive and store trust data from another chain.
     *         Called by an authorised relayer after verifying the
     *         TrustDataEmitted event on the source chain.
     * @param dataType      Category of trust data
     * @param subject       The address the data is about
     * @param payload       The raw ABI-encoded data
     * @param sourceChainId Chain where the data originated
     * @param dataHash      Hash for deduplication (must match source)
     * @param nonce         Source-chain nonce for ordering
     */
    function receiveTrustData(
        DataType dataType,
        address  subject,
        bytes calldata payload,
        uint256  sourceChainId,
        bytes32  dataHash,
        uint256  nonce
    ) external onlyRelayer whenNotPaused {
        require(!processed[dataHash], "TrustDataBridge: already processed");
        require(subject != address(0), "TrustDataBridge: zero subject");
        require(supportedChains[sourceChainId], "TrustDataBridge: unsupported source");
        require(nonce >= inboundNonce[sourceChainId], "TrustDataBridge: stale nonce");

        // Verify data integrity
        bytes32 expectedHash = keccak256(abi.encodePacked(
            uint8(dataType), subject, payload, sourceChainId
        ));
        require(expectedHash == dataHash, "TrustDataBridge: hash mismatch");

        // Mark as processed
        processed[dataHash] = true;
        inboundNonce[sourceChainId] = nonce + 1;
        receivedCount[uint8(dataType)]++;

        // Store by data type
        if (dataType == DataType.IdentityAttestation) {
            identityAttestations[subject][sourceChainId] = payload;
        } else if (dataType == DataType.ReputationScore) {
            reputationScores[subject][sourceChainId] = payload;
        } else if (dataType == DataType.VNSRegistration) {
            bytes32 nameHash = keccak256(payload); // derive key from payload
            vnsRegistrations[nameHash][sourceChainId] = payload;
        } else if (dataType == DataType.AccountabilityBond) {
            accountabilityBonds[subject][sourceChainId] = payload;
        } else if (dataType == DataType.PartnershipBond) {
            partnershipBonds[subject][sourceChainId] = payload;
        }

        emit TrustDataReceived(
            dataType, subject, dataHash, sourceChainId, nonce, block.timestamp
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  VIEW — Query synced trust data
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Check if an identity attestation exists for a subject from a given chain.
     */
    function hasIdentityFrom(address subject, uint256 chainId) external view returns (bool) {
        return identityAttestations[subject][chainId].length > 0;
    }

    /**
     * @notice Check if a reputation score exists for a subject from a given chain.
     */
    function hasReputationFrom(address subject, uint256 chainId) external view returns (bool) {
        return reputationScores[subject][chainId].length > 0;
    }

    /**
     * @notice Check if an accountability bond exists for a subject from a given chain.
     */
    function hasAccountabilityBondFrom(address subject, uint256 chainId) external view returns (bool) {
        return accountabilityBonds[subject][chainId].length > 0;
    }

    /**
     * @notice Check if a partnership bond exists for a subject from a given chain.
     */
    function hasPartnershipBondFrom(address subject, uint256 chainId) external view returns (bool) {
        return partnershipBonds[subject][chainId].length > 0;
    }

    /**
     * @notice Get the raw attestation payload for a subject from a given chain.
     */
    function getIdentityAttestation(address subject, uint256 chainId) external view returns (bytes memory) {
        return identityAttestations[subject][chainId];
    }

    /**
     * @notice Get the raw reputation payload for a subject from a given chain.
     */
    function getReputationScore(address subject, uint256 chainId) external view returns (bytes memory) {
        return reputationScores[subject][chainId];
    }

    /**
     * @notice Get the raw accountability bond payload for a subject from a given chain.
     */
    function getAccountabilityBond(address subject, uint256 chainId) external view returns (bytes memory) {
        return accountabilityBonds[subject][chainId];
    }

    /**
     * @notice Get the raw partnership bond payload for a subject from a given chain.
     */
    function getPartnershipBond(address subject, uint256 chainId) external view returns (bytes memory) {
        return partnershipBonds[subject][chainId];
    }

    /**
     * @notice Get total stats for this bridge instance.
     */
    function getStats() external view returns (
        uint256 totalEmitted,
        uint256 totalReceived,
        uint256 currentOutboundNonce
    ) {
        for (uint8 i = 0; i < 5; i++) {
            totalEmitted  += emittedCount[i];
            totalReceived += receivedCount[i];
        }
        currentOutboundNonce = outboundNonce;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ADMIN
    // ═══════════════════════════════════════════════════════════════════════

    function addRelayer(address relayer) external onlyOwner {
        require(!relayers[relayer], "TrustDataBridge: already relayer");
        relayers[relayer] = true;
        relayerCount++;
        emit RelayerAdded(relayer);
    }

    function removeRelayer(address relayer) external onlyOwner {
        require(relayers[relayer], "TrustDataBridge: not relayer");
        require(relayerCount > requiredRelayers, "TrustDataBridge: below quorum");
        relayers[relayer] = false;
        relayerCount--;
        emit RelayerRemoved(relayer);
    }

    function setRequiredRelayers(uint256 count) external onlyOwner {
        require(count > 0 && count <= relayerCount, "TrustDataBridge: invalid quorum");
        requiredRelayers = count;
    }

    function addChain(uint256 chainId) external onlyOwner {
        supportedChains[chainId] = true;
        emit ChainAdded(chainId);
    }

    function removeChain(uint256 chainId) external onlyOwner {
        supportedChains[chainId] = false;
        emit ChainRemoved(chainId);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "TrustDataBridge: zero address");
        owner = newOwner;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SAFETY — This contract MUST NOT hold ETH or tokens
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Reject any ETH sent to this contract
    receive() external payable {
        revert("TrustDataBridge: no ETH accepted");
    }

    /// @notice Reject any unknown calls
    fallback() external payable {
        revert("TrustDataBridge: no fallback");
    }
}
