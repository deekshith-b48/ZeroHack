import datetime
from collections import defaultdict

# --- Configuration for Rules ---
SSH_BRUTE_FORCE_PORT = 22
SSH_BRUTE_FORCE_ATTEMPTS_THRESHOLD = 5  # More than 5 attempts
SSH_BRUTE_FORCE_WINDOW_SECONDS = 60     # Within 60 seconds

PORT_SCAN_UNIQUE_PORTS_THRESHOLD = 10   # Attempts to >10 unique ports
PORT_SCAN_WINDOW_SECONDS = 60           # Within 60 seconds

# Simplified DDoS/Flood: High number of connections to a single service (dest_ip, dest_port)
DDOS_CONNECTION_THRESHOLD = 100 # More than 100 connections/packets from various sources
DDOS_WINDOW_SECONDS = 10        # Within 10 seconds


# --- Rule Definitions & Logic ---

def check_ssh_brute_force(session_data):
    """
    Detects potential SSH brute-force attacks.
    A brute-force is suspected if multiple connection attempts are made to SSH port
    from the same source IP within a short time window.

    Args:
        session_data (list): List of connection event dictionaries.
                             Each dict should have 'timestamp', 'source_ip', 'dest_port'.
                             Example: {'timestamp': datetime.datetime.now(), 'source_ip': '1.2.3.4', 'dest_port': 22}

    Returns:
        list: A list of findings. Each finding is a dictionary with:
              'is_match': True,
              'confidence': 1.0 (high for signature match),
              'rule_id': 'SSH_BRUTE_FORCE',
              'explanation': 'description of the detected event',
              'details': {'source_ip': ip, 'port': port, 'attempts': count, 'window_seconds': seconds}
    """
    findings = []
    # Group attempts by source_ip and ssh_port
    attempts_by_ip_port = defaultdict(list)

    for event in session_data:
        if event.get('dest_port') == SSH_BRUTE_FORCE_PORT:
            # Could also check for SYN flags if available: and 'S' in event.get('flags', '')
            attempts_by_ip_port[(event['source_ip'], event['dest_port'])].append(event['timestamp'])

    for (source_ip, port), timestamps in attempts_by_ip_port.items():
        if len(timestamps) < SSH_BRUTE_FORCE_ATTEMPTS_THRESHOLD: # Not enough attempts to trigger
            continue

        timestamps.sort()

        # Check for attempts within the defined window
        # Iterate through timestamps to find if a burst of attempts occurred
        for i in range(len(timestamps) - SSH_BRUTE_FORCE_ATTEMPTS_THRESHOLD + 1):
            window_start_time = timestamps[i]
            window_end_time_potential = window_start_time + datetime.timedelta(seconds=SSH_BRUTE_FORCE_WINDOW_SECONDS)

            attempts_in_window = 0
            # Count attempts from index i that fall within this specific window
            current_window_timestamps = []
            for j in range(i, len(timestamps)):
                if timestamps[j] <= window_end_time_potential:
                    attempts_in_window += 1
                    current_window_timestamps.append(timestamps[j])
                else:
                    # Timestamps are sorted, so no need to check further for this window_start_time
                    break

            if attempts_in_window >= SSH_BRUTE_FORCE_ATTEMPTS_THRESHOLD:
                actual_window_duration = (current_window_timestamps[-1] - current_window_timestamps[0]).total_seconds()
                findings.append({
                    'is_match': True,
                    'confidence': 1.0,
                    'rule_id': 'SSH_BRUTE_FORCE',
                    'explanation': (
                        f"Potential SSH brute-force from {source_ip} to port {port}. "
                        f"{attempts_in_window} attempts observed "
                        f"between {current_window_timestamps[0]} and {current_window_timestamps[-1]} (Window: {actual_window_duration:.2f}s)."
                    ),
                    'details': {
                        'source_ip': source_ip,
                        'dest_port': port,
                        'attempt_timestamps': [ts.isoformat() for ts in current_window_timestamps],
                        'observed_attempts_in_burst': attempts_in_window,
                        'configured_threshold': SSH_BRUTE_FORCE_ATTEMPTS_THRESHOLD,
                        'configured_window_seconds': SSH_BRUTE_FORCE_WINDOW_SECONDS
                    }
                })
                # To avoid multiple alerts for the same burst from this IP, we could break or mark these timestamps as processed.
                # For simplicity now, it might report overlapping windows.
                # A more advanced implementation would consume timestamps once they contribute to a finding.
                break # Found a burst for this IP, move to next IP/port combo or refine to find all bursts.


    return findings


