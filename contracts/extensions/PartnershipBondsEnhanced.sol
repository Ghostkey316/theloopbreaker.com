// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../AIPartnershipBondsV2.sol";

/**
 * @title PartnershipBondsEnhanced
 * @notice Enhanced version of AIPartnershipBondsV2 with additional view functions for UI/API optimization
 * @dev Extends base contract with batch operations and summary views
 *
 * **Why This Exists:**
 * - Reduces RPC calls for dashboards/UIs (1 call vs many)
 * - Gas-free batch data retrieval
 * - Better developer experience for integrations
 * - Optimized for subgraph/indexer-less setups
 *
 * @custom:enhancement Added as part of 100K-level audit (2026-01-27)
 */
contract PartnershipBondsEnhanced is AIPartnershipBondsV2 {

    /**
     * @notice Partnership summary for UI display
     * @dev Combines multiple view calls into one
     */
    struct PartnershipSummary {
        uint256 bondId;
        address human;
        address aiAgent;
        string partnershipType;
        uint256 stakeAmount;
        uint256 createdAt;
        uint256 durationDays;
        uint256 qualityScore;
        uint256 loyaltyMultiplier;
        uint256 currentValue;
        int256 appreciation;
        bool distributionPending;
        bool active;
    }

    /**
     * @notice Get comprehensive partnership summary
     * @dev Single call to get all partnership information
     * @param bondId ID of bond to summarize
     * @return summary Complete partnership summary struct
     */
    function getPartnershipSummary(uint256 bondId)
        external
        view
        bondExists(bondId)
        returns (PartnershipSummary memory summary)
    {
        Bond memory bond = bonds[bondId];

        summary.bondId = bondId;
        summary.human = bond.human;
        summary.aiAgent = bond.aiAgent;
        summary.partnershipType = bond.partnershipType;
        summary.stakeAmount = bond.stakeAmount;
        summary.createdAt = bond.createdAt;
        summary.durationDays = (block.timestamp - bond.createdAt) / 1 days;
        summary.qualityScore = partnershipQualityScore(bondId);
        summary.loyaltyMultiplier = loyaltyMultiplier(bondId);
        summary.currentValue = calculateBondValue(bondId);
        summary.appreciation = calculateAppreciation(bondId);
        summary.distributionPending = bond.distributionPending;
        summary.active = bond.active;
    }

    /**
     * @notice Get multiple partnership summaries in one call
     * @dev Gas-efficient batch retrieval for dashboards
     * @param bondIds Array of bond IDs to retrieve
     * @return summaries Array of partnership summaries
     */
    function getPartnershipSummariesBatch(uint256[] calldata bondIds)
        external
        view
        returns (PartnershipSummary[] memory summaries)
    {
        summaries = new PartnershipSummary[](bondIds.length);

        for (uint256 i = 0; i < bondIds.length; i++) {
            if (bonds[bondIds[i]].active) {
                Bond memory bond = bonds[bondIds[i]];

                summaries[i].bondId = bondIds[i];
                summaries[i].human = bond.human;
                summaries[i].aiAgent = bond.aiAgent;
                summaries[i].partnershipType = bond.partnershipType;
                summaries[i].stakeAmount = bond.stakeAmount;
                summaries[i].createdAt = bond.createdAt;
                summaries[i].durationDays = (block.timestamp - bond.createdAt) / 1 days;
                summaries[i].qualityScore = partnershipQualityScore(bondIds[i]);
                summaries[i].loyaltyMultiplier = loyaltyMultiplier(bondIds[i]);
                summaries[i].currentValue = calculateBondValue(bondIds[i]);
                summaries[i].appreciation = calculateAppreciation(bondIds[i]);
                summaries[i].distributionPending = bond.distributionPending;
                summaries[i].active = bond.active;
            }
        }
    }

    /**
     * @notice Get all bonds for a human participant
     * @param human Address of human to query
     * @return bondIds Array of bond IDs where human is participant
     */
    function getBondsByHuman(address human) external view returns (uint256[] memory bondIds) {
        // Count bonds first
        uint256 count = 0;
        for (uint256 i = 1; i < nextBondId; i++) {
            if (bonds[i].human == human && bonds[i].active) {
                count++;
            }
        }

        // Populate array
        bondIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i < nextBondId; i++) {
            if (bonds[i].human == human && bonds[i].active) {
                bondIds[index] = i;
                index++;
            }
        }
    }

    /**
     * @notice Get all bonds for an AI agent
     * @param aiAgent Address of AI agent to query
     * @return bondIds Array of bond IDs where AI is participant
     */
    function getBondsByAI(address aiAgent) external view returns (uint256[] memory bondIds) {
        // Count bonds first
        uint256 count = 0;
        for (uint256 i = 1; i < nextBondId; i++) {
            if (bonds[i].aiAgent == aiAgent && bonds[i].active) {
                count++;
            }
        }

        // Populate array
        bondIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i < nextBondId; i++) {
            if (bonds[i].aiAgent == aiAgent && bonds[i].active) {
                bondIds[index] = i;
                index++;
            }
        }
    }

    /**
     * @notice Get partnership duration in days
     * @param bondId ID of bond
     * @return duration Duration in days since creation
     */
    function getPartnershipDuration(uint256 bondId)
        external
        view
        bondExists(bondId)
        returns (uint256 duration)
    {
        return (block.timestamp - bonds[bondId].createdAt) / 1 days;
    }

    /**
     * @notice Get latest partnership metrics
     * @param bondId ID of bond
     * @return metrics Latest partnership metrics struct
     */
    function getLatestMetrics(uint256 bondId)
        external
        view
        bondExists(bondId)
        returns (PartnershipMetrics memory metrics)
    {
        require(bondMetrics[bondId].length > 0, "No metrics submitted");
        return bondMetrics[bondId][bondMetrics[bondId].length - 1];
    }

    /**
     * @notice Get latest human verification
     * @param bondId ID of bond
     * @return verification Latest verification struct
     */
    function getLatestVerification(uint256 bondId)
        external
        view
        bondExists(bondId)
        returns (HumanVerification memory verification)
    {
        require(bondVerifications[bondId].length > 0, "No verifications submitted");
        return bondVerifications[bondId][bondVerifications[bondId].length - 1];
    }

    /**
     * @notice Get metrics count for a bond
     * @param bondId ID of bond
     * @return count Number of metrics submissions
     */
    function getMetricsCount(uint256 bondId)
        external
        view
        bondExists(bondId)
        returns (uint256 count)
    {
        return bondMetrics[bondId].length;
    }

    /**
     * @notice Get verification count for a bond
     * @param bondId ID of bond
     * @return count Number of verification submissions
     */
    function getVerificationCount(uint256 bondId)
        external
        view
        bondExists(bondId)
        returns (uint256 count)
    {
        return bondVerifications[bondId].length;
    }

    /**
     * @notice Check if bond can be distributed
     * @dev Useful for UI to show "ready to distribute" status
     * @param bondId ID of bond
     * @return canDistribute Whether distribution is available
     * @return reason Human-readable reason if cannot distribute
     */
    function canDistribute(uint256 bondId)
        external
        view
        bondExists(bondId)
        returns (bool canDistribute, string memory reason)
    {
        Bond storage bond = bonds[bondId];

        if (!bond.distributionPending) {
            return (false, "Distribution not requested");
        }

        if (block.timestamp < bond.distributionRequestedAt + DISTRIBUTION_TIMELOCK) {
            uint256 remainingTime = (bond.distributionRequestedAt + DISTRIBUTION_TIMELOCK) - block.timestamp;
            return (false, string(abi.encodePacked("Timelock: ", uint2str(remainingTime / 3600), " hours remaining")));
        }

        int256 appreciation = calculateAppreciation(bondId);
        if (appreciation == 0) {
            return (false, "No appreciation to distribute");
        }

        return (true, "Ready to distribute");
    }

    /**
     * @notice Get protocol-wide statistics
     * @return totalBonds Total bonds created
     * @return activeBonds Active bonds count
     * @return totalStaked Total ETH staked
     * @return totalDistributed Total ETH distributed
     */
    function getProtocolStats()
        external
        view
        returns (
            uint256 totalBonds,
            uint256 activeBonds,
            uint256 totalStaked,
            uint256 totalDistributed
        )
    {
        totalBonds = nextBondId - 1;

        // Count active bonds and calculate totals
        for (uint256 i = 1; i < nextBondId; i++) {
            if (bonds[i].active) {
                activeBonds++;
                totalStaked += bonds[i].stakeAmount;
            }

            // Sum all distributions for this bond
            for (uint256 j = 0; j < bondDistributions[i].length; j++) {
                Distribution storage dist = bondDistributions[i][j];
                if (dist.totalAmount > 0) {
                    totalDistributed += uint256(dist.totalAmount);
                }
            }
        }
    }

    /**
     * @notice Convert uint to string (internal utility)
     */
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k-1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
