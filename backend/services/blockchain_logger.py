# blockchain_logger.py

import os
import json
from web3 import Web3
# Ensure python-dotenv is in requirements.txt if not already
# For now, assuming it's installed if .env is to be used.
# If running in an environment where .env isn't standard, direct env var setting is needed.
try:
    from dotenv import load_dotenv
    load_dotenv() # Load environment variables from .env file
    print("Loaded .env file if present.")
except ImportError:
    print("python-dotenv not found, ensure environment variables are set manually if .env is not used.")

import config # For logger, and potentially for centralizing env var names

logger = config.get_logger(__name__)

# Configurable values from environment variables
# Using more descriptive names and defaulting to None if not set
BLOCKCHAIN_RPC_URL = os.getenv("ZERO_HACK_BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545") # Default for local dev
CONTRACT_ADDRESS_STR = os.getenv("ZERO_HACK_CONTRACT_ADDRESS")
SENDER_PRIVATE_KEY = os.getenv("ZERO_HACK_SENDER_PRIVATE_KEY")
SENDER_ACCOUNT_ADDRESS = os.getenv("ZERO_HACK_SENDER_ACCOUNT_ADDRESS")

# Path to Contract ABI JSON file (relative to project root or a defined base path)
# For now, let's assume it's in a 'blockchain' folder at the root, next to 'backend'
ABI_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "blockchain", "ZeroHackLoggerABI.json")


web3_instance = None
contract_instance = None
is_connected_and_configured = False

def connect_and_load_contract():
    global web3_instance, contract_instance, is_connected_and_configured

    if not BLOCKCHAIN_RPC_URL:
        logger.error("BLOCKCHAIN_RPC_URL not set in environment.")
        return False
    if not CONTRACT_ADDRESS_STR:
        logger.error("ZERO_HACK_CONTRACT_ADDRESS not set in environment.")
        return False
    if not SENDER_PRIVATE_KEY:
        logger.error("ZERO_HACK_SENDER_PRIVATE_KEY not set in environment (required for transactions).")
        return False
    if not SENDER_ACCOUNT_ADDRESS:
        logger.error("ZERO_HACK_SENDER_ACCOUNT_ADDRESS not set in environment (required for transactions).")
        return False

    try:
        with open(ABI_FILE_PATH, 'r') as f:
            contract_abi = json.load(f)
    except FileNotFoundError:
        logger.error(f"Contract ABI file not found at: {ABI_FILE_PATH}")
        return False
    except json.JSONDecodeError:
        logger.error(f"Error decoding Contract ABI JSON from: {ABI_FILE_PATH}")
        return False

    web3_instance = Web3(Web3.HTTPProvider(BLOCKCHAIN_RPC_URL))

    # Updated check for web3.py v6+
    if not web3_instance.is_connected():
        logger.error(f"Web3 provider not connected at URL: {BLOCKCHAIN_RPC_URL}")
        return False
    logger.info(f"Successfully connected to Ethereum node at {BLOCKCHAIN_RPC_URL}. Chain ID: {web3_instance.eth.chain_id}")

    try:
        checksum_contract_address = web3_instance.to_checksum_address(CONTRACT_ADDRESS_STR)
        sender_account_checksum = web3_instance.to_checksum_address(SENDER_ACCOUNT_ADDRESS)
    except Exception as e:
        logger.error(f"Error converting address to checksum: {e}. Ensure addresses are valid.")
        return False

    os.environ['ZERO_HACK_SENDER_ACCOUNT_ADDRESS'] = sender_account_checksum # Ensure env var is checksummed if used elsewhere directly

    contract_instance = web3_instance.eth.contract(address=checksum_contract_address, abi=contract_abi)
    is_connected_and_configured = True
    logger.info(f"ZeroHackLogger contract loaded at address: {checksum_contract_address}")
    return True

def log_incident_to_blockchain(source_ip: str, timestamp: str, attack_type: str, explanation: str, ipfs_hash: str = ""):
    global is_connected_and_configured, web3_instance, contract_instance

    if not is_connected_and_configured:
        logger.error("Blockchain logger not connected or configured. Cannot log incident.")
        if not connect_and_load_contract(): # Attempt to connect if not already
             logger.error("Re-connection/configuration attempt failed.")
             return None

    # Ensure SENDER_ACCOUNT_ADDRESS from env is used, which should be checksummed by connect_and_load_contract
    sender_address_from_env = os.getenv("ZERO_HACK_SENDER_ACCOUNT_ADDRESS")

    try:
        nonce = web3_instance.eth.get_transaction_count(sender_address_from_env)

        # Estimate gas or use a sufficiently large fixed amount for testnets
        # Ensure parameter names match the new ABI: _sourceIP, _timestamp, etc.
        gas_estimate = contract_instance.functions.logIncident(
            source_ip, # Solidity expects _sourceIP, but web3.py maps by order or name if exact.
            timestamp, # _timestamp
            attack_type, # _attackType
            explanation, # _explanation
            ipfs_hash # _ipfsHash
        ).estimate_gas({'from': sender_address_from_env})

        logger.debug(f"Estimated gas for logIncident: {gas_estimate}")
        gas_limit = int(gas_estimate * 1.2) # Add 20% buffer

        # For local testnets, gas price can often be fetched or set low.
        # For public testnets/mainnet, this needs care.
        current_gas_price = web3_instance.eth.gas_price
        logger.debug(f"Current gas price: {web3_instance.from_wei(current_gas_price, 'gwei')} gwei")


        txn_params = {
            'chainId': web3_instance.eth.chain_id,
            'from': sender_address_from_env,
            'nonce': nonce,
            'gas': gas_limit,
            'gasPrice': current_gas_price
            # For EIP-1559 transactions (recommended for networks that support it):
            # 'maxFeePerGas': web3.to_wei('250', 'gwei'),
            # 'maxPriorityFeePerGas': web3.to_wei('2', 'gwei'),
        }

        logger.debug(f"Transaction params: {txn_params}")

        txn = contract_instance.functions.logIncident(
            source_ip,
            timestamp,
            attack_type,
            explanation,
            ipfs_hash
        ).build_transaction(txn_params)

        signed_txn = web3_instance.eth.account.sign_transaction(txn, private_key=SENDER_PRIVATE_KEY)
        tx_hash = web3_instance.eth.send_raw_transaction(signed_txn.rawTransaction)

        hex_tx_hash = web3_instance.to_hex(tx_hash)
        logger.info(f"Incident logged to blockchain! Tx hash: {hex_tx_hash}")

        # Optional: Wait for transaction receipt (can be slow)
        # tx_receipt = web3_instance.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        # logger.info(f"Transaction confirmed. Block number: {tx_receipt.blockNumber}, Gas used: {tx_receipt.gasUsed}")

        return hex_tx_hash

    except Exception as e:
        logger.error(f"Blockchain logging failed: {e}", exc_info=True)
        return None

