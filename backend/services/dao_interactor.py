import os
import json
from web3 import Web3
from typing import List, Dict, Any, Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass # python-dotenv is optional, env vars can be set manually

import config # For logger

logger = config.get_logger(__name__)

# --- DAO Contract Configuration ---
DAO_BLOCKCHAIN_RPC_URL = os.getenv("ZERO_HACK_BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545") # Same RPC as logger likely
DAO_CONTRACT_ADDRESS_STR = os.getenv("ZERO_HACK_DAO_CONTRACT_ADDRESS")
# For sending transactions (propose, vote, execute) - these would often be specific to a user via frontend/wallet
# For backend-initiated actions or tests, a service account can be used.
DAO_SENDER_PRIVATE_KEY = os.getenv("ZERO_HACK_DAO_SENDER_PRIVATE_KEY", os.getenv("ZERO_HACK_SENDER_PRIVATE_KEY"))
DAO_SENDER_ACCOUNT_ADDRESS = os.getenv("ZERO_HACK_DAO_SENDER_ACCOUNT_ADDRESS", os.getenv("ZERO_HACK_SENDER_ACCOUNT_ADDRESS"))

DAO_ABI_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "blockchain", "ZeroHackDAOABI.json")

# --- Web3 Connection and Contract Instance ---
dao_web3_instance: Optional[Web3] = None
dao_contract_instance: Optional[Any] = None # Web3.eth.Contract
dao_is_connected_and_configured = False

def connect_and_load_dao_contract():
    global dao_web3_instance, dao_contract_instance, dao_is_connected_and_configured

    if dao_is_connected_and_configured: # Already connected
        return True

    if not DAO_BLOCKCHAIN_RPC_URL:
        logger.error("DAO Interactor: BLOCKCHAIN_RPC_URL not set.")
        return False
    if not DAO_CONTRACT_ADDRESS_STR:
        logger.error("DAO Interactor: ZERO_HACK_DAO_CONTRACT_ADDRESS not set.")
        return False
    # Private key & sender address are needed for transactions, not for view calls.
    # We'll check for them specifically in functions that make transactions.

    try:
        with open(DAO_ABI_FILE_PATH, 'r') as f:
            contract_abi = json.load(f)
    except FileNotFoundError:
        logger.error(f"DAO Interactor: Contract ABI file not found at: {DAO_ABI_FILE_PATH}")
        return False
    except json.JSONDecodeError:
        logger.error(f"DAO Interactor: Error decoding DAO Contract ABI JSON from: {DAO_ABI_FILE_PATH}")
        return False

    dao_web3_instance = Web3(Web3.HTTPProvider(DAO_BLOCKCHAIN_RPC_URL))

    if not dao_web3_instance.is_connected():
        logger.error(f"DAO Interactor: Web3 provider not connected at URL: {DAO_BLOCKCHAIN_RPC_URL}")
        return False
    logger.info(f"DAO Interactor: Successfully connected to Ethereum node at {DAO_BLOCKCHAIN_RPC_URL}. Chain ID: {dao_web3_instance.eth.chain_id}")

    try:
        checksum_dao_contract_address = dao_web3_instance.to_checksum_address(DAO_CONTRACT_ADDRESS_STR)
    except Exception as e:
        logger.error(f"DAO Interactor: Error converting DAO contract address to checksum: {e}. Ensure address is valid.")
        return False

    dao_contract_instance = dao_web3_instance.eth.contract(address=checksum_dao_contract_address, abi=contract_abi)
    dao_is_connected_and_configured = True
    logger.info(f"DAO Interactor: ZeroHackDAO contract loaded at address: {checksum_dao_contract_address}")
    return True