def check_port_scan(session_data):
    """
    Detects potential port scanning activity.
    A port scan is suspected if a single source IP attempts to connect to many
    different destination ports on a single destination IP within a short time window.

    Args:
        session_data (list): List of connection event dictionaries.
                             Each dict should have 'timestamp', 'source_ip', 'dest_ip', 'dest_port'.
                             Example: {'timestamp': datetime.datetime.now(), 'source_ip': '1.2.3.4',
                                       'dest_ip': '5.6.7.8', 'dest_port': 80}
    Returns:
        list: A list of findings.
    """
    findings = []
    # Group attempts by source_ip -> dest_ip
    attempts_by_source_to_dest = defaultdict(lambda: defaultdict(list))

    for event in session_data:
        source_ip = event.get('source_ip')
        dest_ip = event.get('dest_ip')
        dest_port = event.get('dest_port')
        timestamp = event.get('timestamp')

        if not all([source_ip, dest_ip, dest_port, timestamp]):
            continue # Skip events with missing critical info

        attempts_by_source_to_dest[source_ip][dest_ip].append({'port': dest_port, 'timestamp': timestamp})

    for source_ip, dest_targets in attempts_by_source_to_dest.items():
        for dest_ip, events in dest_targets.items():
            if len(events) < PORT_SCAN_UNIQUE_PORTS_THRESHOLD: # Not enough unique port attempts to be suspicious yet
                continue

            # Sort events by timestamp to analyze windows
            events.sort(key=lambda x: x['timestamp'])

            # Iterate through events to find a window with enough unique port scans
            for i in range(len(events)):
                window_start_time = events[i]['timestamp']
                window_end_time_potential = window_start_time + datetime.timedelta(seconds=PORT_SCAN_WINDOW_SECONDS)

                ports_in_window = set()
                timestamps_in_window = []

                for j in range(i, len(events)):
                    event_ts = events[j]['timestamp']
                    if event_ts <= window_end_time_potential:
                        ports_in_window.add(events[j]['port'])
                        timestamps_in_window.append(event_ts)
                    else:
                        break # Past the current time window

                if len(ports_in_window) >= PORT_SCAN_UNIQUE_PORTS_THRESHOLD:
                    actual_window_duration = (timestamps_in_window[-1] - timestamps_in_window[0]).total_seconds()
                    findings.append({
                        'is_match': True,
                        'confidence': 1.0,
                        'rule_id': 'PORT_SCAN',
                        'explanation': (
                            f"Potential port scan from {source_ip} to {dest_ip}. "
                            f"{len(ports_in_window)} unique ports targeted "
                            f"between {timestamps_in_window[0]} and {timestamps_in_window[-1]} (Window: {actual_window_duration:.2f}s)."
                        ),
                        'details': {
                            'source_ip': source_ip,
                            'destination_ip': dest_ip,
                            'targeted_ports': sorted(list(ports_in_window)),
                            'event_count_in_window': len(timestamps_in_window),
                            'unique_ports_in_window': len(ports_in_window),
                            'configured_threshold': PORT_SCAN_UNIQUE_PORTS_THRESHOLD,
                            'configured_window_seconds': PORT_SCAN_WINDOW_SECONDS
                        }
                    })
                    # Similar to brute force, decide if to break or find all scan windows
                    break # Found a scan from this source to this dest, move on.
    return findings


