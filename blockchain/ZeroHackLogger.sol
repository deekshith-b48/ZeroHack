// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ZeroHack Incident Logger with IP Reputation
/// @notice Logs confirmed cybersecurity incidents and tracks basic reputation for source IPs.

contract ZeroHackLogger {

    // Event emitted when an incident is logged
    event IncidentLogged(
        address indexed reporter,
        string sourceIP,
        string timestamp,
        string attackType,
        string explanation,
        string ipfsHash // Optional IPFS hash for detailed report
    );

    // Event emitted when an IP's reputation score is updated
    event IPReputationUpdated(
        string sourceIP,
        uint256 newReputationScore
    );

    // Mapping to store reputation scores for source IPs
    // Score simply increments for each reported incident involving the IP.
    mapping(string => uint256) public ipReputation;

    // --- State variables for incident data (NOT USED for on-chain storage of incident details to save gas) ---
    // struct Incident {
    //     address reporter;
    //     string sourceIP;
    //     string timestamp;
    //     string attackType;
    //     string explanation;
    //     string ipfsHash;
    // }
    // Incident[] public incidents; // This array is not populated to save gas. Use events.


    /// @notice Logs a confirmed cybersecurity incident and updates IP reputation.
    /// @param sourceIP Source IP address of the attacker.
    /// @param timestamp Timestamp of the attack (preferably ISO 8601).
    /// @param attackType Type of attack detected (e.g., DDoS, Brute-force).
    /// @param explanation Human-readable explanation from AI model or signature match.
    /// @param ipfsHash Optional IPFS hash to full incident detail (can be "" if not used).
    function logIncident(
        string memory sourceIP,
        string memory timestamp,
        string memory attackType,
        string memory explanation,
        string memory ipfsHash
    ) public {
        // Increment reputation for the source IP
        ipReputation[sourceIP]++;

        emit IPReputationUpdated(sourceIP, ipReputation[sourceIP]);

        // Emit event for the incident log (data stored off-chain, referenced by event)
        emit IncidentLogged(
            msg.sender, // The address calling this function (e.g., backend wallet)
            sourceIP,
            timestamp,
            attackType,
            explanation,
            ipfsHash
        );
    }

    /// @notice Returns the current reputation score for a given IP address.
    /// @param sourceIP The IP address to query.
    /// @return The reputation score (number of incidents logged for this IP).
    function getIPReputation(string memory sourceIP) public view returns (uint256) {
        return ipReputation[sourceIP];
    }

    /// @notice Returns total incident count.
    /// @dev This function currently returns 0 as incidents are not stored in the 'incidents' array to save gas.
    /// Incident counts should be derived by querying 'IncidentLogged' events off-chain.
    /// If an on-chain counter is desired, a separate uint256 variable should be added and incremented.
    function getTotalIncidents() public view returns (uint256) {
        // return incidents.length; // This would always be 0 based on current logIncident implementation
        return 0; // Explicitly returning 0 to reflect that on-chain array isn't used for count.
                  // Or, this function could be removed if count is purely off-chain.
                  // For a simple on-chain counter, you'd add:
                  // uint256 public incidentCount;
                  // and in logIncident: incidentCount++;
                  // then return incidentCount here.
    }
}