def _send_dao_transaction(function_call, from_address, private_key):
    """Helper to send a transaction to the DAO contract."""
    if not dao_is_connected_and_configured or not dao_web3_instance or not from_address or not private_key:
        logger.error("DAO Tx Helper: Not configured to send transaction (missing RPC, address, key, or contract instance).")
        return None

    try:
        checksum_from_address = dao_web3_instance.to_checksum_address(from_address)
        nonce = dao_web3_instance.eth.get_transaction_count(checksum_from_address)

        gas_estimate = function_call.estimate_gas({'from': checksum_from_address})
        gas_limit = int(gas_estimate * 1.2) # 20% buffer
        current_gas_price = dao_web3_instance.eth.gas_price

        txn_params = {
            'chainId': dao_web3_instance.eth.chain_id,
            'from': checksum_from_address,
            'nonce': nonce,
            'gas': gas_limit,
            'gasPrice': current_gas_price
        }

        txn = function_call.build_transaction(txn_params)
        signed_txn = dao_web3_instance.eth.account.sign_transaction(txn, private_key=private_key)
        tx_hash = dao_web3_instance.eth.send_raw_transaction(signed_txn.rawTransaction)
        hex_tx_hash = dao_web3_instance.to_hex(tx_hash)
        logger.info(f"DAO transaction sent. Tx hash: {hex_tx_hash}")
        return hex_tx_hash
    except Exception as e:
        logger.error(f"DAO transaction failed: {e}", exc_info=True)
        return None

# --- DAO Contract Interaction Functions ---

def propose_ip_blacklist(proposed_ip: str, reason: str,
                         sender_address: str = DAO_SENDER_ACCOUNT_ADDRESS,
                         sender_private_key: str = DAO_SENDER_PRIVATE_KEY) -> Optional[str]:
    if not dao_contract_instance: connect_and_load_dao_contract()
    if not dao_contract_instance or not sender_address or not sender_private_key:
        logger.error("DAO propose_ip_blacklist: Missing contract instance or sender credentials.")
        return None

    function_call = dao_contract_instance.functions.createProposal(proposed_ip, reason)
    return _send_dao_transaction(function_call, sender_address, sender_private_key)

def cast_dao_vote(proposal_id: int, support: bool,
                  sender_address: str = DAO_SENDER_ACCOUNT_ADDRESS,
                  sender_private_key: str = DAO_SENDER_PRIVATE_KEY) -> Optional[str]:
    if not dao_contract_instance: connect_and_load_dao_contract()
    if not dao_contract_instance or not sender_address or not sender_private_key:
        logger.error("DAO cast_dao_vote: Missing contract instance or sender credentials.")
        return None

    function_call = dao_contract_instance.functions.vote(proposal_id, support)
    return _send_dao_transaction(function_call, sender_address, sender_private_key)

def execute_dao_proposal(proposal_id: int,
                         sender_address: str = DAO_SENDER_ACCOUNT_ADDRESS,
                         sender_private_key: str = DAO_SENDER_PRIVATE_KEY) -> Optional[str]:
    if not dao_contract_instance: connect_and_load_dao_contract()
    if not dao_contract_instance or not sender_address or not sender_private_key:
        logger.error("DAO execute_dao_proposal: Missing contract instance or sender credentials.")
        return None

    function_call = dao_contract_instance.functions.executeProposal(proposal_id)
    return _send_dao_transaction(function_call, sender_address, sender_private_key)

def get_dao_proposal_details(proposal_id: int) -> Optional[Dict[str, Any]]:
    if not dao_contract_instance: connect_and_load_dao_contract()
    if not dao_contract_instance: return None
    try:
        # ABI output names: id, ip, reason, yesVotes, noVotes, deadline, executed
        proposal_data = dao_contract_instance.functions.getProposal(proposal_id).call()
        return {
            "id": proposal_data[0],
            "ip": proposal_data[1],
            "reason": proposal_data[2],
            "yesVotes": proposal_data[3],
            "noVotes": proposal_data[4],
            "deadline": proposal_data[5], # Timestamp
            "executed": proposal_data[6]
            # "passed" status is determined off-chain or by an event after execution
        }
    except Exception as e:
        logger.error(f"DAO Error fetching proposal {proposal_id}: {e}", exc_info=True)
        return None

def get_dao_proposal_count() -> Optional[int]:
    if not dao_contract_instance: connect_and_load_dao_contract()
    if not dao_contract_instance: return None
    try:
        return dao_contract_instance.functions.proposalCount().call()
    except Exception as e:
        logger.error(f"DAO Error fetching proposal count: {e}", exc_info=True)
        return None

