// ══════════════════════════════════════════════════════════
//  CivicTrust Contract Config — Sepolia Testnet
// ══════════════════════════════════════════════════════════


export const CONTRACT_ADDRESS = "0xa9346095713aEc7CeBB8406e99e40Ce6376CBC63";

// Sepolia chain config
export const CHAIN_CONFIG = {
  chainId: "0xaa36a7",          // 11155111 in hex
  chainIdDecimal: 11155111,
  chainName: "Sepolia Testnet",
  rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
  blockExplorer: "https://sepolia.etherscan.io",
  currency: {
    name: "Sepolia ETH",
    symbol: "ETH",
    decimals: 18,
  },
};

// Human-readable ABI 
export const CONTRACT_ABI = [
  // ── Constructor ──
  "constructor(address _oracle)",

  // ── Access Management ──
  "function superAdmin() view returns (address)",
  "function oracle() view returns (address)",
  "function isMunicipal(address) view returns (bool)",
  "function isGlobalWardRep(address) view returns (bool)",
  "function authorizeMunicipal(address _official)",
  "function revokeMunicipal(address _official)",
  "function authorizeWardRep(address _rep, string _ward)",
  "function revokeWardRep(address _rep)",
  "function setOracle(address _newOracle)",
  "function transferSuperAdmin(address _newAdmin)",

  // ── State Variables ──
  "function tenderCount() view returns (uint256)",
  "function totalLockedEscrow() view returns (uint256)",
  "function totalDisbursed() view returns (uint256)",
  "function AI_PASS_THRESHOLD() view returns (uint8)",
  "function QUORUM() view returns (uint8)",
  "function MAX_MILESTONES() view returns (uint8)",

  // ── Create & Fund Tender (takes a struct tuple) ──
  "function createTender(tuple(address contractor, string title, string ward, string scopeIPFS, string baselineIPFS, int256 gpsLat, int256 gpsLng, uint256 deadline, address[3] wardReps, uint256[] milestoneAmounts, string[] milestoneDescs) p) payable",

  // ── Oracle: Evidence & AI ──
  "function submitEvidence(uint256 _tenderId, string _afterPhotoIPFS, string _citizenNotes, int256 _citizenGpsLat, int256 _citizenGpsLng)",
  "function submitAIScore(uint256 _tenderId, tuple(uint8 score, uint8 structural, uint8 materials, uint8 completion, string reportIPFS) s)",

  // ── Ward Committee Vote ──
  "function castVote(uint256 _tenderId, bool _approve)",

  // ── Dispute Resolution ──
  "function reInspectMilestone(uint256 _tenderId)",
  "function reassignContractor(uint256 _tenderId, address _newContractor)",
  "function cancelTender(uint256 _tenderId)",

  // ── View Functions ──
  "function getTender(uint256 _tenderId) view returns (tuple(uint256 id, address municipal, address contractor, uint256 totalEscrow, uint256 releasedAmount, string title, string ward, string scopeIPFS, string baselinePhotoIPFS, int256 gpsLatitude, int256 gpsLongitude, uint256 deadline, uint8 totalMilestones, uint8 currentMilestone, uint8 status, address[3] wardReps, uint256 createdAt, uint256 completedAt))",

  "function getMilestone(uint256 _tenderId, uint8 _milestoneIndex) view returns (tuple(uint256 amount, string description, string afterPhotoIPFS, string aiReportIPFS, string citizenNotes, int256 citizenGpsLat, int256 citizenGpsLng, uint8 aiScore, uint8 aiStructural, uint8 aiMaterials, uint8 aiCompletion, uint8 status, uint8 approvalsCount, uint8 rejectionsCount, uint256 releasedAt))",

  "function getAllMilestones(uint256 _tenderId) view returns (tuple(uint256 amount, string description, string afterPhotoIPFS, string aiReportIPFS, string citizenNotes, int256 citizenGpsLat, int256 citizenGpsLng, uint8 aiScore, uint8 aiStructural, uint8 aiMaterials, uint8 aiCompletion, uint8 status, uint8 approvalsCount, uint8 rejectionsCount, uint256 releasedAt)[])",

  "function getTenderWardReps(uint256 _tenderId) view returns (address[3])",

  "function getMilestoneVoteStatus(uint256 _tenderId, uint8 _milestoneIndex) view returns (uint8 approvals, uint8 rejections, bool[3] voted, bool[3] choices)",

  "function isWardRepForTender(uint256 _tenderId, address _rep) view returns (bool)",

  "function getContractorTenderIds(address _contractor) view returns (uint256[])",
  "function getMunicipalTenderIds(address _municipal) view returns (uint256[])",
  "function getWardRepTenderIds(address _rep) view returns (uint256[])",

  "function getDashboardStats() view returns (uint256 lockedEscrow, uint256 disbursed, uint256 activeTenders, uint256 disputedMilestones, uint256 completedTenders, uint256 cancelledTenders)",

  "function getTendersPaginated(uint256 _offset, uint256 _limit) view returns (tuple(uint256 id, address municipal, address contractor, uint256 totalEscrow, uint256 releasedAmount, string title, string ward, string scopeIPFS, string baselinePhotoIPFS, int256 gpsLatitude, int256 gpsLongitude, uint256 deadline, uint8 totalMilestones, uint8 currentMilestone, uint8 status, address[3] wardReps, uint256 createdAt, uint256 completedAt)[], uint256 total)",

  "function getContractBalance() view returns (uint256)",

  // ── Events ──
  "event MunicipalAuthorized(address indexed official)",
  "event MunicipalRevoked(address indexed official)",
  "event WardRepAuthorized(address indexed rep, string ward)",
  "event WardRepRevoked(address indexed rep)",
  "event OracleUpdated(address indexed oldOracle, address indexed newOracle)",
  "event SuperAdminTransferred(address indexed oldAdmin, address indexed newAdmin)",
  "event TenderCreated(uint256 indexed tenderId, address indexed municipal, address indexed contractor, uint256 totalEscrow, string title, string ward, uint8 totalMilestones)",
  "event TenderCancelled(uint256 indexed tenderId, uint256 refundedAmount)",
  "event TenderCompleted(uint256 indexed tenderId)",
  "event EvidenceSubmitted(uint256 indexed tenderId, uint8 indexed milestoneIndex, string afterPhotoIPFS, int256 citizenGpsLat, int256 citizenGpsLng)",
  "event AIScoreSubmitted(uint256 indexed tenderId, uint8 indexed milestoneIndex, uint8 score, uint8 structural, uint8 materials, uint8 completion, string aiReportIPFS)",
  "event WardVoteCast(uint256 indexed tenderId, uint8 indexed milestoneIndex, address indexed rep, bool approved)",
  "event MilestoneDisputed(uint256 indexed tenderId, uint8 indexed milestoneIndex, string reason)",
  "event MilestoneReleased(uint256 indexed tenderId, uint8 indexed milestoneIndex, address indexed contractor, uint256 amount)",
  "event MilestoneReInspection(uint256 indexed tenderId, uint8 indexed milestoneIndex)",
  "event ContractorReassigned(uint256 indexed tenderId, address indexed oldContractor, address indexed newContractor)",
];

// ── Status enums (mirror Solidity) ──
export const TenderStatus = {
  0: "Active",
  1: "Completed",
  2: "Cancelled",
  Active: 0,
  Completed: 1,
  Cancelled: 2,
};

export const MilestoneStatus = {
  0: "Funded",
  1: "AwaitingVote",
  2: "Disputed",
  3: "Released",
  Funded: 0,
  AwaitingVote: 1,
  Disputed: 2,
  Released: 3,
};
