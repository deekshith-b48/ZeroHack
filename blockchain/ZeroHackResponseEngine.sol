// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ZeroHack Automated Response Engine
/// @notice A smart contract to log cybersecurity incidents and trigger automated on-chain responses like quarantining IPs.
contract ZeroHackResponseEngine {

    address public owner;

    // Mapping to track which IPs are quarantined
    mapping(string => bool) public isQuarantined;

    // --- Events ---

    /// @notice Emitted when a new incident is reported to the contract.
    event IncidentReported(
        address indexed reporter,
        string ipAddress,
        string attackType,
        string explanation
    );

    /// @notice Emitted when an IP address is automatically quarantined by the contract.
    event IPQuarantined(
        string ipAddress,
        uint256 timestamp
    );

    /// @notice Emitted to alert system administrators about a critical incident.
    event AdminAlert(
        string message,
        string ipAddress,
        string attackType,
        uint256 timestamp
    );

    /// @notice Emitted to broadcast incident information to peer systems or a decentralized network.
    event PeerBroadcast(
        string ipAddress,
        string attackType,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "ResponseEngine: Caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice The main function called by the backend to report a threat and trigger responses.
    /// @param _ip The source IP address associated with the threat.
    /// @param _attackType The type of attack detected (e.g., "Port Scan", "DDoS").
    /// @param _explanation A brief summary of why the threat was flagged.
    function reportIncident(
        string memory _ip,
        string memory _attackType,
        string memory _explanation
    ) public {
        // Step 1: Log the initial report.
        emit IncidentReported(msg.sender, _ip, _attackType, _explanation);

        // Step 2: Automatically quarantine the IP and log the action.
        // In a real system, you might check if it's already quarantined, but for this flow,
        // we'll just set it to true and emit the event.
        if (!isQuarantined[_ip]) {
            isQuarantined[_ip] = true;
            emit IPQuarantined(_ip, block.timestamp);
        }

        // Step 3: Emit an alert for administrators.
        string memory alertMessage = string.concat("CRITICAL INCIDENT: ", _attackType, " from IP ", _ip);
        emit AdminAlert(alertMessage, _ip, _attackType, block.timestamp);

        // Step 4: Broadcast the incident to peers.
        // This is a simplified broadcast; real systems might use more complex P2P protocols.
        emit PeerBroadcast(_ip, _attackType, block.timestamp);
    }

    /// @notice Allows the owner to manually override quarantine status.
    /// @param _ip The IP address to update.
    /// @param _status The new quarantine status (true for quarantined, false for cleared).
    function setQuarantineStatus(string memory _ip, bool _status) public onlyOwner {
        isQuarantined[_ip] = _status;
        // Optionally emit an event for manual overrides
    }

    /// @notice A simple view function to check the quarantine status of an IP.
    /// @param _ip The IP address to check.
    /// @return True if the IP is quarantined, false otherwise.
    function getQuarantineStatus(string memory _ip) public view returns (bool) {
        return isQuarantined[_ip];
    }
}
