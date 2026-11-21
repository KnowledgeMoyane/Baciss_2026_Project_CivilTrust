// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CivicTrust
 * @notice Blockchain-based municipal tender escrow with milestone-based payouts,
 *         Gemini AI verification, and 3-of-3 ward committee multisig sign-off.
 * @dev    Deploy on Avalanche Fuji C-Chain. The deployer becomes the super-admin.
 *
 *  Roles:
 *   - Super-Admin:         Manages access control (municipal officials, ward reps, oracle).
 *   - Municipal Official:  Creates tenders, locks AVAX, whitelists ward reps per tender,
 *                          manages disputes and contractor reassignment.
 *   - Oracle (Backend):    Submits citizen evidence (after photos, GPS) and Gemini AI scores.
 *   - Ward Committee Rep:  Casts on-chain approve/reject vote per milestone (3-of-3 required).
 *   - Contractor:          Receives automated AVAX milestone payouts. Read-only on-chain.
 *   - Citizens:            No wallet needed. Evidence uploaded via backend oracle.
 *
 *  Flow per milestone:
 *   1. Municipal creates tender with N milestones, locking total AVAX in escrow.
 *   2. Oracle submits citizen evidence (after photo + GPS) for the active milestone.
 *   3. Oracle submits Gemini AI score.
 *      - Score >= 75 → milestone moves to AwaitingVote.
 *      - Score <  75 → milestone flagged Disputed.
 *   4. Ward reps vote (3-of-3 unanimous approval required).
 *      - 3 approve → AVAX for that milestone auto-released to contractor, next milestone activates.
 *      - Any reject → milestone flagged Disputed.
 *   5. Municipal can re-inspect (reset disputed milestone) or reassign contractor.
 *   6. When all milestones complete → tender status becomes Completed.
 */
