import os
import json
from web3 import Web3
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Configuration & Setup ---
RPC_URL = os.getenv("ZERO_HACK_BLOCKCHAIN_RPC_URL")
CONTRACT_ADDRESS = os.getenv("ZERO_HACK_RESPONSE_CONTRACT_ADDRESS")
SENDER_PRIVATE_KEY = os.getenv("ZERO_HACK_SENDER_PRIVATE_KEY")
SENDER_ACCOUNT_ADDRESS = os.getenv("ZERO_HACK_SENDER_ACCOUNT_ADDRESS")
ABI_PATH = "blockchain/ZeroHackResponseEngineABI.json"

# --- Validation ---
if not all([RPC_URL, CONTRACT_ADDRESS, SENDER_PRIVATE_KEY, SENDER_ACCOUNT_ADDRESS]):
    raise EnvironmentError("One or more required environment variables are not set. "
                           "Please check your .env file for: ZERO_HACK_BLOCKCHAIN_RPC_URL, "
                           "ZERO_HACK_RESPONSE_CONTRACT_ADDRESS, ZERO_HACK_SENDER_PRIVATE_KEY, "
                           "ZERO_HACK_SENDER_ACCOUNT_ADDRESS")

try:
    with open(ABI_PATH, "r") as abi_file:
        abi = json.load(abi_file)
except FileNotFoundError:
    raise FileNotFoundError(f"ABI file not found at {ABI_PATH}. Please ensure it exists.")
except json.JSONDecodeError:
    raise ValueError(f"Error decoding JSON from ABI file at {ABI_PATH}.")


# --- Web3 Connection ---
w3 = Web3(Web3.HTTPProvider(RPC_URL))
if not w3.is_connected():
    raise ConnectionError(f"Failed to connect to blockchain at {RPC_URL}")

contract_address_checksum = Web3.to_checksum_address(CONTRACT_ADDRESS)
sender_account_checksum = Web3.to_checksum_address(SENDER_ACCOUNT_ADDRESS)
contract = w3.eth.contract(address=contract_address_checksum, abi=abi)


# === Test Data ===
test_ip = "198.51.100.42"
test_attack_type = "SSH Brute-Force"
test_explanation = "Automated test: Detected repeated SSH login failures from test script."

# === Build and Send Transaction ===
def report_incident():
    print(f"[*] Preparing to report incident for IP: {test_ip}")
    nonce = w3.eth.get_transaction_count(sender_account_checksum)

    # Build transaction using the function signature from the ABI
    txn = contract.functions.reportIncident(
        test_ip,
        test_attack_type,
        test_explanation
    ).build_transaction({
        "from": sender_account_checksum,
        "nonce": nonce,
        "gas": 2000000,
        "gasPrice": w3.to_wei("20", "gwei"),
    })

    signed_txn = w3.eth.account.sign_transaction(txn, private_key=SENDER_PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
    print(f"[⏳] Transaction sent successfully. Hash: {tx_hash.hex()}")
    return tx_hash

# === Wait for Receipt and Process Logs ===
def decode_logs(receipt):
    print("\n[*] Decoding logs from transaction receipt...")

    # Decode IncidentReported event
    incident_logs = contract.events.IncidentReported().process_receipt(receipt)
    if incident_logs:
        for event in incident_logs:
            args = event['args']
            print(f"  [📢] IncidentReported: reporter={args['reporter']}, ipAddress={args['ipAddress']}, attackType='{args['attackType']}', explanation='{args['explanation'][:30]}...'")
    else:
        print("  [?] No 'IncidentReported' event found.")

    # Decode IPQuarantined event
    quarantine_logs = contract.events.IPQuarantined().process_receipt(receipt)
    if quarantine_logs:
        for event in quarantine_logs:
            args = event['args']
            print(f"  [🔒] IPQuarantined: ipAddress={args['ipAddress']}, timestamp={args['timestamp']}")
    else:
        print("  [?] No 'IPQuarantined' event found.")

    # Decode AdminAlert event
    admin_alert_logs = contract.events.AdminAlert().process_receipt(receipt)
    if admin_alert_logs:
        for event in admin_alert_logs:
            args = event['args']
            print(f"  [⚠️] AdminAlert: message='{args['message']}', ipAddress={args['ipAddress']}, attackType='{args['attackType']}', timestamp={args['timestamp']}")
    else:
        print("  [?] No 'AdminAlert' event found.")

    # Decode PeerBroadcast event
    peer_broadcast_logs = contract.events.PeerBroadcast().process_receipt(receipt)
    if peer_broadcast_logs:
        for event in peer_broadcast_logs:
            args = event['args']
            print(f"  [🌐] PeerBroadcast: ipAddress={args['ipAddress']}, attackType='{args['attackType']}', timestamp={args['timestamp']}")
    else:
        print("  [?] No 'PeerBroadcast' event found.")

# === Run Test ===
if __name__ == "__main__":
    print("--- ZeroHack Smart Contract Integration Test ---")
    try:
        tx_hash = report_incident()
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"[✅] Transaction confirmed in block {receipt.blockNumber} with status {'Success' if receipt.status == 1 else 'Failed'}")
        if receipt.status == 1:
            decode_logs(receipt)
        else:
            print("[!] Transaction was confirmed but failed (reverted). Check contract logic and gas.")
    except Exception as e:
        print(f"[❌] Test failed with an exception: {e}")
    print("\n--- Test Complete ---")