def check_ddos_flood(session_data):
    """
    Detects a potential DDoS/flood attack (simplified version).
    Flags if a very high number of connections/packets target a single destination IP and port
    from multiple source IPs within a very short time window.

    Args:
        session_data (list): List of connection event dictionaries.
                             Each dict should have 'timestamp', 'source_ip', 'dest_ip', 'dest_port'.
    Returns:
        list: A list of findings.
    """
    findings = []
    # Group events by destination_ip and destination_port
    events_by_dest_service = defaultdict(list)

    for event in session_data:
        dest_ip = event.get('dest_ip')
        dest_port = event.get('dest_port')
        timestamp = event.get('timestamp')
        source_ip = event.get('source_ip') # Keep source_ip for diversity check

        if not all([dest_ip, dest_port, timestamp, source_ip]):
            continue

        events_by_dest_service[(dest_ip, dest_port)].append({'timestamp': timestamp, 'source_ip': source_ip})

    for (dest_ip, dest_port), events in events_by_dest_service.items():
        if len(events) < DDOS_CONNECTION_THRESHOLD: # Not enough events to be considered a flood
            continue

        events.sort(key=lambda x: x['timestamp'])

        # Check for a high volume of events within the defined window
        for i in range(len(events)):
            window_start_time = events[i]['timestamp']
            window_end_time_potential = window_start_time + datetime.timedelta(seconds=DDOS_WINDOW_SECONDS)

            events_in_window = []
            sources_in_window = set()

            for j in range(i, len(events)):
                event_ts = events[j]['timestamp']
                if event_ts <= window_end_time_potential:
                    events_in_window.append(events[j])
                    sources_in_window.add(events[j]['source_ip'])
                else:
                    break

            if len(events_in_window) >= DDOS_CONNECTION_THRESHOLD:
                actual_window_duration = (events_in_window[-1]['timestamp'] - events_in_window[0]['timestamp']).total_seconds()
                # Optional: Add a check for source IP diversity if desired for "DDoS"
                # For a simple flood, high volume might be enough.
                # For DDoS, we expect multiple sources: e.g. if len(sources_in_window) > SOME_DIVERSE_SOURCE_THRESHOLD

                findings.append({
                    'is_match': True,
                    'confidence': 1.0, # High for signature match
                    'rule_id': 'DDOS_FLOOD_DETECTED',
                    'explanation': (
                        f"Potential DDoS/Flood attack targeting {dest_ip}:{dest_port}. "
                        f"{len(events_in_window)} connections/packets from {len(sources_in_window)} unique sources "
                        f"observed between {events_in_window[0]['timestamp']} and {events_in_window[-1]['timestamp']} (Window: {actual_window_duration:.2f}s)."
                    ),
                    'details': {
                        'destination_ip': dest_ip,
                        'destination_port': dest_port,
                        'event_count_in_window': len(events_in_window),
                        'unique_source_ips_in_window': len(sources_in_window),
                        'configured_threshold': DDOS_CONNECTION_THRESHOLD,
                        'configured_window_seconds': DDOS_WINDOW_SECONDS,
                        'first_event_time': events_in_window[0]['timestamp'].isoformat(),
                        'last_event_time': events_in_window[-1]['timestamp'].isoformat()
                    }
                })
                # Found a flood targeting this service. Break to avoid redundant alerts for same ongoing flood.
                break
    return findings