contract CivicTrust {

    // ──────────────────────────────────────────────
    //  Enums
    // ──────────────────────────────────────────────

    enum TenderStatus {
        Active,       // At least one milestone still in progress
        Completed,    // All milestones released
        Cancelled     // Tender cancelled, remaining funds returned to municipality
    }

    enum MilestoneStatus {
        Funded,        // Awaiting citizen evidence & AI audit
        AwaitingVote,  // AI passed (>= 75), waiting for ward committee vote
        Disputed,      // AI failed OR a ward rep rejected
        Released       // Funds released to contractor
    }

    // ──────────────────────────────────────────────
    //  Structs
    // ──────────────────────────────────────────────

    struct Milestone {
        uint256 amount;             // AVAX allocated to this milestone (in wei)
        string description;         // Brief description of milestone deliverable
        string afterPhotoIPFS;      // IPFS CID of citizen-uploaded "after" photo
        string aiReportIPFS;        // IPFS CID of Gemini AI inspection report
        string citizenNotes;        // Citizen observation notes
        int256 citizenGpsLat;       // Citizen GPS latitude × 1e6
        int256 citizenGpsLng;       // Citizen GPS longitude × 1e6
        uint8 aiScore;              // 0-100 score from Gemini Vision
        uint8 aiStructural;         // Structural sub-score 0-100
        uint8 aiMaterials;          // Materials sub-score 0-100
        uint8 aiCompletion;         // Completion sub-score 0-100
        MilestoneStatus status;
        uint8 approvalsCount;
        uint8 rejectionsCount;
        uint256 releasedAt;         // Timestamp when funds were released (0 if not yet)
    }

    struct Tender {
        uint256 id;
        address municipal;          // Official who created it
        address contractor;         // Contractor wallet that receives payouts
        uint256 totalEscrow;        // Total AVAX locked across all milestones (in wei)
        uint256 releasedAmount;     // Total AVAX already released to contractor
        string title;
        string ward;
        string scopeIPFS;           // IPFS CID of the scope-of-work document
        string baselinePhotoIPFS;   // IPFS CID of the "before" site photo
        int256 gpsLatitude;         // Tender site latitude × 1e6
        int256 gpsLongitude;        // Tender site longitude × 1e6
        uint256 deadline;           // Unix timestamp milestone deadline
        uint8 totalMilestones;      // Number of milestones (1-10)
        uint8 currentMilestone;     // Index of the active milestone (0-based)
        TenderStatus status;
        address[3] wardReps;        // 3 designated ward committee reps for THIS tender
        uint256 createdAt;
        uint256 completedAt;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    address public superAdmin;
    address public oracle;          // Backend oracle for AI scores & citizen evidence
    uint256 public tenderCount;
    uint256 public totalLockedEscrow;
    uint256 public totalDisbursed;

    uint8 public constant AI_PASS_THRESHOLD = 75;
    uint8 public constant QUORUM = 3;               // 3-of-3 unanimous
    uint8 public constant MAX_MILESTONES = 10;

    mapping(uint256 => Tender) public tenders;
    mapping(uint256 => mapping(uint8 => Milestone)) public milestones; // tenderId => milestoneIndex => Milestone

    mapping(address => bool) public isMunicipal;
    mapping(address => bool) public isGlobalWardRep;  // Globally registered ward reps
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public hasVoted; // tenderId => milestone => rep => voted
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public voteChoice; // tenderId => milestone => rep => true=approve

    // Lookup helpers
    mapping(address => uint256[]) public contractorTenderIds;
    mapping(address => uint256[]) public municipalTenderIds;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    // Access control
    event MunicipalAuthorized(address indexed official);
    event MunicipalRevoked(address indexed official);
    event WardRepAuthorized(address indexed rep, string ward);
    event WardRepRevoked(address indexed rep);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event SuperAdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    // Tender lifecycle
    event TenderCreated(
        uint256 indexed tenderId,
        address indexed municipal,
        address indexed contractor,
        uint256 totalEscrow,
        string title,
        string ward,
        uint8 totalMilestones
    );
    event TenderCancelled(uint256 indexed tenderId, uint256 refundedAmount);
    event TenderCompleted(uint256 indexed tenderId);

    // Evidence & AI
    event EvidenceSubmitted(
        uint256 indexed tenderId,
        uint8 indexed milestoneIndex,
        string afterPhotoIPFS,
        int256 citizenGpsLat,
        int256 citizenGpsLng
    );
    event AIScoreSubmitted(
        uint256 indexed tenderId,
        uint8 indexed milestoneIndex,
        uint8 score,
        uint8 structural,
        uint8 materials,
        uint8 completion,
        string aiReportIPFS
    );

    // Voting & funds
    event WardVoteCast(uint256 indexed tenderId, uint8 indexed milestoneIndex, address indexed rep, bool approved);
    event MilestoneDisputed(uint256 indexed tenderId, uint8 indexed milestoneIndex, string reason);
    event MilestoneReleased(uint256 indexed tenderId, uint8 indexed milestoneIndex, address indexed contractor, uint256 amount);
    event MilestoneReInspection(uint256 indexed tenderId, uint8 indexed milestoneIndex);

    // Dispute resolution
    event ContractorReassigned(uint256 indexed tenderId, address indexed oldContractor, address indexed newContractor);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlySuperAdmin() {
        require(msg.sender == superAdmin, "Only super-admin");
        _;
    }

    modifier onlyMunicipal() {
        require(isMunicipal[msg.sender], "Only municipal official");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle");
        _;
    }

    modifier tenderExists(uint256 _id) {
        require(_id > 0 && _id <= tenderCount, "Tender does not exist");
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(address _oracle) {
        require(_oracle != address(0), "Oracle required");
        superAdmin = msg.sender;
        oracle = _oracle;
        isMunicipal[msg.sender] = true; // Deployer is also a municipal official
    }

    // ══════════════════════════════════════════════
    //  1. ACCESS MANAGEMENT  (Super-Admin)
    // ══════════════════════════════════════════════

    function authorizeMunicipal(address _official) external onlySuperAdmin {
        require(_official != address(0), "Zero address");
        isMunicipal[_official] = true;
        emit MunicipalAuthorized(_official);
    }

    function revokeMunicipal(address _official) external onlySuperAdmin {
        isMunicipal[_official] = false;
        emit MunicipalRevoked(_official);
    }

    function authorizeWardRep(address _rep, string calldata _ward) external onlySuperAdmin {
        require(_rep != address(0), "Zero address");
        isGlobalWardRep[_rep] = true;
        emit WardRepAuthorized(_rep, _ward);
    }

    function revokeWardRep(address _rep) external onlySuperAdmin {
        isGlobalWardRep[_rep] = false;
        emit WardRepRevoked(_rep);
    }

    function setOracle(address _newOracle) external onlySuperAdmin {
        require(_newOracle != address(0), "Zero address");
        emit OracleUpdated(oracle, _newOracle);
        oracle = _newOracle;
    }

    function transferSuperAdmin(address _newAdmin) external onlySuperAdmin {
        require(_newAdmin != address(0), "Zero address");
        emit SuperAdminTransferred(superAdmin, _newAdmin);
        superAdmin = _newAdmin;
    }

    // ══════════════════════════════════════════════
    //  2. CREATE & FUND TENDER  (Municipal Official)
    // ══════════════════════════════════════════════

    /**
     * @notice Create a new tender with milestone-based escrow.
     * @param _contractor         Contractor wallet that will receive payouts.
     * @param _title              Human-readable tender title.
     * @param _ward               Ward identifier (e.g. "Ward 14, Johannesburg").
     * @param _scopeIPFS          IPFS CID of the scope-of-work document.
     * @param _baselineIPFS       IPFS CID of the "before" baseline site photo.
     * @param _gpsLat             Latitude × 1e6 (signed integer).
     * @param _gpsLng             Longitude × 1e6 (signed integer).
     * @param _deadline           Unix timestamp for overall tender deadline.
     * @param _wardReps           Exactly 3 ward committee rep wallets for this tender.
     * @param _milestoneAmounts   Array of AVAX amounts (in wei) per milestone. Must sum to msg.value.
     * @param _milestoneDescs     Array of milestone descriptions. Same length as _milestoneAmounts.
     */
    function createTender(
        address _contractor,
        string calldata _title,
        string calldata _ward,
        string calldata _scopeIPFS,
        string calldata _baselineIPFS,
        int256 _gpsLat,
        int256 _gpsLng,
        uint256 _deadline,
        address[3] calldata _wardReps,
        uint256[] calldata _milestoneAmounts,
        string[] calldata _milestoneDescs
    ) external payable onlyMunicipal {
        require(_contractor != address(0), "Zero contractor");
        require(msg.value > 0, "Must send AVAX for escrow");
        require(_deadline > block.timestamp, "Deadline must be in the future");
        require(bytes(_title).length > 0, "Title required");
        require(
            _milestoneAmounts.length > 0 && _milestoneAmounts.length <= MAX_MILESTONES,
            "1 to 10 milestones required"
        );
        require(_milestoneAmounts.length == _milestoneDescs.length, "Amounts and descriptions length mismatch");

        // Validate milestone amounts sum to msg.value
        uint256 totalMilestoneAmount;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            require(_milestoneAmounts[i] > 0, "Milestone amount must be > 0");
            totalMilestoneAmount += _milestoneAmounts[i];
        }
        require(totalMilestoneAmount == msg.value, "Milestone amounts must sum to msg.value");

        // Validate ward reps are registered and unique
        for (uint8 i = 0; i < 3; i++) {
            require(isGlobalWardRep[_wardReps[i]], "Ward rep not authorized");
            for (uint8 j = i + 1; j < 3; j++) {
                require(_wardReps[i] != _wardReps[j], "Duplicate ward rep");
            }
        }

        tenderCount++;
        uint256 id = tenderCount;

        Tender storage t = tenders[id];
        t.id = id;
        t.municipal = msg.sender;
        t.contractor = _contractor;
        t.totalEscrow = msg.value;
        t.title = _title;
        t.ward = _ward;
        t.scopeIPFS = _scopeIPFS;
        t.baselinePhotoIPFS = _baselineIPFS;
        t.gpsLatitude = _gpsLat;
        t.gpsLongitude = _gpsLng;
        t.deadline = _deadline;
        t.totalMilestones = uint8(_milestoneAmounts.length);
        t.currentMilestone = 0;
        t.status = TenderStatus.Active;
        t.wardReps = _wardReps;
        t.createdAt = block.timestamp;

        // Initialize milestones
        for (uint8 i = 0; i < _milestoneAmounts.length; i++) {
            milestones[id][i].amount = _milestoneAmounts[i];
            milestones[id][i].description = _milestoneDescs[i];
            milestones[id][i].status = MilestoneStatus.Funded;
        }

        totalLockedEscrow += msg.value;
        contractorTenderIds[_contractor].push(id);
        municipalTenderIds[msg.sender].push(id);

        emit TenderCreated(id, msg.sender, _contractor, msg.value, _title, _ward, uint8(_milestoneAmounts.length));
    }

    // ══════════════════════════════════════════════
    //  3. CITIZEN EVIDENCE UPLOAD  (Oracle / Backend)
    // ══════════════════════════════════════════════

    /**
     * @notice Store citizen-uploaded "after" photo and GPS for the active milestone.
     *         Called by the backend oracle after pinning to Pinata IPFS.
     */
    function submitEvidence(
        uint256 _tenderId,
        string calldata _afterPhotoIPFS,
        string calldata _citizenNotes,
        int256 _citizenGpsLat,
        int256 _citizenGpsLng
    ) external onlyOracle tenderExists(_tenderId) {
        Tender storage t = tenders[_tenderId];
        require(t.status == TenderStatus.Active, "Tender not active");

        Milestone storage m = milestones[_tenderId][t.currentMilestone];
        require(
            m.status == MilestoneStatus.Funded || m.status == MilestoneStatus.Disputed,
            "Milestone not accepting evidence"
        );
        require(bytes(_afterPhotoIPFS).length > 0, "IPFS hash required");

        m.afterPhotoIPFS = _afterPhotoIPFS;
        m.citizenNotes = _citizenNotes;
        m.citizenGpsLat = _citizenGpsLat;
        m.citizenGpsLng = _citizenGpsLng;

        emit EvidenceSubmitted(_tenderId, t.currentMilestone, _afterPhotoIPFS, _citizenGpsLat, _citizenGpsLng);
    }

    // ══════════════════════════════════════════════
    //  4. AI SCORE SUBMISSION  (Oracle / Backend)
    // ══════════════════════════════════════════════

    /**
     * @notice Submit Gemini Vision AI scores for the active milestone.
     *         Score >= 75 → AwaitingVote.  Score < 75 → Disputed.
     */
    function submitAIScore(
        uint256 _tenderId,
        uint8 _score,
        uint8 _structural,
        uint8 _materials,
        uint8 _completion,
        string calldata _aiReportIPFS
    ) external onlyOracle tenderExists(_tenderId) {
        Tender storage t = tenders[_tenderId];
        require(t.status == TenderStatus.Active, "Tender not active");

        Milestone storage m = milestones[_tenderId][t.currentMilestone];
        require(
            m.status == MilestoneStatus.Funded || m.status == MilestoneStatus.Disputed,
            "Milestone not accepting AI score"
        );
        require(_score <= 100 && _structural <= 100 && _materials <= 100 && _completion <= 100, "Scores must be 0-100");

        m.aiScore = _score;
        m.aiStructural = _structural;
        m.aiMaterials = _materials;
        m.aiCompletion = _completion;
        m.aiReportIPFS = _aiReportIPFS;

        // Reset votes for a fresh round
        m.approvalsCount = 0;
        m.rejectionsCount = 0;
        for (uint8 i = 0; i < 3; i++) {
            hasVoted[_tenderId][t.currentMilestone][t.wardReps[i]] = false;
            voteChoice[_tenderId][t.currentMilestone][t.wardReps[i]] = false;
        }

        if (_score >= AI_PASS_THRESHOLD) {
            m.status = MilestoneStatus.AwaitingVote;
        } else {
            m.status = MilestoneStatus.Disputed;
            emit MilestoneDisputed(_tenderId, t.currentMilestone, "AI score below threshold");
        }

        emit AIScoreSubmitted(_tenderId, t.currentMilestone, _score, _structural, _materials, _completion, _aiReportIPFS);
    }

    // ══════════════════════════════════════════════
    //  5. WARD COMMITTEE VOTE  (Ward Reps — 3-of-3)
    // ══════════════════════════════════════════════

    /**
     * @notice Cast an approve or reject vote on the active milestone.
     *         3-of-3 approve → funds released, next milestone activates.
     *         Any rejection → milestone disputed immediately (unanimity impossible).
     */
    function castVote(uint256 _tenderId, bool _approve) external tenderExists(_tenderId) {
        Tender storage t = tenders[_tenderId];
        require(t.status == TenderStatus.Active, "Tender not active");

        uint8 mi = t.currentMilestone;
        Milestone storage m = milestones[_tenderId][mi];
        require(m.status == MilestoneStatus.AwaitingVote, "Milestone not awaiting vote");
        require(!hasVoted[_tenderId][mi][msg.sender], "Already voted");

        // Verify caller is one of the 3 assigned ward reps for THIS tender
        bool isAssigned = false;
        for (uint8 i = 0; i < 3; i++) {
            if (t.wardReps[i] == msg.sender) {
                isAssigned = true;
                break;
            }
        }
        require(isAssigned, "Not assigned ward rep for this tender");

        hasVoted[_tenderId][mi][msg.sender] = true;
        voteChoice[_tenderId][mi][msg.sender] = _approve;

        emit WardVoteCast(_tenderId, mi, msg.sender, _approve);

        if (_approve) {
            m.approvalsCount++;
            // 3-of-3 unanimous approval → release funds
            if (m.approvalsCount >= QUORUM) {
                _releaseMilestone(_tenderId, mi);
            }
        } else {
            m.rejectionsCount++;
            // Any rejection → unanimity impossible → dispute immediately
            m.status = MilestoneStatus.Disputed;
            emit MilestoneDisputed(_tenderId, mi, "Ward committee member rejected");
        }
    }

    // ══════════════════════════════════════════════
    //  6. DISPUTE RESOLUTION  (Municipal Official)
    // ══════════════════════════════════════════════

    /**
     * @notice Trigger a re-inspection of a disputed milestone.
     *         Resets the milestone to Funded so a new evidence → AI → vote cycle can begin.
     */
    function reInspectMilestone(uint256 _tenderId) external onlyMunicipal tenderExists(_tenderId) {
        Tender storage t = tenders[_tenderId];
        require(t.status == TenderStatus.Active, "Tender not active");

        Milestone storage m = milestones[_tenderId][t.currentMilestone];
        require(m.status == MilestoneStatus.Disputed, "Milestone not disputed");

        // Reset milestone for fresh cycle
        m.status = MilestoneStatus.Funded;
        m.afterPhotoIPFS = "";
        m.aiReportIPFS = "";
        m.citizenNotes = "";
        m.aiScore = 0;
        m.aiStructural = 0;
        m.aiMaterials = 0;
        m.aiCompletion = 0;
        m.approvalsCount = 0;
        m.rejectionsCount = 0;

        for (uint8 i = 0; i < 3; i++) {
            hasVoted[_tenderId][t.currentMilestone][t.wardReps[i]] = false;
            voteChoice[_tenderId][t.currentMilestone][t.wardReps[i]] = false;
        }

        emit MilestoneReInspection(_tenderId, t.currentMilestone);
    }

    /**
     * @notice Reassign a tender's contractor when the current milestone is disputed.
     *         Escrow stays locked. Active milestone resets to Funded for the new contractor.
     */
    function reassignContractor(
        uint256 _tenderId,
        address _newContractor
    ) external onlyMunicipal tenderExists(_tenderId) {
        Tender storage t = tenders[_tenderId];
        require(t.status == TenderStatus.Active, "Tender not active");
        require(
            milestones[_tenderId][t.currentMilestone].status == MilestoneStatus.Disputed,
            "Active milestone not disputed"
        );
        require(_newContractor != address(0), "Zero address");
        require(_newContractor != t.contractor, "Same contractor");

        address old = t.contractor;
        t.contractor = _newContractor;

        // Reset current milestone for fresh cycle
        Milestone storage m = milestones[_tenderId][t.currentMilestone];
        m.status = MilestoneStatus.Funded;
        m.afterPhotoIPFS = "";
        m.aiReportIPFS = "";
        m.citizenNotes = "";
        m.aiScore = 0;
        m.aiStructural = 0;
        m.aiMaterials = 0;
        m.aiCompletion = 0;
        m.approvalsCount = 0;
        m.rejectionsCount = 0;

        for (uint8 i = 0; i < 3; i++) {
            hasVoted[_tenderId][t.currentMilestone][t.wardReps[i]] = false;
            voteChoice[_tenderId][t.currentMilestone][t.wardReps[i]] = false;
        }

        contractorTenderIds[_newContractor].push(_tenderId);

        emit ContractorReassigned(_tenderId, old, _newContractor);
    }

    /**
     * @notice Cancel an active tender and return remaining escrowed funds to the municipality.
     *         Only unreleased milestones are refunded.
     */
    function cancelTender(uint256 _tenderId) external onlyMunicipal tenderExists(_tenderId) {
        Tender storage t = tenders[_tenderId];
        require(t.status == TenderStatus.Active, "Tender not active");

        t.status = TenderStatus.Cancelled;

        // Calculate remaining locked funds (unreleased milestones)
        uint256 refund;
        for (uint8 i = t.currentMilestone; i < t.totalMilestones; i++) {
            if (milestones[_tenderId][i].status != MilestoneStatus.Released) {
                refund += milestones[_tenderId][i].amount;
            }
        }

        if (refund > 0) {
            totalLockedEscrow -= refund;
            (bool sent, ) = payable(t.municipal).call{value: refund}("");
            require(sent, "Refund transfer failed");
        }

        emit TenderCancelled(_tenderId, refund);
    }

    // ══════════════════════════════════════════════
    //  7. VIEW FUNCTIONS  (Public / Read-Only)
    // ══════════════════════════════════════════════

    /// @notice Get full tender details.
    function getTender(uint256 _tenderId) external view tenderExists(_tenderId) returns (Tender memory) {
        return tenders[_tenderId];
    }

    /// @notice Get a specific milestone for a tender.
    function getMilestone(uint256 _tenderId, uint8 _milestoneIndex) external view tenderExists(_tenderId) returns (Milestone memory) {
        require(_milestoneIndex < tenders[_tenderId].totalMilestones, "Invalid milestone index");
        return milestones[_tenderId][_milestoneIndex];
    }

    /// @notice Get all milestones for a tender.
    function getAllMilestones(uint256 _tenderId) external view tenderExists(_tenderId) returns (Milestone[] memory) {
        uint8 total = tenders[_tenderId].totalMilestones;
        Milestone[] memory result = new Milestone[](total);
        for (uint8 i = 0; i < total; i++) {
            result[i] = milestones[_tenderId][i];
        }
        return result;
    }

    /// @notice Get the 3 ward rep addresses assigned to a tender.
    function getTenderWardReps(uint256 _tenderId) external view tenderExists(_tenderId) returns (address[3] memory) {
        return tenders[_tenderId].wardReps;
    }

    /// @notice Get vote status for a specific milestone.
    function getMilestoneVoteStatus(uint256 _tenderId, uint8 _milestoneIndex) external view tenderExists(_tenderId) returns (
        uint8 approvals,
        uint8 rejections,
        bool[3] memory voted,
        bool[3] memory choices
    ) {
        Tender storage t = tenders[_tenderId];
        require(_milestoneIndex < t.totalMilestones, "Invalid milestone index");
        Milestone storage m = milestones[_tenderId][_milestoneIndex];

        approvals = m.approvalsCount;
        rejections = m.rejectionsCount;
        for (uint8 i = 0; i < 3; i++) {
            voted[i] = hasVoted[_tenderId][_milestoneIndex][t.wardReps[i]];
            choices[i] = voteChoice[_tenderId][_milestoneIndex][t.wardReps[i]];
        }
    }

    /// @notice Check if an address is an assigned ward rep for a specific tender.
    function isWardRepForTender(uint256 _tenderId, address _rep) external view tenderExists(_tenderId) returns (bool) {
        address[3] storage reps = tenders[_tenderId].wardReps;
        for (uint8 i = 0; i < 3; i++) {
            if (reps[i] == _rep) return true;
        }
        return false;
    }

    /// @notice Get all tender IDs assigned to a contractor.
    function getContractorTenderIds(address _contractor) external view returns (uint256[] memory) {
        return contractorTenderIds[_contractor];
    }

    /// @notice Get all tender IDs created by a municipal official.
    function getMunicipalTenderIds(address _municipal) external view returns (uint256[] memory) {
        return municipalTenderIds[_municipal];
    }

    /// @notice Get all tender IDs where the given address is an assigned ward rep.
    function getWardRepTenderIds(address _rep) external view returns (uint256[] memory) {
        // Build list by scanning all tenders (acceptable for Fuji testnet scale)
        uint256[] memory temp = new uint256[](tenderCount);
        uint256 count;
        for (uint256 i = 1; i <= tenderCount; i++) {
            address[3] storage reps = tenders[i].wardReps;
            for (uint8 j = 0; j < 3; j++) {
                if (reps[j] == _rep) {
                    temp[count] = i;
                    count++;
                    break;
                }
            }
        }
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = temp[i];
        }
        return result;
    }

    /// @notice Get basic stats for the municipal dashboard KPI cards.
    function getDashboardStats() external view returns (
        uint256 lockedEscrow,
        uint256 disbursed,
        uint256 activeTenders,
        uint256 disputedMilestones,
        uint256 completedTenders,
        uint256 cancelledTenders
    ) {
        lockedEscrow = totalLockedEscrow;
        disbursed = totalDisbursed;
        for (uint256 i = 1; i <= tenderCount; i++) {
            Tender storage t = tenders[i];
            if (t.status == TenderStatus.Active) {
                activeTenders++;
                if (milestones[i][t.currentMilestone].status == MilestoneStatus.Disputed) {
                    disputedMilestones++;
                }
            } else if (t.status == TenderStatus.Completed) {
                completedTenders++;
            } else if (t.status == TenderStatus.Cancelled) {
                cancelledTenders++;
            }
        }
    }

    /// @notice Get a paginated list of tenders (for the public accountability portal & active tenders page).
    function getTendersPaginated(uint256 _offset, uint256 _limit) external view returns (Tender[] memory, uint256 total) {
        total = tenderCount;
        if (_offset >= total || _limit == 0) {
            return (new Tender[](0), total);
        }
        uint256 end = _offset + _limit;
        if (end > total) end = total;
        uint256 size = end - _offset;

        Tender[] memory result = new Tender[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = tenders[_offset + i + 1]; // tender IDs are 1-indexed
        }
        return (result, total);
    }

    /// @notice Get the AVAX balance held by this contract.
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ══════════════════════════════════════════════
    //  INTERNAL
    // ══════════════════════════════════════════════

    function _releaseMilestone(uint256 _tenderId, uint8 _milestoneIndex) internal {
        Tender storage t = tenders[_tenderId];
        Milestone storage m = milestones[_tenderId][_milestoneIndex];

        m.status = MilestoneStatus.Released;
        m.releasedAt = block.timestamp;

        uint256 amount = m.amount;
        t.releasedAmount += amount;
        totalLockedEscrow -= amount;
        totalDisbursed += amount;

        // Advance to next milestone or complete tender
        if (t.currentMilestone + 1 < t.totalMilestones) {
            t.currentMilestone++;
        } else {
            t.status = TenderStatus.Completed;
            t.completedAt = block.timestamp;
            emit TenderCompleted(_tenderId);
        }

        (bool sent, ) = payable(t.contractor).call{value: amount}("");
        require(sent, "Payout transfer failed");

        emit MilestoneReleased(_tenderId, _milestoneIndex, t.contractor, amount);
    }
}
