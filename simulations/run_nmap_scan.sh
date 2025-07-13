#!/bin/bash
# Nmap Port Scan Simulation Script

# Check if a target IP was provided
if [ -z "$1" ]; then
    echo "Usage: $0 <target_ip>"
    echo "Example: $0 127.0.0.1"
    exit 1
fi

TARGET=$1
LOG_DIR="logs"
OUTPUT_FILE="$LOG_DIR/nmap_scan_$(date +%Y%m%d_%H%M%S).log"

# Create log directory if it doesn't exist
mkdir -p $LOG_DIR

echo "[*] Running Nmap SYN Stealth Scan on target: $TARGET"
echo "[*] Scanning common ports. This may take a moment..."
echo "[*] Output will be saved to: $OUTPUT_FILE"

# Run nmap scan
# -sS: SYN Stealth Scan (less noisy than a full connect scan)
# -p-: Scans all 65535 ports. For a quicker test, use a smaller range like -p 1-1024 or specific ports.
# -oN: Normal output format, saved to the specified file.
# -T4: Aggressive timing template for faster scans.
nmap -sS -T4 -p- $TARGET -oN "$OUTPUT_FILE"

echo "[✔] Nmap scan complete. Log saved to $OUTPUT_FILE."
echo "[i] You can now use send_to_pipeline.py to process this log file."
echo "   Example: python send_to_pipeline.py $OUTPUT_FILE"
