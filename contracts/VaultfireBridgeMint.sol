// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title VaultfireBridgeMint
 * @notice Mint/burn contract for Vaultfire cross-chain bridge (destination side).
 * @dev Deployed on destination chains (Base, Avalanche).
 *      When tokens are locked on the source chain, this contract mints
 *      wrapped equivalents. When users want to bridge back, they burn
 *      the wrapped tokens here, and the source chain unlocks the originals.
 *
 * @custom:status TESTNET — Pending audit before mainnet activation
 * @custom:author Vaultfire Protocol
 */

contract VaultfireBridgeMint {

    // ═══════════════════════════════════════════════════════════════════
    //  WRAPPED TOKEN
    // ═══════════════════════════════════════════════════════════════════

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ═══════════════════════════════════════════════════════════════════
    //  BRIDGE STATE
    // ═══════════════════════════════════════════════════════════════════

    address public owner;
    bool public paused;

    /// @notice Authorized relayers
    mapping(address => bool) public relayers;
    uint256 public relayerCount;

    /// @notice Processed mint hashes (prevents double-mint)
    mapping(bytes32 => bool) public processedMints;

    /// @notice Source chain ID this bridge is paired with
    uint256 public sourceChainId;

    /// @notice Bridge nonce for burn events
    uint256 public burnNonce;

    // ═══════════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════════

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    event Mint(
        address indexed recipient,
        uint256 amount,
        uint256 indexed sourceChainId,
        bytes32 lockHash,
        uint256 timestamp
    );

    event Burn(
        address indexed sender,
        uint256 amount,
        uint256 indexed destChainId,
        address destAddress,
        uint256 nonce,
        uint256 timestamp
    );

    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ═══════════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ═══════════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "VaultfireBridgeMint: not owner");
        _;
    }

    modifier onlyRelayer() {
        require(relayers[msg.sender], "VaultfireBridgeMint: not relayer");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "VaultfireBridgeMint: paused");
        _;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════

    constructor(string memory _name, string memory _symbol, uint256 _sourceChainId) {
        owner = msg.sender;
        name = _name;
        symbol = _symbol;
        sourceChainId = _sourceChainId;

        // Owner is first relayer
        relayers[msg.sender] = true;
        relayerCount = 1;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ERC-20 FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "VaultfireBridgeMint: zero address");
        require(balanceOf[msg.sender] >= amount, "VaultfireBridgeMint: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(to != address(0), "VaultfireBridgeMint: zero address");
        require(balanceOf[from] >= amount, "VaultfireBridgeMint: insufficient balance");
        require(allowance[from][msg.sender] >= amount, "VaultfireBridgeMint: insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  MINT (Relayer → User, after Lock on source chain)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Mint wrapped tokens after verifying a Lock event on the source chain.
     * @param recipient Recipient address
     * @param amount Amount to mint
     * @param lockHash Hash of the Lock event for deduplication
     */
    function mint(
        address recipient,
        uint256 amount,
        bytes32 lockHash
    ) external onlyRelayer whenNotPaused {
        require(!processedMints[lockHash], "VaultfireBridgeMint: already processed");
        require(recipient != address(0), "VaultfireBridgeMint: zero address");
        require(amount > 0, "VaultfireBridgeMint: zero amount");

        processedMints[lockHash] = true;
        totalSupply += amount;
        balanceOf[recipient] += amount;

        emit Transfer(address(0), recipient, amount);
        emit Mint(recipient, amount, sourceChainId, lockHash, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  BURN (User → Bridge, to unlock on source chain)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Burn wrapped tokens to initiate unlock on the source chain.
     * @param amount Amount to burn
     * @param destChainId Destination chain ID (source chain where originals are locked)
     * @param destAddress Recipient address on destination chain
     */
    function burn(uint256 amount, uint256 destChainId, address destAddress) external whenNotPaused {
        require(amount > 0, "VaultfireBridgeMint: zero amount");
        require(balanceOf[msg.sender] >= amount, "VaultfireBridgeMint: insufficient balance");
        require(destAddress != address(0), "VaultfireBridgeMint: zero address");

        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;

        uint256 nonce = burnNonce++;

        emit Transfer(msg.sender, address(0), amount);
        emit Burn(msg.sender, amount, destChainId, destAddress, nonce, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ADMIN
    // ═══════════════════════════════════════════════════════════════════

    function addRelayer(address relayer) external onlyOwner {
        require(!relayers[relayer], "VaultfireBridgeMint: already relayer");
        relayers[relayer] = true;
        relayerCount++;
        emit RelayerAdded(relayer);
    }

    function removeRelayer(address relayer) external onlyOwner {
        require(relayers[relayer], "VaultfireBridgeMint: not relayer");
        relayers[relayer] = false;
        relayerCount--;
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

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "VaultfireBridgeMint: zero address");
        owner = newOwner;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    function isRelayer(address addr) external view returns (bool) {
        return relayers[addr];
    }

    function isMintProcessed(bytes32 lockHash) external view returns (bool) {
        return processedMints[lockHash];
    }
}
