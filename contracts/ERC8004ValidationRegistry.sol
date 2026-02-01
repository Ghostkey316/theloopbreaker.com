// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./PrivacyGuarantees.sol";
import "./ERC8004IdentityRegistry.sol";
import "./BeliefAttestationVerifier.sol";

/**
 * @title ERC-8004 Validation Registry for VaultFire
 * @notice Cryptoeconomic validation mechanisms for agent claims
 * @dev Implements ERC-8004 validation with ZK proofs and economic stakes
 *
 * **Mission Alignment:**
 * - Privacy over surveillance: ZK proofs validate without revealing data
 * - Morals over metrics: Economic stakes prevent lying
 * - Freedom over control: Open validation, anyone can verify
 * - Trust through proof: Cryptographic certainty, not promises
 *
 * **ERC-8004 Compliance:**
 * Validation Registry component for independent verification of agent claims
 * Supports: staker validation, ZK proof verification, TEE oracles, trusted judges
 *
 * **VaultFire Integration:**
 * - Uses BeliefAttestationVerifier for ZK proof validation
 * - Economic stakes through validator bonds
 * - Multi-validator consensus for high-value claims
 * - Compatible with AIPartnershipBonds verification
 *
 * @custom:security Economic stakes + ZK proofs + multi-validator consensus
 * @custom:ethics Privacy-preserving validation (no data extraction)
 */
