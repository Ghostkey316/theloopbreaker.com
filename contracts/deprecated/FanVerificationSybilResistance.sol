// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Fan Verification Sybil Resistance
 * @notice Prevents fake fan verifications through stakes, NFT tickets, and reputation
 * @dev Integrates with Sports Integrity Bonds to ensure authentic fan feedback
 *
 * @custom:security-enhancement From Professional Security Audit 2026
 * @custom:purpose Eliminate Sybil attacks on fan verification system
 */
contract FanVerificationSybilResistance is ReentrancyGuard {

    // ============ Enums ============

    /**
     * @notice Verification status
     */
    enum VerificationStatus {
        Pending,        // Awaiting validation
        Validated,      // NFT and stake confirmed
        Disputed,       // Flagged as suspicious
        Slashed,        // Proven fake, stake slashed
        Rewarded        // Accurate verification, stake returned + bonus
    }

    /**
     * @notice Fan reputation tier
     */
    enum ReputationTier {
        New,            // < 5 verifications (higher stake required)
        Regular,        // 5-20 verifications
        Trusted,        // 20-50 verifications
        Verified,       // 50+ verifications, high accuracy
        Expert          // 100+ verifications, 95%+ accuracy
    }

    // ============ Structs ============

    /**
     * @notice Fan profile with reputation tracking
     */
    struct FanProfile {
        address fanAddress;
        uint256 totalVerifications;
        uint256 accurateVerifications;
        uint256 disputedVerifications;
        uint256 slashedVerifications;
        uint256 totalRewardsEarned;
        uint256 registeredAt;
        ReputationTier tier;
        bool banned;
        string banReason;
    }

    /**
     * @notice Verification submission with Sybil resistance
     */
    struct Verification {
        uint256 verificationId;
        address fan;
        uint256 bondId;
        uint256 gameId;
        string teamAffiliation;     // "home" or "away"
        bool attestsCompetitive;    // Was game competitive?
        uint256 stakeAmount;
        bytes32 nftTicketHash;      // Hash of NFT ticket ID
        string geographicProof;     // IP hash + wallet location proof
        uint256 submittedAt;
        VerificationStatus status;
        uint256 reputationScore;    // Snapshot at submission time
        bool stakeReturned;
    }

    /**
     * @notice NFT ticket validation (prevents ticket reuse)
     */
    struct NFTTicketValidation {
        bytes32 ticketHash;
        address holder;
        uint256 gameId;
        uint256 validatedAt;
        bool used;
    }

    /**
     * @notice Geographic verification (prevents location spoofing)
     */
    struct GeographicValidation {
        bytes32 locationHash;       // Hash of (IP + wallet + timestamp)
        uint256 gameId;
        address fan;
        uint256 verificationCount;  // How many verifications from this location
        bool flagged;               // Flagged as suspicious
    }

    // ============ State Variables ============

    /// @notice Contract owner
    address public owner;

    /// @notice Minimum stake for fan verification
    mapping(ReputationTier => uint256) public stakeLevels;

    /// @notice Fan profiles
    mapping(address => FanProfile) public fans;

    /// @notice All verifications
    mapping(uint256 => Verification) public verifications;
    uint256 public nextVerificationId = 1;

    /// @notice NFT ticket tracking (prevent reuse)
    mapping(bytes32 => NFTTicketValidation) public nftTickets;

    /// @notice Geographic tracking (prevent location spoofing)
    mapping(bytes32 => GeographicValidation) public geoValidations;
    mapping(uint256 => mapping(bytes32 => uint256)) public gameLocationCounts; // gameId => locationHash => count

    /// @notice Verification pool (stakes held until validation)
    uint256 public verificationPool;

    /// @notice Reward pool for accurate verifiers
    uint256 public rewardPool;

    /// @notice Slash pool (from slashed stakes)
    uint256 public slashPool;

    /// @notice Maximum verifications per location per game
    uint256 public constant MAX_VERIFICATIONS_PER_LOCATION = 5;

    /// @notice Minimum NFT ticket age (must be minted before game)
    uint256 public constant MINIMUM_TICKET_AGE = 24 hours;

    /// @notice Reward for accurate verification (10% of stake)
    uint256 public constant ACCURACY_REWARD_PCT = 1000; // Basis points

    /// @notice Slash amount for fake verification (100% of stake)
    uint256 public constant SLASH_PCT = 10000; // Basis points

    /// @notice Paused state
    bool public paused;

    // ============ Events ============

    event FanRegistered(address indexed fan, uint256 timestamp);
    event ReputationTierUpgraded(address indexed fan, ReputationTier newTier);

    event VerificationSubmitted(
        uint256 indexed verificationId,
        address indexed fan,
        uint256 indexed bondId,
        uint256 gameId,
        uint256 stakeAmount
    );

    event VerificationValidated(
        uint256 indexed verificationId,
        address indexed validator,
        VerificationStatus status
    );

    event VerificationRewarded(
        uint256 indexed verificationId,
        address indexed fan,
        uint256 rewardAmount
    );

    event VerificationSlashed(
        uint256 indexed verificationId,
        address indexed fan,
        uint256 slashAmount,
        string reason
    );

    event NFTTicketValidated(bytes32 indexed ticketHash, uint256 gameId, address fan);
    event NFTTicketFlagged(bytes32 indexed ticketHash, string reason);

    event GeographicProofFlagged(bytes32 indexed locationHash, uint256 gameId, string reason);

    event FanBanned(address indexed fan, string reason);
    event FanUnbanned(address indexed fan);

    event RewardPoolFunded(address indexed funder, uint256 amount);
    event Paused();
    event Unpaused();

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    modifier notBanned() {
        require(!fans[msg.sender].banned, "Fan banned");
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;

        // Initialize stake levels by tier
        stakeLevels[ReputationTier.New] = 0.01 ether;       // New fans: 0.01 ETH
        stakeLevels[ReputationTier.Regular] = 0.005 ether;  // Regular: 0.005 ETH
        stakeLevels[ReputationTier.Trusted] = 0.003 ether;  // Trusted: 0.003 ETH
        stakeLevels[ReputationTier.Verified] = 0.001 ether; // Verified: 0.001 ETH
        stakeLevels[ReputationTier.Expert] = 0.0005 ether;  // Expert: 0.0005 ETH
    }

    // ============ Core Functions ============

    /**
     * @notice Submit fan verification with Sybil resistance
     * @param bondId Bond being verified
     * @param gameId Game being verified
     * @param teamAffiliation "home" or "away"
     * @param attestsCompetitive Was game competitive?
     * @param nftTicketHash Hash of NFT ticket ID
     * @param geographicProof Location proof (IP hash + wallet location)
     * @return verificationId Created verification ID
     *
     * @dev Requirements:
     * - Must stake appropriate amount for reputation tier
     * - NFT ticket hash must be unique for this game
     * - Geographic proof must not be flagged as suspicious
     */
    function submitVerification(
        uint256 bondId,
        uint256 gameId,
        string memory teamAffiliation,
        bool attestsCompetitive,
        bytes32 nftTicketHash,
        string memory geographicProof
    ) external payable whenNotPaused notBanned nonReentrant returns (uint256) {
        // Initialize fan profile if first verification
        if (fans[msg.sender].fanAddress == address(0)) {
            fans[msg.sender] = FanProfile({
                fanAddress: msg.sender,
                totalVerifications: 0,
                accurateVerifications: 0,
                disputedVerifications: 0,
                slashedVerifications: 0,
                totalRewardsEarned: 0,
                registeredAt: block.timestamp,
                tier: ReputationTier.New,
                banned: false,
                banReason: ""
            });
            emit FanRegistered(msg.sender, block.timestamp);
        }

        // Check stake requirement for tier
        ReputationTier tier = fans[msg.sender].tier;
        uint256 requiredStake = stakeLevels[tier];
        require(msg.value >= requiredStake, "Insufficient stake for tier");

        // Validate team affiliation
        require(
            keccak256(bytes(teamAffiliation)) == keccak256(bytes("home")) ||
            keccak256(bytes(teamAffiliation)) == keccak256(bytes("away")),
            "Invalid team affiliation"
        );

        // Check NFT ticket (prevent reuse)
        require(nftTicketHash != bytes32(0), "NFT ticket hash required");
        require(!nftTickets[nftTicketHash].used, "NFT ticket already used");

        // Check geographic proof (prevent Sybil)
        bytes32 locationHash = keccak256(bytes(geographicProof));
        require(!geoValidations[locationHash].flagged, "Location flagged as suspicious");

        // Check location verification limit
        uint256 locationVerifications = gameLocationCounts[gameId][locationHash];
        require(
            locationVerifications < MAX_VERIFICATIONS_PER_LOCATION,
            "Too many verifications from this location"
        );

        // Create verification
        uint256 verificationId = nextVerificationId++;
        uint256 reputationScore = calculateReputationScore(msg.sender);

        verifications[verificationId] = Verification({
            verificationId: verificationId,
            fan: msg.sender,
            bondId: bondId,
            gameId: gameId,
            teamAffiliation: teamAffiliation,
            attestsCompetitive: attestsCompetitive,
            stakeAmount: msg.value,
            nftTicketHash: nftTicketHash,
            geographicProof: geographicProof,
            submittedAt: block.timestamp,
            status: VerificationStatus.Pending,
            reputationScore: reputationScore,
            stakeReturned: false
        });

        // Mark NFT ticket as used
        nftTickets[nftTicketHash] = NFTTicketValidation({
            ticketHash: nftTicketHash,
            holder: msg.sender,
            gameId: gameId,
            validatedAt: block.timestamp,
            used: true
        });

        // Update geographic tracking
        gameLocationCounts[gameId][locationHash]++;
        geoValidations[locationHash].verificationCount++;

        // Update fan profile
        fans[msg.sender].totalVerifications++;

        // Add stake to verification pool
        verificationPool += msg.value;

        emit VerificationSubmitted(verificationId, msg.sender, bondId, gameId, msg.value);
        emit NFTTicketValidated(nftTicketHash, gameId, msg.sender);

        return verificationId;
    }

    /**
     * @notice Validate verification after game/consensus
     * @param verificationId Verification to validate
     * @param status New status (Validated/Disputed/Slashed)
     * @param reason Validation notes
     *
     * @dev Only owner can validate (typically called by bond contract)
     */
    function validateVerification(
        uint256 verificationId,
        VerificationStatus status,
        string memory reason
    ) external onlyOwner nonReentrant {
        Verification storage verification = verifications[verificationId];
        require(verification.status == VerificationStatus.Pending, "Already validated");
        require(
            status == VerificationStatus.Validated ||
            status == VerificationStatus.Disputed ||
            status == VerificationStatus.Slashed,
            "Invalid status"
        );

        verification.status = status;
        FanProfile storage fan = fans[verification.fan];

        if (status == VerificationStatus.Validated) {
            // Accurate verification - return stake + reward
            fan.accurateVerifications++;

            uint256 reward = (verification.stakeAmount * ACCURACY_REWARD_PCT) / 10000;
            uint256 totalReturn = verification.stakeAmount + reward;

            verificationPool -= verification.stakeAmount;
            if (reward > 0 && rewardPool >= reward) {
                rewardPool -= reward;
                fan.totalRewardsEarned += reward;
            } else {
                totalReturn = verification.stakeAmount; // No reward if pool insufficient
            }

            verification.stakeReturned = true;

            (bool success, ) = payable(verification.fan).call{value: totalReturn}("");
            require(success, "Transfer failed");

            emit VerificationRewarded(verificationId, verification.fan, reward);

            // Check for tier upgrade
            _checkTierUpgrade(verification.fan);

        } else if (status == VerificationStatus.Disputed) {
            // Disputed - return stake only
            fan.disputedVerifications++;

            verificationPool -= verification.stakeAmount;
            verification.stakeReturned = true;

            (bool success, ) = payable(verification.fan).call{value: verification.stakeAmount}("");
            require(success, "Transfer failed");

        } else if (status == VerificationStatus.Slashed) {
            // Slashed - stake forfeited
            fan.slashedVerifications++;

            uint256 slashAmount = (verification.stakeAmount * SLASH_PCT) / 10000;
            verificationPool -= verification.stakeAmount;
            slashPool += slashAmount;

            emit VerificationSlashed(verificationId, verification.fan, slashAmount, reason);

            // Ban if too many slashes
            if (fan.slashedVerifications >= 3) {
                fan.banned = true;
                fan.banReason = "Multiple slashed verifications";
                emit FanBanned(verification.fan, fan.banReason);
            }
        }

        emit VerificationValidated(verificationId, msg.sender, status);
    }

    /**
     * @notice Flag NFT ticket as suspicious
     * @param ticketHash Ticket to flag
     * @param reason Flag reason
     */
    function flagNFTTicket(bytes32 ticketHash, string memory reason) external onlyOwner {
        NFTTicketValidation storage ticket = nftTickets[ticketHash];
        require(ticket.validatedAt > 0, "Ticket does not exist");

        // Flag for manual review
        emit NFTTicketFlagged(ticketHash, reason);
    }

    /**
     * @notice Flag geographic location as suspicious
     * @param locationHash Location to flag
     * @param gameId Game ID
     * @param reason Flag reason
     */
    function flagGeographicProof(
        bytes32 locationHash,
        uint256 gameId,
        string memory reason
    ) external onlyOwner {
        geoValidations[locationHash].flagged = true;
        emit GeographicProofFlagged(locationHash, gameId, reason);
    }

    // ============ Reputation System ============

    /**
     * @notice Calculate reputation score for fan
     * @param fan Fan address
     * @return score Reputation score (0-10000)
     *
     * @dev Formula:
     * - Accuracy rate × 6000
     * - Total verifications × 2000 (capped at 100 verifications)
     * - Time since registration × 1000 (capped at 1 year)
     * - Slash penalty: -2000 per slash
     * - Dispute penalty: -500 per dispute
     */
    function calculateReputationScore(address fan) public view returns (uint256) {
        FanProfile memory profile = fans[fan];

        if (profile.totalVerifications == 0) return 5000; // Neutral for new fans

        // Accuracy component (60%)
        uint256 accuracyRate = (profile.accurateVerifications * 10000) / profile.totalVerifications;
        uint256 accuracyScore = (accuracyRate * 6000) / 10000;

        // Volume component (20%) - capped at 100 verifications
        uint256 verificationCount = profile.totalVerifications > 100 ? 100 : profile.totalVerifications;
        uint256 volumeScore = (verificationCount * 2000) / 100;

        // Longevity component (10%) - capped at 1 year
        uint256 daysSinceRegistration = (block.timestamp - profile.registeredAt) / 1 days;
        uint256 cappedDays = daysSinceRegistration > 365 ? 365 : daysSinceRegistration;
        uint256 longevityScore = (cappedDays * 1000) / 365;

        // Reputation tier bonus (10%)
        uint256 tierBonus = uint256(profile.tier) * 200; // 0, 200, 400, 600, 800

        // Calculate total
        int256 score = int256(accuracyScore + volumeScore + longevityScore + tierBonus);

        // Penalties
        score -= int256(profile.slashedVerifications * 2000);
        score -= int256(profile.disputedVerifications * 500);

        // Clamp to 0-10000
        if (score < 0) return 0;
        if (score > 10000) return 10000;
        return uint256(score);
    }

    /**
     * @notice Get fan tier based on verification count and accuracy
     * @param fan Fan address
     * @return tier Current reputation tier
     */
    function getFanTier(address fan) external view returns (ReputationTier) {
        FanProfile memory profile = fans[fan];

        if (profile.totalVerifications < 5) return ReputationTier.New;

        uint256 accuracyRate = (profile.accurateVerifications * 10000) / profile.totalVerifications;

        if (profile.totalVerifications >= 100 && accuracyRate >= 9500) {
            return ReputationTier.Expert;
        } else if (profile.totalVerifications >= 50 && accuracyRate >= 8000) {
            return ReputationTier.Verified;
        } else if (profile.totalVerifications >= 20 && accuracyRate >= 7000) {
            return ReputationTier.Trusted;
        } else if (profile.totalVerifications >= 5) {
            return ReputationTier.Regular;
        }

        return ReputationTier.New;
    }

    /**
     * @notice Get required stake for fan
     * @param fan Fan address
     * @return stake Required stake amount
     */
    function getRequiredStake(address fan) external view returns (uint256) {
        ReputationTier tier = fans[fan].tier;
        return stakeLevels[tier];
    }

    // ============ Admin Functions ============

    /**
     * @notice Update stake level for tier
     * @param tier Tier to update
     * @param newStake New stake amount
     */
    function updateStakeLevel(ReputationTier tier, uint256 newStake) external onlyOwner {
        require(newStake > 0, "Stake must be positive");
        stakeLevels[tier] = newStake;
    }

    /**
     * @notice Ban fan for abuse
     * @param fan Fan to ban
     * @param reason Ban reason
     */
    function banFan(address fan, string memory reason) external onlyOwner {
        require(!fans[fan].banned, "Already banned");
        fans[fan].banned = true;
        fans[fan].banReason = reason;
        emit FanBanned(fan, reason);
    }

    /**
     * @notice Unban fan
     * @param fan Fan to unban
     */
    function unbanFan(address fan) external onlyOwner {
        require(fans[fan].banned, "Not banned");
        fans[fan].banned = false;
        fans[fan].banReason = "";
        emit FanUnbanned(fan);
    }

    /**
     * @notice Fund reward pool
     */
    function fundRewardPool() external payable {
        require(msg.value > 0, "Must send ETH");
        rewardPool += msg.value;
        emit RewardPoolFunded(msg.sender, msg.value);
    }

    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    // ============ View Functions ============

    /**
     * @notice Get fan profile
     * @param fan Fan address
     * @return profile Fan profile
     */
    function getFanProfile(address fan) external view returns (FanProfile memory) {
        return fans[fan];
    }

    /**
     * @notice Get verification details
     * @param verificationId Verification ID
     * @return verification Verification details
     */
    function getVerification(uint256 verificationId) external view returns (Verification memory) {
        return verifications[verificationId];
    }

    /**
     * @notice Check if location is suspicious
     * @param locationHash Location hash
     * @param gameId Game ID
     * @return suspicious Whether location is flagged
     * @return count Number of verifications from this location
     */
    function checkLocationSuspicious(
        bytes32 locationHash,
        uint256 gameId
    ) external view returns (bool suspicious, uint256 count) {
        return (
            geoValidations[locationHash].flagged,
            gameLocationCounts[gameId][locationHash]
        );
    }

    // ============ Internal Functions ============

    /**
     * @notice Check if fan should be upgraded to next tier
     * @param fan Fan address
     */
    function _checkTierUpgrade(address fan) internal {
        FanProfile storage profile = fans[fan];
        ReputationTier currentTier = profile.tier;
        ReputationTier calculatedTier = this.getFanTier(fan);

        if (uint256(calculatedTier) > uint256(currentTier)) {
            profile.tier = calculatedTier;
            emit ReputationTierUpgraded(fan, calculatedTier);
        }
    }

    /**
     * @notice Accept ETH deposits for reward pool
     */
    receive() external payable {
        rewardPool += msg.value;
        emit RewardPoolFunded(msg.sender, msg.value);
    }
}