def check_is_voter(address: str) -> Optional[bool]:
    if not dao_contract_instance: connect_and_load_dao_contract()
    if not dao_contract_instance: return None
    try:
        checksum_address = dao_web3_instance.to_checksum_address(address)
        return dao_contract_instance.functions.isVoter(checksum_address).call()
    except Exception as e:
        logger.error(f"DAO Error checking if {address} is voter: {e}", exc_info=True)
        return None

def get_all_dao_proposals() -> List[Dict[str, Any]]:
    """Fetches details for all proposals by iterating up to proposalCount."""
    if not dao_contract_instance: connect_and_load_dao_contract()
    if not dao_contract_instance: return []

    count = get_dao_proposal_count()
    if count is None: return []

    all_proposals = []
    for i in range(count):
        proposal = get_dao_proposal_details(i)
        if proposal:
            all_proposals.append(proposal)
    return all_proposals

# Initialize connection on module load
connect_and_load_dao_contract()

if __name__ == '__main__':
    logger.info("Testing DAO Interactor Module...")
    if not dao_is_connected_and_configured:
        logger.error("DAO Contract not configured. Set ZERO_HACK_DAO_CONTRACT_ADDRESS and ensure ABI is correct.")
        logger.info(f"Expected DAO ABI path: {os.path.abspath(DAO_ABI_FILE_PATH)}")
    else:
        logger.info("DAO Interactor connected and contract loaded.")

        count = get_dao_proposal_count()
        logger.info(f"Current proposal count: {count}")

        if count is not None and count > 0:
            logger.info("Fetching details for proposal ID 0:")
            proposal_0 = get_dao_proposal_details(0)
            if proposal_0:
                logger.info(f"  Proposal 0 Details: {proposal_0}")
            else:
                logger.warning("  Could not fetch proposal 0 details.")

        # Example: Propose a new IP for blacklisting (requires sender credentials in .env)
        # Ensure ZERO_HACK_DAO_SENDER_ACCOUNT_ADDRESS and ZERO_HACK_DAO_SENDER_PRIVATE_KEY are set
        if DAO_SENDER_ACCOUNT_ADDRESS and DAO_SENDER_PRIVATE_KEY:
            logger.info("\nAttempting to create a test proposal...")
            test_ip = "1.2.3.4"
            test_reason = "Test proposal from dao_interactor.py"
            # The DAO contract ABI provided doesn't take voting_duration_days for createProposal
            # tx_hash_propose = propose_ip_blacklist(test_ip, test_reason, voting_duration_days=1)
            # Adapting to the ABI provided:
            # The `createProposal` function in the provided ABI only takes `_ip` and `_reason`.
            # The voting duration must be fixed in the contract or implicitly managed.
            # For the `propose_ip_blacklist` wrapper, I'll remove `voting_duration_days` if it's not in the ABI.
            # Re-checking ABI: `createProposal(string memory _ip, string memory _reason)` - correct.

            # Let's simulate a direct call based on this structure
            logger.info(f"Simulating call to createProposal for IP: {test_ip}, Reason: {test_reason}")
            # tx_hash_propose = propose_ip_blacklist(test_ip, test_reason) # This would make the call
            # if tx_hash_propose:
            #     logger.info(f"  Test proposal submitted. Tx Hash: {tx_hash_propose}")
            #     # To test voting and execution, you'd need the proposal ID from events or by listing proposals
            # else:
            #     logger.error("  Test proposal submission failed.")
            logger.warning("Actual proposal creation test commented out. Requires valid sender credentials and gas.")
        else:
            logger.warning("DAO Sender credentials not set in .env. Skipping proposal creation test.")

        logger.info("\nTesting check_is_voter (using DAO_SENDER_ACCOUNT_ADDRESS if set):")
        if DAO_SENDER_ACCOUNT_ADDRESS:
            is_a_voter = check_is_voter(DAO_SENDER_ACCOUNT_ADDRESS)
            logger.info(f"Is {DAO_SENDER_ACCOUNT_ADDRESS} a voter? {is_a_voter}")
        else:
            logger.warning("DAO_SENDER_ACCOUNT_ADDRESS not set, cannot test isVoter effectively.")

    logger.info("DAO Interactor test run finished.")