# Initialize connection when module is loaded
connect_and_load_contract()

if __name__ == '__main__':
    logger.info("Testing blockchain_logger.py...")
    if is_connected_and_configured:
        logger.info("Web3 connected and contract configured.")
        # Example usage:
        # Ensure your .env file is set up with ZERO_HACK_BLOCKCHAIN_RPC_URL,
        # ZERO_HACK_CONTRACT_ADDRESS, ZERO_HACK_SENDER_PRIVATE_KEY, ZERO_HACK_SENDER_ACCOUNT_ADDRESS

        # Create a dummy ABI file for testing if it doesn't exist and you are running this directly
        # In a real scenario, this ABI comes from contract compilation
        if not os.path.exists(ABI_FILE_PATH):
            logger.warning(f"ABI file {ABI_FILE_PATH} not found. Creating a dummy one for direct script run test.")
            dummy_abi_dir = os.path.dirname(ABI_FILE_PATH)
            if not os.path.exists(dummy_abi_dir):
                os.makedirs(dummy_abi_dir)
            dummy_abi = [{
                "anonymous": False, "inputs": [
                    {"indexed": True, "internalType": "address", "name": "reporter", "type": "address"},
                    {"indexed": False, "internalType": "string", "name": "sourceIP", "type": "string"},
                    {"indexed": False, "internalType": "string", "name": "timestamp", "type": "string"},
                    {"indexed": False, "internalType": "string", "name": "attackType", "type": "string"},
                    {"indexed": False, "internalType": "string", "name": "explanation", "type": "string"},
                    {"indexed": False, "internalType": "string", "name": "ipfsHash", "type": "string"}
                ], "name": "IncidentLogged", "type": "event"
            }, {
                "inputs": [
                    {"internalType": "string", "name": "sourceIP", "type": "string"},
                    {"internalType": "string", "name": "timestamp", "type": "string"},
                    {"internalType": "string", "name": "attackType", "type": "string"},
                    {"internalType": "string", "name": "explanation", "type": "string"},
                    {"internalType": "string", "name": "ipfsHash", "type": "string"}
                ], "name": "logIncident", "outputs": [], "stateMutability": "nonpayable", "type": "function"
            }] # Simplified ABI for the logIncident function and event
            with open(ABI_FILE_PATH, 'w') as f_abi:
                json.dump(dummy_abi, f_abi)
            logger.info(f"Dummy ABI created at {ABI_FILE_PATH}. Re-run connect_and_load_contract if needed or ensure correct ABI.")
            # Need to re-initialize after creating dummy ABI if it was missing
            if not connect_and_load_contract():
                 print("Failed to connect after creating dummy ABI. Exiting test.")
                 exit()


        if CONTRACT_ADDRESS_STR and SENDER_PRIVATE_KEY and SENDER_ACCOUNT_ADDRESS:
            tx_hash_result = log_incident_to_blockchain(
                ip="192.168.1.100",
                timestamp=datetime.datetime.now().isoformat(),
                attack_type="Test Attack",
                explanation="This is a test incident from blockchain_logger.py",
                ipfs_hash="QmTestHash123"
            )
            if tx_hash_result:
                logger.info(f"Test incident logged successfully. Tx: {tx_hash_result}")
            else:
                logger.error("Test incident logging failed.")
        else:
            logger.warning("Required environment variables for sending a transaction (CONTRACT_ADDRESS, PRIVATE_KEY, ACCOUNT_ADDRESS) are not fully set. Skipping transaction test.")
    else:
        logger.error("Failed to connect to blockchain or load contract. Check config and .env file.")
        logger.info(f"Expected ABI path: {os.path.abspath(ABI_FILE_PATH)}")
        logger.info("Ensure your local Ethereum node (Ganache/Hardhat) is running and accessible via an RPC URL,")
        logger.info("and that the contract is deployed, and its address and ABI are correctly configured.")
