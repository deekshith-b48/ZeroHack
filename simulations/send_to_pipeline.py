import requests
import json
import argparse
import os
import re
import datetime

# Configuration
API_ENDPOINT = os.getenv("ZERO_HACK_ANALYZE_API_URL", "http://localhost:8008/api/analyze")

def parse_nmap_log(content: str) -> dict:
    """
    A very basic parser for nmap logs to extract key info.
    This is a placeholder for a more robust log parsing engine.
    """
    print("[*] Parsing Nmap log...")
    events = []
    source_ip = "127.0.0.1" # Placeholder, as nmap log doesn't show our source IP
    target_ip = ""

    ip_match = re.search(r"Nmap scan report for ([\d\.]+)", content)
    if ip_match:
        target_ip = ip_match.group(1)

    for line in content.splitlines():
        # Look for lines like "22/tcp  open  ssh"
        match = re.match(r"(\d+)\/(tcp|udp)\s+(\w+)\s+.*", line)
        if match and target_ip:
            port = int(match.group(1))
            protocol = match.group(2).upper()
            status = match.group(3)

            if status == "open":
                events.append({
                    "timestamp": datetime.datetime.now().isoformat(),
                    "source_ip": source_ip,
                    "dest_ip": target_ip,
                    "dest_port": port,
                    "protocol": protocol,
                    "flags": "S", # Assumed for a scan
                    "SomeFeature1": float(port) / 1000.0, # Example feature
                    "SomeFeature2": 1.0 # Example feature
                })

    print(f"[+] Parsed {len(events)} 'open port' events from Nmap log for target {target_ip}.")
    return {"events": events} if events else {}


def parse_generic_log(content: str, source_ip_guess: str) -> dict:
    """
    A generic parser that wraps the raw log content.
    The backend pipeline would need a dedicated parser for this raw log format.
    """
    print("[*] Parsing generic log...")
    # This is a mock payload. The current `/api/analyze` endpoint expects
    # a list of structured events, not a single raw log blob.
    # This function simulates creating a single event from the log.
    payload = {
        "events": [
            {
                "timestamp": datetime.datetime.now().isoformat(),
                "source_ip": source_ip_guess,
                "dest_ip": "Unknown",
                "dest_port": 0,
                "raw_log_content": content[:2000] # Truncate for sanity
            }
        ]
    }
    print("[+] Created a mock payload from the generic log.")
    return payload


def send_to_pipeline(payload: dict):
    """Sends the processed data to the ZeroHack API pipeline."""
    if not payload or not payload.get("events"):
        print("[!] Payload is empty or invalid. Nothing to send.")
        return

    print(f"[*] Sending {len(payload['events'])} events to pipeline at {API_ENDPOINT}...")
    try:
        response = requests.post(API_ENDPOINT, json=payload, timeout=60)

        print(f"[✔] Server responded with status code: {response.status_code}")
        try:
            print("[✔] Server response JSON:")
            print(json.dumps(response.json(), indent=2))
        except json.JSONDecodeError:
            print("[!] Could not decode JSON from response.")
            print(f"    Raw response: {response.text}")

    except requests.exceptions.RequestException as e:
        print(f"[❌] Failed to send data to pipeline: {e}")


def main():
    parser = argparse.ArgumentParser(description="Parse log files and send data to ZeroHack detection pipeline.")
    parser.add_argument("log_file", help="Path to the log file to process.")
    parser.add_argument("--type", choices=['nmap', 'generic'], default='generic',
                        help="Type of log file to parse. 'nmap' has a basic custom parser, 'generic' sends raw content.")
    parser.add_argument("--source-ip", default="127.0.0.1",
                        help="A guess for the source IP, mainly for 'generic' log type.")

    args = parser.parse_args()

    if not os.path.exists(args.log_file):
        print(f"[!] Error: Log file not found at '{args.log_file}'")
        return

    with open(args.log_file, 'r') as f:
        content = f.read()

    if args.type == 'nmap':
        payload = parse_nmap_log(content)
    else: # generic
        payload = parse_generic_log(content, args.source_ip)

    send_to_pipeline(payload)


if __name__ == "__main__":
    main()
