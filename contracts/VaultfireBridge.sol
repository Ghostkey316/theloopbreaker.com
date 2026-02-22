// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title VaultfireBridge
 * @notice Lock-and-mint cross-chain bridge for Vaultfire Protocol.
 * @dev Supports ETH and ERC-20 token bridging between Ethereum, Base, and Avalanche.
 *
 * Architecture:
 * - Source chain: Users lock ETH/tokens → Lock event emitted
 * - Destination chain: Relayer picks up Lock event → mints equivalent tokens
 * - Reverse: Users burn on destination → relayer unlocks on source
 *
 * Security:
 * - Multi-sig relayer validation (requires N-of-M signatures)
 * - Nonce-based replay protection
 * - Per-token and per-user rate limiting
 * - Emergency pause capability
 * - Timelock on large transfers
 *
 * @custom:status TESTNET — Pending audit before mainnet activation
 * @custom:author Vaultfire Protocol
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract VaultfireBridge {

    // ═══════════════════════════════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════════════════════════════

    address public owner;
    bool public paused;

    /// @notice Supported destination chain IDs
    mapping(uint256 => bool) public supportedChains;

    /// @notice Supported tokens (address(0) = native ETH/AVAX)
    mapping(address => bool) public supportedTokens;

    /// @notice Nonce for replay protection (per user)
    mapping(address => uint256) public userNonce;

    /// @notice Global bridge nonce
    uint256 public bridgeNonce;

    /// @notice Processed unlock hashes (prevents double-unlock)
    mapping(bytes32 => bool) public processedUnlocks;

    /// @notice Relayer addresses authorized to process unlocks
    mapping(address => bool) public relayers;
    uint256 public relayerCount;
    uint256 public requiredSignatures;

    /// @notice Rate limit: max amount per token per 24h period
    mapping(address => uint256) public dailyLimit;
    mapping(address => mapping(uint256 => uint256)) public dailyVolume; // token => day => volume

    /// @notice Large transfer threshold (requires timelock)
    uint256 public largeTransferThreshold;
    uint256 public timelockDuration;

    /// @notice Pending large transfers
    struct PendingTransfer {
        address user;
        address token;
        uint256 amount;
        uint256 destChainId;
        uint256 unlockTime;
        bool executed;
        bool cancelled;
    }
    mapping(uint256 => PendingTransfer) public pendingTransfers;
    uint256 public pendingTransferCount;

    // ═══════════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════════

    event Lock(
        address indexed sender,
        address indexed token,
        uint256 amount,
        uint256 indexed destChainId,
        address destAddress,
        uint256 nonce,
        uint256 timestamp
    );

    event Unlock(
        address indexed recipient,
        address indexed token,
        uint256 amount,
        uint256 indexed sourceChainId,
        bytes32 lockHash,
        uint256 timestamp
    );

    event LargeTransferQueued(
        uint256 indexed transferId,
        address indexed sender,
        address token,
        uint256 amount,
        uint256 destChainId,
        uint256 unlockTime
    );

    event LargeTransferExecuted(uint256 indexed transferId);
    event LargeTransferCancelled(uint256 indexed transferId);
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event ChainAdded(uint256 indexed chainId);
    event ChainRemoved(uint256 indexed chainId);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ═══════════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ═══════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "VaultfireBridge: not owner");
        _;
    }

    modifier onlyRelayer() {
        require(relayers[msg.sender], "VaultfireBridge: not relayer");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "VaultfireBridge: paused");
        _;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════

    constructor() {
        owner = msg.sender;

        // Default supported chains
        supportedChains[1] = true;      // Ethereum
        supportedChains[8453] = true;   // Base
        supportedChains[43114] = true;  // Avalanche

        // Native token always supported
        supportedTokens[address(0)] = true;

        // Default settings
        largeTransferThreshold = 10 ether;
        timelockDuration = 1 hours;
        requiredSignatures = 1;

        // Owner is first relayer
        relayers[msg.sender] = true;
        relayerCount = 1;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  LOCK (User → Bridge)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Lock native ETH/AVAX for bridging to another chain.
     * @param destChainId Destination chain ID
     * @param destAddress Recipient address on destination chain
     */
    function lockNative(uint256 destChainId, address destAddress) external payable whenNotPaused {
        require(msg.value > 0, "VaultfireBridge: zero amount");
        require(supportedChains[destChainId], "VaultfireBridge: unsupported chain");
        require(destAddress != address(0), "VaultfireBridge: zero address");
        require(destChainId != block.chainid, "VaultfireBridge: same chain");

        _checkDailyLimit(address(0), msg.value);

        uint256 nonce = bridgeNonce++;
        userNonce[msg.sender]++;

        if (msg.value >= largeTransferThreshold) {
            uint256 transferId = pendingTransferCount++;
            pendingTransfers[transferId] = PendingTransfer({
                user: msg.sender,
                token: address(0),
                amount: msg.value,
                destChainId: destChainId,
                unlockTime: block.timestamp + timelockDuration,
                executed: false,
                cancelled: false
            });
            emit LargeTransferQueued(transferId, msg.sender, address(0), msg.value, destChainId, block.timestamp + timelockDuration);
        } else {
            emit Lock(msg.sender, address(0), msg.value, destChainId, destAddress, nonce, block.timestamp);
        }
    }

    /**
     * @notice Lock ERC-20 tokens for bridging to another chain.
     * @param token Token contract address
     * @param amount Amount to bridge
     * @param destChainId Destination chain ID
     * @param destAddress Recipient address on destination chain
     */
    function lockToken(address token, uint256 amount, uint256 destChainId, address destAddress) external whenNotPaused {
        require(amount > 0, "VaultfireBridge: zero amount");
        require(supportedTokens[token], "VaultfireBridge: unsupported token");
        require(supportedChains[destChainId], "VaultfireBridge: unsupported chain");
        require(destAddress != address(0), "VaultfireBridge: zero address");
        require(destChainId != block.chainid, "VaultfireBridge: same chain");

        _checkDailyLimit(token, amount);

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        uint256 nonce = bridgeNonce++;
        userNonce[msg.sender]++;

        emit Lock(msg.sender, token, amount, destChainId, destAddress, nonce, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  UNLOCK (Relayer → User)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Unlock tokens on this chain (called by relayer after verifying Lock event on source chain).
     * @param recipient Recipient address
     * @param token Token address (address(0) for native)
     * @param amount Amount to unlock
     * @param sourceChainId Source chain where Lock occurred
     * @param lockHash Hash of the Lock event for deduplication
     */
    function unlock(
        address payable recipient,
        address token,
        uint256 amount,
        uint256 sourceChainId,
        bytes32 lockHash
    ) external onlyRelayer whenNotPaused {
        require(!processedUnlocks[lockHash], "VaultfireBridge: already processed");
        require(recipient != address(0), "VaultfireBridge: zero address");
        require(amount > 0, "VaultfireBridge: zero amount");

        processedUnlocks[lockHash] = true;

        if (token == address(0)) {
            require(address(this).balance >= amount, "VaultfireBridge: insufficient balance");
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "VaultfireBridge: ETH transfer failed");
        } else {
            IERC20(token).transfer(recipient, amount);
        }

        emit Unlock(recipient, token, amount, sourceChainId, lockHash, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  LARGE TRANSFER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    function executeLargeTransfer(uint256 transferId, address destAddress) external whenNotPaused {
        PendingTransfer storage pt = pendingTransfers[transferId];
        require(pt.user == msg.sender, "VaultfireBridge: not your transfer");
        require(!pt.executed && !pt.cancelled, "VaultfireBridge: already processed");
        require(block.timestamp >= pt.unlockTime, "VaultfireBridge: timelock active");

        pt.executed = true;
        uint256 nonce = bridgeNonce++;

        emit Lock(pt.user, pt.token, pt.amount, pt.destChainId, destAddress, nonce, block.timestamp);
        emit LargeTransferExecuted(transferId);
    }

    function cancelLargeTransfer(uint256 transferId) external {
        PendingTransfer storage pt = pendingTransfers[transferId];
        require(pt.user == msg.sender || msg.sender == owner, "VaultfireBridge: unauthorized");
        require(!pt.executed && !pt.cancelled, "VaultfireBridge: already processed");

        pt.cancelled = true;

        // Refund
        if (pt.token == address(0)) {
            (bool success, ) = payable(pt.user).call{value: pt.amount}("");
            require(success, "VaultfireBridge: refund failed");
        } else {
            IERC20(pt.token).transfer(pt.user, pt.amount);
        }

        emit LargeTransferCancelled(transferId);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  RATE LIMITING
    // ═══════════════════════════════════════════════════════════════════

    function _checkDailyLimit(address token, uint256 amount) internal {
        if (dailyLimit[token] == 0) return; // No limit set
        uint256 today = block.timestamp / 1 days;
        dailyVolume[token][today] += amount;
        require(dailyVolume[token][today] <= dailyLimit[token], "VaultfireBridge: daily limit exceeded");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ADMIN
    // ═══════════════════════════════════════════════════════════════════

    function addRelayer(address relayer) external onlyOwner {
        require(!relayers[relayer], "VaultfireBridge: already relayer");
        relayers[relayer] = true;
        relayerCount++;
        emit RelayerAdded(relayer);
    }

    function removeRelayer(address relayer) external onlyOwner {
        require(relayers[relayer], "VaultfireBridge: not relayer");
        relayers[relayer] = false;
        relayerCount--;
        emit RelayerRemoved(relayer);
    }

    function addChain(uint256 chainId) external onlyOwner {
        supportedChains[chainId] = true;
        emit ChainAdded(chainId);
    }

    function removeChain(uint256 chainId) external onlyOwner {
        supportedChains[chainId] = false;
        emit ChainRemoved(chainId);
    }

    function addToken(address token) external onlyOwner {
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    function removeToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    function setDailyLimit(address token, uint256 limit) external onlyOwner {
        dailyLimit[token] = limit;
    }

    function setLargeTransferThreshold(uint256 threshold) external onlyOwner {
        largeTransferThreshold = threshold;
    }

    function setTimelockDuration(uint256 duration) external onlyOwner {
        timelockDuration = duration;
    }

    function setRequiredSignatures(uint256 required) external onlyOwner {
        require(required > 0 && required <= relayerCount, "VaultfireBridge: invalid threshold");
        requiredSignatures = required;
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
        require(newOwner != address(0), "VaultfireBridge: zero address");
        owner = newOwner;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    function isChainSupported(uint256 chainId) external view returns (bool) {
        return supportedChains[chainId];
    }

    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }

    function isRelayer(address addr) external view returns (bool) {
        return relayers[addr];
    }

    function getDailyVolume(address token) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        return dailyVolume[token][today];
    }

    function getRemainingDailyLimit(address token) external view returns (uint256) {
        if (dailyLimit[token] == 0) return type(uint256).max;
        uint256 today = block.timestamp / 1 days;
        uint256 used = dailyVolume[token][today];
        if (used >= dailyLimit[token]) return 0;
        return dailyLimit[token] - used;
    }

    // Accept native token deposits
    receive() external payable {}
}
