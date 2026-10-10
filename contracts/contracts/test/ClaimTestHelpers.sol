// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// TEST-ONLY helper contracts used by the Hardhat test suite. Not part of the product.

interface IRegistry {
    function approveProposal(uint256 proposalId) external;
    function claimAll(uint256 projectId) external returns (uint256);
    function claim(uint256 projectId, uint256 amount) external;
}

/// @dev A contributor that tries to re-enter the registry while receiving a payout.
contract ReentrantClaimer {
    IRegistry public immutable registry;
    uint256 public projectId;
    uint256 public reentryAttempts;
    bool public reentryBlocked;

    constructor(IRegistry registry_) {
        registry = registry_;
    }

    function approve(uint256 proposalId) external {
        registry.approveProposal(proposalId);
    }

    function attack(uint256 projectId_) external {
        projectId = projectId_;
        registry.claimAll(projectId_);
    }

    receive() external payable {
        reentryAttempts++;
        try registry.claimAll(projectId) {
            // Would mean a double claim succeeded.
        } catch {
            reentryBlocked = true;
        }
    }
}

/// @dev A contributor whose wallet cannot accept ETH.
contract RejectingReceiver {
    IRegistry public immutable registry;

    constructor(IRegistry registry_) {
        registry = registry_;
    }

    function approve(uint256 proposalId) external {
        registry.approveProposal(proposalId);
    }

    function claimAll(uint256 projectId) external {
        registry.claimAll(projectId);
    }

    receive() external payable {
        revert("no ETH accepted");
    }
}
