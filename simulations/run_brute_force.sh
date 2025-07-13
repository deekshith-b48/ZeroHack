#!/bin/bash
# Brute-Force Simulation Script using Hydra

# WARNING: This script attempts to perform a brute-force login attack.
# Use only against systems you own and have explicit permission to test.

# Check if hydra is installed
if ! command -v hydra &> /dev/null
then
    echo "[!] hydra could not be found. Please install it."
    echo "    On Debian/Ubuntu: sudo apt-get install hydra"
    exit 1
fi

# Check for required arguments
if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <target_ip> <username> <password_list_file>"
    echo "Example: $0 127.0.0.1 admin /path/to/passwords.txt"
    exit 1
fi

TARGET=$1
USERNAME=$2
PASSWORD_FILE=$3
LOG_DIR="logs"
OUTPUT_FILE="$LOG_DIR/hydra_bruteforce_$(date +%Y%m%d_%H%M%S).log"

if [ ! -f "$PASSWORD_FILE" ]; then
    echo "[!] Password file not found at: $PASSWORD_FILE"
    exit 1
fi

# Create log directory if it doesn't exist
mkdir -p $LOG_DIR

echo "[*] Starting Brute-Force Simulation (SSH) against $TARGET with username '$USERNAME'"
echo "[*] Using password list: $PASSWORD_FILE"
echo "[*] Output will be saved to: $OUTPUT_FILE"

# Run hydra for an SSH brute-force attack
# -l: Specify the username
# -P: Specify the password list file
# -t 4: Number of parallel tasks (threads)
# -o: Save output to a file
# ssh://<target>: Specify the service and target
hydra -l $USERNAME -P $PASSWORD_FILE -t 4 -o "$OUTPUT_FILE" ssh://$TARGET

echo "[✔] Hydra brute-force attempt finished. Log saved to $OUTPUT_FILE."
echo "[i] You can now use send_to_pipeline.py to process this log file."
echo "   Example: python send_to_pipeline.py $OUTPUT_FILE"
