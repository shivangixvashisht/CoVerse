// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CollaborationRegistry
/// @notice Milestone-1 scaffold: records collaborative content projects and their
///         agreed revenue splits on-chain. It does NOT hold, receive or distribute
///         funds — payout logic will be added in a later, separately reviewed milestone.
contract CollaborationRegistry {
    /// @dev Basis points denominator: 10_000 bps == 100%.
    uint16 public constant TOTAL_BPS = 10_000;
    uint256 public constant MAX_CONTRIBUTORS = 50;

    enum ContentType {
        Music,
        Film,
        Documentary,
        Docuseries,
        LongFormVideo,
        ShortFormVideo,
        Podcast
    }

    struct Split {
        address contributor;
        uint16 shareBps;
    }

    struct Project {
        address owner;
        string title;
        ContentType contentType;
        uint64 createdAt;
    }

    uint256 public projectCount;
    mapping(uint256 => Project) private _projects;
    mapping(uint256 => Split[]) private _splits;

    event ProjectRegistered(
        uint256 indexed projectId,
        address indexed owner,
        ContentType contentType,
        string title
    );

    error EmptyTitle();
    error NoContributors();
    error TooManyContributors();
    error ZeroAddressContributor();
    error ZeroShare();
    error DuplicateContributor(address contributor);
    error SharesMustTotal100Percent(uint256 totalBps);
    error ProjectNotFound(uint256 projectId);

    /// @notice Register a project with a fixed revenue split.
    /// @return projectId The id of the new project (ids start at 1).
    function registerProject(
        string calldata title,
        ContentType contentType,
        Split[] calldata splits
    ) external returns (uint256 projectId) {
        if (bytes(title).length == 0) revert EmptyTitle();
        uint256 n = splits.length;
        if (n == 0) revert NoContributors();
        if (n > MAX_CONTRIBUTORS) revert TooManyContributors();

        uint256 total;
        for (uint256 i = 0; i < n; i++) {
            Split calldata s = splits[i];
            if (s.contributor == address(0)) revert ZeroAddressContributor();
            if (s.shareBps == 0) revert ZeroShare();
            for (uint256 j = 0; j < i; j++) {
                if (splits[j].contributor == s.contributor) revert DuplicateContributor(s.contributor);
            }
            total += s.shareBps;
        }
        if (total != TOTAL_BPS) revert SharesMustTotal100Percent(total);

        projectId = ++projectCount;
        _projects[projectId] = Project({
            owner: msg.sender,
            title: title,
            contentType: contentType,
            createdAt: uint64(block.timestamp)
        });
        Split[] storage stored = _splits[projectId];
        for (uint256 i = 0; i < n; i++) {
            stored.push(splits[i]);
        }

        emit ProjectRegistered(projectId, msg.sender, contentType, title);
    }

    function getProject(uint256 projectId) external view returns (Project memory) {
        if (projectId == 0 || projectId > projectCount) revert ProjectNotFound(projectId);
        return _projects[projectId];
    }

    function getSplits(uint256 projectId) external view returns (Split[] memory) {
        if (projectId == 0 || projectId > projectCount) revert ProjectNotFound(projectId);
        return _splits[projectId];
    }
}
