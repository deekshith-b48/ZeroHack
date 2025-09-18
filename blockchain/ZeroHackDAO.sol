// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ZeroHack DAO for IP Blacklist Voting
/// @notice Allows community members to propose and vote on blacklisting IP addresses.
contract ZeroHackDAO {
    address public owner;

    struct Proposal {
        uint256 id;
        address proposer;
        string proposedIP;
        string detailsIPFSHash; // Link to more details about why this IP should be blacklisted
        uint256 creationTime;
        uint256 votingDeadline;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
        bool passed; // True if the vote passed, false otherwise (only valid after execution)
        mapping(address => bool) voters; // Tracks who has voted on this proposal
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    uint256 public constant MIN_VOTING_DURATION_DAYS = 1;
    uint256 public constant MAX_VOTING_DURATION_DAYS = 30;
    // uint256 public MIN_QUORUM; // Example: Minimum total votes for a proposal to be valid (can add later)

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string proposedIP,
        string detailsIPFSHash,
        uint256 votingDeadline
    );

    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        bool inFavor,
        uint256 currentYesVotes,
        uint256 currentNoVotes
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        string ipAddress,
        bool passed,
        string outcomeMessage
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "DAO: Caller is not the owner");
        _;
    }

    modifier proposalExists(uint256 _proposalId) {
        require(_proposalId < proposalCount, "DAO: Proposal does not exist");
        _;
    }

    modifier isProposalActive(uint256 _proposalId) {
        require(block.timestamp < proposals[_proposalId].votingDeadline, "DAO: Voting period has ended");
        _;
    }

    modifier hasNotVoted(uint256 _proposalId) {
        require(!proposals[_proposalId].voters[msg.sender], "DAO: Already voted on this proposal");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Propose an IP address to be blacklisted.
    /// @param _proposedIP The IP address to propose for blacklisting.
    /// @param _detailsIPFSHash IPFS hash containing details/evidence for the proposal.
    /// @param _votingDurationDays Duration of the voting period in days.
    function proposeBlacklist(
        string memory _proposedIP,
        string memory _detailsIPFSHash,
        uint256 _votingDurationDays
    ) public returns (uint256 proposalId) {
        require(_votingDurationDays >= MIN_VOTING_DURATION_DAYS, "DAO: Voting duration too short");
        require(_votingDurationDays <= MAX_VOTING_DURATION_DAYS, "DAO: Voting duration too long");
        require(bytes(_proposedIP).length > 0, "DAO: Proposed IP cannot be empty");

        proposalId = proposalCount;
        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.proposedIP = _proposedIP;
        newProposal.detailsIPFSHash = _detailsIPFSHash;
        newProposal.creationTime = block.timestamp;
        newProposal.votingDeadline = block.timestamp + (_votingDurationDays * 1 days);
        // yesVotes, noVotes, executed, passed default to 0/false

        proposalCount++;

        emit ProposalCreated(proposalId, msg.sender, _proposedIP, _detailsIPFSHash, newProposal.votingDeadline);
        return proposalId;
    }

    /// @notice Cast a vote on an active blacklist proposal.
    /// @param _proposalId The ID of the proposal to vote on.
    /// @param _inFavor True for a 'yes' vote, false for a 'no' vote.
    function castVote(uint256 _proposalId, bool _inFavor)
        public
        proposalExists(_proposalId)
        isProposalActive(_proposalId)
        hasNotVoted(_proposalId)
    {
        Proposal storage p = proposals[_proposalId];
        require(!p.executed, "DAO: Proposal already executed");

        if (_inFavor) {
            p.yesVotes++;
        } else {
            p.noVotes++;
        }
        p.voters[msg.sender] = true;

        emit Voted(_proposalId, msg.sender, _inFavor, p.yesVotes, p.noVotes);
    }

    /// @notice Execute a proposal after its voting deadline has passed.
    /// @param _proposalId The ID of the proposal to execute.
    function executeProposal(uint256 _proposalId)
        public
        proposalExists(_proposalId)
    {
        Proposal storage p = proposals[_proposalId];
        require(block.timestamp >= p.votingDeadline, "DAO: Voting period not yet over");
        require(!p.executed, "DAO: Proposal already executed");

        // Basic majority rule for passing. Consider adding quorum later.
        bool votePassed = p.yesVotes > p.noVotes;
        p.passed = votePassed;
        p.executed = true;

        string memory outcomeMsg;
        if (votePassed) {
            outcomeMsg = "Proposal passed. IP recommended for blacklisting.";
            // In a more advanced system, this might trigger an action or update a list.
            // For now, it's an on-chain record of the DAO's decision.
        } else {
            outcomeMsg = "Proposal failed. IP not recommended for blacklisting.";
        }

        emit ProposalExecuted(_proposalId, p.proposedIP, votePassed, outcomeMsg);
    }

    /// @notice Get details of a specific proposal.
    function getProposal(uint256 _proposalId)
        public
        view
        proposalExists(_proposalId)
        returns (Proposal memory)
    {
        return proposals[_proposalId];
    }

    // --- Admin functions (Optional, can be expanded) ---
    // function setMinQuorum(uint256 _minQuorum) public onlyOwner {
    //     MIN_QUORUM = _minQuorum;
    // }
}
