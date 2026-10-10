// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CollaborationRegistry
/// @notice Records collaborative content projects, their revenue-split agreements, and
///         the revenue (native ETH) deposited for them.
///
///         Agreements are versioned and immutable. A new version only becomes active
///         after every required contributor has approved it with a transaction from
///         their own wallet. Historical versions are never modified or deleted.
///
///         Each deposit is attributed to the agreement version active at the time and is
///         fully allocated to that version's contributors when it arrives. Contributors
///         withdraw their own balances with `claim` / `claimAll` (pull payments).
///         Not audited — local test networks only. See docs/ARCHITECTURE.md.
contract CollaborationRegistry {
    // ---------------------------------------------------------------------
    // Constants & types
    // ---------------------------------------------------------------------

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

    /// @dev `Superseded` is never stored; it is derived for pending proposals whose base
    ///      version is no longer the active version (see `getProposal`).
    enum ProposalStatus {
        Pending,
        Activated,
        Rejected,
        Cancelled,
        Superseded
    }

    enum Vote {
        None,
        Approved,
        Rejected
    }

    struct Split {
        address contributor;
        uint16 shareBps;
    }

    struct Project {
        address creator;
        string title;
        ContentType contentType;
        uint64 createdAt;
        /// @dev 0 until the initial agreement is activated. Versions are 1..activeVersion.
        uint32 activeVersion;
    }

    struct AgreementVersion {
        uint256 proposalId;
        uint64 activatedAt;
        uint64 activatedBlock;
    }

    struct Deposit {
        uint256 projectId;
        uint32 version;
        address depositor;
        uint256 amount;
        uint64 depositedAt;
    }

    struct Proposal {
        uint256 projectId;
        address proposer;
        /// @dev The active version when the proposal was created (0 for an initial agreement).
        uint32 baseVersion;
        ProposalStatus status;
        uint64 createdAt;
        uint32 approvalCount;
        uint32 requiredCount;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    uint256 public projectCount;
    uint256 public proposalCount;

    mapping(uint256 projectId => Project) private _projects;

    // Agreement versions: written once on activation, never modified or deleted.
    mapping(uint256 projectId => mapping(uint32 version => AgreementVersion)) private _versions;
    mapping(uint256 projectId => mapping(uint32 version => Split[])) private _versionSplits;
    mapping(uint256 projectId => mapping(uint32 version => mapping(address => uint16))) private _versionShare;

    mapping(uint256 proposalId => Proposal) private _proposals;
    mapping(uint256 proposalId => Split[]) private _proposedSplits;
    mapping(uint256 proposalId => address[]) private _requiredApprovers;
    mapping(uint256 proposalId => mapping(address => bool)) private _isRequired;
    mapping(uint256 proposalId => mapping(address => Vote)) private _votes;

    // Revenue accounting. Invariant: address(this).balance ==
    //   sum over projects of (_totalDeposited - _totalClaimed) == sum of all unclaimed balances.
    uint256 public depositCount;
    mapping(uint256 depositId => Deposit) private _deposits;
    mapping(uint256 projectId => mapping(uint32 version => uint256)) private _versionRevenue;
    mapping(uint256 projectId => mapping(uint32 version => mapping(address => uint256))) private _earnedInVersion;
    mapping(uint256 projectId => mapping(address => uint256)) private _earned;
    mapping(uint256 projectId => mapping(address => uint256)) private _claimed;
    mapping(uint256 projectId => uint256) private _totalDeposited;
    mapping(uint256 projectId => uint256) private _totalClaimed;

    uint256 private _lock = 1;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event ProjectCreated(uint256 indexed projectId, address indexed creator, ContentType contentType, string title);
    event ProposalCreated(
        uint256 indexed projectId,
        uint256 indexed proposalId,
        address indexed proposer,
        uint32 baseVersion,
        uint32 requiredApprovals
    );
    event ProposalApproved(
        uint256 indexed projectId,
        uint256 indexed proposalId,
        address indexed approver,
        uint32 approvalCount,
        uint32 requiredApprovals
    );
    event ProposalRejected(uint256 indexed projectId, uint256 indexed proposalId, address indexed rejecter);
    event ProposalCancelled(uint256 indexed projectId, uint256 indexed proposalId, address indexed proposer);
    event AgreementActivated(uint256 indexed projectId, uint32 indexed version, uint256 indexed proposalId);
    event RevenueDeposited(
        uint256 indexed projectId,
        uint32 indexed version,
        uint256 indexed depositId,
        address depositor,
        uint256 amount
    );
    /// @notice The rounding remainder of a deposit (always fewer wei than the number of
    ///         contributors) was credited to `recipient`, the largest-share contributor.
    event RemainderAllocated(uint256 indexed projectId, uint256 indexed depositId, address indexed recipient, uint256 amount);
    event RevenueClaimed(uint256 indexed projectId, address indexed contributor, uint256 amount);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error EmptyTitle();
    error NoContributors();
    error TooManyContributors();
    error ZeroAddressContributor();
    error ZeroShare(address contributor);
    error DuplicateContributor(address contributor);
    error SharesMustTotal100Percent(uint256 totalBps);
    error NoChange();
    error ProjectNotFound(uint256 projectId);
    error VersionNotFound(uint256 projectId, uint32 version);
    error ProposalNotFound(uint256 proposalId);
    error NotAuthorizedProposer(address account);
    error NotRequiredApprover(address account);
    error AlreadyVoted(address account);
    error ProposalNotPending(uint256 proposalId, ProposalStatus status);
    error ProposalSuperseded(uint256 proposalId);
    error MissingApprovals(uint32 approvals, uint32 required);
    error NotProposer(address account);
    error NoActiveAgreement(uint256 projectId);
    error VersionMismatch(uint32 expected, uint32 active);
    error ZeroDeposit();
    error ZeroClaim();
    error NothingToClaim();
    error InsufficientBalance(uint256 available, uint256 requested);
    error TransferFailed();
    error DepositNotFound(uint256 depositId);
    error ReentrantCall();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier nonReentrant() {
        if (_lock != 1) revert ReentrantCall();
        _lock = 2;
        _;
        _lock = 1;
    }

    // ---------------------------------------------------------------------
    // Proposing
    // ---------------------------------------------------------------------

    /// @notice Create a project and propose its initial agreement (version 1).
    ///         Nothing is binding until every listed contributor approves and the
    ///         proposal is activated. The creator does not need to be a contributor.
    function createProject(
        string calldata title,
        ContentType contentType,
        Split[] calldata splits
    ) external returns (uint256 projectId, uint256 proposalId) {
        if (bytes(title).length == 0) revert EmptyTitle();

        projectId = ++projectCount;
        Project storage project = _projects[projectId];
        project.creator = msg.sender;
        project.title = title;
        project.contentType = contentType;
        project.createdAt = uint64(block.timestamp);

        emit ProjectCreated(projectId, msg.sender, contentType, title);
        proposalId = _propose(projectId, 0, splits);
    }

    /// @notice Propose a new agreement version: a complete replacement contributor list,
    ///         which may add contributors, remove contributors and/or change shares.
    /// @dev Policy: before any agreement is active only the project creator may propose
    ///      (e.g. a new initial agreement after a rejection); afterwards only contributors
    ///      active under the current agreement may propose.
    function proposeAgreement(uint256 projectId, Split[] calldata splits) external returns (uint256 proposalId) {
        Project storage project = _project(projectId);
        uint32 active = project.activeVersion;
        bool authorized = active == 0
            ? msg.sender == project.creator
            : _versionShare[projectId][active][msg.sender] != 0;
        if (!authorized) revert NotAuthorizedProposer(msg.sender);

        proposalId = _propose(projectId, active, splits);
    }

    /// @notice Withdraw a pending proposal. Only its proposer may cancel it.
    function cancelProposal(uint256 proposalId) external {
        Proposal storage p = _proposal(proposalId);
        if (p.status != ProposalStatus.Pending) revert ProposalNotPending(proposalId, p.status);
        if (msg.sender != p.proposer) revert NotProposer(msg.sender);
        p.status = ProposalStatus.Cancelled;
        emit ProposalCancelled(p.projectId, proposalId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Voting
    // ---------------------------------------------------------------------

    /// @notice Approve a pending proposal. Must be sent by the approving contributor's own wallet.
    function approveProposal(uint256 proposalId) external {
        Proposal storage p = _votableProposal(proposalId);
        _recordVote(proposalId, Vote.Approved);
        uint32 approvals = ++p.approvalCount;
        emit ProposalApproved(p.projectId, proposalId, msg.sender, approvals, p.requiredCount);
    }

    /// @notice Reject a pending proposal. A single rejection by a required approver
    ///         permanently rejects it; a fresh proposal is needed to try again.
    function rejectProposal(uint256 proposalId) external {
        Proposal storage p = _votableProposal(proposalId);
        _recordVote(proposalId, Vote.Rejected);
        p.status = ProposalStatus.Rejected;
        emit ProposalRejected(p.projectId, proposalId, msg.sender);
    }

    /// @notice Activate a proposal once every required approver has approved it.
    /// @dev Callable by anyone: every condition is enforced on-chain, so the caller
    ///      cannot influence the outcome.
    function activateProposal(uint256 proposalId) external returns (uint32 version) {
        Proposal storage p = _votableProposal(proposalId);
        if (p.approvalCount != p.requiredCount) revert MissingApprovals(p.approvalCount, p.requiredCount);

        uint256 projectId = p.projectId;
        version = p.baseVersion + 1;

        _versions[projectId][version] = AgreementVersion({
            proposalId: proposalId,
            activatedAt: uint64(block.timestamp),
            activatedBlock: uint64(block.number)
        });
        Split[] storage proposed = _proposedSplits[proposalId];
        Split[] storage stored = _versionSplits[projectId][version];
        for (uint256 i = 0; i < proposed.length; i++) {
            stored.push(proposed[i]);
            _versionShare[projectId][version][proposed[i].contributor] = proposed[i].shareBps;
        }

        p.status = ProposalStatus.Activated;
        _projects[projectId].activeVersion = version;
        emit AgreementActivated(projectId, version, proposalId);
    }

    // ---------------------------------------------------------------------
    // Revenue
    // ---------------------------------------------------------------------

    /// @notice Deposit native ETH revenue for a project. It is attributed to the active
    ///         agreement version and allocated to that version's contributors immediately.
    /// @param expectedVersion The version the depositor intends to fund. The call reverts if
    ///        a different version is active, so a deposit can never land under a split the
    ///        depositor did not expect (e.g. if a new version activates in the same block).
    function deposit(uint256 projectId, uint32 expectedVersion) external payable nonReentrant returns (uint256 depositId) {
        uint32 version = _project(projectId).activeVersion;
        if (version == 0) revert NoActiveAgreement(projectId);
        if (version != expectedVersion) revert VersionMismatch(expectedVersion, version);
        uint256 amount = msg.value;
        if (amount == 0) revert ZeroDeposit();

        depositId = ++depositCount;
        _deposits[depositId] = Deposit({
            projectId: projectId,
            version: version,
            depositor: msg.sender,
            amount: amount,
            depositedAt: uint64(block.timestamp)
        });
        _versionRevenue[projectId][version] += amount;
        _totalDeposited[projectId] += amount;
        emit RevenueDeposited(projectId, version, depositId, msg.sender, amount);

        // Allocate floor(amount * share / TOTAL_BPS) to each contributor; the sum can only
        // fall short of `amount`, never exceed it.
        Split[] storage splits = _versionSplits[projectId][version];
        uint256 allocated;
        uint256 largest;
        for (uint256 i = 0; i < splits.length; i++) {
            uint256 portion = (amount * splits[i].shareBps) / TOTAL_BPS;
            allocated += portion;
            _credit(projectId, version, splits[i].contributor, portion);
            if (splits[i].shareBps > splits[largest].shareBps) largest = i;
        }

        // Credit the remainder explicitly so every wei of the deposit is allocated.
        uint256 remainder = amount - allocated;
        if (remainder != 0) {
            address recipient = splits[largest].contributor;
            _credit(projectId, version, recipient, remainder);
            emit RemainderAllocated(projectId, depositId, recipient, remainder);
        }
    }

    /// @notice Withdraw `amount` of the caller's own unclaimed earnings from a project.
    ///         Funds are only ever sent to `msg.sender`.
    function claim(uint256 projectId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroClaim();
        _claim(projectId, amount);
    }

    /// @notice Withdraw all of the caller's unclaimed earnings from a project.
    function claimAll(uint256 projectId) external nonReentrant returns (uint256 amount) {
        amount = claimable(projectId, msg.sender);
        if (amount == 0) revert NothingToClaim();
        _claim(projectId, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getProject(uint256 projectId) external view returns (Project memory) {
        return _project(projectId);
    }

    /// @notice Read any historical or current agreement version.
    function getAgreement(
        uint256 projectId,
        uint32 version
    ) public view returns (AgreementVersion memory info, Split[] memory splits) {
        Project storage project = _project(projectId);
        if (version == 0 || version > project.activeVersion) revert VersionNotFound(projectId, version);
        return (_versions[projectId][version], _versionSplits[projectId][version]);
    }

    /// @notice The currently active agreement. Reverts if none has been activated yet.
    function getActiveAgreement(
        uint256 projectId
    ) external view returns (uint32 version, AgreementVersion memory info, Split[] memory splits) {
        version = _project(projectId).activeVersion;
        (info, splits) = getAgreement(projectId, version);
    }

    /// @notice A contributor's share under a specific version (0 if not a contributor).
    function shareInVersion(uint256 projectId, uint32 version, address account) external view returns (uint16) {
        Project storage project = _project(projectId);
        if (version == 0 || version > project.activeVersion) revert VersionNotFound(projectId, version);
        return _versionShare[projectId][version][account];
    }

    function isActiveContributor(uint256 projectId, address account) external view returns (bool) {
        uint32 active = _project(projectId).activeVersion;
        return active != 0 && _versionShare[projectId][active][account] != 0;
    }

    /// @notice Proposal details with its effective status (pending proposals whose base
    ///         version is no longer active are reported as `Superseded`).
    function getProposal(uint256 proposalId) external view returns (Proposal memory p) {
        p = _proposal(proposalId);
        if (p.status == ProposalStatus.Pending && _isSuperseded(p)) p.status = ProposalStatus.Superseded;
    }

    /// @notice Unclaimed earnings of `account` in a project (across all versions).
    function claimable(uint256 projectId, address account) public view returns (uint256) {
        _project(projectId);
        return _earned[projectId][account] - _claimed[projectId][account];
    }

    /// @notice Lifetime earnings and amount already claimed by `account` in a project.
    function balanceOf(uint256 projectId, address account) external view returns (uint256 earned, uint256 claimed) {
        _project(projectId);
        return (_earned[projectId][account], _claimed[projectId][account]);
    }

    /// @notice What `account` earned from deposits attributed to one agreement version.
    function earnedInVersion(uint256 projectId, uint32 version, address account) external view returns (uint256) {
        _requireVersion(projectId, version);
        return _earnedInVersion[projectId][version][account];
    }

    /// @notice Total revenue deposited while `version` was active.
    function versionRevenue(uint256 projectId, uint32 version) external view returns (uint256) {
        _requireVersion(projectId, version);
        return _versionRevenue[projectId][version];
    }

    /// @notice Project-level totals. `deposited - claimed` is held by this contract.
    function projectRevenue(uint256 projectId) external view returns (uint256 deposited, uint256 claimed) {
        _project(projectId);
        return (_totalDeposited[projectId], _totalClaimed[projectId]);
    }

    function getDeposit(uint256 depositId) external view returns (Deposit memory) {
        if (depositId == 0 || depositId > depositCount) revert DepositNotFound(depositId);
        return _deposits[depositId];
    }

    function getProposedSplits(uint256 proposalId) external view returns (Split[] memory) {
        _proposal(proposalId);
        return _proposedSplits[proposalId];
    }

    function getRequiredApprovers(uint256 proposalId) external view returns (address[] memory) {
        _proposal(proposalId);
        return _requiredApprovers[proposalId];
    }

    function voteOf(uint256 proposalId, address account) external view returns (Vote) {
        _proposal(proposalId);
        return _votes[proposalId][account];
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _propose(uint256 projectId, uint32 baseVersion, Split[] calldata splits) private returns (uint256 proposalId) {
        _validateSplits(splits);
        if (baseVersion != 0 && _sameAsVersion(projectId, baseVersion, splits)) revert NoChange();

        proposalId = ++proposalCount;
        Proposal storage p = _proposals[proposalId];
        p.projectId = projectId;
        p.proposer = msg.sender;
        p.baseVersion = baseVersion;
        p.status = ProposalStatus.Pending;
        p.createdAt = uint64(block.timestamp);

        Split[] storage stored = _proposedSplits[proposalId];
        for (uint256 i = 0; i < splits.length; i++) {
            stored.push(splits[i]);
        }

        // Required approvers: everyone active under the base agreement (including anyone
        // being removed) plus everyone newly added, so no one is bound or added without
        // signing.
        if (baseVersion != 0) {
            Split[] storage current = _versionSplits[projectId][baseVersion];
            for (uint256 i = 0; i < current.length; i++) {
                _addRequired(proposalId, current[i].contributor);
            }
        }
        for (uint256 i = 0; i < splits.length; i++) {
            _addRequired(proposalId, splits[i].contributor);
        }
        p.requiredCount = uint32(_requiredApprovers[proposalId].length);

        emit ProposalCreated(projectId, proposalId, msg.sender, baseVersion, p.requiredCount);
    }

    function _credit(uint256 projectId, uint32 version, address account, uint256 amount) private {
        if (amount == 0) return;
        _earned[projectId][account] += amount;
        _earnedInVersion[projectId][version][account] += amount;
    }

    /// @dev Checks-effects-interactions: balances are updated before the ETH transfer, and
    ///      callers are additionally guarded by `nonReentrant`. A failed transfer reverts the
    ///      whole call, leaving the balance claimable.
    function _claim(uint256 projectId, uint256 amount) private {
        uint256 available = claimable(projectId, msg.sender);
        if (amount > available) revert InsufficientBalance(available, amount);

        _claimed[projectId][msg.sender] += amount;
        _totalClaimed[projectId] += amount;
        emit RevenueClaimed(projectId, msg.sender, amount);

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function _requireVersion(uint256 projectId, uint32 version) private view {
        if (version == 0 || version > _project(projectId).activeVersion) revert VersionNotFound(projectId, version);
    }

    function _addRequired(uint256 proposalId, address account) private {
        if (_isRequired[proposalId][account]) return;
        _isRequired[proposalId][account] = true;
        _requiredApprovers[proposalId].push(account);
    }

    function _recordVote(uint256 proposalId, Vote vote) private {
        if (!_isRequired[proposalId][msg.sender]) revert NotRequiredApprover(msg.sender);
        if (_votes[proposalId][msg.sender] != Vote.None) revert AlreadyVoted(msg.sender);
        _votes[proposalId][msg.sender] = vote;
    }

    function _validateSplits(Split[] calldata splits) private pure {
        uint256 n = splits.length;
        if (n == 0) revert NoContributors();
        if (n > MAX_CONTRIBUTORS) revert TooManyContributors();

        uint256 total;
        for (uint256 i = 0; i < n; i++) {
            address contributor = splits[i].contributor;
            if (contributor == address(0)) revert ZeroAddressContributor();
            if (splits[i].shareBps == 0) revert ZeroShare(contributor);
            for (uint256 j = 0; j < i; j++) {
                if (splits[j].contributor == contributor) revert DuplicateContributor(contributor);
            }
            total += splits[i].shareBps;
        }
        if (total != TOTAL_BPS) revert SharesMustTotal100Percent(total);
    }

    /// @dev Order-insensitive comparison. Assumes `splits` is already validated (no duplicates).
    function _sameAsVersion(uint256 projectId, uint32 version, Split[] calldata splits) private view returns (bool) {
        if (_versionSplits[projectId][version].length != splits.length) return false;
        for (uint256 i = 0; i < splits.length; i++) {
            if (_versionShare[projectId][version][splits[i].contributor] != splits[i].shareBps) return false;
        }
        return true;
    }

    function _isSuperseded(Proposal memory p) private view returns (bool) {
        return _projects[p.projectId].activeVersion != p.baseVersion;
    }

    function _votableProposal(uint256 proposalId) private view returns (Proposal storage p) {
        p = _proposal(proposalId);
        if (p.status != ProposalStatus.Pending) revert ProposalNotPending(proposalId, p.status);
        if (_isSuperseded(p)) revert ProposalSuperseded(proposalId);
    }

    function _project(uint256 projectId) private view returns (Project storage project) {
        if (projectId == 0 || projectId > projectCount) revert ProjectNotFound(projectId);
        return _projects[projectId];
    }

    function _proposal(uint256 proposalId) private view returns (Proposal storage) {
        if (proposalId == 0 || proposalId > proposalCount) revert ProposalNotFound(proposalId);
        return _proposals[proposalId];
    }
}
