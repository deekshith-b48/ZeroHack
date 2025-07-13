import os
import json
from web3 import Web3
from web3.middleware import geth_poa_middleware # For PoA chains like Ganache, some testnets
from typing import Optional, Any

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import config

logger = config.get_logger(__name__)

# --- Response Engine Contract Configuration ---
RESPONSE_RPC_URL = os.getenv("ZERO_HACK_BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
RESPONSE_CONTRACT_ADDRESS_STR = os.getenv("ZERO_HACK_RESPONSE_CONTRACT_ADDRESS")
RESPONSE_SENDER_PRIVATE_KEY = os.getenv("ZERO_HACK_SENDER_PRIVATE_KEY")
RESPONSE_SENDER_ACCOUNT_ADDRESS = os.getenv("ZERO_HACK_SENDER_ACCOUNT_ADDRESS")
RESPONSE_ABI_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "blockchain", "ZeroHackResponseEngineABI.json")


# --- Global Instances ---
response_web3_instance: Optional[Web3] = None
response_contract_instance: Optional[Any] = None
response_is_connected = False

def _get_web3_instance() -> Optional[Web3]:
    """Connects to the Ethereum node and returns a Web3 instance."""
    global response_web3_instance
    if response_web3_instance and response_web3_instance.is_connected():
        return response_web3_instance

    if not RESPONSE_RPC_URL:
        logger.error("Response Engine: BLOCKCHAIN_RPC_URL not set.")
        return None

    instance = Web3(Web3.HTTPProvider(RESPONSE_RPC_URL))
    # Add middleware for PoA chains like Ganache, which might be needed
    instance.middleware_onion.inject(geth_poa_middleware, layer=0)

    if not instance.is_connected():
        logger.error(f"Response Engine: Failed to connect to Web3 provider at {RESPONSE_RPC_URL}")
        return None

    logger.info(f"Response Engine: Connected to Web3 provider at {RESPONSE_RPC_URL}. Chain ID: {instance.eth.chain_id}")
    response_web3_instance = instance
    return response_web3_instance

def _get_contract_instance() -> Optional[Any]:
    """Loads the smart contract instance."""
    global response_contract_instance
    if response_contract_instance:
        return response_contract_instance

    w3 = _get_web3_instance()
    if not w3: return None

    if not RESPONSE_CONTRACT_ADDRESS_STR:
        logger.error("Response Engine: ZERO_HACK_RESPONSE_CONTRACT_ADDRESS not set.")
        return None

    try:
        with open(RESPONSE_ABI_FILE_PATH, 'r') as f:
            abi = json.load(f)
    except Exception as e:
        logger.error(f"Response Engine: Failed to load ABI from {RESPONSE_ABI_FILE_PATH}: {e}")
        return None

    try:
        checksum_address = w3.to_checksum_address(RESPONSE_CONTRACT_ADDRESS_STR)
        response_contract_instance = w3.eth.contract(address=checksum_address, abi=abi)
        logger.info(f"Response Engine: Contract instance loaded at {checksum_address}")
        return response_contract_instance
    except Exception as e:
        logger.error(f"Response Engine: Failed to create contract instance: {e}")
        return None

def report_incident(ip: str, attack_type: str, explanation: str) -> Optional[dict]:
    """
    Calls the reportIncident function on the smart contract.

    Returns:
        The transaction receipt as a dictionary if successful, else None.
    """
    contract = _get_contract_instance()
    w3 = _get_web3_instance()

    if not contract or not w3:
        logger.error("Response Engine: report_incident called but contract/web3 not initialized.")
        return None

    if not all([RESPONSE_SENDER_ACCOUNT_ADDRESS, RESPONSE_SENDER_PRIVATE_KEY]):
        logger.error("Response Engine: Sender address or private key not configured.")
        return None

    try:
        account = w3.to_checksum_address(RESPONSE_SENDER_ACCOUNT_ADDRESS)

        # Build transaction
        txn = contract.functions.reportIncident(ip, attack_type, explanation).build_transaction({
            'from': account,
            'nonce': w3.eth.get_transaction_count(account),
            'gas': 2000000,  # Using a generous fixed gas limit as specified
            'gasPrice': w3.to_wei('50', 'gwei') # Using a fixed gas price as specified
        })

        # Sign and send
        signed_txn = w3.eth.account.sign_transaction(txn, private_key=RESPONSE_SENDER_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        logger.info(f"Response Engine: Transaction sent. Hash: {tx_hash.hex()}")

        # Wait for receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        logger.info(f"Response Engine: Transaction confirmed. Receipt: {receipt}")

        # Convert receipt to a dictionary for easier use
        return json.loads(w3.to_json(receipt))

    except Exception as e:
        logger.error(f"Response Engine: Failed to report incident to blockchain: {e}", exc_info=True)
        return None

def get_quarantine_status(ip: str) -> Optional[bool]:
    """
    Calls the getQuarantineStatus view function on the smart contract.

    Returns:
        The boolean quarantine status if successful, else None.
    """
    contract = _get_contract_instance()
    w3 = _get_web3_instance()

    if not contract or not w3:
        logger.error("Response Engine: get_quarantine_status called but contract/web3 not initialized.")
        return None

    try:
        status = contract.functions.getQuarantineStatus(ip).call()
        logger.info(f"Response Engine: Quarantine status for IP {ip} is {status}")
        return status
    except Exception as e:
        logger.error(f"Response Engine: Failed to get quarantine status for IP {ip}: {e}", exc_info=True)
        return None


if __name__ == '__main__':
    logger.info("Testing Blockchain Response Engine module...")

    # This test requires .env file to be set up with all RESPONSE_... variables
    if not RESPONSE_CONTRACT_ADDRESS_STR or not RESPONSE_SENDER_ACCOUNT_ADDRESS or not RESPONSE_SENDER_PRIVATE_KEY:
        logger.warning("Required environment variables for testing are not set. Skipping transaction test.")
        logger.warning("Please set: ZERO_HACK_BLOCKCHAIN_RPC_URL, ZERO_HACK_RESPONSE_CONTRACT_ADDRESS, ZERO_HACK_SENDER_ACCOUNT_ADDRESS, ZERO_HACK_SENDER_PRIVATE_KEY")
    else:
        logger.info("Attempting to send a test incident report...")
        test_receipt = report_incident(
            ip="192.168.10.101",
            attack_type="Test_Incident_from_Script",
            explanation="This is a test run of blockchain_response_engine.py"
        )
        if test_receipt:
            logger.info(f"Successfully sent test transaction. Tx Hash: {test_receipt.get('transactionHash')}")
            logger.info("Check your Ganache/Hardhat node for the new transaction and emitted events.")
        else:
            logger.error("Failed to send test transaction.")

    logger.info("Test run finished.")