class SignatureEngine:
    def __init__(self):
        self.rules = [
            {'id': 'SSH_BRUTE_FORCE', 'function': check_ssh_brute_force, 'description': 'Detects SSH brute-force attempts.'},
            {'id': 'PORT_SCAN', 'function': check_port_scan, 'description': 'Detects port scanning activity.'},
            {'id': 'DDOS_FLOOD', 'function': check_ddos_flood, 'description': 'Detects DDoS/flood activity.'},
        ]
        # Initialize logger if needed, or use a global one
        # self.logger = config.get_logger(__name__)

    def analyze_session(self, session_data):
        """
        Analyzes a session (list of connection events) against all registered rules.

        Args:
            session_data (list): A list of connection event dictionaries.
                                 Example event: {'timestamp': datetime.datetime.now(),
                                                 'source_ip': '1.2.3.4',
                                                 'dest_ip': '5.6.7.8',
                                                 'dest_port': 80,
                                                 'protocol': 'TCP',
                                                 'flags': 'S'}

        Returns:
            list: A list of all findings from all rules.
        """
        all_findings = []
        # self.logger.info(f"Analyzing session with {len(session_data)} events against {len(self.rules)} signature rules.")
        print(f"Analyzing session with {len(session_data)} events against {len(self.rules)} signature rules.")


        for rule in self.rules:
            try:
                # self.logger.debug(f"Executing rule: {rule['id']}")
                findings = rule['function'](session_data)
                if findings:
                    # self.logger.info(f"Rule '{rule['id']}' matched: {len(findings)} findings.")
                    all_findings.extend(findings)
            except Exception as e:
                # self.logger.error(f"Error executing rule {rule['id']}: {e}", exc_info=True)
                print(f"Error executing rule {rule['id']}: {e}")

        return all_findings

# --- Example Usage (for testing this module) ---
if __name__ == '__main__':
    print("Signature Engine Test")
    engine = SignatureEngine()

    # Example Data for SSH Brute Force
    now = datetime.datetime.now()
    test_ssh_data = [
        {'timestamp': now - datetime.timedelta(seconds=s), 'source_ip': '10.0.0.1', 'dest_port': 22}
        for s in range(10, 0, -1) # 10 attempts in last 10 seconds
    ]
    test_ssh_data.append({'timestamp': now - datetime.timedelta(seconds=65), 'source_ip': '10.0.0.1', 'dest_port': 22}) # one old
    test_ssh_data.append({'timestamp': now, 'source_ip': '10.0.0.2', 'dest_port': 22}) # different ip
    test_ssh_data.append({'timestamp': now, 'source_ip': '10.0.0.1', 'dest_port': 80})  # different port

    print("\nTesting SSH Brute Force Rule:")
    ssh_findings = engine.analyze_session(test_ssh_data)
    if ssh_findings:
        for finding in ssh_findings:
            print(f"  MATCH: {finding['explanation']}")
            print(f"  Details: {finding['details']}")
    else:
        print("  No SSH brute force detected.")

    # Add more test cases for other rules as they are implemented
    # Example Data for Port Scan
    # test_port_scan_data = [
    #     {'timestamp': now - datetime.timedelta(seconds=s), 'source_ip': '10.0.0.5', 'dest_port': 20 + s, 'dest_ip': '192.168.1.100'}
    #     for s in range(15) # Attempts to 15 different ports
    # ]
    # test_port_scan_data.append({'timestamp': now, 'source_ip': '10.0.0.6', 'dest_port': 80, 'dest_ip': '192.168.1.100'})

    # print("\nTesting Port Scan Rule (Not Implemented Yet):")
    # port_scan_findings = engine.analyze_session(test_port_scan_data) # Assuming check_port_scan is added to rules
    # if port_scan_findings:
    #     for finding in port_scan_findings:
    #         print(f"  MATCH: {finding['explanation']}")
    # else:
    #     print("  No port scan detected (or rule not active).")

    # Example Data for DDoS
    # test_ddos_data = []
    # for i in range(150): # 150 packets
    #     src_ip = f"10.0.1.{i % 20}" # from 20 different source IPs
    #     test_ddos_data.append({
    #         'timestamp': now - datetime.timedelta(seconds= (i % 5)), # within 5 seconds
    #         'source_ip': src_ip,
    #         'dest_ip': '192.168.1.200',
    #         'dest_port': 443
    #     })
    # print("\nTesting DDoS/Flood Rule (Not Implemented Yet):")
    # ddos_findings = engine.analyze_session(test_ddos_data) # Assuming check_ddos_flood is added to rules
    # if ddos_findings:
    #     for finding in ddos_findings:
    #         print(f"  MATCH: {finding['explanation']}")
    # else:
    #     print("  No DDoS/Flood detected (or rule not active).")

    print("\nSignature Engine Test Complete.")