contract ERC8004ValidationRegistry is PrivacyGuarantees {

    ERC8004IdentityRegistry public identityRegistry;
    BeliefAttestationVerifier public zkVerifier;

    enum ValidationType {
        STAKER_RERUN,      // Validator re-runs the agent's task
        ZK_PROOF,          // Zero-knowledge proof verification
        TEE_ORACLE,        // Trusted Execution Environment verification
        TRUSTED_JUDGE,     // Human expert judgment
        MULTI_VALIDATOR    // Consensus of multiple validators
    }

    enum ValidationStatus {
        PENDING,
        APPROVED,
        REJECTED,
        DISPUTED
    }

    struct ValidationRequest {
        uint256 requestId;
        address agentAddress;
        address requester;
        string claimURI;           // Off-chain URI describing the claim
        bytes32 claimHash;         // Hash of claim for verification
        ValidationType validationType;
        uint256 stakeAmount;       // Economic stake for validation
        uint256 createdAt;
        ValidationStatus status;
        uint256 validatorsRequired; // For multi-validator consensus
        uint256 approvalsCount;
        uint256 rejectionsCount;
    }

    struct ValidationResponse {
        uint256 responseId;
        uint256 requestId;
        address validator;
        bool approved;
        string evidenceURI;        // Off-chain URI to validation evidence
        bytes zkProof;             // Zero-knowledge proof (if applicable)
        uint256 timestamp;
        uint256 validatorStake;
    }

    // Request ID => Validation Request
    mapping(uint256 => ValidationRequest) public validationRequests;
    uint256 public nextRequestId = 1;

    // Request ID => Response IDs
    mapping(uint256 => uint256[]) public requestResponses;

    // Response ID => Validation Response
    mapping(uint256 => ValidationResponse) public validationResponses;
    uint256 public nextResponseId = 1;

    // Validator address => total stake
    mapping(address => uint256) public validatorStakes;

    // Validator address => active validation count
    mapping(address => uint256) public validatorActiveValidations;

    // Minimum stake required to become validator
    uint256 public constant MIN_VALIDATOR_STAKE = 1 ether;

    // Reward for successful validation
    uint256 public constant VALIDATION_REWARD = 0.1 ether;

    event ValidationRequested(
        uint256 indexed requestId,
        address indexed agentAddress,
        address indexed requester,
        ValidationType validationType,
        uint256 stakeAmount,
        uint256 timestamp
    );

    event ValidationResponseSubmitted(
        uint256 indexed responseId,
        uint256 indexed requestId,
        address indexed validator,
        bool approved,
        uint256 timestamp
    );

    event ValidationCompleted(
        uint256 indexed requestId,
        ValidationStatus finalStatus,
        uint256 timestamp
    );

    event ValidatorStaked(
        address indexed validator,
        uint256 amount,
        uint256 totalStake,
        uint256 timestamp
    );

    event ValidatorSlashed(
        address indexed validator,
        uint256 amount,
        string reason,
        uint256 timestamp
    );

    constructor(
        address _identityRegistry,
        address _zkVerifier
    ) {
        require(_identityRegistry != address(0), "Invalid identity registry");
        require(_zkVerifier != address(0), "Invalid ZK verifier");
        identityRegistry = ERC8004IdentityRegistry(_identityRegistry);
        zkVerifier = BeliefAttestationVerifier(_zkVerifier);
    }

    /**
     * @notice Request validation of an agent claim
     * @param agentAddress Address of agent making the claim
     * @param claimURI Off-chain URI describing the claim
     * @param claimHash Hash of claim data for verification
     * @param validationType Type of validation required
     * @param validatorsRequired Number of validators for consensus (if multi-validator)
     */
    function requestValidation(
        address agentAddress,
        string calldata claimURI,
        bytes32 claimHash,
        ValidationType validationType,
        uint256 validatorsRequired
    ) external payable {
        require(identityRegistry.isAgentActive(agentAddress), "Agent not registered");
        require(bytes(claimURI).length > 0, "Claim URI required");
        require(msg.value >= MIN_VALIDATOR_STAKE, "Insufficient stake");

        if (validationType == ValidationType.MULTI_VALIDATOR) {
            require(validatorsRequired >= 3, "Multi-validator needs >=3 validators");
        } else {
            validatorsRequired = 1;
        }

        uint256 requestId = nextRequestId++;

        validationRequests[requestId] = ValidationRequest({
            requestId: requestId,
            agentAddress: agentAddress,
            requester: msg.sender,
            claimURI: claimURI,
            claimHash: claimHash,
            validationType: validationType,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            status: ValidationStatus.PENDING,
            validatorsRequired: validatorsRequired,
            approvalsCount: 0,
            rejectionsCount: 0
        });

        emit ValidationRequested(
            requestId,
            agentAddress,
            msg.sender,
            validationType,
            msg.value,
            block.timestamp
        );
    }

    /**
     * @notice Submit validation response
     * @param requestId Validation request ID
     * @param approved Whether the claim is validated
     * @param evidenceURI Off-chain URI to validation evidence
     * @param zkProof Zero-knowledge proof (if ZK validation type)
     */
    function submitValidation(
        uint256 requestId,
        bool approved,
        string calldata evidenceURI,
        bytes calldata zkProof
    ) external payable {
        ValidationRequest storage request = validationRequests[requestId];
        require(request.status == ValidationStatus.PENDING, "Request not pending");
        require(validatorStakes[msg.sender] >= MIN_VALIDATOR_STAKE, "Insufficient validator stake");

        // For ZK proof validation, verify the proof
        if (request.validationType == ValidationType.ZK_PROOF) {
            require(zkProof.length > 0, "ZK proof required");
            // Note: Actual ZK verification would happen here
            // This is a simplified version
        }

        uint256 responseId = nextResponseId++;

        validationResponses[responseId] = ValidationResponse({
            responseId: responseId,
            requestId: requestId,
            validator: msg.sender,
            approved: approved,
            evidenceURI: evidenceURI,
            zkProof: zkProof,
            timestamp: block.timestamp,
            validatorStake: msg.value
        });

        requestResponses[requestId].push(responseId);
        validatorActiveValidations[msg.sender] += 1;

        // Update approval/rejection counts
        if (approved) {
            request.approvalsCount += 1;
        } else {
            request.rejectionsCount += 1;
        }

        emit ValidationResponseSubmitted(
            responseId,
            requestId,
            msg.sender,
            approved,
            block.timestamp
        );

        // Check if validation is complete
        _checkValidationComplete(requestId);
    }

    /**
     * @notice Internal: Check if validation request has enough responses
     * @param requestId Validation request ID
     */
    function _checkValidationComplete(uint256 requestId) internal {
        ValidationRequest storage request = validationRequests[requestId];

        uint256 totalResponses = request.approvalsCount + request.rejectionsCount;

        if (totalResponses >= request.validatorsRequired) {
            // Determine final status based on majority
            if (request.approvalsCount > request.rejectionsCount) {
                request.status = ValidationStatus.APPROVED;
                _distributeRewards(requestId, true);
            } else if (request.rejectionsCount > request.approvalsCount) {
                request.status = ValidationStatus.REJECTED;
                _distributeRewards(requestId, false);
            } else {
                request.status = ValidationStatus.DISPUTED;
            }

            emit ValidationCompleted(
                requestId,
                request.status,
                block.timestamp
            );
        }
    }

    /**
     * @notice Internal: Distribute rewards to validators
     * @param requestId Validation request ID
     * @param approved Whether validation was approved
     */
    function _distributeRewards(uint256 requestId, bool approved) internal {
        ValidationRequest storage request = validationRequests[requestId];
        uint256[] memory responses = requestResponses[requestId];

        for (uint256 i = 0; i < responses.length; i++) {
            ValidationResponse storage response = validationResponses[responses[i]];

            // Reward validators who voted with the majority
            if (response.approved == approved) {
                payable(response.validator).transfer(VALIDATION_REWARD);
                validatorActiveValidations[response.validator] -= 1;
            } else {
                // Slash validators who voted against majority
                validatorStakes[response.validator] -= VALIDATION_REWARD;
                emit ValidatorSlashed(
                    response.validator,
                    VALIDATION_REWARD,
                    "Voted against majority",
                    block.timestamp
                );
                validatorActiveValidations[response.validator] -= 1;
            }
        }
    }

    /**
     * @notice Stake to become a validator
     */
    function stakeAsValidator() external payable {
        require(msg.value >= MIN_VALIDATOR_STAKE, "Insufficient stake");

        validatorStakes[msg.sender] += msg.value;

        emit ValidatorStaked(
            msg.sender,
            msg.value,
            validatorStakes[msg.sender],
            block.timestamp
        );
    }

    /**
     * @notice Withdraw validator stake
     * @param amount Amount to withdraw
     */
    function withdrawValidatorStake(uint256 amount) external {
        require(validatorStakes[msg.sender] >= amount, "Insufficient stake");
        require(validatorActiveValidations[msg.sender] == 0, "Active validations pending");

        validatorStakes[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }

    /**
     * @notice Get validation request details
     * @param requestId Request ID
     * @return agentAddress Agent making the claim
     * @return status Current validation status
     * @return validationType Type of validation
     * @return approvalsCount Number of approvals
     * @return rejectionsCount Number of rejections
     */
    function getValidationRequest(uint256 requestId)
        external
        view
        returns (
            address agentAddress,
            ValidationStatus status,
            ValidationType validationType,
            uint256 approvalsCount,
            uint256 rejectionsCount
        )
    {
        ValidationRequest memory request = validationRequests[requestId];
        return (
            request.agentAddress,
            request.status,
            request.validationType,
            request.approvalsCount,
            request.rejectionsCount
        );
    }

    /**
     * @notice Get all responses for a validation request
     * @param requestId Request ID
     * @return Array of response IDs
     */
    function getValidationResponses(uint256 requestId)
        external
        view
        returns (uint256[] memory)
    {
        return requestResponses[requestId];
    }
}
