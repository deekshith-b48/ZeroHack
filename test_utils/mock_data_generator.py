import pandas as pd
import datetime
import random
import numpy as np

DEFAULT_NUM_NORMAL_EVENTS = 50
DEFAULT_NUM_ATTACK_EVENTS = 15 # For more targeted attacks like port scan

# --- Generic Numeric Feature Generation ---
def generate_generic_features(num_events, is_anomaly=False):
    """Generates some generic numeric features for AI model input."""
    if is_anomaly:
        # Anomalous features might have values outside typical ranges or different distributions
        feature1 = np.random.rand(num_events) * random.uniform(1, 3) - random.uniform(0, 0.5)
        feature2 = np.random.randint(100, 500, num_events)
        feature3 = np.random.normal(loc=5.0, scale=2.0, size=num_events) # Different distribution
    else:
        # Normal features
        feature1 = np.random.rand(num_events) * random.uniform(0.1, 0.9)
        feature2 = np.random.randint(10, 200, num_events)
        feature3 = np.random.normal(loc=2.0, scale=0.5, size=num_events)
    return pd.DataFrame({'SomeFeature1': feature1, 'SomeFeature2': feature2, 'SomeFeature3': feature3})


# --- SSH Brute-Force Scenario ---
def generate_ssh_brute_force_data(target_ip="10.0.0.5", attacker_ip="192.168.1.101", num_attempts=7, window_seconds=30):
    """
    Generates data simulating an SSH brute-force attack.
    """
    events = []
    base_time = datetime.datetime.now() - datetime.timedelta(minutes=1) # Start a minute ago

    for i in range(num_attempts):
        events.append({
            'timestamp': base_time + datetime.timedelta(seconds=(i * (window_seconds // num_attempts))),
            'source_ip': attacker_ip,
            'dest_ip': target_ip,
            'dest_port': 22, # SSH port
            'protocol': 'TCP',
            'flags': 'S', # SYN flag for connection attempt
            # Add some generic numeric features that might look anomalous for AI
            'SomeFeature1': 0.7 + i * 0.02 + random.uniform(-0.05, 0.05),
            'SomeFeature2': 150 + i * 5 + random.randint(-10, 10),
            'SomeFeature3': random.uniform(3.0, 7.0),
            'Label': 'SSH_BruteForce_Attack'
        })

    # Add a few unrelated "normal" events to mix in
    for i in range(3):
        events.append({
            'timestamp': base_time + datetime.timedelta(seconds=random.randint(0, window_seconds + 10)),
            'source_ip': f"172.16.0.{random.randint(1,5)}",
            'dest_ip': f"10.0.0.{random.randint(10,15)}",
            'dest_port': random.choice([80, 443]),
            'protocol': 'TCP',
            'flags': 'PA',
            'SomeFeature1': random.uniform(0.1, 0.9),
            'SomeFeature2': random.randint(10, 200),
            'SomeFeature3': random.uniform(1.0, 3.0),
            'Label': 'Normal_SSH_Context'
        })

    return pd.DataFrame(events)

# --- Port Scan Scenario ---
def generate_port_scan_data(target_ip="10.0.0.10", attacker_ip="192.168.1.102", num_ports_scanned=15, window_seconds=45):
    """
    Generates data simulating a port scan.
    """
    events = []
    base_time = datetime.datetime.now() - datetime.timedelta(minutes=2)

    scanned_ports = random.sample(range(1, 1024), num_ports_scanned) # Scan common low ports

    for i, port in enumerate(scanned_ports):
        events.append({
            'timestamp': base_time + datetime.timedelta(seconds=(i * (window_seconds // num_ports_scanned))),
            'source_ip': attacker_ip,
            'dest_ip': target_ip,
            'dest_port': port,
            'protocol': 'TCP',
            'flags': 'S',
            # Generic features, could make them slightly distinct for scanners
            'SomeFeature1': 0.3 + random.uniform(-0.1, 0.1),
            'SomeFeature2': 50 + random.randint(-10, 10),
            'SomeFeature3': random.uniform(0.5, 2.0),
            'Label': 'PortScan_Attack'
        })

    # Add some noise
    for i in range(3):
         events.append({
            'timestamp': base_time + datetime.timedelta(seconds=random.randint(0, window_seconds + 10)),
            'source_ip': f"172.16.1.{random.randint(1,5)}",
            'dest_ip': f"10.0.1.{random.randint(10,15)}",
            'dest_port': random.choice([53, 123]),
            'protocol': 'UDP',
            'flags': '',
            'SomeFeature1': random.uniform(0.1, 0.9),
            'SomeFeature2': random.randint(10, 200),
            'SomeFeature3': random.uniform(1.0, 3.0),
            'Label': 'Normal_PortScan_Context'
        })

    return pd.DataFrame(events)

# --- Normal Traffic Scenario ---
def generate_normal_traffic_data(num_events=DEFAULT_NUM_NORMAL_EVENTS, duration_minutes=5):
    """
    Generates data simulating normal network traffic.
    """
    events = []
    base_time = datetime.datetime.now() - datetime.timedelta(minutes=duration_minutes + 5)

    for i in range(num_events):
        source_ip = f"192.168.0.{random.randint(10, 100)}"
        dest_ip_segment = random.randint(1, 20)
        dest_ip = f"10.0.{dest_ip_segment}.{random.randint(1,254)}"
        dest_port = random.choice([80, 443, 53, 123, 25, 110, 143]) # Common service ports

        events.append({
            'timestamp': base_time + datetime.timedelta(seconds=random.randint(0, duration_minutes * 60)),
            'source_ip': source_ip,
            'dest_ip': dest_ip,
            'dest_port': dest_port,
            'protocol': random.choice(['TCP', 'UDP']),
            'flags': random.choice(['S', 'A', 'PA', 'FPA', '']),
            'SomeFeature1': random.uniform(0.1, 0.9),
            'SomeFeature2': random.randint(10, 200),
            'SomeFeature3': random.uniform(1.0, 3.0),
            'Label': 'Normal_Traffic'
        })
    return pd.DataFrame(events)


if __name__ == '__main__':
    print("--- Generating Mock SSH Brute Force Data ---")
    ssh_df = generate_ssh_brute_force_data()
    print(ssh_df.head())
    print(f"Shape: {ssh_df.shape}\n")

    print("--- Generating Mock Port Scan Data ---")
    pscan_df = generate_port_scan_data()
    print(pscan_df.head())
    print(f"Shape: {pscan_df.shape}\n")

    print("--- Generating Mock Normal Traffic Data ---")
    normal_df = generate_normal_traffic_data(num_events=10)
    print(normal_df.head())
    print(f"Shape: {normal_df.shape}\n")

    print("Mock data generation examples complete.")
